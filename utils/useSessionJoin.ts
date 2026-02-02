import { useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";
import { Api, JoinSession } from "./";

/**
 * Custom hook to handle session joining and socket initialization.
 * Prevents infinite loops and provides consistent session management across pages.
 * 
 * @param isAuthenticated - Whether the user is authenticated
 * @param onSuccess - Optional callback when join succeeds
 * @param onError - Optional callback when join fails
 * @returns Object containing socket, pseudonym, userId, joining state, and error message
 */
export function useSessionJoin(
  isAuthenticated: boolean,
  onSuccess?: (result: { userId: string; pseudonym: string }) => void,
  onError?: (error: string) => void
) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [pseudonym, setPseudonym] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [joinAttempted, setJoinAttempted] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  // Join session once
  useEffect(() => {
    // Prevent infinite loop: only attempt join once
    if (socket || joining || joinAttempted) return;

    // Note: _app.tsx guarantees SessionManager has completed initialization
    // before this component renders, so session is always ready here
    setJoining(true);
    setJoinAttempted(true);

    JoinSession(
      (result) => {
        setPseudonym(result.pseudonym);
        setUserId(result.userId);
        
        const socketLocal = io(process.env.NEXT_PUBLIC_SOCKET_URL, {
          auth: { token: Api.get().GetTokens().access },
        });

        setSocket(socketLocal);
        setJoining(false);

        // Call optional success callback
        onSuccess?.(result);
      },
      (error) => {
        setErrorMessage(error);
        setJoining(false);

        // Call optional error callback
        onError?.(error);
      },
      isAuthenticated
    );
  }, [socket, joining, joinAttempted, isAuthenticated, onSuccess, onError]);

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
    joining,
    isConnected,
    errorMessage,
  };
}
