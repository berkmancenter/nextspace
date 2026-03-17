# Session & Token System — Developer Guide

> **Audience:** New developers joining the Nextspace project.  
> **Goal:** Give you a complete mental model of how authentication, sessions, tokens, and
> token refresh work end-to-end — across page navigations, HTTP calls, WebSocket
> connections, and multiple browser tabs.

---

## Table of Contents

1. [Big Picture](#1-big-picture)
2. [Key Files at a Glance](#2-key-files-at-a-glance)
3. [The Session Cookie](#3-the-session-cookie)
4. [SessionManager — App Startup & Identity](#4-sessionmanager--app-startup--identity)
5. [TokenManager — Single Source of Truth for Tokens](#5-tokenmanager--single-source-of-truth-for-tokens)
6. [Api class (Helpers.ts) — Thin Wrapper](#6-api-class-helpersts--thin-wrapper)
7. [HTTP Requests — Token Refresh on 401](#7-http-requests--token-refresh-on-401)
8. [WebSocket — Token Refresh on Auth Errors](#8-websocket--token-refresh-on-auth-errors)
9. [Proactive Refresh — Expiry-Based Scheduling](#9-proactive-refresh--expiry-based-scheduling)
10. [Cross-Tab Coordination (BroadcastChannel)](#10-cross-tab-coordination-broadcastchannel)
11. [Page Navigation Scenarios](#11-page-navigation-scenarios)
12. [Logout Path](#12-logout-path)
13. [Data-Flow Diagrams](#13-data-flow-diagrams)
14. [Common Pitfalls & Debugging](#14-common-pitfalls--debugging)
15. [Test Coverage Reference](#15-test-coverage-reference)

---

## 1. Big Picture

Nextspace supports two kinds of users:

| Kind | How they get in | Token source |
|---|---|---|
| **Guest** | Auto-registered on first visit; username starts with "Guest" | API `/auth/register` after `/auth/newPseudonym` |
| **Authenticated** | Explicit login via `/login` page | API `/auth/login` |

Both kinds receive a standard **JWT access token + refresh token pair** from the backend API. These tokens are:

- Stored **in memory** inside `TokenManager` (with their ISO-8601 expiry timestamps)
- Persisted **in an encrypted HttpOnly cookie** (`nextspace-session`) so they survive page refresh
- Automatically refreshed **before they expire** (proactive) and **on demand** when a 401 is received

The entire refresh subsystem funnels through a single class — **`TokenManager`** — which is a process singleton. It deduplicates concurrent callers, coordinates across browser tabs, and schedules timers based on real expiry times.

```
┌─────────────────────────────────────────────────────────────┐
│                       Browser Process                       │
│                                                             │
│  ┌─────────────┐    ┌─────────────────────────────────────┐│
│  │SessionManager│    │           TokenManager              ││
│  │  (identity) │◄──►│  tokens + expiry + refresh timer    ││
│  └─────────────┘    │  dedup • BroadcastChannel           ││
│                     └──────────┬──────────────────────────┘│
│                                │ access token               │
│           ┌────────────────────┼─────────────────┐         │
│           ▼                    ▼                  ▼         │
│     HTTP fetch()          socket.auth         Api class     │
│   (fetchWithTokenRefresh) (useSessionJoin)  (Helpers.ts)    │
└─────────────────────────────────────────────────────────────┘
                                 │
                    ┌────────────▼───────────────┐
                    │  Encrypted cookie           │
                    │  /api/session  (PATCH/POST) │
                    │  /api/cookie   (GET)        │
                    │  /api/request  (proxy)      │
                    └────────────────────────────┘
```

---

## 2. Key Files at a Glance

| File | Role |
|---|---|
| `utils/TokenManager.ts` | **Single source of truth.** Stores tokens + expiry, deduplicated refresh, proactive timer, BroadcastChannel, subscriber notifications. |
| `utils/SessionManager.ts` | Manages session *identity* (guest vs authenticated, userId/username). Calls `TokenManager` indirectly via `Api.get().SetTokens()`. |
| `utils/Helpers.ts` — `Api` class | Thin compatibility wrapper. `SetTokens`/`GetTokens`/`ClearTokens` all delegate to `TokenManager`. |
| `utils/tokenRefresh.ts` | Thin wrappers: `ensureFreshToken()`, `refreshAccessToken()`, `emitWithTokenRefresh()`. |
| `utils/useSessionJoin.ts` | React hook that creates the Socket.io connection and handles token-aware reconnection. |
| `utils/Api.ts` | `fetchWithTokenRefresh()` — wraps `fetch()` with 401 retry. `Request()` — server-side proxy caller. |
| `pages/api/session.ts` | Next.js API route. POST = create cookie; PATCH = update tokens in existing cookie. |
| `pages/api/cookie.ts` | Next.js API route. GET = decrypt cookie and return tokens + user info + expiry timestamps. |
| `pages/api/request.ts` | Server-side proxy: forwards requests to the backend API using cookie credentials. Adds `X-Tokens-Refreshed: true` header if it had to refresh. |
| `pages/_app.tsx` | Calls `SessionManager.get().restoreSession()` once on app mount. |
| `pages/login.tsx` | Calls `Api.get().SetTokens(access, refresh, accessExpires, refreshExpires)` after login. |

---

## 3. The Session Cookie

The cookie is named **`nextspace-session`** and is:
- **HttpOnly** (no JavaScript access — must go through `/api/cookie` to read it)
- **Encrypted** with JWE (Jose `EncryptJWT` / `jwtDecrypt`) using `SESSION_SECRET`
- **SameSite=Strict** — not sent on cross-origin requests

### Cookie Payload

```ts
{
  sub: string;           // username (Subject)
  userId: string;
  access: string;        // access token string
  refresh: string;       // refresh token string
  accessExpires: string; // ISO-8601, e.g. "2026-03-17T21:12:00Z"
  refreshExpires: string;
  authType: "guest" | "authenticated";
  version: number;       // CURRENT_COOKIE_VERSION for schema validation
}
```

The `accessExpires` / `refreshExpires` fields are critical — they let the client schedule proactive refresh without decoding the JWT itself. Prior to the Token Refresh Hardening work (2026-03-16), these were not stored in the cookie and proactive refresh was broken.

### Cookie API Routes

| Route | Method | Purpose |
|---|---|---|
| `/api/cookie` | GET | Decrypt the cookie, validate its schema, return tokens + expiry + user info |
| `/api/session` | POST | Create a new cookie (initial session or after login) |
| `/api/session` | PATCH | Update tokens in an existing cookie (after a client-side refresh) |
| `/api/logout` | POST | Clear the cookie |

---

## 4. SessionManager — App Startup & Identity

`SessionManager` is a **process singleton** (`SessionManager.get()`). It owns the user's *identity* state.

### State Machine

```
  uninitialized
       │
       │ restoreSession() called
       ▼
  initializing  ──── cookie exists ────► authenticated (username doesn't start "Guest")
       │                              └─► guest        (username starts "Guest")
       │
       │ no cookie → _createGuestSession()
       ▼
    guest
       │
       │ user logs in → markAuthenticated()
       ▼
  authenticated
       │
       │ logout → clearSession()
       ▼
    cleared
```

### `restoreSession(options?)`

Called **once** by `_app.tsx` during initial render. It:

1. Checks if already initialized — if so, returns immediately (prevents race on rapid navigation)
2. Fetches `/api/cookie` to check for an existing session
3. **If cookie exists:** calls `Api.get().SetTokens(access, refresh, accessExpires, refreshExpires)` → flows through to `TokenManager` → proactive refresh timer starts
4. **If no cookie** (and `skipCreation` is not true): calls `_createGuestSession()` which hits `/auth/newPseudonym` + `/auth/register`, stores tokens, creates cookie
5. **If multiple calls arrive simultaneously:** they all await the same `initializationPromise` — no race conditions

### `markAuthenticated(username?, userId?)`

Called from `pages/login.tsx` after a successful login. Transitions state from `guest` → `authenticated`. If username/userId are provided, updates `currentSession`.

### `clearSession()`

Called on logout. Sets state to `cleared`, nulls `currentSession`, calls `Api.get().ClearTokens()` which delegates to `TokenManager.clearTokens()` — this also cancels the proactive refresh timer.

---

## 5. TokenManager — Single Source of Truth for Tokens

`utils/TokenManager.ts` is the heart of the system. It is a **process singleton** accessed via:

```ts
import TokenManagerDefault from "./TokenManager";      // the singleton instance
import { TokenManager } from "./TokenManager";         // the class (for tests)
```

### What It Stores

```ts
type TokenPair = {
  token: string;    // the raw token string
  expires: string;  // ISO-8601 expiry
};

type TokenSet = {
  access: TokenPair;
  refresh: TokenPair;
};
```

### Core API

| Method | Purpose |
|---|---|
| `setTokens(tokens, broadcast?)` | Store full token set. Triggers timer + notifies listeners + broadcasts to other tabs |
| `setTokensFromStrings(access, refresh, accessExpires?, refreshExpires?)` | Convenience for callers that have strings. Synthesises expiry if not provided |
| `getAccessToken()` | Returns current access token string or `""` |
| `getTokens()` | Returns `{ access: string\|null, refresh: string\|null }` (backward-compat shape) |
| `getFullTokens()` | Returns the full `TokenSet` including expires fields, or `null` |
| `isAccessTokenFresh()` | `true` if token expires > 2 minutes from now |
| `getValidToken()` | Returns fresh token immediately, or triggers refresh first. Use this in WS callers |
| `refresh()` | Explicit refresh. Deduplicated: concurrent callers share one Promise |
| `clearTokens()` | Clear everything and cancel the proactive timer |
| `onTokensChanged(listener)` | Subscribe to token updates. Called immediately if tokens exist. Returns unsubscribe fn |

### Refresh Flow (inside `_doRefresh()`)

```
1. Check cookie (/api/cookie)
   └─ If cookie has a DIFFERENT (newer) access token:
      → adopt those tokens (another tab already refreshed)
      → return true  ← no network call to backend

2. If refresh token missing → return false

3. Broadcast { type: "REFRESH_STARTING" } to other tabs

4. POST /auth/refresh-tokens  (backend API)
   ├─ 401 → call /api/logout, clearTokens(), return false
   ├─ other error → throw
   └─ success:
      a. setTokens(newTokens, broadcast=true)   ← notifies listeners + other tabs
      b. PATCH /api/session  with new tokens + expiry (retry once on failure)
      c. return true
```

### Deduplication

`_inflightRefresh` is a single `Promise<boolean>`. Once a refresh starts, all subsequent `refresh()` calls return the same promise:

```ts
if (this._inflightRefresh) {
  return this._inflightRefresh;  // all concurrent callers get the same promise
}
this._inflightRefresh = this._doRefresh();
// ... await, then set to null
```

This means if an HTTP 401 and a WebSocket connect_error both trigger `refresh()` at the same millisecond, **only one request goes to the server**.

### Rate Limiting

`_lastRefreshAt` records the timestamp of the last successful refresh. If `refresh()` is called again within 10 seconds, it returns immediately without making a network call.

---

## 6. Api class (Helpers.ts) — Thin Wrapper

`Api` is a singleton class (`Api.get()`) that pre-dates `TokenManager`. Its token methods are now thin wrappers:

```ts
SetTokens(access, refresh, accessExpires?, refreshExpires?)
  → TokenManagerDefault.setTokensFromStrings(...)

GetTokens()
  → TokenManagerDefault.getTokens()   // { access, refresh }

getAccessToken()
  → TokenManagerDefault.getAccessToken()

IsLoggedIn()
  → TokenManagerDefault.getAccessToken() !== ""

ClearTokens()
  → TokenManagerDefault.clearTokens()
```

**Always prefer** calling `Api.get().SetTokens(...)` (with all 4 args) or `TokenManagerDefault.setTokens(...)` directly over manipulating token state any other way.

---

## 7. HTTP Requests — Token Refresh on 401

### `fetchWithTokenRefresh()` (utils/Api.ts)

Used by `RetrieveData()` for direct backend calls:

```
1. (optional) Add Authorization: Bearer <token> header if useStoredTokens=true
2. fetch(url, options)
3. If response.status === 401 AND refresh token exists:
   a. await TokenManagerDefault.refresh()
      └─ deduplicated — WS may already be refreshing; we share the promise
   b. Get fresh token: Api.get().getAccessToken()
   c. retry fetch with new Authorization header
4. Return response
```

### `Request()` (utils/Api.ts)

Used for admin/moderator calls that route through the **server-side proxy** (`/api/request`):

```
1. fetch("/api/request", ...)
2. Check response header X-Tokens-Refreshed: true
   └─ If present: call TokenManagerDefault.refresh()
      (syncs fresh tokens from the updated cookie into memory)
3. Return response data
```

The server-side proxy (`pages/api/request.ts`) uses the cookie's tokens directly. If those are expired it refreshes them server-side and updates the cookie, then sets `X-Tokens-Refreshed: true` in the response so the client can sync.

### `RetrieveData()` (utils/Api.ts)

A convenience wrapper around `fetchWithTokenRefresh()` that prepends `NEXT_PUBLIC_API_URL`, handles JSON parsing, and formats errors.

---

## 8. WebSocket — Token Refresh on Auth Errors

### `useSessionJoin` hook (utils/useSessionJoin.ts)

This is the entry point for all WebSocket-connected pages (assistant, moderator, backchannel).

**Initialization (runs once):**
```
1. SessionManager.get().getSessionInfo() → { userId, username }
2. Api.get().GetTokens().access → initial token
3. io(SOCKET_URL, { auth: { token } })
4. Subscribe to TokenManager.onTokensChanged(...)
```

**`connect_error` handler:**
```
socket.on("connect_error", async (error) => {
  if (error is auth-related) {
    await TokenManagerDefault.refresh()   // deduplicated with HTTP callers
    socket.auth = { token: newToken }     // Socket.io auto-retries with new auth
  }
})
```

**`onTokensChanged` handler (proactive refresh arrives):**
```
TokenManagerDefault.onTokensChanged((tokens) => {
  socket.auth = { token: tokens.access.token }  // always update auth
  if (!socket.connected) {
    socket.connect()   // reconnect if currently disconnected
  }
  // if already connected: do NOT call connect() — no disruption
})
```

**Tab visibility handler:**
```
document.addEventListener("visibilitychange", async () => {
  if (document.visibilityState === "visible") {
    await TokenManagerDefault.getValidToken()  // triggers refresh if needed
    // socket reconnection handled by onTokensChanged if tokens were refreshed
  }
})
```

**Gap-reconnect detection:**  
If the socket was disconnected for ≥ 10 seconds before reconnecting, `lastReconnectTime` is set to `Date.now()`. Pages watch this in a `useEffect` to re-fetch message history from the REST API.

### `emitWithTokenRefresh()` (utils/tokenRefresh.ts)

For socket events that need guaranteed fresh tokens:
```
1. ensureFreshToken() → getValidToken() → token or null
2. If null → call onError
3. socket.emit(event, { ...data, token: freshToken }, callback)
4. In callback: if 401 auth error → refresh → retry once
```

---

## 9. Proactive Refresh — Expiry-Based Scheduling

Previously, a fixed 25-minute `setInterval` was used. Now `TokenManager` schedules a `setTimeout` based on the real expiry timestamp:

```
timer delay = accessToken.expires − 2 minutes − Date.now()
```

- **If `delay > 0`:** schedule timer for that many milliseconds from now
- **If `delay ≤ 0`:** token is already within the buffer window — trigger refresh immediately (async)
- **On `setTokens()`:** cancel any existing timer and schedule a new one with the new expiry
- **On `clearTokens()`:** cancel the timer

The 2-minute buffer (`REFRESH_BUFFER_MS`) ensures tokens are refreshed well before they actually expire, preventing 401s from hitting the user.

---

## 10. Cross-Tab Coordination (BroadcastChannel)

When multiple tabs are open they all share the same cookie but each has its own in-memory `TokenManager`. Without coordination they would all send their own refresh request at the same time.

`BroadcastChannel` (channel name: `"nextspace-token-refresh"`) prevents this:

### Message Types

| Message | Sent when | Received action |
|---|---|---|
| `TOKENS_REFRESHED` | Any tab completes a refresh and calls `setTokens(broadcast=true)` | Other tabs call `setTokens(tokens, false)` — adopt new tokens, no echo |
| `REFRESH_STARTING` | A tab is about to call the refresh API | Other tabs log "standing by" — their proactive timer will simply not fire because by the time it does, `TOKENS_REFRESHED` will have arrived and `isAccessTokenFresh()` will return `true` |

### Multi-Tab Refresh Race Prevention

```
Tab A's timer fires → _doRefresh() starts:
  Step 1: GET /api/cookie → token is stale (Tab A hasn't refreshed yet)
  Step 3: broadcast REFRESH_STARTING
  Step 4: POST /auth/refresh-tokens → success
  setTokens(newTokens, broadcast=true) → broadcasts TOKENS_REFRESHED

Tab B's timer fires (at nearly the same time) → _doRefresh() starts:
  Step 1: GET /api/cookie → token is FRESH (Tab A already refreshed the cookie!)
  → isAccessTokenFresh() returns true
  → return true  ← no network call
```

Even if Tab B's timer fires between Tab A's refresh and the `TOKENS_REFRESHED` broadcast, the cookie check in Step 1 catches it.

---

## 11. Page Navigation Scenarios

### Guest → same page refresh
`_app.tsx` calls `SessionManager.restoreSession()` → `/api/cookie` returns valid tokens → `TokenManager` is populated with expiry → proactive timer scheduled. The user sees no disruption.

### Guest → different page (e.g. assistant → moderator)
`SessionManager` is a singleton — it's already `"guest"` or `"authenticated"`. The second page's `_app.tsx` call returns immediately (`sessionState !== "uninitialized"`). Tokens are still in `TokenManager`.

### Admin login → participant page
1. `/login` page calls the backend `/auth/login`
2. On success: `Api.get().SetTokens(access, refresh, accessExpires, refreshExpires)` — expiry stored in `TokenManager`, proactive timer starts
3. `/api/session` POST — cookie updated with new tokens and expiry
4. `SessionManager.markAuthenticated(username, userId)` — state = `"authenticated"`
5. Navigate to `/assistant` — `SessionManager` already initialized, `TokenManager` has tokens → `useSessionJoin` uses them immediately

### Two tabs open simultaneously
- Both tabs call `restoreSession()` → both read from `/api/cookie` → both get same tokens
- Each tab's `TokenManager` is independent but has the same state
- When Tab A's proactive timer fires, Tab B gets `TOKENS_REFRESHED` broadcast and skips its own refresh

### Tab hidden (phone locks / browser minimized)
- Token may expire while tab is hidden
- On `visibilitychange` → `visible`: `getValidToken()` is called → detects stale token → `refresh()` → new token in `TokenManager` → `onTokensChanged` fires → `socket.auth` updated → if socket was disconnected, `socket.connect()` called

---

## 12. Logout Path

```
User clicks logout
  → fetch("/api/logout", { method: "POST" })   ← clears the cookie server-side
  → Api.get().ClearTokens()
     → TokenManagerDefault.clearTokens()
       → _tokens = null
       → _cancelProactiveRefresh()   ← cancels the timer
  → SessionManager.clearSession()    ← if not already called
  → router.push("/login")
```

---

## 13. Data-Flow Diagrams

### First Visit (New Guest)

```
Browser                _app.tsx              SessionManager         External API
   │                      │                       │                     │
   │── render ──────────► │                       │                     │
   │                      │─ restoreSession() ───►│                     │
   │                      │                       │─ GET /api/cookie ──►│
   │                      │                       │◄─ 401 no cookie ────│
   │                      │                       │─ GET /auth/newPseudonym ►│
   │                      │                       │◄─ { token, pseudonym } ─│
   │                      │                       │─ POST /auth/register ──►│
   │                      │                       │◄─ { tokens, user } ─────│
   │                      │                       │─ Api.SetTokens() ──► TokenManager
   │                      │                       │─ POST /api/session ─►│  (stores with expiry,
   │                      │                       │◄─ 200 cookie set ───│   schedules timer)
   │◄── render page ──────│◄── sessionInfo ───────│
```

### Proactive Token Refresh (single tab)

```
TokenManager timer fires (2 min before expiry)
  │
  ├─ GET /api/cookie → same stale token
  ├─ POST /auth/refresh-tokens → { access, refresh, expires... }
  ├─ setTokens(newTokens, broadcast=true)
  │    ├─ _scheduleProactiveRefresh() → new timer
  │    ├─ _notifyListeners() → useSessionJoin updates socket.auth
  │    └─ BroadcastChannel → other tabs adopt tokens
  └─ PATCH /api/session → cookie updated
```

### HTTP 401 Recovery

```
Page component
  │─ RetrieveData("some/endpoint") ──────────────────────► Backend API
  │                                                         │
  │◄─ 401 Unauthorized ──────────────────────────────────── │
  │
  │─ TokenManagerDefault.refresh()
  │    (dedup: WS caller may share this same promise)
  │    │─ GET /api/cookie → stale
  │    │─ POST /auth/refresh-tokens → new tokens
  │    └─ setTokens(), PATCH /api/session
  │
  │─ retry original request with new Authorization header ► Backend API
  │◄─ 200 OK ─────────────────────────────────────────────── │
```

---

## 14. Common Pitfalls & Debugging

### "Token refresh not working / still getting 401s"

1. Check that `SetTokens` is being called with all 4 args (including `accessExpires`/`refreshExpires`). Without expiry info, the proactive timer cannot schedule correctly and `TokenManager` synthesises a 30-minute expiry instead of the real one.
2. Check the cookie: open Network tab → find `/api/cookie` request → verify `accessExpires` is present in the response JSON.
3. Check browser console for `TokenManager: proactive refresh scheduled in Xs` — if this isn't appearing after login, expiry info is missing.

### "Two tabs are both hitting the refresh endpoint"

1. Verify `BroadcastChannel` is supported in the browser (all modern browsers since Chrome 54, Firefox 38).
2. Look for `TokenManager: received refreshed tokens from another tab` in the console of Tab B. If it's not appearing, the channel isn't working.
3. Check for the `REFRESH_STARTING` message appearing before the refresh completes in Tab A.

### "Admin login tokens don't work on participant page"

`TokenManager` is a **process singleton** — it persists as long as the JavaScript process is alive. If a Next.js page navigation causes a **full page reload**, the singleton is destroyed. Ensure that:
- Navigation between admin and participant pages uses `router.push()` (client-side navigation) not `window.location.href = ...`
- The cookie always has valid tokens as the source of truth — `SessionManager.restoreSession()` will reload them from the cookie on the next page

### "Socket disconnects when token refreshes"

This is by design — `socket.auth` is updated with the new token but `connect()` is only called if the socket is **disconnected**. If the socket is connected, it will use the new token on the next reconnection. The socket itself doesn't need to be reconnected just because the token changed.

### "Getting 401 right after refresh"

Check that the backend's clock and the client's clock are roughly in sync. `REFRESH_BUFFER_MS = 2 * 60 * 1000` (2 minutes) — if the clocks are more than 2 minutes off, the buffer won't help.

### Useful Console Logs

| Log message | Meaning |
|---|---|
| `TokenManager: proactive refresh scheduled in Xs` | Expiry correctly parsed, timer set |
| `TokenManager: tokens already refreshed (cookie sync)` | Multi-tab safety worked; skipped network call |
| `TokenManager: received refreshed tokens from another tab` | BroadcastChannel delivered tokens |
| `TokenManager: another tab is refreshing — standing by` | Received REFRESH_STARTING |
| `TokenManager: token refresh successful` | Full refresh cycle completed |
| `TokenManager: refresh token expired, logging out` | Both tokens expired; user will be redirected |
| `Socket auth error detected, refreshing token via TokenManager…` | WS connect_error with 401 |
| `Reconnected after Xs gap — signalling history re-fetch` | Gap-reconnect detected; page should re-fetch history |
| `Server-side token refresh detected — syncing TokenManager from cookie…` | Admin-route proxy refreshed server-side |

---

## 15. Test Coverage Reference

All tests live in `__tests__/utils/` and `__tests__/integration/`.

| Test File | What It Covers |
|---|---|
| `TokenManager.test.ts` | Token storage/retrieval, `isAccessTokenFresh`, `getValidToken`, refresh deduplication, rate-limiting, cookie sync (multi-tab), cookie PATCH + retry, proactive scheduling, `onTokensChanged` (single + multiple listeners), BroadcastChannel (broadcast, receive, timer reschedule, REFRESH_STARTING), edge cases (no tokens, empty response, 401→logout) |
| `tokenRefresh.test.ts` | `ensureFreshToken` delegate, `refreshAccessToken` delegate, `emitWithTokenRefresh` (no token, emit, retry on 401, retry fail, non-auth error) |
| `useSessionJoin.test.ts` | Init, session info, socket creation, connect/disconnect state, connect_error (auth + non-auth), visibility change (disconnected → reconnect, connected → no reconnect), onTokensChanged (subscribe, update auth, connected → no connect(), unsubscribe), gap-reconnect detection |
| `SessionManager.test.ts` | Singleton, session restore from cookie, guest detection, new guest creation, dedup on concurrent calls, auth/guest state transitions, `skipCreation` option, error handling |
| `Api.test.ts` | `fetchWithTokenRefresh` (success, stored tokens, 401+retry, no refresh token, refresh fails), `RetrieveData`, `RefreshToken` (success, 401→logout, network error), `Request()` X-Tokens-Refreshed header |
| `SessionFlow.test.tsx` | End-to-end flow scenarios: new visitor, guest create/restore, rapid navigation dedup, guest→authenticated, restore authenticated, logout, admin→participant token continuity |

**Run all tests:**
```bash
npx jest --no-coverage
# Expected: 42 suites, 768 tests, all green
```

**Run a specific file:**
```bash
npx jest --no-coverage --testPathPattern="TokenManager"
```
