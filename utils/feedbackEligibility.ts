import { PseudonymousMessage } from "../types.internal";
import { parseMessageBody } from "./Helpers";

/**
 * Message types that should be excluded from feedback eligibility
 */
export const INELIGIBLE_MESSAGE_TYPES = [
  "intro",
  "moderator_offered",
  "moderator_submitted",
  "moderator_declined",
] as const;

/**
 * Determine which messages should show feedback UI based on:
 * 1. Message type eligibility (excludes certain types)
 * 2. Feedback frequency setting
 *
 * @param messages - Array of messages to evaluate
 * @param feedbackFrequency - How often to show feedback (1 = all, 2 = every 2nd, etc.). Defaults to 1.
 * @returns Set of message IDs that should display feedback UI
 */
export function getFeedbackEligibleMessages(
  messages: PseudonymousMessage[],
  feedbackFrequency: number = 1,
): Set<string> {
  // If frequency is 0 or negative, never show feedback
  if (feedbackFrequency <= 0) {
    return new Set<string>();
  }

  // Count eligible messages and determine which ones should show feedback
  let eligibleCount = 0;
  const messageIdsToShowFeedback = new Set<string>();

  messages.forEach((message) => {
    // Only consider assistant messages
    if (!message.fromAgent || !message.id) return;

    // Parse message body to get type
    const parsed = parseMessageBody(message.body);
    const messageType = parsed.type;

    // Skip messages with ineligible types
    if (messageType && INELIGIBLE_MESSAGE_TYPES.includes(messageType as any)) {
      return;
    }

    // This is an eligible message
    eligibleCount++;

    // Show feedback every Nth eligible message
    if (eligibleCount % feedbackFrequency === 0) {
      messageIdsToShowFeedback.add(message.id);
    }
  });

  return messageIdsToShowFeedback;
}
