import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/router";

import { AssistantChatPanel } from "../components/AssistantChatPanel";
import { GroupChatPanel } from "../components/GroupChatPanel";
import { SlashCommand } from "../components/enhancers/slashCommandEnhancer";
import {
  Api,
  RetrieveData,
  SendData,
  GetChannelPasscode,
  emitWithTokenRefresh,
} from "../utils";
import { components } from "../types";
import { ControlledInputConfig, PseudonymousMessage } from "../types.internal";
import { CheckAuthHeader, createConversationFromData } from "../utils/Helpers";
import { useAnalytics } from "../hooks/useAnalytics";
import { AuthType } from "../types.internal";
import { trackConversationEvent, setUserId } from "../utils/analytics";
import { Transcript } from "../components/";
import { useSessionJoin } from "../utils/useSessionJoin";
import { NavigationBar, NavTab } from "../components/NavigationBar";

export const getServerSideProps = async (context: { req: any }) => {
  return CheckAuthHeader(context.req.headers);
};

function EventAssistantRoom({ authType }: { authType: AuthType }) {
  const router = useRouter();

  // Initialize page-level analytics
  useAnalytics({ pageType: "assistant" });

  const [localError, setLocalError] = useState<string | null>(null);
  const [waitingForResponse, setWaitingForResponse] = useState(false);

  const [activeTab, setActiveTab] = useState<NavTab>("chat");
  const [unseenAssistantCount, setUnseenAssistantCount] = useState<number>(0);
  const [unseenChatCount, setUnseenChatCount] = useState<number>(0);
  const [assistantMessages, setAssistantMessages] = useState<
    PseudonymousMessage[]
  >([]);
  const [chatMessages, setChatMessages] = useState<PseudonymousMessage[]>([]);
  const [agentId, setAgentId] = useState<string | null>(null);
  const [conversationType, setConversationType] = useState<string | null>(null);
  const [controlledMode, setControlledMode] =
    useState<ControlledInputConfig | null>(null);
  const [transcriptPasscode, setTranscriptPasscode] = useState<string>("");
  const [chatPasscode, setChatPasscode] = useState<string>("");
  const [eventName, setEventName] = useState<string>("");
  const [assistantInputValue, setAssistantInputValue] = useState<string>("");
  const [chatInputValue, setChatInputValue] = useState<string>("");

  // Ref to track active tab for socket handler
  const activeTabRef = useRef<NavTab>("assistant");

  // Use custom hook for session joining
  const {
    socket,
    pseudonym,
    userId,
    isConnected,
    errorMessage: sessionError,
  } = useSessionJoin();

  // Combine session and local errors
  const errorMessage = sessionError || localError;

  // Available slash commands
  // Commands can optionally specify which conversation types they're available for
  const allSlashCommands: SlashCommand[] = [
    {
      command: "mod",
      description: "Submit a question to the moderator",
      value: "/mod ",
      conversationTypes: ["eventAssistantPlus", "eventAssistantPlusProactive"],
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

  // Set up message listener
  useEffect(() => {
    if (!socket) return;

    const messageHandler = (data: PseudonymousMessage) => {
      if (process.env.NODE_ENV !== "production")
        console.log("New message:", data);

      if (!data.parentMessage) {
        // Route messages to appropriate array based on channel
        if (data.channels && data.channels.includes("chat")) {
          setChatMessages((prev) => [...prev, data]);
          // Increment counter if NOT viewing chat tab
          if (activeTabRef.current !== "chat") {
            setUnseenChatCount((prev) => prev + 1);
          }
        } else if (!data.channels || !data.channels.includes("transcript")) {
          setAssistantMessages((prev) => [...prev, data]);
          // Increment counter if NOT viewing assistant tab
          if (activeTabRef.current !== "assistant") {
            setUnseenAssistantCount((prev) => prev + 1);
          }
        }
      }
      if (data.fromAgent) {
        setWaitingForResponse(false);
      }
    };

    if (!socket.hasListeners("message:new")) {
      socket.on("message:new", messageHandler);
    }

    return () => {
      socket.off("message:new", messageHandler);
    };
  }, [socket]);

  // Keep activeTabRef in sync with activeTab state
  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);

  // Track user ID when available
  useEffect(() => {
    if (pseudonym) {
      setUserId(pseudonym);
    }
  }, [pseudonym]);

  useEffect(() => {
    if (!Api.get().GetTokens().access || !router.isReady) return;
    if (!router.query.conversationId) {
      setLocalError("Please provide a Conversation ID.");
      return;
    }

    async function fetchConversationData() {
      try {
        const conversationData = await RetrieveData(
          `conversations/${router.query.conversationId}`,
          Api.get().GetTokens().access!,
        );

        if (!conversationData) {
          setLocalError("Conversation not found.");
          return;
        }
        if ("error" in conversationData) {
          setLocalError(
            conversationData.message?.message ||
              "Error retrieving conversation.",
          );
          return;
        }

        const conversation = await createConversationFromData(conversationData);
        setConversationType(conversation.type.name);
        if (conversation.name) setEventName(conversation.name);

        // Get transcript and chat passcodes if channel query param exists
        if (router.query.channel) {
          const transcriptPasscodeParam = GetChannelPasscode(
            "transcript",
            router.query,
            setLocalError,
          );

          if (transcriptPasscodeParam) {
            setTranscriptPasscode(transcriptPasscodeParam);
          }

          const chatPasscodeParam = GetChannelPasscode(
            "chat",
            router.query,
            setLocalError,
          );

          if (chatPasscodeParam) {
            setChatPasscode(chatPasscodeParam);
          }
        }

        // Check if the event has an event assistant agent
        const eventAsstAgent = conversation.agents.find(
          (agent: components["schemas"]["Agent"]) =>
            agent.agentType === "eventAssistant" ||
            agent.agentType === "eventAssistantPlus" ||
            agent.agentType === "eventChannelMediator" ||
            agent.agentType === "eventChannelMediatorPlus",
        );
        if (eventAsstAgent) {
          setAgentId(eventAsstAgent.id!);
        } else {
          setLocalError(
            "This conversation does not have an event assistant agent.",
          );
          return;
        }
      } catch (error) {
        console.error("Error fetching conversation data:", error);
        setLocalError("Failed to fetch conversation data.");
      }
    }
    fetchConversationData();
  }, [socket, router]);

  // Join conversation when socket, agentId, and userId are all available
  useEffect(() => {
    if (
      !socket ||
      !socket.auth ||
      !agentId ||
      !userId ||
      !router.query.conversationId
    ) {
      return;
    }

    console.log("Joining conversation");
    // Join channels - include both direct and chat if chatPasscode is available
    const channels: components["schemas"]["Channel"][] = [
      {
        name: `direct-${userId}-${agentId}`,
        passcode: null,
        direct: true,
      },
    ];
    if (chatPasscode) {
      channels.push({
        name: "chat",
        passcode: chatPasscode,
        direct: false,
      });
    }

    // Use emitWithTokenRefresh to handle token expiration
    emitWithTokenRefresh(
      socket,
      "conversation:join",
      {
        conversationId: router.query.conversationId,
        token: Api.get().GetTokens().access,
        channels,
      },
      () => console.log("Successfully joined conversation"),
      (error) => console.error("Failed to join conversation:", error),
    );
  }, [socket, agentId, userId, chatPasscode, router.query.conversationId]);

  // Load initial chat messages when chatPasscode becomes available
  useEffect(() => {
    if (!chatPasscode || !router.query.conversationId) return;

    const fetchInitialMessages = async () => {
      try {
        const chatMessages = await RetrieveData(
          `messages/${router.query.conversationId}?channel=chat,${chatPasscode}`,
          Api.get().GetTokens().access!,
        );

        if (Array.isArray(chatMessages)) {
          setChatMessages(chatMessages);
        }
      } catch (error) {
        console.error("Error fetching initial chat messages:", error);
      }
    };

    fetchInitialMessages();
  }, [chatPasscode, router.query.conversationId]);

  // Load initial assistant messages when userId and agentId become available
  useEffect(() => {
    if (!userId || !agentId || !router.query.conversationId) return;

    const fetchInitialAssistantMessages = async () => {
      try {
        const directChannelName = `direct-${userId}-${agentId}`;
        const assistantMessages = await RetrieveData(
          `messages/${router.query.conversationId}?channel=${directChannelName}`,
          Api.get().GetTokens().access!,
        );

        if (Array.isArray(assistantMessages)) {
          setAssistantMessages(assistantMessages);
        }
      } catch (error) {
        console.error("Error fetching initial assistant messages:", error);
      }
    };

    fetchInitialAssistantMessages();
  }, [userId, agentId, router.query.conversationId]);

  async function sendMessage(
    message: string,
    shouldWaitForResponse: boolean = true,
    parentMessageId?: string,
    skipTracking: boolean = false,
    messageSource: "message" | "reaction" = "message",
  ) {
    if (!Api.get().GetTokens() || !message) return;

    // Use different channel based on active tab
    // When in transcript view, default to assistant channel for sending
    const effectiveTab = activeTab === "transcript" ? "assistant" : activeTab;
    let channels =
      effectiveTab === "chat"
        ? [{ name: "chat", passcode: chatPasscode }]
        : [{ name: `direct-${userId}-${agentId}` }];

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
          commandName,
        );
      } else if (controlledMode) {
        trackConversationEvent(
          conversationId,
          "assistant",
          "feedback_sent",
          controlledMode.label,
        );
      } else {
        trackConversationEvent(
          conversationId,
          effectiveTab,
          "message_sent",
          messageSource,
        );
      }
    }

    // Only set waitingForResponse for assistant mode regular messages, not controlled mode messages
    // (controlled mode messages like feedback don't generate responses, and chat mode has no assistant)
    if (
      shouldWaitForResponse &&
      !controlledMode &&
      effectiveTab === "assistant"
    ) {
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
      rating,
    );
    const feedbackText = `/feedback|Rating|${messageId}|${rating}`;
    await sendMessage(feedbackText, false, undefined, true);
  };

  const handlePromptSelect = async (
    value: string,
    parentMessageId?: string,
  ) => {
    await sendMessage(value, true, parentMessageId, false, "reaction");
  };

  const handleTabChange = (tab: NavTab) => {
    setActiveTab(tab);
    // Clear unseen count for the tab we're switching to
    if (tab === "assistant") {
      setUnseenAssistantCount(0);
    } else if (tab === "chat") {
      setUnseenChatCount(0);
    }
    // Track tab switch analytics (transcript treated as a nav destination)
    trackConversationEvent(
      router.query.conversationId as string,
      "assistant",
      "tab_switched",
      tab,
    );
  };

  return (
    // On mobile we add bottom padding so the fixed nav bar doesn't cover content
    <div className="flex flex-row h-[calc(100vh-96px)] overflow-hidden pb-[60px] lg:pb-0">
      {errorMessage ? (
        <div className="text-medium-slate-blue text-lg font-bold mx-9 mt-6">
          {errorMessage}
        </div>
      ) : (
        <>
          {/* ── Navigation Bar (left sidebar on desktop, bottom bar on mobile) ── */}
          <NavigationBar
            activeTab={activeTab}
            onTabChange={handleTabChange}
            unseenAssistantCount={unseenAssistantCount}
            unseenChatCount={unseenChatCount}
            showChat={!!chatPasscode}
            showTranscript={!!transcriptPasscode}
          />

          {/* ── Main content area ── */}
          <div className="flex-1 flex flex-row overflow-hidden">
            {/* Transcript full-screen view when transcript tab is active */}
            {activeTab === "transcript" && transcriptPasscode ? (
              <div className="flex-1 overflow-hidden">
                <Transcript
                  category="assistant"
                  socket={socket}
                  conversationId={router.query.conversationId as string}
                  transcriptPasscode={transcriptPasscode}
                  apiAccessToken={Api.get().GetTokens().access!}
                  hideToggle={true}
                />
              </div>
            ) : (
              <>
                {/* Chat / Assistant panel */}
                <div className="flex-1 flex flex-col relative overflow-hidden">
                  {isConnected ? (
                    activeTab === "chat" ? (
                      <GroupChatPanel
                        messages={chatMessages}
                        pseudonym={pseudonym}
                        eventName={eventName}
                        inputValue={chatInputValue}
                        onInputChange={setChatInputValue}
                        onSendMessage={sendMessage}
                        controlledMode={controlledMode}
                        onExitControlledMode={exitControlledMode}
                        enterControlledMode={enterControlledMode}
                        sendFeedbackRating={sendFeedbackRating}
                      />
                    ) : (
                      <AssistantChatPanel
                        messages={assistantMessages}
                        pseudonym={pseudonym}
                        waitingForResponse={waitingForResponse}
                        controlledMode={controlledMode}
                        slashCommands={slashCommands}
                        eventName={eventName}
                        inputValue={assistantInputValue}
                        onInputChange={setAssistantInputValue}
                        onSendMessage={sendMessage}
                        onExitControlledMode={exitControlledMode}
                        onPromptSelect={handlePromptSelect}
                        enterControlledMode={enterControlledMode}
                        sendFeedbackRating={sendFeedbackRating}
                      />
                    )
                  ) : (
                    <div className="flex items-center justify-center h-full">
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
                    </div>
                  )}
                </div>

                {/* Transcript sidebar — still accessible on Chat and Event Bot views */}
                {transcriptPasscode && (
                  <div className="lg:order-2 hidden lg:block">
                    <Transcript
                      category="assistant"
                      socket={socket}
                      conversationId={router.query.conversationId as string}
                      transcriptPasscode={transcriptPasscode}
                      apiAccessToken={Api.get().GetTokens().access!}
                    />
                  </div>
                )}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default EventAssistantRoom;
