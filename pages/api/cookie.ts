import type { NextApiRequest, NextApiResponse } from "next";
import decryptCookie from "../../utils/Decrypt";
import { JWTDecryptResult } from "jose";
import { validateCookie } from "../../utils/cookieValidator";

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
      
      // Validate cookie structure
      const validation = validateCookie(decrypted);
      if (!validation.isValid) {
        console.warn("Invalid cookie format:", validation.error);
        responseCode = 401;
        apiResponse = { 
          error: "Invalid cookie format",
          reason: validation.error,
          requiresNewSession: true
        };
        
        // Clear the invalid cookie
        res.setHeader(
          "Set-Cookie",
          `nextspace-session=; HttpOnly; ${
            process.env.NODE_ENV === "production" ? "Secure;" : ""
          } SameSite=Strict; Max-Age=0; Path=/`
        );
      } else {
        apiResponse = {
          tokens: {
            access: decrypted.payload.access,
            refresh: decrypted.payload.refresh,
          },
          userId: decrypted.payload.userId,
          username: decrypted.payload.sub,
          authType: decrypted.payload.authType || "guest",
        };
      }
    } catch (error) {
      console.error("Failed to decrypt cookie:", error);
      responseCode = 500;
      apiResponse = { error: "Failed to decrypt cookie" };
      
      // Clear the malformed cookie
      res.setHeader(
        "Set-Cookie",
        `nextspace-session=; HttpOnly; ${
          process.env.NODE_ENV === "production" ? "Secure;" : ""
        } SameSite=Strict; Max-Age=0; Path=/`
      );
    }
  }

  return res.status(responseCode).json(apiResponse);
}
