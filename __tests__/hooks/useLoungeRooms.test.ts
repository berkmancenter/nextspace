import { renderHook, waitFor } from '@testing-library/react';

const mockGetAccessToken = jest.fn(() => 'mock-access-token');

jest.mock('../../utils', () => ({
  Api: {
    get: jest.fn(() => ({
      getAccessToken: mockGetAccessToken,
    })),
  },
  RetrieveData: jest.fn(),
}));

import { useLoungeRooms } from '../../hooks/useLoungeRooms';
import { RetrieveData } from '../../utils';
import { markRoomRead } from '../../utils/roomReadState';

const mockRetrieveData = RetrieveData as jest.Mock;

function makeMessage(overrides: Record<string, any> = {}) {
  return {
    id: 'message-1',
    body: 'Morning all, the DSA transparency reports just dropped.',
    pseudonym: 'Miriam Halevi',
    owner: 'other-user-id',
    fromAgent: false,
    visible: true,
    createdAt: '2026-08-28T09:41:00.000Z',
    ...overrides,
  };
}

/**
 * Answers the two request shapes the hook makes: the conversation list, then one
 * message fetch per room.
 */
function respondWith(conversations: any[], messagesByRoom: Record<string, any[]> = {}) {
  mockRetrieveData.mockImplementation((path: string) => {
    if (path === 'conversations/userConversations') return Promise.resolve(conversations);
    const roomId = path.split('/')[1]?.split('?')[0];
    return Promise.resolve(messagesByRoom[roomId] ?? []);
  });
}

describe('useLoungeRooms', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.localStorage.clear();
    mockGetAccessToken.mockReturnValue('mock-access-token');
  });

  describe('which conversations it lists', () => {
    it('keeps only community rooms', async () => {
      respondWith([
        { id: 'room-1', name: 'BKC Community Room', conversationType: 'communityRoom' },
        { id: 'event-1', name: 'A Panel Event', conversationType: 'eventAssistant' },
        { id: 'back-1', name: 'A Back Channel', conversationType: 'backChannel' },
      ]);

      const { result } = renderHook(() => useLoungeRooms('my-user-id'));

      await waitFor(() => expect(result.current.loaded).toBe(true));
      expect(result.current.rooms).toHaveLength(1);
      expect(result.current.rooms[0].name).toBe('BKC Community Room');
    });

    it('puts the most recently active room first', async () => {
      respondWith(
        [
          { id: 'quiet', name: 'Quiet Room', conversationType: 'communityRoom' },
          { id: 'busy', name: 'Busy Room', conversationType: 'communityRoom' },
        ],
        {
          quiet: [makeMessage({ createdAt: '2026-08-20T09:00:00.000Z' })],
          busy: [makeMessage({ createdAt: '2026-08-28T09:41:00.000Z' })],
        },
      );

      const { result } = renderHook(() => useLoungeRooms('my-user-id'));

      await waitFor(() => expect(result.current.loaded).toBe(true));
      expect(result.current.rooms.map((room) => room.name)).toEqual(['Busy Room', 'Quiet Room']);
    });

    it('reports an error rather than an empty list when the request fails', async () => {
      mockRetrieveData.mockResolvedValue({ error: true, status: 500, message: 'boom' });

      const { result } = renderHook(() => useLoungeRooms('my-user-id'));

      await waitFor(() => expect(result.current.loaded).toBe(true));
      expect(result.current.error).toBe('Could not load your rooms.');
      expect(result.current.rooms).toEqual([]);
    });
  });

  describe('the last message preview', () => {
    it('names the sender', async () => {
      respondWith([{ id: 'room-1', name: 'BKC Community Room', conversationType: 'communityRoom' }], {
        'room-1': [makeMessage()],
      });

      const { result } = renderHook(() => useLoungeRooms('my-user-id'));

      await waitFor(() => expect(result.current.loaded).toBe(true));
      expect(result.current.rooms[0].preview).toBe('Miriam Halevi: Morning all, the DSA transparency reports just dropped.');
    });

    it('says "You" for the reader\'s own message', async () => {
      respondWith([{ id: 'room-1', name: 'BKC Community Room', conversationType: 'communityRoom' }], {
        'room-1': [makeMessage({ owner: 'my-user-id', pseudonym: 'Priya Raghunathan', body: 'Sent the draft agenda.' })],
      });

      const { result } = renderHook(() => useLoungeRooms('my-user-id'));

      await waitFor(() => expect(result.current.loaded).toBe(true));
      expect(result.current.rooms[0].preview).toBe('You: Sent the draft agenda.');
    });

    it('reads the text out of a structured message body', async () => {
      respondWith([{ id: 'room-1', name: 'BKC Community Room', conversationType: 'communityRoom' }], {
        'room-1': [makeMessage({ body: { type: 'memberIntro', text: 'Say hello to Ada.' } })],
      });

      const { result } = renderHook(() => useLoungeRooms('my-user-id'));

      await waitFor(() => expect(result.current.loaded).toBe(true));
      expect(result.current.rooms[0].preview).toBe('Miriam Halevi: Say hello to Ada.');
    });

    it('uses the newest message, not the first one returned', async () => {
      respondWith([{ id: 'room-1', name: 'BKC Community Room', conversationType: 'communityRoom' }], {
        'room-1': [
          makeMessage({ id: 'old', body: 'Older', createdAt: '2026-08-01T09:00:00.000Z' }),
          makeMessage({ id: 'new', body: 'Newer', createdAt: '2026-08-28T09:41:00.000Z' }),
        ],
      });

      const { result } = renderHook(() => useLoungeRooms('my-user-id'));

      await waitFor(() => expect(result.current.loaded).toBe(true));
      expect(result.current.rooms[0].preview).toBe('Miriam Halevi: Newer');
      expect(result.current.rooms[0].lastMessageAt).toBe('2026-08-28T09:41:00.000Z');
    });

    it('skips hidden and reply messages', async () => {
      respondWith([{ id: 'room-1', name: 'BKC Community Room', conversationType: 'communityRoom' }], {
        'room-1': [
          makeMessage({ id: 'visible', body: 'In the feed', createdAt: '2026-08-01T09:00:00.000Z' }),
          makeMessage({ id: 'hidden', body: 'Removed', visible: false, createdAt: '2026-08-28T09:41:00.000Z' }),
          makeMessage({ id: 'reply', body: 'In a thread', parentMessage: 'visible', createdAt: '2026-08-28T10:00:00.000Z' }),
        ],
      });

      const { result } = renderHook(() => useLoungeRooms('my-user-id'));

      await waitFor(() => expect(result.current.loaded).toBe(true));
      expect(result.current.rooms[0].preview).toBe('Miriam Halevi: In the feed');
    });

    it('leaves the preview empty for a room with no messages', async () => {
      respondWith([{ id: 'room-1', name: 'BKC Community Room', conversationType: 'communityRoom' }], {
        'room-1': [],
      });

      const { result } = renderHook(() => useLoungeRooms('my-user-id'));

      await waitFor(() => expect(result.current.loaded).toBe(true));
      expect(result.current.rooms[0].preview).toBe('');
      expect(result.current.rooms[0].lastMessageAt).toBeNull();
    });

    it('still lists a room whose messages could not be fetched', async () => {
      respondWith([{ id: 'room-1', name: 'BKC Community Room', conversationType: 'communityRoom' }]);
      mockRetrieveData.mockImplementation((path: string) => {
        if (path === 'conversations/userConversations') {
          return Promise.resolve([{ id: 'room-1', name: 'BKC Community Room', conversationType: 'communityRoom' }]);
        }
        return Promise.resolve({ error: true, status: 403, message: 'nope' });
      });

      const { result } = renderHook(() => useLoungeRooms('my-user-id'));

      await waitFor(() => expect(result.current.loaded).toBe(true));
      expect(result.current.rooms[0].name).toBe('BKC Community Room');
      expect(result.current.rooms[0].preview).toBe('');
    });
  });

  describe('the unread flag', () => {
    it('marks a room unread when it has a message the reader has not seen', async () => {
      markRoomRead('room-1', '2026-08-27T09:00:00.000Z');
      respondWith([{ id: 'room-1', name: 'BKC Community Room', conversationType: 'communityRoom' }], {
        'room-1': [makeMessage({ createdAt: '2026-08-28T09:41:00.000Z' })],
      });

      const { result } = renderHook(() => useLoungeRooms('my-user-id'));

      await waitFor(() => expect(result.current.loaded).toBe(true));
      expect(result.current.rooms[0].hasUnread).toBe(true);
    });

    it('marks a room read once its newest message predates the last visit', async () => {
      markRoomRead('room-1', '2026-08-29T09:00:00.000Z');
      respondWith([{ id: 'room-1', name: 'BKC Community Room', conversationType: 'communityRoom' }], {
        'room-1': [makeMessage({ createdAt: '2026-08-28T09:41:00.000Z' })],
      });

      const { result } = renderHook(() => useLoungeRooms('my-user-id'));

      await waitFor(() => expect(result.current.loaded).toBe(true));
      expect(result.current.rooms[0].hasUnread).toBe(false);
    });

    it('never marks the reader unread for their own message', async () => {
      respondWith([{ id: 'room-1', name: 'BKC Community Room', conversationType: 'communityRoom' }], {
        'room-1': [makeMessage({ owner: 'my-user-id' })],
      });

      const { result } = renderHook(() => useLoungeRooms('my-user-id'));

      await waitFor(() => expect(result.current.loaded).toBe(true));
      expect(result.current.rooms[0].hasUnread).toBe(false);
    });

    it('marks a never-opened room with messages as unread', async () => {
      respondWith([{ id: 'room-1', name: 'BKC Community Room', conversationType: 'communityRoom' }], {
        'room-1': [makeMessage()],
      });

      const { result } = renderHook(() => useLoungeRooms('my-user-id'));

      await waitFor(() => expect(result.current.loaded).toBe(true));
      expect(result.current.rooms[0].hasUnread).toBe(true);
    });
  });

  it('waits for a user id before fetching', async () => {
    respondWith([]);

    const { result } = renderHook(() => useLoungeRooms(null));

    expect(mockRetrieveData).not.toHaveBeenCalled();
    expect(result.current.loaded).toBe(false);
  });
});
