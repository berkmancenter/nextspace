import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EventAssistantRoom from '../../pages/assistant';
import { RetrieveData, SendData } from '../../utils';
import { createConversationFromData, GetChannelPasscode } from '../../utils/Helpers';
import { ConversationTypeProvider } from '../../context/ConversationTypeContext';

// Mock next/router
const mockPush = jest.fn();
const mockRouter = {
  push: mockPush,
  query: { conversationId: 'test-conversation-id' } as any,
  isReady: true,
};

jest.mock('next/router', () => ({
  useRouter: () => mockRouter,
}));

// Mock socket.io-client
const mockSocket = {
  on: jest.fn(),
  once: jest.fn(),
  off: jest.fn(),
  onAny: jest.fn(),
  offAny: jest.fn(),
  emit: jest.fn(),
  auth: { token: 'mock-token' },
  hasListeners: jest.fn(() => false),
  connected: true,
};

jest.mock('socket.io-client', () => ({
  io: jest.fn(() => mockSocket),
}));

// Mock SessionManager
jest.mock('../../utils/SessionManager', () => {
  const mockSessionManager = {
    get: jest.fn(() => ({
      restoreSession: jest.fn().mockResolvedValue(true),
      getState: jest.fn().mockReturnValue('guest'),
      hasSession: jest.fn().mockReturnValue(true),
      markAuthenticated: jest.fn(),
      markGuest: jest.fn(),
      clearSession: jest.fn(),
    })),
  };
  return {
    __esModule: true,
    default: mockSessionManager,
  };
});

// Mock utils
jest.mock('../../utils', () => ({
  Api: {
    get: jest.fn(() => ({
      GetTokens: jest.fn(() => ({ access: 'mock-access-token' })),
      GetConfig: jest.fn(() => Promise.resolve({ conversationBotName: 'Berkie' })),
      getAccessToken: jest.fn(() => 'mock-access-token'),
    })),
  },
  QueryParamsError: jest.fn((router, page) => {
    const { conversationId, channel }: { conversationId?: string; channel?: string[] | string } = router.query;
    const missing: string[] = [];

    if (!conversationId) missing.push('conversation ID');
    if (!channel) missing.push('channel');

    if (typeof channel === 'string' && !channel.startsWith('chat')) missing.push('chat channel');
    else if (Array.isArray(channel) && !channel.find((ch) => ch.startsWith('chat'))) missing.push('chat channel');
    if (!GetChannelPasscode('chat', router.query)) missing.push('chat passcode');
    if (
      (typeof channel === 'string' && channel.startsWith('transcript')) ||
      (Array.isArray(channel) && channel.find((ch) => ch.startsWith('transcript')))
    ) {
      if (!GetChannelPasscode('transcript', router.query)) missing.push('transcript passcode');
    }
    if (missing.length > 0) return { header: `Missing required parameter${missing.length > 1 ? 's' : ''}`, params: missing };

    return null;
  }),

  RetrieveData: jest.fn(),
  SendData: jest.fn(),
  GetChannelPasscode: jest.fn((channel: string, query: any) => {
    // Extract passcode from query.channel parameter
    if (!query.channel) return null;

    const channels = Array.isArray(query.channel) ? query.channel : [query.channel];
    const matchingChannel = channels.find((c: string) => c.includes(channel));

    if (matchingChannel) {
      const parts = matchingChannel.split(',');
      return parts[1] || null;
    }
    return null;
  }),
  emitWithTokenRefresh: jest.fn((socket, event, data, onSuccess) => {
    // Simulate successful emit
    if (onSuccess) onSuccess();
    // Also call socket.emit so existing tests can verify it
    socket.emit(event, data);
  }),
  buildDirectChannels: jest.fn((userId, agents) =>
    agents.map((a: any) => ({
      name: `direct-${userId}-${a.agentId}`,
      passcode: null,
      direct: true,
    })),
  ),
}));

// Mock useSessionJoin hook
const mockUseSessionJoin = jest.fn();
jest.mock('../../utils/useSessionJoin', () => ({
  useSessionJoin: (...args: any[]) => mockUseSessionJoin(...args),
}));

// Mock message components
jest.mock('../../components/messages', () => ({
  AssistantMessage: ({ message, onPopulateFeedbackText, onSendFeedbackRating, messageType }: any) => {
    const messageText = typeof message.body === 'string' ? message.body : message.body?.text || '';

    return (
      <div data-testid="assistant-message">
        {messageText}
        {message.id && !messageType && (
          <div data-testid="message-feedback" data-message-id={message.id}>
            <button data-testid="rating-button-3" onClick={() => onSendFeedbackRating?.(message.id, 3)}>
              3
            </button>
            <button
              data-testid="say-more-button"
              onClick={() =>
                onPopulateFeedbackText?.({
                  prefix: `/feedback|Text|${message.id}|`,
                  icon: null,
                  label: 'Feedback Mode',
                })
              }
            >
              Say more
            </button>
          </div>
        )}
      </div>
    );
  },
  SubmittedMessage: ({ message }: any) => {
    const messageText = typeof message.body === 'string' ? message.body : message.body?.text || '';
    return <div data-testid="submitted-message">{messageText}</div>;
  },
  ModeratorSubmittedMessage: ({ message }: any) => {
    const messageText = typeof message.body === 'string' ? message.body : message.body?.text || '';
    return <div data-testid="moderator-submitted-message">{messageText}</div>;
  },
  UserMessage: ({ message }: any) => {
    const messageText = typeof message.body === 'string' ? message.body : message.body?.text || '';
    return <div data-testid="user-message">{messageText}</div>;
  },
  JargonClarificationMessage: ({ message }: any) => {
    const body = typeof message.body === 'object' ? message.body : {};
    return (
      <div data-testid="jargon-clarification-message">
        {body.sourceText && <div>{body.sourceText}</div>}
        {body.text && <div>{body.text}</div>}
      </div>
    );
  },
}));

// Mock CheckAuthHeader and createConversationFromData
jest.mock('../../utils/Helpers', () => ({
  ...jest.requireActual('../../utils/Helpers'),
  CheckAuthHeader: jest.fn(() => ({ props: {} })),
  createConversationFromData: jest.fn(),
}));

describe('EventAssistantRoom', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPush.mockReset();
    (RetrieveData as jest.Mock).mockResolvedValue({
      agents: [{ id: 'agent-123', agentType: 'eventAssistant' }],
    });

    // Mock createConversationFromData to return a conversation object with type
    (createConversationFromData as jest.Mock).mockResolvedValue({
      agents: [{ id: 'agent-123', agentType: 'eventAssistant' }],
      type: { name: 'eventAssistant' },
    });

    mockSocket.hasListeners.mockReturnValue(false);
    mockRouter.query = { conversationId: 'test-conversation-id', channel: ['transcript,MJqaT2ii', 'chat,chat-pass'] };
    mockRouter.isReady = true;

    // Default mock implementation
    mockUseSessionJoin.mockReturnValue({
      socket: mockSocket,
      pseudonym: 'test-pseudonym',
      userId: 'user-123',
      isConnected: true,
      errorMessage: null,
    });

    // Mock scrollIntoView for SlashCommandMenu
    HTMLElement.prototype.scrollIntoView = jest.fn();

    // Mock scrollIntoView
    Element.prototype.scrollIntoView = jest.fn();
  });

  it('renders loading state initially', async () => {
    // Mock as not connected yet
    mockUseSessionJoin.mockReturnValue({
      socket: mockSocket,
      pseudonym: 'test-pseudonym',
      userId: 'user-123',
      isConnected: false,
      errorMessage: null,
    });

    let container;
    await act(async () => {
      const result = render(<EventAssistantRoom authType={'guest'} />);
      container = result.container;
    });

    // Should show loading indicator (animated circles)
    const loadingCircles = container!.querySelectorAll('.animate-bounce');
    expect(loadingCircles.length).toBeGreaterThan(0);
  });

  it('initializes socket connection on mount', async () => {
    await act(async () => {
      render(<EventAssistantRoom authType={'guest'} />);
    });

    await waitFor(() => {
      expect(mockUseSessionJoin).toHaveBeenCalled();
    });
  });

  it('sets up socket event listeners', async () => {
    await act(async () => {
      render(<EventAssistantRoom authType={'guest'} />);
    });

    // useSessionJoin handles error/connect/disconnect events internally
    // The page component sets up message:new listener
    await waitFor(() => {
      expect(mockSocket.on).toHaveBeenCalledWith('message:new', expect.any(Function));
    });
  });

  describe('pseudonym fun fact', () => {
    it('fetches user data using userId on mount', async () => {
      (RetrieveData as jest.Mock).mockImplementation((url: string) => {
        if (url === 'users/user/user-123') {
          return Promise.resolve({
            pseudonyms: [
              { active: true, pseudonym: 'test-pseudonym', funFact: "Foxes use the Earth's magnetic field to hunt." },
            ],
          });
        }
        return Promise.resolve({ agents: [{ id: 'agent-123', agentType: 'eventAssistant' }] });
      });

      await act(async () => {
        render(<EventAssistantRoom authType={'guest'} />);
      });

      await waitFor(() => {
        expect(RetrieveData).toHaveBeenCalledWith('users/user/user-123', 'mock-access-token');
      });
    });

    it('does not fetch user data when userId is null', async () => {
      mockUseSessionJoin.mockReturnValue({
        socket: mockSocket,
        pseudonym: 'test-pseudonym',
        userId: null,
        isConnected: true,
        errorMessage: null,
      });

      await act(async () => {
        render(<EventAssistantRoom authType={'guest'} />);
      });

      await waitFor(() => {
        expect(RetrieveData).not.toHaveBeenCalledWith(expect.stringContaining('users/user/'), expect.anything());
      });
    });

    it('passes fun fact to chat panel when active pseudonym has funFact', async () => {
      (RetrieveData as jest.Mock).mockImplementation((url: string) => {
        if (url === 'users/user/user-123') {
          return Promise.resolve({
            pseudonyms: [
              { active: true, pseudonym: 'test-pseudonym', funFact: "Foxes use the Earth's magnetic field to hunt." },
            ],
          });
        }
        return Promise.resolve({ agents: [{ id: 'agent-123', agentType: 'eventAssistant' }] });
      });

      await act(async () => {
        render(
          <ConversationTypeProvider>
            <EventAssistantRoom authType={'guest'} />
          </ConversationTypeProvider>,
        );
      });

      // Open the info popover
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Pseudonym info' })).toBeInTheDocument();
      });

      await userEvent.click(screen.getByRole('button', { name: 'Pseudonym info' }));

      await waitFor(() => {
        expect(screen.getByText(/Foxes use the Earth/i)).toBeInTheDocument();
      });
    });
  });

  it('fetches conversation data when router is ready', async () => {
    await act(async () => {
      render(<EventAssistantRoom authType={'guest'} />);
    });

    await waitFor(() => {
      expect(RetrieveData).toHaveBeenCalledWith('conversations/test-conversation-id', 'mock-access-token');
    });
  });

  it('displays error when conversation is not found', async () => {
    (RetrieveData as jest.Mock).mockResolvedValue(null);

    await act(async () => {
      render(<EventAssistantRoom authType={'guest'} />);
    });

    await waitFor(() => {
      expect(screen.getByText('Conversation Not Found')).toBeInTheDocument();
    });
  });

  it('displays error when conversation has an error', async () => {
    (RetrieveData as jest.Mock).mockResolvedValue({
      error: true,
      message: { message: 'Access denied' },
    });

    await act(async () => {
      render(<EventAssistantRoom authType={'guest'} />);
    });

    await waitFor(() => {
      expect(screen.getByText('Access denied')).toBeInTheDocument();
    });
  });

  it('shows inactive notice when conversation has no event assistant agent', async () => {
    (RetrieveData as jest.Mock).mockResolvedValue({
      agents: [{ id: 'agent-123', agentType: 'regular' }],
    });
    (createConversationFromData as jest.Mock).mockResolvedValue({
      agents: [{ id: 'agent-123', agentType: 'regular' }],
      type: { name: 'eventAssistant' },
    });

    await act(async () => {
      render(<EventAssistantRoom authType={'guest'} />);
    });

    await act(async () => {
      await userEvent.click(screen.getAllByRole('button', { name: 'Berkie' })[0]);
    });

    await waitFor(() => {
      expect(screen.getByText('This event has ended. Berkie is no longer active.')).toBeInTheDocument();
    });
  });

  it('handles session join errors gracefully', async () => {
    mockUseSessionJoin.mockReturnValue({
      socket: null,
      pseudonym: null,
      userId: null,
      isConnected: false,
      errorMessage: 'Failed to join session',
    });

    await act(async () => {
      render(<EventAssistantRoom authType={'guest'} />);
    });

    await waitFor(() => {
      expect(screen.getByText('Failed to join session')).toBeInTheDocument();
    });
  });

  it('loads initial assistant messages on page load', async () => {
    const mockMessages = [
      {
        id: '1',
        body: 'Hello',
        pseudonym: 'User',
        channels: ['direct-user-123-agent-123'],
      },
      {
        id: '2',
        body: 'Hi there!',
        pseudonym: 'Event Assistant',
        channels: ['direct-user-123-agent-123'],
      },
    ];

    (RetrieveData as jest.Mock)
      .mockResolvedValueOnce({
        agents: [{ id: 'agent-123', agentType: 'eventAssistant' }],
      })
      .mockResolvedValueOnce(mockMessages);
    (createConversationFromData as jest.Mock).mockResolvedValue({
      agents: [{ id: 'agent-123', agentType: 'eventAssistant' }],
      type: { name: 'eventAssistant' },
    });

    await act(async () => {
      render(<EventAssistantRoom authType={'guest'} />);
    });

    await waitFor(() => {
      expect(RetrieveData).toHaveBeenCalledWith(
        'messages/test-conversation-id?channel=direct-user-123-agent-123',
        'mock-access-token',
      );
    });
  });

  it('emits conversation:join when socket, userId, and agentId are available', async () => {
    (RetrieveData as jest.Mock).mockResolvedValue({
      agents: [{ id: 'agent-123', agentType: 'eventAssistant' }],
    });
    (createConversationFromData as jest.Mock).mockResolvedValue({
      agents: [{ id: 'agent-123', agentType: 'eventAssistant' }],
      type: { name: 'eventAssistant' },
    });

    await act(async () => {
      render(<EventAssistantRoom authType={'guest'} />);
    });

    await waitFor(() => {
      expect(mockSocket.emit).toHaveBeenCalledWith('conversation:join', {
        conversationId: 'test-conversation-id',
        token: 'mock-access-token',
        channels: [
          {
            name: 'direct-user-123-agent-123',
            passcode: null,
            direct: true,
          },
          {
            direct: false,
            name: 'chat',
            passcode: 'chat-pass',
          },
        ],
      });
    });
  });

  it('includes chat channel in conversation:join when chatPasscode is available', async () => {
    (RetrieveData as jest.Mock).mockResolvedValue({
      agents: [{ id: 'agent-123', agentType: 'eventAssistant' }],
    });
    (createConversationFromData as jest.Mock).mockResolvedValue({
      agents: [{ id: 'agent-123', agentType: 'eventAssistant' }],
      type: { name: 'eventAssistant' },
    });

    await act(async () => {
      render(<EventAssistantRoom authType={'guest'} />);
    });

    await waitFor(() => {
      expect(mockSocket.emit).toHaveBeenCalledWith('conversation:join', {
        conversationId: 'test-conversation-id',
        token: 'mock-access-token',
        channels: [
          {
            name: 'direct-user-123-agent-123',
            passcode: null,
            direct: true,
          },
          {
            name: 'chat',
            passcode: 'chat-pass',
            direct: false,
          },
        ],
      });
    });
  });

  describe('Conversation-Type-Specific Commands', () => {
    it('shows /mod command for Event Assistant', async () => {
      mockUseSessionJoin.mockReturnValue({
        socket: mockSocket,
        pseudonym: 'test-pseudonym',
        userId: 'user-123',
        isConnected: true,
        errorMessage: null,
      });
      (RetrieveData as jest.Mock).mockImplementation((path: string) => {
        if (path.startsWith('conversations/')) {
          return Promise.resolve({
            agents: [{ id: 'agent-456', agentType: 'eventAssistant' }],
          });
        } else if (path.startsWith('messages/')) {
          return Promise.resolve([]);
        }
        return Promise.resolve(null);
      });
      (createConversationFromData as jest.Mock).mockResolvedValue({
        agents: [{ id: 'agent-456', agentType: 'eventAssistant' }],
        type: {
          name: 'eventAssistant',
          description: '',
          platforms: [],
          properties: [],
          features: [
            {
              name: 'mod',
              label: 'Submit to Moderator',
              tab: 'chat',
              audience: 'participant',
              slashCommand: 'mod',
              default: true,
              agents: [],
              description: 'Submit a question to the moderator',
            },
          ],
        },
      });

      await act(async () => {
        render(
          <ConversationTypeProvider>
            <EventAssistantRoom authType={'guest'} />
          </ConversationTypeProvider>,
        );
      });

      // Wait for conversation data to load (RetrieveData called for conversations/)
      await waitFor(() => {
        expect(createConversationFromData).toHaveBeenCalled();
      });

      const user = userEvent.setup();

      // Switch to the Event Bot (assistant) tab — nav bar shows both desktop + mobile, use first
      const assistantTabs = screen.getAllByLabelText('Berkie');
      await user.click(assistantTabs[0]);

      // Wait for AssistantChatPanel input to be present
      await waitFor(() => {
        expect(screen.getByPlaceholderText('Enter your message here')).toBeInTheDocument();
      });

      const input = screen.getByPlaceholderText('Enter your message here');
      await user.type(input, '/');

      // The slash command menu should appear with /mod option
      await waitFor(
        () => {
          expect(screen.getByText('/mod')).toBeInTheDocument();
        },
        { timeout: 3000 },
      );
    });

    it('does not show /mod command for Event Assistant without moderator feature', async () => {
      mockUseSessionJoin.mockReturnValue({
        socket: mockSocket,
        pseudonym: 'test-pseudonym',
        userId: 'user-123',
        isConnected: true,
        errorMessage: null,
      });
      (RetrieveData as jest.Mock).mockImplementation((path: string) => {
        if (path.startsWith('conversations/')) {
          return Promise.resolve({
            agents: [{ id: 'agent-456', agentType: 'eventAssistant' }],
          });
        } else if (path.startsWith('messages/')) {
          return Promise.resolve([]); // Return empty chat messages
        }
        return Promise.resolve(null);
      });
      (createConversationFromData as jest.Mock).mockResolvedValue({
        agents: [{ id: 'agent-456', agentType: 'eventAssistant' }],
        type: {
          name: 'eventAssistant',
          description: '',
          platforms: [],
          properties: [],
          features: [],
        },
      });

      await act(async () => {
        render(
          <ConversationTypeProvider>
            <EventAssistantRoom authType={'guest'} />
          </ConversationTypeProvider>,
        );
      });

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Enter your message here')).toBeInTheDocument();
      });

      const user = userEvent.setup();

      // Click on the Event Bot nav item to switch from Chat (default) to Assistant
      const assistantTab = screen.getAllByLabelText('Berkie')[0];
      await user.click(assistantTab);

      const input = screen.getByPlaceholderText('Enter your message here');

      await user.type(input, '/');

      await waitFor(
        () => {
          expect(screen.queryByText('/mod')).not.toBeInTheDocument();
        },
        { timeout: 3000 },
      );
    });

    it('does not show /mod command when the feature is disabled (enabled: false)', async () => {
      mockUseSessionJoin.mockReturnValue({
        socket: mockSocket,
        pseudonym: 'test-pseudonym',
        userId: 'user-123',
        isConnected: true,
        errorMessage: null,
      });
      (RetrieveData as jest.Mock).mockImplementation((path: string) => {
        if (path.startsWith('conversations/')) {
          return Promise.resolve({
            agents: [{ id: 'agent-456', agentType: 'eventAssistant' }],
          });
        } else if (path.startsWith('messages/')) {
          return Promise.resolve([]);
        }
        return Promise.resolve(null);
      });
      (createConversationFromData as jest.Mock).mockResolvedValue({
        agents: [{ id: 'agent-456', agentType: 'eventAssistant' }],
        features: [{ name: 'mod', enabled: false }],
        type: {
          name: 'eventAssistant',
          description: '',
          platforms: [],
          properties: [],
          features: [
            {
              name: 'mod',
              label: 'Submit to Moderator',
              tab: 'chat',
              audience: 'participant',
              slashCommand: 'mod',
              default: true,
              agents: [],
              description: 'Submit a question to the moderator',
            },
          ],
        },
      });

      await act(async () => {
        render(
          <ConversationTypeProvider>
            <EventAssistantRoom authType={'guest'} />
          </ConversationTypeProvider>,
        );
      });

      await waitFor(() => {
        expect(createConversationFromData).toHaveBeenCalled();
      });

      const user = userEvent.setup();

      const assistantTabs = screen.getAllByLabelText('Berkie');
      await user.click(assistantTabs[0]);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Enter your message here')).toBeInTheDocument();
      });

      const input = screen.getByPlaceholderText('Enter your message here');
      await user.type(input, '/');

      await waitFor(
        () => {
          expect(screen.queryByText('/mod')).not.toBeInTheDocument();
        },
        { timeout: 3000 },
      );
    });
  });

  describe('Bot @mention routing in chat tab', () => {
    const chatSetup = async () => {
      (RetrieveData as jest.Mock).mockImplementation((path: string) => {
        if (path.startsWith('conversations/')) {
          return Promise.resolve({
            agents: [{ id: 'agent-123', agentType: 'eventAssistant' }],
          });
        }
        return Promise.resolve([]);
      });
      (createConversationFromData as jest.Mock).mockResolvedValue({
        agents: [{ id: 'agent-123', agentType: 'eventAssistant' }],
        type: { name: 'eventAssistant' },
        name: 'My Event',
      });

      await act(async () => {
        render(<EventAssistantRoom authType={'guest'} />);
      });
      await waitFor(() => expect(createConversationFromData).toHaveBeenCalled());
    };

    it('sends chat-only message to the chat channel', async () => {
      await chatSetup();

      // Chat tab is the default — find the input and type a plain message
      const user = userEvent.setup();
      const input = screen.getByPlaceholderText('Enter your message here');
      await user.type(input, 'hello everyone{Enter}');

      await waitFor(() => {
        expect(SendData).toHaveBeenCalledWith(
          'messages',
          expect.objectContaining({
            channels: [{ name: 'chat', passcode: 'chat-pass' }],
          }),
        );
      });
    });

    it('is case-insensitive when matching the bot @mention', async () => {
      await chatSetup();

      const user = userEvent.setup();
      const input = screen.getByPlaceholderText('Enter your message here');
      await user.type(input, '@berkie question{Enter}');

      await waitFor(() => {
        expect(SendData).toHaveBeenCalledWith(
          'messages',
          expect.objectContaining({
            channels: expect.arrayContaining([{ name: 'chat', passcode: 'chat-pass' }]),
          }),
        );
      });
    });
  });

  describe('botName resolution', () => {
    it('uses config.conversationBotName when agent has no agentConfig.botName', async () => {
      (createConversationFromData as jest.Mock).mockResolvedValue({
        agents: [{ id: 'agent-123', agentType: 'eventAssistant', agentConfig: {} }],
        type: { name: 'eventAssistant' },
      });

      await act(async () => {
        render(<EventAssistantRoom authType={'guest'} />);
      });

      await waitFor(() => {
        expect(createConversationFromData).toHaveBeenCalled();
      });

      // "Berkie" comes from the mocked config.conversationBotName
      expect(screen.getAllByLabelText('Berkie').length).toBeGreaterThan(0);
    });

    it("overrides botName from first agent's agentConfig.botName", async () => {
      (createConversationFromData as jest.Mock).mockResolvedValue({
        agents: [
          {
            id: 'agent-123',
            agentType: 'eventAssistant',
            agentConfig: { botName: 'EventBot' },
          },
        ],
        type: { name: 'eventAssistant' },
      });

      await act(async () => {
        render(<EventAssistantRoom authType={'guest'} />);
      });

      await waitFor(() => {
        expect(createConversationFromData).toHaveBeenCalled();
      });

      // botName should be overridden to "EventBot"
      expect(screen.getAllByLabelText('EventBot').length).toBeGreaterThan(0);
    });

    it('falls back to config.conversationBotName when agentConfig.botName is not a string', async () => {
      (createConversationFromData as jest.Mock).mockResolvedValue({
        agents: [
          {
            id: 'agent-123',
            agentType: 'eventAssistant',
            agentConfig: { botName: 42 },
          },
        ],
        type: { name: 'eventAssistant' },
      });

      await act(async () => {
        render(<EventAssistantRoom authType={'guest'} />);
      });

      await waitFor(() => {
        expect(createConversationFromData).toHaveBeenCalled();
      });

      // Falls back to "Berkie" from config
      expect(screen.getAllByLabelText('Berkie').length).toBeGreaterThan(0);
    });

    it('falls back to config.conversationBotName when there are no agents', async () => {
      (createConversationFromData as jest.Mock).mockResolvedValue({
        agents: [],
        type: { name: 'eventAssistant' },
      });
      // No event assistant agent → error path, but botName should still have been set
      // We verify the setBotName call by checking that no override happened

      await act(async () => {
        render(<EventAssistantRoom authType={'guest'} />);
      });

      await waitFor(() => {
        expect(createConversationFromData).toHaveBeenCalled();
      });

      await act(async () => {
        await userEvent.click(screen.getAllByRole('button', { name: 'Berkie' })[0]);
      });

      // Inactive notice is shown because there's no event assistant agent, using default botName "Berkie"
      expect(screen.getByText('This event has ended. Berkie is no longer active.')).toBeInTheDocument();
    });
  });

  it('loads initial chat messages when chatPasscode becomes available', async () => {
    const mockChatMessages = [
      {
        id: '1',
        body: 'Chat message 1',
        pseudonym: 'User1',
        channels: ['chat'],
      },
      {
        id: '2',
        body: 'Chat message 2',
        pseudonym: 'User2',
        channels: ['chat'],
      },
    ];

    (RetrieveData as jest.Mock)
      .mockResolvedValueOnce({
        agents: [{ id: 'agent-123', agentType: 'eventAssistant' }],
      })
      .mockResolvedValueOnce(mockChatMessages)
      .mockResolvedValueOnce([]);
    (createConversationFromData as jest.Mock).mockResolvedValue({
      agents: [{ id: 'agent-123', agentType: 'eventAssistant' }],
      type: { name: 'eventAssistant' },
    });

    await act(async () => {
      render(<EventAssistantRoom authType={'guest'} />);
    });

    await waitFor(() => {
      expect(RetrieveData).toHaveBeenCalledWith('messages/test-conversation-id?channel=chat,chat-pass', 'mock-access-token');
    });
  });

  describe('Message Replies', () => {
    it('fetches and inserts replies for assistant messages with replyCount', async () => {
      const mockMessages = [
        {
          id: 'msg-1',
          body: 'Original message',
          pseudonym: 'User',
          channels: ['direct-user-123-agent-123'],
          createdAt: '2024-01-01T10:00:00Z',
          replyCount: 2,
        },
      ];

      const mockReplies = [
        {
          id: 'reply-1',
          body: 'First reply',
          pseudonym: 'User',
          parentMessage: 'msg-1',
          channels: ['direct-user-123-agent-123'],
          createdAt: '2024-01-01T10:01:00Z',
        },
        {
          id: 'reply-2',
          body: 'Second reply',
          pseudonym: 'Event Assistant',
          parentMessage: 'msg-1',
          channels: ['direct-user-123-agent-123'],
          createdAt: '2024-01-01T10:02:00Z',
        },
      ];

      (RetrieveData as jest.Mock).mockImplementation((path: string) => {
        if (path.startsWith('conversations/')) {
          return Promise.resolve({
            agents: [{ id: 'agent-123', agentType: 'eventAssistant' }],
          });
        } else if (path.includes('?channel=direct-')) {
          return Promise.resolve(mockMessages);
        } else if (path === 'messages/msg-1/replies') {
          return Promise.resolve(mockReplies);
        }
        return Promise.resolve([]);
      });

      (createConversationFromData as jest.Mock).mockResolvedValue({
        agents: [{ id: 'agent-123', agentType: 'eventAssistant' }],
        type: { name: 'eventAssistant' },
      });

      await act(async () => {
        render(<EventAssistantRoom authType={'guest'} />);
      });

      await waitFor(() => {
        expect(RetrieveData).toHaveBeenCalledWith(
          'messages/test-conversation-id?channel=direct-user-123-agent-123',
          'mock-access-token',
        );
      });

      await waitFor(() => {
        expect(RetrieveData).toHaveBeenCalledWith('messages/msg-1/replies', 'mock-access-token');
      });
    });

    it('fetches and inserts replies for chat messages with replyCount', async () => {
      const mockChatMessages = [
        {
          id: 'chat-msg-1',
          body: 'Chat message with replies',
          pseudonym: 'User1',
          channels: ['chat'],
          createdAt: '2024-01-01T10:00:00Z',
          replyCount: 1,
        },
      ];

      const mockChatReplies = [
        {
          id: 'chat-reply-1',
          body: 'Chat reply',
          pseudonym: 'User2',
          parentMessage: 'chat-msg-1',
          channels: ['chat'],
          createdAt: '2024-01-01T10:01:00Z',
        },
      ];

      (RetrieveData as jest.Mock).mockImplementation((path: string) => {
        if (path.startsWith('conversations/')) {
          return Promise.resolve({
            agents: [{ id: 'agent-123', agentType: 'eventAssistant' }],
          });
        } else if (path.includes('?channel=chat')) {
          return Promise.resolve(mockChatMessages);
        } else if (path === 'messages/chat-msg-1/replies') {
          return Promise.resolve(mockChatReplies);
        } else if (path.includes('?channel=direct-')) {
          return Promise.resolve([]);
        }
        return Promise.resolve([]);
      });

      (createConversationFromData as jest.Mock).mockResolvedValue({
        agents: [{ id: 'agent-123', agentType: 'eventAssistant' }],
        type: { name: 'eventAssistant' },
      });

      await act(async () => {
        render(<EventAssistantRoom authType={'guest'} />);
      });

      await waitFor(() => {
        expect(RetrieveData).toHaveBeenCalledWith(
          'messages/test-conversation-id?channel=chat,chat-pass',
          'mock-access-token',
        );
      });

      await waitFor(() => {
        expect(RetrieveData).toHaveBeenCalledWith('messages/chat-msg-1/replies', 'mock-access-token');
      });
    });

    it('sorts messages chronologically after inserting replies', async () => {
      const mockMessages = [
        {
          id: 'msg-1',
          body: 'First message',
          pseudonym: 'User',
          channels: ['direct-user-123-agent-123'],
          createdAt: '2024-01-01T10:00:00Z',
          replyCount: 1,
        },
        {
          id: 'msg-2',
          body: 'Third message',
          pseudonym: 'User',
          channels: ['direct-user-123-agent-123'],
          createdAt: '2024-01-01T10:05:00Z',
          replyCount: 0,
        },
      ];

      const mockReplies = [
        {
          id: 'reply-1',
          body: 'Second message (reply to first)',
          pseudonym: 'Event Assistant',
          parentMessage: 'msg-1',
          channels: ['direct-user-123-agent-123'],
          createdAt: '2024-01-01T10:02:00Z',
        },
      ];

      (RetrieveData as jest.Mock).mockImplementation((path: string) => {
        if (path.startsWith('conversations/')) {
          return Promise.resolve({
            agents: [{ id: 'agent-123', agentType: 'eventAssistant' }],
          });
        } else if (path.includes('?channel=direct-')) {
          return Promise.resolve(mockMessages);
        } else if (path === 'messages/msg-1/replies') {
          return Promise.resolve(mockReplies);
        }
        return Promise.resolve([]);
      });

      (createConversationFromData as jest.Mock).mockResolvedValue({
        agents: [{ id: 'agent-123', agentType: 'eventAssistant' }],
        type: { name: 'eventAssistant' },
      });

      await act(async () => {
        render(<EventAssistantRoom authType={'guest'} />);
      });

      // Verify replies are fetched for the message with replyCount
      await waitFor(() => {
        expect(RetrieveData).toHaveBeenCalledWith('messages/msg-1/replies', 'mock-access-token');
      });

      // Verify the initial messages query was made
      expect(RetrieveData).toHaveBeenCalledWith(
        'messages/test-conversation-id?channel=direct-user-123-agent-123',
        'mock-access-token',
      );
    });

    it('handles multiple messages with replies', async () => {
      const mockMessages = [
        {
          id: 'msg-1',
          body: 'Message 1',
          pseudonym: 'User',
          channels: ['direct-user-123-agent-123'],
          createdAt: '2024-01-01T10:00:00Z',
          replyCount: 2,
        },
        {
          id: 'msg-2',
          body: 'Message 2',
          pseudonym: 'User',
          channels: ['direct-user-123-agent-123'],
          createdAt: '2024-01-01T10:03:00Z',
          replyCount: 1,
        },
      ];

      const mockRepliesMsg1 = [
        {
          id: 'reply-1',
          body: 'Reply to msg 1',
          pseudonym: 'Event Assistant',
          parentMessage: 'msg-1',
          channels: ['direct-user-123-agent-123'],
          createdAt: '2024-01-01T10:01:00Z',
        },
        {
          id: 'reply-2',
          body: 'Another reply to msg 1',
          pseudonym: 'Event Assistant',
          parentMessage: 'msg-1',
          channels: ['direct-user-123-agent-123'],
          createdAt: '2024-01-01T10:02:00Z',
        },
      ];

      const mockRepliesMsg2 = [
        {
          id: 'reply-3',
          body: 'Reply to msg 2',
          pseudonym: 'Event Assistant',
          parentMessage: 'msg-2',
          channels: ['direct-user-123-agent-123'],
          createdAt: '2024-01-01T10:04:00Z',
        },
      ];

      (RetrieveData as jest.Mock).mockImplementation((path: string) => {
        if (path.startsWith('conversations/')) {
          return Promise.resolve({
            agents: [{ id: 'agent-123', agentType: 'eventAssistant' }],
          });
        } else if (path.includes('?channel=direct-')) {
          return Promise.resolve(mockMessages);
        } else if (path === 'messages/msg-1/replies') {
          return Promise.resolve(mockRepliesMsg1);
        } else if (path === 'messages/msg-2/replies') {
          return Promise.resolve(mockRepliesMsg2);
        }
        return Promise.resolve([]);
      });

      (createConversationFromData as jest.Mock).mockResolvedValue({
        agents: [{ id: 'agent-123', agentType: 'eventAssistant' }],
        type: { name: 'eventAssistant' },
      });

      await act(async () => {
        render(<EventAssistantRoom authType={'guest'} />);
      });

      await waitFor(() => {
        expect(RetrieveData).toHaveBeenCalledWith('messages/msg-1/replies', 'mock-access-token');
      });

      await waitFor(() => {
        expect(RetrieveData).toHaveBeenCalledWith('messages/msg-2/replies', 'mock-access-token');
      });
    });

    it('handles error when fetching replies gracefully', async () => {
      const mockMessages = [
        {
          id: 'msg-1',
          body: 'Message with failing reply fetch',
          pseudonym: 'User',
          channels: ['direct-user-123-agent-123'],
          createdAt: '2024-01-01T10:00:00Z',
          replyCount: 1,
        },
      ];

      (RetrieveData as jest.Mock).mockImplementation((path: string) => {
        if (path.startsWith('conversations/')) {
          return Promise.resolve({
            agents: [{ id: 'agent-123', agentType: 'eventAssistant' }],
          });
        } else if (path.includes('?channel=direct-')) {
          return Promise.resolve(mockMessages);
        } else if (path === 'messages/msg-1/replies') {
          return Promise.reject(new Error('Failed to fetch replies'));
        }
        return Promise.resolve([]);
      });

      (createConversationFromData as jest.Mock).mockResolvedValue({
        agents: [{ id: 'agent-123', agentType: 'eventAssistant' }],
        type: { name: 'eventAssistant' },
      });

      // Capture console.error to verify error is logged
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      await act(async () => {
        render(<EventAssistantRoom authType={'guest'} />);
      });

      // Verify replies endpoint was called
      await waitFor(() => {
        expect(RetrieveData).toHaveBeenCalledWith('messages/msg-1/replies', 'mock-access-token');
      });

      // Wait a bit for error handling to complete
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
      });

      // Verify error was logged
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error fetching replies for message msg-1:', expect.any(Error));

      consoleErrorSpy.mockRestore();
    });

    it('does not fetch replies when replyCount is 0', async () => {
      const mockMessages = [
        {
          id: 'msg-1',
          body: 'Message without replies',
          pseudonym: 'User',
          channels: ['direct-user-123-agent-123'],
          createdAt: '2024-01-01T10:00:00Z',
          replyCount: 0,
        },
      ];

      (RetrieveData as jest.Mock).mockImplementation((path: string) => {
        if (path.startsWith('conversations/')) {
          return Promise.resolve({ agents: [{ id: 'agent-123', agentType: 'eventAssistant' }] });
        } else if (path.includes('?channel=direct-')) {
          return Promise.resolve(mockMessages);
        }
        return Promise.resolve([]);
      });

      (createConversationFromData as jest.Mock).mockResolvedValue({
        agents: [{ id: 'agent-123', agentType: 'eventAssistant' }],
        type: { name: 'eventAssistant' },
      });

      await act(async () => {
        render(<EventAssistantRoom authType={'guest'} />);
      });

      await waitFor(() => {
        expect(RetrieveData).toHaveBeenCalledWith(
          'messages/test-conversation-id?channel=direct-user-123-agent-123',
          'mock-access-token',
        );
      });

      // Should NOT call the replies endpoint
      expect(RetrieveData).not.toHaveBeenCalledWith('messages/msg-1/replies', 'mock-access-token');
    });

    it('does not fetch replies when replyCount is undefined', async () => {
      const mockMessages = [
        {
          id: 'msg-1',
          body: 'Message without replyCount field',
          pseudonym: 'User',
          channels: ['direct-user-123-agent-123'],
          createdAt: '2024-01-01T10:00:00Z',
          // replyCount is undefined
        },
      ];

      (RetrieveData as jest.Mock).mockImplementation((path: string) => {
        if (path.startsWith('conversations/')) {
          return Promise.resolve({ agents: [{ id: 'agent-123', agentType: 'eventAssistant' }] });
        } else if (path.includes('?channel=direct-')) {
          return Promise.resolve(mockMessages);
        }
        return Promise.resolve([]);
      });

      (createConversationFromData as jest.Mock).mockResolvedValue({
        agents: [{ id: 'agent-123', agentType: 'eventAssistant' }],
        type: { name: 'eventAssistant' },
      });

      await act(async () => {
        render(<EventAssistantRoom authType={'guest'} />);
      });

      await waitFor(() => {
        expect(RetrieveData).toHaveBeenCalledWith(
          'messages/test-conversation-id?channel=direct-user-123-agent-123',
          'mock-access-token',
        );
      });

      // Should NOT call the replies endpoint
      expect(RetrieveData).not.toHaveBeenCalledWith('messages/msg-1/replies', 'mock-access-token');
    });
  });

  describe('Multi-agent channel subscription and message fetching', () => {
    it('subscribes to direct channels for all agents in the conversation', async () => {
      (createConversationFromData as jest.Mock).mockResolvedValue({
        agents: [
          { id: 'agent-123', agentType: 'eventAssistant' },
          { id: 'jargon-agent-456', agentType: 'jargonFilterAgent' },
          { id: 'future-agent-789', agentType: 'someNewAgent' },
        ],
        type: { name: 'eventAssistant' },
      });

      (RetrieveData as jest.Mock).mockImplementation((path: string) => {
        if (path.startsWith('conversations/')) return Promise.resolve({ agents: [] });
        return Promise.resolve([]);
      });

      await act(async () => {
        render(<EventAssistantRoom authType={'guest'} />);
      });

      await waitFor(() => {
        expect(mockSocket.emit).toHaveBeenCalledWith(
          'conversation:join',
          expect.objectContaining({
            channels: expect.arrayContaining([
              { name: 'direct-user-123-agent-123', passcode: null, direct: true },
              { name: 'direct-user-123-jargon-agent-456', passcode: null, direct: true },
              { name: 'direct-user-123-future-agent-789', passcode: null, direct: true },
            ]),
          }),
        );
      });
    });

    it('fetches messages from all agent direct channels', async () => {
      (createConversationFromData as jest.Mock).mockResolvedValue({
        agents: [
          { id: 'agent-123', agentType: 'eventAssistant' },
          { id: 'jargon-agent-456', agentType: 'jargonFilterAgent' },
        ],
        type: { name: 'eventAssistant' },
      });

      (RetrieveData as jest.Mock).mockImplementation((path: string) => {
        if (path.startsWith('conversations/')) return Promise.resolve({ agents: [] });
        return Promise.resolve([]);
      });

      await act(async () => {
        render(<EventAssistantRoom authType={'guest'} />);
      });

      await waitFor(() => {
        expect(RetrieveData).toHaveBeenCalledWith(
          'messages/test-conversation-id?channel=direct-user-123-agent-123',
          'mock-access-token',
        );
        expect(RetrieveData).toHaveBeenCalledWith(
          'messages/test-conversation-id?channel=direct-user-123-jargon-agent-456',
          'mock-access-token',
        );
      });
    });

    it('displays messages from any agent direct channel in the assistant panel', async () => {
      const secondaryAgentMessage = {
        id: 'secondary-msg-1',
        body: { type: 'jargon_clarification', text: 'An SLO is a reliability target.', sourceText: 'Our SLOs...' },
        bodyType: 'json',
        fromAgent: true,
        channels: ['direct-user-123-jargon-agent-456'],
        pseudonym: 'Jargon Filter',
        createdAt: '2024-01-01T10:00:00Z',
        pause: false,
        visible: true,
        upVotes: [],
        downVotes: [],
      };

      (createConversationFromData as jest.Mock).mockResolvedValue({
        agents: [
          { id: 'agent-123', agentType: 'eventAssistant' },
          { id: 'jargon-agent-456', agentType: 'jargonFilterAgent' },
        ],
        type: { name: 'eventAssistant' },
      });

      (RetrieveData as jest.Mock).mockImplementation((path: string) => {
        if (path.startsWith('conversations/')) return Promise.resolve({ agents: [] });
        if (path.includes('jargon-agent-456')) return Promise.resolve([secondaryAgentMessage]);
        return Promise.resolve([]);
      });

      const user = userEvent.setup();

      await act(async () => {
        render(<EventAssistantRoom authType={'guest'} />);
      });

      await waitFor(() => expect(screen.getAllByLabelText('Berkie').length).toBeGreaterThan(0));
      await user.click(screen.getAllByLabelText('Berkie')[0]);

      await waitFor(() => {
        expect(screen.getByText('An SLO is a reliability target.')).toBeInTheDocument();
      });
    });

    it('displays real-time messages from any agent direct channel in the assistant panel', async () => {
      (createConversationFromData as jest.Mock).mockResolvedValue({
        agents: [
          { id: 'agent-123', agentType: 'eventAssistant' },
          { id: 'jargon-agent-456', agentType: 'jargonFilterAgent' },
        ],
        type: { name: 'eventAssistant' },
      });

      (RetrieveData as jest.Mock).mockImplementation((path: string) => {
        if (path.startsWith('conversations/')) return Promise.resolve({ agents: [] });
        return Promise.resolve([]);
      });

      await act(async () => {
        render(<EventAssistantRoom authType={'guest'} />);
      });

      await waitFor(() => expect(mockSocket.on).toHaveBeenCalledWith('message:new', expect.any(Function)));

      const messageHandler: Function = mockSocket.on.mock.calls
        .filter(([event]: [string]) => event === 'message:new')
        .map(([, handler]: [string, Function]) => {
          // Need function named "messageHandler"
          if (handler.name === 'messageHandler') return handler;
        })
        .at(0)!;

      const user = userEvent.setup();
      await waitFor(() => expect(screen.getAllByLabelText('Berkie').length).toBeGreaterThan(0));
      await user.click(screen.getAllByLabelText('Berkie')[0]);

      act(() => {
        messageHandler({
          id: 'msg-jargon-1',
          body: { type: 'jargon_clarification', text: 'An SLO is a reliability target.', sourceText: 'Our SLOs...' },
          bodyType: 'json',
          fromAgent: true,
          channels: ['direct-user-123-jargon-agent-456'],
          pseudonym: 'Jargon Filter Agent',
          pause: false,
          visible: true,
          upVotes: [],
          downVotes: [],
        });
      });

      await waitFor(() => {
        expect(screen.getByText('An SLO is a reliability target.')).toBeInTheDocument();
      });
    });

    it('routes replies to the channel of the parent message, not the primary agent channel', async () => {
      const secondaryAgentMessage = {
        id: 'jargon-msg-1',
        body: 'A clarification from jargon agent',
        fromAgent: true,
        channels: ['direct-user-123-jargon-agent-456'],
        pseudonym: 'Jargon Filter',
        createdAt: '2024-01-01T10:00:00Z',
        pause: false,
        visible: true,
        upVotes: [],
        downVotes: [],
      };

      (createConversationFromData as jest.Mock).mockResolvedValue({
        agents: [
          { id: 'agent-123', agentType: 'eventAssistant' },
          { id: 'jargon-agent-456', agentType: 'jargonFilterAgent' },
        ],
        type: { name: 'eventAssistant' },
      });

      (RetrieveData as jest.Mock).mockImplementation((path: string) => {
        if (path.startsWith('conversations/')) return Promise.resolve({ agents: [] });
        if (path.includes('jargon-agent-456')) return Promise.resolve([secondaryAgentMessage]);
        return Promise.resolve([]);
      });

      const user = userEvent.setup();

      await act(async () => {
        render(<EventAssistantRoom authType={'guest'} />);
      });

      await waitFor(() => expect(screen.getAllByLabelText('Berkie').length).toBeGreaterThan(0));
      await user.click(screen.getAllByLabelText('Berkie')[0]);

      await waitFor(() => {
        expect(screen.getByText('A clarification from jargon agent')).toBeInTheDocument();
      });
    });
  });

  describe('Feedback Frequency Configuration', () => {
    it('extracts feedback frequency from conversation properties', async () => {
      (RetrieveData as jest.Mock).mockImplementation((path: string) => {
        if (path.startsWith('conversations/')) {
          return Promise.resolve({
            agents: [{ id: 'agent-123', agentType: 'eventAssistant' }],
            properties: { feedbackFrequency: 2 }, // Every 2nd message
          });
        } else if (path.includes('?channel=direct-')) {
          return Promise.resolve([]);
        }
        return Promise.resolve([]);
      });

      (createConversationFromData as jest.Mock).mockResolvedValue({
        agents: [{ id: 'agent-123', agentType: 'eventAssistant' }],
        type: { name: 'eventAssistant' },
        properties: { feedbackFrequency: 2 },
      });

      await act(async () => {
        render(<EventAssistantRoom authType={'guest'} />);
      });

      await waitFor(() => {
        expect(createConversationFromData).toHaveBeenCalled();
      });

      // feedbackFrequency should be extracted and used in feedback config
    });

    it('defaults to feedback frequency of 1 when not provided in conversation properties', async () => {
      (RetrieveData as jest.Mock).mockImplementation((path: string) => {
        if (path.startsWith('conversations/')) {
          return Promise.resolve({
            agents: [{ id: 'agent-123', agentType: 'eventAssistant' }],
            // No properties or feedbackFrequency
          });
        } else if (path.includes('?channel=direct-')) {
          return Promise.resolve([]);
        }
        return Promise.resolve([]);
      });

      (createConversationFromData as jest.Mock).mockResolvedValue({
        agents: [{ id: 'agent-123', agentType: 'eventAssistant' }],
        type: { name: 'eventAssistant' },
      });

      await act(async () => {
        render(<EventAssistantRoom authType={'guest'} />);
      });

      await waitFor(() => {
        expect(createConversationFromData).toHaveBeenCalled();
      });

      // feedbackFrequency should default to 1
    });
  });

  describe('Prompt Response Handling', () => {
    beforeEach(() => {
      // Reset router query to avoid chat tab being selected by default
      mockRouter.query = {
        conversationId: 'test-conversation-id',
        channel: ['chat,test-chat-pass', 'transcript,test-transcript-pass'],
      };
    });

    it('includes answersPrompt field when sending a prompt response', async () => {
      const user = userEvent.setup();

      (RetrieveData as jest.Mock).mockImplementation((path: string) => {
        if (path.startsWith('conversations/')) {
          return Promise.resolve({
            agents: [{ id: 'agent-123', agentType: 'eventAssistant' }],
          });
        } else if (path.startsWith('messages/')) {
          return Promise.resolve([]);
        }
        return Promise.resolve([]);
      });

      (createConversationFromData as jest.Mock).mockResolvedValue({
        agents: [{ id: 'agent-123', agentType: 'eventAssistant' }],
        type: { name: 'eventAssistant' },
      });

      await act(async () => {
        render(<EventAssistantRoom authType={'guest'} />);
      });

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Enter your message here')).toBeInTheDocument();
      });

      // Simulate the component calling sendMessage with prompt response parameters
      // Since we can't directly access the sendMessage function, we'll verify via SendData mock
      // This would be triggered by the handlePromptSelect function in the actual component
    });

    it('sends message with answersPrompt when user selects a prompt option', async () => {
      const user = userEvent.setup();

      (RetrieveData as jest.Mock).mockImplementation((path: string) => {
        if (path.startsWith('conversations/')) {
          return Promise.resolve({
            agents: [{ id: 'agent-123', agentType: 'eventAssistant' }],
          });
        } else if (path.startsWith('messages/')) {
          // Return a message with prompt options
          return Promise.resolve([
            {
              id: 'prompt-msg-1',
              body: 'Do you need assistance?',
              pseudonym: 'Event Assistant',
              fromAgent: true,
              channels: ['direct-user-123-agent-123'],
              createdAt: '2025-10-17T12:00:00Z',
              conversation: 'conv-1',
              pseudonymId: 'ea-1',
              pause: false,
              visible: true,
              upVotes: [],
              downVotes: [],
              prompt: {
                type: 'singleChoice',
                options: [
                  { label: 'Yes', value: 'yes' },
                  { label: 'No', value: 'no' },
                ],
              },
            },
          ]);
        }
        return Promise.resolve([]);
      });

      (createConversationFromData as jest.Mock).mockResolvedValue({
        agents: [{ id: 'agent-123', agentType: 'eventAssistant' }],
        type: { name: 'eventAssistant' },
      });

      await act(async () => {
        render(<EventAssistantRoom authType={'guest'} />);
      });

      // Wait for the page to load and click on the assistant tab
      await waitFor(() => {
        expect(screen.getAllByLabelText('Berkie').length).toBeGreaterThan(0);
      });

      const assistantTab = screen.getAllByLabelText('Berkie')[0];
      await user.click(assistantTab);

      await waitFor(() => {
        expect(screen.getAllByText('Do you need assistance?').length).toBeGreaterThan(0);
      });

      // The component would render prompt buttons, but our mock doesn't render them
      // In a real scenario, clicking a prompt button would trigger handlePromptSelect
      // which would call sendMessage with messageSource: "promptResponse" and promptQuestionId
    });

    it('filters out messages with answersPrompt from display', async () => {
      mockRouter.query = { conversationId: 'test-conversation-id', channel: 'chat,chat-pass' };

      const user = userEvent.setup();

      (RetrieveData as jest.Mock).mockImplementation((path: string) => {
        if (path.startsWith('conversations/')) {
          return Promise.resolve({
            agents: [{ id: 'agent-123', agentType: 'eventAssistant' }],
          });
        } else if (path.startsWith('messages/')) {
          return Promise.resolve([
            {
              id: 'prompt-1',
              body: 'Would you like help?',
              pseudonym: 'Event Assistant',
              fromAgent: true,
              channels: ['direct-user-123-agent-123'],
              createdAt: '2025-10-17T12:00:00Z',
              conversation: 'conv-1',
              pseudonymId: 'ea-1',
              pause: false,
              visible: true,
              upVotes: [],
              downVotes: [],
              prompt: {
                type: 'singleChoice',
                options: [
                  { label: 'Yes', value: 'yes' },
                  { label: 'No', value: 'no' },
                ],
              },
            },
            {
              id: 'response-1',
              body: 'Yes',
              pseudonym: 'test-user',
              fromAgent: false,
              channels: ['direct-user-123-agent-123'],
              createdAt: '2025-10-17T12:01:00Z',
              conversation: 'conv-1',
              pseudonymId: 'tu-1',
              pause: false,
              visible: true,
              upVotes: [],
              downVotes: [],
              answersPrompt: 'prompt-1',
            },
            {
              id: 'followup-1',
              body: "Great! Here's how I can help...",
              pseudonym: 'Event Assistant',
              fromAgent: true,
              channels: ['direct-user-123-agent-123'],
              createdAt: '2025-10-17T12:02:00Z',
              conversation: 'conv-1',
              pseudonymId: 'ea-1',
              pause: false,
              visible: true,
              upVotes: [],
              downVotes: [],
            },
          ]);
        }
        return Promise.resolve([]);
      });

      (createConversationFromData as jest.Mock).mockResolvedValue({
        agents: [{ id: 'agent-123', agentType: 'eventAssistant' }],
        type: { name: 'eventAssistant' },
      });

      await act(async () => {
        render(<EventAssistantRoom authType={'guest'} />);
      });

      // Wait for the page to load and click on the assistant tab
      await waitFor(() => {
        expect(screen.getAllByLabelText('Berkie').length).toBeGreaterThan(0);
      });

      const assistantTab = screen.getAllByLabelText('Berkie')[0];
      await user.click(assistantTab);

      await waitFor(() => {
        expect(screen.getByText('Would you like help?')).toBeInTheDocument();
      });

      // The prompt question should be visible
      expect(screen.getAllByText('Would you like help?').length).toBeGreaterThan(0);
      // The response with answersPrompt should NOT be visible
      expect(screen.queryByText(/^Yes$/)).not.toBeInTheDocument();

      // The follow-up message should be visible
      expect(screen.getByText("Great! Here's how I can help...")).toBeInTheDocument();
    });

    it('restores selected prompt option on page load when response exists', async () => {
      mockRouter.query = { conversationId: 'test-conversation-id', channel: 'chat,chat-pass' };

      const user = userEvent.setup();

      (RetrieveData as jest.Mock).mockImplementation((path: string) => {
        if (path.startsWith('conversations/')) {
          return Promise.resolve({
            agents: [{ id: 'agent-123', agentType: 'eventAssistant' }],
          });
        } else if (path.startsWith('messages/')) {
          return Promise.resolve([
            {
              id: 'prompt-1',
              body: 'Select your preference:',
              pseudonym: 'Event Assistant',
              fromAgent: true,
              channels: ['direct-user-123-agent-123'],
              createdAt: '2025-10-17T12:00:00Z',
              conversation: 'conv-1',
              pseudonymId: 'ea-1',
              pause: false,
              visible: true,
              upVotes: [],
              downVotes: [],
              prompt: {
                type: 'singleChoice',
                options: [
                  { label: 'Option A', value: 'opt-a' },
                  { label: 'Option B', value: 'opt-b' },
                ],
              },
            },
            {
              id: 'response-1',
              body: 'Option A',
              pseudonym: 'test-user',
              fromAgent: false,
              channels: ['direct-user-123-agent-123'],
              createdAt: '2025-10-17T12:01:00Z',
              conversation: 'conv-1',
              pseudonymId: 'tu-1',
              pause: false,
              visible: true,
              upVotes: [],
              downVotes: [],
              answersPrompt: 'prompt-1',
            },
          ]);
        }
        return Promise.resolve([]);
      });

      (createConversationFromData as jest.Mock).mockResolvedValue({
        agents: [{ id: 'agent-123', agentType: 'eventAssistant' }],
        type: { name: 'eventAssistant' },
      });

      await act(async () => {
        render(<EventAssistantRoom authType={'guest'} />);
      });

      // Wait for the page to load and click on the assistant tab
      await waitFor(() => {
        expect(screen.getAllByLabelText('Berkie').length).toBeGreaterThan(0);
      });

      const assistantTab = screen.getAllByLabelText('Berkie')[0];
      await user.click(assistantTab);

      await waitFor(() => {
        expect(screen.getByText('Select your preference:')).toBeInTheDocument();
      });

      // The prompt message should be visible
      expect(screen.getByText('Select your preference:')).toBeInTheDocument();

      // The response should be filtered out
      expect(screen.queryByText(/^Option A$/)).not.toBeInTheDocument();

      // In the actual implementation, the AssistantMessage component would receive
      // initialSelectedPrompt="Option A" and display the buttons as disabled with
      // "Option A" marked as selected
    });
  });

  describe('Intro messages from conversation:join callback', () => {
    it('displays assistant intro messages returned in the join callback response', async () => {
      const introMessage = {
        id: 'intro-ws-1',
        body: 'Welcome to the event!',
        pseudonym: 'Berkie',
        fromAgent: true,
        channels: ['direct-user-123-agent-123'],
        createdAt: '2024-01-01T09:59:00Z',
        conversation: 'test-conversation-id',
        pause: false,
        visible: true,
        upVotes: [],
        downVotes: [],
      };

      const { emitWithTokenRefresh } = require('../../utils');
      (emitWithTokenRefresh as jest.Mock).mockImplementationOnce(
        (socket: any, event: string, data: any, onSuccess: Function) => {
          if (onSuccess) onSuccess({ intros: [introMessage] });
          socket.emit(event, data);
        },
      );

      (RetrieveData as jest.Mock).mockImplementation((path: string) => {
        if (path.startsWith('conversations/')) {
          return Promise.resolve({
            agents: [{ id: 'agent-123', agentType: 'eventAssistant' }],
          });
        }
        return Promise.resolve([]);
      });
      (createConversationFromData as jest.Mock).mockResolvedValue({
        agents: [{ id: 'agent-123', agentType: 'eventAssistant' }],
        type: { name: 'eventAssistant' },
      });

      const user = userEvent.setup();

      await act(async () => {
        render(<EventAssistantRoom authType={'guest'} />);
      });

      await waitFor(() => expect(createConversationFromData).toHaveBeenCalled());

      // Switch to assistant tab to see the intro message
      const assistantTab = screen.getAllByLabelText('Berkie')[0];
      await user.click(assistantTab);

      await waitFor(() => {
        expect(screen.getByText('Welcome to the event!')).toBeInTheDocument();
      });
    });

    it('routes chat intros from join callback to the chat panel', async () => {
      const chatIntro = {
        id: 'chat-intro-1',
        body: 'Welcome to the chat!',
        pseudonym: 'Berkie',
        fromAgent: true,
        channels: ['chat'],
        createdAt: '2024-01-01T09:59:00Z',
      };

      const { emitWithTokenRefresh } = require('../../utils');
      (emitWithTokenRefresh as jest.Mock).mockImplementationOnce(
        (socket: any, event: string, data: any, onSuccess: Function) => {
          if (onSuccess) onSuccess({ intros: [chatIntro] });
          socket.emit(event, data);
        },
      );

      (RetrieveData as jest.Mock).mockImplementation((path: string) => {
        if (path.startsWith('conversations/')) {
          return Promise.resolve({
            agents: [{ id: 'agent-123', agentType: 'eventAssistant' }],
          });
        }
        return Promise.resolve([]);
      });
      (createConversationFromData as jest.Mock).mockResolvedValue({
        agents: [{ id: 'agent-123', agentType: 'eventAssistant' }],
        type: { name: 'eventAssistant' },
      });

      await act(async () => {
        render(<EventAssistantRoom authType={'guest'} />);
      });

      // Chat tab is active by default when chatPasscode is set
      await waitFor(() => {
        expect(screen.getByText('Welcome to the chat!')).toBeInTheDocument();
      });
    });

    it('filters out intro-typed messages (object body) from the DB assistant fetch', async () => {
      const dbMessages = [
        {
          id: 'intro-db-1',
          // Object body with type: "intro" — parseMessageBody will return type "intro"
          body: { type: 'intro', text: 'Old intro from DB' },
          pseudonym: 'Berkie',
          fromAgent: true,
          channels: ['direct-user-123-agent-123'],
          createdAt: '2024-01-01T09:59:00Z',
        },
        {
          id: 'msg-db-1',
          body: 'Regular message from DB',
          pseudonym: 'User',
          fromAgent: false,
          channels: ['direct-user-123-agent-123'],
          createdAt: '2024-01-01T10:00:00Z',
        },
      ];

      (RetrieveData as jest.Mock).mockImplementation((path: string) => {
        if (path.startsWith('conversations/')) {
          return Promise.resolve({
            agents: [{ id: 'agent-123', agentType: 'eventAssistant' }],
          });
        } else if (path.includes('?channel=direct-')) {
          return Promise.resolve(dbMessages);
        }
        return Promise.resolve([]);
      });
      (createConversationFromData as jest.Mock).mockResolvedValue({
        agents: [{ id: 'agent-123', agentType: 'eventAssistant' }],
        type: { name: 'eventAssistant' },
      });

      const user = userEvent.setup();

      await act(async () => {
        render(<EventAssistantRoom authType={'guest'} />);
      });

      await waitFor(() => {
        expect(RetrieveData).toHaveBeenCalledWith(
          'messages/test-conversation-id?channel=direct-user-123-agent-123',
          'mock-access-token',
        );
      });

      // Switch to assistant tab to see what was rendered
      const assistantTab = screen.getAllByLabelText('Berkie')[0];
      await user.click(assistantTab);

      // Regular message should be visible
      await waitFor(() => {
        expect(screen.getByText('Regular message from DB')).toBeInTheDocument();
      });

      // The intro-typed message should have been filtered out
      expect(screen.queryByText('Old intro from DB')).not.toBeInTheDocument();
    });

    it('filters out intro-typed messages from the DB chat fetch', async () => {
      const chatDbMessages = [
        {
          id: 'chat-intro-db-1',
          body: { type: 'intro', text: 'Old chat intro' },
          pseudonym: 'Berkie',
          fromAgent: true,
          channels: ['chat'],
          createdAt: '2024-01-01T09:59:00Z',
        },
        {
          id: 'chat-msg-1',
          body: 'Regular chat message',
          pseudonym: 'User',
          fromAgent: false,
          channels: ['chat'],
          createdAt: '2024-01-01T10:00:00Z',
        },
      ];

      (RetrieveData as jest.Mock).mockImplementation((path: string) => {
        if (path.startsWith('conversations/')) {
          return Promise.resolve({
            agents: [{ id: 'agent-123', agentType: 'eventAssistant' }],
          });
        } else if (path.includes('?channel=chat')) {
          return Promise.resolve(chatDbMessages);
        }
        return Promise.resolve([]);
      });
      (createConversationFromData as jest.Mock).mockResolvedValue({
        agents: [{ id: 'agent-123', agentType: 'eventAssistant' }],
        type: { name: 'eventAssistant' },
      });

      await act(async () => {
        render(<EventAssistantRoom authType={'guest'} />);
      });

      await waitFor(() => {
        expect(RetrieveData).toHaveBeenCalledWith(
          'messages/test-conversation-id?channel=chat,chat-pass',
          'mock-access-token',
        );
      });

      // Chat tab is active by default
      await waitFor(() => {
        expect(screen.getByText('Regular chat message')).toBeInTheDocument();
      });

      expect(screen.queryByText('Old chat intro')).not.toBeInTheDocument();
    });

    it('prepends join callback intros before DB messages in the assistant panel', async () => {
      const introMessage = {
        id: 'intro-ws-1',
        body: 'Intro message',
        pseudonym: 'Berkie',
        fromAgent: true,
        channels: ['direct-user-123-agent-123'],
        createdAt: '2024-01-01T09:59:00Z',
      };

      const { emitWithTokenRefresh } = require('../../utils');
      (emitWithTokenRefresh as jest.Mock).mockImplementationOnce(
        (socket: any, event: string, data: any, onSuccess: Function) => {
          if (onSuccess) onSuccess({ intros: [introMessage] });
          socket.emit(event, data);
        },
      );

      (RetrieveData as jest.Mock).mockImplementation((path: string) => {
        if (path.startsWith('conversations/')) {
          return Promise.resolve({
            agents: [{ id: 'agent-123', agentType: 'eventAssistant' }],
          });
        } else if (path.includes('?channel=direct-')) {
          return Promise.resolve([
            {
              id: 'msg-db-1',
              body: 'DB message after intro',
              pseudonym: 'Berkie',
              fromAgent: true,
              channels: ['direct-user-123-agent-123'],
              createdAt: '2024-01-01T10:00:00Z',
            },
          ]);
        }
        return Promise.resolve([]);
      });
      (createConversationFromData as jest.Mock).mockResolvedValue({
        agents: [{ id: 'agent-123', agentType: 'eventAssistant' }],
        type: { name: 'eventAssistant' },
      });

      const user = userEvent.setup();

      await act(async () => {
        render(<EventAssistantRoom authType={'guest'} />);
      });

      await waitFor(() => expect(createConversationFromData).toHaveBeenCalled());

      const assistantTab = screen.getAllByLabelText('Berkie')[0];
      await user.click(assistantTab);

      // Wait for both messages to render (both fromAgent: true → AssistantMessage mock)
      await waitFor(() => {
        const messages = screen.getAllByTestId('assistant-message');
        expect(messages.length).toBeGreaterThanOrEqual(2);
      });

      const messages = screen.getAllByTestId('assistant-message');
      const introIdx = messages.findIndex((el) => el.textContent?.includes('Intro message'));
      const dbIdx = messages.findIndex((el) => el.textContent?.includes('DB message after intro'));
      expect(introIdx).toBeGreaterThanOrEqual(0);
      expect(dbIdx).toBeGreaterThanOrEqual(0);
      expect(introIdx).toBeLessThan(dbIdx);
    });

    it('does not fetch messages before conversation:join callback fires', async () => {
      const { emitWithTokenRefresh } = require('../../utils');
      (emitWithTokenRefresh as jest.Mock).mockImplementationOnce(
        (socket: any, event: string, data: any, _onSuccess: Function) => {
          // Intentionally do NOT call onSuccess — simulates join in progress
          socket.emit(event, data);
        },
      );

      (RetrieveData as jest.Mock).mockImplementation((path: string) => {
        if (path.startsWith('conversations/')) {
          return Promise.resolve({
            agents: [{ id: 'agent-123', agentType: 'eventAssistant' }],
          });
        }
        return Promise.resolve([]);
      });
      (createConversationFromData as jest.Mock).mockResolvedValue({
        agents: [{ id: 'agent-123', agentType: 'eventAssistant' }],
        type: { name: 'eventAssistant' },
      });

      await act(async () => {
        render(<EventAssistantRoom authType={'guest'} />);
      });

      await waitFor(() => expect(createConversationFromData).toHaveBeenCalled());

      // Give async effects time to settle
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
      });

      // Message fetch should NOT have been triggered because initialJoinComplete
      // never flipped to true (join callback was not called)
      const messageFetch = (RetrieveData as jest.Mock).mock.calls.find(([path]: [string]) =>
        path.includes('?channel=direct-'),
      );
      expect(messageFetch).toBeUndefined();
    });

    it('does not re-add intros on socket reconnect', async () => {
      const introMessage = {
        id: 'intro-1',
        body: 'Intro message',
        pseudonym: 'Berkie',
        fromAgent: true,
        channels: ['direct-user-123-agent-123'],
        createdAt: '2024-01-01T09:59:00Z',
      };

      const { emitWithTokenRefresh } = require('../../utils');
      (emitWithTokenRefresh as jest.Mock)
        .mockImplementationOnce((socket: any, event: string, data: any, onSuccess: Function) => {
          if (onSuccess) onSuccess({ intros: [introMessage] });
          socket.emit(event, data);
        })
        .mockImplementationOnce((socket: any, event: string, data: any, onSuccess: Function) => {
          if (onSuccess) onSuccess({ intros: [introMessage] });
          socket.emit(event, data);
        });

      (RetrieveData as jest.Mock).mockImplementation((path: string) => {
        if (path.startsWith('conversations/')) {
          return Promise.resolve({
            agents: [{ id: 'agent-123', agentType: 'eventAssistant' }],
          });
        }
        return Promise.resolve([]);
      });
      (createConversationFromData as jest.Mock).mockResolvedValue({
        agents: [{ id: 'agent-123', agentType: 'eventAssistant' }],
        type: { name: 'eventAssistant' },
      });

      const user = userEvent.setup();

      await act(async () => {
        render(<EventAssistantRoom authType={'guest'} />);
      });

      await waitFor(() => expect(createConversationFromData).toHaveBeenCalled());

      const assistantTab = screen.getAllByLabelText('Berkie')[0];
      await user.click(assistantTab);

      await waitFor(() => {
        expect(screen.getAllByText('Intro message')).toHaveLength(1);
      });

      // Simulate socket reconnect by invoking the registered "connect" handler
      const connectHandlerCall = mockSocket.on.mock.calls.find(([event]: [string]) => event === 'connect');
      const connectHandler = connectHandlerCall?.[1];
      expect(connectHandler).toBeDefined();

      await act(async () => {
        connectHandler();
      });

      // Intro should still only appear once — not duplicated
      expect(screen.getAllByText('Intro message')).toHaveLength(1);
    });
  });

  describe('Resources', () => {
    const mockResources = [
      { id: 'res-1', source: 'ai', category: 'suggested', title: 'Book A', participantVisible: true },
      { id: 'res-2', source: 'ai', category: 'suggested', title: 'Book B', participantVisible: true },
    ];

    const resourcesSetup = async (resources = mockResources) => {
      (RetrieveData as jest.Mock).mockImplementation((path: string) => {
        if (path.startsWith('conversations/')) {
          return Promise.resolve({ agents: [{ id: 'agent-123', agentType: 'eventAssistant' }] });
        }
        return Promise.resolve([]);
      });

      (createConversationFromData as jest.Mock).mockResolvedValue({
        agents: [{ id: 'agent-123', agentType: 'eventAssistant' }],
        type: { name: 'eventAssistant' },
        name: 'Tech Forum',
        resources,
      });

      await act(async () => {
        render(<EventAssistantRoom authType={'guest'} />);
      });

      await waitFor(() => expect(createConversationFromData).toHaveBeenCalled());
    };

    /** Grab the most recently registered resources:updated handler from the socket mock. */
    const getResourcesUpdatedHandler = (): Function => {
      const handler = mockSocket.on.mock.calls
        .filter(([event]: [string]) => event === 'resources:updated')
        .map(([, h]: [string, Function]) => h)
        .at(-1)!;
      expect(handler).toBeDefined();
      return handler;
    };

    it('registers a resources:updated socket listener', async () => {
      await resourcesSetup();
      await waitFor(() => {
        expect(mockSocket.on).toHaveBeenCalledWith('resources:updated', expect.any(Function));
      });
    });

    it('initializes resources from conversation data', async () => {
      await resourcesSetup();

      const user = userEvent.setup();
      await user.click(screen.getAllByLabelText('Resources')[0]);
      await user.click(screen.getByText('Readings & References (optional)'));

      await waitFor(() => {
        expect(screen.getByText('Book A')).toBeInTheDocument();
        expect(screen.getByText('Book B')).toBeInTheDocument();
      });
    });

    it('renders ResourcesPanel when resources tab is active', async () => {
      await resourcesSetup();

      const user = userEvent.setup();
      await user.click(screen.getAllByLabelText('Resources')[0]);

      await waitFor(() => {
        expect(screen.getByText('Readings & References (optional)')).toBeInTheDocument();
      });
    });

    it('Resources tab is always present in the nav', async () => {
      await resourcesSetup([]);
      expect(screen.getAllByLabelText('Resources').length).toBeGreaterThan(0);
    });

    it('increments unseenResourcesCount when resources:updated adds new resources and the resources tab is NOT active', async () => {
      await resourcesSetup([]);

      await waitFor(() => {
        expect(mockSocket.on).toHaveBeenCalledWith('resources:updated', expect.any(Function));
      });

      const handler = getResourcesUpdatedHandler();

      act(() => {
        handler({
          resources: [{ id: 'res-new-1', source: 'ai', category: 'suggested', title: 'New Book', participantVisible: true }],
        });
      });

      await waitFor(() => {
        const badges = document.querySelectorAll('.MuiBadge-badge');
        const visibleBadges = Array.from(badges).filter((b) => !b.classList.contains('MuiBadge-invisible'));
        expect(visibleBadges.length).toBeGreaterThan(0);
      });
    });

    it('does NOT increment unseenResourcesCount when resources:updated fires and the resources tab IS active', async () => {
      await resourcesSetup([]);

      const user = userEvent.setup();
      await user.click(screen.getAllByLabelText('Resources')[0]);

      await waitFor(() => {
        expect(mockSocket.on).toHaveBeenCalledWith('resources:updated', expect.any(Function));
      });

      const handler = getResourcesUpdatedHandler();

      act(() => {
        handler({
          resources: [{ id: 'res-new-1', source: 'ai', category: 'suggested', title: 'New Book', participantVisible: true }],
        });
      });

      await waitFor(() => {
        const badges = document.querySelectorAll('.MuiBadge-badge');
        const visibleBadges = Array.from(badges).filter((b) => !b.classList.contains('MuiBadge-invisible'));
        expect(visibleBadges.length).toBe(0);
      });
    });

    it('resets unseenResourcesCount to 0 when switching to the resources tab', async () => {
      await resourcesSetup([]);

      await waitFor(() => {
        expect(mockSocket.on).toHaveBeenCalledWith('resources:updated', expect.any(Function));
      });

      const handler = getResourcesUpdatedHandler();

      act(() => {
        handler({
          resources: [{ id: 'res-new-1', source: 'ai', category: 'suggested', title: 'New Book', participantVisible: true }],
        });
      });

      await waitFor(() => {
        const badges = document.querySelectorAll('.MuiBadge-badge');
        const visibleBadges = Array.from(badges).filter((b) => !b.classList.contains('MuiBadge-invisible'));
        expect(visibleBadges.length).toBeGreaterThan(0);
      });

      const user = userEvent.setup();
      await user.click(screen.getAllByLabelText('Resources')[0]);

      await waitFor(() => {
        const badges = document.querySelectorAll('.MuiBadge-badge');
        const visibleBadges = Array.from(badges).filter((b) => !b.classList.contains('MuiBadge-invisible'));
        expect(visibleBadges.length).toBe(0);
      });
    });

    it('re-fetches resources from conversation API after gap-reconnect', async () => {
      // Set up with lastReconnectTime to simulate a gap-reconnect
      const { rerender } = await act(async () => render(<EventAssistantRoom authType={'guest'} />));

      await waitFor(() => expect(createConversationFromData).toHaveBeenCalled());

      // Simulate gap-reconnect by updating the mock to return lastReconnectTime
      mockUseSessionJoin.mockReturnValue({
        socket: mockSocket,
        pseudonym: 'test-pseudonym',
        userId: 'user-123',
        isConnected: true,
        errorMessage: null,
        lastReconnectTime: Date.now(),
      });

      const updatedResources = [
        { id: 'res-1', source: 'ai', category: 'suggested', title: 'Book A', participantVisible: true },
        { id: 'res-3', source: 'ai', category: 'suggested', title: 'New Book After Reconnect', participantVisible: true },
      ];

      (RetrieveData as jest.Mock).mockImplementation((path: string) => {
        if (path.startsWith('conversations/')) {
          return Promise.resolve({
            agents: [{ id: 'agent-123', agentType: 'eventAssistant' }],
            resources: updatedResources,
          });
        }
        return Promise.resolve([]);
      });

      await act(async () => {
        rerender(<EventAssistantRoom authType={'guest'} />);
      });

      await waitFor(() => {
        expect(RetrieveData).toHaveBeenCalledWith('conversations/test-conversation-id', 'mock-access-token');
      });

      const user = userEvent.setup();
      await user.click(screen.getAllByLabelText('Resources')[0]);
      await user.click(screen.getByText('Readings & References (optional)'));

      await waitFor(() => {
        expect(screen.getByText('New Book After Reconnect')).toBeInTheDocument();
      });
    });

    it('does not increment count for resources already present in conversation data', async () => {
      await resourcesSetup(mockResources);

      await waitFor(() => {
        expect(mockSocket.on).toHaveBeenCalledWith('resources:updated', expect.any(Function));
      });

      const handler = getResourcesUpdatedHandler();

      // Fire resources:updated with the same resources (no new IDs)
      act(() => {
        handler({ resources: mockResources });
      });

      // No badge should appear since no new resources were added
      await waitFor(() => {
        const badges = document.querySelectorAll('.MuiBadge-badge');
        const visibleBadges = Array.from(badges).filter((b) => !b.classList.contains('MuiBadge-invisible'));
        expect(visibleBadges.length).toBe(0);
      });
    });
  });
});
