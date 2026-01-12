import { FC, useRef, useEffect } from "react";
import {
  AssistantMessage,
  SubmittedMessage,
  ModeratorSubmittedMessage,
  UserMessage,
} from "../components/messages";
import { MessageInput } from "./MessageInput";
import { SlashCommand } from "./SlashCommandMenu";
import { ControlledInputConfig, PseudonymousMessage } from "../types.internal";

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

interface AssistantChatProps {
  messages: PseudonymousMessage[];
  pseudonym: string | null;
  waitingForResponse: boolean;
  controlledMode: ControlledInputConfig | null;
  slashCommands: SlashCommand[];
  onSendMessage: (message: string) => void;
  onExitControlledMode: () => void;
  onPromptSelect: (prompt: string) => void;
  enterControlledMode: (config: ControlledInputConfig) => void;
  sendFeedbackRating: (messageId: string, rating: string) => void;
}

export const AssistantChat: FC<AssistantChatProps> = ({
  messages,
  pseudonym,
  waitingForResponse,
  controlledMode,
  slashCommands,
  onSendMessage,
  onExitControlledMode,
  onPromptSelect,
  enterControlledMode,
  sendFeedbackRating,
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when new messages arrive
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  // Auto-scroll when messages change
  useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom();
    }
  }, [messages]);

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
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-8 pt-12">
        <div
          className="flex flex-col items-start gap-8 pb-4"
          aria-live="assertive"
        >
          {messages
            .filter((message) => !message.parentMessage)
            .map((message, i) => {
              const isAssistant =
                message.pseudonym === "Event Assistant" ||
                message.pseudonym === "Event Assistant Plus";
              return (
                <div key={`msg-${i}`} className="w-full max-w-4xl">
                  <div className="flex flex-col lg:flex-row gap-x-5.5">
                    <p className="flex flex-col min-w-24 items-center text-sm text-neutral-600 mb-1 lg:mb-0 lg:mt-2">
                      {new Date(message.createdAt!).toLocaleTimeString(
                        "en-US",
                        {
                          hour: "2-digit",
                          minute: "2-digit",
                        }
                      )}
                      {isAssistant && (
                        <>
                          <span className="hidden lg:inline-block h-full border-l-2 border-l-dark-blue opacity-50 border-dotted my-1"></span>
                          {waitingForResponse &&
                            i ===
                              messages.findLastIndex(
                                (msg) =>
                                  msg.pseudonym === "Event Assistant" ||
                                  msg.pseudonym === "Event Assistant Plus"
                              ) && (
                              <svg
                                viewBox="0 0 32 32"
                                className="w-10 h-10 text-black dark:text-white mx-auto"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="0.7"
                              >
                                <circle
                                  cx="16"
                                  cy="5.5"
                                  r="1"
                                  className="animate-bounce"
                                />
                                <line x1="16" y1="6.5" x2="16" y2="10" />
                                <rect
                                  x="8"
                                  y="10"
                                  width="16"
                                  height="12"
                                  rx="6"
                                />
                                <circle cx="12" cy="16" r="1" />
                                <circle cx="20" cy="16" r="1" />
                                <path
                                  d="M13 19 Q16 21 19 19"
                                  strokeLinecap="round"
                                  fill="none"
                                />
                                <line x1="8" y1="15" x2="4.5" y2="13" />
                                <line x1="24" y1="15" x2="27.5" y2="13" />
                                <rect
                                  x="13"
                                  y="22"
                                  width="6"
                                  height="5"
                                  rx="2"
                                />
                              </svg>
                            )}
                        </>
                      )}
                    </p>

                    {(() => {
                      // Determine message type and render appropriate component
                      const parsed = parseMessageBody(message.body);
                      const messageType = parsed.type;

                      // Check if this is a moderator_submitted type message
                      if (messageType === "moderator_submitted") {
                        return (
                          <ModeratorSubmittedMessage
                            key={`msg-${i}`}
                            message={{
                              ...message,
                              body: parsed.text,
                            }}
                          />
                        );
                      }

                      // Check if this message was submitted (referenced by moderator_submitted)
                      if (submittedIds.includes(message.id)) {
                        return (
                          <SubmittedMessage
                            key={`msg-${i}`}
                            message={message}
                          />
                        );
                      }

                      // Render assistant message
                      if (isAssistant) {
                        return (
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
                        );
                      }

                      // Default to user message
                      return <UserMessage key={`msg-${i}`} message={message} />;
                    })()}
                  </div>
                </div>
              );
            })}
          {/* Scroll target */}
          <div ref={messagesEndRef} className="h-8" />
        </div>
      </div>

      {/* MessageInput*/}
      <div className="flex-shrink-0">
        <MessageInput
          pseudonym={pseudonym}
          onSendMessage={onSendMessage}
          waitingForResponse={waitingForResponse}
          controlledMode={controlledMode}
          onExitControlledMode={onExitControlledMode}
          slashCommands={slashCommands}
        />
      </div>
    </div>
  );
};
