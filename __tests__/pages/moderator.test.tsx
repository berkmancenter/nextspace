import { render, screen, waitFor } from '@testing-library/react';
import { axe } from 'jest-axe';
import { act } from 'react';
import { useRouter } from 'next/router';
import { io } from 'socket.io-client';
import ModeratorScreen from '../../pages/moderator';
import { GetChannelPasscode, RetrieveData } from '../../utils';
import { channel } from 'diagnostics_channel';

// Mock dependencies
jest.mock('next/router', () => ({
  useRouter: jest.fn(),
}));

jest.mock('socket.io-client', () => ({
  io: jest.fn(),
}));

jest.mock('../../components/Transcript', () => ({
  Transcript: jest.fn(() => <div data-testid="transcript-component" />),
}));

jest.mock('../../utils', () => ({
  Api: {
    get: jest.fn().mockReturnValue({
      SetTokens: jest.fn(),
      GetTokens: jest.fn().mockReturnValue({ access: 'mock-token' }),
      getAccessToken: jest.fn().mockReturnValue('mock-token'),
    }),
  },
  GetChannelPasscode: jest.fn().mockReturnValue('mock-passcode'),
  RetrieveData: jest.fn(),
  QueryParamsError: jest.fn((router, page) => {
    const { conversationId, channel }: { conversationId?: string; channel?: string[] | string } = router.query;
    const missing: string[] = [];

    if (!conversationId) missing.push('conversation ID');
    if (!channel) missing.push('channel');

    if (typeof channel === 'string' && !channel.startsWith('moderator')) missing.push('moderator channel');
    else if (Array.isArray(channel) && !channel.find((ch) => ch.startsWith('moderator'))) missing.push('moderator channel');
    if (!GetChannelPasscode('moderator', router.query)) missing.push('moderator passcode');
    if (typeof channel === 'string' && !channel.startsWith('transcript')) missing.push('transcript channel');
    else if (Array.isArray(channel) && !channel.find((ch) => ch.startsWith('transcript')))
      missing.push('transcript channel');
    if (!GetChannelPasscode('transcript', router.query)) missing.push('transcript passcode');

    if (missing.length > 0) return { header: `Missing required parameter${missing.length > 1 ? 's' : ''}`, params: missing };

    return null;
  }),
  emitWithTokenRefresh: jest.fn((socket, event, data, onSuccess) => {
    // Simulate successful emit
    if (onSuccess) onSuccess();
    // Also call socket.emit so existing tests can verify it
    socket.emit(event, data);
  }),
}));

jest.mock('react-scroll', () => ({
  animateScroll: {
    scrollToTop: jest.fn(),
  },
}));

jest.mock('../../utils/Helpers', () => ({
  CheckAuthHeader: jest.fn().mockResolvedValue({ props: {} }),
  createConversationFromData: jest.fn().mockResolvedValue({
    type: { name: 'eventAssistant' },
  }),
}));

// Mock useSessionJoin
const mockUseSessionJoin = jest.fn();
jest.mock('../../hooks/useSessionJoin', () => ({
  useSessionJoin: (...args: any[]) => mockUseSessionJoin(...args),
}));

// Mock SessionManager
jest.mock('../../utils/SessionManager', () => {
  const mockSessionManager = {
    get: jest.fn(() => ({
      restoreSession: jest.fn().mockResolvedValue(true),
      getState: jest.fn().mockReturnValue('authenticated'),
      hasSession: jest.fn().mockReturnValue(true),
      getSessionInfo: jest.fn().mockReturnValue({
        userId: 'moderator-123',
        username: 'ModeratorUser',
      }),
    })),
  };
  return {
    __esModule: true,
    default: mockSessionManager,
  };
});

describe('ModeratorScreen', () => {
  const mockRouter = {
    isReady: true,
    query: {
      conversationId: 'test-conversation',
      channel: ['moderator,nDWq1-bh', 'transcript,MJqaT2ii'],
    },
  };

  const mockSocket = {
    on: jest.fn(),
    off: jest.fn(),
    emit: jest.fn(),
    hasListeners: jest.fn().mockReturnValue(false),
    connected: true,
  };

  const mockMessages = [
    {
      id: '1',
      pseudonym: 'Back Channel Insights Agent',
      createdAt: '2025-10-17T12:00:00Z',
      channels: ['moderator'],
      body: {
        insights: [
          {
            value: 'Test insight',
            source: 'ai',
            recommendations: ['Follow up on this topic.', 'Ask for clarifying questions.'],
          },
        ],
        timestamp: {
          start: '2025-10-17T12:00:00Z',
          end: '2025-10-17T12:05:00Z',
        },
      },
    },
    {
      id: '2',
      pseudonym: 'Back Channel Metrics Agent',
      createdAt: '2025-10-17T12:10:00Z',
      channels: ['moderator'],
      body: {
        metrics: [{ name: 'happiness' }],
        timestamp: {
          start: '2025-10-17T12:10:00Z',
          end: '2025-10-17T12:15:00Z',
        },
      },
    },
    {
      id: '3',
      pseudonym: 'Event Mediator',
      createdAt: '2026-03-13T00:31:29.268Z',
      channels: ['moderator'],
      body: {
        insights: [
          {
            value: 'At least 2 participants are independently reporting they cannot hear the speaker/audio.',
            source: 'ai',
          },
        ],
        timestamp: {
          start: 1773361630922,
          end: 1773361881969,
        },
      },
    },
    {
      id: '4',
      pseudonym: 'Event Mediator',
      createdAt: '2026-03-13T00:35:00.000Z',
      channels: ['moderator'],
      body: {
        insights: [
          {
            value: 'Will slides be shared after the session?',
            source: 'participant',
          },
        ],
        timestamp: {
          start: 1773361630922,
          end: 1773361881969,
        },
      },
    },
  ];

  const mockConversation = {
    name: 'Test Event',
    active: true,
    features: [{ name: 'moderatorSupport', enabled: true }],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
    (io as jest.Mock).mockReturnValue(mockSocket);
    (RetrieveData as jest.Mock).mockImplementation((url: string) => {
      if (url.startsWith('conversations/')) return Promise.resolve(mockConversation);
      return Promise.resolve(mockMessages);
    });

    // Default mock implementation for useSessionJoin
    mockUseSessionJoin.mockReturnValue({
      socket: mockSocket,
      pseudonym: 'ModeratorUser',
      userId: 'moderator-123',
      isConnected: true,
      errorMessage: null,
    });
  });

  it('renders the moderator screen with insight and metric messages', async () => {
    await act(async () => {
      render(<ModeratorScreen authType={'user'} />);
    });

    await waitFor(() => {
      expect(screen.getByText('Test insight')).toBeInTheDocument();
      expect(screen.getByText(/The audience is expressing/)).toBeInTheDocument();
      expect(screen.getByText(/happiness/)).toBeInTheDocument();
    });
  });

  it('renders Transcript when transcript passcode exists', async () => {
    await act(async () => {
      render(<ModeratorScreen authType={'user'} />);
    });

    expect(screen.getByTestId('transcript-component')).toBeInTheDocument();
  });

  it('displays error when conversation is not found', async () => {
    (RetrieveData as jest.Mock).mockResolvedValue(null);

    await act(async () => {
      render(<ModeratorScreen authType={'user'} />);
    });

    await waitFor(() => {
      expect(document.getElementById('params-error')).toBeInTheDocument();
      expect(screen.getByText('Error')).toBeInTheDocument();
      expect(screen.getByText('Conversation Not Found')).toBeInTheDocument();
    });
  });

  it('shows error message when channel query param is missing', async () => {
    (useRouter as jest.Mock).mockReturnValue({
      ...mockRouter,
      query: {
        conversationId: 'test-conversation-id',
        channel: null,
      },
    });

    await act(async () => {
      render(<ModeratorScreen authType={'user'} />);
    });

    await waitFor(() => {
      expect(document.getElementById('params-error')).toBeInTheDocument();
      expect(screen.getByText('Error')).toBeInTheDocument();
      expect(screen.getByText(/Missing required parameter/)).toBeInTheDocument();
      expect(screen.getByText(/channel/i)).toBeInTheDocument();
    });
  });

  it('shows error message when channel query params are invalid', async () => {
    (useRouter as jest.Mock).mockReturnValue({
      ...mockRouter,
      query: {
        conversationId: 'test-conversation-id',
        channel: 'moderator',
        passcode: null,
      },
    });

    await act(async () => {
      render(<ModeratorScreen authType={'user'} />);
    });

    await waitFor(() => {
      expect(document.getElementById('params-error')).toBeInTheDocument();
      expect(screen.getByText('Error')).toBeInTheDocument();
      expect(screen.getByText(/Missing required parameter/)).toBeInTheDocument();
      expect(screen.getByRole('list')).toBeInTheDocument();
      expect(screen.getByText(/transcript channel/i)).toBeInTheDocument();
    });
  });

  it('shows error message when API returns an error', async () => {
    (RetrieveData as jest.Mock).mockResolvedValue({
      error: true,
      message: { message: 'API error' },
    });

    await act(async () => {
      render(<ModeratorScreen authType={'user'} />);
    });

    await waitFor(() => {
      expect(screen.getByText('API error')).toBeInTheDocument();
    });
  });

  it('loads initial moderator messages on page load', async () => {
    await act(async () => {
      render(<ModeratorScreen authType={'user'} />);
    });

    await waitFor(() => {
      expect(RetrieveData).toHaveBeenCalledWith('messages/test-conversation?channel=moderator,mock-passcode', 'mock-token');
    });
  });

  it('emits conversation:join with moderator channel', async () => {
    await act(async () => {
      render(<ModeratorScreen authType={'user'} />);
    });

    await waitFor(() => {
      expect(mockSocket.emit).toHaveBeenCalledWith('conversation:join', {
        conversationId: 'test-conversation',
        token: 'mock-token',
        channel: { name: 'moderator', passcode: 'mock-passcode' },
      });
    });
  });

  it('uses the current token from Api singleton for RetrieveData, not a stale captured value', async () => {
    // Simulate token rotation: the singleton returns a new token after the
    // component has already mounted. The page must read the singleton on every
    // call rather than capturing the value at render time.
    const mockGetTokens = jest
      .fn()
      .mockReturnValueOnce({ access: 'initial-token' }) // first read (useEffect guard)
      .mockReturnValue({ access: 'rotated-token' }); // all subsequent reads

    const { Api: MockApi } = require('../../utils');
    MockApi.get.mockReturnValue({
      SetTokens: jest.fn(),
      GetTokens: mockGetTokens,
      getAccessToken: jest.fn(() => mockGetTokens()?.access ?? ''),
    });

    await act(async () => {
      render(<ModeratorScreen authType={'user'} />);
    });

    await waitFor(() => {
      // RetrieveData should be called with the current token from the singleton
      // at call time, not a value frozen at render time.
      const retrieveDataCalls = (RetrieveData as jest.Mock).mock.calls;
      expect(retrieveDataCalls.length).toBeGreaterThan(0);
      // Every RetrieveData call should use whatever the singleton returns at
      // that moment — if the token was captured at render the old value
      // ("initial-token") would appear here instead.
      retrieveDataCalls.forEach(([_url, token]) => {
        expect(token).not.toBe('initial-token');
        expect(token).toBe('rotated-token');
      });
    });
  });

  it('uses fresh token from Api singleton when re-fetching after gap-reconnect', async () => {
    const mockGetTokens = jest.fn().mockReturnValue({ access: 'fresh-token-after-reconnect' });
    const { Api: MockApi } = require('../../utils');
    MockApi.get.mockReturnValue({
      SetTokens: jest.fn(),
      GetTokens: mockGetTokens,
      getAccessToken: jest.fn(() => mockGetTokens()?.access ?? ''),
    });

    // Expose lastReconnectTime as a controllable value
    let triggerReconnect: (time: number) => void;
    const lastReconnectTimeRef = { current: null as number | null };

    mockUseSessionJoin.mockImplementation(() => ({
      socket: mockSocket,
      pseudonym: 'ModeratorUser',
      userId: 'moderator-123',
      isConnected: true,
      errorMessage: null,
      lastReconnectTime: lastReconnectTimeRef.current,
    }));

    const { rerender } = await act(async () => render(<ModeratorScreen authType={'user'} />));

    // Simulate a gap-reconnect by re-rendering with a non-null lastReconnectTime
    lastReconnectTimeRef.current = Date.now();
    mockUseSessionJoin.mockReturnValue({
      socket: mockSocket,
      pseudonym: 'ModeratorUser',
      userId: 'moderator-123',
      isConnected: true,
      errorMessage: null,
      lastReconnectTime: lastReconnectTimeRef.current,
    });

    await act(async () => {
      rerender(<ModeratorScreen authType={'user'} />);
    });

    await waitFor(() => {
      const retrieveDataCalls = (RetrieveData as jest.Mock).mock.calls;
      // At least one call should be the gap-reconnect re-fetch for moderator messages
      const reconnectFetch = retrieveDataCalls.find(
        ([url]) => url.includes('messages/test-conversation') && url.includes('moderator'),
      );
      expect(reconnectFetch).toBeDefined();
      // It must use the current token from the singleton, not a stale string
      expect(reconnectFetch![1]).toBe('fresh-token-after-reconnect');
    });
  });

  it('renders insights from Event Mediator pseudonym correctly', async () => {
    await act(async () => {
      render(<ModeratorScreen authType={'user'} />);
    });

    await waitFor(() => {
      expect(screen.getByText(/At least 2 participants are independently reporting/)).toBeInTheDocument();
    });
  });

  it('logs unknown message formats to console instead of displaying them', async () => {
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

    const messagesWithUnknown = [
      ...mockMessages,
      {
        id: '4',
        pseudonym: 'Unknown Agent',
        createdAt: '2026-03-13T01:00:00Z',
        channels: ['moderator'],
        body: {
          // Has insights property to pass the filter, but it's not an array
          // This will cause it to fail the Array.isArray check in renderMessageBody
          insights: 'not an array',
          timestamp: {
            start: 1773361630922,
            end: 1773361881969,
          },
        },
      },
    ];

    (RetrieveData as jest.Mock).mockResolvedValue(messagesWithUnknown);

    await act(async () => {
      render(<ModeratorScreen authType={'user'} />);
    });

    await waitFor(() => {
      // Check that console.log was called with the unknown message
      const unknownMessageCalls = consoleLogSpy.mock.calls.filter((call) => call[0] === 'Unknown message format:');
      expect(unknownMessageCalls.length).toBeGreaterThan(0);
      expect(unknownMessageCalls[0][1]).toMatchObject({
        id: '4',
        pseudonym: 'Unknown Agent',
      });

      // Ensure "Unknown message format" text is NOT displayed in the UI
      expect(screen.queryByText('Unknown message format')).not.toBeInTheDocument();
    });

    consoleLogSpy.mockRestore();
  });

  it('handles insights based on body structure rather than pseudonym', async () => {
    // Test that insights are displayed regardless of the pseudonym name
    const customInsightsMessage = [
      {
        id: '5',
        pseudonym: 'Custom Insight Agent',
        createdAt: '2026-03-13T02:00:00Z',
        channels: ['moderator'],
        body: {
          insights: [{ value: 'Custom insight from non-standard agent' }],
          timestamp: {
            start: 1773361630922,
            end: 1773361881969,
          },
        },
      },
    ];

    (RetrieveData as jest.Mock).mockResolvedValue(customInsightsMessage);

    await act(async () => {
      render(<ModeratorScreen authType={'user'} />);
    });

    await waitFor(() => {
      expect(screen.getByText('Custom insight from non-standard agent')).toBeInTheDocument();
    });
  });

  it('logs messages with metrics property that is not an array', async () => {
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

    const messagesWithInvalidMetrics = [
      {
        id: '6',
        pseudonym: 'Invalid Metrics Agent',
        createdAt: '2026-03-13T03:00:00Z',
        channels: ['moderator'],
        body: {
          metrics: 'not an array',
          timestamp: {
            start: 1773361630922,
            end: 1773361881969,
          },
        },
      },
    ];

    (RetrieveData as jest.Mock).mockResolvedValue(messagesWithInvalidMetrics);

    await act(async () => {
      render(<ModeratorScreen authType={'user'} />);
    });

    await waitFor(() => {
      const unknownMessageCalls = consoleLogSpy.mock.calls.filter((call) => call[0] === 'Unknown message format:');
      expect(unknownMessageCalls.length).toBeGreaterThan(0);
      expect(unknownMessageCalls[0][1]).toMatchObject({
        id: '6',
        pseudonym: 'Invalid Metrics Agent',
      });
    });

    consoleLogSpy.mockRestore();
  });

  describe('moderatorSupport feature flag', () => {
    it('shows disabled notice when conversation is active and moderatorSupport feature is absent', async () => {
      (RetrieveData as jest.Mock).mockImplementation((url: string) => {
        if (url.startsWith('conversations/')) return Promise.resolve({ name: 'Test Event', active: true, features: [] });
        return Promise.resolve([]);
      });

      await act(async () => {
        render(<ModeratorScreen authType={'user'} />);
      });

      await waitFor(() => {
        expect(screen.getByText(/Moderator question submission is not enabled/)).toBeInTheDocument();
      });
    });

    it('shows disabled notice when moderatorSupport feature exists but is disabled', async () => {
      (RetrieveData as jest.Mock).mockImplementation((url: string) => {
        if (url.startsWith('conversations/'))
          return Promise.resolve({
            name: 'Test Event',
            active: true,
            features: [{ name: 'moderatorSupport', enabled: false }],
          });
        return Promise.resolve([]);
      });

      await act(async () => {
        render(<ModeratorScreen authType={'user'} />);
      });

      await waitFor(() => {
        expect(screen.getByText(/Moderator question submission is not enabled/)).toBeInTheDocument();
      });
    });

    it('does not show disabled notice when moderatorSupport feature is enabled', async () => {
      await act(async () => {
        render(<ModeratorScreen authType={'user'} />);
      });

      await waitFor(() => {
        expect(screen.queryByText(/Moderator question submission is not enabled/)).not.toBeInTheDocument();
      });
    });

    it("does not show 'No messages yet' when moderatorSupport is disabled", async () => {
      (RetrieveData as jest.Mock).mockImplementation((url: string) => {
        if (url.startsWith('conversations/')) return Promise.resolve({ name: 'Test Event', active: true, features: [] });
        return Promise.resolve([]);
      });

      await act(async () => {
        render(<ModeratorScreen authType={'user'} />);
      });

      await waitFor(() => {
        expect(screen.queryByText('No messages yet.')).not.toBeInTheDocument();
      });
    });

    it("shows 'No messages yet' when moderatorSupport is enabled and there are no messages", async () => {
      (RetrieveData as jest.Mock).mockImplementation((url: string) => {
        if (url.startsWith('conversations/')) return Promise.resolve(mockConversation);
        return Promise.resolve([]);
      });

      await act(async () => {
        render(<ModeratorScreen authType={'user'} />);
      });

      await waitFor(() => {
        expect(screen.getByText('No messages yet.')).toBeInTheDocument();
      });
    });

    it('does not show disabled notice when conversation is inactive, even if moderatorSupport is absent', async () => {
      (RetrieveData as jest.Mock).mockImplementation((url: string) => {
        if (url.startsWith('conversations/')) return Promise.resolve({ name: 'Test Event', active: false, features: [] });
        return Promise.resolve(mockMessages);
      });

      await act(async () => {
        render(<ModeratorScreen authType={'user'} />);
      });

      await waitFor(() => {
        expect(screen.queryByText(/Moderator question submission is not enabled/)).not.toBeInTheDocument();
      });
    });
  });

  it('renders AI Insight badge for insights with source: ai', async () => {
    await act(async () => {
      render(<ModeratorScreen authType={'user'} />);
    });

    await waitFor(() => {
      expect(screen.getAllByText('AI Insight').length).toBeGreaterThan(0);
    });
  });

  it('renders Question badge for insights with source: participant', async () => {
    await act(async () => {
      render(<ModeratorScreen authType={'user'} />);
    });

    await waitFor(() => {
      expect(screen.getByText('Question')).toBeInTheDocument();
      expect(screen.getByText('Will slides be shared after the session?')).toBeInTheDocument();
    });
  });

  it('renders Reaction badge for metric messages', async () => {
    await act(async () => {
      render(<ModeratorScreen authType={'user'} />);
    });

    await waitFor(() => {
      expect(screen.getByText('Reaction')).toBeInTheDocument();
    });
  });

  it('renders Suggested Actions section when recommendations are present', async () => {
    await act(async () => {
      render(<ModeratorScreen authType={'user'} />);
    });

    await waitFor(() => {
      expect(screen.getByText(/Suggested Actions/)).toBeInTheDocument();
      expect(screen.getByText('Follow up on this topic.')).toBeInTheDocument();
      expect(screen.getByText('Ask for clarifying questions.')).toBeInTheDocument();
    });
  });

  it('does not render Suggested Actions section when recommendations are absent', async () => {
    await act(async () => {
      render(<ModeratorScreen authType={'user'} />);
    });

    await waitFor(() => {
      expect(screen.getByText('Will slides be shared after the session?')).toBeInTheDocument();
    });

    // The participant question has no recommendations — only one Suggested Actions block should exist
    expect(screen.getAllByText(/Suggested Actions/)).toHaveLength(1);
  });

  it('has no accessibility violations in the loaded state', async () => {
    const { container } = await act(async () => render(<ModeratorScreen authType={'user'} />));

    await waitFor(() => expect(screen.getByText('Test insight')).toBeInTheDocument());

    expect(await axe(container)).toHaveNoViolations();
  });

  it('logs messages with preset but no text property', async () => {
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

    const messagesWithPartialPreset = [
      {
        id: '7',
        pseudonym: 'Partial Preset Agent',
        createdAt: '2026-03-13T04:00:00Z',
        channels: ['moderator'],
        body: {
          // Has insights to pass the filter
          insights: {},
          preset: true,
          // Missing text property
          timestamp: {
            start: 1773361630922,
            end: 1773361881969,
          },
        },
      },
    ];

    (RetrieveData as jest.Mock).mockResolvedValue(messagesWithPartialPreset);

    await act(async () => {
      render(<ModeratorScreen authType={'user'} />);
    });

    await waitFor(() => {
      const unknownMessageCalls = consoleLogSpy.mock.calls.filter((call) => call[0] === 'Unknown message format:');
      expect(unknownMessageCalls.length).toBeGreaterThan(0);
      expect(unknownMessageCalls[0][1]).toMatchObject({
        id: '7',
        pseudonym: 'Partial Preset Agent',
      });
    });

    consoleLogSpy.mockRestore();
  });
});
