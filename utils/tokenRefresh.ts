/**
 * Utility functions for token refresh operations.
 *
 * These functions are thin wrappers around `TokenManager` — the single
 * source of truth for token storage, refresh deduplication, proactive
 * scheduling, and cross-tab coordination.  They are kept for backward
 * compatibility with existing callers.
 */

import TokenManagerDefault from './TokenManager';

/**
 * Ensures that the current access token is valid.
 *
 * If the token is still fresh (more than 2 minutes until expiry) the current
 * access token is returned immediately.  If it is expired or within the
 * buffer window a refresh is triggered first.
 *
 * Concurrent callers are automatically deduplicated by `TokenManager`.
 *
 * @returns The current valid access token, or null if refresh failed.
 */
export async function ensureFreshToken(): Promise<string | null> {
  return TokenManagerDefault.getValidToken();
}

/**
 * Attempts to refresh the access token using the refresh token.
 * Updates both in-memory tokens (via TokenManager) and the session cookie.
 *
 * Concurrent callers are automatically deduplicated: if a refresh is already
 * in progress every additional caller awaits the same promise rather than
 * issuing a second request that would invalidate the first one.
 *
 * Cross-tab coordination is handled by TokenManager via BroadcastChannel:
 * if another tab already refreshed the token, this will detect the updated
 * cookie and adopt the new tokens without making a redundant network call.
 *
 * @returns True if refresh was successful, false otherwise.
 */
export async function refreshAccessToken(): Promise<boolean> {
  return TokenManagerDefault.refresh();
}

/**
 * Wraps a WebSocket emit operation with automatic token refresh on
 * authentication errors.  If the socket returns an authentication error it
 * will attempt to refresh the token via `TokenManager` and retry once.
 *
 * @param socket    The socket.io socket instance.
 * @param event     The event name to emit.
 * @param data      The data to send with the event.
 * @param onSuccess Optional callback for successful emission.
 * @param onError   Optional callback for errors (after retry if applicable).
 */
export async function emitWithTokenRefresh(
  socket: any,
  event: string,
  data: any,
  onSuccess?: (response?: any) => void,
  onError?: (error: any) => void,
) {
  // Ensure we have a fresh token before emitting.
  const freshToken = await TokenManagerDefault.getValidToken();

  if (!freshToken) {
    console.warn('No valid token available for socket operation — skipping emit');
    if (onError) {
      try {
        onError(new Error('No valid token'));
      } catch (e) {
        console.error('Error in onError callback:', e);
      }
    }
    return;
  }

  // Update the data with the fresh token if it contains a token field.
  const dataWithFreshToken = { ...data };
  if ('token' in dataWithFreshToken) {
    dataWithFreshToken.token = freshToken;
  }

  // Inner handler for auth errors received from the socket server.
  const handleAuthError = async (error: any) => {
    const isAuthError =
      error?.message?.includes('401') ||
      error?.message?.includes('Unauthorized') ||
      error?.message?.includes('authentication');

    if (isAuthError) {
      console.log('Socket authentication failed, refreshing token via TokenManager…');

      const refreshed = await TokenManagerDefault.refresh();

      if (refreshed) {
        // Retry with the new token.
        const newToken = TokenManagerDefault.getAccessToken();
        if ('token' in dataWithFreshToken) {
          dataWithFreshToken.token = newToken;
        }

        socket.emit(event, dataWithFreshToken, (response: any) => {
          if (response?.error) {
            console.warn('Socket emit failed after retry:', response.error);
            if (onError) {
              try {
                onError(response.error);
              } catch (e) {
                console.error('Error in onError callback:', e);
              }
            }
          } else {
            if (onSuccess) {
              try {
                onSuccess(response);
              } catch (e) {
                console.error('Error in onSuccess callback:', e);
              }
            }
          }
        });
      } else {
        console.warn('Token refresh failed for socket operation');
        if (onError) {
          try {
            onError(new Error('Token refresh failed'));
          } catch (e) {
            console.error('Error in onError callback:', e);
          }
        }
      }
    } else {
      // Not an auth error — pass through as-is.
      if (onError) {
        try {
          onError(error);
        } catch (e) {
          console.error('Error in onError callback:', e);
        }
      }
    }
  };

  // Emit the event with acknowledgment callback.
  socket.emit(event, dataWithFreshToken, (response: any) => {
    if (response?.error) {
      handleAuthError(response.error);
    } else {
      if (onSuccess) {
        try {
          onSuccess(response);
        } catch (e) {
          console.error('Error in onSuccess callback:', e);
        }
      }
    }
  });
}
