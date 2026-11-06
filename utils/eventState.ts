import { Conversation } from '../types.internal';

export type EventState = 'missed' | 'pending' | 'live' | 'scheduled' | 'past';

/**
 * Whether a meeting URL is a valid Zoom link. Mirrors llm_engine's `isZoomUrl`, used by
 * `isConversationDraft` (conversation.service/lifecycle.ts): a scheduled conversation stays in
 * `draft` and can't auto-start until its `zoomMeetingUrl` passes this exact check. The frontend
 * uses the same rule so a placeholder like "https://example.com" reads as needs-review rather than
 * a connected meeting link. Host must be `zoom.us` or a `*.zoom.us` subdomain.
 */
export function isValidZoomUrl(url: unknown): boolean {
  if (typeof url !== 'string' || !url) return false;
  try {
    const { hostname } = new URL(url);
    return hostname === 'zoom.us' || hostname.endsWith('.zoom.us');
  } catch {
    return false;
  }
}

/**
 * How close to its scheduledTime a Draft conversation can get before it's locked out of
 * further edits. Matches llm_engine's conversation.service updateConversation lockout, kept
 * in sync so the frontend never shows an event as fixable after the backend would reject the edit.
 */
export const EDIT_LOCKOUT_MS = 6 * 60 * 1000;

/**
 * Derives the event lifecycle state shown on the event view page. A conversation is
 * confirmed once the backend clears its `draft` flag (all required fields filled in);
 * confirmed events are either live or scheduled, unconfirmed ones are either still
 * fixable (pending) or past the point where an edit could save them (missed). The backend
 * stamps `endTime` when an event ends, which outranks every confirmed state below.
 */
export function deriveEventState(
  conversation: Pick<Conversation, 'active' | 'draft' | 'scheduledTime' | 'endTime'>,
  now: Date = new Date(),
): EventState {
  if (conversation.active) return 'live';
  if (conversation.endTime) return 'past';
  if (!conversation.draft) return 'scheduled';
  if (!conversation.scheduledTime) return 'pending';

  const lockoutStart = new Date(conversation.scheduledTime).getTime() - EDIT_LOCKOUT_MS;
  return now.getTime() >= lockoutStart ? 'missed' : 'pending';
}

/**
 * Whether `now` falls in the pre-event window the backend opens `preEventMinutes` before
 * `scheduledTime` (conversation.service's scheduleConversationPreEventWindow). The conversation
 * stays inactive throughout, but per-message-responsive agents are already awake and will answer,
 * so the assistant page uses this to allow chatting before the event's official active start.
 * A draft conversation never gets its agents woken (the backend's openConversationWindow job
 * skips drafts), so this returns false for one even if the time window would otherwise be open.
 */
export function isInPreEventWindow(
  conversation: Pick<Conversation, 'active' | 'draft' | 'scheduledTime' | 'preEventMinutes'>,
  now: Date = new Date(),
): boolean {
  if (conversation.active || conversation.draft) return false;
  if (!conversation.scheduledTime || typeof conversation.preEventMinutes !== 'number') return false;

  const scheduledTime = new Date(conversation.scheduledTime).getTime();
  const windowStart = scheduledTime - conversation.preEventMinutes * 60 * 1000;
  return now.getTime() >= windowStart && now.getTime() < scheduledTime;
}

/**
 * Whether an event can still be edited from the admin events list: not live, not already
 * started, and not in its pre-event window (which the backend already treats as effectively
 * live) — plus having a known conversation type to edit against.
 */
export function isEventEditable(
  conversation: Pick<Conversation, 'active' | 'startTime' | 'scheduledTime' | 'preEventMinutes' | 'draft' | 'type'>,
  now: Date = new Date(),
): boolean {
  return (
    !conversation.active && !conversation.startTime && !isInPreEventWindow(conversation, now) && !!conversation.type?.name
  );
}

// The backend auto-starts a conversation via a job that polls every 10 seconds, so scheduledTime
// can pass a few seconds before startTime is actually stamped. Padding the "missed" check past
// that lag keeps an about-to-start event from flashing as missed in that window.
const AUTO_START_GRACE_MS = 30 * 1000;

/**
 * Whether an unconfirmed, inactive event has fully missed its auto-start — past its scheduled
 * time by more than the backend's auto-start polling lag, with no startTime or endTime stamped.
 * Shared by the admin events page's Missed badge, status filter, and status sort, so the three
 * never disagree about whether an event counts as missed for a few seconds around that lag.
 */
export function isEventMissed(
  conversation: Pick<Conversation, 'active' | 'startTime' | 'endTime' | 'scheduledTime'>,
  now: Date = new Date(),
): boolean {
  return (
    !conversation.active &&
    !conversation.startTime &&
    !conversation.endTime &&
    (!conversation.scheduledTime || new Date(conversation.scheduledTime).getTime() + AUTO_START_GRACE_MS <= now.getTime())
  );
}
