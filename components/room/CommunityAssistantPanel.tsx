import React, { useMemo } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ThreadedMessage } from '../ThreadedMessage';
import { BotIcon } from '../BotIcon';
import { CommunityMessageInput } from './CommunityMessageInput';
import { PendingMessage } from './PendingMessage';
import { PendingRoomMessage, PseudonymousMessage } from '../../types.internal';
import { parseMessageBody } from '../../utils/Helpers';
import { getRoomInitials } from '../../utils/roomAvatarUtils';
import { useAutoScroll } from '../../hooks/useAutoScroll';
import styles from './communityRoom.module.css';

interface CommunityAssistantPanelProps {
  messages: PseudonymousMessage[];
  realName: string;
  botName: string;
  /** Messages typed here that the server has not accepted yet. */
  pendingMessages?: PendingRoomMessage[];
  waitingForResponse?: boolean;
  onSendMessage: (message: string) => Promise<boolean>;
}

const SUGGESTION_CHIPS = ['What did I miss this week?', 'Who has joined recently?', 'Who here works on procurement?'];

const renderMarkdown = (text: string): React.ReactNode => (
  <div className="markdown-content">
    <Markdown remarkPlugins={[remarkGfm]}>{text}</Markdown>
  </div>
);

/**
 * The room's private 1:1 with Berkie. Forked from AssistantChatPanel for the
 * same reason as CommunityGroupChatPanel: Solar Signal's empty state,
 * avatar palette, and "AI agent" pill don't fit through the shared panel's
 * existing props.
 */
export function CommunityAssistantPanel({
  messages,
  realName,
  botName,
  pendingMessages = [],
  waitingForResponse = false,
  onSendMessage,
}: CommunityAssistantPanelProps) {
  const isEmpty = messages.length === 0 && pendingMessages.length === 0;
  const { messagesEndRef, messagesContainerRef } = useAutoScroll(messages);

  const parentMessages = useMemo(() => messages.filter((m) => !m.parentMessage), [messages]);

  const renderAvatar = (message: PseudonymousMessage) => {
    if (message.fromAgent) {
      return (
        <div className={styles.avatar} style={{ width: 32, height: 32, background: 'var(--room-berkie-avatar-bg)' }}>
          <BotIcon size={22} color="var(--room-berkie-accent)" />
        </div>
      );
    }
    return (
      <div
        className={styles.avatar}
        style={{ width: 32, height: 32, fontSize: 12, background: 'var(--room-you-bg)', color: 'var(--room-you-text)' }}
      >
        {getRoomInitials(realName)}
      </div>
    );
  };

  const renderMessageContent = (message: PseudonymousMessage) => {
    const parsed = parseMessageBody(message.body);

    if (message.fromAgent) {
      return (
        <div style={{ width: '85%' }}>
          <div className={styles.badge} style={{ display: 'inline-block', marginBottom: 4 }}>
            AI agent
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

    return (
      <div style={{ width: '85%' }}>
        <div
          className="rounded-2xl px-3 py-2"
          style={{
            backgroundColor: 'var(--room-you-bubble-bg)',
            border: '1px solid var(--room-you-bubble-border)',
            color: 'var(--room-text-body)',
          }}
        >
          {parsed.text}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full w-full overflow-hidden">
      <div ref={messagesContainerRef} className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-3 md:px-8 pt-2">
        {isEmpty ? (
          <div className="flex flex-col justify-center h-full gap-4 px-1 py-6">
            <div className="flex items-center gap-2.5">
              <div className={styles.avatar} style={{ width: 40, height: 40, background: 'var(--room-berkie-avatar-bg)' }}>
                <BotIcon size={26} color="var(--room-berkie-accent)" />
              </div>
              <h2
                style={{
                  fontFamily: 'var(--room-font-display), sans-serif',
                  fontWeight: 600,
                  fontSize: 18,
                  color: 'var(--room-text-primary)',
                }}
              >
                {"I read the room, so you don't have to."}
              </h2>
            </div>
            <p style={{ fontFamily: 'var(--room-font-body), sans-serif', fontSize: 14, color: 'var(--room-text-body)' }}>
              Everything posted in Group Chat is what I know. Nothing you say here is visible to anyone else in the room.
            </p>
            <div className="flex flex-col gap-2">
              {SUGGESTION_CHIPS.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => onSendMessage(chip)}
                  style={{
                    minHeight: 44,
                    textAlign: 'left',
                    padding: '10px 14px',
                    background: 'var(--room-chrome-bg)',
                    border: '1px solid var(--room-chrome-border)',
                    borderRadius: 999,
                    fontFamily: 'var(--room-font-body), sans-serif',
                    fontSize: 14,
                    fontWeight: 500,
                    color: 'var(--room-text-primary)',
                    cursor: 'pointer',
                  }}
                >
                  {chip}
                </button>
              ))}
            </div>
            <p style={{ fontFamily: 'var(--room-font-body), sans-serif', fontSize: 12, color: 'var(--room-text-muted)' }}>
              {
                "I can be wrong, and I can't see anything outside this room — no email, no publications, no other Nextspace events."
              }
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-start gap-4 pb-2" aria-live="polite">
            {parentMessages.map((message, i) => {
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
                  replies={[]}
                  pseudonym={realName}
                  botName={botName}
                  renderAvatar={renderAvatar}
                  renderMessageContent={renderMessageContent}
                  showTimestamp={showTimestamp}
                />
              );
            })}

            {pendingMessages.map((pending) => (
              <PendingMessage key={pending.id} body={pending.body} realName={realName} />
            ))}

            {waitingForResponse && (
              <div className="relative z-10 flex items-center gap-1 mt-2 mb-1">
                <BotIcon size={28} color="var(--room-berkie-accent)" bouncing />
                <span style={{ fontSize: 12, fontStyle: 'italic', color: 'var(--room-text-muted)' }}>thinking...</span>
              </div>
            )}
            <div ref={messagesEndRef} className="h-2" />
          </div>
        )}
      </div>

      <div className="flex-shrink-0">
        <CommunityMessageInput
          tab="assistant"
          realName={realName}
          mentionTargets={[]}
          onSendMessage={onSendMessage}
          waitingForResponse={waitingForResponse}
        />
      </div>
    </div>
  );
}
