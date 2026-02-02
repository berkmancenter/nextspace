/**
 *
 * @file Helper methods for fetching data from the LLM Facilitator API
 */

import { Api } from "./Helpers";

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
  const options = {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };

  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/${urlSuffix}`,
      {
        method: options.method,
        headers: token ? options.headers : {},
      }
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
