import { FC, useEffect, useState } from 'react';
import { PRESENTATION_TEXT } from '../utils/presentationText';

interface CountdownBannerProps {
  /** ISO timestamp the countdown ticks down to. */
  eventScheduledTime: string;
  /** Shared-screen layout: larger text, and the draft-message line doesn't apply (no composer there). */
  presentation?: boolean;
}

/**
 * Ticks a pre-event countdown off the local clock. Owns its own per-second interval so a tick
 * only re-renders this banner, not the whole room page. The actual switch to the live chat
 * channel still waits on the conversation:started socket event, not this countdown reaching
 * zero, so a few seconds of server lag just shows "starting any moment" instead of a frozen 0:00.
 */
export const CountdownBanner: FC<CountdownBannerProps> = ({ eventScheduledTime, presentation = false }) => {
  const [label, setLabel] = useState<string | null>(null);
  const [urgent, setUrgent] = useState(false);

  useEffect(() => {
    const target = new Date(eventScheduledTime).getTime();

    const tick = () => {
      const remainingMs = target - Date.now();
      if (remainingMs <= 0) {
        setLabel('The event is starting any moment…');
        setUrgent(true);
        return;
      }
      const totalSeconds = Math.floor(remainingMs / 1000);
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;
      const draftNote = presentation ? '' : ' Your draft message will still be here.';
      setLabel(
        `Event starts in ${minutes}:${seconds.toString().padStart(2, '0')}. Group chat will switch automatically.${draftNote}`,
      );
      setUrgent(remainingMs <= 30000);
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [eventScheduledTime, presentation]);

  if (!label) return null;

  return (
    <div
      className={`px-4 py-1.5 text-xs text-center border-t ${
        urgent
          ? 'border-amber-300 bg-amber-100 text-amber-900 dark:border-amber-700 dark:bg-amber-900/40 dark:text-amber-200'
          : 'border-gray-200 bg-gray-50 text-gray-500 dark:border-nx-border-subtle dark:bg-nx-base dark:text-nx-muted'
      }`}
      style={presentation ? PRESENTATION_TEXT.meta : undefined}
    >
      {label}
    </div>
  );
};
