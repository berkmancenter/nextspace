/*
 * Per-device record of when the member last opened each community room. The server
 * tracks no read state, so the lounge has nothing else to compare a room's newest
 * message against; a member who reads on their phone still sees the dot on their
 * laptop. Every access is wrapped because a browser set to block site data throws
 * on the accessor itself rather than returning null.
 */

const STORAGE_KEY_PREFIX = 'nextspace.room.lastRead.';

/**
 * The moment the member last had this room open.
 * @param roomId The room's conversation id.
 * @returns An ISO timestamp, or null if the room has never been opened on this device.
 */
export function getRoomLastReadAt(roomId: string): string | null {
  try {
    return window.localStorage.getItem(`${STORAGE_KEY_PREFIX}${roomId}`);
  } catch {
    return null;
  }
}

/**
 * Records that the member has seen this room up to the given moment.
 * @param roomId The room's conversation id.
 * @param readAt ISO timestamp of the newest message the member has now seen.
 */
export function markRoomRead(roomId: string, readAt: string): void {
  try {
    const previous = getRoomLastReadAt(roomId);
    // A stale tab writing an older timestamp would resurrect the unread dot on
    // messages the member has already read.
    if (previous && new Date(previous) >= new Date(readAt)) return;
    window.localStorage.setItem(`${STORAGE_KEY_PREFIX}${roomId}`, readAt);
  } catch {
    // Nothing to recover: an unrecorded visit only means the dot stays on.
  }
}
