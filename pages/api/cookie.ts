import type { NextApiRequest, NextApiResponse } from "next";
import decryptCookie from "../../utils/Decrypt";
import { JWTDecryptResult } from "jose";

/**
 * API Route to simply see if user has stored cookie and then decrypt it, return tokens and user info
 * @param req - NextApiRequest object
 * @param res - NextApiResponse object
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  let apiResponse;
  let responseCode = 200;
  const token = req.cookies["nextspace-session"] || null;

  if (!token) {
    responseCode = 401;
    apiResponse = { error: "No session cookie found" };
  } else {
    try {
      const decrypted: JWTDecryptResult = await decryptCookie(token);
      apiResponse = {
        tokens: {
          access: decrypted.payload.access,
          refresh: decrypted.payload.refresh,
        },
        userId: decrypted.payload.userId,
        username: decrypted.payload.sub,
      };
    } catch (error) {
      console.error("Failed to decrypt cookie:", error);
      responseCode = 500;
      apiResponse = { error: "Failed to decrypt cookie" };
    }
  }

  return res.status(responseCode).json(apiResponse);
}
