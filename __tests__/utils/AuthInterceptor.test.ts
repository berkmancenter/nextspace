/**
 * @jest-environment jsdom
 */

import {
  handle401Response,
  is401Response,
  fetchWith401Handler,
  apiCallWith401Handler,
  fetchWithAuth,
} from "../../utils/AuthInterceptor";

// Polyfill Response for jsdom
if (typeof global.Response === "undefined") {
  global.Response = class Response {
    status: number;
    constructor(body: any, init?: { status?: number }) {
      this.status = init?.status || 200;
    }
  } as any;
}

describe("AuthInterceptor", () => {
  let locationHref: string;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "warn").mockImplementation(() => {});

    // Simple location href mock
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
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("is401Response", () => {
    it("returns true for Response object with 401 status", () => {
      const response = new Response(null, { status: 401 });
      expect(is401Response(response)).toBe(true);
    });

    it("returns false for Response object with non-401 status", () => {
      const response = new Response(null, { status: 200 });
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
      expect(is401Response("string")).toBe(false);
      expect(is401Response(401)).toBe(false);
    });
  });

  describe("handle401Response", () => {
    beforeEach(() => {
      // Clear any existing toasts
      const existingToast = document.getElementById("session-expired-toast");
      if (existingToast) {
        existingToast.remove();
      }
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.runOnlyPendingTimers();
      jest.useRealTimers();
    });

    it("shows toast notification before redirecting", () => {
      handle401Response();

      // Toast should be created immediately
      const toast = document.getElementById("session-expired-toast");
      expect(toast).not.toBeNull();
      expect(toast).toBeInTheDocument();
    });

    it("toast has proper ARIA attributes for accessibility", () => {
      handle401Response();

      const toast = document.getElementById("session-expired-toast");
      expect(toast?.getAttribute("role")).toBe("alert");
      expect(toast?.getAttribute("aria-live")).toBe("assertive");
      expect(toast?.getAttribute("aria-atomic")).toBe("true");
    });

    it("toast displays session expired message", () => {
      handle401Response();

      const toast = document.getElementById("session-expired-toast");
      expect(toast?.textContent).toContain(
        "Your session has expired. Redirecting to login..."
      );
    });

    it("toast includes warning icon", () => {
      handle401Response();

      const toast = document.getElementById("session-expired-toast");
      const svg = toast?.querySelector("svg");
      expect(svg).not.toBeNull();
      expect(svg?.getAttribute("aria-hidden")).toBe("true");
    });

    it("redirects to /login after 2 second delay", () => {
      handle401Response();

      // Should not redirect immediately
      expect(locationHref).toBe("");

      // Fast-forward time by 2 seconds
      jest.advanceTimersByTime(2000);

      // Now should redirect
      expect(locationHref).toBe("/login");
    });

    it("redirects to custom URL after delay", () => {
      handle401Response("/custom-auth");

      expect(locationHref).toBe("");

      jest.advanceTimersByTime(2000);

      expect(locationHref).toBe("/custom-auth");
    });

    it("removes toast after 3 seconds", () => {
      handle401Response();

      const toast = document.getElementById("session-expired-toast");
      expect(toast).toBeInTheDocument();

      // Fast-forward past removal time
      jest.advanceTimersByTime(3000);

      // Toast should be removed
      const toastAfter = document.getElementById("session-expired-toast");
      expect(toastAfter).toBeNull();
    });

    it("clears session cookie", () => {
      // Set a cookie first so we can verify it gets cleared
      document.cookie = "nextspace-session=test-value; path=/";

      handle401Response();

      // Verify the cookie was set to expire (empty value or expired)
      const cookies = document.cookie;
      // In jsdom, expired cookies may be removed or set to empty
      expect(
        cookies === "" || !cookies.includes("nextspace-session=test-value")
      ).toBe(true);
    });

    it("handles multiple calls gracefully", () => {
      handle401Response();
      const firstToast = document.getElementById("session-expired-toast");

      handle401Response();
      const secondToast = document.getElementById("session-expired-toast");

      // Both should exist (second doesn't replace first)
      expect(firstToast).toBeInTheDocument();
      expect(secondToast).toBeInTheDocument();
    });

    it("toast styling matches MUI theme structure", () => {
      handle401Response();

      const toast = document.getElementById("session-expired-toast");
      const toastDiv = toast?.querySelector("div");

      // Check for MUI-style properties in inline styles
      const style = toastDiv?.getAttribute("style");
      expect(style).toContain("position: fixed");
      expect(style).toContain("bottom: 24px");
      expect(style).toContain("box-shadow");
      expect(style).toContain("border-radius: 4px");
      expect(style).toContain("z-index: 9999");
    });

    it("toast uses Inter Variable font family", () => {
      handle401Response();

      const toast = document.getElementById("session-expired-toast");
      const toastDiv = toast?.querySelector("div");
      const style = toastDiv?.getAttribute("style");

      expect(style).toContain("Inter Variable");
    });

    it("includes animation with reduced motion support", () => {
      handle401Response();

      const toast = document.getElementById("session-expired-toast");
      const style = toast?.querySelector("style");

      expect(style?.textContent).toContain("@keyframes slideIn");
      expect(style?.textContent).toContain(
        "@media (prefers-reduced-motion: reduce)"
      );
    });
  });

  describe("fetchWith401Handler", () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.runOnlyPendingTimers();
      jest.useRealTimers();
    });

    it("returns response for successful requests", async () => {
      const mockResponse = new Response(JSON.stringify({ data: "test" }), {
        status: 200,
      });
      const result = await fetchWith401Handler(Promise.resolve(mockResponse));
      expect(result).toBe(mockResponse);
      expect(locationHref).toBe("");
    });

    it("handles 401 response with auto-redirect enabled", async () => {
      const mockResponse = new Response(null, { status: 401 });
      const result = await fetchWith401Handler(Promise.resolve(mockResponse));
      expect(result.status).toBe(401);

      // Advance timers for redirect delay
      jest.advanceTimersByTime(2000);
      expect(locationHref).toBe("/login");
    });

    it("handles 401 response without auto-redirect", async () => {
      const mockResponse = new Response(null, { status: 401 });
      const result = await fetchWith401Handler(Promise.resolve(mockResponse), {
        autoRedirect: false,
      });
      expect(result.status).toBe(401);
      expect(locationHref).toBe("");
    });

    it("redirects to custom URL on 401", async () => {
      const mockResponse = new Response(null, { status: 401 });
      await fetchWith401Handler(Promise.resolve(mockResponse), {
        redirectUrl: "/custom-auth",
      });

      jest.advanceTimersByTime(2000);
      expect(locationHref).toBe("/custom-auth");
    });

    it("calls onUnauthorized callback on 401", async () => {
      const onUnauthorized = jest.fn();
      const mockResponse = new Response(null, { status: 401 });
      await fetchWith401Handler(Promise.resolve(mockResponse), {
        onUnauthorized,
        autoRedirect: false,
      });
      expect(onUnauthorized).toHaveBeenCalledTimes(1);
    });

    it("logs warning on 401", async () => {
      const consoleWarnSpy = jest.spyOn(console, "warn");
      const mockResponse = new Response(null, { status: 401 });
      await fetchWith401Handler(Promise.resolve(mockResponse), {
        autoRedirect: false,
      });
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        "401 Unauthorized response detected"
      );
    });

    it("propagates fetch errors", async () => {
      const error = new Error("Network error");
      await expect(fetchWith401Handler(Promise.reject(error))).rejects.toThrow(
        "Network error"
      );
    });
  });

  describe("apiCallWith401Handler", () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.runOnlyPendingTimers();
      jest.useRealTimers();
    });

    it("returns data for successful API calls", async () => {
      const mockData = { result: "success" };
      const apiCall = jest.fn().mockResolvedValue(mockData);
      const result = await apiCallWith401Handler(apiCall);
      expect(result).toEqual(mockData);
      expect(apiCall).toHaveBeenCalledTimes(1);
      expect(locationHref).toBe("");
    });

    it("handles 401 response with auto-redirect", async () => {
      const apiCall = jest
        .fn()
        .mockResolvedValue({ error: "Unauthorized", status: 401 });
      const result = await apiCallWith401Handler(apiCall);
      expect(result).toBeNull();

      jest.advanceTimersByTime(2000);
      expect(locationHref).toBe("/login");
    });

    it("handles 401 response without auto-redirect", async () => {
      const mock401Response = { error: "Unauthorized", status: 401 };
      const apiCall = jest.fn().mockResolvedValue(mock401Response);
      const result = await apiCallWith401Handler(apiCall, {
        autoRedirect: false,
      });
      expect(result).toEqual(mock401Response);
      expect(locationHref).toBe("");
    });

    it("redirects to custom URL on 401", async () => {
      const apiCall = jest.fn().mockResolvedValue({ error: "Invalid token" });
      await apiCallWith401Handler(apiCall, {
        redirectUrl: "/session-expired",
      });

      jest.advanceTimersByTime(2000);
      expect(locationHref).toBe("/session-expired");
    });

    it("calls onUnauthorized callback on 401", async () => {
      const onUnauthorized = jest.fn();
      const apiCall = jest.fn().mockResolvedValue({ error: "Not logged in" });
      await apiCallWith401Handler(apiCall, {
        onUnauthorized,
        autoRedirect: false,
      });
      expect(onUnauthorized).toHaveBeenCalledTimes(1);
    });

    it("logs warning on 401 detection", async () => {
      const consoleWarnSpy = jest.spyOn(console, "warn");
      const apiCall = jest.fn().mockResolvedValue({ error: "Unauthorized" });
      await apiCallWith401Handler(apiCall, { autoRedirect: false });
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        "401 Unauthorized response detected in API call"
      );
    });

    it("propagates API errors", async () => {
      const error = new Error("API error");
      const apiCall = jest.fn().mockRejectedValue(error);
      await expect(apiCallWith401Handler(apiCall)).rejects.toThrow("API error");
    });

    it("handles various 401 error formats", async () => {
      const errorFormats = [
        { status: 401 },
        { error: "Unauthorized" },
        { error: "No token found" },
        { error: "Invalid token" },
        { error: "Not logged in" },
      ];

      for (const errorFormat of errorFormats) {
        locationHref = ""; // Reset
        const apiCall = jest.fn().mockResolvedValue(errorFormat);
        const result = await apiCallWith401Handler(apiCall);
        expect(result).toBeNull();

        jest.advanceTimersByTime(2000);
        expect(locationHref).toBe("/login");
      }
    });
  });

  describe("fetchWithAuth", () => {
    beforeEach(() => {
      global.fetch = jest.fn();
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.runOnlyPendingTimers();
      jest.useRealTimers();
    });

    it("returns response for successful requests", async () => {
      const mockResponse = new Response(JSON.stringify({ data: "test" }), {
        status: 200,
      });
      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);
      const result = await fetchWithAuth("https://api.example.com/data");
      expect(result).toBe(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        "https://api.example.com/data",
        undefined
      );
      expect(locationHref).toBe("");
    });

    it("handles 401 response and redirects", async () => {
      const mockResponse = new Response(null, { status: 401 });
      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);
      const result = await fetchWithAuth("https://api.example.com/protected");
      expect(result.status).toBe(401);

      jest.advanceTimersByTime(2000);
      expect(locationHref).toBe("/login");
    });

    it("passes through fetch options", async () => {
      const mockResponse = new Response(null, { status: 200 });
      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);
      const options: RequestInit = {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ test: "data" }),
      };
      await fetchWithAuth("https://api.example.com/data", options);
      expect(global.fetch).toHaveBeenCalledWith(
        "https://api.example.com/data",
        options
      );
    });

    it("logs warning on 401", async () => {
      const consoleWarnSpy = jest.spyOn(console, "warn");
      const mockResponse = new Response(null, { status: 401 });
      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);
      await fetchWithAuth("https://api.example.com/protected");
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        "401 Unauthorized - Session expired"
      );
    });

    it("handles non-401 errors without redirecting", async () => {
      const mockResponse = new Response(null, { status: 500 });
      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);
      const result = await fetchWithAuth("https://api.example.com/error");
      expect(result.status).toBe(500);
      expect(locationHref).toBe("");
    });

    it("propagates fetch errors", async () => {
      const error = new Error("Network error");
      (global.fetch as jest.Mock).mockRejectedValue(error);
      await expect(
        fetchWithAuth("https://api.example.com/data")
      ).rejects.toThrow("Network error");
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

    it("handles cascading 401 responses across multiple API calls", async () => {
      const apiCall1 = jest.fn().mockResolvedValue({ error: "Invalid token" });
      await apiCallWith401Handler(apiCall1);

      jest.advanceTimersByTime(2000);
      expect(locationHref).toBe("/login");

      locationHref = ""; // Reset

      const apiCall2 = jest.fn().mockResolvedValue({ error: "No token found" });
      await apiCallWith401Handler(apiCall2);

      jest.advanceTimersByTime(2000);
      expect(locationHref).toBe("/login");
    });

    it("allows custom handlers to prevent redirect", async () => {
      let customHandlerCalled = false;
      const apiCall = jest.fn().mockResolvedValue({ status: 401 });
      await apiCallWith401Handler(apiCall, {
        autoRedirect: false,
        onUnauthorized: () => {
          customHandlerCalled = true;
        },
      });
      expect(customHandlerCalled).toBe(true);
      expect(locationHref).toBe("");
    });
  });
});
