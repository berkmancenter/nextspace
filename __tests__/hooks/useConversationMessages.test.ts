import { renderHook, waitFor, act } from '@testing-library/react';

const mockGetAccessToken = jest.fn();

jest.mock('../../utils', () => ({
  Api: {
    get: jest.fn(() => ({
      getAccessToken: mockGetAccessToken,
    })),
  },
  RetrieveData: jest.fn(),
  getPollResponseCounts: jest.fn(),
  inspectPoll: jest.fn(),
}));

import { useConversationMessages, UseConversationMessagesParams } from '../../hooks/useConversationMessages';
import { RetrieveData, getPollResponseCounts, inspectPoll } from '../../utils';

const mockRetrieveData = RetrieveData as jest.Mock;
const mockGetPollResponseCounts = getPollResponseCounts as jest.Mock;
const mockInspectPoll = inspectPoll as jest.Mock;

function makeMessage(overrides: Record<string, any> = {}) {
  return {
    id: 'msg-1',
    pseudonym: 'someone',
    body: { type: 'chat', text: 'hello' },
    bodyType: 'json',
    createdAt: '2026-01-01T00:00:00.000Z',
    replyCount: 0,
    ...overrides,
  };
}

function renderMessages(overrides: Partial<UseConversationMessagesParams> = {}) {
  const chatIntroRef = { current: [] } as UseConversationMessagesParams['chatIntroRef'];
  const assistantIntroRef = { current: [] } as UseConversationMessagesParams['assistantIntroRef'];

  const defaultParams: UseConversationMessagesParams = {
    userId: 'user-1',
    pseudonym: 'me',
    agentId: 'agent-1',
    agentIds: ['agent-1'],
    chatPasscode: 'chat-pass',
    initialJoinComplete: false,
    chatIntroRef,
    assistantIntroRef,
    conversationId: 'conv-1',
    ...overrides,
  };

  const view = renderHook((props: UseConversationMessagesParams) => useConversationMessages(props), {
    initialProps: defaultParams,
  });

  return { ...view, chatIntroRef, assistantIntroRef };
}

describe('useConversationMessages', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockGetAccessToken.mockReturnValue('mock-access-token');
    mockRetrieveData.mockResolvedValue([]);
    mockGetPollResponseCounts.mockResolvedValue({});
    mockInspectPoll.mockResolvedValue(null);
  });

  describe('initial state', () => {
    it('returns empty defaults', () => {
      const { result } = renderMessages();

      expect(result.current.assistantMessages).toEqual([]);
      expect(result.current.chatMessages).toEqual([]);
      expect(result.current.pollCounts).toEqual({});
      expect(result.current.unreadChatReplyCount).toBe(0);
      expect(result.current.unreadAssistantReplyCount).toBe(0);
      expect(result.current.messagesWithUnreadReplies).toEqual(new Set());
      expect(result.current.assistantMessagesWithUnreadReplies).toEqual(new Set());
    });
  });

  describe('fetchAllAssistantMessages', () => {
    it('does not fetch when userId, agentId, or conversationId is missing', async () => {
      const { result } = renderMessages({ agentId: null });

      await act(async () => {
        await result.current.fetchAllAssistantMessages();
      });

      expect(mockRetrieveData).not.toHaveBeenCalled();
    });

    it('fetches, filters intros, sorts by createdAt, and prefixes the assistant intro messages', async () => {
      mockRetrieveData.mockImplementation((url: string) => {
        if (url === 'messages/conv-1?channel=direct-user-1-agent-1') {
          return Promise.resolve([
            makeMessage({ id: 'a1', createdAt: '2026-01-01T00:00:02.000Z', body: { type: 'chat' } }),
            makeMessage({ id: 'intro-1', createdAt: '2026-01-01T00:00:00.000Z', body: { type: 'intro' } }),
          ]);
        }
        if (url === 'messages/conv-1?channel=direct-user-1-agent-2') {
          return Promise.resolve([makeMessage({ id: 'a2', createdAt: '2026-01-01T00:00:01.000Z', body: { type: 'chat' } })]);
        }
        return Promise.resolve([]);
      });

      const introMessage = makeMessage({ id: 'assistant-intro', body: { type: 'intro' } });
      const { result } = renderMessages({ agentIds: ['agent-1', 'agent-2'], assistantIntroRef: { current: [introMessage as any] } });

      await act(async () => {
        await result.current.fetchAllAssistantMessages();
      });

      expect(result.current.assistantMessages.map((m: any) => m.id)).toEqual(['assistant-intro', 'a2', 'a1']);
    });

    it('does not update assistantMessages when the fetched result is empty', async () => {
      mockRetrieveData.mockResolvedValue([]);

      const { result } = renderMessages();

      await act(async () => {
        await result.current.fetchAllAssistantMessages();
      });

      expect(result.current.assistantMessages).toEqual([]);
    });

    it('fetches and merges replies for messages with a replyCount', async () => {
      mockRetrieveData.mockImplementation((url: string) => {
        if (url === 'messages/conv-1?channel=direct-user-1-agent-1') {
          return Promise.resolve([
            makeMessage({ id: 'a1', createdAt: '2026-01-01T00:00:01.000Z', replyCount: 1 }),
          ]);
        }
        if (url === 'messages/a1/replies') {
          return Promise.resolve([makeMessage({ id: 'reply-1', parentMessage: 'a1', createdAt: '2026-01-01T00:00:02.000Z' })]);
        }
        return Promise.resolve([]);
      });

      const { result } = renderMessages();

      await act(async () => {
        await result.current.fetchAllAssistantMessages();
      });

      expect(result.current.assistantMessages.map((m: any) => m.id)).toEqual(['a1', 'reply-1']);
      expect(mockRetrieveData).toHaveBeenCalledWith('messages/a1/replies', 'mock-access-token');
    });

    it('logs and swallows errors instead of throwing', async () => {
      const consoleError = jest.spyOn(console, 'error').mockImplementation();
      mockRetrieveData.mockRejectedValue(new Error('network fail'));

      const { result } = renderMessages();

      await act(async () => {
        await result.current.fetchAllAssistantMessages();
      });

      expect(consoleError).toHaveBeenCalledWith('Error fetching assistant messages:', expect.any(Error));
      expect(result.current.assistantMessages).toEqual([]);

      consoleError.mockRestore();
    });
  });

  describe('fetchChatMessages', () => {
    it('fetches chat messages, filters intros, and prefixes the chat intro messages', async () => {
      mockRetrieveData.mockImplementation((url: string) => {
        if (url === 'messages/conv-1?channel=chat,chat-pass') {
          return Promise.resolve([
            makeMessage({ id: 'c1', body: { type: 'chat' } }),
            makeMessage({ id: 'intro-1', body: { type: 'intro' } }),
          ]);
        }
        return Promise.resolve([]);
      });

      const introMessage = makeMessage({ id: 'chat-intro', body: { type: 'intro' } });
      const { result } = renderMessages({ chatIntroRef: { current: [introMessage as any] } });

      await act(async () => {
        await result.current.fetchChatMessages();
      });

      expect(result.current.chatMessages.map((m: any) => m.id)).toEqual(['chat-intro', 'c1']);
    });

    it('does nothing when the fetched result is not an array', async () => {
      mockRetrieveData.mockResolvedValue({ error: true, message: { message: 'nope' } });

      const { result } = renderMessages();

      await act(async () => {
        await result.current.fetchChatMessages();
      });

      expect(result.current.chatMessages).toEqual([]);
    });

    it('loads poll response counts for always-visible poll messages', async () => {
      mockRetrieveData.mockImplementation((url: string) => {
        if (url === 'messages/conv-1?channel=chat,chat-pass') {
          return Promise.resolve([
            makeMessage({
              id: 'poll-msg',
              bodyType: 'json',
              body: { type: 'poll', whenResultsVisible: 'always', pollId: 'poll-1' },
            }),
          ]);
        }
        return Promise.resolve([]);
      });
      mockGetPollResponseCounts.mockResolvedValue({ yes: 3, no: 1 });
      mockInspectPoll.mockResolvedValue({ choices: [{ text: 'yes', isSelected: true }] });

      const { result } = renderMessages();

      await act(async () => {
        await result.current.fetchChatMessages();
      });

      expect(mockGetPollResponseCounts).toHaveBeenCalledWith('poll-1');
      expect(mockInspectPoll).toHaveBeenCalledWith('poll-1');
      expect(result.current.pollCounts).toEqual({ 'poll-1': { yes: 3, no: 1 } });
    });

    it('logs and swallows errors instead of throwing', async () => {
      const consoleError = jest.spyOn(console, 'error').mockImplementation();
      mockRetrieveData.mockRejectedValue(new Error('network fail'));

      const { result } = renderMessages();

      await act(async () => {
        await result.current.fetchChatMessages();
      });

      expect(consoleError).toHaveBeenCalledWith('Error fetching chat messages:', expect.any(Error));
      expect(result.current.chatMessages).toEqual([]);

      consoleError.mockRestore();
    });
  });

  describe('auto-fetch effects driven by initialJoinComplete', () => {
    it('does not fetch on mount while initialJoinComplete is false', async () => {
      renderMessages({ initialJoinComplete: false });

      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockRetrieveData).not.toHaveBeenCalled();
    });

    it('fetches chat and assistant messages once initialJoinComplete becomes true', async () => {
      const { rerender } = renderMessages({ initialJoinComplete: false });

      rerender({
        userId: 'user-1',
        pseudonym: 'me',
        agentId: 'agent-1',
        agentIds: ['agent-1'],
        chatPasscode: 'chat-pass',
        initialJoinComplete: true,
        chatIntroRef: { current: [] } as any,
        assistantIntroRef: { current: [] } as any,
        conversationId: 'conv-1',
      });

      await waitFor(() => {
        expect(mockRetrieveData).toHaveBeenCalledWith('messages/conv-1?channel=chat,chat-pass', 'mock-access-token');
      });

      expect(mockRetrieveData).toHaveBeenCalledWith(
        'messages/conv-1?channel=direct-user-1-agent-1',
        'mock-access-token',
      );
    });
  });

  describe('unread reply tracking (chat)', () => {
    it('does not mark a thread unread the first time a reply count is observed', async () => {
      const { result } = renderMessages();

      act(() => {
        result.current.setChatMessages([
          makeMessage({ id: 'parent-1', parentMessage: undefined }),
          makeMessage({ id: 'reply-1', parentMessage: 'parent-1', pseudonym: 'other' }),
        ] as any);
      });

      await waitFor(() => {
        expect(result.current.unreadChatReplyCount).toBe(0);
      });

      expect(result.current.messagesWithUnreadReplies.has('parent-1')).toBe(false);
    });

    it('marks a thread unread when its reply count grows after a baseline is recorded', async () => {
      const { result } = renderMessages();

      act(() => {
        result.current.setChatMessages([
          makeMessage({ id: 'parent-1', parentMessage: undefined }),
          makeMessage({ id: 'reply-1', parentMessage: 'parent-1', pseudonym: 'other' }),
        ] as any);
      });

      await waitFor(() => {
        expect(result.current.unreadChatReplyCount).toBe(0);
      });

      act(() => {
        result.current.setChatMessages([
          makeMessage({ id: 'parent-1', parentMessage: undefined }),
          makeMessage({ id: 'reply-1', parentMessage: 'parent-1', pseudonym: 'other' }),
          makeMessage({ id: 'reply-2', parentMessage: 'parent-1', pseudonym: 'other-2' }),
        ] as any);
      });

      await waitFor(() => {
        expect(result.current.unreadChatReplyCount).toBe(1);
      });

      expect(result.current.messagesWithUnreadReplies.has('parent-1')).toBe(true);
    });

    it('ignores replies authored by the current pseudonym when counting', async () => {
      const { result } = renderMessages({ pseudonym: 'me' });

      act(() => {
        result.current.setChatMessages([
          makeMessage({ id: 'parent-1', parentMessage: undefined }),
          makeMessage({ id: 'reply-1', parentMessage: 'parent-1', pseudonym: 'me' }),
        ] as any);
      });

      act(() => {
        result.current.setChatMessages([
          makeMessage({ id: 'parent-1', parentMessage: undefined }),
          makeMessage({ id: 'reply-1', parentMessage: 'parent-1', pseudonym: 'me' }),
          makeMessage({ id: 'reply-2', parentMessage: 'parent-1', pseudonym: 'me' }),
        ] as any);
      });

      await waitFor(() => {
        expect(result.current.unreadChatReplyCount).toBe(0);
      });
    });

    it('drops the unread count when a thread is removed from the set (mark as read)', async () => {
      const { result } = renderMessages();

      act(() => {
        result.current.setChatMessages([
          makeMessage({ id: 'parent-1', parentMessage: undefined }),
          makeMessage({ id: 'reply-1', parentMessage: 'parent-1', pseudonym: 'other' }),
        ] as any);
      });
      await waitFor(() => expect(result.current.unreadChatReplyCount).toBe(0));

      act(() => {
        result.current.setChatMessages([
          makeMessage({ id: 'parent-1', parentMessage: undefined }),
          makeMessage({ id: 'reply-1', parentMessage: 'parent-1', pseudonym: 'other' }),
          makeMessage({ id: 'reply-2', parentMessage: 'parent-1', pseudonym: 'other-2' }),
        ] as any);
      });
      await waitFor(() => expect(result.current.unreadChatReplyCount).toBe(1));

      // The mark-as-read handler on the page can only mutate the set, so the count
      // has to stay derived from it rather than tracked separately.
      act(() => {
        result.current.setMessagesWithUnreadReplies((prev) => {
          const next = new Set(prev);
          next.delete('parent-1');
          return next;
        });
      });

      await waitFor(() => {
        expect(result.current.unreadChatReplyCount).toBe(0);
      });
    });
  });

  describe('unread reply tracking (assistant)', () => {
    it('marks a thread unread when agent reply count grows after a baseline is recorded', async () => {
      const { result } = renderMessages();

      act(() => {
        result.current.setAssistantMessages([
          makeMessage({ id: 'parent-1', parentMessage: undefined }),
          makeMessage({ id: 'reply-1', parentMessage: 'parent-1', fromAgent: true }),
        ] as any);
      });

      await waitFor(() => {
        expect(result.current.unreadAssistantReplyCount).toBe(0);
      });

      act(() => {
        result.current.setAssistantMessages([
          makeMessage({ id: 'parent-1', parentMessage: undefined }),
          makeMessage({ id: 'reply-1', parentMessage: 'parent-1', fromAgent: true }),
          makeMessage({ id: 'reply-2', parentMessage: 'parent-1', fromAgent: true }),
        ] as any);
      });

      await waitFor(() => {
        expect(result.current.unreadAssistantReplyCount).toBe(1);
      });

      expect(result.current.assistantMessagesWithUnreadReplies.has('parent-1')).toBe(true);
    });

    it('ignores replies not from an agent when counting', async () => {
      const { result } = renderMessages();

      act(() => {
        result.current.setAssistantMessages([
          makeMessage({ id: 'parent-1', parentMessage: undefined }),
          makeMessage({ id: 'reply-1', parentMessage: 'parent-1', fromAgent: false }),
        ] as any);
      });

      act(() => {
        result.current.setAssistantMessages([
          makeMessage({ id: 'parent-1', parentMessage: undefined }),
          makeMessage({ id: 'reply-1', parentMessage: 'parent-1', fromAgent: false }),
          makeMessage({ id: 'reply-2', parentMessage: 'parent-1', fromAgent: false }),
        ] as any);
      });

      await waitFor(() => {
        expect(result.current.unreadAssistantReplyCount).toBe(0);
      });
    });

    it('drops the unread count when a thread is removed from the set (mark as read)', async () => {
      const { result } = renderMessages();

      act(() => {
        result.current.setAssistantMessages([
          makeMessage({ id: 'parent-1', parentMessage: undefined }),
          makeMessage({ id: 'reply-1', parentMessage: 'parent-1', fromAgent: true }),
        ] as any);
      });
      await waitFor(() => expect(result.current.unreadAssistantReplyCount).toBe(0));

      act(() => {
        result.current.setAssistantMessages([
          makeMessage({ id: 'parent-1', parentMessage: undefined }),
          makeMessage({ id: 'reply-1', parentMessage: 'parent-1', fromAgent: true }),
          makeMessage({ id: 'reply-2', parentMessage: 'parent-1', fromAgent: true }),
        ] as any);
      });
      await waitFor(() => expect(result.current.unreadAssistantReplyCount).toBe(1));

      act(() => {
        result.current.setAssistantMessagesWithUnreadReplies((prev) => {
          const next = new Set(prev);
          next.delete('parent-1');
          return next;
        });
      });

      await waitFor(() => {
        expect(result.current.unreadAssistantReplyCount).toBe(0);
      });
    });
  });
});
