import type { NextApiRequest, NextApiResponse } from "next";
import decryptCookie from "../../utils/Decrypt";
import { RefreshToken } from "../../utils";
import { EncryptJWT } from "jose";
import { withEnvValidation } from "../../utils/withEnvValidation";

/**
 * API route to handle proactive token refresh
 * Refreshes the access token before it expires and updates the session cookie
 * @param req - NextApiRequest object
 * @param res - NextApiResponse object
 */
async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const token = req.cookies["nextspace-session"] || null;

  if (!token) {
    return res.status(401).json({ error: "No session cookie found" });
  }

  try {
    const decrypted = await decryptCookie(token);
    
    if (!decrypted || !decrypted.payload?.refresh) {
      return res.status(401).json({ error: "Invalid session cookie" });
    }

    // Call the refresh token API
    const tokensResponse = await RefreshToken(decrypted.payload.refresh);
    
    if (!tokensResponse) {
      return res.status(401).json({ error: "Failed to refresh tokens" });
    }

    // Create new encrypted JWT cookie with updated tokens
    const secret = new TextEncoder().encode(process.env.SESSION_SECRET!);
    const expirationFromNow = 60 * 60 * 24 * 30; // 30 days

    const cookie = await new EncryptJWT({
      access: tokensResponse.access.token,
      refresh: tokensResponse.refresh.token,
      userId: decrypted.payload.userId,
      accessExpiresAt: tokensResponse.access.expiresAt,
    })
      .setProtectedHeader({ alg: "dir", enc: "A128CBC-HS256" })
      .setExpirationTime(Math.floor(Date.now() / 1000) + expirationFromNow)
      .setSubject(decrypted.payload.sub)
      .setIssuedAt()
      .encrypt(secret);

    // Update the cookie
    res.setHeader(
      "Set-Cookie",
      `nextspace-session=${cookie}; HttpOnly; ${
        process.env.NODE_ENV === "production" ? "Secure" : ""
      }; SameSite=Strict; Max-Age=${expirationFromNow}; Path=/`
    );

    return res.status(200).json({
      tokens: {
        access: tokensResponse.access.token,
        refresh: tokensResponse.refresh.token,
      },
      accessExpiresAt: tokensResponse.access.expiresAt,
    });
  } catch (error) {
    console.error("Failed to refresh tokens:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

export default withEnvValidation(handler, ["SESSION_SECRET"]);
