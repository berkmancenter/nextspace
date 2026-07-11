import { Conversation } from '../types.internal';

export type EventState = 'missed' | 'pending' | 'live' | 'scheduled';

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
 * fixable (pending) or past the point where an edit could save them (missed).
 */
export function deriveEventState(
  conversation: Pick<Conversation, 'active' | 'draft' | 'scheduledTime'>,
  now: Date = new Date(),
): EventState {
  if (conversation.active) return 'live';
  if (!conversation.draft) return 'scheduled';
  if (!conversation.scheduledTime) return 'pending';

  const lockoutStart = new Date(conversation.scheduledTime).getTime() - EDIT_LOCKOUT_MS;
  return now.getTime() >= lockoutStart ? 'missed' : 'pending';
}
