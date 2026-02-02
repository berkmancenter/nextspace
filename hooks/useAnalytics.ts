import { useEffect, useRef } from "react";
import { useRouter } from "next/router";
import {
  trackPageView,
  trackVisibilityChange,
  trackSessionStart,
  trackSessionEnd,
  setCustomDimension,
  trackUserLocation,
} from "../utils/analytics";
import { useVisibilityAwareDuration } from "./useVisibilityAwareDuration";

interface UseAnalyticsOptions {
  pageName?: string;
  pageType?: string;
}

/**
 * Custom hook for automatic analytics tracking
 * Handles:
 * - Page view tracking on mount
 * - Session duration tracking
 * - Page visibility tracking
 * - Cleanup on unmount
 *
 * Note: Heartbeat tracking is handled by Matomo's built-in enableHeartBeatTimer
 * feature, which should be configured in your Matomo Tag Manager container.
 */
export function useAnalytics(options: UseAnalyticsOptions = {}) {
  const { pageName, pageType } = options;

  const router = useRouter();
  const pageDuration = useVisibilityAwareDuration();

  // Track page view on mount
  useEffect(() => {
    const currentPageName = pageName || router.pathname;

    // Track page view
    trackPageView(currentPageName, {
      path: router.asPath,
      ...(router.query.conversationId && {
        conversationId: router.query.conversationId,
      }),
    });

    // Start tracking page duration (visibility-aware)
    pageDuration.start();

    // Cleanup function tracks active page duration
    return () => {
      const activeDuration = pageDuration.stop();
      if (activeDuration > 0) {
        setCustomDimension(
          4,
          "page_duration",
          activeDuration.toString(),
          "action",
        );
      }
    };
  }, [
    pageName,
    router.pathname,
    router.asPath,
    router.query.conversationId,
    pageDuration,
  ]);

  // Page visibility tracking
  useEffect(() => {
    function handleVisibilityChange() {
      const isVisible = document.visibilityState === "visible";
      trackVisibilityChange(isVisible);
    }

    // Listen for visibility changes
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  return {
    // Could expose additional utilities here if needed
  };
}

/**
 * Hook for tracking session-level analytics
 * Should be used once at the app level
 */
export function useSessionTracking() {
  const sessionStartTime = useRef<number>(Date.now());
  const hasTrackedStart = useRef<boolean>(false);
  const hasTrackedLocation = useRef<boolean>(false);

  useEffect(() => {
    // Track session start only once
    if (!hasTrackedStart.current) {
      trackSessionStart({
        startTime: new Date().toISOString(),
        userAgent: navigator.userAgent,
        screenResolution: `${window.screen.width}x${window.screen.height}`,
        viewport: `${window.innerWidth}x${window.innerHeight}`,
      });
      hasTrackedStart.current = true;

      // Detect and track user location (local vs remote)
      if (!hasTrackedLocation.current) {
        detectUserLocation();
        hasTrackedLocation.current = true;
      }
    }

    // Track session end on beforeunload
    function handleBeforeUnload() {
      const duration = Math.floor(
        (Date.now() - sessionStartTime.current) / 1000,
      );
      trackSessionEnd(duration);
    }

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, []);
}

/**
 * Detects user location (local vs remote) and tracks it
 * Uses the /api/check-location endpoint
 */
async function detectUserLocation() {
  try {
    // Get current URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const locationParam = urlParams.get("location");

    // Build query string
    const queryString = locationParam ? `?location=${locationParam}` : "";

    // Call location detection API
    const response = await fetch(`/api/check-location${queryString}`);

    if (!response.ok) {
      throw new Error(`Location API returned ${response.status}`);
    }

    const data = await response.json();

    // Track the location
    trackUserLocation(data.location, data.method);
  } catch (error) {
    // On error, default to remote (privacy-preserving)
    if (process.env.NODE_ENV !== "production") {
      console.warn("[Analytics] Location detection failed:", error);
    }
    trackUserLocation("remote", "default");
  }
}
// Track the location
