import React, { FC, useMemo } from "react";
import Linkify from "linkify-react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { MessageInput } from "./MessageInput";
import { PseudonymousMessage } from "../types.internal";
import { getAvatarStyle, getAssistantAvatarStyle } from "../utils/avatarUtils";
import { useAutoScroll } from "../hooks/useAutoScroll";
import { createMentionsEnhancer } from "./enhancers/mentionsEnhancer";

/**
 * Parsed message body structure
 * @property {string} text - The actual text content of the message
 * @property {string} [type] - Optional type for styling (e.g., "moderator_submitted")
 * @property {string} [message] - Optional message ID reference
 */
interface ParsedMessageBody {
  text: string;
  type?: string;
  message?: string;
}

/**
 * Parse the message body to extract text content and metadata
 * Handles both string and object formats
 */
const parseMessageBody = (body: string | object): ParsedMessageBody => {
  // Handle object input
  if (body && typeof body === "object") {
    const obj = body as Record<string, any>;

    return {
      text: obj.text?.toString() || "",
      type: obj.type?.toString(),
      message: obj.message?.toString(),
    };
  }

  // Handle string input
  return {
    text: typeof body === "string" ? body : String(body),
  };
};

/**
 * Parse message text and highlight @mentions with linkification
 * Handles two-word pseudonyms (e.g., @John Doe) and converts URLs to clickable links
 */
const renderMessageWithMentions = (text: string): React.ReactNode => {
  // Split by @mention pattern - matches @word or @word word
  const parts = text.split(/(@\w+(?:\s+\w+)?)/g);

  return parts.map((part, index) => {
    // Check if this part is a mention
    if (part.startsWith("@")) {
      return (
        <span
          key={index}
          className="font-semibold"
          style={{ color: "#7C3AED" }}
        >
          {part}
        </span>
      );
    }
    // Apply linkification to non-mention text
    return (
      <Linkify
        key={index}
        options={{
          attributes: {
            class: "text-medium-slate-blue",
            target: "_blank",
            rel: "noopener noreferrer",
          },
        }}
      >
        {part}
      </Linkify>
    );
  });
};

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
  inputValue?: string;
  onInputChange?: (value: string) => void;
  onSendMessage: (message: string) => void;
}

export const GroupChatPanel: FC<GroupChatPanelProps> = ({
  messages,
  pseudonym,
  eventName,
  inputValue,
  onInputChange,
  onSendMessage,
}) => {
  const { messagesEndRef, messagesContainerRef } = useAutoScroll(messages);

  // Extract unique contributors for mentions
  // Normalize "Event Assistant Plus" to "Event Assistant" for consistency
  const contributors = useMemo(
    () =>
      Array.from(
        new Set(
          messages
            .map((m) => {
              if (m.pseudonym === "Event Assistant Plus") {
                return "Event Assistant";
              }
              return m.pseudonym;
            })
            .filter(Boolean),
        ),
      ),
    [messages],
  );

  // Create enhancers for chat mode (mentions only)
  const enhancers = useMemo(() => {
    const registered = [];
    if (contributors.length > 0) {
      registered.push(createMentionsEnhancer(contributors));
    }
    return registered;
  }, [contributors]);

  // Helper to render avatar for chat mode
  const renderAvatar = (message: PseudonymousMessage) => {
    const isCurrentUser = message.pseudonym === pseudonym;
    const isAssistant =
      message.pseudonym === "Event Assistant" ||
      message.pseudonym === "Event Assistant Plus";

    const style = isAssistant
      ? getAssistantAvatarStyle()
      : getAvatarStyle(message.pseudonym || "", isCurrentUser);

    const Icon = style.icon;

    return (
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center text-xl flex-shrink-0"
        style={{ backgroundColor: style.avatarBg }}
      >
        <Icon fontSize="inherit" />
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full w-full overflow-hidden">
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

          {messages
            .filter((message) => !message.parentMessage)
            .map((message, i) => {
              const parsed = parseMessageBody(message.body);
              const isCurrentUser = message.pseudonym === pseudonym;
              const isAssistant =
                message.pseudonym === "Event Assistant" ||
                message.pseudonym === "Event Assistant Plus";

              const style = isAssistant
                ? getAssistantAvatarStyle()
                : getAvatarStyle(message.pseudonym || "", isCurrentUser);

              // Normalize EA Plus to EA
              const displayName =
                message.pseudonym === "Event Assistant Plus"
                  ? "Event Assistant"
                  : message.pseudonym;

              return (
                <div key={`msg-${i}`} className="w-full">
                  {/* Timestamp centered */}
                  {(() => {
                    if (i === 0) return true;
                    const prevDate = new Date(messages[i - 1].createdAt!);
                    const currDate = new Date(message.createdAt!);
                    return (
                      prevDate.getHours() !== currDate.getHours() ||
                      prevDate.getMinutes() !== currDate.getMinutes()
                    );
                  })() ? (
                    <div className="flex justify-center my-1">
                      <span className="text-sm text-gray-400">
                        {new Date(message.createdAt!).toLocaleTimeString(
                          "en-US",
                          {
                            hour: "2-digit",
                            minute: "2-digit",
                          },
                        )}
                      </span>
                    </div>
                  ) : null}

                  {/* Message with avatar */}
                  <div
                    className={`flex gap-1.5 mb-1 ${
                      isCurrentUser ? "flex-row-reverse" : "flex-row"
                    }`}
                  >
                    {/* Avatar */}
                    {renderAvatar(message)}

                    {/* Message content */}
                    <div
                      className={`flex flex-col ${
                        isCurrentUser ? "items-end" : "items-start"
                      } flex-1`}
                    >
                      {/* Name */}
                      <div
                        className={`text-sm font-bold mb-1 ${
                          isCurrentUser ? "text-right" : "text-left"
                        }`}
                      >
                        {displayName}
                        {isCurrentUser && (
                          <span className="text-gray-600 font-normal">
                            {" "}
                            (You)
                          </span>
                        )}
                      </div>

                      {/* Message bubble */}
                      <div
                        className={`rounded-2xl px-2 py-1 text-gray-800 ${
                          isCurrentUser ? "self-end" : "self-start"
                        }`}
                        style={{
                          backgroundColor: style.bubbleBg,
                          width: "85%",
                          border: "1px solid rgba(0, 0, 0, 0.1)",
                        }}
                      >
                        {isAssistant
                          ? renderAssistantMessage(parsed.text)
                          : renderMessageWithMentions(parsed.text)}
                      </div>
                    </div>
                  </div>
                </div>
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
          controlledMode={null}
          onExitControlledMode={() => {}}
          inputValue={inputValue}
          onInputChange={onInputChange}
        />
      </div>
    </div>
  );
};
