/**
 * TokenManager — Single source of truth for all token operations.
 *
 * Replaces the fragmented token storage / refresh logic that was previously
 * spread across `Api.ts`, `tokenRefresh.ts`, and `useSessionJoin.ts`.
 *
 * Responsibilities:
 * - Stores access + refresh tokens **with** their expiry timestamps
 * - Exposes a single `refresh()` method (deduplicated across HTTP + WS callers)
 * - Schedules proactive refresh based on the real token expiry (not a fixed interval)
 * - Coordinates across browser tabs via `BroadcastChannel` so only one tab sends
 *   a refresh request — all others simply receive the new tokens
 * - Notifies in-process subscribers (e.g. the socket) via a lightweight listener API
 *
 * NOTE: TokenManager intentionally does NOT import from Api.ts or Helpers.ts to
 * avoid a circular dependency (Helpers → TokenManager → Api → Helpers).
 * All HTTP calls are made with raw `fetch` or injected via a setter for testability.
 */

// How many milliseconds before expiry we proactively refresh.
const REFRESH_BUFFER_MS = 2 * 60 * 1000; // 2 minutes

// Minimum time between refresh attempts to avoid hammering the server.
const MIN_REFRESH_INTERVAL_MS = 10_000; // 10 seconds

const BROADCAST_CHANNEL_NAME = 'nextspace-token-refresh';

export type TokenPair = {
  token: string;
  /** ISO-8601 date string from the server, e.g. "2026-03-16T21:12:00.000Z" */
  expires: string;
};

export type TokenSet = {
  access: TokenPair;
  refresh: TokenPair;
};

type TokenChangeListener = (tokens: TokenSet) => void;

/**
 * BroadcastChannel message types for cross-tab coordination.
 *
 * TOKENS_REFRESHED carries the `userId` the tokens belong to so receiving tabs
 * can refuse to adopt tokens for a different user (which would cause the tab to
 * authenticate as one user while building channel names for another).
 */
type TabMessage =
  | { type: 'TOKENS_REFRESHED'; tokens: TokenSet; userId: string | null }
  | { type: 'REFRESH_STARTING' };

class TokenManagerClass {
  private static _instance: TokenManagerClass;

  private _tokens: TokenSet | null = null;
  // The user the current tokens belong to.  Set by authoritative local writes
  // (guest creation, login, cookie restore, in-tab refresh).  Used to reject
  // tokens from other users arriving via BroadcastChannel or cookie sync.
  private _ownerUserId: string | null = null;
  private _inflightRefresh: Promise<boolean> | null = null;
  private _proactiveTimer: ReturnType<typeof setTimeout> | null = null;
  private _lastRefreshAt: number = 0;
  private _listeners: Set<TokenChangeListener> = new Set();
  private _channel: BroadcastChannel | null = null;

  private constructor() {
    this._initBroadcastChannel();
  }

  static get(): TokenManagerClass {
    if (!this._instance) {
      this._instance = new TokenManagerClass();
    }
    return this._instance;
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  Public API
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Store a new set of tokens (with expiry).  Schedules the next proactive
   * refresh and notifies subscribers + other tabs.
   *
   * @param tokens  Full token set including expires timestamps.
   * @param opts.broadcast  Set false when the tokens came from a broadcast or
   *                        cookie sync (to avoid an infinite loop). Defaults to true.
   * @param opts.userId  The user the tokens belong to.  Provided by authoritative
   *                     local writes (guest creation, login, cookie restore) to
   *                     (re)establish the token owner.  When omitted the existing
   *                     owner is preserved (e.g. an in-tab refresh keeps the same
   *                     user).  The owner is broadcast so other tabs can reject
   *                     tokens that belong to a different user.
   */
  setTokens(tokens: TokenSet, opts: { broadcast?: boolean; userId?: string | null } = {}): void {
    const { broadcast = true, userId } = opts;
    this._tokens = tokens;
    if (userId !== undefined) {
      this._ownerUserId = userId;
    }
    this._scheduleProactiveRefresh();
    this._notifyListeners(tokens);
    if (broadcast) {
      this._broadcast({ type: 'TOKENS_REFRESHED', tokens, userId: this._ownerUserId });
    }
  }

  /**
   * Convenience overload for callers that only have token strings and expiry
   * info available at the same time.
   */
  setTokensFromStrings(
    accessToken: string,
    refreshToken: string,
    accessExpires?: string,
    refreshExpires?: string,
    userId?: string,
  ): void {
    // When expires info is unavailable (legacy callers) synthesise a plausible
    // expiry so scheduling still works — 30 min for access, 30 days for refresh.
    const now = Date.now();
    const safeAccessExpires = accessExpires ?? new Date(now + 30 * 60 * 1000).toISOString();
    const safeRefreshExpires = refreshExpires ?? new Date(now + 30 * 24 * 60 * 60 * 1000).toISOString();

    this.setTokens(
      {
        access: { token: accessToken, expires: safeAccessExpires },
        refresh: { token: refreshToken, expires: safeRefreshExpires },
      },
      { userId },
    );
  }

  /**
   * Returns the current access token string, or an empty string if no tokens
   * are stored.  Always read at point-of-use — never capture in a closure.
   */
  getAccessToken(): string {
    return this._tokens?.access.token ?? '';
  }

  /**
   * Returns the raw token pair, or null.
   * Mirrors the old `Api.get().GetTokens()` return shape for compatibility.
   */
  getTokens(): { access: string | null; refresh: string | null } {
    return {
      access: this._tokens?.access.token ?? null,
      refresh: this._tokens?.refresh.token ?? null,
    };
  }

  /**
   * Returns the full `TokenSet` (with expiry info), or null.
   */
  getFullTokens(): TokenSet | null {
    return this._tokens;
  }

  /**
   * Returns true if the current access token is still valid (i.e. not expired
   * and not within the refresh buffer window).
   */
  isAccessTokenFresh(): boolean {
    if (!this._tokens) return false;
    const expiresAt = new Date(this._tokens.access.expires).getTime();
    return Date.now() < expiresAt - REFRESH_BUFFER_MS;
  }

  /**
   * Returns a valid, fresh access token.  If the current token is still good
   * it is returned immediately.  If it is expired or within the buffer window
   * a refresh is triggered first.  Concurrent callers all await the same
   * in-flight promise rather than each sending their own request.
   */
  async getValidToken(): Promise<string | null> {
    if (this.isAccessTokenFresh()) {
      return this._tokens!.access.token;
    }
    const refreshed = await this.refresh();
    return refreshed ? this.getAccessToken() : null;
  }

  /**
   * Explicit token refresh.  Deduplicated: concurrent callers all share the
   * same promise.  Before calling the server the manager first checks the
   * cookie to see if another tab already refreshed (handles multi-tab race).
   */
  async refresh(): Promise<boolean> {
    // Rate-limit to avoid hammering the server on rapid successive calls.
    if (Date.now() - this._lastRefreshAt < MIN_REFRESH_INTERVAL_MS) {
      return this._tokens !== null;
    }

    if (this._inflightRefresh) {
      return this._inflightRefresh;
    }

    this._inflightRefresh = this._doRefresh();

    try {
      return await this._inflightRefresh;
    } finally {
      this._inflightRefresh = null;
    }
  }

  /**
   * Clear all tokens (e.g. on logout).  Cancels any pending proactive refresh.
   */
  clearTokens(): void {
    this._tokens = null;
    this._ownerUserId = null;
    this._cancelProactiveRefresh();
  }

  /**
   * Subscribe to token change events.  The callback is called immediately
   * with the current tokens (if any) and then on every subsequent change.
   * Returns an unsubscribe function.
   */
  onTokensChanged(listener: TokenChangeListener): () => void {
    this._listeners.add(listener);
    if (this._tokens) {
      listener(this._tokens);
    }
    return () => {
      this._listeners.delete(listener);
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  Private helpers
  // ─────────────────────────────────────────────────────────────────────────

  private async _doRefresh(): Promise<boolean> {
    // Step 1: Before making a network call, check the cookie — another tab or
    // the server may have already refreshed while we were idle.
    const cookieSynced = await this._syncFromCookie();
    if (cookieSynced && this.isAccessTokenFresh()) {
      // Another tab already took care of the refresh.
      console.log('TokenManager: tokens already refreshed (cookie sync)');
      return true;
    }

    // Step 2: Make sure we have a refresh token to use.
    let refreshToken = this._tokens?.refresh.token ?? null;
    if (!refreshToken) {
      console.error('TokenManager: no refresh token available');
      return false;
    }

    // Step 3: Broadcast to other tabs that we are starting a refresh so they
    // can avoid sending their own concurrent request.
    this._broadcast({ type: 'REFRESH_STARTING' });

    try {
      console.log('TokenManager: refreshing access token…');
      const response = await this._callRefreshApi(refreshToken);

      if (response?.access?.token && response?.refresh?.token) {
        const newTokens: TokenSet = {
          access: {
            token: response.access.token,
            expires: response.access.expires ?? new Date(Date.now() + 30 * 60 * 1000).toISOString(),
          },
          refresh: {
            token: response.refresh.token,
            expires: response.refresh.expires ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          },
        };

        // Update in-memory store and schedule next refresh.  An in-tab refresh
        // keeps the same user, so we don't pass userId — the existing owner is
        // preserved and broadcast to other tabs.
        this.setTokens(newTokens, { broadcast: true }); // broadcasts to other tabs
        this._lastRefreshAt = Date.now();

        // Persist to the cookie so server-side routes and other tabs can read.
        await this._patchCookie(newTokens);

        console.log('TokenManager: token refresh successful');
        return true;
      }

      console.error('TokenManager: refresh response missing tokens');
      return false;
    } catch (err) {
      console.error('TokenManager: refresh error:', err);
      return false;
    }
  }

  /**
   * Fetch the current cookie and update in-memory tokens if they differ.
   * Returns true if a sync occurred (i.e. the cookie had different/newer tokens).
   */
  private async _syncFromCookie(): Promise<boolean> {
    try {
      const res = await fetch('/api/cookie');
      if (!res.ok) return false;

      const data = await res.json();
      if (!data.tokens?.access || !data.tokens?.refresh) return false;

      const cookieAccess = data.tokens.access as string;
      const cookieRefresh = data.tokens.refresh as string;
      const cookieUserId = (data.userId ?? null) as string | null;

      // Refuse to adopt tokens belonging to a different user.  The cookie is
      // shared across tabs, so another tab (or a login) may have overwritten it
      // with a different user's session.  Adopting it here would make this tab
      // authenticate as that user while still building channel names for our own
      // user.  Let the caller fall back to refreshing with our own refresh token.
      if (this._ownerUserId !== null && cookieUserId !== null && cookieUserId !== this._ownerUserId) {
        console.warn(
          `TokenManager: ignoring cookie tokens for a different user (cookie=${cookieUserId}, owner=${this._ownerUserId})`,
        );
        return false;
      }

      // Only update if the cookie has a different (presumably newer) token.
      if (cookieAccess !== this._tokens?.access.token) {
        this.setTokens(
          {
            access: {
              token: cookieAccess,
              expires: data.tokens.accessExpires ?? new Date(Date.now() + 30 * 60 * 1000).toISOString(),
            },
            refresh: {
              token: cookieRefresh,
              expires: data.tokens.refreshExpires ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            },
          },
          { broadcast: false }, // don't re-broadcast — this came from the cookie
        );
        return true;
      }

      return false;
    } catch (err) {
      console.error('TokenManager: cookie sync error:', err);
      return false;
    }
  }

  /**
   * Write new tokens to the session cookie via the local API route.
   * Retries once on network failure to handle transient errors.
   */
  private async _patchCookie(tokens: TokenSet): Promise<void> {
    const body = JSON.stringify({
      accessToken: tokens.access.token,
      refreshToken: tokens.refresh.token,
      accessExpires: tokens.access.expires,
      refreshExpires: tokens.refresh.expires,
    });

    const doFetch = () =>
      fetch('/api/session', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body,
      });

    try {
      const res = await doFetch();
      if (!res.ok) {
        // Retry once
        await doFetch();
      }
    } catch (err) {
      console.warn('TokenManager: cookie PATCH failed, retrying…', err);
      try {
        await doFetch();
      } catch (retryErr) {
        console.error('TokenManager: cookie PATCH retry failed:', retryErr);
      }
    }
  }

  /**
   * Schedule a proactive refresh to fire 2 minutes before the access token
   * expires, replacing any previously scheduled timer.
   */
  private _scheduleProactiveRefresh(): void {
    this._cancelProactiveRefresh();

    if (!this._tokens) return;

    const expiresAt = new Date(this._tokens.access.expires).getTime();
    const refreshAt = expiresAt - REFRESH_BUFFER_MS;
    const delay = refreshAt - Date.now();

    if (delay <= 0) {
      // Already expired or within the buffer — refresh immediately (async,
      // but don't block the caller).
      this.refresh().catch((err) => console.error('TokenManager: immediate proactive refresh failed:', err));
      return;
    }

    console.log(`TokenManager: proactive refresh scheduled in ${Math.round(delay / 1000)}s`);

    this._proactiveTimer = setTimeout(() => {
      this.refresh().catch((err) => console.error('TokenManager: proactive refresh failed:', err));
    }, delay);
  }

  /**
   * Makes the actual HTTP call to the refresh-tokens endpoint.
   * Extracted as a separate method so it can be replaced in tests via
   * `_setRefreshApiOverride()` — keeping TokenManager free of imports
   * from Api.ts / Helpers.ts (which import TokenManager, creating a cycle).
   *
   * On 401 (all tokens expired) clears the session cookie by calling the
   * local logout route.
   */
  private async _callRefreshApi(refreshToken: string): Promise<any> {
    const apiUrl = (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_API_URL) ?? '';
    try {
      const response = await fetch(`${apiUrl}/auth/refresh-tokens`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      if (response.status === 401) {
        // Refresh token itself has expired — log out completely.
        console.error('TokenManager: refresh token expired, logging out');
        await fetch('/api/logout', { method: 'POST' }).catch(() => {});
        this.clearTokens();
        return null;
      }

      if (!response.ok) {
        throw new Error(`Refresh token request failed: ${response.status}`);
      }

      return await response.json();
    } catch (err) {
      console.error('TokenManager: _callRefreshApi error:', err);
      throw err;
    }
  }

  /**
   * Allows tests to override the refresh API call without mocking `fetch` globally.
   * Call with `null` to restore the default implementation.
   */
  _setRefreshApiOverride(fn: ((refreshToken: string) => Promise<any>) | null): void {
    if (fn === null) {
      this._callRefreshApi = TokenManagerClass.prototype._callRefreshApi.bind(this);
    } else {
      this._callRefreshApi = fn;
    }
  }

  private _cancelProactiveRefresh(): void {
    if (this._proactiveTimer !== null) {
      clearTimeout(this._proactiveTimer);
      this._proactiveTimer = null;
    }
  }

  private _notifyListeners(tokens: TokenSet): void {
    this._listeners.forEach((fn) => {
      try {
        fn(tokens);
      } catch (err) {
        console.error('TokenManager: listener error:', err);
      }
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  Cross-tab BroadcastChannel
  // ─────────────────────────────────────────────────────────────────────────

  private _initBroadcastChannel(): void {
    if (typeof window === 'undefined' || !('BroadcastChannel' in window)) {
      return; // SSR or unsupported browser — skip
    }

    try {
      this._channel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
      this._channel.onmessage = (event: MessageEvent<TabMessage>) => {
        this._handleTabMessage(event.data);
      };
    } catch (err) {
      console.warn('TokenManager: BroadcastChannel init failed:', err);
    }
  }

  private _handleTabMessage(message: TabMessage): void {
    switch (message.type) {
      case 'TOKENS_REFRESHED': {
        // Another tab completed a refresh.  Only adopt its tokens if they belong
        // to the same user as ours — otherwise we'd authenticate as that user
        // while building channel names for our own user.  Ignore when we have no
        // owner yet (a tab mid-initialization must not adopt another tab's
        // identity, e.g. two tabs creating distinct guest sessions at once).
        if (this._ownerUserId === null || message.userId !== this._ownerUserId) {
          console.warn(
            `TokenManager: ignoring broadcast tokens for a different user (message=${message.userId}, owner=${this._ownerUserId})`,
          );
          break;
        }
        console.log('TokenManager: received refreshed tokens from another tab');
        this.setTokens(message.tokens, { broadcast: false });
        break;
      }

      case 'REFRESH_STARTING': {
        // Another tab is about to refresh.  We don't need to do anything
        // proactively here — our own proactive timer will simply not fire
        // (because by the time it does the TOKENS_REFRESHED message will
        // have arrived and isAccessTokenFresh() will return true).
        console.log('TokenManager: another tab is refreshing — standing by');
        break;
      }
    }
  }

  private _broadcast(message: TabMessage): void {
    try {
      this._channel?.postMessage(message);
    } catch (err) {
      // Non-fatal — just means other tabs won't get the update via channel.
      console.warn('TokenManager: broadcast failed:', err);
    }
  }
}

// Export singleton accessor
export const TokenManager = TokenManagerClass;
export default TokenManagerClass.get();
