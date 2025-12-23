import type { NextApiRequest, NextApiResponse } from "next";
import { EncryptJWT, jwtDecrypt } from "jose";
import { withEnvValidation } from "../../utils/withEnvValidation";

/**
 * API route to handle session management:
 * - GET: Retrieve current session information
 * - POST: Set session cookie or refresh tokens
 * @param req The incoming request object
 * @param res The outgoing response object
 * @returns A JSON response with session data or status
 */
async function handler(req: NextApiRequest, res: NextApiResponse) {
  const secret = new TextEncoder().encode(process.env.SESSION_SECRET!);

  // Handle GET request - retrieve current session info
  if (req.method === "GET") {
    try {
      const sessionCookie = req.cookies["nextspace-session"];

      if (!sessionCookie) {
        return res.status(401).json({ error: "No session found" });
      }

      // Decrypt session cookie
      const { payload } = await jwtDecrypt(sessionCookie, secret);

      // Return token info without exposing actual tokens
      return res.status(200).json({
        tokens: {
          access: {
            expires: payload.exp
              ? new Date(payload.exp * 1000).toISOString()
              : null,
          },
          refresh: {
            token: payload.refresh as string,
          },
        },
      });
    } catch (error) {
      console.error("Session retrieval error:", error);
      return res.status(401).json({ error: "Invalid session" });
    }
  }

  // Handle POST request
  if (req.method === "POST") {
    const { action, refreshToken, username, accessToken } = req.body;

    // Handle token refresh
    if (action === "refresh" && refreshToken) {
      try {
        // Call the external API to refresh tokens
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
          return res.status(401).json({ error: "Token refresh failed" });
        }

        const data = await response.json();

        // Update session cookie with new tokens
        const cookie = await new EncryptJWT({
          access: data.access.token,
          refresh: data.refresh.token,
        })
          .setProtectedHeader({ alg: "dir", enc: "A128CBC-HS256" })
          .setExpirationTime("30 days")
          .setIssuedAt()
          .encrypt(secret);

        res.setHeader(
          "Set-Cookie",
          `nextspace-session=${cookie}; HttpOnly; ${
            process.env.NODE_ENV === "production" ? "Secure" : ""
          }; SameSite=Strict; Max-Age=${30 * 24 * 60 * 60}; Path=/`
        );

        return res.status(200).json({
          tokens: data,
          message: "Tokens refreshed successfully",
        });
      } catch (error) {
        console.error("Token refresh error:", error);
        return res.status(500).json({ error: "Failed to refresh tokens" });
      }
    }

    // Handle initial session creation (login)
    if (username && accessToken && refreshToken) {
      try {
        // Create encrypted JWT cookie
        const cookie = await new EncryptJWT({
          access: accessToken,
          refresh: refreshToken,
        })
          .setProtectedHeader({ alg: "dir", enc: "A128CBC-HS256" })
          .setExpirationTime("30 days")
          .setSubject(username)
          .setIssuedAt()
          .encrypt(secret);

        res.setHeader(
          "Set-Cookie",
          `nextspace-session=${cookie}; HttpOnly; ${
            process.env.NODE_ENV === "production" ? "Secure" : ""
          }; SameSite=Strict; Max-Age=${30 * 24 * 60 * 60}; Path=/`
        );

        return res.status(200).json({ message: "Successfully set cookie!" });
      } catch (error) {
        console.error("Session creation error:", error);
        return res.status(500).json({ error: "Failed to create session" });
      }
    }

    return res.status(400).json({ error: "Invalid request parameters" });
  }

  // Method not allowed
  res.setHeader("Allow", ["GET", "POST"]);
  return res.status(405).json({ error: `Method ${req.method} not allowed` });
}

export default withEnvValidation(handler, ["SESSION_SECRET"]);
