import React, { useEffect, useMemo, useRef, useState } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ThreadedMessage, isReadersMessage } from '../ThreadedMessage';
import { ThreadPanel } from '../ThreadPanel';
import { BotIcon } from '../BotIcon';
import { CommunityMessageInput } from './CommunityMessageInput';
import { MemberIntroContent, PendingRoomMessage, PseudonymousMessage } from '../../types.internal';
import { MemberIntroCard } from './MemberIntroCard';
import { PendingBubble, PendingMessage } from './PendingMessage';
import { parseMessageBody } from '../../utils/Helpers';
import { getRoomInitials } from '../../utils/roomAvatarUtils';
import { useAutoScroll } from '../../hooks/useAutoScroll';
import styles from './communityRoom.module.css';

interface CommunityGroupChatPanelProps {
  messages: PseudonymousMessage[];
  realName: string;
  /** The reader's account id, which decides whose messages are theirs. */
  currentUserId?: string | null;
  botName: string;
  communityName?: string | null;
  /** Member real names, offered as @ mention targets in the composer. */
  mentionTargets: string[];
  /** Messages typed here that the server has not accepted yet. */
  pendingMessages?: PendingRoomMessage[];
  onRetryPendingMessage?: (id: string) => void;
  /** True while the socket is down, which greys out the composer shortcuts. */
  offline?: boolean;
  waitingForResponse?: boolean;
  messagesWithUnreadReplies?: Set<string>;
  onSendMessage: (message: string, parentMessageId?: string) => Promise<boolean>;
  onMarkAsRead?: (messageId: string) => void;
}

const renderMarkdown = (text: string): React.ReactNode => (
  <div className="markdown-content">
    <Markdown
      remarkPlugins={[remarkGfm]}
      components={{
        a: ({ node, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer" style={{ color: '#4845D2' }} />,
      }}
    >
      {text}
    </Markdown>
  </div>
);

const highlightMentions = (text: string, mentionNames: string[]): React.ReactNode => {
  if (mentionNames.length === 0) return text;
  const escaped = [...mentionNames].sort((a, b) => b.length - a.length).map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const pattern = new RegExp(`(@(?:${escaped.join('|')}))`, 'g');
  const parts = text.split(pattern);
  return parts.map((part, i) =>
    part.startsWith('@') && mentionNames.some((n) => part === `@${n}`) ? (
      <span key={i} style={{ color: '#4845D2', fontWeight: 600, textDecoration: 'underline' }}>
        {part}
      </span>
    ) : (
      part
    ),
  );
};

/**
 * The room's group chat feed. Forked from GroupChatPanel because Solar
 * Signal needs a different empty state, avatar palette, and bot bubble
 * treatment (an "AI Bot" pill, no reply feedback row) than the shared
 * panel hardcodes.
 */
function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** "Thursday, 13 August". Assembled from parts because en-GB omits the comma. */
function dayLabel(iso: string): string {
  const date = new Date(iso);
  const weekday = date.toLocaleDateString('en-GB', { weekday: 'long' });
  const dayAndMonth = date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' });
  return `${weekday}, ${dayAndMonth}`;
}

export function CommunityGroupChatPanel({
  messages,
  realName,
  currentUserId,
  botName,
  communityName,
  mentionTargets,
  pendingMessages = [],
  onRetryPendingMessage,
  offline = false,
  waitingForResponse = false,
  messagesWithUnreadReplies = new Set(),
  onSendMessage,
  onMarkAsRead,
}: CommunityGroupChatPanelProps) {
  const [selectedThreadId, setSelectedThreadId] = React.useState<string | null>(null);

  const { parentMessages, threadMap } = useMemo(() => {
    const parents = messages.filter((m) => !m.parentMessage);
    const map = new Map<string, PseudonymousMessage[]>();
    messages
      .filter((m) => m.parentMessage)
      .forEach((reply) => {
        const parentId = reply.parentMessage!;
        if (!map.has(parentId)) map.set(parentId, []);
        map.get(parentId)!.push(reply);
      });
    map.forEach((replies) => replies.sort((a, b) => new Date(a.createdAt!).getTime() - new Date(b.createdAt!).getTime()));
    return { parentMessages: parents, threadMap: map };
  }, [messages]);

  const isEmptyRoom = messages.length === 0 && pendingMessages.length === 0;

  const pendingParents = pendingMessages.filter((m) => !m.parentMessageId);

  // ThreadPanel draws each reply through renderMessageContent, so a queued reply
  // reaches the open thread as a message carrying `pending` rather than through
  // any change to that shared component.
  const pendingRepliesAsMessages = (parentId: string): PseudonymousMessage[] =>
    pendingMessages
      .filter((m) => m.parentMessageId === parentId)
      .map(
        (m) =>
          ({ id: m.id, pseudonym: realName, body: m.body, pending: m.failed ? 'failed' : 'waiting' }) as PseudonymousMessage,
      );

  const { messagesEndRef, messagesContainerRef, isAtBottom, scrollToBottom } = useAutoScroll(messages);
  const messageInputRef = useRef<HTMLDivElement>(null);

  const [hasNewMessages, setHasNewMessages] = useState(false);
  const seenMessageCount = useRef(messages.length);

  // The pill says only that something arrived while the member was reading
  // further up, so the count is kept here and never shown.
  useEffect(() => {
    if (isAtBottom) {
      seenMessageCount.current = messages.length;
      setHasNewMessages(false);
      return;
    }
    if (messages.length > seenMessageCount.current) setHasNewMessages(true);
  }, [messages.length, isAtBottom]);

  const handleScrollToBottom = () => {
    scrollToBottom();
    const input = messageInputRef.current?.querySelector<HTMLElement>('textarea, input, [contenteditable="true"]');
    input?.focus();
  };

  const lastMessage = messages[messages.length - 1];
  const waitingForThreadedReply = waitingForResponse && lastMessage?.parentMessage;

  const renderAvatar = (message: PseudonymousMessage) => {
    const isCurrentUser = isReadersMessage(message, realName, currentUserId);
    const isAssistant = message.fromAgent;

    if (isAssistant) {
      return (
        <div className={styles.avatar} style={{ width: 32, height: 32, background: 'var(--room-berkie-avatar-bg)' }}>
          <BotIcon size={22} color="var(--room-berkie-accent)" />
        </div>
      );
    }

    return (
      <div
        className={styles.avatar}
        style={{
          width: 32,
          height: 32,
          fontSize: 12,
          background: isCurrentUser ? 'var(--room-you-bg)' : 'var(--room-other-avatar-bg)',
          color: isCurrentUser ? 'var(--room-you-text)' : 'var(--room-other-avatar-text)',
        }}
      >
        {getRoomInitials(message.pseudonym || '')}
      </div>
    );
  };

  const renderMessageContent = (message: PseudonymousMessage) => {
    if (message.pending)
      return (
        <PendingBubble
          body={parseMessageBody(message.body).text}
          failed={message.pending === 'failed'}
          failureReason={pendingMessages.find((m) => m.id === message.id)?.failureReason}
          onRetry={onRetryPendingMessage && (() => onRetryPendingMessage(message.id as string))}
        />
      );

    const isAssistant = message.fromAgent;
    const parsed = parseMessageBody(message.body);

    if (isAssistant) {
      return (
        <div style={{ width: '85%' }}>
          <div className={styles.agentBadge} style={{ marginBottom: 4 }}>
            AI Bot
          </div>
          <div
            className="rounded-2xl px-2 py-1"
            style={{
              backgroundColor: 'var(--room-berkie-bubble-bg)',
              border: '1px solid var(--room-berkie-bubble-border)',
              color: 'var(--room-text-body)',
            }}
          >
            {renderMarkdown(parsed.text)}
          </div>
        </div>
      );
    }

    const isCurrentUser = isReadersMessage(message, realName, currentUserId);
    return (
      <div style={{ width: '85%' }}>
        <div
          className="rounded-2xl px-3 py-2"
          style={{
            backgroundColor: isCurrentUser ? 'var(--room-you-bubble-bg)' : 'var(--room-other-bubble-bg)',
            border: `1px solid ${isCurrentUser ? 'var(--room-you-bubble-border)' : 'var(--room-other-bubble-border)'}`,
            color: 'var(--room-text-body)',
          }}
        >
          {highlightMentions(parsed.text, [...mentionTargets, botName])}
        </div>
      </div>
    );
  };

  const handleSendReply = (text: string, parentId: string) => {
    onSendMessage(text, parentId);
  };

  const handleMarkAsRead = (messageId: string) => {
    onMarkAsRead?.(messageId);
  };

  const selectedThread = selectedThreadId ? parentMessages.find((m) => m.id === selectedThreadId) : null;
  const selectedThreadReplies = selectedThreadId
    ? [...(threadMap.get(selectedThreadId) || []), ...pendingRepliesAsMessages(selectedThreadId)]
    : [];

  return (
    <div className="flex h-full w-full overflow-hidden">
      <div
        className={`flex flex-col h-full overflow-hidden transition-all duration-300 ${
          selectedThreadId ? 'hidden md:flex md:w-1/2' : 'w-full'
        }`}
      >
        <div className="relative flex flex-col flex-1 overflow-hidden">
          <div ref={messagesContainerRef} className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-3 md:px-8 pt-2">
            {isEmptyRoom ? (
              <div className="flex flex-col justify-center h-full gap-3 px-1 py-6">
                <h2
                  style={{
                    fontFamily: 'var(--room-font-display), sans-serif',
                    fontWeight: 600,
                    fontSize: 20,
                    color: 'var(--room-text-primary)',
                  }}
                >
                  A permanent room for {communityName ? `the ${communityName}` : 'your'} community.
                </h2>
                <p style={{ fontFamily: 'var(--room-font-body), sans-serif', fontSize: 15, color: 'var(--room-text-body)' }}>
                  {
                    "No schedule, no end. It sits between events and keeps whatever you leave in it, so it's worth writing the thing you'd otherwise email to four people."
                  }
                </p>
                <div style={{ height: 1, background: 'var(--room-chrome-border)' }} />
                <p
                  style={{ fontFamily: 'var(--room-font-body), sans-serif', fontSize: 13, color: 'var(--room-text-muted)' }}
                >
                  {"Nothing has been said yet. You're first."}
                </p>
                <p
                  style={{ fontFamily: 'var(--room-font-body), sans-serif', fontSize: 13, color: 'var(--room-text-muted)' }}
                >
                  {botName} is here too. It stays quiet unless you put{' '}
                  <span style={{ fontWeight: 600, color: 'var(--room-text-primary)' }}>@{botName}</span> in a message.
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-start gap-4 pb-2" aria-live="polite">
                {parentMessages.map((message, i) => {
                  const key = message.id || `msg-${i}`;
                  const previousStamp = i > 0 ? parentMessages[i - 1].createdAt : undefined;
                  const startsNewDay =
                    !!message.createdAt &&
                    (!previousStamp || !isSameDay(new Date(previousStamp), new Date(message.createdAt)));
                  const dayDivider = startsNewDay ? (
                    <div className={styles.dayDivider}>{dayLabel(message.createdAt!)}</div>
                  ) : null;

                  const parsedBody = parseMessageBody(message.body);
                  if (parsedBody.type === 'memberIntro' && parsedBody.content) {
                    const intro = parsedBody.content as MemberIntroContent;
                    return (
                      <React.Fragment key={key}>
                        {dayDivider}
                        <MemberIntroCard
                          name={intro.name}
                          role={intro.role}
                          joinedLabel={intro.joinedLabel}
                          bio={intro.bio}
                        />
                      </React.Fragment>
                    );
                  }

                  const showTimestamp = (() => {
                    if (!message.createdAt) return false;
                    if (i === 0) return true;
                    const prevDate = new Date(parentMessages[i - 1].createdAt!);
                    const currDate = new Date(message.createdAt!);
                    return prevDate.getHours() !== currDate.getHours() || prevDate.getMinutes() !== currDate.getMinutes();
                  })();

                  return (
                    <React.Fragment key={key}>
                      {dayDivider}
                      <ThreadedMessage
                        message={message}
                        replies={threadMap.get(message.id!) || []}
                        pseudonym={realName}
                        currentUserId={currentUserId}
                        onOpenThread={setSelectedThreadId}
                        onMarkAsRead={handleMarkAsRead}
                        botName={botName}
                        renderAvatar={renderAvatar}
                        renderMessageContent={renderMessageContent}
                        showTimestamp={showTimestamp}
                        isThreadOpen={selectedThreadId === message.id}
                        hasUnreadReplies={message.id ? messagesWithUnreadReplies.has(message.id) : false}
                      />
                    </React.Fragment>
                  );
                })}

                {pendingParents.map((pending) => (
                  <PendingMessage
                    key={pending.id}
                    body={pending.body}
                    realName={realName}
                    failed={pending.failed}
                    failureReason={pending.failureReason}
                    onRetry={onRetryPendingMessage && (() => onRetryPendingMessage(pending.id))}
                  />
                ))}

                {waitingForResponse && !waitingForThreadedReply && parentMessages.length > 0 && (
                  <div className="relative z-10 flex items-center gap-1 mt-2 mb-1">
                    <BotIcon size={28} color="var(--room-berkie-accent)" bouncing />
                    <span style={{ fontSize: 12, fontStyle: 'italic', color: 'var(--room-text-muted)' }}>thinking...</span>
                  </div>
                )}
                <div ref={messagesEndRef} className="h-2" />
              </div>
            )}
          </div>
          {!isAtBottom && !isEmptyRoom && (
            <button
              type="button"
              onClick={handleScrollToBottom}
              className={styles.jumpPill}
              aria-label={hasNewMessages ? 'Jump to latest messages, new messages below' : 'Jump to latest messages'}
            >
              Jump to latest
              {hasNewMessages && <span aria-hidden="true" className={styles.jumpPillDot} />}
            </button>
          )}
        </div>

        <div ref={messageInputRef} className="flex-shrink-0">
          <CommunityMessageInput
            tab="chat"
            realName={realName}
            mentionTargets={mentionTargets}
            onSendMessage={onSendMessage}
            isEmptyRoom={isEmptyRoom}
            offline={offline}
            waitingForResponse={waitingForResponse && !waitingForThreadedReply}
          />
        </div>
      </div>

      {selectedThreadId && selectedThread && (
        <div className="w-full md:w-1/2 h-full">
          <ThreadPanel
            parentMessage={selectedThread}
            replies={selectedThreadReplies}
            pseudonym={realName}
            currentUserId={currentUserId}
            onClose={() => setSelectedThreadId(null)}
            onSendReply={handleSendReply}
            renderAvatar={renderAvatar}
            renderMessageContent={renderMessageContent}
            enhancers={[]}
            botName={botName}
            waitingForResponse={!!(waitingForThreadedReply && lastMessage?.parentMessage === selectedThreadId)}
          />
        </div>
      )}
    </div>
  );
}
