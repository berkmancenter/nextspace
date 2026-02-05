import { validateCookie, shouldClearCookie, CURRENT_COOKIE_VERSION } from "../../utils/cookieValidator";
import { JWTDecryptResult } from "jose";

describe("cookieValidator", () => {
  describe("validateCookie", () => {
    it("should validate a properly formatted cookie", () => {
      const validCookie: JWTDecryptResult = {
        payload: {
          access: "valid-access-token",
          refresh: "valid-refresh-token",
          userId: "user-123",
          authType: "guest",
          version: CURRENT_COOKIE_VERSION,
          sub: "testuser",
          exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
        },
        protectedHeader: { alg: "dir", enc: "A128CBC-HS256" },
      };

      const result = validateCookie(validCookie);
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("should reject null cookie", () => {
      const result = validateCookie(null);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe("Cookie is null or undefined");
    });

    it("should reject cookie without payload", () => {
      const invalidCookie = {
        protectedHeader: { alg: "dir", enc: "A128CBC-HS256" },
      } as any;

      const result = validateCookie(invalidCookie);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe("Cookie payload is missing");
    });

    it("should reject cookie with wrong version", () => {
      const wrongVersionCookie: JWTDecryptResult = {
        payload: {
          access: "valid-access-token",
          refresh: "valid-refresh-token",
          userId: "user-123",
          authType: "guest",
          version: "0", // Old version
          sub: "testuser",
        },
        protectedHeader: { alg: "dir", enc: "A128CBC-HS256" },
      };

      const result = validateCookie(wrongVersionCookie);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain("Cookie version mismatch");
    });

    it("should reject legacy cookie without version field", () => {
      const legacyCookie: JWTDecryptResult = {
        payload: {
          access: "valid-access-token",
          refresh: "valid-refresh-token",
          userId: "user-123",
          authType: "guest",
          // No version field - legacy cookie
          sub: "testuser",
        },
        protectedHeader: { alg: "dir", enc: "A128CBC-HS256" },
      };

      const result = validateCookie(legacyCookie);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain("Cookie version mismatch");
      expect(result.error).toContain("expected 1, got 0");
    });

    it("should reject cookie with missing access token", () => {
      const missingAccessCookie: JWTDecryptResult = {
        payload: {
          refresh: "valid-refresh-token",
          userId: "user-123",
          authType: "guest",
          version: CURRENT_COOKIE_VERSION,
          sub: "testuser",
        },
        protectedHeader: { alg: "dir", enc: "A128CBC-HS256" },
      } as any;

      const result = validateCookie(missingAccessCookie);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain("Required field 'access'");
    });

    it("should reject cookie with missing refresh token", () => {
      const missingRefreshCookie: JWTDecryptResult = {
        payload: {
          access: "valid-access-token",
          userId: "user-123",
          authType: "guest",
          version: CURRENT_COOKIE_VERSION,
          sub: "testuser",
        },
        protectedHeader: { alg: "dir", enc: "A128CBC-HS256" },
      } as any;

      const result = validateCookie(missingRefreshCookie);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain("Required field 'refresh'");
    });

    it("should reject cookie with missing userId", () => {
      const missingUserIdCookie: JWTDecryptResult = {
        payload: {
          access: "valid-access-token",
          refresh: "valid-refresh-token",
          authType: "guest",
          version: CURRENT_COOKIE_VERSION,
          sub: "testuser",
        },
        protectedHeader: { alg: "dir", enc: "A128CBC-HS256" },
      } as any;

      const result = validateCookie(missingUserIdCookie);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain("Required field 'userId'");
    });

    it("should reject cookie with missing authType", () => {
      const missingAuthTypeCookie: JWTDecryptResult = {
        payload: {
          access: "valid-access-token",
          refresh: "valid-refresh-token",
          userId: "user-123",
          version: CURRENT_COOKIE_VERSION,
          sub: "testuser",
        },
        protectedHeader: { alg: "dir", enc: "A128CBC-HS256" },
      } as any;

      const result = validateCookie(missingAuthTypeCookie);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain("Required field 'authType'");
    });

    it("should reject cookie with invalid authType", () => {
      const invalidAuthTypeCookie: JWTDecryptResult = {
        payload: {
          access: "valid-access-token",
          refresh: "valid-refresh-token",
          userId: "user-123",
          authType: "invalid-type",
          version: CURRENT_COOKIE_VERSION,
          sub: "testuser",
        },
        protectedHeader: { alg: "dir", enc: "A128CBC-HS256" },
      };

      const result = validateCookie(invalidAuthTypeCookie);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain("Invalid authType");
    });

    it("should reject cookie with empty access token", () => {
      const emptyAccessCookie: JWTDecryptResult = {
        payload: {
          access: "   ", // Just whitespace
          refresh: "valid-refresh-token",
          userId: "user-123",
          authType: "guest",
          version: CURRENT_COOKIE_VERSION,
          sub: "testuser",
        },
        protectedHeader: { alg: "dir", enc: "A128CBC-HS256" },
      };

      const result = validateCookie(emptyAccessCookie);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain("Access or refresh token is empty");
    });

    it("should reject cookie with empty userId", () => {
      const emptyUserIdCookie: JWTDecryptResult = {
        payload: {
          access: "valid-access-token",
          refresh: "valid-refresh-token",
          userId: "  ",
          authType: "guest",
          version: CURRENT_COOKIE_VERSION,
          sub: "testuser",
        },
        protectedHeader: { alg: "dir", enc: "A128CBC-HS256" },
      };

      const result = validateCookie(emptyUserIdCookie);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain("UserId is empty");
    });

    it("should reject expired cookie", () => {
      const expiredCookie: JWTDecryptResult = {
        payload: {
          access: "valid-access-token",
          refresh: "valid-refresh-token",
          userId: "user-123",
          authType: "guest",
          version: CURRENT_COOKIE_VERSION,
          sub: "testuser",
          exp: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
        },
        protectedHeader: { alg: "dir", enc: "A128CBC-HS256" },
      };

      const result = validateCookie(expiredCookie);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe("Cookie has expired");
    });

    it("should validate cookie with admin authType", () => {
      const adminCookie: JWTDecryptResult = {
        payload: {
          access: "valid-access-token",
          refresh: "valid-refresh-token",
          userId: "admin-123",
          authType: "admin",
          version: CURRENT_COOKIE_VERSION,
          sub: "adminuser",
        },
        protectedHeader: { alg: "dir", enc: "A128CBC-HS256" },
      };

      const result = validateCookie(adminCookie);
      expect(result.isValid).toBe(true);
    });

    it("should validate cookie with user authType", () => {
      const userCookie: JWTDecryptResult = {
        payload: {
          access: "valid-access-token",
          refresh: "valid-refresh-token",
          userId: "user-123",
          authType: "user",
          version: CURRENT_COOKIE_VERSION,
          sub: "regularuser",
        },
        protectedHeader: { alg: "dir", enc: "A128CBC-HS256" },
      };

      const result = validateCookie(userCookie);
      expect(result.isValid).toBe(true);
    });

    it("should reject cookie with non-string field types", () => {
      const wrongTypeCookie: JWTDecryptResult = {
        payload: {
          access: 12345, // Should be string
          refresh: "valid-refresh-token",
          userId: "user-123",
          authType: "guest",
          version: CURRENT_COOKIE_VERSION,
        },
        protectedHeader: { alg: "dir", enc: "A128CBC-HS256" },
      } as any;

      const result = validateCookie(wrongTypeCookie);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain("must be a string");
    });
  });

  describe("shouldClearCookie", () => {
    it("should return true for invalid cookies", () => {
      const invalidCookie: JWTDecryptResult = {
        payload: {
          access: "valid-access-token",
          // Missing required fields
        },
        protectedHeader: { alg: "dir", enc: "A128CBC-HS256" },
      } as any;

      expect(shouldClearCookie(invalidCookie)).toBe(true);
    });

    it("should return false for valid cookies", () => {
      const validCookie: JWTDecryptResult = {
        payload: {
          access: "valid-access-token",
          refresh: "valid-refresh-token",
          userId: "user-123",
          authType: "guest",
          version: CURRENT_COOKIE_VERSION,
          sub: "testuser",
        },
        protectedHeader: { alg: "dir", enc: "A128CBC-HS256" },
      };

      expect(shouldClearCookie(validCookie)).toBe(false);
    });

    it("should return true for null cookie", () => {
      expect(shouldClearCookie(null)).toBe(true);
    });
  });
});
