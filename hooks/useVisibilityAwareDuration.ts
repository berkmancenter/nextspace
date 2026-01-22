import { useEffect, useRef, useCallback } from "react";

/**
 * Custom hook for tracking duration with automatic pause/resume on tab visibility changes
 *
 * This hook provides visibility-aware duration tracking that automatically:
 * - Pauses the timer when the user switches tabs (page becomes hidden)
 * - Resumes the timer when the user returns (page becomes visible)
 * - Returns only the "active" time when the page was actually visible
 *
 * @returns Object with start, stop, and getActiveDuration methods
 *
 * @example
 * const duration = useVisibilityAwareDuration();
 *
 * // Start tracking
 * duration.start();
 *
 * // User scrolls, switches tabs for 5 minutes, comes back, scrolls more...
 *
 * // Get active duration (excludes the 5 minutes away)
 * const activeSeconds = duration.stop();
 */
export function useVisibilityAwareDuration() {
  const startTimeRef = useRef<number>(0);
  const accumulatedTimeRef = useRef<number>(0);
  const isRunningRef = useRef<boolean>(false);
  const isPageVisibleRef = useRef<boolean>(true);

  /**
   * Start tracking duration
   */
  const start = useCallback(() => {
    if (!isRunningRef.current) {
      isRunningRef.current = true;
      accumulatedTimeRef.current = 0;
      startTimeRef.current = Date.now();
    }
  }, []);

  /**
   * Stop tracking and return the active duration in seconds
   * @returns Active duration in seconds (excludes time when page was hidden)
   */
  const stop = useCallback((): number => {
    if (!isRunningRef.current) {
      return 0;
    }

    // Calculate final active duration
    let activeDuration = accumulatedTimeRef.current;
    if (isPageVisibleRef.current && startTimeRef.current > 0) {
      activeDuration += Math.floor((Date.now() - startTimeRef.current) / 1000);
    }

    // Reset state
    isRunningRef.current = false;
    accumulatedTimeRef.current = 0;
    startTimeRef.current = 0;

    return activeDuration;
  }, []);

  /**
   * Get the current active duration without stopping the timer
   * @returns Current active duration in seconds
   */
  const getActiveDuration = useCallback((): number => {
    if (!isRunningRef.current) {
      return 0;
    }

    let activeDuration = accumulatedTimeRef.current;
    if (isPageVisibleRef.current && startTimeRef.current > 0) {
      activeDuration += Math.floor((Date.now() - startTimeRef.current) / 1000);
    }

    return activeDuration;
  }, []);

  /**
   * Check if duration tracking is currently running
   * @returns true if tracking is active, false otherwise
   */
  const isRunning = useCallback((): boolean => {
    return isRunningRef.current;
  }, []);

  // Handle page visibility changes
  useEffect(() => {
    const handleVisibilityChange = () => {
      const isVisible = document.visibilityState === "visible";
      const wasVisible = isPageVisibleRef.current;
      isPageVisibleRef.current = isVisible;

      // Only handle visibility changes if timer is running
      if (isRunningRef.current) {
        if (!isVisible && wasVisible) {
          // Page becoming hidden - accumulate current session time
          if (startTimeRef.current > 0) {
            const sessionDuration = Math.floor(
              (Date.now() - startTimeRef.current) / 1000,
            );
            accumulatedTimeRef.current += sessionDuration;
          }
        } else if (isVisible && !wasVisible) {
          // Page becoming visible - restart timer
          startTimeRef.current = Date.now();
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  return {
    start,
    stop,
    getActiveDuration,
    isRunning,
  };
}
