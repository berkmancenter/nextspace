import type { NextApiRequest, NextApiResponse } from "next";
import { EncryptJWT } from "jose";
import { withEnvValidation } from "../../utils/withEnvValidation";

/**
 * API route to handle setting the session cookie upon user login.
 * @param req The incoming request object
 * @param res The outgoing response object
 * @returns A JSON response indicating successful cookie set
 */
async function handler(req: NextApiRequest, res: NextApiResponse) {
  const sessionData = req.body;
  const secret = new TextEncoder().encode(process.env.SESSION_SECRET!);

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
}

export default withEnvValidation(handler, ["SESSION_SECRET"]);
