import { IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';

/**
 * A single persistent, dismissible announcement shown above the tab content. Generic by design —
 * only jargon clarification produces one today, but the shape isn't jargon-specific so another
 * low-stakes notification kind can use the same banner later.
 */
export interface Notification {
  id: string;
  kind: string;
  summary: string;
  seen: boolean;
  onOpen: () => void;
  onDismiss: () => void;
}

interface NotificationBannerProps {
  notification: Notification | null;
}

export function NotificationBanner({ notification }: NotificationBannerProps) {
  if (!notification) return null;

  const { summary, seen, onOpen, onDismiss } = notification;

  return (
    <div
      className={`flex items-center gap-2.5 w-full border-b px-3.5 py-2.5 ${
        seen ? 'bg-white border-[#EDE7F6]' : 'bg-[#F3F0FF] border-[#D1C4E9]'
      }`}
    >
      <button
        type="button"
        onClick={onOpen}
        aria-expanded={false}
        aria-haspopup="dialog"
        className="flex-1 flex items-center gap-2.5 min-w-0 text-left"
      >
        <span
          className="flex-shrink-0 w-[26px] h-[26px] rounded-full flex items-center justify-center text-[11px] font-bold"
          style={{ backgroundColor: '#DDD6FE', color: '#4845D2' }}
        >
          Aa
        </span>
        <span className={`flex-1 min-w-0 truncate text-[13px] ${seen ? 'text-gray-600' : 'text-[#2d2440]'}`}>
          <span className={seen ? 'font-normal' : 'font-bold'}>{summary}</span>
        </span>
        <KeyboardArrowDownIcon className="text-mediumslateblue" sx={{ fontSize: 18, flexShrink: 0 }} />
      </button>
      <IconButton
        aria-label="Dismiss notification"
        size="small"
        onClick={(e) => {
          e.stopPropagation();
          onDismiss();
        }}
      >
        <CloseIcon sx={{ fontSize: 16 }} />
      </IconButton>
    </div>
  );
}
