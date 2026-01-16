import React, { FC, useMemo } from "react";
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
 * Parse message text and highlight @mentions
 * Handles two-word pseudonyms (e.g., @John Doe)
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
    return <span key={index}>{part}</span>;
  });
};

interface GroupChatPanelProps {
  messages: PseudonymousMessage[];
  pseudonym: string | null;
  inputValue?: string;
  onInputChange?: (value: string) => void;
  onSendMessage: (message: string) => void;
}

export const GroupChatPanel: FC<GroupChatPanelProps> = ({
  messages,
  pseudonym,
  inputValue,
  onInputChange,
  onSendMessage,
}) => {
  const { messagesEndRef, messagesContainerRef } = useAutoScroll(messages);

  // Extract unique contributors for mentions
  // Normalize "Event Assistant Plus" to "Event Assistant" for consistency
  const contributors = useMemo(
    () => Array.from(new Set(messages.map((m) => {
      if (m.pseudonym === "Event Assistant Plus") {
        return "Event Assistant";
      }
      return m.pseudonym;
    }).filter(Boolean))),
    [messages]
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
        className="w-12 h-12 rounded-full flex items-center justify-center text-3xl flex-shrink-0"
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
        className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden pl-2 pr-2 md:px-8 pt-4 bg-gray-100"
      >
        <div
          className="flex flex-col items-start gap-8 pb-2"
          aria-live="assertive"
        >
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
                  {i === 0 ||
                  new Date(messages[i - 1].createdAt!).getHours() !==
                    new Date(message.createdAt!).getHours() ? (
                    <div className="flex justify-center my-4">
                      <span className="text-sm text-gray-400">
                        {new Date(message.createdAt!).toLocaleTimeString(
                          "en-US",
                          {
                            hour: "2-digit",
                            minute: "2-digit",
                          }
                        )}
                      </span>
                    </div>
                  ) : null}

                  {/* Message with avatar */}
                  <div
                    className={`flex gap-3 mb-4 ${
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
                        className={`rounded-2xl px-4 py-3 text-gray-800 ${
                          isCurrentUser ? "self-end" : "self-start"
                        }`}
                        style={{
                          backgroundColor: style.bubbleBg,
                          width: "85%",
                          border: "1px solid rgba(0, 0, 0, 0.1)",
                        }}
                      >
                        {renderMessageWithMentions(parsed.text)}
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
