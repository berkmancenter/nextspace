import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import { io } from "socket.io-client";
import { Box, IconButton, InputAdornment, TextField } from "@mui/material";
import { Send, Close } from "@mui/icons-material";

import { Element, scroller } from "react-scroll";

import {
  AssistantMessage,
  SubmittedMessage,
  ModeratorSubmittedMessage,
  UserMessage,
} from "../components/messages";
import { Api, JoinSession, RetrieveData, SendData } from "../utils";
import { components } from "../types";
import { ControlledInputConfig, PseudonymousMessage } from "../types.internal";
import { CheckAuthHeader } from "../utils/Helpers";

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

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [joining, setJoining] = useState(false);
  const [waitingForResponse, setWaitingForResponse] = useState(false);

  const [messages, setMessages] = useState<PseudonymousMessage[]>([]);
  const [currentMessage, setCurrentMessage] = useState("");
  const [pseudonym, setPseudonym] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [agentId, setAgentId] = useState<string | null>(null);
  const [socket, setSocket] = useState<ReturnType<typeof io> | null>(null);
  const [controlledMode, setControlledMode] =
    useState<ControlledInputConfig | null>(null);

  const messageInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (socket || joining) return;
    setJoining(true);
    JoinSession(
      (result) => {
        setPseudonym(result.pseudonym);
        setUserId(result.userId);
        let socketLocal = io(process.env.NEXT_PUBLIC_SOCKET_URL, {
          auth: { token: Api.get().GetTokens().access },
        });
        // Set the socket instance in state
        setSocket(socketLocal);
        setJoining(false);
      },
      (error) => {
        setErrorMessage(error);
      }
    );
  }, [socket, joining]);

  useEffect(() => {
    if (!socket) return;
    socket.on("error", (error: string) => {
      console.error("Socket error:", error);
    });
    socket.on("connect", () => setIsConnected(true));
    socket.on("disconnect", () => setIsConnected(false));

    return () => {
      socket.off("connect", () => setIsConnected(true));
      socket.off("disconnect", () => setIsConnected(false));
    };
  }, [socket]);

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
        .then(async (conversation: any) => {
          if (!conversation) {
            setErrorMessage("Conversation not found.");
            return;
          }
          if ("error" in conversation) {
            setErrorMessage(
              conversation.message?.message || "Error retrieving conversation."
            );
            return;
          }
          // Check if the event has an event assistant agent
          // TODO: This should really be a property of the conversation, not inferred from agents
          const eventAsstAgent = conversation.agents.find(
            (agent: components["schemas"]["Agent"]) =>
              agent.agentType === "eventAssistant" ||
              agent.agentType === "eventAssistantPlus"
          );
          if (eventAsstAgent) setAgentId(eventAsstAgent.id);
          else {
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
                scroller.scrollTo("end", {
                  duration: 800,
                  delay: 0,
                  offset: 200,
                  smooth: "easeInOutQuart",
                  containerId: "scroll-container",
                });
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
    parentMessageId?: string
  ) {
    if (!Api.get().GetTokens() || !message) return;
    let channels = [{ name: `direct-${userId}-${agentId}` }];

    // Prepend prefix if in controlled mode
    const finalMessage = controlledMode
      ? controlledMode.prefix + message
      : message;

    // Only set waitingForResponse for regular messages, not controlled mode messages
    // (controlled mode messages like feedback don't generate responses)
    if (shouldWaitForResponse && !controlledMode) {
      setWaitingForResponse(true);
    }
    setCurrentMessage("");

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
    setCurrentMessage("");
    // Use setTimeout to ensure focus happens after any state updates
    setTimeout(() => {
      if (messageInputRef.current) {
        messageInputRef.current.focus();
      }
    }, 0);
  };

  const exitControlledMode = () => {
    setControlledMode(null);
    setCurrentMessage("");
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
    const feedbackText = `/feedback|Rating|${messageId}|${rating}`;
    await sendMessage(feedbackText, false);
  };

  const handlePromptSelect = async (
    value: string,
    parentMessageId?: string
  ) => {
    await sendMessage(value, true, parentMessageId);
  };

  return (
    <div className="h-screen flex items-start justify-center mt-12">
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
              <Box
                display="flex"
                flexDirection="column"
                height="100vh"
                overflow="hidden"
              >
                {/* Conversation View */}
                <div
                  className="overflow-auto flex flex-col grow items-center gap-8 mt-4 mb-32 xl:mb-20"
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
                  {/* Scroll to bottom element */}
                  <Element name="end" />
                </div>
                {pseudonym && (
                  <div className="flex justify-center fixed bottom-0 left-0 right-0 bg-white">
                    <div className="w-11/12 lg:w-1/2">
                      {/* Message Input */}
                      <Box display="flex" alignItems="center" padding="8px">
                        <div className="flex flex-col w-full">
                          <div className="border-[1px] border-b-0 border-[#A5B4FC] rounded-t-lg p-2 font-bold text-sm flex justify-between items-center">
                            <span className="uppercase">
                              Writing as {pseudonym}
                              {controlledMode && (
                                <span className="normal-case">
                                  {" • "}
                                  {controlledMode.icon} {controlledMode.label}
                                </span>
                              )}
                            </span>
                            {controlledMode && (
                              <IconButton
                                size="small"
                                onClick={exitControlledMode}
                                sx={{ padding: "4px" }}
                              >
                                <Close fontSize="small" />
                              </IconButton>
                            )}
                          </div>
                          <TextField
                            id="message-input"
                            inputRef={messageInputRef}
                            type="text"
                            placeholder="Write a Comment"
                            value={currentMessage}
                            onChange={(e) => {
                              setCurrentMessage(e.target.value);
                            }}
                            onKeyUp={(e) => {
                              if (
                                e.key === "Enter" &&
                                !!currentMessage &&
                                currentMessage.length > 0 &&
                                !waitingForResponse
                              )
                                sendMessage(currentMessage);
                            }}
                            style={{
                              flex: 1,
                            }}
                            sx={{
                              // Root class for the input field
                              "& .MuiOutlinedInput-root": {
                                // Class for the border around the input field
                                "& .MuiOutlinedInput-notchedOutline": {
                                  borderColor: "#A5B4FC",
                                  borderWidth: "1px",
                                  borderBottomLeftRadius: "8px",
                                  borderBottomRightRadius: "8px",
                                  borderTopLeftRadius: 0,
                                  borderTopRightRadius: 0,
                                },
                              },
                            }}
                            slotProps={{
                              input: {
                                endAdornment: (
                                  <InputAdornment position="end">
                                    <IconButton
                                      onClick={() =>
                                        sendMessage(currentMessage)
                                      }
                                      aria-label="send message"
                                      disabled={
                                        !currentMessage ||
                                        currentMessage.length < 1 ||
                                        waitingForResponse
                                      }
                                    >
                                      <Send
                                        sx={{
                                          opacity:
                                            !currentMessage ||
                                            currentMessage.length < 1
                                              ? 0.5
                                              : 1,
                                          color: "white",
                                          backgroundColor: "#2f69c4",
                                          borderRadius: "50%",
                                          padding: "4px",
                                          transform: "rotate(-45deg)",
                                        }}
                                      />
                                    </IconButton>
                                  </InputAdornment>
                                ),
                              },
                            }}
                          />
                        </div>
                      </Box>
                    </div>
                  </div>
                )}
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
