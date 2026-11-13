import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import CloseIcon from '@mui/icons-material/Close';

import { AssistantChatPanel } from '../components/AssistantChatPanel';
import { GroupChatPanel } from '../components/GroupChatPanel';
import { ResourcesPanel } from '../components/ResourcesPanel';
import { SlashCommand } from '../components/enhancers/slashCommandEnhancer';
import { Api, RetrieveData, SendData, emitWithTokenRefresh, buildDirectChannels } from '../utils';
import { components } from '../types';
import { CatchUpNotice, ControlledInputConfig, PseudonymousMessage, FeedbackConfig } from '../types.internal';
import { useConversationType, useSetBotName, useSetConversationType } from '../context/ConversationTypeContext';
import { AuthType } from '../types.internal';
import { trackConversationEvent, setUserId } from '../utils/analytics';
import { Errors, ParamErrors, Transcript } from '../components/';
import { NavigationBar } from '../components/NavigationBar';
import { PreferencesPanel } from '../components/PreferencesPanel';
import { PresentationHeader } from '../components/PresentationHeader';
import { insertMessageInOrder } from '../utils/messageModeration';
import { BotPresence } from '../components/BotPresence';
import { getFeedbackEligibleMessages } from '../utils/feedbackEligibility';
import { CheckAuthHeader, isFeatureEnabled, parseMessageBody } from '../utils/Helpers';
import { withStoredChannels } from '../utils/presentationChannels';
import { buildCatchUpRequest, pickCatchUpChunks } from '../utils/catchUp';
import { unpackErrorCopy } from '../utils/unpackPassage';
import TokenManagerDefault from '../utils/TokenManager';
import { Alert, Button, Dialog, Snackbar } from '@mui/material';
import { Info } from '@mui/icons-material';
import {
  useResources,
  useAnalytics,
  useConversationMessages,
  useMessageModeration,
  useConversationSetup,
  useSessionJoin,
  useTabNavigation,
} from '../hooks';

type Resource = components['schemas']['Resource'];
type UnpackRequestBody = components['schemas']['UnpackRequestBody'];

const CATCH_UP_TIMEOUT_MS = 2 * 60 * 1000; // 2 min

export const getServerSideProps = async (context: { req: any }) => {
  return CheckAuthHeader(context.req.headers);
};

const NO_AGENT_IDS: string[] = [];

// Both the live channel and its pre-event stand-in count as "group chat" for incoming messages,
// since a reply can still land on the channel just switched away from (see eventStartedHandler).
const GROUP_CHAT_CHANNELS = ['chat', 'pregame'];

export function EventAssistantRoom({
  authType: _authType,
  presentation = false,
}: {
  authType: AuthType;
  presentation?: boolean;
}) {
  const router = useRouter();

  // A projector is not an audience member: Matomo still logs its page views, but the recap's audience count skips them.
  useAnalytics({ pageType: presentation ? 'presentation' : 'assistant' });

  const {
    resources,
    setResources,
    newResourceIds,
    unseenResourcesCount,
    resourcesNavBadgeDismissed,
    setResourcesNavBadgeDismissed,
    resourcesReminderActive,
    setResourcesReminderActive,
    handleMarkReadingsAsSeen,
    handleResourcesUpdated,
    handleConversationEnding,
    onClearResources,
  } = useResources();

  const conversationType = useConversationType();
  const setConversationType = useSetConversationType();
  const setBotNameContext = useSetBotName();

  const {
    activeTab,
    activeTabRef,
    unseenAssistantCount,
    setUnseenAssistantCount,
    unseenChatCount,
    setUnseenChatCount,
    handleTabChange,
  } = useTabNavigation({
    router,
    onClearUnseenResources: onClearResources,
    onClearResourcesBadge: () => setResourcesNavBadgeDismissed(true),
  });

  // useSessionJoin's socket connection is gated on the event being active, which
  // useConversationSetup only knows after its own data fetch resolves. Neither hook
  // can take the other's return value directly, so
  // the gate is threaded through local state and synced once eventStatus is known.
  const [enableSocket, setEnableSocket] = useState(false);

  const {
    socket,
    pseudonym,
    userId,
    isConnected,
    errorMessage: sessionError,
    lastReconnectTime,
  } = useSessionJoin(enableSocket);

  const {
    generalError,
    setGeneralError,
    paramsError,
    eventName,
    eventDescription,
    speakers,
    moderators,
    botName,
    agentId,
    agentActive,
    agentIds,
    conversationFeatures,
    feedbackFrequency,
    transcriptPasscode,
    chatPasscode,
    groupChatChannelName,
    eventScheduledTime,
    initialJoinComplete,
    setInitialJoinComplete,
    chatIntroRef,
    assistantIntroRef,
    hasJoinedConvRef,
    eventStatus,
    eventStatusLoaded,
    showEventStatusDialog,
    setShowEventStatusDialog,
    markEventEnded,
    markEventStarted,
  } = useConversationSetup({
    socket,
    userId,
    router,
    setConversationType,
    setBotNameContext,
    setResources,
    presentation,
  });

  // A shared screen has no Private Chat, and the backend counts attendees by their private assistant channels.
  const privateChatAgentIds = presentation ? NO_AGENT_IDS : agentIds;

  // Enable socket connection only when the event status is loaded and active.
  // conversation:stopped flips eventStatus to 'ended' which disconnects the
  // socket here. If the event later restarts, a page refresh re-runs the
  // initial active check and reconnects.
  useEffect(() => {
    const active = eventStatusLoaded && eventStatus === 'active';
    setEnableSocket(active);
    if (eventStatusLoaded && !active) {
      TokenManagerDefault.pauseProactiveRefresh();
    }
  }, [eventStatusLoaded, eventStatus]);

  // Optimistic admin verdicts still waiting on the server, kept for fetches that land in the meantime.
  const pendingHiddenRef = useRef(new Map<string, boolean>());
  // Set when the pregame->chat switch needs the group chat intro swapped for the chat channel's
  // own intro. Consumed by the join callback, which fires asynchronously, so it can land before
  // or after fetchChatMessages's REST read of chatIntroRef without either dropping the swap.
  const pendingGroupChatIntroSwapRef = useRef(false);
  // Mirrors groupChatChannelName for the join effect's async response callback, which closes over
  // whichever channel it was joining for — a stale response for a channel already left (e.g. a
  // slow pregame join resolving after the switch to chat) is detected by comparing against this.
  const groupChatChannelNameRef = useRef(groupChatChannelName);
  useEffect(() => {
    groupChatChannelNameRef.current = groupChatChannelName;
  }, [groupChatChannelName]);

  const {
    assistantMessages,
    setAssistantMessages,
    chatMessages,
    setChatMessages,
    pollCounts,
    setPollCounts,
    unreadChatReplyCount,
    unreadAssistantReplyCount,
    messagesWithUnreadReplies,
    setMessagesWithUnreadReplies,
    assistantMessagesWithUnreadReplies,
    setAssistantMessagesWithUnreadReplies,
    fetchAllAssistantMessages,
    fetchChatMessages,
  } = useConversationMessages({
    userId,
    pseudonym,
    agentId,
    agentIds: privateChatAgentIds,
    chatPasscode,
    groupChatChannelName,
    initialJoinComplete,
    chatIntroRef,
    assistantIntroRef,
    conversationId: router.query.conversationId as string | undefined,
    pendingHiddenRef,
  });

  const [waitingForResponse, setWaitingForResponse] = useState(false);
  const [waitingForChatResponse, setWaitingForChatResponse] = useState(false);
  const [eventStartedToastOpen, setEventStartedToastOpen] = useState(false);
  const [messageRatings, setMessageRatings] = useState<Map<string, string>>(new Map());
  const [controlledMode, setControlledMode] = useState<ControlledInputConfig | null>(null);
  const [assistantInputValue, setAssistantInputValue] = useState<string>('');
  const [chatInputValue, setChatInputValue] = useState<string>('');
  const [pseudonymFunFact, setPseudonymFunFact] = useState<string | undefined>(undefined);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!userId) return;
    RetrieveData(`users/user/${userId}`, Api.get().getAccessToken()).then((user) => {
      if (user && !('error' in user)) {
        const activePseudonym = user.pseudonyms?.find((p: any) => p.active);
        if (activePseudonym?.funFact) setPseudonymFunFact(activePseudonym.funFact);
        setIsAdmin(user.role === 'admin');
      }
    });
  }, [userId]);

  const { moderation, toast, clearToast } = useMessageModeration({
    socket,
    userId,
    conversationId: router.query.conversationId as string | undefined,
    isAdmin,
    chatMessages,
    setChatMessages,
    setAssistantMessages,
    pendingHiddenRef,
  });

  const [catchUpAnnouncement, setCatchUpAnnouncement] = useState<CatchUpNotice | null>(null);
  // Tracked apart from waitingForResponse, which any Berkie reply clears, even one to an earlier question.
  const [catchUpPending, setCatchUpPending] = useState(false);
  // Null until the transcript history loads, so a catch-up can't go out with an incomplete list.
  const [transcriptChunks, setTranscriptChunks] = useState<PseudonymousMessage[] | null>(null);

  useEffect(() => {
    if (!catchUpPending) return;
    const timeout = setTimeout(() => {
      setCatchUpPending(false);
      setGeneralError(`${botName} didn't answer your catch-up. Please try again.`);
    }, CATCH_UP_TIMEOUT_MS);
    return () => clearTimeout(timeout);
  }, [catchUpPending, botName, setGeneralError]);

  // Derive slash commands from the loaded conversation type's features.
  const slashCommands: SlashCommand[] = (conversationType?.features ?? [])
    .filter((f) => f.slashCommand != null && isFeatureEnabled(f.name, conversationFeatures, conversationType?.features))
    .map((f) => ({
      command: f.slashCommand!,
      description: f.description ?? '',
      value: `/${f.slashCommand} `,
    }));

  const unpackerOn = isFeatureEnabled('unpacker', conversationFeatures, conversationType?.features);
  const catchUpReady = unpackerOn && !presentation && (!transcriptPasscode || transcriptChunks !== null);
  const privateChatOnScreen = activeTab === 'assistant' && router.query.view !== 'preferences';
  useEffect(() => {
    if (privateChatOnScreen) setCatchUpAnnouncement(null);
  }, [privateChatOnScreen]);
  const [focusPrivateChatInput, setFocusPrivateChatInput] = useState(false);
  // The panel reads the flag when it mounts (child effects run first), so later tab switches leave focus alone.
  useEffect(() => {
    if (focusPrivateChatInput) setFocusPrivateChatInput(false);
  }, [focusPrivateChatInput]);
  const openPrivateChatFromUnpacker = () => {
    setFocusPrivateChatInput(true);
    handleTabChange('assistant');
  };
  // Organizer's chosen destination for the bot's voice: 'zoom' means Recall's own Zoom-facing bot
  // speaks there, so the presentation view's bot presence panel must not also play audio — that's
  // the double-audio outcome voiceDestination exists to prevent.
  const voiceDestination =
    (conversationFeatures.find((f) => f.name === 'voiceOutput')?.config?.voiceDestination as string | undefined) ??
    'presentation';

  // Socket event listeners — cross-cutting: messages + tab badges + loading state + resources
  useEffect(() => {
    const messageHandler = (data: PseudonymousMessage) => {
      if (process.env.NODE_ENV !== 'production') console.log('New message:', data);
      if (data.conversation && String(data.conversation) !== (router.query.conversationId as string | undefined)) return;

      if (data.fromAgent && data.bodyType === 'json') {
        const body = typeof data.body === 'string' ? JSON.parse(data.body as string) : (data.body as any);
        if (body?.type === 'poll' && body.whenResultsVisible === 'always') {
          const zeroCounts = Object.fromEntries((body.choices as string[]).map((c) => [c, 0]));
          setPollCounts((prev) => ({ ...prev, [body.pollId]: zeroCounts }));
        }
        if (body?.type === 'catch_up_summary' || body?.type === 'catch_up_refused') {
          setCatchUpPending(false);
          // On Private Chat the message list already reads the reply out.
          if (activeTabRef.current !== 'assistant' && data.id) {
            setCatchUpAnnouncement({
              id: data.id,
              refusal: body.type === 'catch_up_refused' ? body.text : null,
              earlierSpeech: body.type === 'catch_up_summary' && body.earlierSpeech === true,
            });
          }
        }
      }

      if (data.channels && data.channels.some((c) => GROUP_CHAT_CHANNELS.includes(c))) {
        // Deduped by id and slotted in by createdAt: an unhidden message can arrive after newer ones.
        setChatMessages((prev) => insertMessageInOrder(prev, data));
        if (activeTabRef.current !== 'chat') {
          setUnseenChatCount((prev) => prev + 1);
        }
      } else if (!data.channels || !data.channels.includes('transcript')) {
        setAssistantMessages((prev) => [...prev, data]);
        if (activeTabRef.current !== 'assistant') {
          setUnseenAssistantCount((prev) => prev + 1);
        }
      }

      if (data.fromAgent) {
        if (data.channels && data.channels.some((c) => GROUP_CHAT_CHANNELS.includes(c))) {
          setWaitingForChatResponse(false);
        } else {
          setWaitingForResponse(false);
        }
      }
    };

    const resourcesUpdatedHandler = (payload: { resources: Resource[] }) =>
      handleResourcesUpdated(payload, activeTabRef.current === 'resources');

    // Pregame messages stay in their own channel rather than carrying over, so clear them here
    // instead of waiting on the live channel's history fetch — a toast explains why chat just
    // emptied, since the fetch landing in a stale-looking panel would read as a loss, not a handoff.
    const eventStartedHandler = () => {
      if (groupChatChannelName !== 'pregame') return;
      setChatMessages([]);
      setWaitingForChatResponse(false);
      setMessagesWithUnreadReplies(new Set());
      setUnseenChatCount(0);
      pendingGroupChatIntroSwapRef.current = true;
      markEventStarted();
      setEventStartedToastOpen(true);
    };

    const pollChoiceHandler = (data: { pollId: string; counts: Record<string, number> }) => {
      if (!data?.pollId || !data?.counts) return;
      setPollCounts((prev) => ({ ...prev, [data.pollId]: data.counts }));
    };

    if (!socket || !socket.connected) return;

    socket.on('message:new', messageHandler);
    socket.on('resources:updated', resourcesUpdatedHandler);
    socket.on('conversation:ending', handleConversationEnding);
    socket.on('conversation:stopped', markEventEnded);
    socket.on('conversation:started', eventStartedHandler);
    socket.on('choice:new', pollChoiceHandler);

    console.log('Socket event listeners registered');

    return () => {
      socket.off('message:new', messageHandler);
      socket.off('resources:updated', resourcesUpdatedHandler);
      socket.off('conversation:ending', handleConversationEnding);
      socket.off('conversation:stopped', markEventEnded);
      socket.off('conversation:started', eventStartedHandler);
      socket.off('choice:new', pollChoiceHandler);
    };
    // activeTabRef is a ref; the remaining omitted values are stable state setters from hooks.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    socket,
    socket?.connected,
    groupChatChannelName,
    handleResourcesUpdated,
    handleConversationEnding,
    markEventEnded,
    markEventStarted,
  ]);

  // Track user ID in analytics when pseudonym is available
  useEffect(() => {
    if (pseudonym) {
      setUserId(pseudonym);
    }
  }, [pseudonym]);

  // Join conversation when socket, agentId, and userId are all available.
  // Also re-joins automatically on every socket reconnection.
  // Cross-cutting: uses setup state (agentId, chatPasscode, refs) + messages state (setChatMessages)
  useEffect(() => {
    if (!socket || !userId || !router.query.conversationId) {
      return;
    }

    if (agentActive && !agentId) {
      return;
    }

    const agentChannels =
      privateChatAgentIds.length > 0
        ? buildDirectChannels(
            userId,
            privateChatAgentIds.map((id) => ({ agentId: id })),
          )
        : [];

    const channels: components['schemas']['Channel'][] = [...agentChannels];
    if (chatPasscode) {
      channels.push({
        name: groupChatChannelName,
        passcode: chatPasscode,
        direct: false,
      });
    }
    if (channels.length === 0) {
      return;
    }

    const joinConversation = () => {
      if (hasJoinedConvRef.current) return;
      hasJoinedConvRef.current = true;
      const joinedChannelName = groupChatChannelName;
      console.log('Joining conversation');
      emitWithTokenRefresh(
        socket,
        'conversation:join',
        {
          conversationId: router.query.conversationId,
          token: Api.get().getAccessToken(),
          channels,
          ...(presentation && { observer: true }),
        },
        (response) => {
          // A slow join for a channel we've since left (e.g. pregame, after the switch to chat)
          // lands after the fresh join for the current channel — ignore it rather than re-apply
          // its now-stale intros.
          if (joinedChannelName !== groupChatChannelNameRef.current) return;

          console.log('Successfully joined conversation');

          const intros: PseudonymousMessage[] = response?.intros ?? [];

          chatIntroRef.current = intros.filter(
            (m) => Array.isArray(m.channels) && m.channels.includes(groupChatChannelName),
          );
          assistantIntroRef.current = intros.filter(
            (m) => Array.isArray(m.channels) && m.channels.some((c) => c.includes(`-${agentId}`)),
          );

          setInitialJoinComplete((already) => {
            if (!already) {
              if (chatIntroRef.current.length > 0) setChatMessages(chatIntroRef.current);
              if (assistantIntroRef.current.length > 0) setAssistantMessages(assistantIntroRef.current);
            }
            return true;
          });

          if (pendingGroupChatIntroSwapRef.current) {
            pendingGroupChatIntroSwapRef.current = false;
            setChatMessages((prev) => [
              ...chatIntroRef.current,
              ...prev.filter((m) => parseMessageBody(m.body)?.type !== 'intro'),
            ]);
          }
        },
        (error) => {
          console.error('Failed to join conversation:', error);
          setInitialJoinComplete(true);
        },
      );
    };

    const onConnect = () => {
      hasJoinedConvRef.current = false;
      joinConversation();
    };
    socket.on('connect', onConnect);

    if (socket.connected) {
      joinConversation();
    }

    return () => {
      socket.off('connect', onConnect);
    };
    // chatIntroRef, assistantIntroRef, hasJoinedConvRef are refs; the remaining omitted values
    // are stable setters from hooks. This matches the original join effect behavior.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    socket,
    agentId,
    agentActive,
    privateChatAgentIds,
    presentation,
    userId,
    chatPasscode,
    groupChatChannelName,
    router.query.conversationId,
  ]);

  // Re-fetch all message history when the socket reconnects after a significant gap.
  // Cross-cutting: uses messages (fetchChatMessages, fetchAllAssistantMessages) + resources (setResources)
  // Also fetch once if event has ended (no join will occur, but messages may still be available).
  useEffect(() => {
    const hasNoArchivedMessages = chatMessages.length === 0 && eventStatus === 'ended';
    // Only check lastReconnectTime for active events; for ended events, we want to fetch messages once on load.
    if (eventStatus === 'active' && (!lastReconnectTime || lastReconnectTime < Date.now() - 10000)) return;
    if (!router.query.conversationId) return;
    if (!initialJoinComplete && !hasNoArchivedMessages) return;
    // If the event just ended at runtime (conversation:stopped), we were an active
    // participant and already have all messages — skip the re-fetch.
    if (eventStatus === 'ended' && initialJoinComplete) return;

    console.log('Assistant re-fetching message history after gap-reconnect...');

    if (chatPasscode) {
      fetchChatMessages().catch((err) => console.error('Error re-fetching chat messages:', err));
    }

    RetrieveData(`conversations/${router.query.conversationId}`, Api.get().getAccessToken())
      .then((data) => {
        if (Array.isArray(data?.resources)) setResources(data.resources);
        // A client asleep or reconnecting right at the official start can miss the one-time
        // conversation:started broadcast entirely; this catches that case too (a no-op if
        // already on the live channel, since markEventStarted checks groupChatChannelName itself).
        if (data?.active === true) markEventStarted();
      })
      .catch((err) => console.error('Error re-fetching resources after reconnect:', err));

    fetchAllAssistantMessages();
    fetchChatMessages();
    // fetchAllAssistantMessages, fetchChatMessages, setResources, markEventStarted are stable
    // (useCallback / setState).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastReconnectTime, router.query.conversationId, chatPasscode, initialJoinComplete, eventStatus]);

  // Handle ESC key to exit controlled mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && controlledMode) {
        setControlledMode(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [controlledMode]);

  async function sendMessage(
    message: string,
    shouldWaitForResponse: boolean = true,
    parentMessageId?: string,
    skipTracking: boolean = false,
    messageSource: 'message' | 'promptResponse' = 'message',
    promptQuestionId?: string,
  ) {
    if (!Api.get().GetTokens() || !message || !initialJoinComplete) return false;

    const effectiveTab = activeTab === 'transcript' ? 'assistant' : activeTab;

    let channels =
      effectiveTab === 'chat'
        ? [{ name: groupChatChannelName, passcode: chatPasscode }]
        : [{ name: `direct-${userId}-${agentId}` }];

    if (effectiveTab !== 'chat' && parentMessageId) {
      const parentMessage = assistantMessages.find((m) => m.id === parentMessageId);
      const parentDirectChannel = parentMessage?.channels?.find((c) => c.startsWith('direct-') && !c.includes(agentId!));
      if (parentDirectChannel) {
        channels = [{ name: parentDirectChannel }];
      }
    }

    const finalMessage = controlledMode ? controlledMode.prefix + message : message;

    if (!skipTracking) {
      const conversationId = router.query.conversationId as string;

      if (message.startsWith('/')) {
        const commandName = message.split(' ')[0].substring(1).split('|')[0];
        trackConversationEvent(conversationId, 'assistant', 'command_sent', commandName);
      } else if (controlledMode) {
        trackConversationEvent(conversationId, 'assistant', 'feedback_sent', controlledMode.label);
      } else {
        trackConversationEvent(conversationId, effectiveTab, 'message_sent', messageSource);
      }
    }

    const isModeratorCommand = finalMessage.trimStart().startsWith('/escalate ') || finalMessage.trim() === '/mod';
    if (shouldWaitForResponse && !controlledMode && !isModeratorCommand) {
      if (effectiveTab === 'assistant') {
        setWaitingForResponse(true);
      } else if (effectiveTab === 'chat') {
        setWaitingForChatResponse(true);
      }
    }

    const sent = await submitMessage(finalMessage, 'text', channels, {
      ...(parentMessageId !== undefined && { parentMessage: parentMessageId }),
      ...(messageSource === 'promptResponse' && promptQuestionId && { answersPrompt: promptQuestionId }),
    });
    if (!sent) {
      setWaitingForResponse(false);
      setWaitingForChatResponse(false);
    } else if (controlledMode) {
      setControlledMode(null);
    }
    return sent;
  }

  /**
   * Posts a message and shows an error when the server rejects it or can't be reached.
   * @param body The message body: plain text, or a structured request such as a catch-up.
   * @param bodyType How the server should read the body.
   * @param channels The channels to post to.
   * @param extraFields Other message fields, such as the parent message of a thread reply.
   * @param wrongPasscodeError What to show when the server refuses a passcode. A catch-up carries
   *   the transcript's passcode rather than the chat's, so it names the transcript.
   * @returns Whether the server accepted the message.
   */
  async function submitMessage(
    body: string | UnpackRequestBody,
    bodyType: 'text' | 'json',
    channels: { name: string; passcode?: string }[],
    extraFields: Record<string, string> = {},
    wrongPasscodeError = 'Incorrect chat passcode. Message could not be sent.',
  ) {
    const response = await SendData('messages', {
      body,
      bodyType,
      conversation: router.query.conversationId,
      channels,
      ...extraFields,
    });

    if (response?.error && response.message?.toLocaleLowerCase().includes('incorrect passcode')) {
      setGeneralError(wrongPasscodeError);
      return false;
    }
    if (!response || response.error) {
      console.error('Error sending message:', response);
      setGeneralError('Message could not be sent. Please try again.');
      return false;
    }
    return true;
  }

  const catchUp = async (retryOf?: UnpackRequestBody) => {
    if (!Api.get().GetTokens() || !initialJoinComplete) {
      setGeneralError('Still connecting. Please try again in a moment.');
      return;
    }

    // The server never saves the passcode, so a retry built from chat history needs it added back.
    const request = {
      ...(retryOf ?? buildCatchUpRequest(pickCatchUpChunks(transcriptChunks ?? []))),
      ...(transcriptPasscode && { transcriptPasscode }),
    };
    trackConversationEvent(
      router.query.conversationId as string,
      'assistant',
      'command_sent',
      retryOf ? 'catch_up_retry' : 'catch_up',
    );
    setCatchUpPending(true);
    const sent = await submitMessage(
      request,
      'json',
      [{ name: `direct-${userId}-${agentId}` }],
      {},
      unpackErrorCopy('wrongPasscode', botName).message,
    );
    if (!sent) setCatchUpPending(false);
  };

  const enterControlledMode = (config: ControlledInputConfig) => {
    setControlledMode(config);
  };

  const exitControlledMode = () => {
    setControlledMode(null);
  };

  const sendFeedbackRating = async (messageId: string, rating: string) => {
    const conversationId = router.query.conversationId as string;
    trackConversationEvent(conversationId, 'assistant', 'rating_submitted', rating);
    const feedbackText = `/feedback|Rating|${messageId}|${rating}`;
    await sendMessage(feedbackText, false, undefined, true);

    setMessageRatings((prev) => new Map(prev).set(messageId, rating));
  };

  const handlePromptSelect = async (value: string, promptMessageId?: string) => {
    const promptMessage = assistantMessages.find((msg) => msg.id === promptMessageId);
    const threadParentId = promptMessage?.parentMessage;
    // A prompt answer isn't a question to the bot, so don't show the thinking indicator while
    // waiting on it like a normal message — the backend never generates a reply to wait for.
    await sendMessage(value, false, threadParentId, false, 'promptResponse', promptMessageId);
  };

  const assistantFeedbackConfig: FeedbackConfig = {
    eligibleMessageIds: getFeedbackEligibleMessages(assistantMessages, feedbackFrequency),
    messageRatings,
    onPopulateFeedbackText: enterControlledMode,
    onSendRating: sendFeedbackRating,
  };

  const chatFeedbackConfig: FeedbackConfig = {
    eligibleMessageIds: getFeedbackEligibleMessages(chatMessages, feedbackFrequency),
    messageRatings,
    onPopulateFeedbackText: enterControlledMode,
    onSendRating: sendFeedbackRating,
  };

  const eventStatusNotice = (
    <div className="flex flex-col items-center gap-4">
      <h2 id="event-status-dialog-title" className="text-2xl font-bold text-gray-900 flex items-center justify-center">
        <Info className="inline-block mr-2" />
        {eventStatus === 'ended' ? 'Event Has Ended' : 'Event Not Started'}
      </h2>
      <p id="event-status-dialog-description" className="text-gray-600 text-base leading-relaxed">
        {eventStatus === 'ended' ? (
          <span>
            This event has ended and the assistant is no longer available. You can still view the transcript and resources,
            but you will not be able to send new messages.
          </span>
        ) : (
          <span>This event has not started yet. You will be able to interact with the assistant once the event begins.</span>
        )}
      </p>
      {eventStatus === 'ended' && (
        <div className="flex flex-col gap-3 w-full mt-2">
          <Button
            aria-label={`Close event ${eventStatus === 'ended' ? 'has ended' : 'not started'} dialog`}
            onClick={() => setShowEventStatusDialog(false)}
          >
            Ok
          </Button>
        </div>
      )}
    </div>
  );

  const exitPresentation = () => router.push({ pathname: '/assistant/', query: withStoredChannels(router.query) });

  return (
    <>
      {presentation && <PresentationHeader eventName={eventName} onExit={exitPresentation} />}
      {/* On mobile we add bottom padding so the fixed nav bar doesn't cover content */}
      <div
        className={`flex flex-row overflow-hidden pb-[60px] lg:pb-0 ${
          presentation ? 'h-[calc(100vh-72px)]' : 'h-[calc(100vh-96px)]'
        }`}
      >
        {/* Error messages */}
        {(generalError || sessionError) && !paramsError && (
          <Errors generalError={generalError} sessionError={sessionError} setGeneralError={setGeneralError} />
        )}

        {/* Dialog for when the event has ended or has not started yet; if in future, this is non-dismissable.
            The presentation view shows the same notice in the page instead, so its exit stays reachable. */}
        <Dialog
          open={showEventStatusDialog && !presentation}
          onClose={eventStatus === 'ended' ? () => setShowEventStatusDialog(false) : () => {}}
          aria-labelledby="event-status-dialog-title"
          aria-describedby="event-status-dialog-description"
          slotProps={{
            paper: {
              sx: {
                borderRadius: '16px',
                padding: '32px 24px',
                maxWidth: '440px',
                textAlign: 'center',
              },
            },
          }}
        >
          {eventStatusNotice}
        </Dialog>

        {/* Display parameter errors if present */}
        {paramsError ? (
          <ParamErrors paramsError={paramsError} />
        ) : (
          <>
            {/* ── Navigation Bar (left sidebar on desktop, bottom bar on mobile) ── */}
            <NavigationBar
              activeTab={router.query.view === 'preferences' ? null : activeTab}
              onTabChange={handleTabChange}
              unseenAssistantCount={unseenAssistantCount}
              unseenChatCount={unseenChatCount}
              unseenResourcesCount={resourcesNavBadgeDismissed ? 0 : unseenResourcesCount}
              unreadAssistantReplyCount={unreadAssistantReplyCount}
              unreadChatReplyCount={unreadChatReplyCount}
              showChat={!!chatPasscode}
              showTranscript={!!transcriptPasscode}
              showResources={true}
              botName={botName}
              presentation={presentation}
            />

            {/* ── Main content area ── */}
            <div className="flex-1 flex flex-row overflow-hidden">
              {/* Transcript — always mounted so it doesn't re-fetch on tab/view switch.
                  Full-screen when transcript tab is active; sidebar on large screens otherwise;
                  hidden when preferences is open or on small screens in sidebar mode. The
                  presentation view has no sidebar: the chat needs that width on a shared screen. */}
              {transcriptPasscode && (
                <div
                  hidden={presentation && activeTab !== 'transcript'}
                  className={
                    router.query.view === 'preferences'
                      ? 'hidden'
                      : activeTab === 'transcript'
                        ? 'flex-1 overflow-hidden'
                        : presentation
                          ? undefined
                          : 'hidden lg:block lg:order-2'
                  }
                >
                  <Transcript
                    category="assistant"
                    socket={socket}
                    conversationId={router.query.conversationId as string}
                    transcriptPasscode={transcriptPasscode}
                    lastReconnectTime={lastReconnectTime}
                    hideToggle={presentation || (router.query.view !== 'preferences' && activeTab === 'transcript')}
                    presentation={presentation}
                    onMessagesChange={unpackerOn ? setTranscriptChunks : undefined}
                    unpack={
                      unpackerOn
                        ? {
                            onOpenPrivateChat: privateChatOnScreen ? undefined : openPrivateChatFromUnpacker,
                            catchUp: catchUpReady
                              ? {
                                  onCatchUp: () => catchUp(),
                                  sent: catchUpPending || catchUpAnnouncement !== null,
                                  waiting: waitingForResponse,
                                  unreadAnswer: catchUpAnnouncement,
                                }
                              : undefined,
                          }
                        : undefined
                    }
                  />
                </div>
              )}
              {activeTab !== 'transcript' ? (
                <>
                  {/* Chat / Assistant / Resources / Preferences panel */}
                  <div className="flex-1 flex flex-col relative overflow-hidden">
                    {presentation && showEventStatusDialog && (
                      <div
                        role="status"
                        className="absolute inset-x-0 top-6 z-10 mx-auto w-full max-w-md rounded-2xl bg-white px-6 py-8 text-center shadow-2xl dark:border dark:border-nx-border-strong dark:bg-nx-raised"
                      >
                        {eventStatusNotice}
                      </div>
                    )}
                    {/* Show dismissable resources reminder if active  */}
                    {resourcesReminderActive && (
                      <div className="absolute top-0 w-full z-10 bg-yellow-100 p-4 rounded shadow-2xl animate-slide-in dark:bg-nx-raised dark:text-nx-text">
                        <div className="flex justify-between font-bold">
                          <p>
                            {resourcesNavBadgeDismissed
                              ? "This event ends soon. Don't forget to review Resources and bookmark or save them for your reference."
                              : "This event ends soon. Don't forget to check the Resources tab for follow-up readings worth bookmarking."}
                          </p>
                          <Button
                            aria-label="Dismiss resources reminder"
                            className="ml-4 px-2 py-2"
                            onClick={() => setResourcesReminderActive(false)}
                            color="error"
                          >
                            <CloseIcon />
                          </Button>
                        </div>
                        <button
                          className="mt-2 px-3 py-1 bg-yellow-200 hover:bg-yellow-300 rounded dark:border dark:border-nx-border-interactive dark:bg-nx-active dark:hover:bg-nx-active dark:hover:brightness-125"
                          onClick={() => {
                            handleTabChange('resources');
                            setResourcesReminderActive(false);
                          }}
                        >
                          View Resources
                        </button>
                      </div>
                    )}
                    {router.query.view === 'preferences' ? (
                      <PreferencesPanel botName={botName} />
                    ) : isConnected || eventStatus == 'ended' ? (
                      activeTab === 'chat' ? (
                        <GroupChatPanel
                          messages={chatMessages}
                          pseudonym={pseudonym}
                          pseudonymFunFact={pseudonymFunFact}
                          eventName={eventName}
                          botName={botName}
                          inputValue={chatInputValue}
                          onInputChange={setChatInputValue}
                          onSendMessage={async (msg, parentMessageId) => {
                            const mentionsBot = msg.includes(`@${botName}`);
                            const success = await sendMessage(msg, mentionsBot, parentMessageId);
                            return success;
                          }}
                          controlledMode={controlledMode}
                          onExitControlledMode={exitControlledMode}
                          feedbackConfig={chatFeedbackConfig}
                          messagesWithUnreadReplies={messagesWithUnreadReplies}
                          waitingForResponse={waitingForChatResponse}
                          onMarkAsRead={(messageId) => {
                            setMessagesWithUnreadReplies((prev) => {
                              const newSet = new Set(prev);
                              newSet.delete(messageId);
                              return newSet;
                            });
                          }}
                          pollCounts={pollCounts}
                          inactive={eventStatus !== 'active'}
                          presentation={presentation}
                          isAdmin={isAdmin}
                          moderation={moderation}
                          eventScheduledTime={groupChatChannelName === 'pregame' ? eventScheduledTime : null}
                        />
                      ) : activeTab === 'resources' ? (
                        <ResourcesPanel
                          resources={resources}
                          eventDescription={eventDescription}
                          speakers={speakers}
                          moderators={moderators}
                          eventName={eventName}
                          unseenReadingsCount={unseenResourcesCount}
                          onMarkReadingsAsSeen={handleMarkReadingsAsSeen}
                          newResourceIds={newResourceIds}
                        />
                      ) : (
                        <AssistantChatPanel
                          messages={assistantMessages}
                          pseudonym={pseudonym}
                          pseudonymFunFact={pseudonymFunFact}
                          waitingForResponse={waitingForResponse || catchUpPending}
                          controlledMode={controlledMode}
                          slashCommands={slashCommands}
                          eventName={eventName}
                          botName={botName}
                          inputValue={assistantInputValue}
                          onInputChange={setAssistantInputValue}
                          onSendMessage={async (msg, parentMessageId) => {
                            const success = await sendMessage(msg, true, parentMessageId);
                            return success;
                          }}
                          onExitControlledMode={exitControlledMode}
                          onPromptSelect={handlePromptSelect}
                          userId={userId}
                          feedbackConfig={assistantFeedbackConfig}
                          inactive={!agentActive || eventStatus !== 'active'}
                          onCatchUp={catchUpReady ? catchUp : undefined}
                          transcriptChunks={transcriptChunks ?? undefined}
                          focusInputOnMount={focusPrivateChatInput}
                          messagesWithUnreadReplies={assistantMessagesWithUnreadReplies}
                          onMarkAsRead={(messageId) => {
                            setAssistantMessagesWithUnreadReplies((prev) => {
                              const newSet = new Set(prev);
                              newSet.delete(messageId);
                              return newSet;
                            });
                          }}
                        />
                      )
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        <svg className="mx-auto w-12 h-5" viewBox="0 0 40 10" fill="currentColor">
                          <circle className="animate-bounce fill-sky-400" cx="5" cy="5" r="4" />
                          <circle
                            className="animate-bounce [animation-delay:-0.2s] fill-medium-slate-blue"
                            cx="20"
                            cy="5"
                            r="4"
                          />
                          <circle className="animate-bounce [animation-delay:-0.4s] fill-purple-500" cx="35" cy="5" r="4" />
                        </svg>
                      </div>
                    )}
                  </div>
                </>
              ) : null}
              {/* Waits for eventStatusLoaded so botName/transcriptPasscode are already resolved before
                  the iframe's first request — otherwise it connects once without the transcript
                  passcode and only gets it on a second, src-change-triggered navigation. */}
              {presentation && eventStatusLoaded && (
                <BotPresence
                  conversationId={router.query.conversationId as string}
                  botName={botName}
                  transcriptPasscode={transcriptPasscode}
                  audioEnabled={voiceDestination !== 'zoom'}
                />
              )}
            </div>
          </>
        )}
      </div>

      <div role="status" className="sr-only">
        {catchUpAnnouncement && (
          <span key={catchUpAnnouncement.id}>
            {catchUpAnnouncement.refusal === null
              ? `${botName} posted your catch-up.`
              : `${botName} couldn't catch you up. ${catchUpAnnouncement.refusal}`}
          </span>
        )}
      </div>

      <Snackbar open={Boolean(toast)} autoHideDuration={6000} onClose={clearToast}>
        <Alert severity={toast?.severity ?? 'info'} onClose={clearToast}>
          {toast?.text}
        </Alert>
      </Snackbar>

      <Snackbar open={eventStartedToastOpen} autoHideDuration={6000} onClose={() => setEventStartedToastOpen(false)}>
        <Alert severity="info" onClose={() => setEventStartedToastOpen(false)}>
          The event has started. Group chat has switched to the live channel.
        </Alert>
      </Snackbar>
    </>
  );
}

export default EventAssistantRoom;
