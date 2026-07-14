import React, { useEffect, useState } from 'react';
import { CloseOutlined, PublicOutlined, VisibilityOffOutlined, WarningAmberOutlined } from '@mui/icons-material';
import { Conversation } from '../../types.internal';
import { deriveEventState, isValidZoomUrl } from '../../utils/eventState';
import { SectionCard } from './SectionCard';

// Short date-time without seconds, e.g. "7/15/2026, 4:00 PM".
const formatDateTime = (isoString?: string) =>
  isoString
    ? new Date(isoString).toLocaleString([], {
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : null;

const stripProtocol = (url: string) => url.replace(/^https?:\/\//, '');

/**
 * Describe the viewer's time zone as of the event's scheduled date, split so the layout can stack the
 * offset detail under the zone name (the field cell is only a third of the row and can't fit one line).
 * Returns e.g. { zone: "America/New_York", detail: "EDT (UTC-4)" }. The abbreviation and offset are
 * computed against `isoString` so daylight-saving is reflected. This is the viewer's local zone, not an
 * organizer-authored one (the Conversation has no timezone field yet).
 */
const formatTimeZone = (isoString?: string) => {
  if (!isoString) return null;
  const date = new Date(isoString);
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const abbreviation =
    new Intl.DateTimeFormat('en-US', { timeZoneName: 'short' })
      .formatToParts(date)
      .find((part) => part.type === 'timeZoneName')?.value ?? '';

  const offsetMinutes = -date.getTimezoneOffset(); // positive when ahead of UTC
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const hours = Math.floor(Math.abs(offsetMinutes) / 60);
  const minutes = Math.abs(offsetMinutes) % 60;
  const offset = `UTC${sign}${hours}${minutes ? ':' + String(minutes).padStart(2, '0') : ''}`;

  return { zone, detail: `${abbreviation} (${offset})` };
};

/**
 * The organizer-controlled features for the eventAssistant conversation type, kept in sync
 * with llm_engine/src/conversations/eventAssistant.ts. Participant-controlled features
 * (mindmap, visual, visualPreference, jargonFilter) are intentionally excluded — they aren't
 * organizer configuration.
 */
const ORGANIZER_FEATURES: { name: string; label: string; defaultEnabled: boolean }[] = [
  { name: 'moderatorSupport', label: 'Moderator Support', defaultEnabled: true },
  { name: 'collectiveVoice', label: 'Collective Voice', defaultEnabled: true },
  { name: 'catalyst', label: 'Catalyst', defaultEnabled: true },
  { name: 'librarian', label: 'Reading Recommendations', defaultEnabled: true },
  { name: 'seriesHistory', label: 'Series History', defaultEnabled: false },
];

/**
 * A dismissable amber note shown at the top of an unconfirmed card (series match, defaults review,
 * resource visibility). Dismiss state is local: the note reappears on remount, which is fine since
 * these are per-view nudges, not saved preferences.
 */
const Callout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;
  return (
    <div className="mb-3 flex items-start gap-2 rounded-lg border border-[#EAD9A6] bg-[#FBF6EA] p-2 text-[13px] text-[#7E6017]">
      <WarningAmberOutlined fontSize="small" />
      <span className="flex-1">{children}</span>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => setDismissed(true)}
        className="shrink-0 text-[#B8860B] hover:text-[#7E6017]"
      >
        <CloseOutlined fontSize="small" />
      </button>
    </div>
  );
};

const NeedsAttentionChip = () => (
  <span className="inline-flex items-center rounded-full bg-[#FBF3DE] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#7E6017]">
    Needs attention
  </span>
);

const DefaultChip = () => (
  <span className="inline-flex items-center rounded-full bg-[#EDE7F6] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#5A54B8]">
    Default
  </span>
);

// Label for a field value (Series, Starts, Bot name, ...). #6B7280 on white clears WCAG AA at this
// size (4.83:1); the lighter #8A8F99 it replaced did not (3.25:1).
const FieldLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="text-[11.5px] font-medium text-[#6B7280]">{children}</p>
);

// A section label within a card (Description, Features, Moderator, Presenters). Same type and color
// as FieldLabel so every label on the page reads uniformly; the margins give it room as a header.
const Subhead: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <p className={`mb-2.5 text-[11.5px] font-medium text-[#6B7280] ${className}`}>{children}</p>
);

const FieldValue: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="mt-1 text-[14px] text-[#1F2937]">{children}</p>
);

const MissingValue: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="mt-1 flex items-center gap-1 text-[14px] text-[#7E6017]">
    <WarningAmberOutlined fontSize="inherit" />
    {children}
  </p>
);

const Tag: React.FC<{ children: React.ReactNode; icon?: React.ReactNode }> = ({ children, icon }) => (
  <span className="inline-flex items-center gap-1 rounded-full bg-[#F5F5F7] px-2 py-0.5 text-[11px] text-[#4B5563]">
    {icon}
    {children}
  </span>
);

/**
 * EventDetails component
 *
 * Read-only summary of an event's configuration, laid out as six collapsible cards
 * (Event Details, Schedule, Platform & format, Assistant configuration, Moderators &
 * presenters, Reading & resources) so an organizer can confirm everything at a glance
 * without opening an edit form. Renders alongside EventStatus, which stays operational
 * (live/start/edit) — this component never mutates anything.
 * @param conversationData - The conversation data object containing details about the event.
 * @param now - Injectable current time, used to derive the confirmed/unconfirmed state; defaults to `new Date()`.
 * @param openSectionRequest - When its `nonce` changes, the section with the matching card `id` is
 *   expanded. Lets Status.tsx's readiness checklist jump to a card without owning Details' state.
 */
export const EventDetails: React.FC<{
  conversationData: Conversation;
  now?: Date;
  openSectionRequest?: { id: string; nonce: number };
}> = ({ conversationData, now, openSectionRequest }) => {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    'details-1a': false,
    'sched-1a': false,
    'plat-1a': false,
    'cfg-1a': false,
    'people-1a': false,
    'resources-1a': false,
  });

  const setSection = (id: string) => (value: boolean) => setExpanded((prev) => ({ ...prev, [id]: value }));

  useEffect(() => {
    if (openSectionRequest) setSection(openSectionRequest.id)(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openSectionRequest?.id, openSectionRequest?.nonce]);

  const state = deriveEventState(conversationData, now);
  const unconfirmed = state === 'pending' || state === 'missed';
  const isLive = state === 'live';
  const isPast = state === 'past';

  // A concluded event shows when it actually ran (startTime/endTime, stamped by the backend), not
  // when it was planned, since the scheduled times may be blank for an ad-hoc event. Every other
  // state shows the planned schedule. Fall back to the scheduled value if a run time is missing.
  const startIso = isPast ? (conversationData.startTime ?? conversationData.scheduledTime) : conversationData.scheduledTime;
  const endIso = isPast
    ? (conversationData.endTime ?? conversationData.scheduledEndTime)
    : conversationData.scheduledEndTime;
  const startLabel = isPast ? 'Started' : 'Starts';
  const endLabel = isPast ? 'Ended' : 'Ends';

  const displayStart = formatDateTime(startIso);
  const displayEnd = formatDateTime(endIso);
  const timeZone = formatTimeZone(startIso);

  // "Needs attention" flags the card only when a field is actually missing, not just because the
  // event is unconfirmed. A pending event with both times filled has nothing to fix here, and once
  // the event is live or over there's nothing left to fix at all.
  const scheduleNeedsAttention = !isLive && !isPast && (!displayStart || !displayEnd);

  const topic = typeof conversationData.topic === 'object' ? conversationData.topic : undefined;
  const isPublicSeries = topic ? !topic.private : undefined;

  const properties = conversationData.properties ?? {};
  const zoomMeetingUrl =
    typeof (properties as any).zoomMeetingUrl === 'string' ? (properties as any).zoomMeetingUrl : undefined;
  // A meeting link only counts as confirmed when it's a valid Zoom URL (same rule as the backend's
  // draft check). A present-but-invalid value like "example.com" reads as needs-review, not a link.
  const hasValidMeetingUrl = isValidZoomUrl(zoomMeetingUrl);
  const botName = typeof (properties as any).botName === 'string' ? (properties as any).botName : undefined;
  const llmModel = (properties as any).llmModel as { llmPlatform?: string; llmModel?: string } | undefined;

  return (
    <div className="mx-auto mt-4 flex w-full max-w-3xl flex-col gap-4">
      <SectionCard
        id="details-1a"
        title="Event Details"
        expanded={expanded['details-1a']}
        onToggle={setSection('details-1a')}
      >
        {unconfirmed && !isLive && (
          <Callout>
            If this series matches your expected topic, leave it as-is. Otherwise, click the Edit button above to change it.
          </Callout>
        )}

        {topic && (
          <>
            <FieldLabel>Series</FieldLabel>
            <p className="mt-1 flex items-center gap-2 text-[14px] text-[#1F2937]">
              {topic.name}
              {isPublicSeries && (
                <span className="inline-flex items-center gap-1 rounded-full bg-[#E7F5EE] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#0F7A4E]">
                  <PublicOutlined fontSize="inherit" />
                  PUBLIC
                </span>
              )}
            </p>
            <p className="mt-2 flex items-center gap-1 text-[11.5px] text-[#0F7A4E]">
              <PublicOutlined fontSize="inherit" />
              {isPublicSeries
                ? 'Public series: event transcripts and group chats are retained in memory for Berkie and other bots to reference in the future.'
                : 'Private series: event transcripts and group chats are not retained.'}
            </p>
          </>
        )}

        {conversationData.description && (
          <>
            <Subhead className="mt-4">Description</Subhead>
            <FieldValue>{conversationData.description}</FieldValue>
          </>
        )}
      </SectionCard>

      <SectionCard
        id="sched-1a"
        title="Schedule"
        expanded={expanded['sched-1a']}
        onToggle={setSection('sched-1a')}
        headerChip={scheduleNeedsAttention && <NeedsAttentionChip />}
      >
        <div className="grid grid-cols-3 gap-4">
          <div>
            <FieldLabel>{startLabel}</FieldLabel>
            {displayStart ? <FieldValue>{displayStart}</FieldValue> : <MissingValue>Not set yet</MissingValue>}
          </div>
          <div>
            <FieldLabel>{endLabel}</FieldLabel>
            {displayEnd ? <FieldValue>{displayEnd}</FieldValue> : <MissingValue>Not set yet</MissingValue>}
          </div>
          <div>
            <FieldLabel>Time zone</FieldLabel>
            {timeZone ? (
              <div className="mt-1">
                <p className="text-[14px] text-[#1F2937]">{timeZone.zone}</p>
                <p className="text-[12.5px] text-[#6B7280]">{timeZone.detail}</p>
              </div>
            ) : (
              <MissingValue>Not set yet</MissingValue>
            )}
          </div>
        </div>
      </SectionCard>

      <SectionCard
        id="plat-1a"
        title="Platform & format"
        expanded={expanded['plat-1a']}
        onToggle={setSection('plat-1a')}
        headerChip={!hasValidMeetingUrl && !isLive && !isPast && <NeedsAttentionChip />}
      >
        <div className="grid grid-cols-3 gap-4">
          <div>
            <FieldLabel>Agent</FieldLabel>
            <FieldValue>Event Assistant</FieldValue>
          </div>
          <div>
            <FieldLabel>Platform</FieldLabel>
            <FieldValue>Nextspace, Zoom</FieldValue>
          </div>
          <div className="min-w-0">
            <FieldLabel>Meeting link</FieldLabel>
            {hasValidMeetingUrl ? (
              <a
                href={zoomMeetingUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-1 block break-all font-mono text-[14px] text-medium-slate-blue"
              >
                {stripProtocol(zoomMeetingUrl)}
              </a>
            ) : zoomMeetingUrl ? (
              <MissingValue>Not a valid Zoom link</MissingValue>
            ) : (
              <MissingValue>No meeting link yet</MissingValue>
            )}
          </div>
        </div>
      </SectionCard>

      <SectionCard
        id="cfg-1a"
        title="Assistant configuration"
        expanded={expanded['cfg-1a']}
        onToggle={setSection('cfg-1a')}
        headerChip={unconfirmed && <DefaultChip />}
      >
        {unconfirmed && (
          <Callout>Model and features are still on calendar-invite defaults. Review before the event.</Callout>
        )}
        <div className="grid grid-cols-3 gap-4">
          <div>
            <FieldLabel>Bot name</FieldLabel>
            <FieldValue>{botName ?? 'Berkie'}</FieldValue>
          </div>
          <div>
            <FieldLabel>Platform</FieldLabel>
            <FieldValue>{llmModel?.llmPlatform ?? 'OpenAI'}</FieldValue>
          </div>
          <div>
            <FieldLabel>Model</FieldLabel>
            <FieldValue>{llmModel?.llmModel ?? 'gpt-4o-mini'}</FieldValue>
          </div>
        </div>

        <Subhead className="mt-4">Features</Subhead>
        {ORGANIZER_FEATURES.map(({ name, label, defaultEnabled }) => {
          const conversationFeature = conversationData.features?.find((f) => f.name === name);
          const enabled = conversationFeature ? (conversationFeature.enabled ?? true) : defaultEnabled;
          return (
            <div
              key={name}
              data-testid="feature-row"
              className="flex items-center justify-between border-t border-[#F0EEF6] py-2"
            >
              <span className="text-[14px] text-[#1F2937]">{label}</span>
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                  enabled ? 'bg-medium-slate-blue text-white' : 'bg-gray-100 text-gray-500'
                }`}
              >
                {enabled ? 'On' : 'Off'}
              </span>
            </div>
          );
        })}
      </SectionCard>

      <SectionCard
        id="people-1a"
        title="Moderators & presenters"
        expanded={expanded['people-1a']}
        onToggle={setSection('people-1a')}
      >
        <Subhead>Moderator</Subhead>
        {conversationData.moderators && conversationData.moderators.length > 0 ? (
          conversationData.moderators.map((moderator, index) => (
            <div key={index} className="mt-1">
              <p className="text-[14px] font-bold text-[#0B0D0E]">{moderator.name}</p>
              {moderator.bio && <p className="text-[14px] text-[#4B5563]">{moderator.bio}</p>}
            </div>
          ))
        ) : (
          <p className="mt-1 rounded-lg border border-dashed border-[#D6D3E0] p-2 text-[13px] text-[#6B7280]">
            No moderator assigned yet.
          </p>
        )}

        <Subhead className="mt-4">Presenters</Subhead>
        {conversationData.presenters && conversationData.presenters.length > 0 ? (
          conversationData.presenters.map((presenter, index) => (
            <div key={index} className="mt-1">
              <p className="text-[14px] font-bold text-[#0B0D0E]">{presenter.name}</p>
              {presenter.bio && <p className="text-[14px] text-[#4B5563]">{presenter.bio}</p>}
            </div>
          ))
        ) : (
          <p className="mt-1 rounded-lg border border-dashed border-[#D6D3E0] p-2 text-[13px] text-[#6B7280]">
            No presenters added yet (optional).
          </p>
        )}
      </SectionCard>

      <SectionCard
        id="resources-1a"
        title="Reading & resources"
        expanded={expanded['resources-1a']}
        onToggle={setSection('resources-1a')}
      >
        <Callout>
          Resources default to optional and hidden from participants. Click the Edit button at the top to change.
        </Callout>
        {conversationData.resources && conversationData.resources.length > 0 ? (
          conversationData.resources.map((resource, index) => (
            <div key={index} className="mt-3 first:mt-0">
              {resource.url ? (
                <a href={resource.url} target="_blank" rel="noreferrer" className="text-medium-slate-blue">
                  {resource.title}
                </a>
              ) : (
                <span className="text-[14px] text-[#1F2937]">{resource.title}</span>
              )}
              {(resource.authors?.length || resource.year) && (
                <p className="mt-1 text-[13px] text-[#4B5563]">
                  {resource.authors?.join(', ')}
                  {resource.authors?.length && resource.year ? ' · ' : ''}
                  {resource.year}
                </p>
              )}
              {resource.description && <p className="mt-1 text-[13px] text-[#4B5563]">{resource.description}</p>}
              <div className="mt-1 flex flex-wrap gap-1">
                {resource.category === 'required' && <Tag>Optional</Tag>}
                {!resource.participantVisible && (
                  <Tag icon={<VisibilityOffOutlined fontSize="inherit" />}>Not visible to participants</Tag>
                )}
                {resource.hasPdf ? <Tag>PDF</Tag> : resource.url && <Tag>Link</Tag>}
              </div>
              {resource.citation && <p className="mt-1 font-mono text-[12px] text-[#6B7280]">{resource.citation}</p>}
            </div>
          ))
        ) : (
          <p className="rounded-lg border border-dashed border-[#D6D3E0] p-2 text-[13px] text-[#6B7280]">
            No reading or resources added yet.
          </p>
        )}
      </SectionCard>
    </div>
  );
};
