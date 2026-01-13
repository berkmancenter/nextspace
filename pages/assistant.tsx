import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import { io } from "socket.io-client";

import { AssistantChat } from "../components/AssistantChat";
import { SlashCommand } from "../components/SlashCommandMenu";
import {
  Api,
  JoinSession,
  RetrieveData,
  SendData,
  GetChannelPasscode,
} from "../utils";
import { components } from "../types";
import { ControlledInputConfig, PseudonymousMessage } from "../types.internal";
import { CheckAuthHeader, createConversationFromData } from "../utils/Helpers";
import { useAnalytics } from "../hooks/useAnalytics";
import {
  trackConversationEvent,
  trackConnectionStatus,
  setUserId,
} from "../utils/analytics";
import { Transcript } from "../components/";

export const getServerSideProps = async (context: { req: any }) => {
  return CheckAuthHeader(context.req.headers);
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
  const [transcriptPasscode, setTranscriptPasscode] = useState<string>("");

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
        socketLocal.on("message:new", (data) => {
          if (process.env.NODE_ENV !== "production")
            console.log("New message:", data);

          if (
            !data.parentMessage &&
            (!data.channels || !data.channels.includes("transcript"))
          ) {
            setMessages((prev) => [...prev, data]);
          }
          if (
            data.pseudonym === "Event Assistant" ||
            data.pseudonym === "Event Assistant Plus"
          )
            setWaitingForResponse(false);
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

            // Get transcript passcode if channel query param exists
            if (router.query.channel) {
              const transcriptPasscodeParam = GetChannelPasscode(
                "transcript",
                router.query,
                setErrorMessage
              );

              if (transcriptPasscodeParam) {
                setTranscriptPasscode(transcriptPasscodeParam);
              }
            }

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

            if (agentId && userId) {
              console.log("Joining conversation");
              socket.emit("conversation:join", {
                conversationId: router.query.conversationId,
                token: Api.get().GetTokens().access,
                channel: { name: `direct-${userId}-${agentId}` },
              });
            }
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
    <div className="flex flex-col lg:flex-row h-[calc(100vh-96px)] overflow-hidden">
      {errorMessage ? (
        <div className="text-medium-slate-blue text-lg font-bold mx-9">
          {errorMessage}
        </div>
      ) : (
        <>
          {/* Transcript view on top for mobile, right side for desktop - only render if enabled */}
          {transcriptPasscode && (
            <div className="lg:order-2">
              <Transcript
                socket={socket}
                conversationId={router.query.conversationId as string}
                transcriptPasscode={transcriptPasscode}
                apiAccessToken={Api.get().GetTokens().access!}
              />
            </div>
          )}

          {/* Main assistant chat view below transcript on mobile, left side on desktop */}
          <div className="flex-1 flex flex-col relative overflow-hidden lg:order-1">
            {isConnected ? (
              <AssistantChat
                messages={messages}
                pseudonym={pseudonym}
                waitingForResponse={waitingForResponse}
                controlledMode={controlledMode}
                slashCommands={slashCommands}
                onSendMessage={sendMessage}
                onExitControlledMode={exitControlledMode}
                onPromptSelect={handlePromptSelect}
                enterControlledMode={enterControlledMode}
                sendFeedbackRating={sendFeedbackRating}
              />
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
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default EventAssistantRoom;
