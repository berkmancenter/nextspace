import React from 'react';
import { getRoomInitials } from '../../utils/roomAvatarUtils';
import styles from './communityRoom.module.css';

interface PendingMessageProps {
  body: string;
  realName: string;
  failed?: boolean;
  onRetry?: () => void;
}

function AlertIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z" />
    </svg>
  );
}

/**
 * The bubble half of an undelivered message: dashed border, muted text, and the
 * clock label. Used on its own inside a thread, where ThreadPanel already draws
 * the avatar and name around whatever the bubble renderer returns.
 */
export function PendingBubble({ body, failed = false, onRetry }: { body: string; failed?: boolean; onRetry?: () => void }) {
  return (
    <div style={{ width: '85%' }}>
      <div className={`${styles.pendingBubble}${failed ? ` ${styles.pendingBubbleFailed}` : ''}`}>{body}</div>
      <div className={`${styles.pendingStatus}${failed ? ` ${styles.pendingStatusFailed}` : ''}`}>
        {failed ? <AlertIcon /> : <ClockIcon />}
        <span>{failed ? 'Message could not be sent.' : 'Waiting to send'}</span>
        {failed && onRetry && (
          <button type="button" onClick={onRetry} className={styles.pendingRetry}>
            Try sending again
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * A message the member has sent that the server has not accepted yet. It sits
 * in the feed where the delivered message will land, so sending while offline
 * looks like sending, and swaps for the real message once it is delivered.
 */
export function PendingMessage({ body, realName, failed = false, onRetry }: PendingMessageProps) {
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
        <PendingBubble body={body} failed={failed} onRetry={onRetry} />
      </div>
    </div>
  );
}
