/**
 * @file Client-side authentication interceptor for Next.js
 * Handles session expiration, token refresh, and 401 responses
 * Following Next.js best practices for authentication
 */

/**
 * Token expiry information stored in memory
 */
interface TokenInfo {
  expiresAt: number | null;
  refreshToken: string | null;
}

let tokenInfo: TokenInfo = {
  expiresAt: null,
  refreshToken: null,
};

/**
 * Shows an accessible toast notification for session expiration
 * Uses theme colors and proper ARIA attributes for accessibility
 */
const showSessionExpiredToast = (): void => {
  // Prevent duplicate toasts
  if (document.getElementById("session-expired-toast")) {
    return;
  }

  // Get theme colors dynamically
  const getThemeColors = () => {
    const root = document.documentElement;
    const computedStyle = getComputedStyle(root);

    const errorColor =
      computedStyle.getPropertyValue("--mui-palette-error-main")?.trim() ||
      "#d32f2f";
    const errorContrastText =
      computedStyle
        .getPropertyValue("--mui-palette-error-contrastText")
        ?.trim() || "#ffffff";

    return { errorColor, errorContrastText };
  };

  const { errorColor, errorContrastText } = getThemeColors();

  const toast = document.createElement("div");

  // ARIA attributes for screen reader accessibility
  toast.setAttribute("role", "alert");
  toast.setAttribute("aria-live", "assertive");
  toast.setAttribute("aria-atomic", "true");
  toast.setAttribute("id", "session-expired-toast");

  toast.innerHTML = `
    <div style="
      position: fixed;
      bottom: 24px;
      left: 50%;
      transform: translateX(-50%);
      background-color: ${errorColor};
      color: ${errorContrastText};
      padding: 16px 24px;
      border-radius: 4px;
      box-shadow: 0px 3px 5px -1px rgba(0,0,0,0.2),
                  0px 6px 10px 0px rgba(0,0,0,0.14),
                  0px 1px 18px 0px rgba(0,0,0,0.12);
      z-index: 9999;
      font-family: 'Inter Variable', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      font-weight: 400;
      line-height: 1.43;
      letter-spacing: 0.01071em;
      display: flex;
      align-items: center;
      gap: 12px;
      animation: slideIn 0.3s ease-out;
      max-width: 90%;
      box-sizing: border-box;
    ">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style="flex-shrink: 0;">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
      </svg>
      <span>Your session has expired. Redirecting to login...</span>
    </div>
    <style>
      @keyframes slideIn {
        from {
          transform: translate(-50%, 100px);
          opacity: 0;
        }
        to {
          transform: translate(-50%, 0);
          opacity: 1;
        }
      }
      @media (prefers-reduced-motion: reduce) {
        #session-expired-toast * {
          animation: none !important;
        }
      }
    </style>
  `;

  document.body.appendChild(toast);

  // Auto-remove after redirect
  setTimeout(() => {
    if (toast.parentNode) {
      toast.remove();
    }
  }, 3000);
};

/**
 * Clears the session using server-side API route (best practice for Next.js)
 * This ensures httpOnly cookies are properly cleared
 * @param redirectUrl - Optional URL to redirect to after clearing session
 */
export const clearSession = async (
  redirectUrl: string = "/login"
): Promise<void> => {
  try {
    // Call server-side logout API to clear httpOnly cookies properly
    await fetch("/api/logout", {
      method: "POST",
      credentials: "include",
    });
  } catch (error) {
    console.error("Error clearing session:", error);
  }

  // Clear in-memory token info
  tokenInfo = {
    expiresAt: null,
    refreshToken: null,
  };

  // Show notification and redirect
  if (typeof window !== "undefined") {
    showSessionExpiredToast();

    setTimeout(() => {
      window.location.href = redirectUrl;
    }, 2000);
  }
};

/**
 * Set token information for proactive refresh
 * @param expiresIn - Seconds until token expires
 * @param refreshToken - Refresh token for obtaining new access token
 */
export const setTokenInfo = (expiresIn: number, refreshToken: string): void => {
  tokenInfo = {
    expiresAt: Date.now() + expiresIn * 1000,
    refreshToken,
  };
};

/**
 * Check if token is expired or about to expire
 * @param bufferSeconds - Number of seconds before expiry to consider token expired (default: 60)
 * @returns true if token is expired or will expire within buffer time
 */
export const isTokenExpired = (bufferSeconds: number = 60): boolean => {
  if (!tokenInfo.expiresAt) {
    return false; // No token info, let server handle it
  }

  const bufferMs = bufferSeconds * 1000;
  return Date.now() >= tokenInfo.expiresAt - bufferMs;
};

/**
 * Attempts to refresh the access token proactively
 * @returns true if refresh was successful, false otherwise
 */
export const refreshAccessToken = async (): Promise<boolean> => {
  if (!tokenInfo.refreshToken) {
    console.warn("No refresh token available");
    return false;
  }

  try {
    const response = await fetch("/api/session", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "refresh",
        refreshToken: tokenInfo.refreshToken,
      }),
      credentials: "include",
    });

    if (!response.ok) {
      console.error("Token refresh failed:", response.status);
      return false;
    }

    const data = await response.json();

    // Update token info with new expiry
    if (data.tokens?.access?.expires) {
      const expiresIn = Math.floor(
        (new Date(data.tokens.access.expires).getTime() - Date.now()) / 1000
      );
      setTokenInfo(expiresIn, data.tokens.refresh.token);
    }

    return true;
  } catch (error) {
    console.error("Error refreshing token:", error);
    return false;
  }
};

/**
 * Checks if a response indicates an authentication failure
 * @param response - The response object or data to check
 * @returns true if the response indicates a 401 error
 */
export const is401Response = (response: any): boolean => {
  // Check Response object
  if (typeof Response !== "undefined" && response instanceof Response) {
    return response.status === 401;
  }

  // Check error response object
  if (response && typeof response === "object") {
    return (
      response.status === 401 ||
      response.error === "Unauthorized" ||
      response.error === "No token found" ||
      response.error === "Invalid token" ||
      response.error === "Not logged in"
    );
  }

  return false;
};

/**
 * Unified authenticated fetch wrapper for Next.js
 * Handles token refresh, 401 responses, and response parsing
 * This is the primary function to use for all authenticated API calls
 *
 * @param input - Fetch input (URL or Request)
 * @param init - Fetch options
 * @param options - Additional options for auth handling
 * @returns Parsed response data
 *
 * @example
 * // Simple GET request
 * const data = await authenticatedFetch('/api/users');
 *
 * @example
 * // POST with body
 * const result = await authenticatedFetch('/api/users', {
 *   method: 'POST',
 *   body: JSON.stringify({ name: 'John' })
 * });
 *
 * @example
 * // Custom error handling
 * const data = await authenticatedFetch('/api/data', {}, {
 *   onUnauthorized: () => console.log('Session expired'),
 *   autoRefresh: false
 * });
 */
export const authenticatedFetch = async (
  input: RequestInfo | URL,
  init?: RequestInit,
  options?: {
    parseAs?: "json" | "text" | "blob";
    autoRefresh?: boolean;
    onUnauthorized?: () => void;
    skipParsing?: boolean;
  }
): Promise<any> => {
  const {
    parseAs = "json",
    autoRefresh = true,
    onUnauthorized,
    skipParsing = false,
  } = options || {};

  try {
    // Proactive token refresh if token is about to expire
    if (autoRefresh && isTokenExpired()) {
      console.log("Token about to expire, refreshing proactively...");
      const refreshed = await refreshAccessToken();
      if (!refreshed) {
        console.warn("Token refresh failed, continuing with existing token");
      }
    }

    // Only include credentials for internal API routes to avoid CORS issues
    // External API calls don't need cookies
    const isInternalRoute =
      typeof input === "string" && input.startsWith("/api");
    const shouldIncludeCredentials =
      init?.credentials || (isInternalRoute ? "include" : "omit");

    // Make the fetch request
    const response = await fetch(input, {
      ...init,
      credentials: shouldIncludeCredentials,
    });

    // Handle 401 Unauthorized
    if (response.status === 401) {
      console.warn("401 Unauthorized response detected");

      // Call custom handler if provided
      if (onUnauthorized) {
        onUnauthorized();
      }

      // Try to refresh token once if auto-refresh is enabled
      if (autoRefresh) {
        const refreshed = await refreshAccessToken();
        if (refreshed) {
          console.log("Token refreshed successfully, retrying request...");
          // Retry the request with new token - use same credentials logic as initial request
          const retryResponse = await fetch(input, {
            ...init,
            credentials: shouldIncludeCredentials,
          });

          if (retryResponse.ok) {
            return skipParsing
              ? retryResponse
              : await parseResponse(retryResponse, parseAs);
          } else if (retryResponse.status === 401) {
            // Still 401 after refresh - session is definitely invalid
            console.warn(
              "Still unauthorized after token refresh, clearing session"
            );
            await clearSession();
            return null;
          }
        } else {
          // Refresh failed - clear session and redirect
          console.warn("Token refresh failed, clearing session");
          await clearSession();
          return null;
        }
      } else {
        // Auto-refresh disabled - clear session and redirect
        console.warn("Auto-refresh disabled, clearing session");
        await clearSession();
        return null;
      }

      // Fallback - should not reach here, but ensure session is cleared
      console.warn("Unexpected 401 flow, clearing session");
      await clearSession();
      return null;
    }

    // Handle other non-OK responses
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({
        message: response.statusText,
      }));

      console.error(`HTTP ${response.status}:`, errorData);

      return {
        error: true,
        status: response.status,
        message: errorData.message || errorData,
      };
    }

    // Parse successful response
    if (skipParsing) {
      return response;
    }

    const data = await parseResponse(response, parseAs);

    // Check if successful response contains 401 error (edge case)
    if (is401Response(data)) {
      console.warn("401 error detected in response data");
      await clearSession();
      return null;
    }

    return data;
  } catch (error) {
    console.error("Fetch error:", error);
    throw error;
  }
};

/**
 * Helper function to parse response based on specified type
 */
async function parseResponse(
  response: Response,
  parseAs: "json" | "text" | "blob"
): Promise<any> {
  switch (parseAs) {
    case "text":
      return await response.text();
    case "blob":
      return await response.blob();
    case "json":
    default:
      return await response.json();
  }
}

/**
 * Initialize auth state from server
 * Call this on app load to sync token expiry info
 */
export const initAuthState = async (): Promise<void> => {
  try {
    const response = await fetch("/api/session", {
      method: "GET",
      credentials: "include",
    });

    if (response.ok) {
      const data = await response.json();
      if (data.tokens?.access?.expires && data.tokens?.refresh?.token) {
        const expiresIn = Math.floor(
          (new Date(data.tokens.access.expires).getTime() - Date.now()) / 1000
        );
        setTokenInfo(expiresIn, data.tokens.refresh.token);
      }
    }
  } catch (error) {
    console.error("Error initializing auth state:", error);
  }
};
