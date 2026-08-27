import React from 'react';
import { getRoomInitials } from '../../utils/roomAvatarUtils';
import styles from './communityRoom.module.css';

interface PendingMessageProps {
  body: string;
  realName: string;
}

function ClockIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z" />
    </svg>
  );
}

/**
 * A message the member has sent that the server has not accepted yet. It sits
 * in the feed where the delivered message will land, so sending while offline
 * looks like sending, and swaps for the real message once it is delivered.
 */
export function PendingMessage({ body, realName }: PendingMessageProps) {
  return (
    <div className={styles.pendingRow}>
      <div
        className={styles.avatar}
        style={{ width: 32, height: 32, fontSize: 12, background: 'var(--room-you-bg)', color: 'var(--room-you-text)' }}
      >
        {getRoomInitials(realName)}
      </div>
      <div className="flex flex-col items-start flex-1">
        <div className="text-sm font-bold mb-1 text-left">
          {realName}
          <span className="text-gray-600 font-normal"> (You)</span>
        </div>
        <div className={styles.pendingBubble}>{body}</div>
        <div className={styles.pendingStatus}>
          <ClockIcon />
          <span>Waiting to send</span>
        </div>
      </div>
    </div>
  );
}
