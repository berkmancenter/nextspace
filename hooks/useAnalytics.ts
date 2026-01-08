import { useEffect, useRef } from "react";
import { useRouter } from "next/router";
import {
  trackPageView,
  trackVisibilityChange,
  trackHeartbeat,
  trackSessionStart,
  trackSessionEnd,
  setCustomDimension,
} from "../utils/analytics";

interface UseAnalyticsOptions {
  pageName?: string;
  pageType?: string;
  enableHeartbeat?: boolean;
  heartbeatInterval?: number; // in milliseconds
}

/**
 * Custom hook for automatic analytics tracking
 * Handles:
 * - Page view tracking on mount
 * - Session duration tracking
 * - Page visibility tracking
 * - Heartbeat tracking (optional)
 * - Cleanup on unmount
 */
export function useAnalytics(options: UseAnalyticsOptions = {}) {
  const {
    pageName,
    pageType,
    enableHeartbeat = true,
    heartbeatInterval = 20000, // 20 seconds default
  } = options;

  const router = useRouter();
  const pageEntryTime = useRef<number>(Date.now());
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isPageVisible = useRef<boolean>(true);

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

    // Set page type custom dimension
    if (pageType) {
      setCustomDimension(2, "page_type", pageType, "action");
    }

    // Reset entry time
    pageEntryTime.current = Date.now();

    // Cleanup function tracks page duration
    return () => {
      const duration = Math.floor((Date.now() - pageEntryTime.current) / 1000);
      if (duration > 0) {
        setCustomDimension(4, "page_duration", duration.toString(), "action");
      }
    };
  }, [
    pageName,
    pageType,
    router.pathname,
    router.asPath,
    router.query.conversationId,
  ]);

  // Heartbeat tracking
  useEffect(() => {
    function startHeartbeat() {
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }

      heartbeatIntervalRef.current = setInterval(() => {
        if (isPageVisible.current) {
          trackHeartbeat();
        }
      }, heartbeatInterval);
    }

    const handleVisibilityChange = () => {
      const isVisible = document.visibilityState === "visible";
      isPageVisible.current = isVisible;
      trackVisibilityChange(isVisible);

      // Stop heartbeat when page is hidden
      if (!isVisible && heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }
      // Resume heartbeat when page becomes visible
      else if (isVisible && enableHeartbeat && !heartbeatIntervalRef.current) {
        startHeartbeat();
      }
    };

    // Start heartbeat if enabled
    if (enableHeartbeat) {
      startHeartbeat();
    }

    // Listen for visibility changes
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }
    };
  }, [enableHeartbeat, heartbeatInterval]);

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
    }

    // Track session end on beforeunload
    const handleBeforeUnload = () => {
      const duration = Math.floor(
        (Date.now() - sessionStartTime.current) / 1000
      );
      trackSessionEnd(duration);
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, []);
}
