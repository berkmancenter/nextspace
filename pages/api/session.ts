import type { NextApiRequest, NextApiResponse } from "next";
import { EncryptJWT } from "jose";

/**
 * API route to handle setting the session cookie upon user login.
 * @param req The incoming request object
 * @param res The outgoing response object
 * @returns A JSON response indicating successful cookie set
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Check that secret exists
  if (!process.env.SESSION_SECRET) {
    res.status(500).json({ error: "SESSION_SECRET is not set." });
    return;
  }

  const sessionData = req.body;
  const secret = new TextEncoder().encode(process.env.SESSION_SECRET!);

  // Create encrypted JWT cookie
  const cookie = await new EncryptJWT({
    access: sessionData.accessToken,
    refresh: sessionData.refreshToken,
    userId: sessionData.userId,
  })
    .setProtectedHeader({ alg: "dir", enc: "A128CBC-HS256" })
    .setExpirationTime("30 days")
    .setSubject(sessionData.username)
    .setIssuedAt()
    .encrypt(secret);

  res.setHeader(
    "Set-Cookie",
    `nextspace-session=${cookie}; HttpOnly; ${
      process.env.NODE_ENV === "production" ? "Secure" : ""
    }; SameSite=Strict; Max-Age=${30 * 24 * 60 * 60}; Path=/`
  );
  res.status(200).json({ message: "Successfully set cookie!" });
}
