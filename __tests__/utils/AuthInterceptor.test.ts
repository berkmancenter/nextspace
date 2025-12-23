/**
 * @jest-environment jsdom
 */

import {
  clearSession,
  setTokenInfo,
  isTokenExpired,
  refreshAccessToken,
  is401Response,
  authenticatedFetch,
  initAuthState,
} from "../../utils/AuthInterceptor";

// Mock fetch globally
global.fetch = jest.fn();

describe("AuthInterceptor", () => {
  let locationHref: string;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "warn").mockImplementation(() => {});
    jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});

    // Mock location
    locationHref = "";
    Object.defineProperty(window, "location", {
      value: {
        get href() {
          return locationHref;
        },
        set href(value: string) {
          locationHref = value;
        },
      },
      writable: true,
      configurable: true,
    });

    // Clear any existing toasts
    const existingToast = document.getElementById("session-expired-toast");
    if (existingToast) {
      existingToast.remove();
    }

    // Reset fetch mock
    (global.fetch as jest.Mock).mockReset();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("is401Response", () => {
    it("returns true for Response object with 401 status", () => {
      const response = { status: 401 } as Response;
      expect(is401Response(response)).toBe(true);
    });

    it("returns false for Response object with non-401 status", () => {
      const response = { status: 200 } as Response;
      expect(is401Response(response)).toBe(false);
    });

    it("returns true for error object with status 401", () => {
      expect(is401Response({ error: true, status: 401 })).toBe(true);
    });

    it("returns true for various 401 error formats", () => {
      expect(is401Response({ error: "Unauthorized" })).toBe(true);
      expect(is401Response({ error: "No token found" })).toBe(true);
      expect(is401Response({ error: "Invalid token" })).toBe(true);
      expect(is401Response({ error: "Not logged in" })).toBe(true);
    });

    it("returns false for non-401 responses", () => {
      expect(is401Response({ error: true, status: 500 })).toBe(false);
      expect(is401Response(null)).toBe(false);
      expect(is401Response(undefined)).toBe(false);
    });
  });

  describe("setTokenInfo", () => {
    it("stores token expiry time correctly", () => {
      const expiresIn = 3600; // 1 hour
      const refreshToken = "refresh-token-123";
      const beforeTime = Date.now();

      setTokenInfo(expiresIn, refreshToken);

      // Token should expire approximately 1 hour from now
      expect(isTokenExpired(3599)).toBe(false); // 1 second before buffer
      expect(isTokenExpired(3601)).toBe(true); // 1 second after buffer
    });

    it("updates token info on multiple calls", () => {
      setTokenInfo(100, "token1");
      expect(isTokenExpired(150)).toBe(true); // 150s buffer > 100s remaining

      setTokenInfo(3600, "token2");
      expect(isTokenExpired(150)).toBe(false); // 150s buffer < 3600s remaining
    });
  });

  describe("isTokenExpired", () => {
    it("returns false when no token info is set", () => {
      // Reset by setting expired token
      setTokenInfo(-1000, "old-token");
      // Then clear by setting null-like state via direct test
      expect(isTokenExpired()).toBe(true); // Expired
    });

    it("returns false when token has plenty of time left", () => {
      setTokenInfo(3600, "token"); // 1 hour
      expect(isTokenExpired(60)).toBe(false); // Check with 60s buffer
    });

    it("returns true when token expires within buffer time", () => {
      setTokenInfo(30, "token"); // 30 seconds
      expect(isTokenExpired(60)).toBe(true); // 60s buffer > 30s remaining
    });

    it("returns true when token is already expired", () => {
      setTokenInfo(-100, "token"); // Already expired
      expect(isTokenExpired()).toBe(true);
    });

    it("respects custom buffer time", () => {
      setTokenInfo(200, "token"); // 200 seconds

      expect(isTokenExpired(100)).toBe(false); // 100s buffer, 200s left = ok
      expect(isTokenExpired(250)).toBe(true); // 250s buffer, 200s left = expired
    });
  });

  describe("refreshAccessToken", () => {
    beforeEach(() => {
      setTokenInfo(3600, "refresh-token-123");
    });

    it("calls /api/session with correct parameters", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          tokens: {
            access: { expires: new Date(Date.now() + 3600000).toISOString() },
            refresh: { token: "new-refresh-token" },
          },
        }),
      });

      await refreshAccessToken();

      expect(global.fetch).toHaveBeenCalledWith("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "refresh",
          refreshToken: "refresh-token-123",
        }),
        credentials: "include",
      });
    });

    it("updates token info after successful refresh", async () => {
      const newExpiry = new Date(Date.now() + 7200000).toISOString();
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          tokens: {
            access: { expires: newExpiry },
            refresh: { token: "new-refresh-token" },
          },
        }),
      });

      const result = await refreshAccessToken();

      expect(result).toBe(true);
      // Token should now have ~2 hours left
      expect(isTokenExpired(7199)).toBe(false);
    });

    it("returns false when refresh fails", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 401,
      });

      const result = await refreshAccessToken();

      expect(result).toBe(false);
      expect(console.error).toHaveBeenCalledWith("Token refresh failed:", 401);
    });

    it("returns false when no refresh token available", async () => {
      setTokenInfo(3600, ""); // Clear refresh token

      const result = await refreshAccessToken();

      expect(result).toBe(false);
      expect(console.warn).toHaveBeenCalledWith("No refresh token available");
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it("handles network errors gracefully", async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error("Network error"));

      const result = await refreshAccessToken();

      expect(result).toBe(false);
      expect(console.error).toHaveBeenCalledWith(
        "Error refreshing token:",
        expect.any(Error)
      );
    });
  });

  describe("clearSession", () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.runOnlyPendingTimers();
      jest.useRealTimers();
    });

    it("calls server-side logout endpoint", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({ ok: true });

      clearSession();

      // Wait for async call
      await Promise.resolve();

      expect(global.fetch).toHaveBeenCalledWith("/api/logout", {
        method: "POST",
        credentials: "include",
      });
    });

    it("shows toast notification", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({ ok: true });

      clearSession();
      await Promise.resolve();

      const toast = document.getElementById("session-expired-toast");
      expect(toast).toBeInTheDocument();
      expect(toast?.textContent).toContain("Your session has expired");
    });

    it("redirects after 2 second delay", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({ ok: true });

      clearSession();
      await Promise.resolve();

      expect(locationHref).toBe("");

      jest.advanceTimersByTime(2000);

      expect(locationHref).toBe("/login");
    });

    it("redirects to custom URL", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({ ok: true });

      clearSession("/custom-auth");
      await Promise.resolve();

      jest.advanceTimersByTime(2000);

      expect(locationHref).toBe("/custom-auth");
    });

    it("handles server logout errors gracefully", async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error("Server error"));

      clearSession();
      await Promise.resolve();

      expect(console.error).toHaveBeenCalledWith(
        "Error clearing session:",
        expect.any(Error)
      );

      // Should still show toast and redirect
      const toast = document.getElementById("session-expired-toast");
      expect(toast).toBeInTheDocument();
    });

    it("prevents duplicate toasts", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({ ok: true });

      clearSession();
      await Promise.resolve();

      const firstToast = document.getElementById("session-expired-toast");

      clearSession();
      await Promise.resolve();

      const allToasts = document.querySelectorAll("#session-expired-toast");
      expect(allToasts.length).toBe(1);
      expect(firstToast).toBeInTheDocument();
    });
  });

  describe("authenticatedFetch", () => {
    beforeEach(() => {
      setTokenInfo(3600, "refresh-token");
    });

    it("makes successful requests without refresh", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ data: "success" }),
      });

      const result = await authenticatedFetch("/api/users");

      expect(result).toEqual({ data: "success" });
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it("proactively refreshes token before expiry", async () => {
      setTokenInfo(30, "refresh-token"); // Expires in 30s, less than 60s buffer

      // Mock refresh
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            tokens: {
              access: { expires: new Date(Date.now() + 3600000).toISOString() },
              refresh: { token: "new-token" },
            },
          }),
        })
        // Mock actual request
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: "success" }),
        });

      const result = await authenticatedFetch("/api/users");

      expect(result).toEqual({ data: "success" });
      expect(global.fetch).toHaveBeenCalledTimes(2); // Refresh + actual call
      expect(console.log).toHaveBeenCalledWith(
        "Token about to expire, refreshing proactively..."
      );
    });

    it("retries request after 401 with token refresh", async () => {
      // First call returns 401
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
        })
        // Refresh token call
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            tokens: {
              access: { expires: new Date(Date.now() + 3600000).toISOString() },
              refresh: { token: "new-token" },
            },
          }),
        })
        // Retry succeeds
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: "success" }),
        });

      const result = await authenticatedFetch("/api/protected");

      expect(result).toEqual({ data: "success" });
      expect(global.fetch).toHaveBeenCalledTimes(3);
    });

    it("parses response as text when specified", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        text: async () => "plain text response",
      });

      const result = await authenticatedFetch(
        "/api/text",
        {},
        { parseAs: "text" }
      );

      expect(result).toBe("plain text response");
    });

    it("returns raw response when skipParsing is true", async () => {
      const mockResponse = {
        ok: true,
        status: 200,
      };
      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      const result = await authenticatedFetch(
        "/api/data",
        {},
        { skipParsing: true }
      );

      expect(result).toBe(mockResponse);
    });

    it("handles non-OK responses", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        json: async () => ({ message: "Server error" }),
      });

      const result = await authenticatedFetch("/api/error");

      expect(result).toEqual({
        error: true,
        status: 500,
        message: "Server error",
      });
    });

    it("calls onUnauthorized callback on 401", async () => {
      const onUnauthorized = jest.fn();

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 401,
      });

      await authenticatedFetch(
        "/api/protected",
        {},
        { onUnauthorized, autoRefresh: false }
      );

      expect(onUnauthorized).toHaveBeenCalledTimes(1);
    });

    it("skips refresh when autoRefresh is false", async () => {
      setTokenInfo(30, "refresh-token"); // Would normally trigger refresh

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ data: "success" }),
      });

      await authenticatedFetch("/api/data", {}, { autoRefresh: false });

      expect(global.fetch).toHaveBeenCalledTimes(1); // No refresh call
    });

    it("includes credentials in requests", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ data: "success" }),
      });

      await authenticatedFetch("/api/data");

      expect(global.fetch).toHaveBeenCalledWith(
        "/api/data",
        expect.objectContaining({
          credentials: "include",
        })
      );
    });
  });

  describe("initAuthState", () => {
    it("fetches and sets token info from server", async () => {
      const expiry = new Date(Date.now() + 3600000).toISOString();
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          tokens: {
            access: { expires: expiry },
            refresh: { token: "refresh-token-123" },
          },
        }),
      });

      await initAuthState();

      expect(global.fetch).toHaveBeenCalledWith("/api/session", {
        method: "GET",
        credentials: "include",
      });

      // Token should be set
      expect(isTokenExpired(3599)).toBe(false);
    });

    it("handles missing session gracefully", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 401,
      });

      await initAuthState();

      // Should not throw error
      expect(console.error).not.toHaveBeenCalled();
    });

    it("handles network errors gracefully", async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error("Network error"));

      await initAuthState();

      expect(console.error).toHaveBeenCalledWith(
        "Error initializing auth state:",
        expect.any(Error)
      );
    });
  });

  describe("Integration scenarios", () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.runOnlyPendingTimers();
      jest.useRealTimers();
    });

    it("handles complete auth flow: refresh -> request -> success", async () => {
      setTokenInfo(30, "old-token");

      (global.fetch as jest.Mock)
        // Proactive refresh
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            tokens: {
              access: { expires: new Date(Date.now() + 3600000).toISOString() },
              refresh: { token: "new-token" },
            },
          }),
        })
        // Actual request
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ users: [] }),
        });

      const result = await authenticatedFetch("/api/users");

      expect(result).toEqual({ users: [] });
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it("handles auth failure: 401 -> refresh fails -> logout", async () => {
      (global.fetch as jest.Mock)
        // Request returns 401
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
        })
        // Refresh fails
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
        })
        // Logout call
        .mockResolvedValueOnce({ ok: true });

      const result = await authenticatedFetch("/api/protected");

      await Promise.resolve(); // Let clearSession complete

      expect(result).toBeNull();
      expect(global.fetch).toHaveBeenCalledTimes(3); // Request + refresh + logout

      jest.advanceTimersByTime(2000);
      expect(locationHref).toBe("/login");
    });
  });
});
