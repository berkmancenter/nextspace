import { createMocks } from 'node-mocks-http';
import { NextApiRequest, NextApiResponse } from 'next';

// Mock jose library
jest.mock('jose', () => {
  const mockEncrypt = jest.fn();
  const mockJwtDecrypt = jest.fn();
  const mockDecodeJwt = jest.fn();
  // Capture the payload handed to EncryptJWT so tests can assert on the
  // fields written into the cookie (e.g. the resolved userId).
  const mockEncryptJWT = jest.fn().mockImplementation(() => ({
    setProtectedHeader: jest.fn().mockReturnThis(),
    setExpirationTime: jest.fn().mockReturnThis(),
    setSubject: jest.fn().mockReturnThis(),
    setIssuedAt: jest.fn().mockReturnThis(),
    encrypt: mockEncrypt,
  }));

  return {
    EncryptJWT: mockEncryptJWT,
    jwtDecrypt: mockJwtDecrypt,
    decodeJwt: mockDecodeJwt,
    __mockEncrypt: mockEncrypt,
    __mockJwtDecrypt: mockJwtDecrypt,
    __mockDecodeJwt: mockDecodeJwt,
    __mockEncryptJWT: mockEncryptJWT,
  };
});

// Mock the withEnvValidation wrapper
jest.mock('../../utils/withEnvValidation', () => ({
  withEnvValidation: (handler: any) => handler,
}));

// Import the handler after mocking
import handler from '../../pages/api/session';
import { jwtDecrypt } from 'jose';

const SECRET = 'bri956LLFxctMUwQYElvu8VcM/hIN/4O6dwGnPLd9WM=';
process.env.SESSION_SECRET = SECRET;
Object.defineProperty(process.env, 'NODE_ENV', {
  value: 'test',
  writable: true,
  configurable: true,
});

// Get the mocked functions
const mockJwtDecrypt = jwtDecrypt as jest.MockedFunction<typeof jwtDecrypt>;
const jose = require('jose');
const mockEncrypt = jose.__mockEncrypt;
const mockDecodeJwt = jose.__mockDecodeJwt;
const mockEncryptJWT = jose.__mockEncryptJWT;

describe('SESSION_SECRET validation', () => {
  const originalSecret = process.env.SESSION_SECRET;

  afterEach(() => {
    process.env.SESSION_SECRET = originalSecret;
  });

  it('should return 500 if SESSION_SECRET is not set', async () => {
    delete process.env.SESSION_SECRET;

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: 'POST',
      body: { username: 'testuser', accessToken: 'a', refreshToken: 'b' },
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(500);
    expect(JSON.parse(res._getData())).toEqual({
      error: 'Internal server error: missing environment variable',
    });
  });

  it('should return 500 if SESSION_SECRET decodes to wrong byte length', async () => {
    // base64 of a string that does not decode to 32 bytes
    process.env.SESSION_SECRET = Buffer.from('tooshort').toString('base64');

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: 'POST',
      body: { username: 'testuser', accessToken: 'a', refreshToken: 'b' },
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(500);
    expect(JSON.parse(res._getData())).toEqual({
      error: 'Internal server error: invalid environment variable length',
    });
  });

  it('should return 500 if SESSION_SECRET is not valid base64 (random chars)', async () => {
    // Not valid base64, but Buffer.from will still attempt to parse it;
    // the result will not be 32 bytes
    process.env.SESSION_SECRET = 'not-valid-base64!!!';

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: 'POST',
      body: { username: 'testuser', accessToken: 'a', refreshToken: 'b' },
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(500);
    expect(JSON.parse(res._getData())).toEqual({
      error: 'Internal server error: invalid environment variable length',
    });
  });

  it('should return 500 if SESSION_SECRET is a 44-char base64 string that decodes to wrong length', async () => {
    // 44 chars of base64 but not a valid 32-byte key (padding issues)
    process.env.SESSION_SECRET = 'YQ=='.padEnd(44, 'Y'); // invalid padding, not 32 bytes

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: 'POST',
      body: { username: 'testuser', accessToken: 'a', refreshToken: 'b' },
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(500);
    expect(JSON.parse(res._getData())).toEqual({
      error: 'Internal server error: invalid environment variable length',
    });
  });
});

describe('/api/session', () => {
  beforeEach(() => {
    mockEncrypt.mockResolvedValue('encrypted-jwt-token');
    mockEncryptJWT.mockClear();
    // Default: access token carries no decodable claims, so userId resolution
    // falls through to the body / existing-cookie fallbacks. Individual tests
    // override this to exercise the `sub`-claim path.
    mockDecodeJwt.mockReset();
    mockDecodeJwt.mockReturnValue({});
    mockJwtDecrypt.mockResolvedValue({
      payload: {
        access: 'old-access',
        refresh: 'old-refresh',
        userId: 'user-123',
        authType: 'user',
        sub: 'testuser',
        exp: Math.floor(Date.now() / 1000) + 3600,
      },
      protectedHeader: {
        alg: '',
        enc: '',
      },
      key: Uint8Array.from([]),
    });
  });

  describe('POST - Create new session', () => {
    it('should create a new session cookie with valid data', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'POST',
        body: {
          username: 'testuser',
          userId: 'user-123',
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
          authType: 'user',
          expirationFromNow: 3600,
        },
      });

      await handler(req, res);

      expect(res._getStatusCode()).toBe(200);
      expect(JSON.parse(res._getData())).toEqual({
        message: 'Successfully set cookie!',
      });

      const setCookieHeader = res._getHeaders()['set-cookie'];
      expect(setCookieHeader).toBeDefined();
      expect(setCookieHeader).toContain('nextspace-session=');
      expect(setCookieHeader).toContain('HttpOnly');
      expect(setCookieHeader).toContain('SameSite=Strict');
    });

    it('should default to guest authType if not provided', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'POST',
        body: {
          username: 'GuestUser',
          userId: 'guest-123',
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
        },
      });

      await handler(req, res);

      expect(res._getStatusCode()).toBe(200);
      // Verify cookie was created
      const setCookieHeader = res._getHeaders()['set-cookie'];
      expect(setCookieHeader).toContain('nextspace-session=');
    });

    it('should reject invalid authType', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'POST',
        body: {
          username: 'testuser',
          userId: 'user-123',
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
          authType: 'invalid',
        },
      });

      await handler(req, res);

      expect(res._getStatusCode()).toBe(400);
      expect(JSON.parse(res._getData())).toEqual({
        error: 'authType must be one of: guest, user, admin',
      });
    });

    it('should reject non-numeric expirationFromNow', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'POST',
        body: {
          username: 'testuser',
          userId: 'user-123',
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
          expirationFromNow: 'not-a-number',
        },
      });

      await handler(req, res);

      expect(res._getStatusCode()).toBe(400);
      expect(JSON.parse(res._getData())).toEqual({
        error: 'expirationFromNow must be a number in seconds.',
      });
    });

    it('should create cookie with proper security flags', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'POST',
        body: {
          username: 'testuser',
          userId: 'user-123',
          accessToken: 'my-access-token',
          refreshToken: 'my-refresh-token',
          authType: 'user',
        },
      });

      await handler(req, res);

      expect(res._getStatusCode()).toBe(200);
      const setCookieHeader = res._getHeaders()['set-cookie'] as string;
      expect(mockEncrypt).toHaveBeenCalled();
      expect(setCookieHeader).toContain('HttpOnly');
      expect(setCookieHeader).toContain('SameSite=Strict');
    });
  });

  describe('PATCH - Update session tokens', () => {
    it('should update tokens in existing session', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'PATCH',
        body: {
          accessToken: 'new-access-token',
          refreshToken: 'new-refresh-token',
        },
        cookies: {
          'nextspace-session': 'existing-encrypted-cookie',
        },
      });

      await handler(req, res);

      expect(res._getStatusCode()).toBe(200);
      expect(JSON.parse(res._getData())).toEqual({
        message: 'Successfully updated session tokens!',
      });
      expect(mockJwtDecrypt).toHaveBeenCalled();
      expect(mockEncrypt).toHaveBeenCalled();
    });

    it('should preserve existing session data when updating tokens', async () => {
      mockJwtDecrypt.mockResolvedValueOnce({
        payload: {
          access: 'old-access',
          refresh: 'old-refresh',
          userId: 'user-456',
          authType: 'admin',
          sub: 'adminuser',
          exp: Math.floor(Date.now() / 1000) + 7200,
        },
      } as any);

      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'PATCH',
        body: {
          accessToken: 'new-access',
          refreshToken: 'new-refresh',
        },
        cookies: {
          'nextspace-session': 'existing-encrypted-cookie',
        },
      });

      await handler(req, res);

      expect(res._getStatusCode()).toBe(200);
      expect(mockJwtDecrypt).toHaveBeenCalled();
    });

    it("should stamp the cookie userId from the access token's sub claim", async () => {
      // Cookie currently belongs to user-123, but the new access token was
      // minted for a different user — the cookie must follow the token.
      mockDecodeJwt.mockReturnValue({ sub: 'token-owner-999' });

      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'PATCH',
        body: {
          accessToken: 'new-access-token',
          refreshToken: 'new-refresh-token',
          userId: 'body-user-456',
        },
        cookies: {
          'nextspace-session': 'existing-encrypted-cookie',
        },
      });

      await handler(req, res);

      expect(res._getStatusCode()).toBe(200);
      // sub wins over both the body userId and the stale cookie userId.
      expect(mockEncryptJWT).toHaveBeenCalledWith(expect.objectContaining({ userId: 'token-owner-999' }));
    });

    it('should fall back to the body userId when the access token has no claims', async () => {
      mockDecodeJwt.mockReturnValue({}); // no sub / userId

      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'PATCH',
        body: {
          accessToken: 'opaque-access-token',
          refreshToken: 'new-refresh-token',
          userId: 'body-user-456',
        },
        cookies: {
          'nextspace-session': 'existing-encrypted-cookie',
        },
      });

      await handler(req, res);

      expect(res._getStatusCode()).toBe(200);
      expect(mockEncryptJWT).toHaveBeenCalledWith(expect.objectContaining({ userId: 'body-user-456' }));
    });

    it("should fall back to the existing cookie's userId when the token is unparseable and no body userId is sent", async () => {
      mockDecodeJwt.mockImplementation(() => {
        throw new Error('not a jwt');
      });

      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'PATCH',
        body: {
          accessToken: 'not-a-jwt',
          refreshToken: 'new-refresh-token',
        },
        cookies: {
          'nextspace-session': 'existing-encrypted-cookie',
        },
      });

      await handler(req, res);

      expect(res._getStatusCode()).toBe(200);
      // payload.userId from the mocked existing cookie is 'user-123'.
      expect(mockEncryptJWT).toHaveBeenCalledWith(expect.objectContaining({ userId: 'user-123' }));
    });

    it('should return 401 if no session cookie exists', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'PATCH',
        body: {
          accessToken: 'new-access-token',
          refreshToken: 'new-refresh-token',
        },
      });

      await handler(req, res);

      expect(res._getStatusCode()).toBe(401);
      expect(JSON.parse(res._getData())).toEqual({
        error: 'No session found',
      });
    });

    it('should return 400 if tokens are missing', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'PATCH',
        body: {
          accessToken: 'new-access-token',
          // Missing refreshToken
        },
        cookies: {
          'nextspace-session': 'existing-cookie',
        },
      });

      await handler(req, res);

      expect(res._getStatusCode()).toBe(400);
      expect(JSON.parse(res._getData())).toEqual({
        error: 'accessToken and refreshToken are required',
      });
    });

    it('should handle invalid cookie gracefully', async () => {
      // Make jwtDecrypt throw an error for invalid cookies
      mockJwtDecrypt.mockRejectedValueOnce(new Error('Invalid cookie'));

      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'PATCH',
        body: {
          accessToken: 'new-access',
          refreshToken: 'new-refresh',
        },
        cookies: {
          'nextspace-session': 'invalid-cookie-data',
        },
      });

      await handler(req, res);

      expect(res._getStatusCode()).toBe(500);
      expect(JSON.parse(res._getData())).toEqual({
        error: 'Failed to update session',
      });
    });
  });

  describe('Unsupported methods', () => {
    it('should return 405 for GET requests', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'GET',
      });

      await handler(req, res);

      expect(res._getStatusCode()).toBe(405);
      expect(JSON.parse(res._getData())).toEqual({
        error: 'Method not allowed',
      });
    });

    it('should return 405 for DELETE requests', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'DELETE',
      });

      await handler(req, res);

      expect(res._getStatusCode()).toBe(405);
      expect(JSON.parse(res._getData())).toEqual({
        error: 'Method not allowed',
      });
    });
  });
});
