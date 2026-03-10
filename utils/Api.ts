/**
 *
 * @file Helper methods for fetching data from the LLM Facilitator API
 */

import { Api } from "./Helpers";

/**
 * In-flight refresh promise used to deduplicate concurrent 401 responses.
 * When multiple requests all receive a 401 simultaneously they all share
 * the same refresh request rather than each sending their own — which
 * would invalidate the single-use refresh token and trigger a destructive
 * race condition that clears the session.
 */
let _inflightFetchRefresh: Promise<boolean> | null = null;

/**
 * Performs the actual token refresh HTTP call and updates tokens in memory
 * and in the session cookie. Used internally by fetchWithTokenRefresh.
 */
async function _doFetchRefresh(apiI: ReturnType<typeof Api.get>): Promise<boolean> {
  const currentTokens = apiI.GetTokens();
  if (!currentTokens.refresh) return false;

  try {
    const tokensResponse = await RefreshToken(currentTokens.refresh);

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

      return true;
    }

    return false;
  } catch (error) {
    console.error("Token refresh error:", error);
    return false;
  }
}

/**
 * Wrapper for fetch that automatically handles token refresh on 401 responses.
 * @param url - The URL to fetch
 * @param options - Fetch options
 * @param useStoredTokens - Whether to automatically use stored tokens for authorization
 * @returns Promise with the fetch response
 */
export const fetchWithTokenRefresh = async (
  url: string,
  options: RequestInit,
  useStoredTokens: boolean = false
): Promise<Response> => {
  const apiI = Api.get();
  let API_TOKENS = apiI.GetTokens();

  // If useStoredTokens is true and no Authorization header is set, add it
  if (useStoredTokens && API_TOKENS.access) {
    if (!options.headers) {
      options.headers = {};
    }
    const headers = options.headers as Record<string, string>;
    if (!headers["Authorization"]) {
      headers["Authorization"] = `Bearer ${API_TOKENS.access}`;
    }
  }

  // First attempt
  let response = await fetch(url, options);

  // If 401 and we have a refresh token, try refreshing
  if (response.status === 401 && API_TOKENS.refresh) {
    console.log("Token expired, refreshing...");

    // Deduplicate concurrent refresh calls — only one HTTP request is made
    // even when multiple callers all receive a 401 simultaneously.  Without
    // this guard each concurrent caller would send its own refresh request;
    // the second request would use the now-invalidated refresh token, receive
    // a 401, and trigger a logout that destroys the whole session.
    if (!_inflightFetchRefresh) {
      _inflightFetchRefresh = _doFetchRefresh(apiI).finally(() => {
        _inflightFetchRefresh = null;
      });
    }

    const refreshed = await _inflightFetchRefresh;

    if (refreshed) {
      // Retry with the freshly-issued access token
      const newToken = apiI.getAccessToken();
      const headers = new Headers(options.headers);
      headers.set("Authorization", `Bearer ${newToken}`);
      response = await fetch(url, { ...options, headers });
    }
  }

  return response;
};

/**
 * Authenticate the user with the API.
 * @returns Promise with access and refresh tokens
 */
export const Authenticate = async (username: string, password: string) => {
  const options = {
    method: "POST",
    url: `${process.env.NEXT_PUBLIC_API_URL}/auth/login`,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      username,
      password,
    }),
  };

  const response = await fetch(options.url, {
    method: options.method,
    headers: options.headers,
    body: options.body,
  });

  if (!response.ok) {
    console.error("Network response was not ok", response);
    const errorData = await response.json();
    return {
      error: true,
      message: errorData.message,
    };
  }

  const data = await response.json();
  console.log("Response:", data);
  return data;
};

/**
 * Refresh the access token using the refresh token.
 * @param refreshToken - The refresh token to use for obtaining a new access token.
 * @returns Promise with new access and refresh tokens
 */
export const RefreshToken = async (refreshToken: string) => {
  const options = {
    method: "POST",
    url: `${process.env.NEXT_PUBLIC_API_URL}/auth/refresh-tokens`,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      refreshToken,
    }),
  };

  try {
    const response = await fetch(options.url, {
      method: options.method,
      headers: options.headers,
      body: options.body,
    });

    // If 401 Unauthorized, all tokens have expired, clear local session
    if (response.status === 401) {
      const logoutResponse = await fetch("/api/logout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      // Clear tokens from local Api instance
      Api.get().ClearTokens();
      Api.get().ClearAdminTokens();

      if (!logoutResponse.ok) {
        throw new Error("Logout failed");
      }
      return;
    }

    if (!response.ok) {
      throw new Error("Network response was not ok");
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error(
      "There was a problem with the refresh tokens operation:",
      error
    );
  }
};

/**
 * Gets the user's timezone using the Intl API.
 * @returns The IANA timezone identifier (e.g., "America/New_York")
 */
export const getUserTimezone = (): string => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch (error) {
    console.warn("Failed to get user timezone, defaulting to UTC:", error);
    return "UTC";
  }
};

/**
 * Retrieve data from the API.
 * @param urlSuffix - The endpoint suffix to retrieve data from.
 * @param token - Optional bearer token for authorization.
 * @param dataType - Optional data type to specify how to parse the response (e.g., "json", "text").
 * @returns Promise<any>
 */
export const RetrieveData = async (
  urlSuffix: string,
  token?: string,
  dataType?: string
) => {
  const headers: Record<string, string> = {
    "X-Timezone": getUserTimezone(),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  try {
    const response = await fetchWithTokenRefresh(
      `${process.env.NEXT_PUBLIC_API_URL}/${urlSuffix}`,
      {
        method: "GET",
        headers,
      },
      !token // Use stored tokens if no explicit token provided
    );

    if (!response.ok) {
      console.error("Network response was not ok");
      const errorData = await response.json();
      return {
        error: true,
        message: errorData,
      };
    }
    let data;
    if (!dataType || dataType === "json") data = await response.json();
    else if (dataType === "text") data = await response.text();
    return data;
  } catch (error) {
    console.error("There was a problem with the fetch operation:", error);
  }
};

/**
 * Send data to the client API, so cookie can be decrypted and used for request auth.
 * @param urlSuffix - The endpoint suffix to send data to.
 * @param payload? - The data payload to send.
 * @returns Promise<any>
 */
export const Request = async (urlSuffix: string, payload?: any) => {
  const url = payload
    ? `/api/request`
    : `/api/request?apiEndpoint=${encodeURIComponent(urlSuffix)}`;
  const response = await fetch(
    url,
    payload
      ? {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            apiEndpoint: urlSuffix,
            payload,
          }),
        }
      : {
          method: "GET",
        }
  );
  if (!response) {
    console.error("Network response was not ok", response);
    return {
      error: true,
      message: "No response received",
    };
  }
  if (!response.ok) {
    console.error("Network response was not ok");
    const errorData = await response.json();
    return {
      error: true,
      message: errorData,
    };
  }
  const data = await response.json();
  return data;
};

/**
 * Handles WebSocket state changes by setting up event listeners for connection, disconnection, and errors.
 * @param socket - The WebSocket instance to manage.
 * @param onConnected - Callback function to execute when the connection state changes.
 * @returns A cleanup function to remove the event listeners.
 */
export const SocketStateHandler = (
  socket: any,
  onConnected: (is: boolean) => any
) => {
  socket.on("error", (error: string) => {
    console.error("Socket error:", error);
  });
  socket.on("connect", onConnected(true));
  socket.on("disconnect", onConnected(false));

  return () => {
    socket.off("connect", onConnected(true));
    socket.off("disconnect", onConnected(false));
  };
};
