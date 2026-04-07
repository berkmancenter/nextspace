import { WhatsNewEntry } from "../types.internal";

/**
 * User-facing "What's New" entries for the Help panel.
 * Add a new entry here when shipping a user-visible feature.
 * Entries with a future releasedAt date or older than the window are hidden automatically.
 *
 * releasedAt must be a valid ISO date string (e.g. "2026-04-01").
 * Invalid values are caught by the whatsNew entry validation test.
 */
export const whatsNewEntries: WhatsNewEntry[] = [];

/**
 * Returns entries released within the last `windowDays` days, excluding future-dated
 * entries, sorted newest-first.
 */
export function getRecentEntries(
  windowDays = 14,
  entries = whatsNewEntries
): WhatsNewEntry[] {
  const now = Date.now();
  const cutoff = now - windowDays * 24 * 60 * 60 * 1000; // e.g. 14 days ago in ms

  return entries
    .filter((entry) => {
      const ts = new Date(entry.releasedAt).getTime();
      return ts <= now && ts >= cutoff;
    })
    .sort(
      (a, b) =>
        new Date(b.releasedAt).getTime() - new Date(a.releasedAt).getTime()
    );
}
