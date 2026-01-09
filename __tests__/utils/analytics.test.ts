/**
 * Tests for analytics utility functions
 */

describe("Analytics Utility", () => {
  let consoleWarnSpy: jest.SpyInstance;
  let consoleLogSpy: jest.SpyInstance;
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset modules to ensure fresh imports
    jest.resetModules();

    // Spy on console methods
    consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation();
    consoleLogSpy = jest.spyOn(console, "log").mockImplementation();

    // Reset environment
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
    consoleLogSpy.mockRestore();
    process.env = originalEnv;
  });

  describe("when analytics is disabled", () => {
    beforeEach(() => {
      process.env.NEXT_PUBLIC_ENABLE_ANALYTICS = "false";
      // Mock window object
      global.window = {} as any;
    });

    afterEach(() => {
      delete (global as any).window;
    });

    it("should log info message about disabled analytics in development", async () => {
      // Import and use analytics functions
      const { trackPageView } = await import("../../utils/analytics");

      trackPageView("test-page");

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("Analytics is disabled")
      );
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });
  });

  describe("when analytics is enabled but URL is missing", () => {
    beforeEach(() => {
      process.env.NEXT_PUBLIC_ENABLE_ANALYTICS = "true";
      delete process.env.NEXT_PUBLIC_MATOMO_URL;
      // Mock window object
      global.window = {} as any;
    });

    afterEach(() => {
      delete (global as any).window;
    });

    it("should warn about missing MATOMO_URL", async () => {
      const { trackPageView } = await import("../../utils/analytics");

      trackPageView("test-page");

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          "NEXT_PUBLIC_MATOMO_URL environment variable is not set"
        )
      );
    });

    it("should only warn once even with multiple tracking calls", async () => {
      const { trackPageView, trackEvent } = await import(
        "../../utils/analytics"
      );

      trackPageView("test-page-1");
      trackPageView("test-page-2");
      trackEvent("test", "action");

      // Should only warn once
      expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe("when analytics is enabled with URL configured", () => {
    beforeEach(() => {
      process.env.NEXT_PUBLIC_ENABLE_ANALYTICS = "true";
      process.env.NEXT_PUBLIC_MATOMO_URL = "https://example.com/matomo.js";
      // Mock window object for browser environment
      global.window = {
        _mtm: [],
        _paq: [],
      } as any;
    });

    afterEach(() => {
      delete (global as any).window;
    });

    it("should initialize without warnings when URL is configured", async () => {
      const { trackPageView } = await import("../../utils/analytics");

      trackPageView("test-page");

      expect(consoleWarnSpy).not.toHaveBeenCalledWith(
        expect.stringContaining("NEXT_PUBLIC_MATOMO_URL")
      );
    });
  });

  describe("when analytics enabled with empty string URL", () => {
    beforeEach(() => {
      process.env.NEXT_PUBLIC_ENABLE_ANALYTICS = "true";
      process.env.NEXT_PUBLIC_MATOMO_URL = "";
      // Mock window object
      global.window = {} as any;
    });

    afterEach(() => {
      delete (global as any).window;
    });

    it("should warn about missing URL", async () => {
      const { trackPageView } = await import("../../utils/analytics");

      trackPageView("test-page");

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          "NEXT_PUBLIC_MATOMO_URL environment variable is not set"
        )
      );
    });
  });
});
