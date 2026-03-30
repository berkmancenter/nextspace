import React, { FC, useMemo } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { MessageInput } from "./MessageInput";
import { ThreadedMessage } from "./ThreadedMessage";
import { ThreadPanel } from "./ThreadPanel";
import { UserMessage } from "./messages/UserMessage";
import {
  PseudonymousMessage,
  ControlledInputConfig,
  FeedbackConfig,
} from "../types.internal";
import { getAvatarStyle, getAssistantAvatarStyle } from "../utils/avatarUtils";
import { useAutoScroll } from "../hooks/useAutoScroll";
import { BotIcon } from "./BotIcon";
import { createMentionsEnhancer } from "./enhancers/mentionsEnhancer";
import {
  normalizeAssistantPseudonym,
  parseMessageBody,
} from "../utils/Helpers";

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
            <a
              {...props}
              className="text-medium-slate-blue"
              target="_blank"
              rel="noopener noreferrer"
            />
          ),
        }}
      >
        {text}
      </Markdown>
    </div>
  );
};

interface GroupChatPanelProps {
  messages: PseudonymousMessage[];
  pseudonym: string | null;
  eventName?: string;
  botName?: string;
  inputValue?: string;
  onInputChange?: (value: string) => void;
  onSendMessage: (message: string, parentMessageId?: string) => void;
  controlledMode?: ControlledInputConfig | null;
  onExitControlledMode?: () => void;
  feedbackConfig?: FeedbackConfig;
  messagesWithUnreadReplies?: Set<string>;
  onMarkAsRead?: (messageId: string) => void;
}

export const GroupChatPanel: FC<GroupChatPanelProps> = ({
  messages,
  pseudonym,
  eventName,
  botName = "Berkie",
  inputValue,
  onInputChange,
  onSendMessage,
  controlledMode,
  onExitControlledMode,
  feedbackConfig,
  messagesWithUnreadReplies = new Set(),
  onMarkAsRead,
}) => {
  // State for tracking which thread is open in split view
  const [selectedThreadId, setSelectedThreadId] = React.useState<string | null>(
    null,
  );

  // Extract unique contributors for mentions
  // Normalize "Event Assistant Plus" and "Mediators" to "Event Assistant" for consistency
  const contributors = useMemo(
    () =>
      Array.from(
        new Set(
          messages
            .map((m) => normalizeAssistantPseudonym(m, botName))
            .filter(Boolean),
        ),
      ),
    [messages],
  );

  // Always register the mentions enhancer so the @ button is visible from the
  // start. The enhancer's getItems() will simply return an empty list until
  // contributors are known (i.e. until messages have loaded).
  const enhancers = useMemo(
    () => [createMentionsEnhancer(contributors)],
    [contributors],
  );

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
      replies.sort(
        (a, b) =>
          new Date(a.createdAt!).getTime() - new Date(b.createdAt!).getTime(),
      );
    });

    return { parentMessages: parents, threadMap: map };
  }, [messages]);


  // Auto-scroll based on parent messages only (not threaded replies)
  const { messagesEndRef, messagesContainerRef } = useAutoScroll(parentMessages);

  // Helper to render avatar for chat mode
  const renderAvatar = (message: PseudonymousMessage) => {
    const isCurrentUser = message.pseudonym === pseudonym;
    const isAssistant = message.fromAgent;

    const style = isAssistant
      ? getAssistantAvatarStyle()
      : getAvatarStyle(message.pseudonym || "", isCurrentUser);

    return (
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: style.avatarBg }}
      >
        {isAssistant ? (
          <BotIcon size={22} color="#4b5563" />
        ) : (
          <style.icon fontSize="inherit" />
        )}
      </div>
    );
  };

  // Helper to render message content bubble
  const renderMessageContent = (
    message: PseudonymousMessage,
    isHovered?: boolean,
  ) => {
    const isCurrentUser = message.pseudonym === pseudonym;
    const isAssistant = message.fromAgent;
    const parsed = parseMessageBody(message.body);

    const style = isAssistant
      ? getAssistantAvatarStyle()
      : getAvatarStyle(message.pseudonym || "", isCurrentUser);

    // User messages - use UserMessage component
    if (!isAssistant) {
      return (
        <UserMessage
          message={message}
          contributors={contributors}
          backgroundColor={style.bubbleBg}
          isHovered={isHovered}
        />
      );
    }

    // Assistant messages
    return (
      <div
        className="rounded-2xl px-2 py-1 text-gray-800 self-start"
        style={{
          backgroundColor: isHovered ? "white" : style.bubbleBg,
          width: "85%",
          border: "1px solid rgba(0, 0, 0, 0.1)",
        }}
      >
        {renderAssistantMessage(parsed.text)}

        {/* Render media items */}
        {parsed.media && parsed.media.length > 0 && (
          <div
            style={{
              marginTop: "0.5rem",
              display: "flex",
              flexDirection: "column",
              gap: "0.5rem",
            }}
          >
            {parsed.media.map((item, index) => {
              if (item.type === "image") {
                return (
                  <img
                    key={`media-${index}`}
                    src={`data:${item.mimeType};base64,${item.data}`}
                    alt="Visual response"
                    style={{
                      maxWidth: "100%",
                      height: "auto",
                      borderRadius: "8px",
                      border: "1px solid rgba(0, 0, 0, 0.1)",
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
  const selectedThread = selectedThreadId
    ? parentMessages.find((m) => m.id === selectedThreadId)
    : null;
  const selectedThreadReplies = selectedThreadId
    ? threadMap.get(selectedThreadId) || []
    : [];

  return (
    <div className="flex h-full w-full overflow-hidden">
      {/* Main chat panel */}
      <div
        className={`flex flex-col h-full overflow-hidden transition-all duration-300 ${
          selectedThreadId ? "hidden md:flex md:w-1/2" : "w-full"
        }`}
      >
        {/* Scrollable messages area */}
        <div
          ref={messagesContainerRef}
          className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden pl-2 pr-2 md:px-8 pt-2 bg-gray-100"
        >
          <div
            className="flex flex-col items-start gap-4 pb-2"
            aria-live="assertive"
          >
            {/* Panel title and subtitle */}
            <div className="w-full pt-4 pb-2">
              <h2 className="text-xl font-bold uppercase tracking-wide text-gray-900">
                Welcome to&nbsp;
                <span className="text-medium-slate-blue">
                  {eventName || "Your Event"}
                </span>
                &nbsp;Group Chat
              </h2>
              <p className="text-sm text-gray-500 mt-0.5">
                Chat in real time with other event participants.
              </p>
            </div>

            {parentMessages.map((message, i) => {
              // Determine if we should show timestamp
              const showTimestamp = (() => {
                if (i === 0) return true;
                const prevDate = new Date(parentMessages[i - 1].createdAt!);
                const currDate = new Date(message.createdAt!);
                return (
                  prevDate.getHours() !== currDate.getHours() ||
                  prevDate.getMinutes() !== currDate.getMinutes()
                );
              })();

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
                />
              );
            })}
            {/* Scroll target */}
            <div ref={messagesEndRef} className="h-2" />
          </div>
        </div>

        {/* MessageInput*/}
        <div className="flex-shrink-0">
          <MessageInput
            pseudonym={pseudonym}
            enhancers={enhancers}
            onSendMessage={onSendMessage}
            waitingForResponse={false}
            controlledMode={controlledMode || null}
            onExitControlledMode={onExitControlledMode || (() => {})}
            inputValue={inputValue}
            onInputChange={onInputChange}
          />
        </div>
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
          />
        </div>
      )}
    </div>
  );
};
