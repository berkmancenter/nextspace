/**
 * Matomo Tag Manager Analytics Utility
 *
 * Provides helper functions for tracking events, page views, and custom dimensions
 * using Matomo Tag Manager (MTM).
 */

// Extend Window interface to include MTM
declare global {
  interface Window {
    _mtm: any[];
    _paq?: any[]; // Matomo tracker array
  }
}

// Track whether we've already warned about missing Matomo
let hasWarnedAboutMissingMatomo = false;

/**
 * Checks if analytics is enabled via environment variable
 * @returns true if analytics is enabled (default), false if explicitly disabled
 */
function isAnalyticsEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ENABLE_ANALYTICS !== "false";
}

/**
 * Checks if Matomo URL is configured
 * @returns true if URL is set, false otherwise
 */
function isMatomoUrlConfigured(): boolean {
  return (
    typeof process.env.NEXT_PUBLIC_MATOMO_URL === "string" &&
    process.env.NEXT_PUBLIC_MATOMO_URL.length > 0
  );
}

/**
 * Checks if Matomo Tag Manager is actually loaded
 * @returns true if Matomo appears to be loaded, false otherwise
 */
function isMatomoLoaded(): boolean {
  if (typeof window === "undefined") return false;

  // Check if Matomo's tracker array exists (indicates Matomo is loaded)
  // _paq is the standard Matomo tracking array
  return (
    typeof window._paq !== "undefined" ||
    (window._mtm &&
      window._mtm.length > 0 &&
      typeof window._mtm.push === "function")
  );
}

/**
 * Initializes the MTM data layer if it doesn't exist
 * Also checks if Matomo is properly loaded and warns if not
 */
function ensureMTM(): void {
  if (typeof window === "undefined") return;

  // Check if analytics is disabled
  if (!isAnalyticsEnabled()) {
    if (process.env.NODE_ENV !== "production" && !hasWarnedAboutMissingMatomo) {
      console.log(
        "[Analytics] Analytics is disabled via NEXT_PUBLIC_ENABLE_ANALYTICS environment variable. No tracking will occur."
      );
      hasWarnedAboutMissingMatomo = true;
    }
    return;
  }

  // Check if Matomo URL is not configured
  if (!isMatomoUrlConfigured()) {
    if (!hasWarnedAboutMissingMatomo) {
      hasWarnedAboutMissingMatomo = true;
      console.warn(
        "[Analytics] Warning: Analytics is enabled but NEXT_PUBLIC_MATOMO_URL environment variable is not set. " +
          "No tracking will occur. Please configure NEXT_PUBLIC_MATOMO_URL in your environment variables."
      );
    }
    return;
  }

  // Initialize data layer if it doesn't exist
  if (!window._mtm) {
    window._mtm = [];
  }

  // Check if Matomo is actually loaded and warn once if not
  if (!hasWarnedAboutMissingMatomo && !isMatomoLoaded()) {
    hasWarnedAboutMissingMatomo = true;

    if (process.env.NODE_ENV !== "production") {
      console.warn(
        "[Analytics] Warning: Matomo Tag Manager does not appear to be loaded. " +
          "Analytics events will be queued but not sent to Matomo. " +
          "The site will continue to function normally. " +
          "Please check that the Matomo script in _document.tsx is loading correctly."
      );
    }
  }
}

/**
 * Tracks a page view with optional custom data
 * @param pageName - Name of the page being viewed
 * @param customData - Additional data to track with the page view
 */
export function trackPageView(
  pageName: string,
  customData?: Record<string, any>
): void {
  ensureMTM();

  // Return early if window._mtm was not initialized (analytics disabled or URL missing)
  if (typeof window === "undefined" || !window._mtm) {
    return;
  }

  const data: Record<string, any> = {
    event: "mtm.PageView",
    pageName,
    ...customData,
  };

  window._mtm.push(data);

  if (process.env.NODE_ENV !== "production") {
    console.log("[Analytics] Page view:", data);
  }
}

/**
 * Tracks a custom event
 * @param category - Event category (e.g., 'engagement', 'interaction')
 * @param action - Event action (e.g., 'button_click', 'message_send')
 * @param name - Optional event name for additional context
 * @param value - Optional numeric value
 */
export function trackEvent(
  category: string,
  action: string,
  name?: string,
  value?: number
): void {
  ensureMTM();

  // Return early if window._mtm was not initialized (analytics disabled or URL missing)
  if (typeof window === "undefined" || !window._mtm) {
    return;
  }

  const data: Record<string, any> = {
    event: "customEvent",
    eventCategory: category,
    eventAction: action,
  };

  if (name) data.eventName = name;
  if (value !== undefined) data.eventValue = value;

  window._mtm.push(data);

  if (process.env.NODE_ENV !== "production") {
    console.log("[Analytics] Event:", data);
  }
}

/**
 * Sets a custom dimension
 * @param index - Dimension index (1-5 for visit scope, 1-20 for action scope)
 * @param name - Dimension name
 * @param value - Dimension value
 * @param scope - Dimension scope ('visit' or 'action')
 */
export function setCustomDimension(
  index: number,
  name: string,
  value: string,
  scope: "visit" | "action" = "visit"
): void {
  ensureMTM();

  // Return early if window._mtm was not initialized (analytics disabled or URL missing)
  if (typeof window === "undefined" || !window._mtm) {
    return;
  }

  window._mtm.push({
    event: "customDimension",
    dimensionId: index,
    dimensionName: name,
    dimensionValue: value,
    dimensionScope: scope,
  });

  if (process.env.NODE_ENV !== "production") {
    console.log("[Analytics] Custom dimension:", { index, name, value, scope });
  }
}

/**
 * Sets the user ID (pseudonym in this case)
 * @param userId - User identifier
 */
export function setUserId(userId: string): void {
  ensureMTM();

  // Return early if window._mtm was not initialized (analytics disabled or URL missing)
  if (typeof window === "undefined" || !window._mtm) {
    return;
  }

  window._mtm.push({
    event: "setUserId",
    userId,
  });

  if (process.env.NODE_ENV !== "production") {
    console.log("[Analytics] User ID set:", userId);
  }
}

/**
 * Tracks session start with metadata
 * @param metadata - Additional session metadata
 */
export function trackSessionStart(metadata?: Record<string, any>): void {
  const timestamp = new Date().toISOString();

  trackEvent("session", "start", undefined, undefined);

  setCustomDimension(1, "session_start_time", timestamp, "visit");

  if (metadata && typeof window !== "undefined" && window._mtm) {
    Object.entries(metadata).forEach(([key, value]) => {
      window._mtm.push({ [key]: value });
    });
  }

  if (process.env.NODE_ENV !== "production") {
    console.log("[Analytics] Session started:", timestamp, metadata);
  }
}

/**
 * Tracks session end with duration
 * @param durationSeconds - Session duration in seconds
 */
export function trackSessionEnd(durationSeconds: number): void {
  trackEvent("session", "end", undefined, durationSeconds);

  setCustomDimension(
    5,
    "session_duration",
    durationSeconds.toString(),
    "visit"
  );

  if (process.env.NODE_ENV !== "production") {
    console.log("[Analytics] Session ended:", durationSeconds, "seconds");
  }
}

/**
 * Tracks heartbeat to measure active time
 * Used to send periodic signals while user is actively using the app
 */
export function trackHeartbeat(): void {
  trackEvent("engagement", "heartbeat");
}

/**
 * Tracks page visibility change
 * @param visible - Whether the page is visible
 */
export function trackVisibilityChange(visible: boolean): void {
  trackEvent("engagement", "visibility_change", visible ? "visible" : "hidden");
}

/**
 * Tracks connection status change
 * @param status - Connection status ('connected', 'disconnected', 'error')
 */
export function trackConnectionStatus(
  status: "connected" | "disconnected" | "error"
): void {
  trackEvent("system", "connection_status", status);
}

/**
 * Helper to track feature usage with duration
 * @param feature - Feature name
 * @param action - Action performed ('open', 'close', 'use')
 * @param durationSeconds - Optional duration in seconds
 */
export function trackFeatureUsage(
  feature: string,
  action: "open" | "close" | "use",
  durationSeconds?: number
): void {
  trackEvent("feature", action, feature, durationSeconds);
}

/**
 * Tracks user location (local vs remote)
 * @param location - User location type ('local' or 'remote')
 * @param method - Detection method used ('ip', 'url', or 'default')
 */
export function trackUserLocation(
  location: "local" | "remote",
  method: "ip" | "url" | "default"
): void {
  // Track as custom dimension (index 2 for user_location)
  setCustomDimension(2, "user_location", location, "visit");

  // Also track as an event for analytics
  trackEvent("session", "location_detected", location, undefined);

  if (process.env.NODE_ENV !== "production") {
    console.log(
      `[Analytics] User location: ${location} (detected via ${method})`
    );
  }
}
