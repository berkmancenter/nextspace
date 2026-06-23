/**
 * @jest-environment jsdom
 */

// TokenManager makes its own fetch calls (no dependency on Api.ts / Helpers.ts)
// so we only need to mock global.fetch and BroadcastChannel.

// Mock BroadcastChannel before importing anything
const mockBroadcastPostMessage = jest.fn();
const mockBroadcastClose = jest.fn();
let broadcastMessageHandler: ((event: MessageEvent) => void) | null = null;

const MockBroadcastChannel = jest.fn().mockImplementation(() => {
  const instance = {
    postMessage: mockBroadcastPostMessage,
    close: mockBroadcastClose,
    onmessage: null as ((event: MessageEvent) => void) | null,
  };
  Object.defineProperty(instance, 'onmessage', {
    set(handler: (event: MessageEvent) => void) {
      broadcastMessageHandler = handler;
    },
    get() {
      return broadcastMessageHandler;
    },
  });
  return instance;
});

Object.defineProperty(global, 'BroadcastChannel', {
  writable: true,
  value: MockBroadcastChannel,
});

global.fetch = jest.fn();

// Flush the microtask queue by yielding to the event loop multiple times.
const flush = async () => {
  for (let i = 0; i < 10; i++) await Promise.resolve();
};

const FUTURE_ACCESS_EXPIRES = new Date(Date.now() + 30 * 60 * 1000).toISOString();
const FUTURE_REFRESH_EXPIRES = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
// Within the 2-minute buffer so proactive refresh fires immediately.
const NEAR_EXPIRY_ACCESS = new Date(Date.now() + 60 * 1000).toISOString();
const PAST_EXPIRY = new Date(Date.now() - 60 * 1000).toISOString();

describe('TokenManager', () => {
  let tokenManager: any;

  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockReset();
    mockBroadcastPostMessage.mockReset();
    broadcastMessageHandler = null;
    MockBroadcastChannel.mockClear();

    // Re-require the module each test so the singleton is truly fresh.
    // We NEVER call jest.useFakeTimers() in this file (we use jest.spyOn instead)
    // so jest.resetModules() + require() is safe here.
    jest.resetModules();
    const mod = require('../../utils/TokenManager');
    (mod.TokenManager as any)._instance = undefined;
    tokenManager = mod.TokenManager.get();
  });

  // Helper: set tokens with a near-expiry access token AND pre-configure all
  // the fetch mocks that the immediate background refresh will consume.
  // Returns after flushing the microtask queue so the background refresh completes.
  async function setNearExpiryAndFlush(mocks: { url?: string; resp: any }[]) {
    mocks.forEach(({ resp }) => (global.fetch as jest.Mock).mockResolvedValueOnce(resp));
    tokenManager.setTokens({
      access: { token: 'old-acc', expires: NEAR_EXPIRY_ACCESS },
      refresh: { token: 'ref', expires: FUTURE_REFRESH_EXPIRES },
    });
    // Flush microtasks so the background proactive refresh completes.
    for (let i = 0; i < 6; i++) await Promise.resolve();
  }

  // ─── Token Storage ─────────────────────────────────────────────────────────

  describe('setTokens / getAccessToken / getTokens', () => {
    it('stores tokens and returns them', () => {
      tokenManager.setTokens({
        access: { token: 'acc', expires: FUTURE_ACCESS_EXPIRES },
        refresh: { token: 'ref', expires: FUTURE_REFRESH_EXPIRES },
      });

      expect(tokenManager.getAccessToken()).toBe('acc');
      expect(tokenManager.getTokens()).toEqual({ access: 'acc', refresh: 'ref' });
    });

    it('returns empty string and null when no tokens stored', () => {
      expect(tokenManager.getAccessToken()).toBe('');
      expect(tokenManager.getTokens()).toEqual({ access: null, refresh: null });
    });

    it('setTokensFromStrings synthesises expires when not provided', () => {
      tokenManager.setTokensFromStrings('acc', 'ref');
      const full = tokenManager.getFullTokens();
      expect(full).not.toBeNull();
      expect(full.access.token).toBe('acc');
      expect(full.refresh.token).toBe('ref');
      expect(new Date(full.access.expires).getTime()).toBeGreaterThan(Date.now());
    });

    it('setTokensFromStrings uses provided expires values', () => {
      tokenManager.setTokensFromStrings('acc', 'ref', FUTURE_ACCESS_EXPIRES, FUTURE_REFRESH_EXPIRES);
      const full = tokenManager.getFullTokens();
      expect(full.access.expires).toBe(FUTURE_ACCESS_EXPIRES);
      expect(full.refresh.expires).toBe(FUTURE_REFRESH_EXPIRES);
    });
  });

  // ─── isAccessTokenFresh ───────────────────────────────────────────────────

  describe('isAccessTokenFresh', () => {
    it('returns false when no tokens stored', () => {
      expect(tokenManager.isAccessTokenFresh()).toBe(false);
    });

    it('returns true when token expires well in the future', () => {
      tokenManager.setTokens({
        access: { token: 'acc', expires: FUTURE_ACCESS_EXPIRES },
        refresh: { token: 'ref', expires: FUTURE_REFRESH_EXPIRES },
      });
      expect(tokenManager.isAccessTokenFresh()).toBe(true);
    });

    it('returns false when token is within the 2-minute buffer', () => {
      // Supply a mock so the proactive background refresh doesn't leave
      // fetch in an unexpected state.
      (global.fetch as jest.Mock).mockResolvedValue({ ok: false });
      tokenManager.setTokens({
        access: { token: 'acc', expires: NEAR_EXPIRY_ACCESS },
        refresh: { token: 'ref', expires: FUTURE_REFRESH_EXPIRES },
      });
      expect(tokenManager.isAccessTokenFresh()).toBe(false);
    });

    it('returns false when token is already expired', () => {
      (global.fetch as jest.Mock).mockResolvedValue({ ok: false });
      tokenManager.setTokens({
        access: { token: 'acc', expires: PAST_EXPIRY },
        refresh: { token: 'ref', expires: FUTURE_REFRESH_EXPIRES },
      });
      expect(tokenManager.isAccessTokenFresh()).toBe(false);
    });
  });

  // ─── clearTokens ─────────────────────────────────────────────────────────

  describe('clearTokens', () => {
    it('clears all token data', () => {
      tokenManager.setTokens({
        access: { token: 'acc', expires: FUTURE_ACCESS_EXPIRES },
        refresh: { token: 'ref', expires: FUTURE_REFRESH_EXPIRES },
      });
      tokenManager.clearTokens();

      expect(tokenManager.getAccessToken()).toBe('');
      expect(tokenManager.getTokens()).toEqual({ access: null, refresh: null });
      expect(tokenManager.getFullTokens()).toBeNull();
    });
  });

  // ─── getValidToken ────────────────────────────────────────────────────────

  describe('getValidToken', () => {
    it('returns token immediately when fresh (no network call)', async () => {
      tokenManager.setTokens({
        access: { token: 'fresh-acc', expires: FUTURE_ACCESS_EXPIRES },
        refresh: { token: 'ref', expires: FUTURE_REFRESH_EXPIRES },
      });

      const token = await tokenManager.getValidToken();
      expect(token).toBe('fresh-acc');

      const refreshCalls = (global.fetch as jest.Mock).mock.calls.filter(
        (c: any[]) => typeof c[0] === 'string' && c[0].includes('refresh-tokens'),
      );
      expect(refreshCalls.length).toBe(0);
    });

    it('triggers refresh when token is near expiry and cookie is also stale', async () => {
      // Set up ALL mocks before setTokens() so the immediate background refresh
      // triggered by setTokens() can consume them.
      (global.fetch as jest.Mock)
        // 1. cookie sync (same stale token)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            tokens: {
              access: 'stale-acc',
              refresh: 'ref',
              accessExpires: NEAR_EXPIRY_ACCESS,
            },
          }),
        })
        // 2. refresh API
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            access: { token: 'new-acc', expires: FUTURE_ACCESS_EXPIRES },
            refresh: { token: 'new-ref', expires: FUTURE_REFRESH_EXPIRES },
          }),
        })
        // 3. cookie PATCH
        .mockResolvedValueOnce({ ok: true });

      tokenManager.setTokens({
        access: { token: 'stale-acc', expires: NEAR_EXPIRY_ACCESS },
        refresh: { token: 'ref', expires: FUTURE_REFRESH_EXPIRES },
      });

      // Flush the background refresh that fires immediately.
      await flush();
      for (let i = 0; i < 4; i++) await Promise.resolve();

      const token = await tokenManager.getValidToken();
      expect(token).toBe('new-acc');
    });

    it('returns null when refresh fails and token is expired', async () => {
      // All mocks set up before setTokens()
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ tokens: { access: 'expired-acc', refresh: 'ref' } }),
        })
        .mockResolvedValueOnce({ ok: false, status: 500 }); // refresh fails

      tokenManager.setTokens({
        access: { token: 'expired-acc', expires: PAST_EXPIRY },
        refresh: { token: 'ref', expires: FUTURE_REFRESH_EXPIRES },
      });

      await flush();
      for (let i = 0; i < 4; i++) await Promise.resolve();

      const token = await tokenManager.getValidToken();
      expect(token).toBeNull();
    });
  });

  // ─── refresh deduplication ────────────────────────────────────────────────

  describe('refresh — deduplication', () => {
    it('deduplicates concurrent refresh calls — only one HTTP request sent', async () => {
      // Use future expiry so NO background proactive refresh fires
      tokenManager.setTokens({
        access: { token: 'old-acc', expires: FUTURE_ACCESS_EXPIRES },
        refresh: { token: 'ref', expires: FUTURE_REFRESH_EXPIRES },
      });

      // Set _lastRefreshAt to 0 to bypass rate limit for multiple concurrent calls.
      (tokenManager as any)._lastRefreshAt = 0;

      let refreshCallCount = 0;
      let resolveRefreshFetch: (v: any) => void = () => {};

      (global.fetch as jest.Mock).mockImplementation((url: string) => {
        if (url === '/api/cookie') {
          return Promise.resolve({
            ok: true,
            json: async () => ({ tokens: { access: 'old-acc', refresh: 'ref' } }),
          });
        }
        if (typeof url === 'string' && url.includes('refresh-tokens')) {
          refreshCallCount++;
          // Return a promise we control so all 3 concurrent callers share the
          // same in-flight promise before it resolves.
          return new Promise((resolve) => {
            resolveRefreshFetch = () =>
              resolve({
                ok: true,
                status: 200,
                json: async () => ({
                  access: { token: 'new-acc', expires: FUTURE_ACCESS_EXPIRES },
                  refresh: { token: 'new-ref', expires: FUTURE_REFRESH_EXPIRES },
                }),
              });
          });
        }
        if (url === '/api/session') {
          return Promise.resolve({ ok: true });
        }
        return Promise.resolve({ ok: true });
      });

      // Start 3 concurrent refresh calls.
      const allPromise = Promise.all([tokenManager.refresh(), tokenManager.refresh(), tokenManager.refresh()]);

      // Let the event loop run so all 3 callers reach the dedup gate.
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();

      // Resolve the single in-flight refresh fetch.
      resolveRefreshFetch(undefined);

      const [r1, r2, r3] = await allPromise;

      expect(r1).toBe(true);
      expect(r2).toBe(true);
      expect(r3).toBe(true);
      // Only ONE actual network request should have been made.
      expect(refreshCallCount).toBe(1);
    });

    it('rate-limits rapid successive refresh calls', async () => {
      // Use NEAR_EXPIRY so we control the first refresh explicitly.
      // Set up mocks for the one actual refresh we expect.
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            tokens: { access: 'acc', refresh: 'ref', accessExpires: NEAR_EXPIRY_ACCESS },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            access: { token: 'new-acc', expires: FUTURE_ACCESS_EXPIRES },
            refresh: { token: 'new-ref', expires: FUTURE_REFRESH_EXPIRES },
          }),
        })
        .mockResolvedValueOnce({ ok: true }); // PATCH

      tokenManager.setTokens({
        access: { token: 'acc', expires: NEAR_EXPIRY_ACCESS },
        refresh: { token: 'ref', expires: FUTURE_REFRESH_EXPIRES },
      });

      // Let the background refresh complete.
      await flush();
      for (let i = 0; i < 4; i++) await Promise.resolve();

      // Clear mock to check no more calls happen.
      (global.fetch as jest.Mock).mockClear();

      // Immediate second refresh — should be rate-limited (no network call).
      await tokenManager.refresh();

      const refreshCalls = (global.fetch as jest.Mock).mock.calls.filter(
        (c: any[]) => typeof c[0] === 'string' && c[0].includes('refresh-tokens'),
      );
      expect(refreshCalls.length).toBe(0);
    });
  });

  // ─── Cookie sync before refresh ───────────────────────────────────────────

  describe('refresh — cookie sync (multi-tab safety)', () => {
    it('adopts tokens from cookie if another tab already refreshed (no network refresh)', async () => {
      // Cookie has a fresh token — another tab already refreshed.
      // Set up the mock BEFORE setTokens() so the background refresh uses it.
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          tokens: {
            access: 'already-refreshed',
            refresh: 'new-ref',
            accessExpires: FUTURE_ACCESS_EXPIRES,
            refreshExpires: FUTURE_REFRESH_EXPIRES,
          },
        }),
      });

      tokenManager.setTokens({
        access: { token: 'old-acc', expires: NEAR_EXPIRY_ACCESS },
        refresh: { token: 'ref', expires: FUTURE_REFRESH_EXPIRES },
      });

      // Flush background refresh.
      await flush();
      for (let i = 0; i < 4; i++) await Promise.resolve();

      const refreshCalls = (global.fetch as jest.Mock).mock.calls.filter(
        (c: any[]) => typeof c[0] === 'string' && c[0].includes('refresh-tokens'),
      );
      expect(refreshCalls.length).toBe(0);
      expect(tokenManager.getAccessToken()).toBe('already-refreshed');
    });

    it('proceeds with full refresh if cookie token is also stale', async () => {
      // Cookie has the same stale token — must do a real refresh.
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            tokens: {
              access: 'old-acc',
              refresh: 'ref',
              accessExpires: NEAR_EXPIRY_ACCESS,
            },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            access: { token: 'fresh-acc', expires: FUTURE_ACCESS_EXPIRES },
            refresh: { token: 'fresh-ref', expires: FUTURE_REFRESH_EXPIRES },
          }),
        })
        .mockResolvedValueOnce({ ok: true }); // PATCH

      tokenManager.setTokens({
        access: { token: 'old-acc', expires: NEAR_EXPIRY_ACCESS },
        refresh: { token: 'ref', expires: FUTURE_REFRESH_EXPIRES },
      });

      await flush();
      for (let i = 0; i < 4; i++) await Promise.resolve();

      const refreshCalls = (global.fetch as jest.Mock).mock.calls.filter(
        (c: any[]) => typeof c[0] === 'string' && c[0].includes('refresh-tokens'),
      );
      expect(refreshCalls.length).toBe(1);
      expect(tokenManager.getAccessToken()).toBe('fresh-acc');
    });
  });

  // ─── Cookie PATCH ─────────────────────────────────────────────────────────

  describe('refresh — cookie PATCH', () => {
    it('PATCHes session cookie with new tokens and expiry after a successful refresh', async () => {
      // ALL mocks set up before setTokens() so the background proactive refresh
      // (which fires immediately when token is near-expiry) uses them.
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            tokens: {
              access: 'old-acc',
              refresh: 'ref',
              accessExpires: NEAR_EXPIRY_ACCESS,
            },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            access: { token: 'new-acc', expires: FUTURE_ACCESS_EXPIRES },
            refresh: { token: 'new-ref', expires: FUTURE_REFRESH_EXPIRES },
          }),
        })
        .mockResolvedValueOnce({ ok: true }); // PATCH

      tokenManager.setTokens({
        access: { token: 'old-acc', expires: NEAR_EXPIRY_ACCESS },
        refresh: { token: 'ref', expires: FUTURE_REFRESH_EXPIRES },
      });

      // Flush background refresh to completion.
      await flush();
      for (let i = 0; i < 4; i++) await Promise.resolve();

      const patchCall = (global.fetch as jest.Mock).mock.calls.find(
        (call: any[]) => call[0] === '/api/session' && call[1]?.method === 'PATCH',
      );
      expect(patchCall).toBeDefined();
      const body = JSON.parse(patchCall[1].body);
      expect(body.accessToken).toBe('new-acc');
      expect(body.refreshToken).toBe('new-ref');
      expect(body.accessExpires).toBe(FUTURE_ACCESS_EXPIRES);
      expect(body.refreshExpires).toBe(FUTURE_REFRESH_EXPIRES);
    });

    it('retries cookie PATCH once on failure', async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            tokens: {
              access: 'old-acc',
              refresh: 'ref',
              accessExpires: NEAR_EXPIRY_ACCESS,
            },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            access: { token: 'new-acc', expires: FUTURE_ACCESS_EXPIRES },
            refresh: { token: 'new-ref', expires: FUTURE_REFRESH_EXPIRES },
          }),
        })
        .mockResolvedValueOnce({ ok: false, status: 500 }) // first PATCH fails
        .mockResolvedValueOnce({ ok: true }); // retry succeeds

      tokenManager.setTokens({
        access: { token: 'old-acc', expires: NEAR_EXPIRY_ACCESS },
        refresh: { token: 'ref', expires: FUTURE_REFRESH_EXPIRES },
      });

      await flush();
      for (let i = 0; i < 6; i++) await Promise.resolve();

      const patchCalls = (global.fetch as jest.Mock).mock.calls.filter(
        (call: any[]) => call[0] === '/api/session' && call[1]?.method === 'PATCH',
      );
      expect(patchCalls.length).toBe(2);
    });
  });

  // ─── Proactive refresh scheduling ─────────────────────────────────────────

  describe('proactive refresh scheduling', () => {
    it('schedules a timer based on token expiry', () => {
      // Use spyOn (not useFakeTimers) so we never pollute the global timer state.
      // The real timer fires harmlessly after the test; the next beforeEach
      // clears it via tokenManager.clearTokens() → cancelProactiveRefresh().
      const setTimeoutSpy = jest.spyOn(global, 'setTimeout');

      const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString();
      tokenManager.setTokens({
        access: { token: 'acc', expires },
        refresh: { token: 'ref', expires: FUTURE_REFRESH_EXPIRES },
      });

      expect(setTimeoutSpy).toHaveBeenCalled();
      const delay = (setTimeoutSpy.mock.calls[0] as any[])[1] as number;
      // ~8 minutes (10 min − 2 min buffer)
      expect(delay).toBeGreaterThan(7.5 * 60 * 1000);
      expect(delay).toBeLessThan(8.5 * 60 * 1000);

      // Cancel the real timer so it doesn't fire during later tests.
      tokenManager.clearTokens();
    });

    it('cancels the previous timer when tokens are updated', () => {
      const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');

      tokenManager.setTokens({
        access: { token: 'acc1', expires: FUTURE_ACCESS_EXPIRES },
        refresh: { token: 'ref', expires: FUTURE_REFRESH_EXPIRES },
      });
      tokenManager.setTokens({
        access: { token: 'acc2', expires: FUTURE_ACCESS_EXPIRES },
        refresh: { token: 'ref', expires: FUTURE_REFRESH_EXPIRES },
      });

      expect(clearTimeoutSpy).toHaveBeenCalled();
      tokenManager.clearTokens();
    });

    it('cancels timer on clearTokens', () => {
      const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');

      tokenManager.setTokens({
        access: { token: 'acc', expires: FUTURE_ACCESS_EXPIRES },
        refresh: { token: 'ref', expires: FUTURE_REFRESH_EXPIRES },
      });
      tokenManager.clearTokens();

      expect(clearTimeoutSpy).toHaveBeenCalled();
    });

    it('fires proactive refresh immediately when token is within the buffer window', async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            tokens: {
              access: 'near-expiry',
              refresh: 'ref',
              accessExpires: NEAR_EXPIRY_ACCESS,
            },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            access: { token: 'fresh-acc', expires: FUTURE_ACCESS_EXPIRES },
            refresh: { token: 'fresh-ref', expires: FUTURE_REFRESH_EXPIRES },
          }),
        })
        .mockResolvedValueOnce({ ok: true });

      tokenManager.setTokens({
        access: { token: 'near-expiry', expires: NEAR_EXPIRY_ACCESS },
        refresh: { token: 'ref', expires: FUTURE_REFRESH_EXPIRES },
      });

      await flush();
      for (let i = 0; i < 4; i++) await Promise.resolve();

      const refreshCalls = (global.fetch as jest.Mock).mock.calls.filter(
        (c: any[]) => typeof c[0] === 'string' && c[0].includes('refresh-tokens'),
      );
      expect(refreshCalls.length).toBe(1);
    });
  });

  // ─── onTokensChanged listener ─────────────────────────────────────────────

  describe('onTokensChanged', () => {
    it('calls listener immediately with current tokens when tokens exist', () => {
      const tokens = {
        access: { token: 'acc', expires: FUTURE_ACCESS_EXPIRES },
        refresh: { token: 'ref', expires: FUTURE_REFRESH_EXPIRES },
      };
      tokenManager.setTokens(tokens);

      const listener = jest.fn();
      tokenManager.onTokensChanged(listener);

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(tokens);
    });

    it('does not call listener immediately when no tokens exist', () => {
      const listener = jest.fn();
      tokenManager.onTokensChanged(listener);
      expect(listener).not.toHaveBeenCalled();
    });

    it('calls listener when tokens change', () => {
      const listener = jest.fn();
      tokenManager.onTokensChanged(listener);

      const tokens = {
        access: { token: 'acc', expires: FUTURE_ACCESS_EXPIRES },
        refresh: { token: 'ref', expires: FUTURE_REFRESH_EXPIRES },
      };
      tokenManager.setTokens(tokens);

      expect(listener).toHaveBeenCalledWith(tokens);
    });

    it('notifies ALL active listeners when tokens change', () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();
      const listener3 = jest.fn();

      tokenManager.onTokensChanged(listener1);
      tokenManager.onTokensChanged(listener2);
      tokenManager.onTokensChanged(listener3);

      const tokens = {
        access: { token: 'multi-token', expires: FUTURE_ACCESS_EXPIRES },
        refresh: { token: 'multi-ref', expires: FUTURE_REFRESH_EXPIRES },
      };
      tokenManager.setTokens(tokens);

      expect(listener1).toHaveBeenCalledWith(tokens);
      expect(listener2).toHaveBeenCalledWith(tokens);
      expect(listener3).toHaveBeenCalledWith(tokens);
    });

    it('stops calling listener after unsubscribe', () => {
      const listener = jest.fn();
      const unsubscribe = tokenManager.onTokensChanged(listener);
      unsubscribe();
      listener.mockClear();

      tokenManager.setTokens({
        access: { token: 'acc', expires: FUTURE_ACCESS_EXPIRES },
        refresh: { token: 'ref', expires: FUTURE_REFRESH_EXPIRES },
      });

      expect(listener).not.toHaveBeenCalled();
    });
  });

  // ─── BroadcastChannel (cross-tab) ─────────────────────────────────────────

  describe('BroadcastChannel cross-tab coordination', () => {
    it('broadcasts TOKENS_REFRESHED when setTokens is called with broadcast=true', () => {
      const tokens = {
        access: { token: 'acc', expires: FUTURE_ACCESS_EXPIRES },
        refresh: { token: 'ref', expires: FUTURE_REFRESH_EXPIRES },
      };
      tokenManager.setTokens(tokens, { broadcast: true });

      expect(mockBroadcastPostMessage).toHaveBeenCalledWith({
        type: 'TOKENS_REFRESHED',
        tokens,
        userId: null,
      });
    });

    it('does NOT broadcast when broadcast=false', () => {
      tokenManager.setTokens(
        {
          access: { token: 'acc', expires: FUTURE_ACCESS_EXPIRES },
          refresh: { token: 'ref', expires: FUTURE_REFRESH_EXPIRES },
        },
        { broadcast: false },
      );

      expect(mockBroadcastPostMessage).not.toHaveBeenCalled();
    });

    it('reschedules the proactive refresh timer when adopting tokens from another tab', () => {
      // Establish this tab's token owner so a same-user broadcast is accepted.
      tokenManager.setTokens(
        {
          access: { token: 'acc', expires: FUTURE_ACCESS_EXPIRES },
          refresh: { token: 'ref', expires: FUTURE_REFRESH_EXPIRES },
        },
        { userId: 'user-1' },
      );

      const setTimeoutSpy = jest.spyOn(global, 'setTimeout');
      setTimeoutSpy.mockClear();

      const newTokens = {
        access: { token: 'tab2-acc', expires: FUTURE_ACCESS_EXPIRES },
        refresh: { token: 'tab2-ref', expires: FUTURE_REFRESH_EXPIRES },
      };

      // Simulate another tab (same user) broadcasting refreshed tokens
      broadcastMessageHandler?.({
        data: { type: 'TOKENS_REFRESHED', tokens: newTokens, userId: 'user-1' },
      } as MessageEvent);

      // setTokens(broadcast=false) is called internally, which triggers
      // _scheduleProactiveRefresh → should call setTimeout for new expiry
      expect(setTimeoutSpy).toHaveBeenCalled();
      expect(tokenManager.getAccessToken()).toBe('tab2-acc');

      setTimeoutSpy.mockRestore();
    });

    it('handles REFRESH_STARTING message gracefully — no state change, no crash', () => {
      tokenManager.setTokens({
        access: { token: 'stable-acc', expires: FUTURE_ACCESS_EXPIRES },
        refresh: { token: 'stable-ref', expires: FUTURE_REFRESH_EXPIRES },
      });

      // Another tab announces it is about to refresh — our tab should do nothing
      expect(() => {
        broadcastMessageHandler?.({
          data: { type: 'REFRESH_STARTING' },
        } as MessageEvent);
      }).not.toThrow();

      // Tokens should remain unchanged
      expect(tokenManager.getAccessToken()).toBe('stable-acc');
    });

    it('receives TOKENS_REFRESHED from another tab and updates tokens without re-broadcasting', () => {
      // Establish this tab's token owner so a same-user broadcast is accepted.
      tokenManager.setTokens(
        {
          access: { token: 'acc', expires: FUTURE_ACCESS_EXPIRES },
          refresh: { token: 'ref', expires: FUTURE_REFRESH_EXPIRES },
        },
        { userId: 'user-1' },
      );
      mockBroadcastPostMessage.mockClear();

      const newTokens = {
        access: { token: 'cross-tab-acc', expires: FUTURE_ACCESS_EXPIRES },
        refresh: { token: 'cross-tab-ref', expires: FUTURE_REFRESH_EXPIRES },
      };

      broadcastMessageHandler?.({
        data: { type: 'TOKENS_REFRESHED', tokens: newTokens, userId: 'user-1' },
      } as MessageEvent);

      expect(tokenManager.getAccessToken()).toBe('cross-tab-acc');
      expect(mockBroadcastPostMessage).not.toHaveBeenCalled();
    });

    it('IGNORES TOKENS_REFRESHED from another tab when the userId differs from ours', () => {
      // This tab belongs to user-1.
      tokenManager.setTokens(
        {
          access: { token: 'user1-acc', expires: FUTURE_ACCESS_EXPIRES },
          refresh: { token: 'user1-ref', expires: FUTURE_REFRESH_EXPIRES },
        },
        { userId: 'user-1' },
      );

      // Another tab (user-2) broadcasts ITS tokens. Adopting them would make us
      // authenticate as user-2 while building channels for user-1.
      broadcastMessageHandler?.({
        data: {
          type: 'TOKENS_REFRESHED',
          tokens: {
            access: { token: 'user2-acc', expires: FUTURE_ACCESS_EXPIRES },
            refresh: { token: 'user2-ref', expires: FUTURE_REFRESH_EXPIRES },
          },
          userId: 'user-2',
        },
      } as MessageEvent);

      // Our tokens are unchanged — the foreign tokens were rejected.
      expect(tokenManager.getAccessToken()).toBe('user1-acc');
    });

    it('IGNORES TOKENS_REFRESHED when we have no owner yet (tab mid-initialization)', () => {
      // No setTokens call yet → no owner. A broadcast arriving now (e.g. another
      // tab creating a distinct guest session) must not establish our identity.
      broadcastMessageHandler?.({
        data: {
          type: 'TOKENS_REFRESHED',
          tokens: {
            access: { token: 'other-acc', expires: FUTURE_ACCESS_EXPIRES },
            refresh: { token: 'other-ref', expires: FUTURE_REFRESH_EXPIRES },
          },
          userId: 'user-2',
        },
      } as MessageEvent);

      expect(tokenManager.getAccessToken()).toBe('');
    });

    it('broadcasts REFRESH_STARTING when a refresh begins', async () => {
      // Set up mocks before setTokens() to be consumed by the background refresh.
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            tokens: {
              access: 'old-acc',
              refresh: 'ref',
              accessExpires: NEAR_EXPIRY_ACCESS,
            },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            access: { token: 'new-acc', expires: FUTURE_ACCESS_EXPIRES },
            refresh: { token: 'new-ref', expires: FUTURE_REFRESH_EXPIRES },
          }),
        })
        .mockResolvedValueOnce({ ok: true });

      tokenManager.setTokens({
        access: { token: 'old-acc', expires: NEAR_EXPIRY_ACCESS },
        refresh: { token: 'ref', expires: FUTURE_REFRESH_EXPIRES },
      });
      mockBroadcastPostMessage.mockClear();

      await flush();
      for (let i = 0; i < 4; i++) await Promise.resolve();

      const startMsg = mockBroadcastPostMessage.mock.calls.find((call: any[]) => call[0]?.type === 'REFRESH_STARTING');
      expect(startMsg).toBeDefined();
    });
  });

  // ─── Identity ownership guard ─────────────────────────────────────────────

  describe('token identity ownership', () => {
    it('_syncFromCookie ignores cookie tokens that belong to a different user', async () => {
      (global.fetch as jest.Mock)
        // /api/cookie — another tab/login overwrote the shared cookie with user-2
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            tokens: {
              access: 'user2-acc',
              refresh: 'user2-ref',
              accessExpires: FUTURE_ACCESS_EXPIRES,
            },
            userId: 'user-2',
          }),
        })
        // refresh API — called because the cookie was rejected; returns fresh user-1 tokens
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            access: { token: 'user1-new-acc', expires: FUTURE_ACCESS_EXPIRES },
            refresh: { token: 'user1-new-ref', expires: FUTURE_REFRESH_EXPIRES },
          }),
        })
        // PATCH /api/session
        .mockResolvedValueOnce({ ok: true });

      // This tab belongs to user-1 with a near-expiry token to trigger refresh.
      tokenManager.setTokens(
        {
          access: { token: 'user1-acc', expires: NEAR_EXPIRY_ACCESS },
          refresh: { token: 'user1-ref', expires: FUTURE_REFRESH_EXPIRES },
        },
        { userId: 'user-1' },
      );

      await flush();
      for (let i = 0; i < 6; i++) await Promise.resolve();

      // The cookie's user-2 token was never adopted; we refreshed our own session.
      expect(tokenManager.getAccessToken()).not.toBe('user2-acc');
      expect(tokenManager.getAccessToken()).toBe('user1-new-acc');
    });

    it('authoritative local setTokens updates the owner (guest → admin via login)', () => {
      // Guest session establishes owner = guest-1.
      tokenManager.setTokens(
        {
          access: { token: 'guest-acc', expires: FUTURE_ACCESS_EXPIRES },
          refresh: { token: 'guest-ref', expires: FUTURE_REFRESH_EXPIRES },
        },
        { userId: 'guest-1' },
      );
      mockBroadcastPostMessage.mockClear();

      // Login as admin in the same tab — an authoritative local write updates owner.
      tokenManager.setTokensFromStrings(
        'admin-acc',
        'admin-ref',
        FUTURE_ACCESS_EXPIRES,
        FUTURE_REFRESH_EXPIRES,
        'admin-1',
      );

      expect(tokenManager.getAccessToken()).toBe('admin-acc');

      // The broadcast carries the NEW owner so other tabs validate against admin-1.
      expect(mockBroadcastPostMessage).toHaveBeenCalledWith({
        type: 'TOKENS_REFRESHED',
        tokens: {
          access: { token: 'admin-acc', expires: FUTURE_ACCESS_EXPIRES },
          refresh: { token: 'admin-ref', expires: FUTURE_REFRESH_EXPIRES },
        },
        userId: 'admin-1',
      });

      // A late broadcast for the OLD guest user is now rejected.
      broadcastMessageHandler?.({
        data: {
          type: 'TOKENS_REFRESHED',
          tokens: {
            access: { token: 'guest-acc-2', expires: FUTURE_ACCESS_EXPIRES },
            refresh: { token: 'guest-ref-2', expires: FUTURE_REFRESH_EXPIRES },
          },
          userId: 'guest-1',
        },
      } as MessageEvent);

      expect(tokenManager.getAccessToken()).toBe('admin-acc');
    });
  });

  // ─── Error / edge cases ───────────────────────────────────────────────────

  describe('edge cases', () => {
    it('returns false when no tokens stored (nothing to refresh)', async () => {
      const result = await tokenManager.refresh();
      expect(result).toBe(false);
    });

    it('returns false when refresh API returns empty/invalid response', async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            tokens: {
              access: 'acc',
              refresh: 'ref',
              accessExpires: NEAR_EXPIRY_ACCESS,
            },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({}), // empty — no access/refresh tokens
        });

      tokenManager.setTokens({
        access: { token: 'acc', expires: NEAR_EXPIRY_ACCESS },
        refresh: { token: 'ref', expires: FUTURE_REFRESH_EXPIRES },
      });

      await flush();
      for (let i = 0; i < 4; i++) await Promise.resolve();

      // Background refresh consumed all mocks and failed.
      // Verify no token was stored from the bad response.
      expect(tokenManager.getAccessToken()).toBe('acc'); // unchanged
    });

    it('handles 401 from refresh endpoint by calling /api/logout and clearing tokens', async () => {
      (global.fetch as jest.Mock)
        // cookie sync
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            tokens: {
              access: 'acc',
              refresh: 'ref',
              accessExpires: NEAR_EXPIRY_ACCESS,
            },
          }),
        })
        // refresh API returns 401
        .mockResolvedValueOnce({ ok: false, status: 401 })
        // /api/logout
        .mockResolvedValueOnce({ ok: true });

      tokenManager.setTokens({
        access: { token: 'acc', expires: NEAR_EXPIRY_ACCESS },
        refresh: { token: 'ref', expires: FUTURE_REFRESH_EXPIRES },
      });

      await flush();
      for (let i = 0; i < 6; i++) await Promise.resolve();

      // Tokens should have been cleared.
      expect(tokenManager.getAccessToken()).toBe('');

      const logoutCall = (global.fetch as jest.Mock).mock.calls.find((call: any[]) => call[0] === '/api/logout');
      expect(logoutCall).toBeDefined();
    });
  });
});
