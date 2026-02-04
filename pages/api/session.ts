import type { NextApiRequest, NextApiResponse } from "next";
import { EncryptJWT, jwtDecrypt } from "jose";
import { withEnvValidation } from "../../utils/withEnvValidation";

/**
 * API route to handle setting and updating the session cookie.
 * POST: Create a new session cookie
 * PATCH: Update tokens in existing session cookie
 * @param req The incoming request object
 * @param res The outgoing response object
 * @returns A JSON response indicating successful cookie operation
 */
async function handler(req: NextApiRequest, res: NextApiResponse) {
  const secret = new TextEncoder().encode(process.env.SESSION_SECRET!);

  // Handle PATCH request - update tokens in existing session
  if (req.method === "PATCH") {
    const { accessToken, refreshToken } = req.body;

    if (!accessToken || !refreshToken) {
      res.status(400).json({ error: "accessToken and refreshToken are required" });
      return;
    }

    // Get existing session cookie
    const existingCookie = req.cookies["nextspace-session"];
    if (!existingCookie) {
      res.status(401).json({ error: "No session found" });
      return;
    }

    try {
      // Decrypt existing cookie to get current data
      const { payload } = await jwtDecrypt(existingCookie, secret);

      // Create new cookie with updated tokens but preserve other data
      const cookie = await new EncryptJWT({
        access: accessToken,
        refresh: refreshToken,
        userId: payload.userId,
        authType: payload.authType || "guest",
      })
        .setProtectedHeader({ alg: "dir", enc: "A128CBC-HS256" })
        .setExpirationTime(payload.exp || "30d")
        .setSubject(payload.sub || "")
        .setIssuedAt()
        .encrypt(secret);

      // Calculate remaining maxAge from original expiration
      const maxAge = payload.exp
        ? Math.max(0, Number(payload.exp) - Math.floor(Date.now() / 1000))
        : 30 * 24 * 60 * 60;

      res.setHeader(
        "Set-Cookie",
        `nextspace-session=${cookie}; HttpOnly; ${
          process.env.NODE_ENV === "production" ? "Secure" : ""
        }; SameSite=Strict; Max-Age=${maxAge}; Path=/`
      );
      res.status(200).json({ message: "Successfully updated session tokens!" });
      return;
    } catch (error) {
      console.error("Error updating session:", error);
      res.status(500).json({ error: "Failed to update session" });
      return;
    }
  }

  // Handle POST request - create new session
  if (req.method === "POST") {
    const sessionData = req.body;

    // Check if expirationFromNow is a number if provided
    if (
      sessionData.expirationFromNow &&
      typeof sessionData.expirationFromNow !== "number"
    ) {
      res
        .status(400)
        .json({ error: "expirationFromNow must be a number in seconds." });
      return;
    }

    // Validate authType
    const authType = sessionData.authType || "guest";
    if (!["guest", "user", "admin"].includes(authType)) {
      res
        .status(400)
        .json({ error: "authType must be one of: guest, user, admin" });
      return;
    }

    // Create encrypted JWT cookie
    const cookie = await new EncryptJWT({
      access: sessionData.accessToken,
      refresh: sessionData.refreshToken,
      userId: sessionData.userId,
      authType: authType,
    })
      .setProtectedHeader({ alg: "dir", enc: "A128CBC-HS256" })
      .setExpirationTime(
        sessionData.expirationFromNow
          ? Math.floor(Date.now() / 1000) + sessionData.expirationFromNow
          : "30d"
      )
      .setSubject(sessionData.username)
      .setIssuedAt()
      .encrypt(secret);

    const maxAge = sessionData.expirationFromNow || 30 * 24 * 60 * 60;

    res.setHeader(
      "Set-Cookie",
      `nextspace-session=${cookie}; HttpOnly; ${
        process.env.NODE_ENV === "production" ? "Secure" : ""
      }; SameSite=Strict; Max-Age=${maxAge}; Path=/`
    );
    res.status(200).json({ message: "Successfully set cookie!" });
    return;
  }

  // Method not allowed
  res.status(405).json({ error: "Method not allowed" });
}

export default withEnvValidation(handler, ["SESSION_SECRET"]);
