import { useState, useRef, useEffect } from 'react';
import type { NextRouter } from 'next/router';
import type { Socket } from 'socket.io-client';
import { PseudonymousMessage } from '../types.internal';
import { components } from '../types';
import { Api, RetrieveData, GetChannelPasscode, QueryParamsError } from '../utils';
import { createConversationFromData, resolveConversationBotName } from '../utils/Helpers';
import type { ConversationType } from '../context/ConversationTypeContext';

type Resource = components['schemas']['Resource'];

// Interface for the parameters passed to the useConversationSetup hook
export interface UseConversationSetupParams {
  socket: Socket | null;
  userId: string | null;
  router: NextRouter;
  setConversationType: (type: ConversationType | null) => void;
  setBotNameContext: (name: string) => void;
  setResources: React.Dispatch<React.SetStateAction<Resource[]>>;
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
  conversationFeatures: { name: string; enabled?: boolean }[];
  feedbackFrequency: number;
  transcriptPasscode: string;
  chatPasscode: string;
  initialJoinComplete: boolean;
  eventStatusLoaded: boolean;
  eventStatus: 'active' | 'future' | 'ended';
  showEventStatusDialog: boolean;
  setShowEventStatusDialog: React.Dispatch<React.SetStateAction<boolean>>;
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
  const [conversationFeatures, setConversationFeatures] = useState<{ name: string; enabled?: boolean }[]>([]);
  const [feedbackFrequency, setFeedbackFrequency] = useState<number>(1);
  const [transcriptPasscode, setTranscriptPasscode] = useState<string>('');
  const [chatPasscode, setChatPasscode] = useState<string>('');
  const [initialJoinComplete, setInitialJoinComplete] = useState(false);

  const [eventStatusLoaded, setEventStatusLoaded] = useState<boolean>(false);
  const [eventStatus, setEventStatus] = useState<'active' | 'future' | 'ended'>('active');
  const [showEventStatusDialog, setShowEventStatusDialog] = useState<boolean>(false);

  const chatIntroRef = useRef<PseudonymousMessage[]>([]);
  const assistantIntroRef = useRef<PseudonymousMessage[]>([]);
  const hasJoinedConvRef = useRef(false);

  /* Clear the shared conversation type and bot name when the event changes so
     the Quick Guide doesn't show stale values while the new conversation loads. */
  useEffect(() => {
    setConversationType(null);
    setBotNameContext('Berkie');
    // setBotNameContext and setConversationType are context setters — stable references.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.query.conversationId]);

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
          if (conversationData.message?.message.includes('not found'))
            setParamsError({ header: 'Conversation Not Found', params: [] });

          setGeneralError(conversationData.message?.message || 'Error retrieving conversation.');
          return;
        }

        const conversation = await createConversationFromData(conversationData);
        setConversationType(conversation.type);
        setConversationFeatures(conversation.features ?? []);
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

        if (router.query.channel) {
          const transcriptPasscodeParam = GetChannelPasscode('transcript', router.query, setGeneralError);
          if (transcriptPasscodeParam) setTranscriptPasscode(transcriptPasscodeParam);

          const chatPasscodeParam = GetChannelPasscode('chat', router.query, setGeneralError);
          if (chatPasscodeParam) setChatPasscode(chatPasscodeParam);
        }

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
        if (conversation.active === false) {
          setEventStatus(conversation.endTime ? 'ended' : 'future');
          setShowEventStatusDialog(true);
        }

        setEventStatusLoaded(true);
      } catch (error) {
        console.error('Error fetching conversation data:', error);
        setGeneralError('Failed to fetch conversation data.');
      }
    }
    fetchConversationData();
    // setBotNameContext, setConversationType, setResources are stable setters — safe to omit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, router]);

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
    feedbackFrequency,
    transcriptPasscode,
    chatPasscode,
    initialJoinComplete,
    setInitialJoinComplete,
    chatIntroRef,
    assistantIntroRef,
    hasJoinedConvRef,
    eventStatusLoaded,
    eventStatus,
    showEventStatusDialog,
    setShowEventStatusDialog,
  };
}
