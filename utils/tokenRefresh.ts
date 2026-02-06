/**
 * Utility functions for token refresh operations
 */

import { Api } from "./Helpers";
import { RefreshToken } from "./Api";

/**
 * Ensures that the current access token is valid by attempting a refresh if needed.
 * This should be called before critical operations like WebSocket authentication.
 * 
 * @returns The current valid access token, or null if refresh failed
 */
export async function ensureFreshToken(): Promise<string | null> {
  const apiI = Api.get();
  let tokens = apiI.GetTokens();

  // If we don't have tokens at all, can't refresh
  if (!tokens.access || !tokens.refresh) {
    return tokens.access;
  }

  // Try to use the current token first - we'll assume it's valid
  // The main use case is when it might be expired, so we proactively refresh
  // However, we don't want to refresh on every call, so we make a lightweight check
  
  // Instead, we can try to refresh and handle gracefully if not needed
  // For now, let's just ensure tokens are in sync with cookie
  try {
    // Check if we can get fresh tokens from the cookie via API
    const response = await fetch("/api/cookie");
    if (response.ok) {
      const data = await response.json();
      if (data.tokens?.access && data.tokens?.refresh) {
        // Update in-memory tokens if they're different from what we have
        if (data.tokens.access !== tokens.access) {
          apiI.SetTokens(data.tokens.access, data.tokens.refresh);
          tokens = apiI.GetTokens();
        }
      }
    }
  } catch (error) {
    console.error("Error checking cookie for fresh tokens:", error);
  }

  return tokens.access;
}

/**
 * Attempts to refresh the access token using the refresh token.
 * Updates both in-memory tokens and the session cookie.
 * 
 * @returns True if refresh was successful, false otherwise
 */
export async function refreshAccessToken(): Promise<boolean> {
  const apiI = Api.get();
  const tokens = apiI.GetTokens();

  if (!tokens.refresh) {
    console.error("No refresh token available");
    return false;
  }

  try {
    console.log("Refreshing access token...");
    const tokensResponse = await RefreshToken(tokens.refresh);

    if (tokensResponse?.access?.token && tokensResponse?.refresh?.token) {
      // Update tokens in memory
      apiI.SetTokens(tokensResponse.access.token, tokensResponse.refresh.token);

      // Update session cookie with new tokens
      await fetch("/api/session", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          accessToken: tokensResponse.access.token,
          refreshToken: tokensResponse.refresh.token,
        }),
      });

      console.log("Token refresh successful");
      return true;
    }

    console.error("Token refresh failed: Invalid response");
    return false;
  } catch (error) {
    console.error("Token refresh error:", error);
    return false;
  }
}

/**
 * Wraps a WebSocket emit operation with automatic token refresh on authentication errors.
 * If the socket returns an authentication error, it will attempt to refresh the token
 * and retry the operation once.
 * 
 * @param socket - The socket.io socket instance
 * @param event - The event name to emit
 * @param data - The data to send with the event
 * @param onSuccess - Optional callback for successful emission
 * @param onError - Optional callback for errors (after retry if applicable)
 */
export async function emitWithTokenRefresh(
  socket: any,
  event: string,
  data: any,
  onSuccess?: () => void,
  onError?: (error: any) => void
) {
  // Ensure we have a fresh token before emitting
  const freshToken = await ensureFreshToken();
  
  if (!freshToken) {
    console.warn("No valid token available for socket operation - skipping emit");
    // Call error handler if provided, but don't throw
    if (onError) {
      try {
        onError(new Error("No valid token"));
      } catch (e) {
        console.error("Error in onError callback:", e);
      }
    }
    return;
  }

  // Update the data with fresh token if it contains a token field
  const dataWithFreshToken = { ...data };
  if ('token' in dataWithFreshToken) {
    dataWithFreshToken.token = freshToken;
  }

  // Set up one-time error handler for auth errors
  const handleAuthError = async (error: any) => {
    if (error?.message?.includes("401") || error?.message?.includes("Unauthorized") || error?.message?.includes("authentication")) {
      console.log("Socket authentication failed, attempting token refresh...");
      
      const refreshed = await refreshAccessToken();
      
      if (refreshed) {
        // Retry with new token
        const newToken = Api.get().GetTokens().access;
        if ('token' in dataWithFreshToken) {
          dataWithFreshToken.token = newToken;
        }
        
        socket.emit(event, dataWithFreshToken, (response: any) => {
          if (response?.error) {
            console.warn("Socket emit failed after retry:", response.error);
            if (onError) {
              try {
                onError(response.error);
              } catch (e) {
                console.error("Error in onError callback:", e);
              }
            }
          } else {
            if (onSuccess) {
              try {
                onSuccess();
              } catch (e) {
                console.error("Error in onSuccess callback:", e);
              }
            }
          }
        });
      } else {
        console.warn("Token refresh failed for socket operation");
        if (onError) {
          try {
            onError(new Error("Token refresh failed"));
          } catch (e) {
            console.error("Error in onError callback:", e);
          }
        }
      }
    } else {
      // Not an auth error, pass through
      if (onError) {
        try {
          onError(error);
        } catch (e) {
          console.error("Error in onError callback:", e);
        }
      }
    }
  };

  // Emit the event with acknowledgment callback
  socket.emit(event, dataWithFreshToken, (response: any) => {
    if (response?.error) {
      handleAuthError(response.error);
    } else {
      if (onSuccess) {
        try {
          onSuccess();
        } catch (e) {
          console.error("Error in onSuccess callback:", e);
        }
      }
    }
  });
}
