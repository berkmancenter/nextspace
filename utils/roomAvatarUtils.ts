/**
 * @param name The participant's real display name.
 * @returns Up to two uppercase initials, or an empty string for an empty name.
 */
export function getRoomInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

/**
 * An all-caps first word is an acronym and reads better on its own:
 * "BKC Community Room" gives "BK", not "BC".
 * @param name The room's display name.
 * @returns Up to two uppercase initials, or an empty string for an empty name.
 */
export function getRoomNameInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '';
  const first = words[0];
  if (words.length === 1 || first === first.toUpperCase()) return first.slice(0, 2).toUpperCase();
  return (first[0] + words[1][0]).toUpperCase();
}
