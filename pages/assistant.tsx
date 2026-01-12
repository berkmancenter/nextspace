import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import { io } from "socket.io-client";
import { Box } from "@mui/material";

import {
  AssistantMessage,
  SubmittedMessage,
  ModeratorSubmittedMessage,
  UserMessage,
} from "../components/messages";
import { MessageInput } from "../components/MessageInput";
import { SlashCommand } from "../components/SlashCommandMenu";
import { Api, JoinSession, RetrieveData, SendData } from "../utils";
import { components } from "../types";
import { ControlledInputConfig, PseudonymousMessage } from "../types.internal";
import { CheckAuthHeader, createConversationFromData } from "../utils/Helpers";
import { useAnalytics } from "../hooks/useAnalytics";
import {
  trackEvent,
  trackConversationEvent,
  trackConnectionStatus,
  setUserId,
} from "../utils/analytics";

export const getServerSideProps = async (context: { req: any }) => {
  return CheckAuthHeader(context.req.headers);
};

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

function EventAssistantRoom() {
  const router = useRouter();

  // Initialize page-level analytics
  useAnalytics({ pageType: "assistant" });

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [joining, setJoining] = useState(false);
  const [waitingForResponse, setWaitingForResponse] = useState(false);

  const [messages, setMessages] = useState<PseudonymousMessage[]>([]);
  const [pseudonym, setPseudonym] = useState<string | null>(null);
  const [userId, setUserIdState] = useState<string | null>(null);
  const [agentId, setAgentId] = useState<string | null>(null);
  const [conversationType, setConversationType] = useState<string | null>(null);
  const [socket, setSocket] = useState<ReturnType<typeof io> | null>(null);
  const [controlledMode, setControlledMode] =
    useState<ControlledInputConfig | null>(null);

  // Available slash commands
  // Commands can optionally specify which conversation types they're available for
  const allSlashCommands: SlashCommand[] = [
    {
      command: "mod",
      description: "Submit a question to the moderator",
      value: "/mod ",
      conversationTypes: ["eventAssistantPlus"],
    },
  ];

  // Filter commands based on current conversation type
  const slashCommands = allSlashCommands.filter((cmd) => {
    // If command has no conversationTypes restriction, it's available for all
    if (!cmd.conversationTypes || cmd.conversationTypes.length === 0) {
      return true;
    }
    return conversationType && cmd.conversationTypes.includes(conversationType);
  });
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

  useEffect(() => {
    if (socket || joining) return;

    let socketLocal: ReturnType<typeof io> | null = null;

    setJoining(true);

    JoinSession(
      (result) => {
        setPseudonym(result.pseudonym);
        setUserIdState(result.userId);
        // Track user ID (pseudonym)
        setUserId(result.pseudonym);

        socketLocal = io(process.env.NEXT_PUBLIC_SOCKET_URL, {
          auth: { token: Api.get().GetTokens().access },
        });

        // Set up all listeners immediately
        socketLocal.on("error", (error: string) => {
          console.error("Socket error:", error);
          trackConnectionStatus("error");
        });

        socketLocal.on("connect", () => {
          trackConnectionStatus("connected");
          setIsConnected(true);
        });
        socketLocal.on("disconnect", () => {
          setIsConnected(false);
          trackConnectionStatus("disconnected");
        });
        setSocket(socketLocal);
        setJoining(false);
      },
      (error) => {
        setErrorMessage(error);
        setJoining(false);
      }
    );

    return () => {
      if (socketLocal) {
        socketLocal.off("connect");
        socketLocal.off("disconnect");
        socketLocal.off("error");
      }
    };
  }, [socket, joining]);

  useEffect(() => {
    if (!Api.get().GetTokens().access || !router.isReady) return;
    if (!router.query.conversationId) {
      setErrorMessage("Please provide a Conversation ID.");
      return;
    }

    async function fetchConversationData() {
      RetrieveData(
        `conversations/${router.query.conversationId}`,
        Api.get().GetTokens().access!
      )
        .then(async (conversationData: any) => {
          if (!conversationData) {
            setErrorMessage("Conversation not found.");
            return;
          }
          if ("error" in conversationData) {
            setErrorMessage(
              conversationData.message?.message ||
                "Error retrieving conversation."
            );
            return;
          }

          createConversationFromData(conversationData).then((conversation) => {
            setConversationType(conversation.type.name);

            // Check if the event has an event assistant agent
            // TODO: This should really be a property of the conversation, not inferred from agents
            const eventAsstAgent = conversation.agents.find(
              (agent: components["schemas"]["Agent"]) =>
                agent.agentType === "eventAssistant" ||
                agent.agentType === "eventAssistantPlus"
            );
            if (eventAsstAgent) {
              setAgentId(eventAsstAgent.id!);
            } else {
              setErrorMessage(
                "This conversation does not have an event assistant agent."
              );
              return;
            }
            if (!socket || !socket.auth) {
              return;
            }

            if (!socket.hasListeners("message:new"))
              socket.on("message:new", (data) => {
                if (process.env.NODE_ENV !== "production")
                  console.log("New message:", data);
                if (!data.parentMessage) {
                  setMessages((prev) => [...prev, data]);
                }
                if (
                  data.pseudonym === "Event Assistant" ||
                  data.pseudonym === "Event Assistant Plus"
                )
                  setWaitingForResponse(false);
              });

            if (agentId && userId)
              socket.emit("conversation:join", {
                conversationId: router.query.conversationId,
                token: Api.get().GetTokens().access,
                channel: { name: `direct-${userId}-${agentId}` },
              });
          });
        })
        .catch((error) => {
          console.error("Error fetching conversation data:", error);
          setErrorMessage("Failed to fetch conversation data.");
        });
    }
    fetchConversationData();
  }, [socket, router, userId, agentId]);

  async function sendMessage(
    message: string,
    shouldWaitForResponse: boolean = true,
    parentMessageId?: string,
    skipTracking: boolean = false,
    messageSource: "message" | "reaction" = "message"
  ) {
    if (!Api.get().GetTokens() || !message) return;
    let channels = [{ name: `direct-${userId}-${agentId}` }];

    // Prepend prefix if in controlled mode
    const finalMessage = controlledMode
      ? controlledMode.prefix + message
      : message;

    // Track message send (only if not skipping tracking)
    if (!skipTracking) {
      const conversationId = router.query.conversationId as string;

      // Check if message is a slash command
      if (message.startsWith("/")) {
        const commandName = message.split(" ")[0].substring(1).split("|")[0];
        trackConversationEvent(
          conversationId,
          "assistant",
          "command_sent",
          commandName
        );
      } else if (controlledMode) {
        trackConversationEvent(
          conversationId,
          "assistant",
          "feedback_sent",
          controlledMode.label
        );
      } else {
        trackConversationEvent(
          conversationId,
          "assistant",
          "message_sent",
          messageSource
        );
      }
    }

    // Only set waitingForResponse for regular messages, not controlled mode messages
    // (controlled mode messages like feedback don't generate responses)
    if (shouldWaitForResponse && !controlledMode) {
      setWaitingForResponse(true);
    }

    await SendData("messages", {
      body: finalMessage,
      bodyType: "text",
      conversation: router.query.conversationId,
      channels,
      ...(parentMessageId !== undefined && { parentMessage: parentMessageId }),
    });

    // Auto-exit controlled mode after sending
    if (controlledMode) {
      setControlledMode(null);
    }
  }

  const enterControlledMode = (config: ControlledInputConfig) => {
    setControlledMode(config);
  };

  const exitControlledMode = () => {
    setControlledMode(null);
  };

  // Handle ESC key to exit controlled mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && controlledMode) {
        exitControlledMode();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [controlledMode]);

  const sendFeedbackRating = async (messageId: string, rating: string) => {
    const conversationId = router.query.conversationId as string;
    trackConversationEvent(
      conversationId,
      "assistant",
      "rating_submitted",
      rating
    );
    const feedbackText = `/feedback|Rating|${messageId}|${rating}`;
    await sendMessage(feedbackText, false, undefined, true);
  };

  const handlePromptSelect = async (
    value: string,
    parentMessageId?: string
  ) => {
    await sendMessage(value, true, parentMessageId, false, "reaction");
  };

  return (
    <div className="flex items-start justify-center pt-12">
      {errorMessage ? (
        <div className="text-medium-slate-blue text-lg font-bold mx-9">
          {errorMessage}
        </div>
      ) : (
        <div className="w-11/12 lg:w-2/3">
          <h2 className="text-3xl font-bold mb-4 w-full text-center">
            Ask the Event Assistant
          </h2>

          {
            isConnected ? (
              <Box display="flex" flexDirection="column">
                {/* Conversation View */}
                <div
                  className="flex flex-col items-center gap-8 mt-4 mb-24"
                  id="scroll-container"
                  aria-live="assertive"
                >
                  {(() => {
                    // Collect all message IDs referenced by moderator_submitted messages
                    const submittedIds = messages
                      .filter((msg) => {
                        if (typeof msg.body === "object" && msg.body !== null) {
                          const bodyObj = msg.body as Record<string, any>;
                          return (
                            bodyObj.type === "moderator_submitted" &&
                            bodyObj.message
                          );
                        }
                        return false;
                      })
                      .map((msg) => (msg.body as any).message);

                    return messages
                      .filter((message) => !message.parentMessage) // for now, assume anything with a parent message was selected via prompt option and should not be displayed again
                      .map((message, i) => {
                        const isAssistant =
                          message.pseudonym === "Event Assistant" ||
                          message.pseudonym === "Event Assistant Plus";
                        return (
                          <div
                            key={`msg-${i}`}
                            className="w-full lg:w-3/4 px-2"
                          >
                            <div className="flex flex-col lg:flex-row gap-x-5.5">
                              <p className="flex flex-col min-w-24 items-center text-sm text-neutral-600 mb-1 lg:mb-0 lg:mt-2">
                                {new Date(
                                  message.createdAt!
                                ).toLocaleTimeString("en-US", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                                {isAssistant && (
                                  <>
                                    <span className="hidden lg:inline-block h-full border-l-2 border-l-dark-blue opacity-50 border-dotted my-1"></span>
                                    {waitingForResponse &&
                                      i ===
                                        messages.findLastIndex(
                                          (msg) =>
                                            msg.pseudonym ===
                                              "Event Assistant" ||
                                            msg.pseudonym ===
                                              "Event Assistant Plus"
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
                                          <line
                                            x1="16"
                                            y1="6.5"
                                            x2="16"
                                            y2="10"
                                          />
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
                                          <line
                                            x1="8"
                                            y1="15"
                                            x2="4.5"
                                            y2="13"
                                          />
                                          <line
                                            x1="24"
                                            y1="15"
                                            x2="27.5"
                                            y2="13"
                                          />
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
                                      onPromptSelect={handlePromptSelect}
                                      onPopulateFeedbackText={
                                        enterControlledMode
                                      }
                                      onSendFeedbackRating={sendFeedbackRating}
                                      messageType={parsed.type}
                                    />
                                  );
                                }

                                // Default to user message
                                return (
                                  <UserMessage
                                    key={`msg-${i}`}
                                    message={message}
                                  />
                                );
                              })()}
                            </div>
                          </div>
                        );
                      });
                  })()}
                  {/* Scroll target - adds minimal space to ensure content is visible above fixed input */}
                  <div ref={messagesEndRef} className="h-8" />
                </div>
                <MessageInput
                  pseudonym={pseudonym}
                  onSendMessage={sendMessage}
                  waitingForResponse={waitingForResponse}
                  controlledMode={controlledMode}
                  onExitControlledMode={exitControlledMode}
                  slashCommands={slashCommands}
                />
              </Box>
            ) : (
              <svg
                className="mx-auto w-12 h-5"
                viewBox="0 0 40 10"
                fill="currentColor"
              >
                <circle
                  className="animate-bounce fill-sky-400"
                  cx="5"
                  cy="5"
                  r="4"
                />
                <circle
                  className="animate-bounce [animation-delay:-0.2s] fill-medium-slate-blue"
                  cx="20"
                  cy="5"
                  r="4"
                />
                <circle
                  className="animate-bounce [animation-delay:-0.4s] fill-purple-500"
                  cx="35"
                  cy="5"
                  r="4"
                />
              </svg>
            ) /* Loading indicator */
          }
        </div>
      )}
    </div>
  );
}

export default EventAssistantRoom;
