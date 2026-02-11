import React, { FC, useMemo } from "react";
import {
  AssistantMessage,
  SubmittedMessage,
  ModeratorSubmittedMessage,
} from "../components/messages";
import { MessageFeedback } from "./MessageFeedback";
import { MessageInput } from "./MessageInput";
import {
  SlashCommand,
  createSlashCommandEnhancer,
} from "./enhancers/slashCommandEnhancer";
import { ControlledInputConfig, PseudonymousMessage } from "../types.internal";
import { getAvatarStyle, getAssistantAvatarStyle } from "../utils/avatarUtils";
import { useAutoScroll } from "../hooks/useAutoScroll";
import {
  isAssistantPseudonym,
  normalizeAssistantPseudonym,
} from "../utils/Helpers";

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
  eventName?: string;
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
  eventName,
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
          {/* Panel title and subtitle */}
          <div className="w-full pt-4 pb-2">
            <h2 className="text-xl font-bold uppercase tracking-wide text-gray-900">
              Welcome to&nbsp;
              <span className="text-medium-slate-blue">
                {eventName || "Your Event"}
              </span>
              &nbsp;
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Ask the Event Assistant any questions about the event — this
              conversation is private.
            </p>
          </div>

          {messages
            .filter((message) => !message.parentMessage)
            .map((message, i) => {
              const isAssistant = isAssistantPseudonym(message.pseudonym);
              const isCurrentUser = message.pseudonym === pseudonym;

              const parsed = parseMessageBody(message.body);
              const messageType = parsed.type;
              const style = isAssistant
                ? getAssistantAvatarStyle()
                : getAvatarStyle(message.pseudonym, isCurrentUser);

              const displayName = normalizeAssistantPseudonym(message.pseudonym);

              const hasPromptOptions =
                message.prompt?.options &&
                message.prompt.options.length > 0 &&
                message.prompt.type === "singleChoice";

              // Special message types rendered in the same avatar+name layout
              if (
                messageType === "moderator_submitted" ||
                submittedIds.includes(message.id)
              ) {
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

                    <div
                      className={`flex gap-1.5 mb-1 ${
                        isCurrentUser ? "flex-row-reverse" : "flex-row"
                      }`}
                    >
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-xl flex-shrink-0"
                        style={{ backgroundColor: style.avatarBg }}
                      >
                        <style.icon fontSize="inherit" />
                      </div>
                      <div
                        className={`flex flex-col ${
                          isCurrentUser ? "items-end" : "items-start"
                        } flex-1 min-w-0`}
                      >
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
                        <div style={{ width: "85%" }}>
                          {messageType === "moderator_submitted" ? (
                            <ModeratorSubmittedMessage
                              message={{
                                ...message,
                                body: parsed.text,
                              }}
                            />
                          ) : (
                            <SubmittedMessage message={message} />
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              }

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
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-xl flex-shrink-0"
                      style={{ backgroundColor: style.avatarBg }}
                    >
                      <style.icon fontSize="inherit" />
                    </div>

                    {/* Message content */}
                    <div
                      className={`flex flex-col ${
                        isCurrentUser ? "items-end" : "items-start"
                      } flex-1 min-w-0`}
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
                      {isAssistant ? (
                        <>
                          {hasPromptOptions ? (
                            /* Prompt messages keep their own purple card styling */
                            <div style={{ width: "85%" }}>
                              <AssistantMessage
                                key={`msg-${i}`}
                                message={{
                                  ...message,
                                  body: parsed.text,
                                }}
                                onPromptSelect={onPromptSelect}
                              />
                            </div>
                          ) : (
                            <div
                              className="rounded-2xl px-2 py-1 text-gray-800 self-start"
                              style={{
                                backgroundColor: style.bubbleBg,
                                width: "85%",
                                border: "1px solid rgba(0, 0, 0, 0.1)",
                              }}
                            >
                              <AssistantMessage
                                key={`msg-${i}`}
                                message={{
                                  ...message,
                                  body: parsed.text,
                                }}
                                onPromptSelect={onPromptSelect}
                              />
                            </div>
                          )}

                          {/* Feedback - rendered below the bubble */}
                          {message.id && !messageType && (
                            <div className="mt-0">
                              <MessageFeedback
                                messageId={message.id}
                                onPopulateFeedbackText={enterControlledMode}
                                onSendFeedbackRating={sendFeedbackRating}
                              />
                            </div>
                          )}
                        </>
                      ) : (
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
                              <rect
                                x="8"
                                y="10"
                                width="16"
                                height="12"
                                rx="6"
                              />
                              {/* Eyes */}
                              <circle
                                cx="12"
                                cy="16"
                                r="1.5"
                                fill="currentColor"
                              />
                              <circle
                                cx="20"
                                cy="16"
                                r="1.5"
                                fill="currentColor"
                              />
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
                            <span className="text-xs text-gray-500 italic">
                              thinking...
                            </span>
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
