import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { Api } from "./";
import SessionManager from "./SessionManager";
import { refreshAccessToken } from "./tokenRefresh";

// Refresh token proactively every 25 minutes (assuming ~30 min token lifetime)
// This prevents the access token from expiring while the socket is idle.
const TOKEN_REFRESH_INTERVAL_MS = 25 * 60 * 1000;

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
 * - Automatic token refresh on auth-related connect_error events
 * - Proactive token refresh on page visibility restore (tab switching)
 * - Periodic proactive token refresh to prevent expiration during idle sessions
 *
 * @param isAuthenticated - Whether the user is authenticated (unused, kept for backward compatibility)
 * @param onSuccess - Optional callback when session info is retrieved
 * @param onError - Optional callback when session retrieval fails
 * @returns Object containing socket, pseudonym, userId, connection state, and
 *          lastReconnectTime (non-null whenever the socket reconnected after a
 *          gap long enough that messages may have been missed — callers should
 *          re-fetch message history when this value changes)
 */
export function useSessionJoin(
  isAuthenticated?: boolean,
  onSuccess?: (result: { userId: string; pseudonym: string }) => void,
  onError?: (error: string) => void
) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [pseudonym, setPseudonym] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [initialized, setInitialized] = useState(false);
  /**
   * Set to the timestamp (ms) of the most recent reconnection that followed a
   * gap longer than RECONNECT_GAP_THRESHOLD_MS. Starts null (no gap-reconnect
   * has occurred yet). Pages watch this value in a useEffect to trigger a
   * message-history re-fetch only when it changes.
   */
  const [lastReconnectTime, setLastReconnectTime] = useState<number | null>(
    null
  );
  // Records when the socket disconnected so we can measure gap duration on reconnect.
  const disconnectedAtRef = useRef<number | null>(null);

  // Initialize socket and session info once
  useEffect(() => {
    // Only initialize once
    if (initialized) return;
    setInitialized(true);

    // Get session info from SessionManager (already initialized by _app.tsx)
    const sessionInfo = SessionManager.get().getSessionInfo();

    if (!sessionInfo) {
      const error = "No session available";
      setErrorMessage(error);
      onError?.(error);
      return;
    }

    const tokens = Api.get().GetTokens();
    if (!tokens.access) {
      const error = "No access token available";
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

    setSocket(socketLocal);

    // Call optional success callback
    onSuccess?.({
      userId: sessionInfo.userId,
      pseudonym: sessionInfo.username,
    });
  }, [initialized, onSuccess, onError]);

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
          console.log(
            `Reconnected after ${Math.round(gapMs / 1000)}s gap — signalling history re-fetch`
          );
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
      console.error("Socket error:", error);
    };

    /**
     * Handle connect_error events. Socket.io fires this when a connection or
     * reconnection attempt fails. If it's an auth error (expired token), we
     * refresh the token and update socket.auth so the next reconnection attempt
     * uses the new token. Socket.io will automatically retry the connection.
     */
    const handleConnectError = async (error: Error) => {
      console.error("Socket connect_error:", error.message);

      const isAuthError =
        error.message?.includes("401") ||
        error.message?.includes("Unauthorized") ||
        error.message?.includes("authentication") ||
        error.message?.toLowerCase().includes("auth");

      if (isAuthError) {
        console.log("Socket auth error detected, refreshing token...");
        const refreshed = await refreshAccessToken();
        if (refreshed) {
          const newToken = Api.get().GetTokens().access;
          if (newToken) {
            // Update socket.auth so the next automatic reconnection attempt
            // uses the refreshed token
            (socket as any).auth = { token: newToken };
            console.log("Socket auth token updated after connect_error");
          }
        } else {
          console.error("Token refresh failed during socket reconnect");
        }
      }
    };

    socket.on("error", handleError);
    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("connect_error", handleConnectError);

    return () => {
      socket.off("error", handleError);
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("connect_error", handleConnectError);
    };
  }, [socket]);

  /**
   * Proactive token refresh strategy:
   * 1. Periodic interval — refreshes the token every TOKEN_REFRESH_INTERVAL_MS to keep
   *    it from expiring silently while the user is idle on the page.
   * 2. Visibility change — when the user returns to the tab after being away, immediately
   *    refresh the token (it may have expired while the tab was in the background) and
   *    reconnect the socket if it dropped.
   *
   * In both cases, socket.auth is updated so any subsequent reconnection uses the new token.
   */
  useEffect(() => {
    if (!socket) return;

    const refreshSocketToken = async () => {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        const newToken = Api.get().GetTokens().access;
        if (newToken) {
          // Always update socket.auth with the latest token
          (socket as any).auth = { token: newToken };
          console.log("Proactively updated socket auth token");

          // If the socket dropped while the tab was hidden or tokens were stale,
          // reconnect now that we have a fresh token
          if (!socket.connected) {
            console.log("Socket disconnected, reconnecting with fresh token...");
            socket.connect();
          }
        }
      }
    };

    // Refresh when the user returns to this tab
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        console.log("Tab became visible, refreshing socket auth token...");
        refreshSocketToken();
      }
    };

    // Periodically refresh token so it never expires during an idle session
    const refreshInterval = setInterval(
      refreshSocketToken,
      TOKEN_REFRESH_INTERVAL_MS
    );

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearInterval(refreshInterval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [socket]);

  return {
    socket,
    pseudonym,
    userId,
    isConnected,
    errorMessage,
    lastReconnectTime,
  };
}
