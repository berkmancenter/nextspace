import React, { FC, useState } from 'react';
import { Menu, MenuItem } from '@mui/material';
import { ModerationReason, PseudonymousMessage } from '../types.internal';

/**
 * What the admin controls need from the room. Passed down only to an admin, so its absence is what
 * keeps the controls off everyone else's screen.
 */
export interface MessageModeration {
  /** Hides the message (with the reason the admin chose, if any), or unhides it when it is hidden. */
  onToggleHidden: (message: PseudonymousMessage, reason?: ModerationReason) => void;
  /** Hides every message from the author in this conversation, or unhides them when `unhide`. */
  onToggleHideAuthor: (message: PseudonymousMessage, unhide: boolean, reason?: ModerationReason) => void;
  /** True when every message from this message's author that the admin can see is already hidden. */
  isAuthorHidden: (message: PseudonymousMessage) => boolean;
}

interface ModerationControlsProps {
  message: PseudonymousMessage;
  moderation: MessageModeration;
}

const buttonClass =
  'rounded border border-gray-300 bg-white px-2 py-0.5 text-xs text-gray-700 hover:bg-gray-100 cursor-pointer';

const REASONS: { value: ModerationReason; label: string }[] = [
  { value: 'pii', label: 'Personal information' },
  { value: 'harassment', label: 'Harassment' },
  { value: 'off-topic', label: 'Off-topic' },
  { value: 'other', label: 'Other' },
];

/** The admin-only "Hide" / "Hide all from this user" pair, plus the "Hidden" label on a hidden message. */
export const ModerationControls: FC<ModerationControlsProps> = ({ message, moderation }) => {
  const authorHidden = moderation.isAuthorHidden(message);
  // A hide asks why first, an unhide does not. Escape or a click away cancels without hiding.
  const [picker, setPicker] = useState<{ anchor: HTMLElement; target: 'message' | 'author' } | null>(null);

  const choose = (reason?: ModerationReason) => {
    if (!picker) return;
    const { target } = picker;
    setPicker(null);
    if (target === 'message') moderation.onToggleHidden(message, reason);
    else moderation.onToggleHideAuthor(message, false, reason);
  };

  return (
    <div className="mt-1 flex flex-wrap items-center gap-2">
      {message.hidden && (
        <span className="rounded bg-gray-300 px-1.5 py-0.5 text-xs font-semibold text-gray-700">Hidden</span>
      )}
      <button
        type="button"
        className={buttonClass}
        aria-haspopup={message.hidden ? undefined : 'menu'}
        onClick={(e) =>
          message.hidden ? moderation.onToggleHidden(message) : setPicker({ anchor: e.currentTarget, target: 'message' })
        }
      >
        {message.hidden ? 'Unhide' : 'Hide'}
      </button>
      {message.owner && !message.fromAgent && (
        <button
          type="button"
          className={buttonClass}
          aria-haspopup={authorHidden ? undefined : 'menu'}
          onClick={(e) =>
            authorHidden
              ? moderation.onToggleHideAuthor(message, true)
              : setPicker({ anchor: e.currentTarget, target: 'author' })
          }
        >
          {authorHidden ? 'Unhide all' : 'Hide all from this user'}
        </button>
      )}
      <Menu
        open={Boolean(picker)}
        anchorEl={picker?.anchor}
        onClose={() => setPicker(null)}
        slotProps={{ list: { 'aria-label': 'Reason for hiding' } }}
      >
        {REASONS.map(({ value, label }) => (
          <MenuItem key={value} onClick={() => choose(value)}>
            {label}
          </MenuItem>
        ))}
        <MenuItem onClick={() => choose()}>Skip</MenuItem>
      </Menu>
    </div>
  );
};
