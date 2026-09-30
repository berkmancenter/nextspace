import React from 'react';
import { HallwayRoom } from '../../types.internal';
import { getRoomNameInitials } from '../../utils/roomAvatarUtils';
import styles from './communityRoom.module.css';

interface HallwayRoomRowProps {
  room: HallwayRoom;
  onOpen: (roomId: string) => void;
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Ages a room's last activity the way a messaging list does: a clock time today,
 * "Yesterday", a weekday for the rest of the week, then a date.
 * @param iso The message timestamp, or null for a room with no messages.
 * @param now The moment to measure against, passed in so the result is testable.
 * @returns A short label, or an empty string when there is no timestamp.
 */
export function formatHallwayTimestamp(iso: string | null, now: Date = new Date()): string {
  if (!iso) return '';
  const stamp = new Date(iso);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfStampDay = new Date(stamp.getFullYear(), stamp.getMonth(), stamp.getDate()).getTime();
  const daysAgo = Math.round((startOfToday - startOfStampDay) / ONE_DAY_MS);

  if (daysAgo <= 0) return stamp.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  if (daysAgo === 1) return 'Yesterday';
  if (daysAgo < 7) return stamp.toLocaleDateString('en-GB', { weekday: 'short' });
  return stamp.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

/**
 * One room in the hallway list. The unread dot carries no count by design, so the
 * accessible name is where the unread state is actually stated.
 */
export function HallwayRoomRow({ room, onOpen }: HallwayRoomRowProps) {
  const label = room.hasUnread ? `${room.name}, unread messages` : room.name;

  return (
    <button type="button" aria-label={label} className={styles.hallwayRow} onClick={() => onOpen(room.id)}>
      <span aria-hidden="true" className={`${styles.avatar} ${styles.hallwayRowAvatar}`}>
        {getRoomNameInitials(room.name)}
      </span>
      <span className={styles.hallwayRowText}>
        <span className={styles.hallwayRowTopLine}>
          <span className={styles.hallwayRowName}>{room.name}</span>
          <span className={styles.hallwayRowStamp}>{formatHallwayTimestamp(room.lastMessageAt)}</span>
        </span>
        <span className={styles.hallwayRowPreview}>{room.preview || 'No messages yet'}</span>
      </span>
      {/* Kept in the layout when read so names and previews line up down the list. */}
      <span className={styles.hallwayUnreadSlot}>
        {room.hasUnread && <span aria-hidden="true" className={styles.hallwayUnreadDot} />}
      </span>
    </button>
  );
}
