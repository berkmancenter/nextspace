/**
 * @file Client-side authentication interceptor to handle 401 responses
 */

/**
 * Handles 401 Unauthorized responses by clearing the session and redirecting to login
 * @param redirectUrl - Optional URL to redirect to after clearing session (defaults to /login)
 */
export const handle401Response = (redirectUrl: string = "/login"): void => {
  // Clear the session cookie
  if (typeof document !== "undefined") {
    document.cookie =
      "nextspace-session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;";
  }

  // Clear any in-memory tokens
  if (typeof window !== "undefined") {
    // Redirect to login page
    window.location.href = redirectUrl;
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
