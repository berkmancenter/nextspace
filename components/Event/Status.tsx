import React, { useState } from 'react';
import { useRouter } from 'next/router';
import {
  AccessTimeOutlined,
  AddOutlined,
  CheckOutlined,
  ChevronRight,
  ContentCopyOutlined,
  OpenInNewOutlined,
  WarningAmberOutlined,
} from '@mui/icons-material';
import { Conversation } from '../../types.internal';
import { deriveEventState, isValidZoomUrl } from '../../utils/eventState';
import SessionManager from '../../utils/SessionManager';

const formatTime = (isoString?: string) =>
  isoString ? new Date(isoString).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '';

// Same as formatTime but appends the viewer's local time-zone abbreviation, e.g. "4:00 PM EDT".
const formatTimeWithZone = (isoString?: string) =>
  isoString ? new Date(isoString).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }) : '';

// Short date-time without seconds, e.g. "10/23/2025, 4:00 PM". Matches Details.tsx's format.
const formatDateTime = (isoString?: string) =>
  isoString
    ? new Date(isoString).toLocaleString([], {
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : '';

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
  const isMissed = state === 'missed';
  const pill = PILL_CONFIG[state];

  const userId = SessionManager.get().getSessionInfo()?.userId;
  const ownerId = typeof conversationData.owner === 'string' ? conversationData.owner : (conversationData.owner as any)?.id;
  const isOwner = !!userId && userId === ownerId;

  const moderatorUrl = conversationData.eventUrls.moderator[0]?.url;
  const participantUrl = conversationData.eventUrls.participant[0]?.url;
  const zoomUrl = conversationData.eventUrls.zoom?.url;

  // The meeting link only counts as confirmed when it's a valid Zoom URL, matching the backend's
  // draft check (llm_engine isConversationDraft). A placeholder like "example.com" is present but
  // invalid, so it still blocks auto-start and must read as needs-review, not connected.
  const meetingUrl = (conversationData.properties as any)?.zoomMeetingUrl as string | undefined;
  const hasValidMeetingUrl = isValidZoomUrl(meetingUrl);

  const startTime = formatTime(conversationData.scheduledTime);
  const liveStartTime = formatTimeWithZone(conversationData.scheduledTime);

  // The live banner and hint name the assistant. Reads the same botName as Details.tsx so the two
  // stay in sync, and uses "Berkie" when the conversation has no bot name set.
  const botName =
    typeof (conversationData.properties as any)?.botName === 'string'
      ? (conversationData.properties as any).botName
      : 'Berkie';

  // Readiness rows for the pending banner: the Series (always, until dismissed) plus any detail that
  // actually blocks auto-start. These mirror the backend's required fields (end time, valid meeting
  // link); a field that's already valid never appears. Assistant configuration is intentionally
  // absent: defaults are valid and never block auto-start.
  const checklistItems = [
    { key: 'series', label: 'Series', target: 'details-1a', dismissable: true, show: !seriesDismissed },
    { key: 'startTime', label: 'Start time', target: 'sched-1a', show: !conversationData.scheduledTime },
    { key: 'endTime', label: 'End time', target: 'sched-1a', show: !conversationData.scheduledEndTime },
    { key: 'platform', label: 'Platform & meeting link', target: 'plat-1a', show: !hasValidMeetingUrl },
  ].filter((item) => item.show);

  // Retrospective list for the missed banner: the required details that were never satisfied before
  // the start passed. Same rules as the pending checklist, so assistant defaults never appear here.
  // A present-but-invalid meeting link reads as "Needs review"; an absent one as "Not connected".
  const neverConfirmedItems = [
    { key: 'endTime', label: 'End time', target: 'sched-1a', status: 'Not set', show: !conversationData.scheduledEndTime },
    {
      key: 'platform',
      label: 'Platform & meeting link',
      target: 'plat-1a',
      status: meetingUrl ? 'Needs review' : 'Not connected',
      show: !hasValidMeetingUrl,
    },
  ].filter((item) => item.show);

  const handleEdit = () => router.push(`/admin/${conversationData.type.name}/edit/${conversationData.id}`);
  const handleCreateNew = () => router.push('/admin/events/new');

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

        {/* The links point at the live session, so they're pointless once an event is missed: hide
            them (and their divider) rather than show dead, greyed-out chips. */}
        {!isMissed && <span className="h-[26px] w-px bg-[#EAE8F0]" />}

        <div className="flex flex-1 flex-wrap items-center gap-2">
          {!isMissed && moderatorUrl && (
            <LinkChip
              label="Moderator link"
              url={moderatorUrl}
              dotColor="#4845D2"
              icon={<ContentCopyOutlined fontSize="inherit" />}
              disabled={unconfirmed}
            />
          )}
          {!isMissed && participantUrl && (
            <LinkChip
              label="Participant link"
              url={participantUrl}
              dotColor="#7C3AED"
              icon={<ContentCopyOutlined fontSize="inherit" />}
              disabled={unconfirmed}
            />
          )}
          {!isMissed && zoomUrl && (
            <LinkChip
              label="Zoom"
              url={zoomUrl}
              dotColor="#0B6BCB"
              icon={<OpenInNewOutlined fontSize="inherit" />}
              disabled={unconfirmed}
            />
          )}
        </div>

        {isOwner &&
          (state === 'missed' ? (
            <button
              type="button"
              onClick={handleCreateNew}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#4845D2] px-4 py-1.5 text-[13px] font-semibold text-white hover:bg-[#3a37bf]"
            >
              <AddOutlined fontSize="inherit" />
              Create a new event
            </button>
          ) : (
            <button
              type="button"
              onClick={handleEdit}
              className="rounded-lg bg-[#4845D2] px-4 py-1.5 text-[13px] font-semibold text-white hover:bg-[#3a37bf]"
            >
              Edit
            </button>
          ))}
      </div>

      {state === 'missed' && (
        <>
          <p className="flex items-center justify-end gap-1 text-[11.5px] text-[#7E6017]">
            <WarningAmberOutlined fontSize="inherit" />
            This event was missed. Create a new event to reschedule.
          </p>

          <div className="flex items-start gap-3 rounded-xl border border-[#EBB0B0] bg-[#FCEEEE] px-4 py-[15px]">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#F7D9D9] text-[#B81E30]">
              <WarningAmberOutlined fontSize="small" />
            </span>
            <div>
              <p className="text-[14px] font-semibold text-[#0B0D0E]">This event did not start</p>
              <p className="mt-0.5 text-[12.5px] leading-relaxed text-[#7A4A4A]">
                Its scheduled start ({formatDateTime(conversationData.scheduledTime)}) has passed with details still
                unconfirmed, so it can no longer be started.
              </p>
            </div>
          </div>

          {neverConfirmedItems.length > 0 && (
            <div className="rounded-[10px] border border-[#EAD9A6] bg-[#FDFAF0] p-[18px]">
              <div className="flex items-start gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#FBF0D3] text-[#7E6017]">
                  <WarningAmberOutlined fontSize="small" />
                </span>
                <div>
                  <p className="text-[14px] font-semibold text-[#0B0D0E]">These details were never confirmed</p>
                  <p className="mt-0.5 text-[12.5px] text-[#7E6017]">These carry over if you create a new event.</p>
                </div>
              </div>

              <div className="mt-3">
                {neverConfirmedItems.map((item) => (
                  <button
                    type="button"
                    key={item.key}
                    data-testid="never-confirmed-row"
                    onClick={() => onJumpToSection?.(item.target)}
                    className="flex w-full items-center justify-between gap-3 border-t border-[#EAD9A6] py-2.5 text-left first:border-t-0 hover:bg-[#FBF3DE]"
                  >
                    <span className="flex items-center gap-2">
                      <WarningAmberOutlined fontSize="small" className="text-[#B8860B]" />
                      <span className="text-[13.5px] font-semibold text-[#7E6017]">{item.label}</span>
                    </span>
                    <span className="flex items-center gap-1 text-[12px] font-medium text-[#8A8F99]">
                      {item.status}
                      <ChevronRight fontSize="small" />
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}

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

      {state === 'live' && (
        <>
          <p className="flex items-center justify-end gap-1 text-[11.5px] text-[#0F7A4E]">
            <AccessTimeOutlined fontSize="inherit" />
            Live since {liveStartTime}. {botName} is active.
          </p>

          <div className="flex items-start gap-3 rounded-[10px] border border-[#B7E4CD] bg-[#F1FBF6] p-[18px]">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#D9F2E5] text-[#0F7A4E]">
              <CheckOutlined fontSize="small" />
            </span>
            <div>
              <p className="text-[14px] font-semibold text-[#0B0D0E]">This event is live</p>
              <p className="mt-0.5 text-[12.5px] leading-relaxed text-[#3F6B54]">
                All details were confirmed and the event started at {liveStartTime}. {botName} is active and answering
                audience questions.
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
