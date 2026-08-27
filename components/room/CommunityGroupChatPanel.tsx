import React, { useMemo, useRef } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ThreadedMessage } from '../ThreadedMessage';
import { ThreadPanel } from '../ThreadPanel';
import { BotIcon } from '../BotIcon';
import { CommunityMessageInput } from './CommunityMessageInput';
import { MemberIntroContent, PendingRoomMessage, PseudonymousMessage } from '../../types.internal';
import { MemberIntroCard } from './MemberIntroCard';
import { PendingMessage } from './PendingMessage';
import { parseMessageBody } from '../../utils/Helpers';
import { getRoomInitials } from '../../utils/roomAvatarUtils';
import { useAutoScroll } from '../../hooks/useAutoScroll';
import styles from './communityRoom.module.css';

interface CommunityGroupChatPanelProps {
  messages: PseudonymousMessage[];
  realName: string;
  botName: string;
  /** Count of invited room members, shown in the empty-state hero when known. */
  memberCount?: number;
  /** Member real names, offered as @ mention targets in the composer. */
  mentionTargets: string[];
  /** Messages typed here that the server has not accepted yet. */
  pendingMessages?: PendingRoomMessage[];
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
 * Signal needs a different empty state, avatar palette, and Berkie bubble
 * treatment (an "AI Bot" pill, no reply feedback row) than the shared
 * panel hardcodes.
 */
export function CommunityGroupChatPanel({
  messages,
  realName,
  botName,
  memberCount,
  mentionTargets,
  pendingMessages = [],
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

  const { messagesEndRef, messagesContainerRef, isAtBottom, scrollToBottom } = useAutoScroll(messages);
  const messageInputRef = useRef<HTMLDivElement>(null);

  const handleScrollToBottom = () => {
    scrollToBottom();
    const input = messageInputRef.current?.querySelector<HTMLElement>('textarea, input, [contenteditable="true"]');
    input?.focus();
  };

  const lastMessage = messages[messages.length - 1];
  const waitingForThreadedReply = waitingForResponse && lastMessage?.parentMessage;

  const renderAvatar = (message: PseudonymousMessage) => {
    const isCurrentUser = message.pseudonym === realName;
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

    const isCurrentUser = message.pseudonym === realName;
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
  const selectedThreadReplies = selectedThreadId ? threadMap.get(selectedThreadId) || [] : [];

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
                  A permanent room for the Berkman Klein community.
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
                  {memberCount != null
                    ? `${memberCount} members have been invited. Nothing has been said yet — you're first.`
                    : "Nothing has been said yet — you're first."}
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
                  const parsedBody = parseMessageBody(message.body);
                  if (parsedBody.type === 'memberIntro' && parsedBody.content) {
                    const intro = parsedBody.content as MemberIntroContent;
                    return (
                      <MemberIntroCard
                        key={message.id || `msg-${i}`}
                        name={intro.name}
                        role={intro.role}
                        joinedLabel={intro.joinedLabel}
                        bio={intro.bio}
                      />
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
                    <ThreadedMessage
                      key={message.id || `msg-${i}`}
                      message={message}
                      replies={threadMap.get(message.id!) || []}
                      pseudonym={realName}
                      onOpenThread={setSelectedThreadId}
                      onMarkAsRead={handleMarkAsRead}
                      botName={botName}
                      renderAvatar={renderAvatar}
                      renderMessageContent={renderMessageContent}
                      showTimestamp={showTimestamp}
                      isThreadOpen={selectedThreadId === message.id}
                      hasUnreadReplies={message.id ? messagesWithUnreadReplies.has(message.id) : false}
                    />
                  );
                })}

                {pendingMessages.map((pending) => (
                  <PendingMessage key={pending.id} body={pending.body} realName={realName} />
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
              aria-label={
                messages.length > parentMessages.length ? `${messages.length} new messages` : 'Jump to latest messages'
              }
            >
              Jump to latest
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
