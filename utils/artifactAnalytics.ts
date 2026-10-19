import { trackConversationEvent, trackEvent } from './analytics';

/**
 * Tracks an event from the artifact pages. A conversation's artifacts carry the conversation
 * id on custom dimension 6, like every other event on the site; a series (topic) has no single
 * conversation, so its events go out without one rather than with a made-up attribution.
 *
 * Never pass a passcode, free text or anything else a reader typed as `name`.
 * @param conversationId - The conversation the artifact belongs to, or undefined for a series or fixture page
 * @param category - Event category ('graph' or 'artifact')
 * @param action - Event action
 * @param name - Event name for additional context
 * @param value - Optional numeric value
 */
export function trackArtifactEvent(
  conversationId: string | undefined,
  category: string,
  action: string,
  name: string,
  value?: number,
): void {
  if (conversationId) {
    trackConversationEvent(conversationId, category, action, name, value);
  } else {
    trackEvent(category, action, name, value);
  }
}
