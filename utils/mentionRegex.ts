/**
 * Shared regular expressions for @mention handling.
 *
 * Both patterns use the same core structure: `@` followed by one or more word
 * characters, optionally followed by repetitions of (one space + word chars).
 * This allows single-word handles ("@Alice") and multi-word handles
 * ("@Bob Smith", "@Charlie Brown Jr") while preventing a bare trailing space
 * from being considered part of the handle.
 */

/**
 * Matches an @mention token at the **end** of a string (anchored with `$`).
 * Used during typing to detect and replace an in-progress mention.
 *
 * Capture group 1 contains the handle text (without the `@`), or `undefined`
 * when only `@` has been typed so far.
 *
 * Examples (cursor at end):
 *   "@"           → match[0]="@",       match[1]=undefined
 *   "@Ali"        → match[0]="@Ali",    match[1]="Ali"
 *   "@Bob Sm"     → match[0]="@Bob Sm", match[1]="Bob Sm"
 *   "@Bob Smith " → no match (trailing space prevents match)
 */
export const MENTION_TRIGGER_REGEX = /@(\w+(?:\s\w+)*)?$/;

/**
 * Matches all @mention tokens within a string (global flag).
 * Used when rendering saved messages to highlight mentions.
 *
 * Note: this regex is intentionally greedy — it has no knowledge of the
 * contributor list, so it will consume consecutive words after the `@`.
 * In practice the autocomplete always appends a trailing space after the
 * handle, so the mention ends at the next non-word character in the message.
 *
 * Examples:
 *   "Hey @Bob Smith, how are you?" → ["@Bob Smith"]  (comma stops the match)
 *   "Hello @Alice"                 → ["@Alice"]
 */
export const MENTION_DISPLAY_REGEX = /@\w+(?:\s+\w+)*/g;
