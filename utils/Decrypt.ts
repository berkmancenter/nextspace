import { jwtDecrypt } from 'jose/jwt/decrypt';

/**
 * Decrypts a JWT token to retrieve the cookie payload
 * @param token - The JWT token string
 * @returns The decrypted cookie payload or null if decryption fails
 */
export default async function decryptCookie(token: string): Promise<any | null> {
  try {
    if (!token) throw new Error('No token found');
    if (!process.env.SESSION_SECRET) throw new Error('No session secret found');

    const secret = Buffer.from(process.env.SESSION_SECRET, 'base64');

    if (secret.length !== 32) {
      console.error(`SESSION_SECRET decoded to ${secret.length} bytes, expected 32`);
      throw new Error('Invalid environment variable length');
    }

    const cookie = await jwtDecrypt(token, secret);
    return cookie;
  } catch (error) {
    console.error('Failed to decrypt cookie:', error);
    return null;
  }
}
