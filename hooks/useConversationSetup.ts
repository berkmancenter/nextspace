import { useState, useRef, useEffect, useCallback } from 'react';
import type { NextRouter } from 'next/router';
import type { Socket } from 'socket.io-client';
import { PseudonymousMessage } from '../types.internal';
import { components } from '../types';
import { Api, RetrieveData, GetChannelPasscode, QueryParamsError } from '../utils';
import { createConversationFromData, resolveConversationBotName } from '../utils/Helpers';
import { isInPreEventWindow } from '../utils/eventState';
import type { ConversationType } from '../context/ConversationTypeContext';
import { withStoredChannels } from '../utils/presentationChannels';

type Resource = components['schemas']['Resource'];

// Interface for the parameters passed to the useConversationSetup hook
export interface UseConversationSetupParams {
  socket: Socket | null;
  userId: string | null;
  router: NextRouter;
  setConversationType: (type: ConversationType | null) => void;
  setBotNameContext: (name: string) => void;
  setResources: React.Dispatch<React.SetStateAction<Resource[]>>;
  presentation?: boolean;
}

// Return type for the useConversationSetup hook, defining the state and functions it provides
export interface UseConversationSetupReturn {
  generalError: string | null;
  setGeneralError: React.Dispatch<React.SetStateAction<string | null>>;
  paramsError: { header: string; params: string[] } | null;
  eventName: string;
  eventDescription: string;
  speakers: Array<{ name: string; bio: string }>;
  moderators: Array<{ name: string; bio: string }>;
  botName: string;
  agentId: string | null;
  agentActive: boolean;
  agentIds: string[];
  conversationFeatures: { name: string; enabled?: boolean; config?: { [key: string]: unknown } }[];
  participantUrl: string;
  feedbackFrequency: number;
  transcriptPasscode: string;
  chatPasscode: string;
  initialJoinComplete: boolean;
  eventStatusLoaded: boolean;
  eventStatus: 'active' | 'future' | 'ended';
  showEventStatusDialog: boolean;
  setShowEventStatusDialog: React.Dispatch<React.SetStateAction<boolean>>;
  markEventEnded: () => void;
  /**
   * Which channel group chat actually uses on the wire: 'pregame' inside the pre-event window (if
   * that channel's passcode is in the URL), 'chat' otherwise. `chatPasscode` is whichever passcode
   * goes with it, so callers don't need to branch between two passcodes themselves.
   */
  groupChatChannelName: 'chat' | 'pregame';
  /** Switches group chat from pregame to chat on the backend's conversation:started event. */
  markEventStarted: () => void;
  /** The event's scheduled start time, for driving a pre-event countdown. Null until loaded. */
  eventScheduledTime: string | null;
  setInitialJoinComplete: React.Dispatch<React.SetStateAction<boolean>>;
  chatIntroRef: React.MutableRefObject<PseudonymousMessage[]>;
  assistantIntroRef: React.MutableRefObject<PseudonymousMessage[]>;
  hasJoinedConvRef: React.MutableRefObject<boolean>;
}

/**
 * Custom hook to set up conversation context and state based on the provided parameters.
 * It fetches conversation data, manages state for event details, bot name, agent information, and more.
 * See {@link UseConversationSetupParams} for parameter details.
 * @returns An object containing the state and functions for managing the conversation setup, including errors, event details, bot and agent information, conversation features, passcodes, and refs for chat and assistant intros.
 */
export function useConversationSetup({
  socket,
  userId,
  router,
  setConversationType,
  setBotNameContext,
  setResources,
  presentation = false,
}: UseConversationSetupParams): UseConversationSetupReturn {
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [paramsError, setParamsError] = useState<{ header: string; params: string[] } | null>(null);
  const [eventName, setEventName] = useState<string>('');
  const [eventDescription, setEventDescription] = useState<string>('');
  const [speakers, setSpeakers] = useState<Array<{ name: string; bio: string }>>([]);
  const [moderators, setModerators] = useState<Array<{ name: string; bio: string }>>([]);
  const [botName, setBotName] = useState<string>('Berkie');
  const [agentId, setAgentId] = useState<string | null>(null);
  const [agentActive, setAgentActive] = useState<boolean>(true);
  const [agentIds, setAgentIds] = useState<string[]>([]);
  const [conversationFeatures, setConversationFeatures] = useState<
    { name: string; enabled?: boolean; config?: { [key: string]: unknown } }[]
  >([]);
  const [participantUrl, setParticipantUrl] = useState<string>('');
  const [feedbackFrequency, setFeedbackFrequency] = useState<number>(1);
  const [transcriptPasscode, setTranscriptPasscode] = useState<string>('');
  const [chatPasscode, setChatPasscode] = useState<string>('');
  const [eventScheduledTime, setEventScheduledTime] = useState<string | null>(null);
  const [groupChatChannelName, setGroupChatChannelName] = useState<'chat' | 'pregame'>('chat');
  const [initialJoinComplete, setInitialJoinComplete] = useState(false);

  const [eventStatusLoaded, setEventStatusLoaded] = useState<boolean>(false);
  const [eventStatus, setEventStatus] = useState<'active' | 'future' | 'ended'>('active');
  const [showEventStatusDialog, setShowEventStatusDialog] = useState<boolean>(false);
  // Epoch ms at which a 'future' gate set below should lift on its own, with no page refresh —
  // either the pre-event window opening or (for missingPregameAccess) the event's actual
  // scheduledTime. Null whenever there's nothing time-based left to wait for.
  const [pendingGateRecheckAt, setPendingGateRecheckAt] = useState<number | null>(null);

  const chatIntroRef = useRef<PseudonymousMessage[]>([]);
  const assistantIntroRef = useRef<PseudonymousMessage[]>([]);
  const hasJoinedConvRef = useRef(false);
  // The real chat channel's own passcode, kept even while pregame is the active channel, so
  // markEventStarted can switch back to it without needing a fresh conversation fetch.
  const chatChannelPasscodeRef = useRef<string>('');
  // The pregame channel's own passcode, captured even when the pre-event window isn't open yet at
  // fetch time, so the recheck timer below can switch into it once the window opens.
  const pregameChannelPasscodeRef = useRef<string>('');
  // Which kind of gate pendingGateRecheckAt is waiting on, read once the timer fires (a ref, not
  // state, since only the timeout callback needs it — it shouldn't itself trigger a re-render).
  const pendingGateRecheckKindRef = useRef<'preEventWindow' | 'eventStart' | null>(null);

  /* Clear the shared conversation type and bot name when the event changes so
     the Quick Guide doesn't show stale values while the new conversation loads. */
  useEffect(() => {
    setConversationType(null);
    setBotNameContext('Berkie');
    // setBotNameContext and setConversationType are context setters — stable references.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.query.conversationId]);

  // Serialize channel to a stable string — Next.js creates a new array reference on every
  // router update even when the value is unchanged, which would cause spurious re-fetches.
  const query = presentation ? withStoredChannels(router.query) : router.query;
  const channelDep = Array.isArray(query.channel) ? query.channel.join(',') : query.channel;

  useEffect(() => {
    if (!Api.get().getAccessToken() || !router.isReady) return;
    const queryError = QueryParamsError(query, 'assistant');
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
          if (conversationData.message?.message.includes('not found'))
            setParamsError({ header: 'Conversation Not Found', params: [] });

          setGeneralError(conversationData.message?.message || 'Error retrieving conversation.');
          return;
        }

        const conversation = await createConversationFromData(conversationData);
        setConversationType(conversation.type);
        setConversationFeatures(conversation.features ?? []);
        setParticipantUrl(conversation.eventUrls?.participant?.[0]?.url ?? '');
        if (conversation.name) setEventName(conversation.name);

        const frequency = (conversation?.properties?.feedbackFrequency as number) || 1;
        setFeedbackFrequency(frequency);

        if (conversation?.description) setEventDescription(conversation.description as string);
        if (conversation?.presenters) setSpeakers(conversation.presenters as Array<{ name: string; bio: string }>);
        if (conversation?.moderators) setModerators(conversation.moderators as Array<{ name: string; bio: string }>);

        if (Array.isArray(conversation?.resources)) {
          console.log('Fetched conversation resources:', conversation.resources);
          setResources(conversation.resources);
        }

        const resolvedBotName = resolveConversationBotName(conversation, config.conversationBotName);
        setBotName(resolvedBotName);
        setBotNameContext(resolvedBotName);

        const inPreEventWindow = isInPreEventWindow(conversation);
        if (conversation?.scheduledTime) setEventScheduledTime(conversation.scheduledTime as string);

        // A link minted before the pregame channel existed has no pregame passcode. Joining live
        // chat with it during the pre-event window would split the room into two groups that
        // can't see each other, so treat this the same as the event not having started yet.
        let missingPregameAccess = false;

        if (query.channel) {
          const transcriptPasscodeParam = GetChannelPasscode('transcript', query, setGeneralError);
          if (transcriptPasscodeParam) setTranscriptPasscode(transcriptPasscodeParam);

          const chatPasscodeParam = GetChannelPasscode('chat', query, setGeneralError);
          if (chatPasscodeParam) chatChannelPasscodeRef.current = chatPasscodeParam;
          // Not every link carries a pregame passcode (older links, or a conversation with no
          // pregame window configured), so its absence is normal — never routed through setGeneralError.
          const pregamePasscodeParam = GetChannelPasscode('pregame', query);
          if (pregamePasscodeParam) pregameChannelPasscodeRef.current = pregamePasscodeParam;

          if (inPreEventWindow && pregamePasscodeParam) {
            setGroupChatChannelName('pregame');
            setChatPasscode(pregamePasscodeParam);
          } else {
            setGroupChatChannelName('chat');
            if (chatPasscodeParam) setChatPasscode(chatPasscodeParam);
            missingPregameAccess = inPreEventWindow && !pregamePasscodeParam;
          }
        }

        // The clock-based window closes the instant client-clock time passes scheduledTime, but
        // the backend's actual flip to active/startTime can lag a few seconds behind. Someone
        // arriving in that gap would otherwise hit the (unclosable) Event Not Started dialog for
        // an event that's actually about to let them in — so this gap alone never blocks.
        const pastScheduledTimeUnconfirmed =
          !!conversation?.scheduledTime &&
          new Date(conversation.scheduledTime as string).getTime() <= Date.now() &&
          !conversation.startTime;

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

        // Check if the event is not active, and if it's not begun (no endTime)
        let recheckAt: number | null = null;
        let recheckKind: 'preEventWindow' | 'eventStart' | null = null;
        if (conversation.active === false && conversation.endTime) {
          setEventStatus('ended');
          setShowEventStatusDialog(true);
        } else if (
          conversation.active === false &&
          (missingPregameAccess || (!inPreEventWindow && !pastScheduledTimeUnconfirmed))
        ) {
          setEventStatus('future');
          setShowEventStatusDialog(true);

          // Gated purely on client-clock time, so the gate can be scheduled to lift itself once
          // that time arrives, without the user having to refresh. A conversation with no
          // pre-event window configured (no preEventMinutes) or with missingPregameAccess (no
          // pregame passcode to switch into) can only resolve at the event's real start; a
          // properly-configured window instead just waits for the window itself to open. A draft
          // conversation never auto-starts on its own — isInPreEventWindow won't open for one
          // regardless of clock time, and its scheduledTime isn't a commitment either — so there's
          // nothing time-based to wait for there at all.
          if (!conversation.draft) {
            const scheduledTimeMs = conversation.scheduledTime
              ? new Date(conversation.scheduledTime as string).getTime()
              : null;
            if (
              missingPregameAccess ||
              !pregameChannelPasscodeRef.current ||
              typeof conversation.preEventMinutes !== 'number'
            ) {
              recheckAt = scheduledTimeMs;
              recheckKind = 'eventStart';
            } else if (scheduledTimeMs !== null) {
              recheckAt = scheduledTimeMs - conversation.preEventMinutes * 60 * 1000;
              recheckKind = 'preEventWindow';
            }
          }
        } else {
          // Either the event is confirmed active, or we're inside its pre-event window (which the
          // backend already allows chatting in) — in either case the blocking gate does not apply.
          setEventStatus('active');
          setShowEventStatusDialog(false);
        }
        pendingGateRecheckKindRef.current = recheckKind;
        setPendingGateRecheckAt(recheckAt);

        setEventStatusLoaded(true);
      } catch (error) {
        console.error('Error fetching conversation data:', error);
        setGeneralError('Failed to fetch conversation data.');
      }
    }
    fetchConversationData();
    // setBotNameContext, setConversationType, setResources are stable setters — safe to omit.
    // setBotNameContext, setConversationType, setResources are stable setters — safe to omit.
    // setBotNameContext, setConversationType, setResources are stable setters — safe to omit.
    // channelDep is a serialized string (not router.query.channel directly) to avoid
    // spurious re-fetches from Next.js creating a new array reference on every router update.
    // router.query.view and other view-only params are intentionally excluded.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, router.isReady, router.query.conversationId, channelDep]);

  // Lifts a 'future' gate set above once its target time arrives, so a tab left open through the
  // pre-event window's opening (or, for missingPregameAccess, the event's real start) updates on
  // its own instead of leaving the user stuck on the "Event Not Started" dialog until they refresh.
  useEffect(() => {
    if (pendingGateRecheckAt === null) return;

    // setTimeout's delay is a 32-bit signed int; beyond ~24.8 days it fires almost immediately
    // instead of waiting, so clamp to that limit. A tab still open past the clamp just needs a
    // refresh — not worth re-arming the timer for.
    const delay = Math.min(Math.max(pendingGateRecheckAt - Date.now(), 0), 2147483647);
    const timer = setTimeout(() => {
      if (Date.now() < pendingGateRecheckAt) return;
      if (pendingGateRecheckKindRef.current === 'preEventWindow') {
        if (pregameChannelPasscodeRef.current) setChatPasscode(pregameChannelPasscodeRef.current);
        setGroupChatChannelName('pregame');
      }
      setEventStatus('active');
      setShowEventStatusDialog(false);
      setPendingGateRecheckAt(null);
    }, delay);

    return () => clearTimeout(timer);
  }, [pendingGateRecheckAt]);

  // Called when the backend sends conversation:stopped so open tabs disconnect
  // their sockets instead of reconnecting indefinitely. If the event later
  // restarts, a page refresh re-runs the initial active check and reconnects.
  const markEventEnded = useCallback(() => {
    setEventStatus('ended');
    setShowEventStatusDialog(true);
  }, []);

  // Called when the backend sends conversation:started — the real, official start, as opposed to
  // the pre-event window a pregame-connected tab has been chatting in. Switches group chat over
  // to the real chat channel and its own passcode, and drops hasJoinedConvRef so the join effect
  // re-emits conversation:join with the new channel (receiving chat's live messages needs an
  // actual room join, not just an updated passcode). A no-op if already on chat.
  const markEventStarted = useCallback(() => {
    if (groupChatChannelName !== 'pregame') return;
    if (chatChannelPasscodeRef.current) setChatPasscode(chatChannelPasscodeRef.current);
    setGroupChatChannelName('chat');
    hasJoinedConvRef.current = false;
  }, [groupChatChannelName]);

  return {
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
    participantUrl,
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
    eventStatusLoaded,
    eventStatus,
    showEventStatusDialog,
    setShowEventStatusDialog,
    markEventEnded,
    markEventStarted,
  };
}
