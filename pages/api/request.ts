import type { NextApiRequest, NextApiResponse } from "next";
import decryptCookie from "../../utils/Decrypt";
import { RetrieveData, SendData } from "../../utils";
import { withEnvValidation } from "../../utils/withEnvValidation";
import { EncryptJWT } from "jose";

/**
 * Refresh tokens using the refresh token from the cookie
 * @param refreshToken - The refresh token to use
 * @returns New access and refresh tokens, or null if refresh failed
 */
async function refreshTokens(refreshToken: string) {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/auth/refresh-tokens`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          refreshToken,
        }),
      }
    );

    if (!response.ok) {
      console.error("Failed to refresh tokens:", response.status);
      return null;
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error refreshing tokens:", error);
    return null;
  }
}

/**
 * Update the session cookie with new tokens
 * @param req - NextApiRequest object
 * @param res - NextApiResponse object
 * @param newAccessToken - New access token
 * @param newRefreshToken - New refresh token
 * @param existingCookie - Existing decrypted cookie payload
 */
async function updateSessionCookie(
  req: NextApiRequest,
  res: NextApiResponse,
  newAccessToken: string,
  newRefreshToken: string,
  existingCookie: any
) {
  const secret = new TextEncoder().encode(process.env.SESSION_SECRET!);

  // Create new cookie with updated tokens but preserve other data
  const cookie = await new EncryptJWT({
    access: newAccessToken,
    refresh: newRefreshToken,
    userId: existingCookie.userId,
    authType: existingCookie.authType || "guest",
  })
    .setProtectedHeader({ alg: "dir", enc: "A128CBC-HS256" })
    .setExpirationTime(existingCookie.exp || "30d")
    .setSubject(existingCookie.sub || "")
    .setIssuedAt()
    .encrypt(secret);

  // Calculate remaining maxAge from original expiration
  const maxAge = existingCookie.exp
    ? Math.max(0, Number(existingCookie.exp) - Math.floor(Date.now() / 1000))
    : 30 * 24 * 60 * 60;

  res.setHeader(
    "Set-Cookie",
    `nextspace-session=${cookie}; HttpOnly; ${
      process.env.NODE_ENV === "production" ? "Secure" : ""
    }; SameSite=Strict; Max-Age=${maxAge}; Path=/`
  );
}

/**
 * API Route to handle requests with authentication
 * @param req - NextApiRequest object
 * @param res - NextApiResponse object
 */
async function handler(req: NextApiRequest, res: NextApiResponse) {
  let apiResponse;
  const token = req.cookies["nextspace-session"] || null;

  if (!token) {
    return res.status(401).json({ error: "No token found" });
  }
  const cookie = await decryptCookie(token);

  if (!cookie) {
    return res.status(401).json({ error: "Invalid token" });
  }

  // Ensure the decrypted cookie has access token
  if (!cookie.payload?.access) {
    return res.status(401).json({ error: "Not logged in" });
  }

  let accessToken = cookie.payload.access as string;

  // Determine if GET or POST request
  if (req.method !== "POST")
    apiResponse = await RetrieveData(
      req.query.apiEndpoint as string,
      accessToken
    );
  else {
    apiResponse = await SendData(
      req.body.apiEndpoint,
      req.body.payload,
      accessToken
    );
  }

  // If 401, try to refresh tokens and retry
  if (apiResponse?.status === 401 && cookie.payload?.refresh) {
    console.log("Token expired on server-side, attempting refresh...");

    const tokensResponse = await refreshTokens(cookie.payload.refresh as string);

    if (tokensResponse?.access?.token && tokensResponse?.refresh?.token) {
      // Update session cookie with new tokens
      await updateSessionCookie(
        req,
        res,
        tokensResponse.access.token,
        tokensResponse.refresh.token,
        cookie.payload
      );

      // Retry the original request with new access token
      accessToken = tokensResponse.access.token;

      if (req.method !== "POST") {
        apiResponse = await RetrieveData(
          req.query.apiEndpoint as string,
          accessToken
        );
      } else {
        apiResponse = await SendData(
          req.body.apiEndpoint,
          req.body.payload,
          accessToken
        );
      }
    } else {
      // Refresh failed, return unauthorized
      return res.status(401).json({ error: "Token refresh failed" });
    }
  }

  // If still 401 after refresh attempt, return unauthorized
  if (apiResponse?.status === 401) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (!apiResponse)
    return res
      .status(500)
      .json({ error: `Failed to retrieve data from API: ${apiResponse}` });

  return res.status(200).json(apiResponse);
}

export default withEnvValidation(handler, ["SESSION_SECRET"]);
