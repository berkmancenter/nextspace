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
        "question"
      );

      // Check that window._mtm received two pushes: dimension + event
      expect((global.window as any)._mtm.length).toBe(2);

      // First push should be the dimension
      expect((global.window as any)._mtm[0]).toMatchObject({
        event: "customDimension",
        dimensionId: 6,
        dimensionName: "conversation_id",
        dimensionValue: "conv-123",
        dimensionScope: "action",
      });

      // Second push should be the event
      expect((global.window as any)._mtm[1]).toMatchObject({
        event: "customEvent",
        eventCategory: "assistant",
        eventAction: "message_sent",
        eventName: "question",
      });
    });

    it("should work without optional name parameter", async () => {
      const { trackConversationEvent } = await import("../../utils/analytics");

      trackConversationEvent("conv-456", "moderator", "metrics_clicked");

      expect((global.window as any)._mtm.length).toBe(2);
      expect((global.window as any)._mtm[1]).toMatchObject({
        event: "customEvent",
        eventCategory: "moderator",
        eventAction: "metrics_clicked",
      });
      expect((global.window as any)._mtm[1].eventName).toBeUndefined();
    });

    it("should track message_sent with 'message' for typed messages", async () => {
      const { trackConversationEvent } = await import("../../utils/analytics");

      trackConversationEvent(
        "conv-789",
        "assistant",
        "message_sent",
        "message"
      );

      expect((global.window as any)._mtm.length).toBe(2);
      expect((global.window as any)._mtm[1]).toMatchObject({
        event: "customEvent",
        eventCategory: "assistant",
        eventAction: "message_sent",
        eventName: "message",
      });
    });

    it("should track message_sent with 'reaction' for prompt selections", async () => {
      const { trackConversationEvent } = await import("../../utils/analytics");

      trackConversationEvent(
        "conv-789",
        "assistant",
        "message_sent",
        "reaction"
      );

      expect((global.window as any)._mtm.length).toBe(2);
      expect((global.window as any)._mtm[1]).toMatchObject({
        event: "customEvent",
        eventCategory: "assistant",
        eventAction: "message_sent",
        eventName: "reaction",
      });
    });

    it("should track rating_submitted separately from message_sent", async () => {
      const { trackConversationEvent } = await import("../../utils/analytics");

      trackConversationEvent("conv-101", "assistant", "rating_submitted", "5");

      expect((global.window as any)._mtm.length).toBe(2);
      expect((global.window as any)._mtm[1]).toMatchObject({
        event: "customEvent",
        eventCategory: "assistant",
        eventAction: "rating_submitted",
        eventName: "5",
      });
    });

    it("should track feedback_sent separately from message_sent", async () => {
      const { trackConversationEvent } = await import("../../utils/analytics");

      trackConversationEvent(
        "conv-102",
        "assistant",
        "feedback_sent",
        "helpful"
      );

      expect((global.window as any)._mtm.length).toBe(2);
      expect((global.window as any)._mtm[1]).toMatchObject({
        event: "customEvent",
        eventCategory: "assistant",
        eventAction: "feedback_sent",
        eventName: "helpful",
      });
    });
  });
});
