import React, { useState } from 'react';
import { useRouter } from 'next/router';
import { ChevronRight, ContentCopyOutlined, OpenInNewOutlined, WarningAmberOutlined } from '@mui/icons-material';
import { Conversation } from '../../types.internal';
import { deriveEventState } from '../../utils/eventState';
import SessionManager from '../../utils/SessionManager';

const formatTime = (isoString?: string) =>
  isoString ? new Date(isoString).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '';

/** Status pill styling per lifecycle state. `dot` renders a filled circle; `pulse` animates it (live). */
const PILL_CONFIG = {
  missed: { label: "Didn't start", bg: '#FBE7EA', color: '#B81E30', dot: false },
  pending: { label: 'Not started', bg: '#EDE7F6', color: '#4845D2', dot: true },
  live: { label: 'Live now', bg: '#E7F5EE', color: '#0F7A4E', dot: true, pulse: true },
  scheduled: { label: 'Scheduled', bg: '#EDE7F6', color: '#4845D2', dot: true },
} as const;

/**
 * A copy-to-clipboard link chip in the operations bar. Disabled while the event is unconfirmed, since
 * its links aren't ready to share yet: the chip dims and its status dot goes neutral gray, only taking
 * on its brand color once the event is confirmed. Kept focusable via aria-disabled rather than the
 * native `disabled` attribute so assistive tech still announces the link exists.
 */
const LinkChip: React.FC<{
  label: string;
  url: string;
  dotColor: string;
  icon: React.ReactNode;
  disabled: boolean;
}> = ({ label, url, dotColor, icon, disabled }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (disabled) return;
    navigator.clipboard
      .writeText(url)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1300); // match the design's ~1.3s "copied" flash
      })
      .catch((error) => console.error('Failed to copy link:', error));
  };

  return (
    <button
      type="button"
      aria-disabled={disabled}
      onClick={handleCopy}
      className={`inline-flex items-center gap-2 rounded-full border border-[#ECECEF] px-3 py-1 text-[12.5px] text-[#1F2937] ${
        disabled ? 'cursor-default opacity-55' : 'hover:bg-[#F5F5F7]'
      }`}
    >
      <span
        data-testid="chip-dot"
        className="h-2 w-2 rounded-full"
        style={{ backgroundColor: disabled ? '#B0B0B8' : dotColor }}
      />
      {label}
      <span className="text-[#8A8F99]">{copied ? <span className="text-[11px]">Copied</span> : icon}</span>
    </button>
  );
};

/**
 * A single readiness-checklist row in the pending banner. Clicking "Review" asks the parent page to
 * scroll to and expand the matching Details card. The Series row is the only dismissable one.
 */
const ChecklistRow: React.FC<{
  label: string;
  onReview: () => void;
  onDismiss?: () => void;
}> = ({ label, onReview, onDismiss }) => (
  <div
    data-testid="checklist-row"
    className="flex items-center justify-between gap-3 border-t border-[#EAD9A6] py-2.5 first:border-t-0"
  >
    <span className="flex items-center gap-2">
      <WarningAmberOutlined fontSize="small" className="text-[#B8860B]" />
      <span className="text-[13.5px] font-semibold text-[#7E6017]">{label}</span>
    </span>
    <span className="flex items-center gap-3">
      <button
        type="button"
        onClick={onReview}
        className="inline-flex items-center gap-0.5 text-[12.5px] font-medium text-[#4845D2] hover:underline"
      >
        Review
        <ChevronRight fontSize="small" />
      </button>
      {onDismiss && (
        <button type="button" onClick={onDismiss} className="text-[12.5px] text-[#8A8F99] hover:underline">
          Dismiss
        </button>
      )}
    </span>
  </div>
);

/**
 * EventStatus component
 *
 * The operational half of the event view page (Details.tsx holds the read-only configuration). Shows
 * the lifecycle status pill, the moderator/participant/Zoom link chips, and the primary action
 * (Edit, or Create a new event when missed). In the `pending` state it also renders a readiness
 * banner: a checklist of details that still need confirming before the event can start, where each
 * row asks the parent page to jump to the relevant Details card via `onJumpToSection`.
 * @param conversationData - The conversation data object containing details about the event.
 * @param now - Injectable current time used to derive the lifecycle state; defaults to `new Date()`.
 * @param onJumpToSection - Called with a Details card id when a checklist row's "Review" is clicked.
 */
export const EventStatus: React.FC<{
  conversationData: Conversation;
  now?: Date;
  onJumpToSection?: (cardId: string) => void;
}> = ({ conversationData, now, onJumpToSection }) => {
  const router = useRouter();
  const [seriesDismissed, setSeriesDismissed] = useState(false);

  const state = deriveEventState(conversationData, now);
  const unconfirmed = state === 'pending' || state === 'missed';
  const pill = PILL_CONFIG[state];

  const userId = SessionManager.get().getSessionInfo()?.userId;
  const ownerId = typeof conversationData.owner === 'string' ? conversationData.owner : (conversationData.owner as any)?.id;
  const isOwner = !!userId && userId === ownerId;

  const moderatorUrl = conversationData.eventUrls.moderator[0]?.url;
  const participantUrl = conversationData.eventUrls.participant[0]?.url;
  const zoomUrl = conversationData.eventUrls.zoom?.url;

  const startTime = formatTime(conversationData.scheduledTime);

  // Readiness rows for the pending banner: the Series (always, until dismissed) plus any actually
  // missing detail. A field that's already filled in never appears here.
  const checklistItems = [
    { key: 'series', label: 'Series', target: 'details-1a', dismissable: true, show: !seriesDismissed },
    { key: 'startTime', label: 'Start time', target: 'sched-1a', show: !conversationData.scheduledTime },
    { key: 'endTime', label: 'End time', target: 'sched-1a', show: !conversationData.scheduledEndTime },
    { key: 'platform', label: 'Platform & meeting link', target: 'plat-1a', show: !zoomUrl },
  ].filter((item) => item.show);

  const handleEdit = () => router.push(`/admin/${conversationData.type.name}/edit/${conversationData.id}`);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-3">
      <div className="flex items-center gap-4 rounded-[10px] border border-[#ECECEF] bg-white px-[18px] py-[14px]">
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide"
          style={{ backgroundColor: pill.bg, color: pill.color }}
        >
          <span
            className={`h-2 w-2 rounded-full ${pill.dot ? '' : 'hidden'} ${'pulse' in pill && pill.pulse ? 'animate-pulse' : ''}`}
            style={{ backgroundColor: pill.color }}
          />
          {pill.label}
        </span>

        <span className="h-[26px] w-px bg-[#EAE8F0]" />

        <div className="flex flex-1 flex-wrap items-center gap-2">
          {moderatorUrl && (
            <LinkChip
              label="Moderator link"
              url={moderatorUrl}
              dotColor="#4845D2"
              icon={<ContentCopyOutlined fontSize="inherit" />}
              disabled={unconfirmed}
            />
          )}
          {participantUrl && (
            <LinkChip
              label="Participant link"
              url={participantUrl}
              dotColor="#7C3AED"
              icon={<ContentCopyOutlined fontSize="inherit" />}
              disabled={unconfirmed}
            />
          )}
          {zoomUrl && (
            <LinkChip
              label="Zoom"
              url={zoomUrl}
              dotColor="#0B6BCB"
              icon={<OpenInNewOutlined fontSize="inherit" />}
              disabled={unconfirmed}
            />
          )}
        </div>

        {isOwner && (
          <button
            type="button"
            onClick={handleEdit}
            className="rounded-lg bg-[#4845D2] px-4 py-1.5 text-[13px] font-semibold text-white hover:bg-[#3a37bf]"
          >
            Edit
          </button>
        )}
      </div>

      {state === 'pending' && (
        <>
          <p className="flex items-center justify-end gap-1 text-[11.5px] text-[#7E6017]">
            <WarningAmberOutlined fontSize="inherit" />
            Scheduled for {startTime} — {checklistItems.length}{' '}
            {checklistItems.length === 1 ? 'detail still needs' : 'details still need'} confirming.
          </p>

          <div className="rounded-[10px] border border-[#EAD9A6] bg-[#FDFAF0] p-[18px]">
            <div className="flex items-start gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#FBF0D3] text-[#7E6017]">
                <WarningAmberOutlined fontSize="small" />
              </span>
              <div>
                <p className="text-[14px] font-semibold text-[#0B0D0E]">Almost ready — confirm the flagged details</p>
                <p className="mt-0.5 text-[12.5px] text-[#7E6017]">
                  Scheduled for {startTime}. Confirm these to start the event — tap a row to jump to it.
                </p>
              </div>
            </div>

            <div className="mt-3">
              {checklistItems.map((item) => (
                <ChecklistRow
                  key={item.key}
                  label={item.label}
                  onReview={() => onJumpToSection?.(item.target)}
                  onDismiss={item.dismissable ? () => setSeriesDismissed(true) : undefined}
                />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
