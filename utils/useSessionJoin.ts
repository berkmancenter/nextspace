import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { Api } from './';
import SessionManager from './SessionManager';
import TokenManagerDefault from './TokenManager';

// Disconnections shorter than this are treated as transient network blips that
// Socket.io's own reconnect loop handles cleanly. Longer gaps mean the client
// was away long enough that real-time messages may have been missed, so callers
// should re-fetch message history from the REST API.
const RECONNECT_GAP_THRESHOLD_MS = 10_000; // 10 seconds

/**
 * Custom hook to handle socket initialization.
 * _app.tsx guarantees SessionManager has completed initialization before pages render.
 *
 * Handles:
 * - Initial socket creation with current access token
 * - Automatic token refresh on auth-related connect_error events (via TokenManager)
 * - Proactive token refresh is now managed entirely by TokenManager (expiry-based
 *   scheduling + cross-tab BroadcastChannel coordination).  When TokenManager
 *   issues a new token this hook updates socket.auth so any subsequent
 *   reconnection uses the fresh token.
 * - Tab visibility changes trigger TokenManager to check expiry and refresh if needed.
 *
 * @returns Object containing socket, pseudonym, userId, connection state, and
 *          lastReconnectTime (non-null whenever the socket reconnected after a
 *          gap long enough that messages may have been missed — callers should
 *          re-fetch message history when this value changes)
 */
export function useSessionJoin(
  isAuthenticated?: boolean,
  onSuccess?: (result: { userId: string; pseudonym: string }) => void,
  onError?: (error: string) => void,
) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [pseudonym, setPseudonym] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  // useRef (not useState) so the guard doesn't trigger a second effect run and
  // the cleanup function fires only on true unmount, not on state transitions.
  const initializedRef = useRef(false);
  /**
   * Set to the timestamp (ms) of the most recent reconnection that followed a
   * gap longer than RECONNECT_GAP_THRESHOLD_MS. Starts null (no gap-reconnect
   * has occurred yet). Pages watch this value in a useEffect to trigger a
   * message-history re-fetch only when it changes.
   */
  const [lastReconnectTime, setLastReconnectTime] = useState<number | null>(null);
  // Records when the socket disconnected so we can measure gap duration on reconnect.
  const disconnectedAtRef = useRef<number | null>(null);
  // Keep a stable ref to the socket for use inside closures.
  const socketRef = useRef<Socket | null>(null);

  // Initialize socket and session info once (runs exactly once per mount).
  // onSuccess / onError are intentionally omitted from the dep array so that
  // callers don't need to memoize them — the socket is created once and the
  // callbacks captured at that moment are correct for the lifetime of the hook.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    // Get session info from SessionManager (already initialized by _app.tsx)
    const sessionInfo = SessionManager.get().getSessionInfo();

    if (!sessionInfo) {
      const error = 'No session available';
      setErrorMessage(error);
      onError?.(error);
      return;
    }

    const tokens = Api.get().GetTokens();
    if (!tokens.access) {
      const error = 'No access token available';
      setErrorMessage(error);
      onError?.(error);
      return;
    }

    // Set session info
    setPseudonym(sessionInfo.username);
    setUserId(sessionInfo.userId);

    // Create socket connection
    const socketLocal = io(process.env.NEXT_PUBLIC_SOCKET_URL, {
      auth: { token: tokens.access },
    });

    socketRef.current = socketLocal;
    setSocket(socketLocal);

    // Call optional success callback
    onSuccess?.({
      userId: sessionInfo.userId,
      pseudonym: sessionInfo.username,
    });

    // Disconnect the socket when the component unmounts to prevent orphaned
    // socket connections (e.g. when navigating away from the assistant page).
    return () => {
      socketLocal.disconnect();
    };
  }, []);

  // Handle socket connection events and auth errors
  useEffect(() => {
    if (!socket) return;

    const handleConnect = () => {
      setIsConnected(true);

      // If we have a recorded disconnect timestamp, check how long the gap was.
      // Only flag a "reconnect with gap" if the disconnection was long enough
      // that real-time messages were likely missed.
      const disconnectedAt = disconnectedAtRef.current;
      if (disconnectedAt !== null) {
        const gapMs = Date.now() - disconnectedAt;
        if (gapMs >= RECONNECT_GAP_THRESHOLD_MS) {
          console.log(`Reconnected after ${Math.round(gapMs / 1000)}s gap — signalling history re-fetch`);
          setLastReconnectTime(Date.now());
        }
        disconnectedAtRef.current = null;
      }
    };

    const handleDisconnect = () => {
      setIsConnected(false);
      // Record the time we went offline so we can measure the gap on reconnect.
      disconnectedAtRef.current = Date.now();
    };

    const handleError = (error: string) => {
      console.error('Socket error:', error);
    };

    /**
     * Handle connect_error events. Socket.io fires this when a connection or
     * reconnection attempt fails. If it's an auth error (expired token), we
     * ask TokenManager to refresh the token and update socket.auth so the
     * next reconnection attempt uses the new token. Socket.io will automatically
     * retry the connection.
     */
    const handleConnectError = async (error: Error) => {
      console.error('Socket connect_error:', error.message);

      const isAuthError =
        error.message?.includes('401') ||
        error.message?.includes('Unauthorized') ||
        error.message?.includes('authentication') ||
        error.message?.toLowerCase().includes('auth');

      if (isAuthError) {
        console.log('Socket auth error detected, refreshing token via TokenManager…');
        const refreshed = await TokenManagerDefault.refresh();
        if (refreshed) {
          const newToken = TokenManagerDefault.getAccessToken();
          if (newToken) {
            // Update socket.auth so the next automatic reconnection attempt
            // uses the refreshed token
            (socket as any).auth = { token: newToken };
            console.log('Socket auth token updated after connect_error');
          }
        } else {
          console.error('Token refresh failed during socket reconnect');
        }
      }
    };

    socket.on('error', handleError);
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('connect_error', handleConnectError);

    return () => {
      socket.off('error', handleError);
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('connect_error', handleConnectError);
    };
  }, [socket]);

  /**
   * Subscribe to TokenManager token change events.
   *
   * TokenManager handles all proactive refresh scheduling (expiry-based, not
   * a fixed interval) and cross-tab coordination (BroadcastChannel).  When
   * it issues new tokens — whether from its own proactive timer, a 401
   * response, or a broadcast from another tab — we update socket.auth so any
   * subsequent reconnection uses the fresh token.
   *
   * We also reconnect the socket immediately if it is currently disconnected
   * and we now have valid tokens.
   */
  useEffect(() => {
    if (!socket) return;

    const unsubscribe = TokenManagerDefault.onTokensChanged((tokens) => {
      const newToken = tokens.access.token;
      if (newToken) {
        // Keep socket.auth up to date for the next reconnection attempt.
        (socket as any).auth = { token: newToken };
        console.log('Socket auth token updated from TokenManager');

        // If the socket is currently disconnected (e.g. the tab was hidden
        // and the socket dropped), reconnect now that we have a fresh token.
        if (!socket.connected) {
          console.log('Socket disconnected — reconnecting with fresh token…');
          socket.connect();
        }
      }
    });

    return unsubscribe;
  }, [socket]);

  /**
   * Visibility change handler — when the user returns to this tab after being
   * away, ask TokenManager to check the token expiry and refresh if needed.
   * TokenManager deduplicates the call and coordinates with other tabs via
   * BroadcastChannel, so this is safe to call on every visibility change.
   */
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('Tab became visible — checking token expiry via TokenManager…');
        // TokenManager will refresh if the token is expired or within the
        // 2-minute buffer, otherwise it's a no-op.
        TokenManagerDefault.getValidToken().catch((err) => console.error('Visibility-change token check failed:', err));
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  return {
    socket,
    pseudonym,
    userId,
    isConnected,
    errorMessage,
    lastReconnectTime,
  };
}
