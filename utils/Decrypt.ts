import { jwtDecrypt } from "jose/jwt/decrypt";

/**
 * Decrypts a JWT token to retrieve the cookie payload
 * @param token - The JWT token string
 * @returns The decrypted cookie payload or null if decryption fails
 */
export default async function decryptCookie(
  token: string
): Promise<any | null> {
  try {
    if (!token) throw new Error("No token found");
    const secret = new TextEncoder().encode(process.env.SESSION_SECRET!);
    const cookie = await jwtDecrypt(token, secret);
    return cookie.payload;
  } catch (error) {
    console.error("Failed to decrypt cookie:", error);
    return null;
  }
}
