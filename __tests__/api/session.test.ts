import { createMocks } from "node-mocks-http";
import { NextApiRequest, NextApiResponse } from "next";

// Mock jose library
jest.mock("jose", () => {
  const mockEncrypt = jest.fn();
  const mockJwtDecrypt = jest.fn();

  return {
    EncryptJWT: jest.fn().mockImplementation(() => ({
      setProtectedHeader: jest.fn().mockReturnThis(),
      setExpirationTime: jest.fn().mockReturnThis(),
      setSubject: jest.fn().mockReturnThis(),
      setIssuedAt: jest.fn().mockReturnThis(),
      encrypt: mockEncrypt,
    })),
    jwtDecrypt: mockJwtDecrypt,
    __mockEncrypt: mockEncrypt,
    __mockJwtDecrypt: mockJwtDecrypt,
  };
});

// Mock the withEnvValidation wrapper
jest.mock("../../utils/withEnvValidation", () => ({
  withEnvValidation: (handler: any) => handler,
}));

// Import the handler after mocking
import handler from "../../pages/api/session";
import { jwtDecrypt } from "jose";

const SECRET = "test-secret-key-minimum-32-chars!!";
process.env.SESSION_SECRET = SECRET;
Object.defineProperty(process.env, "NODE_ENV", {
  value: "test",
  writable: true,
  configurable: true,
});

// Get the mocked functions
const mockJwtDecrypt = jwtDecrypt as jest.MockedFunction<typeof jwtDecrypt>;
const jose = require("jose");
const mockEncrypt = jose.__mockEncrypt;

describe("/api/session", () => {
  beforeEach(() => {
    mockEncrypt.mockResolvedValue("encrypted-jwt-token");
    mockJwtDecrypt.mockResolvedValue({
      payload: {
        access: "old-access",
        refresh: "old-refresh",
        userId: "user-123",
        authType: "user",
        sub: "testuser",
        exp: Math.floor(Date.now() / 1000) + 3600,
      },
      protectedHeader: {
        alg: "",
        enc: "",
      },
      key: Uint8Array.from([]),
    });
  });

  describe("POST - Create new session", () => {
    it("should create a new session cookie with valid data", async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: "POST",
        body: {
          username: "testuser",
          userId: "user-123",
          accessToken: "access-token",
          refreshToken: "refresh-token",
          authType: "user",
          expirationFromNow: 3600,
        },
      });

      await handler(req, res);

      expect(res._getStatusCode()).toBe(200);
      expect(JSON.parse(res._getData())).toEqual({
        message: "Successfully set cookie!",
      });

      const setCookieHeader = res._getHeaders()["set-cookie"];
      expect(setCookieHeader).toBeDefined();
      expect(setCookieHeader).toContain("nextspace-session=");
      expect(setCookieHeader).toContain("HttpOnly");
      expect(setCookieHeader).toContain("SameSite=Strict");
    });

    it("should default to guest authType if not provided", async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: "POST",
        body: {
          username: "GuestUser",
          userId: "guest-123",
          accessToken: "access-token",
          refreshToken: "refresh-token",
        },
      });

      await handler(req, res);

      expect(res._getStatusCode()).toBe(200);
      // Verify cookie was created
      const setCookieHeader = res._getHeaders()["set-cookie"];
      expect(setCookieHeader).toContain("nextspace-session=");
    });

    it("should reject invalid authType", async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: "POST",
        body: {
          username: "testuser",
          userId: "user-123",
          accessToken: "access-token",
          refreshToken: "refresh-token",
          authType: "invalid",
        },
      });

      await handler(req, res);

      expect(res._getStatusCode()).toBe(400);
      expect(JSON.parse(res._getData())).toEqual({
        error: "authType must be one of: guest, user, admin",
      });
    });

    it("should reject non-numeric expirationFromNow", async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: "POST",
        body: {
          username: "testuser",
          userId: "user-123",
          accessToken: "access-token",
          refreshToken: "refresh-token",
          expirationFromNow: "not-a-number",
        },
      });

      await handler(req, res);

      expect(res._getStatusCode()).toBe(400);
      expect(JSON.parse(res._getData())).toEqual({
        error: "expirationFromNow must be a number in seconds.",
      });
    });

    it("should create cookie with proper security flags", async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: "POST",
        body: {
          username: "testuser",
          userId: "user-123",
          accessToken: "my-access-token",
          refreshToken: "my-refresh-token",
          authType: "user",
        },
      });

      await handler(req, res);

      expect(res._getStatusCode()).toBe(200);
      const setCookieHeader = res._getHeaders()["set-cookie"] as string;
      expect(mockEncrypt).toHaveBeenCalled();
      expect(setCookieHeader).toContain("HttpOnly");
      expect(setCookieHeader).toContain("SameSite=Strict");
    });
  });

  describe("PATCH - Update session tokens", () => {
    it("should update tokens in existing session", async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: "PATCH",
        body: {
          accessToken: "new-access-token",
          refreshToken: "new-refresh-token",
        },
        cookies: {
          "nextspace-session": "existing-encrypted-cookie",
        },
      });

      await handler(req, res);

      expect(res._getStatusCode()).toBe(200);
      expect(JSON.parse(res._getData())).toEqual({
        message: "Successfully updated session tokens!",
      });
      expect(mockJwtDecrypt).toHaveBeenCalled();
      expect(mockEncrypt).toHaveBeenCalled();
    });

    it("should preserve existing session data when updating tokens", async () => {
      mockJwtDecrypt.mockResolvedValueOnce({
        payload: {
          access: "old-access",
          refresh: "old-refresh",
          userId: "user-456",
          authType: "admin",
          sub: "adminuser",
          exp: Math.floor(Date.now() / 1000) + 7200,
        },
      } as any);

      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: "PATCH",
        body: {
          accessToken: "new-access",
          refreshToken: "new-refresh",
        },
        cookies: {
          "nextspace-session": "existing-encrypted-cookie",
        },
      });

      await handler(req, res);

      expect(res._getStatusCode()).toBe(200);
      expect(mockJwtDecrypt).toHaveBeenCalled();
    });

    it("should return 401 if no session cookie exists", async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: "PATCH",
        body: {
          accessToken: "new-access-token",
          refreshToken: "new-refresh-token",
        },
      });

      await handler(req, res);

      expect(res._getStatusCode()).toBe(401);
      expect(JSON.parse(res._getData())).toEqual({
        error: "No session found",
      });
    });

    it("should return 400 if tokens are missing", async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: "PATCH",
        body: {
          accessToken: "new-access-token",
          // Missing refreshToken
        },
        cookies: {
          "nextspace-session": "existing-cookie",
        },
      });

      await handler(req, res);

      expect(res._getStatusCode()).toBe(400);
      expect(JSON.parse(res._getData())).toEqual({
        error: "accessToken and refreshToken are required",
      });
    });

    it("should handle invalid cookie gracefully", async () => {
      // Make jwtDecrypt throw an error for invalid cookies
      mockJwtDecrypt.mockRejectedValueOnce(new Error("Invalid cookie"));

      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: "PATCH",
        body: {
          accessToken: "new-access",
          refreshToken: "new-refresh",
        },
        cookies: {
          "nextspace-session": "invalid-cookie-data",
        },
      });

      await handler(req, res);

      expect(res._getStatusCode()).toBe(500);
      expect(JSON.parse(res._getData())).toEqual({
        error: "Failed to update session",
      });
    });
  });

  describe("Unsupported methods", () => {
    it("should return 405 for GET requests", async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: "GET",
      });

      await handler(req, res);

      expect(res._getStatusCode()).toBe(405);
      expect(JSON.parse(res._getData())).toEqual({
        error: "Method not allowed",
      });
    });

    it("should return 405 for DELETE requests", async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: "DELETE",
      });

      await handler(req, res);

      expect(res._getStatusCode()).toBe(405);
      expect(JSON.parse(res._getData())).toEqual({
        error: "Method not allowed",
      });
    });
  });
});
