import { WhatsNewEntry } from '../types.internal';

/**
 * User-facing "What's New" entries shown in the Quick Guide panel.
 *
 * ## Adding an entry
 * When shipping any user-visible feature, add an object here:
 *
 *   {
 *     title: "Short feature name",           // shown in bold
 *     body: "One or two sentence summary.",  // shown beneath the title
 *     releasedAt: "YYYY-MM-DD",              // UTC calendar date — no timezone concerns
 *   }
 *
 * Entries are visible for 14 days from `releasedAt`, then hidden automatically.
 * Future-dated entries are hidden until that date arrives, so you can merge
 * and deploy ahead of a release without exposing the entry early.
 *
 * Keep entries concise — users read these mid-session.
 */
export const whatsNewEntries: WhatsNewEntry[] = [
  {
    title: 'Quick Guide',
    body: 'You found the new guide! This is a quick guide to all the Nextspace features and recent updates.',
    releasedAt: '2026-04-27',
  },
  {
    title: 'Resources Tab',
    body: 'Find reading recommendations and other resources surfaced during the event in the new Resources tab.',
    releasedAt: '2026-04-27',
  },
  {
    title: 'Required Reading',
    body: 'Event organizers can now assign required readings that are highlighted in the Resources tab.',
    releasedAt: '2026-05-15',
  },
  {
    title: 'Preferences',
    body: 'Customize your experience with the new Preferences panel.',
    releasedAt: '2026-05-26',
  },
];

/**
 * Returns entries released within the last `windowDays` days, excluding future-dated
 * entries, sorted newest-first.
 *
 * Comparison is purely date-based (no time component) using UTC calendar days,
 * so developers can enter any YYYY-MM-DD date without worrying about timezones.
 */
export function getRecentEntries(windowDays = 14, entries = whatsNewEntries): WhatsNewEntry[] {
  // Use Date.now() explicitly so tests can mock it; new Date() reads the real clock.
  const todayStr = new Date(Date.now()).toISOString().slice(0, 10); // today in UTC, YYYY-MM-DD

  // Cutoff date: windowDays before today in UTC
  const cutoffDate = new Date(Date.now());
  cutoffDate.setUTCDate(cutoffDate.getUTCDate() - windowDays);
  const cutoffStr = cutoffDate.toISOString().slice(0, 10);

  // YYYY-MM-DD strings sort lexicographically in chronological order,
  // so string comparison is equivalent to date comparison here.
  return entries
    .filter((entry) => entry.releasedAt <= todayStr && entry.releasedAt >= cutoffStr)
    .sort((a, b) => b.releasedAt.localeCompare(a.releasedAt));
}
