import { useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";
import { Api } from "./";
import SessionManager from "./SessionManager";

/**
 * Custom hook to handle socket initialization.
 * _app.tsx guarantees SessionManager has completed initialization before pages render.
 * 
 * @param isAuthenticated - Whether the user is authenticated (unused, kept for backward compatibility)
 * @param onSuccess - Optional callback when session info is retrieved
 * @param onError - Optional callback when session retrieval fails
 * @returns Object containing socket, pseudonym, userId, and connection state
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

  // Handle socket connection events
  useEffect(() => {
    if (!socket) return;

    const handleConnect = () => setIsConnected(true);
    const handleDisconnect = () => setIsConnected(false);
    const handleError = (error: string) => {
      console.error("Socket error:", error);
    };

    socket.on("error", handleError);
    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);

    return () => {
      socket.off("error", handleError);
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
    };
  }, [socket]);

  return {
    socket,
    pseudonym,
    userId,
    isConnected,
    errorMessage,
  };
}
