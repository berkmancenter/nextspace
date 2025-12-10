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

  if (sessionData.expiration && typeof sessionData.expiration !== "number") {
    res
      .status(400)
      .json({ error: "Expiration must be a number representing seconds." });
    return;
  }

  // Create encrypted JWT cookie
  const cookie = await new EncryptJWT({
    access: sessionData.accessToken,
    refresh: sessionData.refreshToken,
    userId: sessionData.userId,
  })
    .setProtectedHeader({ alg: "dir", enc: "A128CBC-HS256" })
    .setExpirationTime(sessionData.expiration || "30 days")
    .setSubject(sessionData.username)
    .setIssuedAt()
    .encrypt(secret);

  res.setHeader(
    "Set-Cookie",
    `nextspace-session=${cookie}; HttpOnly; ${
      process.env.NODE_ENV === "production" ? "Secure" : ""
    }; SameSite=Strict; Max-Age=${
      sessionData.expiration || 30 * 24 * 60 * 60
    }; Path=/`
  );
  res.status(200).json({ message: "Successfully set cookie!" });
}
