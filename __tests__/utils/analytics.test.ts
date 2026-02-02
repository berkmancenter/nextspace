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
        expect.stringContaining("Analytics is disabled"),
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
          "NEXT_PUBLIC_MATOMO_URL environment variable is not set",
        ),
      );
    });

    it("should only warn once even with multiple tracking calls", async () => {
      const { trackPageView, trackEvent } =
        await import("../../utils/analytics");

      trackPageView("test-page-1");
      trackPageView("test-page-2");
      trackEvent("test", "action", "test_event");

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
        expect.stringContaining("NEXT_PUBLIC_MATOMO_URL"),
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
          "NEXT_PUBLIC_MATOMO_URL environment variable is not set",
        ),
      );
    });
  });

  describe("trackConversationEvent", () => {
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

    it("should set conversation_id dimension and track event", async () => {
      const { trackConversationEvent } = await import("../../utils/analytics");

      trackConversationEvent(
        "conv-123",
        "assistant",
        "message_sent",
        "question",
      );

      // Check that window._paq received both the dimension and event
      expect((global.window as any)._paq.length).toBe(2);

      // First call: setCustomDimension
      expect((global.window as any)._paq[0]).toEqual([
        "setCustomDimension",
        6,
        "conv-123",
      ]);

      // Second call: trackEvent
      expect((global.window as any)._paq[1]).toEqual([
        "trackEvent",
        "assistant",
        "message_sent",
        "question",
        undefined,
      ]);
    });

    it("should track with event name", async () => {
      const { trackConversationEvent } = await import("../../utils/analytics");

      trackConversationEvent(
        "conv-456",
        "moderator",
        "metrics_clicked",
        "metrics_panel",
      );

      // Both dimension and event should be in _paq
      expect((global.window as any)._paq.length).toBe(2);
      expect((global.window as any)._paq[0]).toEqual([
        "setCustomDimension",
        6,
        "conv-456",
      ]);
      expect((global.window as any)._paq[1]).toEqual([
        "trackEvent",
        "moderator",
        "metrics_clicked",
        "metrics_panel",
        undefined,
      ]);
    });

    it("should track message_sent with 'message' for typed messages", async () => {
      const { trackConversationEvent } = await import("../../utils/analytics");

      trackConversationEvent(
        "conv-789",
        "assistant",
        "message_sent",
        "message",
      );

      // Both dimension and event should be in _paq
      expect((global.window as any)._paq.length).toBe(2);
      expect((global.window as any)._paq[0]).toEqual([
        "setCustomDimension",
        6,
        "conv-789",
      ]);
      expect((global.window as any)._paq[1]).toEqual([
        "trackEvent",
        "assistant",
        "message_sent",
        "message",
        undefined,
      ]);
    });

    it("should track message_sent with 'reaction' for prompt selections", async () => {
      const { trackConversationEvent } = await import("../../utils/analytics");

      trackConversationEvent(
        "conv-789",
        "assistant",
        "message_sent",
        "reaction",
      );

      // Both dimension and event should be in _paq
      expect((global.window as any)._paq.length).toBe(2);
      expect((global.window as any)._paq[0]).toEqual([
        "setCustomDimension",
        6,
        "conv-789",
      ]);
      expect((global.window as any)._paq[1]).toEqual([
        "trackEvent",
        "assistant",
        "message_sent",
        "reaction",
        undefined,
      ]);
    });

    it("should track rating_submitted separately from message_sent", async () => {
      const { trackConversationEvent } = await import("../../utils/analytics");

      trackConversationEvent("conv-101", "assistant", "rating_submitted", "5");

      // Both dimension and event should be in _paq
      expect((global.window as any)._paq.length).toBe(2);
      expect((global.window as any)._paq[0]).toEqual([
        "setCustomDimension",
        6,
        "conv-101",
      ]);
      expect((global.window as any)._paq[1]).toEqual([
        "trackEvent",
        "assistant",
        "rating_submitted",
        "5",
        undefined,
      ]);
    });

    it("should track feedback_sent separately from message_sent", async () => {
      const { trackConversationEvent } = await import("../../utils/analytics");

      trackConversationEvent(
        "conv-102",
        "assistant",
        "feedback_sent",
        "helpful",
      );

      // Both dimension and event should be in _paq
      expect((global.window as any)._paq.length).toBe(2);
      expect((global.window as any)._paq[0]).toEqual([
        "setCustomDimension",
        6,
        "conv-102",
      ]);
      expect((global.window as any)._paq[1]).toEqual([
        "trackEvent",
        "assistant",
        "feedback_sent",
        "helpful",
        undefined,
      ]);
    });

    it("should track command_sent for slash commands", async () => {
      const { trackConversationEvent } = await import("../../utils/analytics");

      trackConversationEvent("conv-103", "assistant", "command_sent", "mod");

      // Both dimension and event should be in _paq
      expect((global.window as any)._paq.length).toBe(2);
      expect((global.window as any)._paq[0]).toEqual([
        "setCustomDimension",
        6,
        "conv-103",
      ]);
      expect((global.window as any)._paq[1]).toEqual([
        "trackEvent",
        "assistant",
        "command_sent",
        "mod",
        undefined,
      ]);
    });

    it("should track command_sent for system commands", async () => {
      const { trackConversationEvent } = await import("../../utils/analytics");

      trackConversationEvent(
        "conv-104",
        "assistant",
        "command_sent",
        "feedback",
      );

      // Both dimension and event should be in _paq
      expect((global.window as any)._paq.length).toBe(2);
      expect((global.window as any)._paq[0]).toEqual([
        "setCustomDimension",
        6,
        "conv-104",
      ]);
      expect((global.window as any)._paq[1]).toEqual([
        "trackEvent",
        "assistant",
        "command_sent",
        "feedback",
        undefined,
      ]);
    });
  });
});
