import { useState, useCallback, useEffect } from 'react';
import { PseudonymousMessage } from '../types.internal';
import { Api, RetrieveData, getPollResponseCounts, inspectPoll } from '../utils';
import { parseMessageBody } from '../utils/Helpers';

async function fetchAndInsertReplies(messages: PseudonymousMessage[]): Promise<PseudonymousMessage[]> {
  const messagesWithReplies = messages.filter((msg) => msg.replyCount && msg.replyCount > 0);

  if (messagesWithReplies.length === 0) {
    return messages;
  }

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

  const combinedMessages = [...messages, ...allReplies].sort((a, b) => {
    const dateA = new Date(a.createdAt!).getTime();
    const dateB = new Date(b.createdAt!).getTime();
    return dateA - dateB;
  });

  return combinedMessages;
}

interface UseConversationMessagesParams {
  userId: string | null;
  pseudonym: string | null;
  agentId: string | null;
  agentIds: string[];
  chatPasscode: string;
  initialJoinComplete: boolean;
  chatIntroRef: React.MutableRefObject<PseudonymousMessage[]>;
  assistantIntroRef: React.MutableRefObject<PseudonymousMessage[]>;
  conversationId: string | undefined;
}

export interface UseConversationMessagesReturn {
  assistantMessages: PseudonymousMessage[];
  setAssistantMessages: React.Dispatch<React.SetStateAction<PseudonymousMessage[]>>;
  chatMessages: PseudonymousMessage[];
  setChatMessages: React.Dispatch<React.SetStateAction<PseudonymousMessage[]>>;
  pollCounts: Record<string, Record<string, number>>;
  setPollCounts: React.Dispatch<React.SetStateAction<Record<string, Record<string, number>>>>;
  unreadChatReplyCount: number;
  unreadAssistantReplyCount: number;
  messagesWithUnreadReplies: Set<string>;
  setMessagesWithUnreadReplies: React.Dispatch<React.SetStateAction<Set<string>>>;
  assistantMessagesWithUnreadReplies: Set<string>;
  setAssistantMessagesWithUnreadReplies: React.Dispatch<React.SetStateAction<Set<string>>>;
  fetchAllAssistantMessages: () => Promise<void>;
  fetchChatMessages: () => Promise<void>;
}

export function useConversationMessages({
  userId,
  pseudonym,
  agentId,
  agentIds,
  chatPasscode,
  initialJoinComplete,
  chatIntroRef,
  assistantIntroRef,
  conversationId,
}: UseConversationMessagesParams): UseConversationMessagesReturn {
  const [assistantMessages, setAssistantMessages] = useState<PseudonymousMessage[]>([]);
  const [chatMessages, setChatMessages] = useState<PseudonymousMessage[]>([]);
  const [pollCounts, setPollCounts] = useState<Record<string, Record<string, number>>>({});
  const [chatPreviousReplyCounts, setChatPreviousReplyCounts] = useState<Map<string, number>>(new Map());
  const [assistantPreviousReplyCounts, setAssistantPreviousReplyCounts] = useState<Map<string, number>>(new Map());
  const [messagesWithUnreadReplies, setMessagesWithUnreadReplies] = useState<Set<string>>(new Set());
  const [assistantMessagesWithUnreadReplies, setAssistantMessagesWithUnreadReplies] = useState<Set<string>>(new Set());
  const [unreadChatReplyCount, setUnreadChatReplyCount] = useState<number>(0);
  const [unreadAssistantReplyCount, setUnreadAssistantReplyCount] = useState<number>(0);

  const trackReplyCountChanges = (
    messages: PseudonymousMessage[],
    replyFilter: (reply: PseudonymousMessage) => boolean,
    previousReplyCounts: Map<string, number>,
    currentUnreadSet: Set<string>,
  ): { newReplyCounts: Map<string, number>; updatedUnreadSet: Set<string> } => {
    const threadMap = new Map<string, PseudonymousMessage[]>();
    messages
      .filter((m) => m.parentMessage)
      .forEach((reply) => {
        const parentId = reply.parentMessage!;
        if (!threadMap.has(parentId)) threadMap.set(parentId, []);
        threadMap.get(parentId)!.push(reply);
      });

    const updatedUnreadSet = new Set(currentUnreadSet);
    const newReplyCounts = new Map<string, number>();

    threadMap.forEach((replies, parentId) => {
      const countableReplies = replies.filter(replyFilter);
      const currentCount = countableReplies.length;
      const previousCount = previousReplyCounts.get(parentId);

      newReplyCounts.set(parentId, currentCount);

      if (previousCount !== undefined && currentCount > previousCount) {
        updatedUnreadSet.add(parentId);
      }
    });

    return { newReplyCounts, updatedUnreadSet };
  };

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
        if (pollData?.choices) {
          const selected = pollData.choices.find((c: any) => c.isSelected);
          if (selected) body.initialVotedChoice = selected.text;
        }
      }),
    );
  };

  const fetchAllAssistantMessages = useCallback(async (): Promise<void> => {
    if (!userId || !agentId || !conversationId) return;

    try {
      const allFetched = await Promise.all(
        agentIds.map((id) =>
          RetrieveData(`messages/${conversationId}?channel=direct-${userId}-${id}`, Api.get().getAccessToken()),
        ),
      );

      let allMessages = allFetched
        .flatMap((result) => (Array.isArray(result) ? result : []))
        .filter((m) => parseMessageBody(m.body)?.type !== 'intro');

      allMessages.sort((a, b) => new Date(a.createdAt!).getTime() - new Date(b.createdAt!).getTime());

      if (allMessages.length > 0) {
        const messagesWithReplies = await fetchAndInsertReplies(allMessages);
        setAssistantMessages([...assistantIntroRef.current, ...messagesWithReplies]);
      }
    } catch (error) {
      console.error('Error fetching assistant messages:', error);
    }
  }, [userId, agentId, agentIds, conversationId, assistantIntroRef]);

  const fetchChatMessages = useCallback(async (): Promise<void> => {
    try {
      const fetched = await RetrieveData(
        `messages/${conversationId}?channel=chat,${chatPasscode}`,
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
  }, [conversationId, chatPasscode, chatIntroRef]);

  useEffect(() => {
    const { newReplyCounts, updatedUnreadSet } = trackReplyCountChanges(
      chatMessages,
      (r) => r.pseudonym !== pseudonym,
      chatPreviousReplyCounts,
      messagesWithUnreadReplies,
    );

    setChatPreviousReplyCounts(newReplyCounts);
    setMessagesWithUnreadReplies(updatedUnreadSet);
    setUnreadChatReplyCount(updatedUnreadSet.size);
    // chatPreviousReplyCounts and messagesWithUnreadReplies are intentionally omitted:
    // adding them would cause an infinite loop since this effect updates both.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatMessages, pseudonym]);

  useEffect(() => {
    const { newReplyCounts, updatedUnreadSet } = trackReplyCountChanges(
      assistantMessages,
      (r) => r.fromAgent,
      assistantPreviousReplyCounts,
      assistantMessagesWithUnreadReplies,
    );

    setAssistantPreviousReplyCounts(newReplyCounts);
    setAssistantMessagesWithUnreadReplies(updatedUnreadSet);
    setUnreadAssistantReplyCount(updatedUnreadSet.size);
    // assistantPreviousReplyCounts and assistantMessagesWithUnreadReplies are intentionally
    // omitted: adding them would cause an infinite loop since this effect updates both.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assistantMessages, pseudonym]);

  useEffect(() => {
    if (!chatPasscode || !conversationId || !initialJoinComplete) return;
    fetchChatMessages();
  }, [chatPasscode, conversationId, fetchChatMessages, initialJoinComplete]);

  useEffect(() => {
    if (!initialJoinComplete) return;
    fetchAllAssistantMessages();
  }, [fetchAllAssistantMessages, initialJoinComplete]);

  return {
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
  };
}
