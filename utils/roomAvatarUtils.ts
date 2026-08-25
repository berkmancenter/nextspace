/**
 * Computes avatar initials for a real-name community room participant.
 * Two-plus-word names use the first letter of the first and last word
 * (e.g. "Priya Raghunathan" -> "PR"); a single word uses its first two
 * letters (e.g. "Berkie" -> "BE").
 * @param name The participant's real display name.
 * @returns Up to two uppercase initials, or an empty string for an empty name.
 */
export function getRoomInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}
