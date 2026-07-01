import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/router';
import CloseIcon from '@mui/icons-material/Close';

import { AssistantChatPanel } from '../components/AssistantChatPanel';
import { GroupChatPanel } from '../components/GroupChatPanel';
import { ResourcesPanel } from '../components/ResourcesPanel';
import { SlashCommand } from '../components/enhancers/slashCommandEnhancer';
import {
  Api,
  RetrieveData,
  SendData,
  GetChannelPasscode,
  emitWithTokenRefresh,
  buildDirectChannels,
  QueryParamsError,
  getPollResponseCounts,
  inspectPoll,
} from '../utils';
import { components } from '../types';
import { ControlledInputConfig, PseudonymousMessage, FeedbackConfig } from '../types.internal';
import { CheckAuthHeader, createConversationFromData, resolveConversationBotName, parseMessageBody } from '../utils/Helpers';

type Resource = components['schemas']['Resource'];
import { useAnalytics } from '../hooks/useAnalytics';
import { useConversationType, useSetBotName, useSetConversationType } from '../context/ConversationTypeContext';
import { AuthType } from '../types.internal';
import { trackConversationEvent, setUserId } from '../utils/analytics';
import { Errors, ParamErrors, Transcript } from '../components/';
import { useSessionJoin } from '../utils/useSessionJoin';
import { NavigationBar, NavTab } from '../components/NavigationBar';
import { PreferencesPanel } from '../components/PreferencesPanel';
import { getFeedbackEligibleMessages } from '../utils/feedbackEligibility';
import { Button } from '@mui/material';

export const getServerSideProps = async (context: { req: any }) => {
  return CheckAuthHeader(context.req.headers);
};

/**
 * Fetches threaded replies for messages and inserts them into the message array.
 * Defined outside component since it doesn't depend on component state/props.
 */
async function fetchAndInsertReplies(messages: PseudonymousMessage[]): Promise<PseudonymousMessage[]> {
  // Collect all messages with replies
  const messagesWithReplies = messages.filter((msg) => msg.replyCount && msg.replyCount > 0);

  if (messagesWithReplies.length === 0) {
    return messages;
  }

  // Fetch all replies in parallel
  const repliesPromises = messagesWithReplies.map(async (msg) => {
    try {
      const replies = await RetrieveData(`messages/${msg.id}/replies`, Api.get().getAccessToken());
      if ('error' in replies) {
        console.error(`Error fetching replies for message ${msg.id}: ${replies.message?.message}`);
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
}

function EventAssistantRoom({ authType: _authType }: { authType: AuthType }) {
  const router = useRouter();

  // Initialize page-level analytics
  useAnalytics({ pageType: 'assistant' });

  const [generalError, setGeneralError] = useState<string | null>(null);
  const [paramsError, setParamsError] = useState<{ header: string; params: string[] } | null>(null);

  const [waitingForResponse, setWaitingForResponse] = useState(false);
  const [waitingForChatResponse, setWaitingForChatResponse] = useState(false);

  const [activeTab, setActiveTab] = useState<NavTab>('chat');
  const [unseenAssistantCount, setUnseenAssistantCount] = useState<number>(0);
  const [unseenChatCount, setUnseenChatCount] = useState<number>(0);
  const [unseenResourcesCount, setUnseenResourcesCount] = useState<number>(0);
  const [resourcesNavBadgeDismissed, setResourcesNavBadgeDismissed] = useState(false);
  const [unreadAssistantReplyCount, setUnreadAssistantReplyCount] = useState<number>(0);
  const [unreadChatReplyCount, setUnreadChatReplyCount] = useState<number>(0);
  // Track which resource IDs are new (unseen) for highlighting
  const [newResourceIds, setNewResourceIds] = useState<Set<string>>(new Set());

  // Track previous reply counts for chat messages (persists across tab switches)
  const [chatPreviousReplyCounts, setChatPreviousReplyCounts] = useState<Map<string, number>>(new Map());
  // Track previous reply counts for assistant messages (persists across tab switches)
  const [assistantPreviousReplyCounts, setAssistantPreviousReplyCounts] = useState<Map<string, number>>(new Map());
  const [assistantMessages, setAssistantMessages] = useState<PseudonymousMessage[]>([]);
  const [chatMessages, setChatMessages] = useState<PseudonymousMessage[]>([]);
  const [pollCounts, setPollCounts] = useState<Record<string, Record<string, number>>>({});
  const [resources, setResources] = useState<Resource[]>([]);
  // Tracks whether the first conversation:join has completed so initial message
  // fetches wait until intros (returned in the join callback) are applied first.
  const [initialJoinComplete, setInitialJoinComplete] = useState(false);
  // Refs hold the most-recent intro messages per channel so fetch effects and
  // reconnect re-fetches can always prepend them without stale-closure issues.
  const chatIntroRef = useRef<PseudonymousMessage[]>([]);
  const assistantIntroRef = useRef<PseudonymousMessage[]>([]);
  const hasJoinedConvRef = useRef(false);
  const [agentId, setAgentId] = useState<string | null>(null);
  const [agentActive, setAgentActive] = useState<boolean>(true);
  const [resourcesReminderActive, setResourcesReminderActive] = useState<boolean>(false);
  const [agentIds, setAgentIds] = useState<string[]>([]);
  const [conversationFeatures, setConversationFeatures] = useState<{ name: string; enabled?: boolean }[]>([]);

  const conversationType = useConversationType();
  const setConversationType = useSetConversationType();
  const setBotNameContext = useSetBotName();

  /* Clear the shared conversation type and bot name when the event changes so
     the Quick Guide doesn't show stale values while the new conversation loads. */
  useEffect(() => {
    setConversationType(null);
    setBotNameContext('Berkie');
  }, [router.query.conversationId]);
  const [feedbackFrequency, setFeedbackFrequency] = useState<number>(1);
  const [messageRatings, setMessageRatings] = useState<Map<string, string>>(new Map());
  const [controlledMode, setControlledMode] = useState<ControlledInputConfig | null>(null);
  const [transcriptPasscode, setTranscriptPasscode] = useState<string>('');
  const [chatPasscode, setChatPasscode] = useState<string>('');
  const [eventName, setEventName] = useState<string>('');
  const [eventDescription, setEventDescription] = useState<string>('');
  const [speakers, setSpeakers] = useState<Array<{ name: string; bio: string }>>([]);
  const [moderators, setModerators] = useState<Array<{ name: string; bio: string }>>([]);
  const [botName, setBotName] = useState<string>('Berkie');
  const [assistantInputValue, setAssistantInputValue] = useState<string>('');
  const [chatInputValue, setChatInputValue] = useState<string>('');
  // Track messages with unread replies (persists across tab switches)
  const [messagesWithUnreadReplies, setMessagesWithUnreadReplies] = useState<Set<string>>(new Set());
  // Track assistant messages with unread replies separately
  const [assistantMessagesWithUnreadReplies, setAssistantMessagesWithUnreadReplies] = useState<Set<string>>(new Set());

  // Ref to track active tab for socket handler
  const activeTabRef = useRef<NavTab>('assistant');

  // Ref to track resources value
  const resourcesRef = useRef<Resource[]>(resources);

  // Use custom hook for session joining
  const { socket, pseudonym, userId, isConnected, errorMessage: sessionError, lastReconnectTime } = useSessionJoin();

  const [pseudonymFunFact, setPseudonymFunFact] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!userId) return;
    RetrieveData(`users/user/${userId}`, Api.get().getAccessToken()).then((user) => {
      if (user && !('error' in user)) {
        const activePseudonym = user.pseudonyms?.find((p: any) => p.active);
        if (activePseudonym?.funFact) setPseudonymFunFact(activePseudonym.funFact);
      }
    });
  }, [userId]);

  // Derive slash commands from the loaded conversation type's features.
  // Empty until the type loads, so the autocomplete stays hidden during that window.
  const slashCommands: SlashCommand[] = (conversationType?.features ?? [])
    .filter((f) => {
      if (f.slashCommand == null) return false;
      const override = conversationFeatures.find((cf) => cf.name === f.name);
      return override?.enabled !== false;
    })
    .map((f) => ({
      command: f.slashCommand!,
      description: f.description ?? '',
      value: `/${f.slashCommand} `,
    }));

  // Set up message listener
  useEffect(() => {
    if (!socket) return;

    const messageHandler = (data: PseudonymousMessage) => {
      if (process.env.NODE_ENV !== 'production') console.log('New message:', data);

      // If a new poll arrives, seed its counts to zero for all choices so the
      // UI can display the bar immediately without waiting for a vote.
      if (data.fromAgent && data.bodyType === 'json') {
        const body = typeof data.body === 'string' ? JSON.parse(data.body as string) : (data.body as any);
        // Only handle polls where results are visible immediately for now. Visible on threshold met and/or expiration to be handled in future
        if (body?.type === 'poll' && body.whenResultsVisible === 'always') {
          const zeroCounts = Object.fromEntries((body.choices as string[]).map((c) => [c, 0]));
          setPollCounts((prev) => ({ ...prev, [body.pollId]: zeroCounts }));
        }
      }

      // Route messages to appropriate array based on channel
      if (data.channels && data.channels.includes('chat')) {
        setChatMessages((prev) => [...prev, data]);
        // Increment counter if NOT viewing chat tab
        if (activeTabRef.current !== 'chat') {
          setUnseenChatCount((prev) => prev + 1);
        }
      } else if (!data.channels || !data.channels.includes('transcript')) {
        setAssistantMessages((prev) => [...prev, data]);
        // Increment counter if NOT viewing assistant tab
        if (activeTabRef.current !== 'assistant') {
          setUnseenAssistantCount((prev) => prev + 1);
        }
      }

      if (data.fromAgent) {
        if (data.channels && data.channels.includes('chat')) {
          setWaitingForChatResponse(false);
        } else {
          setWaitingForResponse(false);
        }
      }
    };

    const resourcesUpdatedHandler = ({ resources: updatedResources }: { resources: Resource[] }) => {
      console.log('resources:updated received', updatedResources);
      setResources((prev) => {
        const prevIds = new Set(prev.map((r) => r.id).filter(Boolean));
        const suggested = updatedResources.filter((r) => r.category === 'suggested');
        const addedIds = suggested.map((r) => r.id).filter((id): id is string => Boolean(id) && !prevIds.has(id));
        if (addedIds.length > 0) {
          setNewResourceIds((existing) => new Set([...existing, ...addedIds]));
          setUnseenResourcesCount((count) => count + addedIds.length);
          if (activeTabRef.current !== 'resources') {
            setResourcesNavBadgeDismissed(false);
          }
        }
        return updatedResources;
      });
    };

    const conversationEndingHandler = () => {
      console.log('conversation:ending received');

      // Don't activate the resources reminder if no resources are available
      if (resourcesRef.current.length === 0) return;
      setResourcesReminderActive(true);
    };

    const pollChoiceHandler = (data: { pollId: string; counts: Record<string, number> }) => {
      if (!data?.pollId || !data?.counts) return;
      setPollCounts((prev) => ({ ...prev, [data.pollId]: data.counts }));
    };

    socket.on('message:new', messageHandler);
    socket.on('resources:updated', resourcesUpdatedHandler);
    socket.on('conversation:ending', conversationEndingHandler);
    socket.on('choice:new', pollChoiceHandler);

    console.log('Socket event listeners registered');

    return () => {
      socket.off('message:new', messageHandler);
      socket.off('resources:updated', resourcesUpdatedHandler);
      socket.off('conversation:ending', conversationEndingHandler);
      socket.off('choice:new', pollChoiceHandler);
    };
  }, [socket, resourcesNavBadgeDismissed, resources.length]);

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
    const queryError = QueryParamsError(router, 'assistant');
    if (queryError) {
      setParamsError(queryError);
      return;
    }

    async function fetchConversationData() {
      try {
        const config = await Api.get().GetConfig();
        setBotName(config.conversationBotName);
        setBotNameContext(config.conversationBotName);

        const conversationData = await RetrieveData(
          `conversations/${router.query.conversationId}`,
          Api.get().getAccessToken(),
        );

        if (!conversationData) {
          setParamsError({ header: 'Conversation Not Found', params: [] });
          return;
        }
        if ('error' in conversationData) {
          // catch conversation not found
          if (conversationData.message?.message.includes('not found'))
            setParamsError({ header: 'Conversation Not Found', params: [] });

          setGeneralError(conversationData.message?.message || 'Error retrieving conversation.');
          return;
        }

        const conversation = await createConversationFromData(conversationData);
        setConversationType(conversation.type);
        setConversationFeatures(conversation.features ?? []);
        if (conversation.name) setEventName(conversation.name);

        // Extract event metadata from conversation
        const frequency = (conversation?.properties?.feedbackFrequency as number) || 1;
        setFeedbackFrequency(frequency);

        if (conversation?.description) {
          setEventDescription(conversation.description as string);
        }
        if (conversation?.presenters) {
          setSpeakers(conversation.presenters as Array<{ name: string; bio: string }>);
        }
        if (conversation?.moderators) {
          setModerators(conversation.moderators as Array<{ name: string; bio: string }>);
        }

        if (Array.isArray(conversation?.resources)) {
          console.log('Fetched conversation resources:', conversation.resources);
          setResources(conversation.resources);
        }

        // Override botName from the first agent's agentConfig if available,
        // falling back to config.conversationBotName
        const resolvedBotName = resolveConversationBotName(conversation, config.conversationBotName);
        setBotName(resolvedBotName);
        setBotNameContext(resolvedBotName);

        // Get transcript and chat passcodes if channel query param exists
        if (router.query.channel) {
          const transcriptPasscodeParam = GetChannelPasscode('transcript', router.query, setGeneralError);

          if (transcriptPasscodeParam) {
            setTranscriptPasscode(transcriptPasscodeParam);
          }

          const chatPasscodeParam = GetChannelPasscode('chat', router.query, setGeneralError);

          if (chatPasscodeParam) {
            setChatPasscode(chatPasscodeParam);
          }
        }

        // Check if the event has an event assistant agent
        const eventAsstAgent = conversation.agents.find(
          (agent: components['schemas']['Agent']) => agent.agentType === 'eventAssistant',
        );
        if (eventAsstAgent) {
          setAgentId(eventAsstAgent.id!);
        } else {
          setAgentActive(false);
        }

        const ids = conversation.agents.map((agent: components['schemas']['Agent']) => agent.id!);
        setAgentIds(ids);
      } catch (error) {
        console.error('Error fetching conversation data:', error);
        setGeneralError('Failed to fetch conversation data.');
      }
    }
    fetchConversationData();
  }, [socket, router]);

  // Join conversation when socket, agentId, and userId are all available.
  // Also re-joins automatically on every socket reconnection so that messages
  // continue flowing after a token refresh or transient network drop.
  useEffect(() => {
    if (!socket || !userId || !router.query.conversationId) {
      return;
    }

    // Only wait for agentId if the agent is expected to be active
    if (agentActive && !agentId) {
      return;
    }

    const agentChannels =
      agentIds.length > 0
        ? buildDirectChannels(
            userId,
            agentIds.map((id) => ({ agentId: id })),
          )
        : [];

    const channels: components['schemas']['Channel'][] = [...agentChannels];
    if (chatPasscode) {
      channels.push({
        name: 'chat',
        passcode: chatPasscode,
        direct: false,
      });
    }
    // Nothing to join if there are no channels (e.g. inactive event with no agent
    // and no chat passcode — transcript uses its own channel:join).
    if (channels.length === 0) {
      return;
    }

    const joinConversation = () => {
      if (hasJoinedConvRef.current) return;
      hasJoinedConvRef.current = true;
      console.log('Joining conversation');
      // Always read the current token so re-joins after a refresh use the
      // new token rather than the one captured at socket-creation time.
      emitWithTokenRefresh(
        socket,
        'conversation:join',
        {
          conversationId: router.query.conversationId,
          token: Api.get().getAccessToken(),
          channels,
        },
        (response) => {
          console.log('Successfully joined conversation');

          const intros: PseudonymousMessage[] = response?.intros ?? [];

          chatIntroRef.current = intros.filter((m) => Array.isArray(m.channels) && m.channels.includes('chat'));
          // Only intros on the eventAssistant's direct channel.
          assistantIntroRef.current = intros.filter(
            (m) => Array.isArray(m.channels) && m.channels.some((c) => c.includes(`-${agentId}`)),
          );

          // Only push intros into state on the very first join. Re-joins
          // must not add them again — the initial fetch effects will prepend
          // from the refs once initialJoinComplete flips to true.
          setInitialJoinComplete((already) => {
            if (!already) {
              if (chatIntroRef.current.length > 0) setChatMessages(chatIntroRef.current);
              if (assistantIntroRef.current.length > 0) setAssistantMessages(assistantIntroRef.current);
            }
            return true;
          });
        },
        (error) => {
          console.error('Failed to join conversation:', error);
          // Unblock initial fetches even when join fails so messages still load.
          setInitialJoinComplete(true);
        },
      );
    };
    // Re-join on every subsequent reconnection (e.g. after token refresh)
    const onConnect = () => {
      hasJoinedConvRef.current = false;
      joinConversation();
    };
    socket.on('connect', onConnect);

    // Only join immediately if the socket is already connected — otherwise
    // let the connect event fire the first join to avoid a duplicate join
    // when the socket is mid-handshake or reconnecting after a token refresh.
    if (socket.connected) {
      joinConversation();
    }

    return () => {
      socket.off('connect', onConnect);
    };
  }, [socket, agentId, agentActive, agentIds, userId, chatPasscode, router.query.conversationId]);

  /**
   * Helper function to fetch all assistant messages across all agent direct channels
   * and their threaded replies
   */
  const fetchAllAssistantMessages = useCallback(async (): Promise<void> => {
    if (!userId || !agentId || !router.query.conversationId) return;

    try {
      const allFetched = await Promise.all(
        agentIds.map((id) =>
          RetrieveData(`messages/${router.query.conversationId}?channel=direct-${userId}-${id}`, Api.get().getAccessToken()),
        ),
      );

      // Filter intro messages from older conversations where intros were persisted
      let allMessages = allFetched
        .flatMap((result) => (Array.isArray(result) ? result : []))
        .filter((m) => parseMessageBody(m.body)?.type !== 'intro');

      // Sort all messages by creation time
      allMessages.sort((a, b) => new Date(a.createdAt!).getTime() - new Date(b.createdAt!).getTime());

      if (allMessages.length > 0) {
        const messagesWithReplies = await fetchAndInsertReplies(allMessages);
        setAssistantMessages([...assistantIntroRef.current, ...messagesWithReplies]);
      }
    } catch (error) {
      console.error('Error fetching assistant messages:', error);
    }
  }, [userId, agentId, agentIds, router.query.conversationId]);

  /**
   * Helper function to track reply count changes and identify unread messages
   * @param messages - Array of messages to process
   * @param replyFilter - Function to filter which replies should be counted
   * @param previousReplyCounts - Map of previous reply counts per parent message
   * @param currentUnreadSet - Current set of unread message IDs
   * @returns Object with new reply counts and updated unread set
   */
  const trackReplyCountChanges = (
    messages: PseudonymousMessage[],
    replyFilter: (reply: PseudonymousMessage) => boolean,
    previousReplyCounts: Map<string, number>,
    currentUnreadSet: Set<string>,
  ): {
    newReplyCounts: Map<string, number>;
    updatedUnreadSet: Set<string>;
  } => {
    // Build thread map
    const threadMap = new Map<string, PseudonymousMessage[]>();
    messages
      .filter((m) => m.parentMessage)
      .forEach((reply) => {
        const parentId = reply.parentMessage!;
        if (!threadMap.has(parentId)) {
          threadMap.set(parentId, []);
        }
        threadMap.get(parentId)!.push(reply);
      });

    const updatedUnreadSet = new Set(currentUnreadSet);
    const newReplyCounts = new Map<string, number>();

    threadMap.forEach((replies, parentId) => {
      // Filter replies based on the provided filter function
      const countableReplies = replies.filter(replyFilter);
      const currentCount = countableReplies.length;
      const previousCount = previousReplyCounts.get(parentId);

      newReplyCounts.set(parentId, currentCount);

      // Only mark as unread if:
      // 1. We had a previous count for this parent (not first time seeing it)
      // 2. Count increased (meaning a new reply arrived)
      if (previousCount !== undefined && currentCount > previousCount) {
        updatedUnreadSet.add(parentId);
      }
    });

    return { newReplyCounts, updatedUnreadSet };
  };

  /**
   * For a list of already-filtered messages, fetches counts and user selections
   * for any always-visible polls and updates both pollCounts state and the
   * initialVotedChoice field on each poll message body (mutating local copies).
   */
  const loadPollData = async (messages: PseudonymousMessage[]) => {
    const pollMessages = messages.filter((m) => {
      if (m.bodyType !== 'json') return false;
      const body = (typeof m.body === 'string' ? JSON.parse(m.body) : m.body) as any;
      return body?.type === 'poll' && body?.whenResultsVisible === 'always';
    });
    if (pollMessages.length === 0) return;

    await Promise.all(
      pollMessages.map(async (m) => {
        const body = (typeof m.body === 'string' ? JSON.parse(m.body) : m.body) as any;
        const [counts, pollData] = await Promise.all([getPollResponseCounts(body.pollId), inspectPoll(body.pollId)]);
        setPollCounts((prev) => ({ ...prev, [body.pollId]: counts }));
        // Inject the user's voted choice back into the message body so PollMessage
        // can seed its local votedChoices state correctly on mount.
        if (pollData?.choices) {
          const selected = pollData.choices.find((c) => c.isSelected);
          if (selected) body.initialVotedChoice = selected.text;
        }
      }),
    );
  };

  /**
   * Fetch chat messages for the current conversation.
   * This includes filtering out intro messages and inserting replies.
   */
  const fetchChatMessages = async () => {
    try {
      const fetched = await RetrieveData(
        `messages/${router.query.conversationId}?channel=chat,${chatPasscode}`,
        Api.get().getAccessToken(),
      );

      if (Array.isArray(fetched)) {
        const nonIntros = fetched.filter((m) => parseMessageBody(m.body)?.type !== 'intro');
        const messagesWithReplies = await fetchAndInsertReplies(nonIntros);
        await loadPollData(messagesWithReplies);
        setChatMessages([...chatIntroRef.current, ...messagesWithReplies]);
      }
    } catch (error) {
      console.error('Error fetching chat messages:', error);
    }
  };

  // Track reply count changes for chat messages
  useEffect(() => {
    const { newReplyCounts, updatedUnreadSet } = trackReplyCountChanges(
      chatMessages,
      (r) => r.pseudonym !== pseudonym, // Count replies from other people
      chatPreviousReplyCounts,
      messagesWithUnreadReplies,
    );

    setChatPreviousReplyCounts(newReplyCounts);
    setMessagesWithUnreadReplies(updatedUnreadSet);
    setUnreadChatReplyCount(updatedUnreadSet.size);
  }, [chatMessages, pseudonym]);

  // Track reply count changes for assistant messages
  useEffect(() => {
    const { newReplyCounts, updatedUnreadSet } = trackReplyCountChanges(
      assistantMessages,
      (r) => r.fromAgent, // Count replies from the agent
      assistantPreviousReplyCounts,
      assistantMessagesWithUnreadReplies,
    );

    setAssistantPreviousReplyCounts(newReplyCounts);
    setAssistantMessagesWithUnreadReplies(updatedUnreadSet);
    setUnreadAssistantReplyCount(updatedUnreadSet.size);
  }, [assistantMessages, pseudonym]);

  // Load initial chat messages after the conversation:join completes (so intros
  // are already in state before DB messages are prepended).
  useEffect(() => {
    if (!chatPasscode || !router.query.conversationId || !initialJoinComplete) return;

    fetchChatMessages();
  }, [chatPasscode, router.query.conversationId, initialJoinComplete]);

  // Load initial assistant messages after the conversation:join completes (so
  // intros are already in state before DB messages are prepended).
  useEffect(() => {
    if (!initialJoinComplete) return;
    fetchAllAssistantMessages();
  }, [fetchAllAssistantMessages, initialJoinComplete]);

  // Re-fetch all message history when the socket reconnects after a significant
  // gap (user was on another tab/app for a while). Fills any messages missed
  // while the client was disconnected.
  useEffect(() => {
    if (!lastReconnectTime || !router.query.conversationId) return;

    console.log('Assistant re-fetching message history after gap-reconnect...');

    if (chatPasscode) {
      fetchChatMessages().catch((err) => console.error('Error re-fetching chat messages:', err));
    }

    RetrieveData(`conversations/${router.query.conversationId}`, Api.get().getAccessToken())
      .then((data) => {
        if (Array.isArray(data?.resources)) setResources(data.resources);
      })
      .catch((err) => console.error('Error re-fetching resources after reconnect:', err));

    fetchAllAssistantMessages();
    fetchChatMessages();
  }, [lastReconnectTime, router.query.conversationId, chatPasscode]);

  async function sendMessage(
    message: string,
    shouldWaitForResponse: boolean = true,
    parentMessageId?: string,
    skipTracking: boolean = false,
    messageSource: 'message' | 'promptResponse' = 'message',
    promptQuestionId?: string,
  ) {
    if (!Api.get().GetTokens() || !message) return false;

    // Use different channel based on active tab
    // When in transcript view, default to assistant channel for sending
    const effectiveTab = activeTab === 'transcript' ? 'assistant' : activeTab;

    let channels =
      effectiveTab === 'chat' ? [{ name: 'chat', passcode: chatPasscode }] : [{ name: `direct-${userId}-${agentId}` }];

    // If replying to a message in assistant tab, route to whichever direct channel
    // the parent message was on (supports any agent, not just the primary one)
    if (effectiveTab !== 'chat' && parentMessageId) {
      const parentMessage = assistantMessages.find((m) => m.id === parentMessageId);
      const parentDirectChannel = parentMessage?.channels?.find((c) => c.startsWith('direct-') && !c.includes(agentId!));
      if (parentDirectChannel) {
        channels = [{ name: parentDirectChannel }];
      }
    }

    // Prepend prefix if in controlled mode
    const finalMessage = controlledMode ? controlledMode.prefix + message : message;

    // Track message send (only if not skipping tracking)
    if (!skipTracking) {
      const conversationId = router.query.conversationId as string;

      // Check if message is a slash command
      if (message.startsWith('/')) {
        const commandName = message.split(' ')[0].substring(1).split('|')[0];
        trackConversationEvent(conversationId, 'assistant', 'command_sent', commandName);
      } else if (controlledMode) {
        trackConversationEvent(conversationId, 'assistant', 'feedback_sent', controlledMode.label);
      } else {
        trackConversationEvent(conversationId, effectiveTab, 'message_sent', messageSource);
      }
    }

    // Set waiting state for assistant or chat mode messages
    // /escalate and /mod are silent moderator commands — suppress the waiting indicator
    const isModeratorCommand = finalMessage.trimStart().startsWith('/escalate ') || finalMessage.trim() === '/mod';
    if (shouldWaitForResponse && !controlledMode && !isModeratorCommand) {
      if (effectiveTab === 'assistant') {
        setWaitingForResponse(true);
      } else if (effectiveTab === 'chat') {
        // Set waiting for chat response when mentioning the bot
        setWaitingForChatResponse(true);
      }
    }

    try {
      const response = await SendData('messages', {
        body: finalMessage,
        bodyType: 'text',
        conversation: router.query.conversationId,
        channels,
        ...(parentMessageId !== undefined && { parentMessage: parentMessageId }),
        ...(messageSource === 'promptResponse' && promptQuestionId && { answersPrompt: promptQuestionId }),
      });

      // Catch incorrect passcode
      if (response && response.error && response.message.toLocaleLowerCase().includes('incorrect passcode')) {
        setGeneralError('Incorrect chat passcode. Message could not be sent.');
        setWaitingForResponse(false);
        return false;
      }

      // Auto-exit controlled mode after sending
      if (controlledMode) setControlledMode(null);

      return true;
    } catch (error) {
      console.error('Error sending message:', error);
      return false;
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
      if (e.key === 'Escape' && controlledMode) {
        exitControlledMode();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [controlledMode]);

  // Keep resourcesRef in sync with resources state
  useEffect(() => {
    resourcesRef.current = resources;
  }, [resources]);

  const sendFeedbackRating = async (messageId: string, rating: string) => {
    const conversationId = router.query.conversationId as string;
    trackConversationEvent(conversationId, 'assistant', 'rating_submitted', rating);
    const feedbackText = `/feedback|Rating|${messageId}|${rating}`;
    await sendMessage(feedbackText, false, undefined, true);

    // Update local state to track the rating
    setMessageRatings((prev) => new Map(prev).set(messageId, rating));
  };

  const handlePromptSelect = async (value: string, promptMessageId?: string) => {
    // Find the prompt message to get its parentMessage (if it's in a thread)
    const promptMessage = assistantMessages.find((msg) => msg.id === promptMessageId);
    const threadParentId = promptMessage?.parentMessage;
    await sendMessage(
      value,
      true,
      threadParentId, // parentMessageId: thread parent (or undefined)
      false,
      'promptResponse',
      promptMessageId, // promptQuestionId: for body.promptResponseTo
    );
  };

  const handleTabChange = (tab: NavTab) => {
    setActiveTab(tab);
    if (router.query.view) {
      const { view: _, ...rest } = router.query;
      router.replace({ pathname: router.pathname, query: rest }, undefined, { shallow: true });
    }
    // Clear unseen count for the tab we're switching to
    if (tab === 'assistant') {
      setUnseenAssistantCount(0);
    } else if (tab === 'chat') {
      setUnseenChatCount(0);
      // Note: unreadReplyCount is managed by GroupChatPanel visibility logic
    } else if (tab === 'resources') {
      setResourcesNavBadgeDismissed(true);
    }
    // Clear reading state when leaving the resources tab
    if (activeTab === 'resources' && tab !== 'resources') {
      setNewResourceIds(new Set());
      setUnseenResourcesCount(0);
    }
    // Track tab switch analytics (transcript treated as a nav destination)
    trackConversationEvent(router.query.conversationId as string, 'assistant', 'tab_switched', tab);
  };

  const handleMarkReadingsAsSeen = () => {
    setUnseenResourcesCount(0);
    setNewResourceIds(new Set());
  };

  // Create feedback config for assistant messages
  const assistantFeedbackConfig: FeedbackConfig = {
    eligibleMessageIds: getFeedbackEligibleMessages(assistantMessages, feedbackFrequency),
    messageRatings,
    onPopulateFeedbackText: enterControlledMode,
    onSendRating: sendFeedbackRating,
  };

  // Create feedback config for chat messages
  const chatFeedbackConfig: FeedbackConfig = {
    eligibleMessageIds: getFeedbackEligibleMessages(chatMessages, feedbackFrequency),
    messageRatings,
    onPopulateFeedbackText: enterControlledMode,
    onSendRating: sendFeedbackRating,
  };

  return (
    <>
      {/* On mobile we add bottom padding so the fixed nav bar doesn't cover content */}
      <div className="flex flex-row h-[calc(100vh-96px)] overflow-hidden pb-[60px] lg:pb-0">
        {/* Error messages */}
        {(generalError || sessionError) && !paramsError && (
          <Errors generalError={generalError} sessionError={sessionError} setGeneralError={setGeneralError} />
        )}

        <Dialog
          open={true}
          // onClose={handleDeleteCancel}
          // aria-labelledby="delete-dialog-title"
          // aria-describedby="delete-dialog-description"
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
          <div className="flex flex-col items-center gap-4">
            <h2 id="delete-dialog-title" className="text-2xl font-bold text-gray-900">
              Event Has Ended
            </h2>
            <p id="delete-dialog-description" className="text-gray-600 text-base leading-relaxed max-w-sm">
              This event has ended and the assistant is no longer available. You can still view the transcript and resources,
              but you will not be able to send new messages.
            </p>
            <div className="flex flex-col gap-3 w-full mt-2">
              <Button>Ok</Button>
            </div>
          </div>
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
            />

            {/* ── Main content area ── */}
            <div className="flex-1 flex flex-row overflow-hidden">
              {/* Transcript full-screen view when transcript tab is active */}
              {router.query.view !== 'preferences' && activeTab === 'transcript' && transcriptPasscode ? (
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
                  {/* Chat / Assistant / Resources / Preferences panel */}
                  <div className="flex-1 flex flex-col relative overflow-hidden">
                    {/* Show dismissable resources reminder if active  */}
                    {resourcesReminderActive && (
                      <div className="absolute top-0 w-full z-10 bg-yellow-100 p-4 rounded shadow-2xl animate-slide-in">
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
                          className="mt-2 px-3 py-1 bg-yellow-200 hover:bg-yellow-300 rounded"
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
                    ) : isConnected ? (
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
                            // Wait for response if message mentions the bot
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
                              setUnreadChatReplyCount(newSet.size);
                              return newSet;
                            });
                          }}
                          pollCounts={pollCounts}
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
                          waitingForResponse={waitingForResponse}
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
                          inactive={!agentActive}
                          messagesWithUnreadReplies={assistantMessagesWithUnreadReplies}
                          onMarkAsRead={(messageId) => {
                            setAssistantMessagesWithUnreadReplies((prev) => {
                              const newSet = new Set(prev);
                              newSet.delete(messageId);
                              setUnreadAssistantReplyCount(newSet.size);
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
    </>
  );
}

export default EventAssistantRoom;
