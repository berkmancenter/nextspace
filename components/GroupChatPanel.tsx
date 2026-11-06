import React, { FC, useEffect, useMemo, useRef, useState } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { CountdownBanner } from './CountdownBanner';
import { MessageInput } from './MessageInput';
import { ThreadedMessage } from './ThreadedMessage';
import { ThreadPanel } from './ThreadPanel';
import type { MessageModeration } from './ModerationControls';
import { UserMessage } from './messages/UserMessage';
import { PseudonymousMessage, ControlledInputConfig, FeedbackConfig } from '../types.internal';
import { getAvatarStyle, getAssistantAvatarStyle } from '../utils/avatarUtils';
import { useAutoScroll } from '../hooks/useAutoScroll';
import { useOpenThread } from '../hooks/useOpenThread';
import { BotIcon } from './BotIcon';
import { createMentionsEnhancer } from './enhancers/mentionsEnhancer';
import { getTimestampVisibility, normalizeAssistantPseudonym, parseMessageBody } from '../utils/Helpers';
import { PollMessage, PollMessageBody } from './messages/PollMessage';
import { IconButton, Tooltip } from '@mui/material';
import ArrowCircleDownIcon from '@mui/icons-material/ArrowCircleDown';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import EditIcon from '@mui/icons-material/Edit';
import { PRESENTATION_TEXT } from '../utils/presentationText';

// Goal names come from backend config the frontend never loads, so colors are assigned by hashing
// the label rather than from a known list — the same goal always lands on the same color.
const GOAL_DOT_COLORS = ['#4845D2', '#0F7A4E', '#B81E30', '#7E6017', '#0E7490', '#9D174D'];
const colorForGoal = (label: string): string => {
  let hash = 0;
  for (let i = 0; i < label.length; i++) hash = (hash * 31 + label.charCodeAt(i)) | 0;
  return GOAL_DOT_COLORS[Math.abs(hash) % GOAL_DOT_COLORS.length];
};

/** Pill naming the goal a proactive agent message was generated to serve. Uses the app's own
 * pill tokens (bg-nx-pill/text-nx-pill-text, as in PresentationHeader's badge) so it reads
 * correctly in both themes without hand-picked colors that only work in one. */
const GoalPill: FC<{ label: string }> = ({ label }) => (
  <div
    className="mb-1.5 inline-flex w-fit items-center gap-1.5 rounded-full bg-nx-pill px-2.5 py-1 text-[11px] font-medium text-nx-pill-text"
    role="note"
    aria-label={`Generated for goal: ${label}`}
  >
    <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: colorForGoal(label) }} aria-hidden="true" />
    {label}
  </div>
);

/**
 * The pregame "three facts" card: a one-off styled moment rather than a plain assistant bubble,
 * since its job is to get people excited before an event starts, not blend into the stream.
 * `facts` is rendered as a true list (no bullet-parsing out of prose) and the optional
 * `invitation` line is the one piece of LLM-written prose left, inviting a reply.
 */
const ThreeFactsCard: FC<{ facts: string[]; invitation?: string }> = ({ facts, invitation }) => (
  <div
    className="relative w-full overflow-hidden rounded-2xl border border-[#D7DAFC] bg-gradient-to-br from-[#EEF0FE] to-[#F8EEFC] px-4 py-3.5 dark:border-[#5A1A93] dark:from-[#3B0A6B] dark:to-[#450F74]"
    style={{ boxShadow: '0 10px 24px -14px rgba(72, 69, 210, 0.45)' }}
  >
    <div
      className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-[#4845D2] via-[#9254DE] to-[#4845D2] dark:from-[#B5AAEF] dark:via-[#8B6FD1] dark:to-[#B5AAEF]"
      aria-hidden="true"
    />
    <div className="mb-3 flex items-center gap-2 text-[15px] font-bold text-[#4845D2] dark:text-nx-text">
      <span
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#4845D2] to-[#9254DE] text-[13px] dark:from-[#B5AAEF] dark:to-[#8B6FD1]"
        style={{ boxShadow: '0 2px 6px -1px rgba(72, 69, 210, 0.5)' }}
        aria-hidden="true"
      >
        ✨
      </span>
      Fun Facts
    </div>
    <div className="flex flex-col overflow-hidden rounded-lg bg-white/70 dark:bg-black/20">
      {facts.map((fact, i) => (
        <div
          key={i}
          className={`flex items-start gap-2.5 px-2.5 py-2 ${i % 2 === 1 ? 'bg-[#4845D2]/20 dark:bg-[#B5AAEF]/25' : ''}`}
        >
          <span
            className="mt-0.5 flex h-[21px] w-[21px] shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#4845D2] to-[#9254DE] text-[11px] font-bold text-white dark:from-[#B5AAEF] dark:to-[#8B6FD1] dark:text-[#2A0449]"
            style={{ boxShadow: '0 2px 5px -1px rgba(72, 69, 210, 0.45)' }}
          >
            {i + 1}
          </span>
          <p className="m-0 leading-[1.48] text-gray-800 dark:text-nx-text">{fact}</p>
        </div>
      ))}
    </div>
    {invitation && (
      <p className="relative z-[1] m-0 mt-2.5 border-t border-[#4845D2]/20 pt-2.5 font-medium text-[#4845D2] dark:border-[#B5AAEF]/25 dark:text-nx-text-secondary">
        {invitation}
      </p>
    )}
  </div>
);

/**
 * Render assistant message with markdown support
 * Converts markdown formatting (bold, italic, lists, etc.) to HTML
 */
const renderAssistantMessage = (text: string): React.ReactNode => {
  return (
    <div className="markdown-content">
      <Markdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ node, ...props }) => (
            <a {...props} className="text-medium-slate-blue nx-message-link" target="_blank" rel="noopener noreferrer" />
          ),
        }}
      >
        {text}
      </Markdown>
    </div>
  );
};

interface GroupChatPanelProps {
  /** The list of messages to display in the chat panel */
  messages: PseudonymousMessage[];
  /** The pseudonym of the current user */
  pseudonym: string | null;
  pseudonymFunFact?: string;
  /** The name of the event, if applicable */
  eventName?: string;
  /** The name of the bot, if applicable */
  botName?: string;
  /** The current value of the input in controlled mode */
  inputValue?: string;
  /** Configuration for controlled input mode */
  controlledMode?: ControlledInputConfig | null;
  /** Configuration for feedback */
  feedbackConfig?: FeedbackConfig;
  /** Set of message IDs with unread replies */
  messagesWithUnreadReplies?: Set<string>;
  /** Whether the chat is waiting for a response */
  waitingForResponse?: boolean;
  /** Callback when exiting controlled input mode */
  onExitControlledMode?: () => void;
  /** Callback when marking a message as read */
  onMarkAsRead?: (messageId: string) => void;
  /** Callback when the input value changes in controlled mode */
  onInputChange?: (value: string) => void;
  /** Callback when a message is sent; should return true if the message was successfully sent */
  onSendMessage: (message: string, parentMessageId?: string) => Promise<boolean>;
  /** Poll vote counts keyed by pollId */
  pollCounts?: Record<string, Record<string, number>>;
  /** Whether the event is inactive (ended) */
  inactive?: boolean;
  /** Shared-screen layout: presentation text sizes, and a composer that starts collapsed. */
  presentation?: boolean;
  /** Whether the reader holds the admin role; hide controls are drawn only for an admin. */
  isAdmin?: boolean;
  /** Hide controls for the group chat. */
  moderation?: MessageModeration;
  /** ISO timestamp for the pre-event countdown banner; omit once the event has started. */
  eventScheduledTime?: string | null;
}

export const GroupChatPanel: FC<GroupChatPanelProps> = ({
  messages: allMessages,
  pseudonym,
  pseudonymFunFact,
  eventName,
  botName = 'Berkie',
  inputValue,
  controlledMode,
  feedbackConfig,
  messagesWithUnreadReplies = new Set(),
  waitingForResponse = false,
  onExitControlledMode,
  onInputChange,
  onMarkAsRead,
  onSendMessage,
  pollCounts = {},
  inactive = false,
  presentation = false,
  isAdmin = false,
  moderation,
  eventScheduledTime,
}) => {
  // The shared screen is read by the whole room: it carries no hide controls, and never shows hidden messages
  // (an admin's feed includes them, greyed out, for the moderation view).
  const adminModeration = isAdmin && !presentation ? moderation : undefined;
  const messages = useMemo(
    () => (presentation ? allMessages.filter((m) => !m.hidden) : allMessages),
    [allMessages, presentation],
  );
  // A composer open on a shared screen takes room from the messages, so it starts collapsed there.
  const [inputHidden, setInputHidden] = useState(presentation);

  // Extract unique contributors for mentions
  const contributors = useMemo(
    () => Array.from(new Set(messages.map((m) => normalizeAssistantPseudonym(m, botName)).filter(Boolean))),
    [messages],
  );

  // Always register the mentions enhancer so the @ button is visible from the
  // start. The enhancer's getItems() will simply return an empty list until
  // contributors are known (i.e. until messages have loaded).
  const enhancers = useMemo(() => [createMentionsEnhancer(contributors)], [contributors]);

  // Organize messages into threads
  const { parentMessages, threadMap } = useMemo(() => {
    // Separate parents from replies
    const parents = messages.filter((m) => !m.parentMessage);

    // Build map of parent ID -> replies array
    const map = new Map<string, PseudonymousMessage[]>();
    messages
      .filter((m) => m.parentMessage)
      .forEach((reply) => {
        const parentId = reply.parentMessage!;
        if (!map.has(parentId)) {
          map.set(parentId, []);
        }
        map.get(parentId)!.push(reply);
      });

    // Sort replies by createdAt
    map.forEach((replies) => {
      replies.sort((a, b) => new Date(a.createdAt!).getTime() - new Date(b.createdAt!).getTime());
    });

    return { parentMessages: parents, threadMap: map };
  }, [messages]);
  const timestampVisibility = useMemo(() => getTimestampVisibility(parentMessages), [parentMessages]);

  // Which thread is open in split view
  const { selectedThreadId, selectedThread, setSelectedThreadId } = useOpenThread(parentMessages);

  // Auto-scroll based on any new messages, including threaded replies
  const { messagesEndRef, messagesContainerRef, isAtBottom, scrollToBottom } = useAutoScroll(messages);

  const messageInputRef = useRef<HTMLDivElement>(null);
  const writeMessageButtonRef = useRef<HTMLButtonElement>(null);
  const focusAfterComposerToggle = useRef(false);

  // Each presentation composer button disappears when clicked, so focus has to be moved on purpose
  // or it falls back to the top of the page (WCAG 2.4.3).
  useEffect(() => {
    if (!focusAfterComposerToggle.current) return;
    focusAfterComposerToggle.current = false;
    if (inputHidden) {
      writeMessageButtonRef.current?.focus();
      return;
    }
    messageInputRef.current?.querySelector<HTMLElement>('textarea')?.focus();
  }, [inputHidden]);

  const toggleComposer = (hidden: boolean) => {
    focusAfterComposerToggle.current = true;
    setInputHidden(hidden);
  };

  /* Move focus into the message input after jumping to the bottom so keyboard
     users don't lose their place (WCAG 2.4.3). */
  const handleScrollToBottom = () => {
    scrollToBottom();
    const input = messageInputRef.current?.querySelector<HTMLElement>('textarea, input, [contenteditable="true"]');
    input?.focus();
  };

  // Determine if we're waiting for a threaded reply
  const lastMessage = messages[messages.length - 1];
  const waitingForThreadedReply = waitingForResponse && lastMessage?.parentMessage;

  // Helper to render avatar for chat mode
  const renderAvatar = (message: PseudonymousMessage) => {
    const isCurrentUser = message.pseudonym === pseudonym;
    const isAssistant = message.fromAgent;

    const style = isAssistant ? getAssistantAvatarStyle() : getAvatarStyle(message.pseudonym || '', isCurrentUser);

    return (
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: style.avatarBg }}
      >
        {isAssistant ? <BotIcon size={22} color="var(--nx-icon-muted)" /> : <style.icon fontSize="inherit" />}
      </div>
    );
  };

  // Helper to render message content bubble
  const renderMessageContent = (message: PseudonymousMessage, isHovered?: boolean) => {
    const isCurrentUser = message.pseudonym === pseudonym;
    const isAssistant = message.fromAgent;
    const rawBody =
      message.bodyType === 'json' && typeof message.body === 'string' ? JSON.parse(message.body) : message.body;
    const parsed = parseMessageBody(rawBody);

    const style = isAssistant ? getAssistantAvatarStyle() : getAvatarStyle(message.pseudonym || '', isCurrentUser);

    // User messages - use UserMessage component
    if (!isAssistant) {
      return (
        <UserMessage message={message} contributors={contributors} backgroundColor={style.bubbleBg} isHovered={isHovered} />
      );
    }

    // Poll messages — rendered as an inline poll widget below the agent's intro text
    if (parsed.type === 'poll') {
      const pollBody = rawBody as PollMessageBody;
      const counts = pollCounts[pollBody.pollId] ?? null;
      return (
        <div style={{ width: '85%' }}>
          {parsed.goal && <GoalPill label={parsed.goal} />}
          <div
            className="rounded-2xl px-2 py-1 text-gray-800 self-start"
            style={{
              backgroundColor: isHovered ? 'var(--nx-bubble-hover-bg)' : style.bubbleBg,
              width: '100%',
              border: 'var(--nx-bubble-border-width) solid var(--nx-bubble-border)',
            }}
          >
            {parsed.text && renderAssistantMessage(parsed.text)}
            <PollMessage body={pollBody} counts={counts} presentation={presentation} />
          </div>
        </div>
      );
    }

    // Pregame "three facts" intro — its own styled card rather than a plain assistant bubble
    if (parsed.type === 'threeFacts' && parsed.facts && parsed.facts.length > 0) {
      return (
        <div style={{ width: '85%' }}>
          <ThreeFactsCard facts={parsed.facts} invitation={parsed.invitation} />
        </div>
      );
    }

    // Assistant messages
    const isVoiceReply = parsed.source === 'voice';
    const sourceContextText = parsed.sourceMessage
      ? parsed.sourceMessage.length > 60
        ? parsed.sourceMessage.substring(0, 60) + '...'
        : parsed.sourceMessage
      : null;

    return (
      <div style={{ width: '85%' }}>
        {parsed.goal && <GoalPill label={parsed.goal} />}
        {sourceContextText && (
          <div
            className="text-xs text-gray-600 mb-1.5 pl-2 py-1 border-l-2 border-gray-300 bg-gray-50 rounded"
            style={presentation ? PRESENTATION_TEXT.meta : undefined}
            role="note"
            aria-label="Voice reply context"
          >
            <span className="font-medium" aria-hidden="true">
              {isVoiceReply ? '🔊 ' : ''}In reply to:{' '}
            </span>
            {sourceContextText}
          </div>
        )}
        <div
          className="rounded-2xl px-2 py-1 text-gray-800 self-start"
          style={{
            backgroundColor: isHovered ? 'var(--nx-bubble-hover-bg)' : style.bubbleBg,
            width: '100%',
            border: 'var(--nx-bubble-border-width) solid var(--nx-bubble-border)',
          }}
        >
          {renderAssistantMessage(parsed.text)}

          {/* Render media items */}
          {parsed.media && parsed.media.length > 0 && (
            <div
              style={{
                marginTop: '0.5rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem',
              }}
            >
              {parsed.media.map((item, index) => {
                if (item.type === 'image') {
                  return (
                    <img
                      key={`media-${index}`}
                      src={`data:${item.mimeType};base64,${item.data}`}
                      alt="Visual response"
                      style={{
                        maxWidth: '100%',
                        height: 'auto',
                        borderRadius: '8px',
                        border: 'var(--nx-bubble-border-width) solid var(--nx-bubble-border)',
                      }}
                    />
                  );
                }
                // Future: handle audio, video types here
                return null;
              })}
            </div>
          )}
        </div>
      </div>
    );
  };

  // Handler for sending replies
  const handleSendReply = (text: string, parentId: string) => {
    onSendMessage(text, parentId);
  };

  // Handler for opening thread in split view
  const handleOpenThread = (messageId: string) => {
    setSelectedThreadId(messageId);
  };

  // Handler for marking a message as read (called after 1 second of visibility)
  const handleMarkAsRead = (messageId: string) => {
    onMarkAsRead?.(messageId);
  };

  // Handler for closing thread split view
  const handleCloseThread = () => {
    setSelectedThreadId(null);
  };

  // Get the selected thread data
  const selectedThreadReplies = selectedThreadId ? threadMap.get(selectedThreadId) || [] : [];

  return (
    <div className="flex h-full w-full overflow-hidden">
      {/* Main chat panel */}
      <div
        className={`flex flex-col h-full overflow-hidden transition-all duration-300 ${
          selectedThreadId ? 'hidden md:flex md:w-1/2' : 'w-full'
        }`}
      >
        {/* Scrollable messages area */}
        <div className="relative flex flex-col flex-1 overflow-hidden">
          <div
            ref={messagesContainerRef}
            className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden pl-2 pr-2 md:px-8 pt-2 bg-gray-100 dark:bg-nx-base"
          >
            <div
              className="flex flex-col items-start gap-4 pb-2"
              aria-live="assertive"
              data-testid="chat-message-list"
              style={presentation ? PRESENTATION_TEXT.message : undefined}
            >
              {/* Panel title and subtitle */}
              <div className="w-full pt-4 pb-2">
                <h2 className="text-xl font-bold uppercase tracking-wide text-gray-900">
                  Welcome to&nbsp;
                  <span className="text-medium-slate-blue">{eventName || 'Your Event'}</span>
                  &nbsp;Group Chat
                </h2>
                <p className="text-sm text-gray-500 mt-0.5">Chat in real time with other event participants.</p>
              </div>

              {parentMessages.map((message, i) => {
                const showTimestamp = timestampVisibility[i];

                return (
                  <ThreadedMessage
                    key={message.id || `msg-${i}`}
                    message={message}
                    replies={threadMap.get(message.id!) || []}
                    pseudonym={pseudonym}
                    onOpenThread={handleOpenThread}
                    onMarkAsRead={handleMarkAsRead}
                    botName={botName}
                    renderAvatar={renderAvatar}
                    renderMessageContent={renderMessageContent}
                    feedbackConfig={feedbackConfig}
                    showTimestamp={showTimestamp}
                    isThreadOpen={selectedThreadId === message.id}
                    hasUnreadReplies={message.id ? messagesWithUnreadReplies.has(message.id) : false}
                    presentation={presentation}
                    moderation={adminModeration}
                  />
                );
              })}

              {/* Bot loading indicator - appears after last user message (only for main chat) */}
              {waitingForResponse && !waitingForThreadedReply && parentMessages.length > 0 && (
                <div className="relative z-10 flex items-center gap-1 mt-2 mb-1">
                  <BotIcon size={32} color="var(--nx-icon-muted)" bouncing={true} />
                  <span className="text-xs text-gray-500 italic" style={presentation ? PRESENTATION_TEXT.meta : undefined}>
                    thinking...
                  </span>
                </div>
              )}
              {/* Scroll target */}
              <div ref={messagesEndRef} className="h-2" />
            </div>
          </div>
          {!isAtBottom && (
            <Tooltip title="Scroll down to latest messages" arrow>
              <IconButton
                onClick={handleScrollToBottom}
                aria-label="Scroll to latest messages"
                size="medium"
                sx={{
                  position: 'absolute',
                  bottom: 24,
                  right: 24,
                  backgroundColor: 'var(--nx-fab-bg)',
                  color: 'var(--nx-fab-fg)',
                  border: 'var(--nx-fab-border)',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                  '&:hover': { backgroundColor: 'var(--nx-fab-hover-bg)' },
                }}
              >
                <ArrowCircleDownIcon />
              </IconButton>
            </Tooltip>
          )}
        </div>

        {eventScheduledTime && <CountdownBanner eventScheduledTime={eventScheduledTime} presentation={presentation} />}

        {/* MessageInput*/}
        {inactive ? (
          <div className="px-4 py-3 text-sm text-gray-500 italic text-center border-t border-gray-200 dark:border-nx-border-subtle">
            This event is not active.
          </div>
        ) : (
          <div ref={messageInputRef} className="flex-shrink-0">
            {presentation ? (
              inputHidden && (
                <div className="flex justify-center bg-gray-100 px-4 pt-2.5 pb-4 dark:bg-nx-base">
                  <button
                    ref={writeMessageButtonRef}
                    type="button"
                    onClick={() => toggleComposer(false)}
                    aria-expanded="false"
                    className="inline-flex items-center gap-2 rounded-full border border-gray-300 bg-white py-2 pl-4 pr-3.5 text-[15px] font-semibold text-gray-600 shadow-[0_2px_8px_rgba(0,0,0,0.08)] hover:border-nx-input-border hover:text-medium-slate-blue dark:bg-nx-raised"
                  >
                    <EditIcon sx={{ fontSize: 18 }} />
                    Write a message
                    <KeyboardArrowUpIcon sx={{ fontSize: 20 }} />
                  </button>
                </div>
              )
            ) : (
              <div className="flex items-center justify-end border-t border-gray-200 px-2 py-0.5 bg-white dark:border-nx-border-subtle dark:bg-nx-base">
                <Tooltip title={inputHidden ? 'Show input' : 'Hide input'}>
                  <IconButton
                    size="small"
                    onClick={() => setInputHidden((h) => !h)}
                    aria-label={inputHidden ? 'Show input' : 'Hide input'}
                  >
                    {inputHidden ? <KeyboardArrowUpIcon fontSize="small" /> : <KeyboardArrowDownIcon fontSize="small" />}
                  </IconButton>
                </Tooltip>
              </div>
            )}
            {!inputHidden && (
              <MessageInput
                pseudonym={pseudonym}
                pseudonymFunFact={pseudonymFunFact}
                enhancers={enhancers}
                onSendMessage={onSendMessage}
                waitingForResponse={waitingForResponse && !waitingForThreadedReply}
                controlledMode={controlledMode || null}
                onExitControlledMode={onExitControlledMode || (() => {})}
                inputValue={inputValue}
                onInputChange={onInputChange}
                disableWhileWaiting={false}
                onHide={presentation ? () => toggleComposer(true) : undefined}
                shownOnScreen={presentation}
              />
            )}
          </div>
        )}
      </div>

      {/* Thread panel - shown when a thread is selected */}
      {selectedThreadId && selectedThread && (
        <div className="w-full md:w-1/2 h-full">
          <ThreadPanel
            parentMessage={selectedThread}
            replies={selectedThreadReplies}
            pseudonym={pseudonym}
            onClose={handleCloseThread}
            onSendReply={handleSendReply}
            renderAvatar={renderAvatar}
            renderMessageContent={renderMessageContent}
            enhancers={enhancers}
            botName={botName}
            feedbackConfig={feedbackConfig}
            waitingForResponse={!!(waitingForThreadedReply && lastMessage?.parentMessage === selectedThreadId)}
            presentation={presentation}
            moderation={adminModeration}
          />
        </div>
      )}
    </div>
  );
};
