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
import {
  CheckAuthHeader,
  createConversationFromData,
  resolveConversationBotName,
} from "../utils/Helpers";
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
  const [botName, setBotName] = useState<string>("Berkie");
  const [assistantInputValue, setAssistantInputValue] = useState<string>("");
  const [chatInputValue, setChatInputValue] = useState<string>("");
  const [showPreferences, setShowPreferences] = useState<boolean>(true);
  const [preferencesError, setPreferencesError] = useState<string | null>(null);

  const preferenceOptions = [
    {
      value: "visualResponse",
      label: "Visual Response",
      description: "Answer my questions with images when appropriate",
    },
  ];

  // Ref to track active tab for socket handler
  const activeTabRef = useRef<NavTab>("assistant");

  // Use custom hook for session joining
  const {
    socket,
    pseudonym,
    userId,
    isConnected,
    errorMessage: sessionError,
    lastReconnectTime,
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
    {
      command: "mindmap",
      description:
        "Create a visual mind map of the key topics discussed in the event",
      value: "/mindmap ",
      conversationTypes: [
        "eventAssistant",
        "eventAssistantPlus",
        "eventAssistantPlusProactive",
      ],
    },
    {
      command: "visual",
      description: "Request a visual response (image) to a question",
      value: "/visual ",
      conversationTypes: [
        "eventAssistant",
        "eventAssistantPlus",
        "eventAssistantPlusProactive",
      ],
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

      if (
        data.fromAgent &&
        (!data.channels || !data.channels.includes("chat"))
      ) {
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
    if (!Api.get().getAccessToken() || !router.isReady) return;
    if (!router.query.conversationId) {
      setLocalError("Please provide a Conversation ID.");
      return;
    }

    async function fetchConversationData() {
      try {
        const config = await Api.get().GetConfig();
        setBotName(config.conversationBotName);

        const conversationData = await RetrieveData(
          `conversations/${router.query.conversationId}`,
          Api.get().getAccessToken(),
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

        // Override botName from the first agent's agentConfig if available,
        // falling back to config.conversationBotName
        setBotName(
          resolveConversationBotName(conversation, config.conversationBotName),
        );

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

  // Join conversation when socket, agentId, and userId are all available.
  // Also re-joins automatically on every socket reconnection so that messages
  // continue flowing after a token refresh or transient network drop.
  useEffect(() => {
    if (!socket || !agentId || !userId || !router.query.conversationId) {
      return;
    }

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

    const joinConversation = () => {
      console.log("Joining conversation");
      // Always read the current token so re-joins after a refresh use the
      // new token rather than the one captured at socket-creation time.
      emitWithTokenRefresh(
        socket,
        "conversation:join",
        {
          conversationId: router.query.conversationId,
          token: Api.get().getAccessToken(),
          channels,
        },
        () => console.log("Successfully joined conversation"),
        (error) => console.error("Failed to join conversation:", error),
      );
    };

    // Initial join
    joinConversation();

    // Re-join on every subsequent reconnection (e.g. after token refresh)
    socket.on("connect", joinConversation);

    return () => {
      socket.off("connect", joinConversation);
    };
  }, [socket, agentId, userId, chatPasscode, router.query.conversationId]);

  // Helper function to fetch replies for messages and insert them into the array
  const fetchAndInsertReplies = async (
    messages: PseudonymousMessage[],
  ): Promise<PseudonymousMessage[]> => {
    // Collect all messages with replies
    const messagesWithReplies = messages.filter(
      (msg) => msg.replyCount && msg.replyCount > 0,
    );

    if (messagesWithReplies.length === 0) {
      return messages;
    }

    // Fetch all replies in parallel
    const repliesPromises = messagesWithReplies.map(async (msg) => {
      try {
        const replies = await RetrieveData(
          `messages/${msg.id}/replies`,
          Api.get().getAccessToken(),
        );
        if ("error" in replies) {
          console.error(
            `Error fetching replies for message ${msg.id}: ${replies.message?.message}`,
          );
          return [];
        }
        return Array.isArray(replies) ? replies : [];
      } catch (error) {
        console.error(`Error fetching replies for message ${msg.id}:`, error);
        return [];
      }
    });

    const allRepliesArrays = await Promise.all(repliesPromises);
    const allReplies = allRepliesArrays.flat();

    // Combine original messages with replies and sort by createdAt
    const combinedMessages = [...messages, ...allReplies].sort((a, b) => {
      const dateA = new Date(a.createdAt!).getTime();
      const dateB = new Date(b.createdAt!).getTime();
      return dateA - dateB;
    });

    return combinedMessages;
  };

  // Load initial chat messages when chatPasscode becomes available
  useEffect(() => {
    if (!chatPasscode || !router.query.conversationId) return;

    const fetchInitialMessages = async () => {
      try {
        const chatMessages = await RetrieveData(
          `messages/${router.query.conversationId}?channel=chat,${chatPasscode}`,
          Api.get().getAccessToken(),
        );

        if (Array.isArray(chatMessages)) {
          const messagesWithReplies = await fetchAndInsertReplies(chatMessages);
          setChatMessages(messagesWithReplies);
        }
      } catch (error) {
        console.error("Error fetching initial chat messages:", error);
      }
    };

    fetchInitialMessages();
  }, [chatPasscode, router.query.conversationId]);

  // Check if user has existing preferences
  useEffect(() => {
    if (!userId) return;

    const fetchUserPreferences = async () => {
      try {
        const preferences = await RetrieveData(
          `users/user/${userId}/preferences`,
          Api.get().getAccessToken(),
        );

        if ("error" in preferences) {
          console.error(
            `Error retrieving preferences: ${preferences.message?.message}`,
          );
          setShowPreferences(true);
          return;
        }

        // If preferences exist (non-empty object), don't show the banner
        if (
          preferences &&
          typeof preferences === "object" &&
          Object.keys(preferences).length > 0
        ) {
          setShowPreferences(false);
        } else {
          // Empty object means no preferences set yet
          setShowPreferences(true);
        }
      } catch (error: any) {
        console.error(`Error retrieving preferences: ${error.message}`);
        setShowPreferences(true);
      }
    };

    fetchUserPreferences();
  }, [userId]);

  // Load initial assistant messages when userId and agentId become available
  useEffect(() => {
    if (!userId || !agentId || !router.query.conversationId) return;

    const fetchInitialAssistantMessages = async () => {
      try {
        const directChannelName = `direct-${userId}-${agentId}`;
        const assistantMessages = await RetrieveData(
          `messages/${router.query.conversationId}?channel=${directChannelName}`,
          Api.get().getAccessToken(),
        );

        if (Array.isArray(assistantMessages)) {
          const messagesWithReplies =
            await fetchAndInsertReplies(assistantMessages);
          setAssistantMessages(messagesWithReplies);
        }
      } catch (error) {
        console.error("Error fetching initial assistant messages:", error);
      }
    };

    fetchInitialAssistantMessages();
  }, [userId, agentId, router.query.conversationId]);

  // Re-fetch all message history when the socket reconnects after a significant
  // gap (user was on another tab/app for a while). Fills any messages missed
  // while the client was disconnected.
  useEffect(() => {
    if (!lastReconnectTime || !router.query.conversationId) return;

    console.log("Assistant re-fetching message history after gap-reconnect...");

    if (chatPasscode) {
      RetrieveData(
        `messages/${router.query.conversationId}?channel=chat,${chatPasscode}`,
        Api.get().getAccessToken(),
      )
        .then((msgs) => {
          if (Array.isArray(msgs)) setChatMessages(msgs);
        })
        .catch((err) => console.error("Error re-fetching chat messages:", err));
    }

    if (userId && agentId) {
      const directChannelName = `direct-${userId}-${agentId}`;
      RetrieveData(
        `messages/${router.query.conversationId}?channel=${directChannelName}`,
        Api.get().getAccessToken(),
      )
        .then((msgs) => {
          if (Array.isArray(msgs)) setAssistantMessages(msgs);
        })
        .catch((err) =>
          console.error("Error re-fetching assistant messages:", err),
        );
    }
  }, [lastReconnectTime]);

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

    // Check if a chat message @mentions the bot — if so, also route to the
    // bot's direct channel so the agent actually receives and responds to it.
    const mentionsBotInChat =
      effectiveTab === "chat" &&
      agentId &&
      new RegExp(`@${botName}\\b`, "i").test(message);

    let channels =
      effectiveTab === "chat"
        ? mentionsBotInChat
          ? [
              { name: "chat", passcode: chatPasscode },
              { name: `direct-${userId}-${agentId}` },
            ]
          : [{ name: "chat", passcode: chatPasscode }]
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

  const handlePreferencesSubmit = async (selectedValues: string[]) => {
    if (!userId) return;

    try {
      setPreferencesError(null); // Clear any previous errors

      // Create object with all preference keys and true/false based on selection
      const preferencesObject = preferenceOptions.reduce(
        (acc, option) => {
          acc[option.value] = selectedValues.includes(option.value);
          return acc;
        },
        {} as Record<string, boolean>,
      );

      // Save preferences to API
      const response = await SendData(
        `users/user/${userId}/preferences`,
        preferencesObject,
        undefined,
        undefined,
        "PUT",
      );

      if ("error" in response) {
        const errorMsg =
          response.message?.message ||
          "Failed to save preferences. Please try again.";
        setPreferencesError(errorMsg);
        console.error(`Error setting preferences: ${errorMsg}`);
        return;
      }

      // Track preferences submission
      trackConversationEvent(
        router.query.conversationId as string,
        "assistant",
        "preferences_submitted",
        selectedValues.join(","),
      );

      setShowPreferences(false);
      setPreferencesError(null);
    } catch (error) {
      console.error("Error saving preferences:", error);
      setPreferencesError("Failed to save preferences. Please try again.");
    }
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
            botName={botName}
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
                  lastReconnectTime={lastReconnectTime}
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
                        botName={botName}
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
                        botName={botName}
                        inputValue={assistantInputValue}
                        onInputChange={setAssistantInputValue}
                        onSendMessage={sendMessage}
                        onExitControlledMode={exitControlledMode}
                        onPromptSelect={handlePromptSelect}
                        enterControlledMode={enterControlledMode}
                        sendFeedbackRating={sendFeedbackRating}
                        userId={userId}
                        showPreferences={showPreferences}
                        preferenceOptions={preferenceOptions}
                        onPreferencesSubmit={handlePreferencesSubmit}
                        preferencesError={preferencesError}
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
                      lastReconnectTime={lastReconnectTime}
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
