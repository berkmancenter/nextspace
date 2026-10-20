import { useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import {
  trackPageView,
  trackVisibilityChange,
  trackSessionStart,
  trackSessionEnd,
  setCustomDimension,
  trackUserLocation,
  tagEventVisit,
  setTrackedUrl,
} from '../utils/analytics';
import { stripArtifactPasscode } from '../utils/tokenPrivacy';
import { useVisibilityAwareDuration } from './useVisibilityAwareDuration';

export interface UseAnalyticsOptions {
  pageName?: string;
  pageType?: string;
}

/*
 * Page types that represent a PARTICIPANT (audience member) viewing an event. Only these
 * tag the visit-scope conversation_id (dimension 7), so the Vibes Analyst tracked-session
 * count reflects the audience.
 *
 * This is an allowlist by design: any page type NOT listed here still records page views but
 * is never tagged with dimension 7, and so never matched by the recap's dimension7==<id>
 * segment. In particular the MODERATOR page is intentionally excluded:
 * moderators are staff, not audience, and counting their visits would muddy the
 * "big audience, few talkers" signal the tracked-session count exists to show. The
 * presentation page is left out for the same reason: a shared screen is not an audience
 * member. The conversation's artifacts page is counted because it is how audience members read what
 * the event produced; the series (topic) and preview pages have no conversation id and are never
 * tagged. To start counting another participant-facing page, add its pageType here.
 */
const PARTICIPANT_EVENT_PAGE_TYPES = ['assistant', 'backchannel', 'artifacts'];

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
 * @param options The options for configuring analytics tracking, including page name and page type.
 */
export function useAnalytics(options: UseAnalyticsOptions = {}) {
  const { pageName, pageType } = options;

  const router = useRouter();
  const pageDuration = useVisibilityAwareDuration();

  // Track page view on mount
  useEffect(() => {
    const currentPageName = pageName || router.pathname;

    /*
     * Tag the whole visit with the event's conversation id (visit-scope dimension 7) before
     * the page view fires, so every participant is counted, not only those who interact.
     * Only participant pages are tagged: moderator (and any non-participant) visits still record
     * page views but stay out of the recap's audience count on purpose. See PARTICIPANT_EVENT_PAGE_TYPES.
     */
    if (router.query.conversationId && pageType && PARTICIPANT_EVENT_PAGE_TYPES.includes(pageType)) {
      tagEventVisit(router.query.conversationId as string);
    }

    /*
     * Artifact pages carry the read passcode in `?artifactPasscode=`. Neither our page view nor Matomo's own
     * tracker (which reads document.location) may record it, so both get the URL with it stripped.
     */
    const currentPath = router.asPath ?? '';
    const safePath = stripArtifactPasscode(currentPath);
    if (safePath !== currentPath) {
      setTrackedUrl(new URL(safePath, window.location.origin).toString());
    }

    // Track page view
    trackPageView(currentPageName, {
      path: safePath,
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
        setCustomDimension(4, 'page_duration', activeDuration.toString(), 'action');
      }
    };
  }, [pageName, pageType, router.pathname, router.asPath, router.query.conversationId, pageDuration]);

  // Page visibility tracking
  useEffect(() => {
    function handleVisibilityChange() {
      const isVisible = document.visibilityState === 'visible';
      trackVisibilityChange(isVisible);
    }

    // Listen for visibility changes
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
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
      const duration = Math.floor((Date.now() - sessionStartTime.current) / 1000);
      trackSessionEnd(duration);
    }

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
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
    const locationParam = urlParams.get('location');

    // Build query string
    const queryString = locationParam ? `?location=${locationParam}` : '';

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
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[Analytics] Location detection failed:', error);
    }
    trackUserLocation('remote', 'default');
  }
}
