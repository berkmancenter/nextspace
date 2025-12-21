/**
 * @file Helper methods for fetching data from the LLM Facilitator API
 * Updated to use authenticatedFetch for better Next.js integration
 */

import { authenticatedFetch } from "./AuthInterceptor";

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
  return data.tokens;
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
 * Retrieve data from the API.
 * Automatically handles 401 Unauthorized responses and token refresh.
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
  return authenticatedFetch(
    `${process.env.NEXT_PUBLIC_API_URL}/${urlSuffix}`,
    {
      method: "GET",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    },
    { parseAs: dataType as "json" | "text" }
  );
};

/**
 * Send data to the client API, so cookie can be decrypted and used for request auth.
 * Automatically handles 401 Unauthorized responses and token refresh.
 * @param urlSuffix - The endpoint suffix to send data to.
 * @param payload? - The data payload to send.
 * @returns Promise<any>
 */
export const Request = async (urlSuffix: string, payload?: any) => {
  const url = payload
    ? `/api/request`
    : `/api/request?apiEndpoint=${encodeURIComponent(urlSuffix)}`;

  const result = await authenticatedFetch(
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

  // Handle case where fetch returns null/undefined
  if (!result) {
    return {
      error: true,
      message: "No response received",
    };
  }

  return result;
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
