import { useState, useEffect } from 'react';
import type { NextRouter } from 'next/router';
import { Api, RetrieveData } from '../utils';
import { createConversationFromData, resolveConversationBotName } from '../utils/Helpers';

export interface UseRoomSetupParams {
  router: NextRouter;
}

export interface UseRoomSetupReturn {
  loaded: boolean;
  notFound: boolean;
  generalError: string | null;
  setGeneralError: React.Dispatch<React.SetStateAction<string | null>>;
  roomName: string;
  botName: string;
  communityName: string | null;
  agentId: string | null;
  conversationFeatures: { name: string; enabled?: boolean }[];
}

/**
 * Modeled on {@link useConversationSetup} but without the event-specific concerns
 * a room doesn't have: passcodes, the event-status dialog, and active/endTime
 * derivation (a room is permanently active by construction).
 * @returns An object with the room's loaded/error state plus its resolved fields.
 */
export function useRoomSetup({ router }: UseRoomSetupParams): UseRoomSetupReturn {
  const [loaded, setLoaded] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [roomName, setRoomName] = useState('');
  const [botName, setBotName] = useState('Berkie');
  const [communityName, setCommunityName] = useState<string | null>(null);
  const [agentId, setAgentId] = useState<string | null>(null);
  const [conversationFeatures, setConversationFeatures] = useState<{ name: string; enabled?: boolean }[]>([]);

  useEffect(() => {
    if (!router.isReady || !Api.get().getAccessToken()) return;

    async function fetchRoomData() {
      try {
        const config = await Api.get().GetConfig();

        const conversationData = await RetrieveData(
          `conversations/${router.query.conversationId}`,
          Api.get().getAccessToken(),
        );

        if (!conversationData) {
          setNotFound(true);
          return;
        }
        if ('error' in conversationData) {
          if (conversationData.message?.message?.includes('not found')) {
            setNotFound(true);
          } else {
            setGeneralError(conversationData.message?.message || 'Error retrieving room.');
          }
          return;
        }

        const conversation = await createConversationFromData(conversationData);
        setConversationFeatures(conversation.features ?? []);
        if (conversation.name) setRoomName(conversation.name);
        setBotName(resolveConversationBotName(conversation, config.conversationBotName));
        const props = conversation.properties as any;
        setCommunityName(typeof props?.communityName === 'string' ? props.communityName : null);

        const firstAgent = conversation.agents[0];
        if (firstAgent) setAgentId(firstAgent.id!);

        setLoaded(true);
      } catch (error) {
        console.error('Error fetching room data:', error);
        setGeneralError('Failed to fetch room data.');
      }
    }
    fetchRoomData();
  }, [router.isReady, router.query.conversationId]);

  return {
    loaded,
    notFound,
    generalError,
    setGeneralError,
    roomName,
    botName,
    communityName,
    agentId,
    conversationFeatures,
  };
}
