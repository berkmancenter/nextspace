/*
 * Per-browser record of the newest jargon batch each person has cleared, so the banner
 * stays gone after a refresh. The server stores no read state, so a phone and a laptop
 * each track this on their own. Every access is wrapped because a browser set to block
 * site data throws on the accessor itself rather than returning null.
 */

const STORAGE_KEY_PREFIX = 'nextspace.jargon.lastSeen.';

/**
 * The creation time of the newest jargon message the person has cleared for this event.
 * @param conversationId The event's conversation id.
 * @returns An ISO timestamp, or null if nothing has been cleared on this browser.
 */
export function getJargonLastSeenAt(conversationId: string): string | null {
  try {
    return window.localStorage.getItem(`${STORAGE_KEY_PREFIX}${conversationId}`);
  } catch {
    return null;
  }
}

/**
 * Records that the person has cleared every jargon batch up to the given moment.
 * @param conversationId The event's conversation id.
 * @param seenAt ISO creation time of the newest jargon message they cleared.
 */
export function markJargonSeen(conversationId: string, seenAt: string): void {
  try {
    const previous = getJargonLastSeenAt(conversationId);
    // A stale tab writing an older time would bring back a banner the person already cleared.
    if (previous && new Date(previous) >= new Date(seenAt)) return;
    window.localStorage.setItem(`${STORAGE_KEY_PREFIX}${conversationId}`, seenAt);
  } catch {
    // Nothing to recover: an unrecorded clear only means the banner comes back on refresh.
  }
}
