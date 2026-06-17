import type { NextApiRequest, NextApiResponse } from 'next';
import { EncryptJWT, jwtDecrypt, decodeJwt } from 'jose';
import { withEnvValidation } from '../../utils/withEnvValidation';
import { CURRENT_COOKIE_VERSION } from '../../utils/cookieValidator';

/**
 * API route to handle setting and updating the session cookie.
 * POST: Create a new session cookie
 * PATCH: Update tokens in existing session cookie
 * @param req The incoming request object
 * @param res The outgoing response object
 * @returns A JSON response indicating successful cookie operation
 */
async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!process.env.SESSION_SECRET) {
    console.log('SESSION_SECRET is not set');
    res.status(500).json({ error: 'Internal server error: missing environment variable' });
    return;
  }

  const secret = Buffer.from(process.env.SESSION_SECRET, 'base64');
  if (secret.length !== 32) {
    console.error(`SESSION_SECRET decoded to ${secret.length} bytes, expected 32`);
    res.status(500).json({
      error: 'Internal server error: invalid environment variable length',
    });
    return;
  }

  // Handle PATCH request - update tokens in existing session
  if (req.method === 'PATCH') {
    const { accessToken, refreshToken, accessExpires, refreshExpires } = req.body;

    if (!accessToken || !refreshToken) {
      res.status(400).json({ error: 'accessToken and refreshToken are required' });
      return;
    }

    // Get existing session cookie
    const existingCookie = req.cookies['nextspace-session'];
    if (!existingCookie) {
      res.status(401).json({ error: 'No session found' });
      return;
    }

    try {
      // Decrypt existing cookie to get current data
      const { payload } = await jwtDecrypt(existingCookie, secret);

      // Derive the owning user from the access token itself so the cookie's
      // userId can never drift from the tokens stored next to it. The access
      // token is a signed (unencrypted) JWT whose `sub` is the user id, so a
      // decode-only read is sufficient. Fall back to the client-supplied
      // userId, then the existing cookie's userId, if the token isn't a
      // decodable JWT.
      let tokenUserId: string | undefined;
      try {
        const claims = decodeJwt(accessToken);
        tokenUserId = (claims.sub as string | undefined) ?? (claims.userId as string | undefined);
      } catch {
        // not a JWT / unparseable — fall through to the fallbacks below
      }

      // Create new cookie with updated tokens but preserve other data.
      // Store accessExpires/refreshExpires so the client can schedule
      // proactive refresh without needing to decode the JWT.
      const cookie = await new EncryptJWT({
        access: accessToken,
        refresh: refreshToken,
        accessExpires: accessExpires || payload.accessExpires,
        refreshExpires: refreshExpires || payload.refreshExpires,
        userId: tokenUserId ?? req.body.userId ?? payload.userId,
        authType: payload.authType || 'guest',
        version: CURRENT_COOKIE_VERSION,
      })
        .setProtectedHeader({ alg: 'dir', enc: 'A128CBC-HS256' })
        .setExpirationTime(payload.exp || '30d')
        .setSubject(payload.sub || '')
        .setIssuedAt()
        .encrypt(secret);

      // Calculate remaining maxAge from original expiration
      const maxAge = payload.exp ? Math.max(0, Number(payload.exp) - Math.floor(Date.now() / 1000)) : 30 * 24 * 60 * 60;

      res.setHeader(
        'Set-Cookie',
        `nextspace-session=${cookie}; HttpOnly; ${
          process.env.NODE_ENV === 'production' ? 'Secure' : ''
        }; SameSite=Strict; Max-Age=${maxAge}; Path=/`,
      );
      res.status(200).json({ message: 'Successfully updated session tokens!' });
      return;
    } catch (error) {
      console.error('Error updating session:', error);
      res.status(500).json({ error: 'Failed to update session' });
      return;
    }
  }

  // Handle POST request - create new session
  if (req.method === 'POST') {
    const sessionData = req.body;

    // Check if expirationFromNow is a number if provided
    if (sessionData.expirationFromNow && typeof sessionData.expirationFromNow !== 'number') {
      res.status(400).json({ error: 'expirationFromNow must be a number in seconds.' });
      return;
    }

    // Validate authType
    const authType = sessionData.authType || 'guest';
    if (!['guest', 'user', 'admin'].includes(authType)) {
      res.status(400).json({ error: 'authType must be one of: guest, user, admin' });
      return;
    }

    // Create encrypted JWT cookie.  Store accessExpires/refreshExpires so the
    // client can schedule proactive refresh without needing to decode the JWT.
    const cookie = await new EncryptJWT({
      access: sessionData.accessToken,
      refresh: sessionData.refreshToken,
      accessExpires: sessionData.accessExpires,
      refreshExpires: sessionData.refreshExpires,
      userId: sessionData.userId,
      authType: authType,
      version: CURRENT_COOKIE_VERSION,
    })
      .setProtectedHeader({ alg: 'dir', enc: 'A128CBC-HS256' })
      .setExpirationTime(
        sessionData.expirationFromNow ? Math.floor(Date.now() / 1000) + sessionData.expirationFromNow : '30d',
      )
      .setSubject(sessionData.username)
      .setIssuedAt()
      .encrypt(secret);

    const maxAge = sessionData.expirationFromNow || 30 * 24 * 60 * 60;

    res.setHeader(
      'Set-Cookie',
      `nextspace-session=${cookie}; HttpOnly; ${
        process.env.NODE_ENV === 'production' ? 'Secure' : ''
      }; SameSite=Strict; Max-Age=${maxAge}; Path=/`,
    );
    res.status(200).json({ message: 'Successfully set cookie!' });
    return;
  }

  // Method not allowed
  res.status(405).json({ error: 'Method not allowed' });
}

export default withEnvValidation(handler, ['SESSION_SECRET']);
