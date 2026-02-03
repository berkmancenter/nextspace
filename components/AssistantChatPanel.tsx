import React, { FC, useMemo } from "react";
import {
  AssistantMessage,
  SubmittedMessage,
  ModeratorSubmittedMessage,
} from "../components/messages";
import { MessageInput } from "./MessageInput";
import {
  SlashCommand,
  createSlashCommandEnhancer,
} from "./enhancers/slashCommandEnhancer";
import { ControlledInputConfig, PseudonymousMessage } from "../types.internal";
import { getAvatarStyle, getAssistantAvatarStyle } from "../utils/avatarUtils";
import { useAutoScroll } from "../hooks/useAutoScroll";

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

interface AssistantChatPanelProps {
  messages: PseudonymousMessage[];
  pseudonym: string | null;
  waitingForResponse: boolean;
  controlledMode: ControlledInputConfig | null;
  slashCommands: SlashCommand[];
  inputValue?: string;
  onInputChange?: (value: string) => void;
  onSendMessage: (message: string) => void;
  onExitControlledMode: () => void;
  onPromptSelect: (prompt: string) => void;
  enterControlledMode: (config: ControlledInputConfig) => void;
  sendFeedbackRating: (messageId: string, rating: string) => void;
}

export const AssistantChatPanel: FC<AssistantChatPanelProps> = ({
  messages,
  pseudonym,
  waitingForResponse,
  controlledMode,
  slashCommands,
  inputValue,
  onInputChange,
  onSendMessage,
  onExitControlledMode,
  onPromptSelect,
  enterControlledMode,
  sendFeedbackRating,
}) => {
  const { messagesEndRef, messagesContainerRef } = useAutoScroll(messages);

  // Create enhancers for assistant mode (slash commands only)
  const enhancers = useMemo(() => {
    const registered = [];
    if (slashCommands.length > 0) {
      registered.push(createSlashCommandEnhancer(slashCommands));
    }
    return registered;
  }, [slashCommands]);

  // Collect all message IDs referenced by moderator_submitted messages
  const submittedIds = messages
    .filter((msg) => {
      if (typeof msg.body === "object" && msg.body !== null) {
        const bodyObj = msg.body as Record<string, any>;
        return bodyObj.type === "moderator_submitted" && bodyObj.message;
      }
      return false;
    })
    .map((msg) => (msg.body as any).message);

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
          {messages
            .filter((message) => !message.parentMessage)
            .map((message, i) => {
              const isAssistant =
                message.pseudonym === "Event Assistant" ||
                message.pseudonym === "Event Assistant Plus";

              const parsed = parseMessageBody(message.body);
              const messageType = parsed.type;
              const style = isAssistant
                ? getAssistantAvatarStyle()
                : getAvatarStyle(message.pseudonym, true);

              // Check if this is a special message type that needs old components
              if (messageType === "moderator_submitted") {
                return (
                  <div key={`msg-${i}`} className="w-full">
                    <ModeratorSubmittedMessage
                      message={{
                        ...message,
                        body: parsed.text,
                      }}
                    />
                  </div>
                );
              }

              if (submittedIds.includes(message.id)) {
                return (
                  <div key={`msg-${i}`} className="w-full">
                    <SubmittedMessage message={message} />
                  </div>
                );
              }

              return (
                <div key={`msg-${i}`} className="w-full">
                  {/* Timestamp centered */}
                  {i === 0 ||
                  new Date(messages[i - 1].createdAt!).getHours() !==
                    new Date(message.createdAt!).getHours() ? (
                    <div className="flex justify-center my-1">
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
                  <div className="flex gap-1.5 mb-1">
                    {/* Avatar */}
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-xl flex-shrink-0"
                      style={{ backgroundColor: style.avatarBg }}
                    >
                      <style.icon fontSize="inherit" />
                    </div>

                    {/* Message content */}
                    <div className="flex flex-col items-start flex-1 min-w-0">
                      {/* Message - white bubble for users, no bubble for EA */}
                      {isAssistant ? (
                        <div className="text-gray-800" style={{ width: "100%", maxWidth: "100%" }}>
                          <AssistantMessage
                            key={`msg-${i}`}
                            message={{
                              ...message,
                              body: parsed.text,
                            }}
                            onPromptSelect={onPromptSelect}
                            onPopulateFeedbackText={enterControlledMode}
                            onSendFeedbackRating={sendFeedbackRating}
                            messageType={parsed.type}
                          />
                        </div>
                      ) : (
                        <div
                          className="rounded-2xl px-2 py-1 text-gray-800 self-start"
                          style={{
                            backgroundColor: "#FFFFFF",
                            width: "100%",
                            maxWidth: "100%",
                          }}
                        >
                          {parsed.text}
                        </div>
                      )}

                      {/* Bot loading indicator - appears after last user message */}
                      {!isAssistant &&
                        waitingForResponse &&
                        i === messages.length - 1 && (
                          <div className="flex items-center gap-1 mt-2 mb-1">
                            <svg
                              viewBox="0 -4 32 36"
                              className="w-8 h-8 text-gray-600"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.5"
                            >
                              {/* Bouncing antenna dot */}
                              <circle
                                cx="16"
                                cy="5.5"
                                r="2"
                                className="animate-bounce"
                                fill="currentColor"
                              />
                              {/* Antenna line */}
                              <line x1="16" y1="7.5" x2="16" y2="10" />
                              {/* Head */}
                              <rect x="8" y="10" width="16" height="12" rx="6" />
                              {/* Eyes */}
                              <circle cx="12" cy="16" r="1.5" fill="currentColor" />
                              <circle cx="20" cy="16" r="1.5" fill="currentColor" />
                              {/* Smile */}
                              <path
                                d="M13 19 Q16 21 19 19"
                                strokeLinecap="round"
                                fill="none"
                              />
                              {/* Arms */}
                              <line x1="8" y1="15" x2="4.5" y2="13" />
                              <line x1="24" y1="15" x2="27.5" y2="13" />
                              {/* Body/Base */}
                              <rect x="13" y="22" width="6" height="5" rx="2" />
                            </svg>
                            <span className="text-xs text-gray-500 italic">thinking...</span>
                          </div>
                        )}
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
          waitingForResponse={waitingForResponse}
          controlledMode={controlledMode}
          onExitControlledMode={onExitControlledMode}
          inputValue={inputValue}
          onInputChange={onInputChange}
        />
      </div>
    </div>
  );
};
