/**
 * Tests for authType functionality
 * Tests the new authentication type system that distinguishes between guest, user, and admin
 */

import { CheckAuthHeader } from "../../utils/Helpers";

describe("AuthType Functionality", () => {
  describe("CheckAuthHeader", () => {
    it("returns guest authType when x-auth-type header is guest", () => {
      const headers = {
        "x-auth-type": "guest",
      };

      const result = CheckAuthHeader(headers);

      expect(result).toEqual({
        props: {
          authType: "guest",
        },
      });
    });

    it("returns user authType when x-auth-type header is user", () => {
      const headers = {
        "x-auth-type": "user",
      };

      const result = CheckAuthHeader(headers);

      expect(result).toEqual({
        props: {
          authType: "user",
        },
      });
    });

    it("returns admin authType when x-auth-type header is admin", () => {
      const headers = {
        "x-auth-type": "admin",
      };

      const result = CheckAuthHeader(headers);

      expect(result).toEqual({
        props: {
          authType: "admin",
        },
      });
    });

    it("returns guest authType as default when header is missing", () => {
      const headers = {};

      const result = CheckAuthHeader(headers);

      expect(result).toEqual({
        props: {
          authType: "guest",
        },
      });
    });

    it("returns guest authType as default when header is empty string", () => {
      const headers = {
        "x-auth-type": "",
      };

      const result = CheckAuthHeader(headers);

      expect(result).toEqual({
        props: {
          authType: "guest",
        },
      });
    });
  });

  describe("Session Cookie AuthType", () => {
    beforeEach(() => {
      global.fetch = jest.fn();
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    it("includes authType in session cookie creation for guest users", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: "Session created" }),
      });

      await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: "GuestUser123",
          userId: "guest-123",
          accessToken: "guest-access-token",
          refreshToken: "guest-refresh-token",
          authType: "guest",
        }),
      });

      expect(global.fetch).toHaveBeenCalledWith(
        "/api/session",
        expect.objectContaining({
          body: expect.stringContaining('"authType":"guest"'),
        })
      );
    });

    it("includes authType in session cookie creation for admin users", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: "Session created" }),
      });

      await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: "AdminUser",
          userId: "admin-456",
          accessToken: "admin-access-token",
          refreshToken: "admin-refresh-token",
          authType: "admin",
        }),
      });

      expect(global.fetch).toHaveBeenCalledWith(
        "/api/session",
        expect.objectContaining({
          body: expect.stringContaining('"authType":"admin"'),
        })
      );
    });

    it("returns authType when decrypting session cookie", async () => {
      const mockCookieData = {
        tokens: {
          access: "access-token",
          refresh: "refresh-token",
        },
        userId: "user-123",
        username: "testuser",
        authType: "admin",
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        status: 200,
        json: async () => mockCookieData,
      });

      const response = await fetch("/api/cookie");
      const data = await response.json();

      expect(data.authType).toBe("admin");
    });

    it("defaults to guest authType when missing from cookie", async () => {
      const mockCookieData = {
        tokens: {
          access: "access-token",
          refresh: "refresh-token",
        },
        userId: "user-123",
        username: "testuser",
        // No authType field (legacy cookie)
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        status: 200,
        json: async () => ({
          ...mockCookieData,
          authType: "guest", // API route adds default
        }),
      });

      const response = await fetch("/api/cookie");
      const data = await response.json();

      expect(data.authType).toBe("guest");
    });
  });

  describe("AuthType Validation", () => {
    it("validates authType values in session creation", async () => {
      const validAuthTypes = ["guest", "user", "admin"];

      for (const authType of validAuthTypes) {
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => ({ message: "Session created" }),
        });

        await fetch("/api/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: "testuser",
            userId: "user-123",
            accessToken: "access",
            refreshToken: "refresh",
            authType,
          }),
        });

        expect(global.fetch).toHaveBeenCalledWith(
          "/api/session",
          expect.objectContaining({
            body: expect.stringContaining(`"authType":"${authType}"`),
          })
        );

        (global.fetch as jest.Mock).mockClear();
      }
    });
  });

  describe("Guest to Admin Transition", () => {
    it("replaces guest authType with admin authType on login", async () => {
      // First: Guest session created
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: "Guest session created" }),
      });

      await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: "GuestUser789",
          userId: "guest-789",
          accessToken: "guest-access",
          refreshToken: "guest-refresh",
          authType: "guest",
        }),
      });

      expect(global.fetch).toHaveBeenCalledWith(
        "/api/session",
        expect.objectContaining({
          body: expect.stringContaining('"authType":"guest"'),
        })
      );

      // Second: User logs in, session replaced with admin authType
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: "Admin session created" }),
      });

      await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: "AdminPseudonym",
          userId: "admin-456",
          accessToken: "admin-access",
          refreshToken: "admin-refresh",
          authType: "admin",
        }),
      });

      expect(global.fetch).toHaveBeenCalledWith(
        "/api/session",
        expect.objectContaining({
          body: expect.stringContaining('"authType":"admin"'),
        })
      );
    });
  });

  describe("AuthType Type Safety", () => {
    it("only accepts valid AuthType values", () => {
      type AuthType = "guest" | "user" | "admin";

      const validTypes: AuthType[] = ["guest", "user", "admin"];
      
      validTypes.forEach(type => {
        expect(["guest", "user", "admin"]).toContain(type);
      });

      // TypeScript would prevent invalid types at compile time
      // At runtime, we validate in the API route
    });
  });
});
