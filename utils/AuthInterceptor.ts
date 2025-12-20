/**
 * @file Client-side authentication interceptor to handle 401 responses
 */

/**
 * Shows an accessible toast notification for session expiration
 * Uses theme colors and proper ARIA attributes for accessibility
 */
const showSessionExpiredToast = (): void => {
  // Get theme colors dynamically
  const getThemeColors = () => {
    // Try to read from MUI theme CSS variables
    const root = document.documentElement;
    const computedStyle = getComputedStyle(root);

    // Try MUI CSS variables first, fallback to standard MUI error colors
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
 * Handles 401 Unauthorized responses by clearing the session and redirecting to login
 * Shows an accessible notification before redirecting
 * @param redirectUrl - Optional URL to redirect to after clearing session (defaults to /login)
 */
export const handle401Response = (redirectUrl: string = "/login"): void => {
  // Clear the session cookie
  if (typeof document !== "undefined") {
    document.cookie =
      "nextspace-session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;";
  }

  // Clear any in-memory tokens and show notification
  if (typeof window !== "undefined") {
    // Show notification to user
    showSessionExpiredToast();

    // Redirect after 2 seconds to give user time to read the message
    setTimeout(() => {
      window.location.href = redirectUrl;
    }, 2000);
  }
};

/**
 * Checks if a response indicates an authentication failure
 * @param response - The response object or data to check
 * @returns true if the response indicates a 401 error
 */
export const is401Response = (response: any): boolean => {
  // Check Response object (only if Response is defined in environment)
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
 * Wraps a fetch call with 401 handling
 * @param fetchPromise - The fetch promise to wrap
 * @param options - Options for handling the 401
 * @returns The fetch response or throws if 401 and auto-redirect is enabled
 */
export const fetchWith401Handler = async <T = any>(
  fetchPromise: Promise<Response>,
  options: {
    autoRedirect?: boolean;
    redirectUrl?: string;
    onUnauthorized?: () => void;
  } = {}
): Promise<Response> => {
  const {
    autoRedirect = true,
    redirectUrl = "/login",
    onUnauthorized,
  } = options;

  try {
    const response = await fetchPromise;

    if (response.status === 401) {
      console.warn("401 Unauthorized response detected");

      // Call custom handler if provided
      if (onUnauthorized) {
        onUnauthorized();
      }

      // Handle redirect if enabled
      if (autoRedirect) {
        handle401Response(redirectUrl);
      }
    }

    return response;
  } catch (error) {
    throw error;
  }
};

/**
 * Wraps an API call result with 401 handling
 * @param apiCall - The API call function to wrap
 * @param options - Options for handling the 401
 * @returns The API response data or handles 401 appropriately
 */
export const apiCallWith401Handler = async <T = any>(
  apiCall: () => Promise<T>,
  options: {
    autoRedirect?: boolean;
    redirectUrl?: string;
    onUnauthorized?: () => void;
  } = {}
): Promise<T | null> => {
  const {
    autoRedirect = true,
    redirectUrl = "/login",
    onUnauthorized,
  } = options;

  try {
    const response = await apiCall();

    // Check if response indicates 401
    if (is401Response(response)) {
      console.warn("401 Unauthorized response detected in API call");

      // Call custom handler if provided
      if (onUnauthorized) {
        onUnauthorized();
      }

      // Handle redirect if enabled
      if (autoRedirect) {
        handle401Response(redirectUrl);
        return null;
      }
    }

    return response;
  } catch (error) {
    throw error;
  }
};

/**
 * Global fetch wrapper that automatically handles 401 responses
 * Can be used to replace the global fetch function if needed
 * @param input - Fetch input (URL or Request)
 * @param init - Fetch options
 * @returns Promise with fetch Response
 */
export const fetchWithAuth = async (
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> => {
  const response = await fetch(input, init);

  if (response.status === 401) {
    console.warn("401 Unauthorized - Session expired");
    handle401Response();
  }

  return response;
};

/**
 * Centralized fetch wrapper with complete 401 handling and response parsing
 * Handles all three layers of 401 detection in one place
 * @param fetchCall - Function that returns a fetch promise
 * @param options - Options for parsing and error handling
 * @returns Parsed response data or error object
 */
export const fetchWithAutoAuth = async (
  fetchCall: () => Promise<Response>,
  options?: {
    parseAs?: "json" | "text";
    skipParsing?: boolean;
  }
): Promise<any> => {
  try {
    const response = await fetchCall();

    // Handle non-OK responses
    if (!response.ok) {
      // Layer 1: Check response status for 401
      if (response.status === 401) {
        console.warn("401 Unauthorized - Session expired");
        handle401Response();
        return {
          error: true,
          status: 401,
          message: "Unauthorized",
        };
      }

      // Parse error response
      console.error("Network response was not ok");
      const errorData = await response.json();

      // Layer 2: Check if error data indicates 401
      if (is401Response(errorData)) {
        console.warn("401 Unauthorized detected in error response");
        handle401Response();
      }

      return {
        error: true,
        message: errorData,
      };
    }

    // Skip parsing if requested (for cases where caller wants raw response)
    if (options?.skipParsing) {
      return response;
    }

    // Parse successful response
    let data;
    if (options?.parseAs === "text") {
      data = await response.text();
    } else {
      data = await response.json();
    }

    // Layer 3: Check if successful response contains 401 error
    if (is401Response(data)) {
      console.warn("401 Unauthorized detected in response data");
      handle401Response();
    }

    return data;
  } catch (error) {
    console.error("There was a problem with the fetch operation:", error);
    throw error;
  }
};
