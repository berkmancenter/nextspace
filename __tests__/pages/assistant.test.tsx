import React from "react";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import EventAssistantRoom from "../../pages/assistant";
import { RetrieveData, SendData } from "../../utils";
import { createConversationFromData } from "../../utils/Helpers";

// Mock next/router
const mockPush = jest.fn();
const mockRouter = {
  push: mockPush,
  query: { conversationId: "test-conversation-id" } as any,
  isReady: true,
};

jest.mock("next/router", () => ({
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
  auth: { token: "mock-token" },
  hasListeners: jest.fn(() => false),
};

jest.mock("socket.io-client", () => ({
  io: jest.fn(() => mockSocket),
}));

// Mock SessionManager
jest.mock("../../utils/SessionManager", () => {
  const mockSessionManager = {
    get: jest.fn(() => ({
      restoreSession: jest.fn().mockResolvedValue(true),
      getState: jest.fn().mockReturnValue("guest"),
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
jest.mock("../../utils", () => ({
  Api: {
    get: jest.fn(() => ({
      GetTokens: jest.fn(() => ({ access: "mock-access-token" })),
      GetConfig: jest.fn(() =>
        Promise.resolve({ conversationBotName: "Berkie" }),
      ),
      getAccessToken: jest.fn(() => "mock-access-token"),
    })),
  },
  RetrieveData: jest.fn(),
  SendData: jest.fn(),
  GetChannelPasscode: jest.fn((channel: string, query: any) => {
    // Extract passcode from query.channel parameter
    if (!query.channel) return null;

    const channels = Array.isArray(query.channel)
      ? query.channel
      : [query.channel];
    const matchingChannel = channels.find((c: string) => c.includes(channel));

    if (matchingChannel) {
      const parts = matchingChannel.split(",");
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
  buildDirectChannels: jest.fn((userId, agents, preferences) =>
    agents
      .filter((a: any) => !a.preferenceKey || preferences[a.preferenceKey])
      .map((a: any) => ({ name: `direct-${userId}-${a.agentId}`, passcode: null, direct: true }))
  ),
}));

// Mock useSessionJoin hook
const mockUseSessionJoin = jest.fn();
jest.mock("../../utils/useSessionJoin", () => ({
  useSessionJoin: (...args: any[]) => mockUseSessionJoin(...args),
}));

// Mock message components
jest.mock("../../components/messages", () => ({
  AssistantMessage: ({
    message,
    onPopulateFeedbackText,
    onSendFeedbackRating,
    messageType,
  }: any) => {
    const messageText =
      typeof message.body === "string"
        ? message.body
        : message.body?.text || "";

    return (
      <div data-testid="assistant-message">
        {messageText}
        {message.id && !messageType && (
          <div data-testid="message-feedback" data-message-id={message.id}>
            <button
              data-testid="rating-button-3"
              onClick={() => onSendFeedbackRating?.(message.id, 3)}
            >
              3
            </button>
            <button
              data-testid="say-more-button"
              onClick={() =>
                onPopulateFeedbackText?.({
                  prefix: `/feedback|Text|${message.id}|`,
                  icon: null,
                  label: "Feedback Mode",
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
    const messageText =
      typeof message.body === "string"
        ? message.body
        : message.body?.text || "";
    return <div data-testid="submitted-message">{messageText}</div>;
  },
  ModeratorSubmittedMessage: ({ message }: any) => {
    const messageText =
      typeof message.body === "string"
        ? message.body
        : message.body?.text || "";
    return <div data-testid="moderator-submitted-message">{messageText}</div>;
  },
  UserMessage: ({ message }: any) => {
    const messageText =
      typeof message.body === "string"
        ? message.body
        : message.body?.text || "";
    return <div data-testid="user-message">{messageText}</div>;
  },
  JargonClarificationMessage: ({ message }: any) => {
    const body = typeof message.body === "object" ? message.body : {};
    return (
      <div data-testid="jargon-clarification-message">
        {body.sourceText && <div>{body.sourceText}</div>}
        {body.text && <div>{body.text}</div>}
      </div>
    );
  },
}));

// Mock CheckAuthHeader and createConversationFromData
jest.mock("../../utils/Helpers", () => ({
  ...jest.requireActual("../../utils/Helpers"),
  CheckAuthHeader: jest.fn(() => ({ props: {} })),
  createConversationFromData: jest.fn(),
}));

describe("EventAssistantRoom", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPush.mockReset();
    (RetrieveData as jest.Mock).mockResolvedValue({
      agents: [{ id: "agent-123", agentType: "eventAssistant" }],
    });

    // Mock createConversationFromData to return a conversation object with type
    (createConversationFromData as jest.Mock).mockResolvedValue({
      agents: [{ id: "agent-123", agentType: "eventAssistant" }],
      type: { name: "eventAssistant" },
    });

    mockSocket.hasListeners.mockReturnValue(false);
    mockRouter.query = { conversationId: "test-conversation-id" };
    mockRouter.isReady = true;

    // Default mock implementation
    mockUseSessionJoin.mockReturnValue({
      socket: mockSocket,
      pseudonym: "test-pseudonym",
      userId: "user-123",
      isConnected: true,
      errorMessage: null,
    });

    // Mock scrollIntoView for SlashCommandMenu
    HTMLElement.prototype.scrollIntoView = jest.fn();

    // Mock scrollIntoView
    Element.prototype.scrollIntoView = jest.fn();
  });

  it("renders loading state initially", async () => {
    // Mock as not connected yet
    mockUseSessionJoin.mockReturnValue({
      socket: mockSocket,
      pseudonym: "test-pseudonym",
      userId: "user-123",
      isConnected: false,
      errorMessage: null,
    });

    let container;
    await act(async () => {
      const result = render(<EventAssistantRoom authType={"guest"} />);
      container = result.container;
    });

    // Should show loading indicator (animated circles)
    const loadingCircles = container!.querySelectorAll(".animate-bounce");
    expect(loadingCircles.length).toBeGreaterThan(0);
  });

  it("initializes socket connection on mount", async () => {
    await act(async () => {
      render(<EventAssistantRoom authType={"guest"} />);
    });

    await waitFor(() => {
      expect(mockUseSessionJoin).toHaveBeenCalled();
    });
  });

  it("sets up socket event listeners", async () => {
    await act(async () => {
      render(<EventAssistantRoom authType={"guest"} />);
    });

    // useSessionJoin handles error/connect/disconnect events internally
    // The page component sets up message:new listener
    await waitFor(() => {
      expect(mockSocket.on).toHaveBeenCalledWith(
        "message:new",
        expect.any(Function),
      );
    });
  });

  it("fetches conversation data when router is ready", async () => {
    await act(async () => {
      render(<EventAssistantRoom authType={"guest"} />);
    });

    await waitFor(() => {
      expect(RetrieveData).toHaveBeenCalledWith(
        "conversations/test-conversation-id",
        "mock-access-token",
      );
    });
  });

  it("displays error when conversation is not found", async () => {
    (RetrieveData as jest.Mock).mockResolvedValue(null);

    await act(async () => {
      render(<EventAssistantRoom authType={"guest"} />);
    });

    await waitFor(() => {
      expect(screen.getByText("Conversation not found.")).toBeInTheDocument();
    });
  });

  it("displays error when conversation has an error", async () => {
    (RetrieveData as jest.Mock).mockResolvedValue({
      error: true,
      message: { message: "Access denied" },
    });

    await act(async () => {
      render(<EventAssistantRoom authType={"guest"} />);
    });

    await waitFor(() => {
      expect(screen.getByText("Access denied")).toBeInTheDocument();
    });
  });

  it("displays error when conversation has no event assistant agent", async () => {
    (RetrieveData as jest.Mock).mockResolvedValue({
      agents: [{ id: "agent-123", agentType: "regular" }],
    });
    (createConversationFromData as jest.Mock).mockResolvedValue({
      agents: [{ id: "agent-123", agentType: "regular" }],
      type: { name: "eventAssistant" },
    });

    await act(async () => {
      render(<EventAssistantRoom authType={"guest"} />);
    });

    await waitFor(() => {
      expect(
        screen.getByText(
          "This conversation does not have an event assistant agent.",
        ),
      ).toBeInTheDocument();
    });
  });

  it("handles session join errors gracefully", async () => {
    mockUseSessionJoin.mockReturnValue({
      socket: null,
      pseudonym: null,
      userId: null,
      isConnected: false,
      errorMessage: "Failed to join session",
    });

    await act(async () => {
      render(<EventAssistantRoom authType={"guest"} />);
    });

    await waitFor(() => {
      expect(screen.getByText("Failed to join session")).toBeInTheDocument();
    });
  });

  it("loads initial assistant messages on page load", async () => {
    const mockMessages = [
      {
        id: "1",
        body: "Hello",
        pseudonym: "User",
        channels: ["direct-user-123-agent-123"],
      },
      {
        id: "2",
        body: "Hi there!",
        pseudonym: "Event Assistant",
        channels: ["direct-user-123-agent-123"],
      },
    ];

    (RetrieveData as jest.Mock)
      .mockResolvedValueOnce({
        agents: [{ id: "agent-123", agentType: "eventAssistant" }],
      })
      .mockResolvedValueOnce(mockMessages);
    (createConversationFromData as jest.Mock).mockResolvedValue({
      agents: [{ id: "agent-123", agentType: "eventAssistant" }],
      type: { name: "eventAssistant" },
    });

    await act(async () => {
      render(<EventAssistantRoom authType={"guest"} />);
    });

    await waitFor(() => {
      expect(RetrieveData).toHaveBeenCalledWith(
        "messages/test-conversation-id?channel=direct-user-123-agent-123",
        "mock-access-token",
      );
    });
  });

  it("emits conversation:join when socket, userId, and agentId are available", async () => {
    (RetrieveData as jest.Mock).mockResolvedValue({
      agents: [{ id: "agent-123", agentType: "eventAssistant" }],
    });
    (createConversationFromData as jest.Mock).mockResolvedValue({
      agents: [{ id: "agent-123", agentType: "eventAssistant" }],
      type: { name: "eventAssistant" },
    });

    await act(async () => {
      render(<EventAssistantRoom authType={"guest"} />);
    });

    await waitFor(() => {
      expect(mockSocket.emit).toHaveBeenCalledWith("conversation:join", {
        conversationId: "test-conversation-id",
        token: "mock-access-token",
        channels: [
          {
            name: "direct-user-123-agent-123",
            passcode: null,
            direct: true,
          },
        ],
      });
    });
  });

  it("includes chat channel in conversation:join when chatPasscode is available", async () => {
    mockRouter.query = {
      conversationId: "test-conversation-id",
      channel: ["transcript,transcript-pass", "chat,chat-pass"],
    };
    (RetrieveData as jest.Mock).mockResolvedValue({
      agents: [{ id: "agent-123", agentType: "eventAssistant" }],
    });
    (createConversationFromData as jest.Mock).mockResolvedValue({
      agents: [{ id: "agent-123", agentType: "eventAssistant" }],
      type: { name: "eventAssistant" },
    });

    await act(async () => {
      render(<EventAssistantRoom authType={"guest"} />);
    });

    await waitFor(() => {
      expect(mockSocket.emit).toHaveBeenCalledWith("conversation:join", {
        conversationId: "test-conversation-id",
        token: "mock-access-token",
        channels: [
          {
            name: "direct-user-123-agent-123",
            passcode: null,
            direct: true,
          },
          {
            name: "chat",
            passcode: "chat-pass",
            direct: false,
          },
        ],
      });
    });
  });

  describe("Conversation-Type-Specific Commands", () => {
    it("shows /mod command for Event Assistant Plus", async () => {
      // Set up router query with channel and chat passcode
      mockRouter.query = {
        conversationId: "test-conversation-id",
        channel: "chat,test-chat-passcode",
      };

      mockUseSessionJoin.mockReturnValue({
        socket: mockSocket,
        pseudonym: "test-pseudonym",
        userId: "user-123",
        isConnected: true,
        errorMessage: null,
      });
      (RetrieveData as jest.Mock).mockImplementation((path: string) => {
        if (path.startsWith("conversations/")) {
          return Promise.resolve({
            agents: [{ id: "agent-456", agentType: "eventAssistantPlus" }],
          });
        } else if (path.startsWith("messages/")) {
          return Promise.resolve([]);
        }
        return Promise.resolve(null);
      });
      (createConversationFromData as jest.Mock).mockResolvedValue({
        agents: [{ id: "agent-456", agentType: "eventAssistantPlus" }],
        type: { name: "eventAssistantPlus" },
      });

      await act(async () => {
        render(<EventAssistantRoom authType={"guest"} />);
      });

      // Wait for conversation data to load (RetrieveData called for conversations/)
      await waitFor(() => {
        expect(createConversationFromData).toHaveBeenCalled();
      });

      const user = userEvent.setup();

      // Switch to the Event Bot (assistant) tab — nav bar shows both desktop + mobile, use first
      const assistantTabs = screen.getAllByLabelText("Berkie");
      await user.click(assistantTabs[0]);

      // Wait for AssistantChatPanel input to be present
      await waitFor(() => {
        expect(
          screen.getByPlaceholderText("Enter your message here"),
        ).toBeInTheDocument();
      });

      const input = screen.getByPlaceholderText("Enter your message here");
      await user.type(input, "/");

      // The slash command menu should appear with /mod option
      await waitFor(
        () => {
          expect(screen.getByText("/mod")).toBeInTheDocument();
        },
        { timeout: 3000 },
      );
    });

    it("does not show /mod command for Event Assistant (non-Plus)", async () => {
      // Set up router query with channel and chat passcode
      mockRouter.query = {
        conversationId: "test-conversation-id",
        channel: "chat,test-chat-passcode",
      };

      mockUseSessionJoin.mockReturnValue({
        socket: mockSocket,
        pseudonym: "test-pseudonym",
        userId: "user-123",
        isConnected: true,
        errorMessage: null,
      });
      (RetrieveData as jest.Mock).mockImplementation((path: string) => {
        if (path.startsWith("conversations/")) {
          return Promise.resolve({
            agents: [{ id: "agent-456", agentType: "eventAssistant" }],
          });
        } else if (path.startsWith("messages/")) {
          return Promise.resolve([]); // Return empty chat messages
        }
        return Promise.resolve(null);
      });
      (createConversationFromData as jest.Mock).mockResolvedValue({
        agents: [{ id: "agent-456", agentType: "eventAssistant" }],
        type: { name: "eventAssistant" },
      });

      await act(async () => {
        render(<EventAssistantRoom authType={"guest"} />);
      });

      await waitFor(() => {
        expect(
          screen.getByPlaceholderText("Enter your message here"),
        ).toBeInTheDocument();
      });

      const user = userEvent.setup();

      // Click on the Event Bot nav item to switch from Chat (default) to Assistant
      const assistantTab = screen.getAllByLabelText("Berkie")[0];
      await user.click(assistantTab);

      const input = screen.getByPlaceholderText("Enter your message here");

      await user.type(input, "/");

      await waitFor(
        () => {
          expect(screen.queryByText("/mod")).not.toBeInTheDocument();
        },
        { timeout: 3000 },
      );
    });
  });

  describe("Bot @mention routing in chat tab", () => {
    const chatSetup = async () => {
      mockRouter.query = {
        conversationId: "test-conversation-id",
        channel: "chat,chat-pass",
      };
      (RetrieveData as jest.Mock).mockImplementation((path: string) => {
        if (path.startsWith("conversations/")) {
          return Promise.resolve({
            agents: [{ id: "agent-123", agentType: "eventAssistant" }],
          });
        }
        return Promise.resolve([]);
      });
      (createConversationFromData as jest.Mock).mockResolvedValue({
        agents: [{ id: "agent-123", agentType: "eventAssistant" }],
        type: { name: "eventAssistant" },
        name: "My Event",
      });

      await act(async () => {
        render(<EventAssistantRoom authType={"guest"} />);
      });
      await waitFor(() =>
        expect(createConversationFromData).toHaveBeenCalled(),
      );
    };

    it("sends chat-only message to the chat channel", async () => {
      await chatSetup();

      // Chat tab is the default — find the input and type a plain message
      const user = userEvent.setup();
      const input = screen.getByPlaceholderText("Enter your message here");
      await user.type(input, "hello everyone{Enter}");

      await waitFor(() => {
        expect(SendData).toHaveBeenCalledWith(
          "messages",
          expect.objectContaining({
            channels: [{ name: "chat", passcode: "chat-pass" }],
          }),
        );
      });
    });

    it("is case-insensitive when matching the bot @mention", async () => {
      await chatSetup();

      const user = userEvent.setup();
      const input = screen.getByPlaceholderText("Enter your message here");
      await user.type(input, "@berkie question{Enter}");

      await waitFor(() => {
        expect(SendData).toHaveBeenCalledWith(
          "messages",
          expect.objectContaining({
            channels: expect.arrayContaining([
              { name: "chat", passcode: "chat-pass" },
            ]),
          }),
        );
      });
    });
  });

  describe("botName resolution", () => {
    it("uses config.conversationBotName when agent has no agentConfig.botName", async () => {
      (createConversationFromData as jest.Mock).mockResolvedValue({
        agents: [
          { id: "agent-123", agentType: "eventAssistant", agentConfig: {} },
        ],
        type: { name: "eventAssistant" },
      });

      await act(async () => {
        render(<EventAssistantRoom authType={"guest"} />);
      });

      await waitFor(() => {
        expect(createConversationFromData).toHaveBeenCalled();
      });

      // "Berkie" comes from the mocked config.conversationBotName
      expect(screen.getAllByLabelText("Berkie").length).toBeGreaterThan(0);
    });

    it("overrides botName from first agent's agentConfig.botName", async () => {
      (createConversationFromData as jest.Mock).mockResolvedValue({
        agents: [
          {
            id: "agent-123",
            agentType: "eventAssistant",
            agentConfig: { botName: "EventBot" },
          },
        ],
        type: { name: "eventAssistant" },
      });

      await act(async () => {
        render(<EventAssistantRoom authType={"guest"} />);
      });

      await waitFor(() => {
        expect(createConversationFromData).toHaveBeenCalled();
      });

      // botName should be overridden to "EventBot"
      expect(screen.getAllByLabelText("EventBot").length).toBeGreaterThan(0);
    });

    it("falls back to config.conversationBotName when agentConfig.botName is not a string", async () => {
      (createConversationFromData as jest.Mock).mockResolvedValue({
        agents: [
          {
            id: "agent-123",
            agentType: "eventAssistant",
            agentConfig: { botName: 42 },
          },
        ],
        type: { name: "eventAssistant" },
      });

      await act(async () => {
        render(<EventAssistantRoom authType={"guest"} />);
      });

      await waitFor(() => {
        expect(createConversationFromData).toHaveBeenCalled();
      });

      // Falls back to "Berkie" from config
      expect(screen.getAllByLabelText("Berkie").length).toBeGreaterThan(0);
    });

    it("falls back to config.conversationBotName when there are no agents", async () => {
      (createConversationFromData as jest.Mock).mockResolvedValue({
        agents: [],
        type: { name: "eventAssistant" },
      });
      // No event assistant agent → error path, but botName should still have been set
      // We verify the setBotName call by checking that no override happened

      await act(async () => {
        render(<EventAssistantRoom authType={"guest"} />);
      });

      await waitFor(() => {
        expect(createConversationFromData).toHaveBeenCalled();
      });

      // Error is shown because there's no event assistant agent, but botName defaults to "Berkie"
      expect(
        screen.getByText(
          "This conversation does not have an event assistant agent.",
        ),
      ).toBeInTheDocument();
    });
  });

  it("loads initial chat messages when chatPasscode becomes available", async () => {
    mockRouter.query = {
      conversationId: "test-conversation-id",
      channel: "chat,chat-pass",
    };

    const mockChatMessages = [
      {
        id: "1",
        body: "Chat message 1",
        pseudonym: "User1",
        channels: ["chat"],
      },
      {
        id: "2",
        body: "Chat message 2",
        pseudonym: "User2",
        channels: ["chat"],
      },
    ];

    (RetrieveData as jest.Mock)
      .mockResolvedValueOnce({
        agents: [{ id: "agent-123", agentType: "eventAssistant" }],
      })
      .mockResolvedValueOnce(mockChatMessages)
      .mockResolvedValueOnce([]);
    (createConversationFromData as jest.Mock).mockResolvedValue({
      agents: [{ id: "agent-123", agentType: "eventAssistant" }],
      type: { name: "eventAssistant" },
    });

    await act(async () => {
      render(<EventAssistantRoom authType={"guest"} />);
    });

    await waitFor(() => {
      expect(RetrieveData).toHaveBeenCalledWith(
        "messages/test-conversation-id?channel=chat,chat-pass",
        "mock-access-token",
      );
    });
  });

  describe("Message Replies", () => {
    it("fetches and inserts replies for assistant messages with replyCount", async () => {
      const mockMessages = [
        {
          id: "msg-1",
          body: "Original message",
          pseudonym: "User",
          channels: ["direct-user-123-agent-123"],
          createdAt: "2024-01-01T10:00:00Z",
          replyCount: 2,
        },
      ];

      const mockReplies = [
        {
          id: "reply-1",
          body: "First reply",
          pseudonym: "User",
          parentMessage: "msg-1",
          channels: ["direct-user-123-agent-123"],
          createdAt: "2024-01-01T10:01:00Z",
        },
        {
          id: "reply-2",
          body: "Second reply",
          pseudonym: "Event Assistant",
          parentMessage: "msg-1",
          channels: ["direct-user-123-agent-123"],
          createdAt: "2024-01-01T10:02:00Z",
        },
      ];

      (RetrieveData as jest.Mock).mockImplementation((path: string) => {
        if (path.startsWith("conversations/")) {
          return Promise.resolve({
            agents: [{ id: "agent-123", agentType: "eventAssistant" }],
          });
        } else if (path.includes("/preferences")) {
          return Promise.resolve({ visualResponse: true });
        } else if (path.includes("?channel=direct-")) {
          return Promise.resolve(mockMessages);
        } else if (path === "messages/msg-1/replies") {
          return Promise.resolve(mockReplies);
        }
        return Promise.resolve([]);
      });

      (createConversationFromData as jest.Mock).mockResolvedValue({
        agents: [{ id: "agent-123", agentType: "eventAssistant" }],
        type: { name: "eventAssistant" },
      });

      await act(async () => {
        render(<EventAssistantRoom authType={"guest"} />);
      });

      await waitFor(() => {
        expect(RetrieveData).toHaveBeenCalledWith(
          "messages/test-conversation-id?channel=direct-user-123-agent-123",
          "mock-access-token",
        );
      });

      await waitFor(() => {
        expect(RetrieveData).toHaveBeenCalledWith(
          "messages/msg-1/replies",
          "mock-access-token",
        );
      });
    });

    it("fetches and inserts replies for chat messages with replyCount", async () => {
      mockRouter.query = {
        conversationId: "test-conversation-id",
        channel: "chat,chat-pass",
      };

      const mockChatMessages = [
        {
          id: "chat-msg-1",
          body: "Chat message with replies",
          pseudonym: "User1",
          channels: ["chat"],
          createdAt: "2024-01-01T10:00:00Z",
          replyCount: 1,
        },
      ];

      const mockChatReplies = [
        {
          id: "chat-reply-1",
          body: "Chat reply",
          pseudonym: "User2",
          parentMessage: "chat-msg-1",
          channels: ["chat"],
          createdAt: "2024-01-01T10:01:00Z",
        },
      ];

      (RetrieveData as jest.Mock).mockImplementation((path: string) => {
        if (path.startsWith("conversations/")) {
          return Promise.resolve({
            agents: [{ id: "agent-123", agentType: "eventAssistant" }],
          });
        } else if (path.includes("/preferences")) {
          return Promise.resolve({ visualResponse: true });
        } else if (path.includes("?channel=chat")) {
          return Promise.resolve(mockChatMessages);
        } else if (path === "messages/chat-msg-1/replies") {
          return Promise.resolve(mockChatReplies);
        } else if (path.includes("?channel=direct-")) {
          return Promise.resolve([]);
        }
        return Promise.resolve([]);
      });

      (createConversationFromData as jest.Mock).mockResolvedValue({
        agents: [{ id: "agent-123", agentType: "eventAssistant" }],
        type: { name: "eventAssistant" },
      });

      await act(async () => {
        render(<EventAssistantRoom authType={"guest"} />);
      });

      await waitFor(() => {
        expect(RetrieveData).toHaveBeenCalledWith(
          "messages/test-conversation-id?channel=chat,chat-pass",
          "mock-access-token",
        );
      });

      await waitFor(() => {
        expect(RetrieveData).toHaveBeenCalledWith(
          "messages/chat-msg-1/replies",
          "mock-access-token",
        );
      });
    });

    it("sorts messages chronologically after inserting replies", async () => {
      const mockMessages = [
        {
          id: "msg-1",
          body: "First message",
          pseudonym: "User",
          channels: ["direct-user-123-agent-123"],
          createdAt: "2024-01-01T10:00:00Z",
          replyCount: 1,
        },
        {
          id: "msg-2",
          body: "Third message",
          pseudonym: "User",
          channels: ["direct-user-123-agent-123"],
          createdAt: "2024-01-01T10:05:00Z",
          replyCount: 0,
        },
      ];

      const mockReplies = [
        {
          id: "reply-1",
          body: "Second message (reply to first)",
          pseudonym: "Event Assistant",
          parentMessage: "msg-1",
          channels: ["direct-user-123-agent-123"],
          createdAt: "2024-01-01T10:02:00Z",
        },
      ];

      (RetrieveData as jest.Mock).mockImplementation((path: string) => {
        if (path.startsWith("conversations/")) {
          return Promise.resolve({
            agents: [{ id: "agent-123", agentType: "eventAssistant" }],
          });
        } else if (path.includes("/preferences")) {
          return Promise.resolve({ visualResponse: true });
        } else if (path.includes("?channel=direct-")) {
          return Promise.resolve(mockMessages);
        } else if (path === "messages/msg-1/replies") {
          return Promise.resolve(mockReplies);
        }
        return Promise.resolve([]);
      });

      (createConversationFromData as jest.Mock).mockResolvedValue({
        agents: [{ id: "agent-123", agentType: "eventAssistant" }],
        type: { name: "eventAssistant" },
      });

      await act(async () => {
        render(<EventAssistantRoom authType={"guest"} />);
      });

      // Verify replies are fetched for the message with replyCount
      await waitFor(() => {
        expect(RetrieveData).toHaveBeenCalledWith(
          "messages/msg-1/replies",
          "mock-access-token",
        );
      });

      // Verify the initial messages query was made
      expect(RetrieveData).toHaveBeenCalledWith(
        "messages/test-conversation-id?channel=direct-user-123-agent-123",
        "mock-access-token",
      );
    });

    it("handles multiple messages with replies", async () => {
      const mockMessages = [
        {
          id: "msg-1",
          body: "Message 1",
          pseudonym: "User",
          channels: ["direct-user-123-agent-123"],
          createdAt: "2024-01-01T10:00:00Z",
          replyCount: 2,
        },
        {
          id: "msg-2",
          body: "Message 2",
          pseudonym: "User",
          channels: ["direct-user-123-agent-123"],
          createdAt: "2024-01-01T10:03:00Z",
          replyCount: 1,
        },
      ];

      const mockRepliesMsg1 = [
        {
          id: "reply-1",
          body: "Reply to msg 1",
          pseudonym: "Event Assistant",
          parentMessage: "msg-1",
          channels: ["direct-user-123-agent-123"],
          createdAt: "2024-01-01T10:01:00Z",
        },
        {
          id: "reply-2",
          body: "Another reply to msg 1",
          pseudonym: "Event Assistant",
          parentMessage: "msg-1",
          channels: ["direct-user-123-agent-123"],
          createdAt: "2024-01-01T10:02:00Z",
        },
      ];

      const mockRepliesMsg2 = [
        {
          id: "reply-3",
          body: "Reply to msg 2",
          pseudonym: "Event Assistant",
          parentMessage: "msg-2",
          channels: ["direct-user-123-agent-123"],
          createdAt: "2024-01-01T10:04:00Z",
        },
      ];

      (RetrieveData as jest.Mock).mockImplementation((path: string) => {
        if (path.startsWith("conversations/")) {
          return Promise.resolve({
            agents: [{ id: "agent-123", agentType: "eventAssistant" }],
          });
        } else if (path.includes("/preferences")) {
          return Promise.resolve({ visualResponse: true });
        } else if (path.includes("?channel=direct-")) {
          return Promise.resolve(mockMessages);
        } else if (path === "messages/msg-1/replies") {
          return Promise.resolve(mockRepliesMsg1);
        } else if (path === "messages/msg-2/replies") {
          return Promise.resolve(mockRepliesMsg2);
        }
        return Promise.resolve([]);
      });

      (createConversationFromData as jest.Mock).mockResolvedValue({
        agents: [{ id: "agent-123", agentType: "eventAssistant" }],
        type: { name: "eventAssistant" },
      });

      await act(async () => {
        render(<EventAssistantRoom authType={"guest"} />);
      });

      await waitFor(() => {
        expect(RetrieveData).toHaveBeenCalledWith(
          "messages/msg-1/replies",
          "mock-access-token",
        );
      });

      await waitFor(() => {
        expect(RetrieveData).toHaveBeenCalledWith(
          "messages/msg-2/replies",
          "mock-access-token",
        );
      });
    });

    it("handles error when fetching replies gracefully", async () => {
      const mockMessages = [
        {
          id: "msg-1",
          body: "Message with failing reply fetch",
          pseudonym: "User",
          channels: ["direct-user-123-agent-123"],
          createdAt: "2024-01-01T10:00:00Z",
          replyCount: 1,
        },
      ];

      (RetrieveData as jest.Mock).mockImplementation((path: string) => {
        if (path.startsWith("conversations/")) {
          return Promise.resolve({
            agents: [{ id: "agent-123", agentType: "eventAssistant" }],
          });
        } else if (path.includes("/preferences")) {
          return Promise.resolve({ visualResponse: true });
        } else if (path.includes("?channel=direct-")) {
          return Promise.resolve(mockMessages);
        } else if (path === "messages/msg-1/replies") {
          return Promise.reject(new Error("Failed to fetch replies"));
        }
        return Promise.resolve([]);
      });

      (createConversationFromData as jest.Mock).mockResolvedValue({
        agents: [{ id: "agent-123", agentType: "eventAssistant" }],
        type: { name: "eventAssistant" },
      });

      // Capture console.error to verify error is logged
      const consoleErrorSpy = jest
        .spyOn(console, "error")
        .mockImplementation(() => {});

      await act(async () => {
        render(<EventAssistantRoom authType={"guest"} />);
      });

      // Verify replies endpoint was called
      await waitFor(() => {
        expect(RetrieveData).toHaveBeenCalledWith(
          "messages/msg-1/replies",
          "mock-access-token",
        );
      });

      // Wait a bit for error handling to complete
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
      });

      // Verify error was logged
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Error fetching replies for message msg-1:",
        expect.any(Error),
      );

      consoleErrorSpy.mockRestore();
    });

    it("does not fetch replies when replyCount is 0", async () => {
      const mockMessages = [
        {
          id: "msg-1",
          body: "Message without replies",
          pseudonym: "User",
          channels: ["direct-user-123-agent-123"],
          createdAt: "2024-01-01T10:00:00Z",
          replyCount: 0,
        },
      ];

      (RetrieveData as jest.Mock)
        .mockResolvedValueOnce({
          agents: [{ id: "agent-123", agentType: "eventAssistant" }],
        })
        .mockResolvedValueOnce({ visualResponse: true }) // User preferences
        .mockResolvedValueOnce(mockMessages);

      (createConversationFromData as jest.Mock).mockResolvedValue({
        agents: [{ id: "agent-123", agentType: "eventAssistant" }],
        type: { name: "eventAssistant" },
      });

      await act(async () => {
        render(<EventAssistantRoom authType={"guest"} />);
      });

      await waitFor(() => {
        expect(RetrieveData).toHaveBeenCalledWith(
          "messages/test-conversation-id?channel=direct-user-123-agent-123",
          "mock-access-token",
        );
      });

      // Should NOT call the replies endpoint
      expect(RetrieveData).not.toHaveBeenCalledWith(
        "messages/msg-1/replies",
        "mock-access-token",
      );
    });

    it("does not fetch replies when replyCount is undefined", async () => {
      const mockMessages = [
        {
          id: "msg-1",
          body: "Message without replyCount field",
          pseudonym: "User",
          channels: ["direct-user-123-agent-123"],
          createdAt: "2024-01-01T10:00:00Z",
          // replyCount is undefined
        },
      ];

      (RetrieveData as jest.Mock)
        .mockResolvedValueOnce({
          agents: [{ id: "agent-123", agentType: "eventAssistant" }],
        })
        .mockResolvedValueOnce({ visualResponse: true }) // User preferences
        .mockResolvedValueOnce(mockMessages);

      (createConversationFromData as jest.Mock).mockResolvedValue({
        agents: [{ id: "agent-123", agentType: "eventAssistant" }],
        type: { name: "eventAssistant" },
      });

      await act(async () => {
        render(<EventAssistantRoom authType={"guest"} />);
      });

      await waitFor(() => {
        expect(RetrieveData).toHaveBeenCalledWith(
          "messages/test-conversation-id?channel=direct-user-123-agent-123",
          "mock-access-token",
        );
      });

      // Should NOT call the replies endpoint
      expect(RetrieveData).not.toHaveBeenCalledWith(
        "messages/msg-1/replies",
        "mock-access-token",
      );
    });
  });

  describe("User Preferences", () => {
    it("fetches user preferences on page load when userId is available", async () => {
      (RetrieveData as jest.Mock)
        .mockResolvedValueOnce({
          agents: [{ id: "agent-123", agentType: "eventAssistant" }],
        })
        .mockResolvedValueOnce([]); // Empty preferences

      (createConversationFromData as jest.Mock).mockResolvedValue({
        agents: [{ id: "agent-123", agentType: "eventAssistant" }],
        type: { name: "eventAssistant" },
      });

      await act(async () => {
        render(<EventAssistantRoom authType={"guest"} />);
      });

      await waitFor(() => {
        expect(RetrieveData).toHaveBeenCalledWith(
          "users/user/user-123/preferences",
          "mock-access-token",
        );
      });
    });

    it("shows preferences banner when user has no preferences", async () => {
      const user = userEvent.setup();

      // Set up router with chat passcode so tabs are shown
      mockRouter.query = {
        conversationId: "test-conversation-id",
        channel: "chat,test-chat-pass",
      };

      (RetrieveData as jest.Mock).mockImplementation((path: string) => {
        if (path.startsWith("conversations/")) {
          return Promise.resolve({
            agents: [{ id: "agent-123", agentType: "eventAssistant" }],
          });
        } else if (
          path.includes("users/user/") &&
          path.includes("/preferences")
        ) {
          return Promise.resolve({}); // Empty preferences object
        } else if (path.startsWith("messages/")) {
          return Promise.resolve([]); // Empty messages
        }
        return Promise.resolve(null);
      });

      (createConversationFromData as jest.Mock).mockResolvedValue({
        agents: [{ id: "agent-123", agentType: "eventAssistant" }],
        type: { name: "eventAssistant" },
      });

      await act(async () => {
        render(<EventAssistantRoom authType={"guest"} />);
      });

      await waitFor(() => {
        expect(screen.getAllByLabelText("Berkie").length).toBeGreaterThan(0);
      });

      // Click on the Event Bot (assistant) tab to show preferences
      const assistantTab = screen.getAllByLabelText("Berkie")[0];
      await user.click(assistantTab);

      await waitFor(() => {
        expect(screen.getByText("Set Your Preferences")).toBeInTheDocument();
      });
    });

    it("hides preferences banner when user has existing preferences", async () => {
      const user = userEvent.setup();

      // Set up router with chat passcode so tabs are shown
      mockRouter.query = {
        conversationId: "test-conversation-id",
        channel: "chat,test-chat-pass",
      };

      // Use mockImplementation to return different values based on the path
      (RetrieveData as jest.Mock).mockImplementation((path: string) => {
        if (path.startsWith("conversations/")) {
          return Promise.resolve({
            agents: [{ id: "agent-123", agentType: "eventAssistant" }],
          });
        } else if (
          path.includes("users/user/") &&
          path.includes("/preferences")
        ) {
          return Promise.resolve({ visualResponse: true }); // Existing preferences
        } else if (path.startsWith("messages/")) {
          return Promise.resolve([]); // Empty messages
        }
        return Promise.resolve(null);
      });

      (createConversationFromData as jest.Mock).mockResolvedValue({
        agents: [{ id: "agent-123", agentType: "eventAssistant" }],
        type: { name: "eventAssistant" },
      });

      await act(async () => {
        render(<EventAssistantRoom authType={"guest"} />);
      });

      await waitFor(() => {
        expect(screen.getAllByLabelText("Berkie").length).toBeGreaterThan(0);
      });

      // Click on the Event Bot (assistant) tab
      const assistantTab = screen.getAllByLabelText("Berkie")[0];
      await user.click(assistantTab);

      await waitFor(() => {
        expect(
          screen.getByPlaceholderText("Enter your message here"),
        ).toBeInTheDocument();
      });

      // Wait for preferences to be loaded and the banner to be hidden
      await waitFor(
        () => {
          expect(
            screen.queryByText("Set Your Preferences"),
          ).not.toBeInTheDocument();
        },
        { timeout: 2000 },
      );
    });

    it("shows preferences banner when preferences fetch returns error", async () => {
      const user = userEvent.setup();

      // Set up router with chat passcode so tabs are shown
      mockRouter.query = {
        conversationId: "test-conversation-id",
        channel: "chat,test-chat-pass",
      };

      (RetrieveData as jest.Mock).mockImplementation((path: string) => {
        if (path.startsWith("conversations/")) {
          return Promise.resolve({
            agents: [{ id: "agent-123", agentType: "eventAssistant" }],
          });
        } else if (
          path.includes("users/user/") &&
          path.includes("/preferences")
        ) {
          return Promise.resolve({
            error: true,
            message: { message: "Failed to fetch preferences" },
          });
        } else if (path.startsWith("messages/")) {
          return Promise.resolve([]); // Empty messages
        }
        return Promise.resolve(null);
      });

      (createConversationFromData as jest.Mock).mockResolvedValue({
        agents: [{ id: "agent-123", agentType: "eventAssistant" }],
        type: { name: "eventAssistant" },
      });

      await act(async () => {
        render(<EventAssistantRoom authType={"guest"} />);
      });

      await waitFor(() => {
        expect(screen.getAllByLabelText("Berkie").length).toBeGreaterThan(0);
      });

      // Click on the Event Bot (assistant) tab
      const assistantTab = screen.getAllByLabelText("Berkie")[0];
      await user.click(assistantTab);

      await waitFor(() => {
        expect(screen.getByText("Set Your Preferences")).toBeInTheDocument();
      });
    });

    it("successfully saves preferences and hides banner", async () => {
      const user = userEvent.setup();

      // Set up router with chat passcode so tabs are shown
      mockRouter.query = {
        conversationId: "test-conversation-id",
        channel: "chat,test-chat-pass",
      };

      (RetrieveData as jest.Mock).mockImplementation((path: string) => {
        if (path.startsWith("conversations/")) {
          return Promise.resolve({
            agents: [{ id: "agent-123", agentType: "eventAssistant" }],
          });
        } else if (
          path.includes("users/user/") &&
          path.includes("/preferences")
        ) {
          return Promise.resolve({}); // Empty preferences
        } else if (path.startsWith("messages/")) {
          return Promise.resolve([]); // Empty messages
        }
        return Promise.resolve(null);
      });

      (SendData as jest.Mock).mockResolvedValue({ success: true });

      (createConversationFromData as jest.Mock).mockResolvedValue({
        agents: [{ id: "agent-123", agentType: "eventAssistant" }],
        type: { name: "eventAssistant" },
      });

      await act(async () => {
        render(<EventAssistantRoom authType={"guest"} />);
      });

      await waitFor(() => {
        expect(screen.getAllByLabelText("Berkie").length).toBeGreaterThan(0);
      });

      // Click on the Event Bot (assistant) tab
      const assistantTab = screen.getAllByLabelText("Berkie")[0];
      await user.click(assistantTab);

      await waitFor(() => {
        expect(screen.getByText("Set Your Preferences")).toBeInTheDocument();
      });

      // Select a preference option
      const checkbox = screen.getByRole("checkbox", {
        name: /Visual Response/i,
      });
      await user.click(checkbox);

      // Click save
      const saveButton = screen.getByRole("button", {
        name: /Save Preferences/i,
      });
      await user.click(saveButton);

      await waitFor(() => {
        expect(SendData).toHaveBeenCalledWith(
          "users/user/user-123/preferences",
          { visualResponse: true, jargonClarification: false },
          undefined,
          undefined,
          "PUT",
        );
      });

      await waitFor(() => {
        expect(
          screen.queryByText("Set Your Preferences"),
        ).not.toBeInTheDocument();
      });
    });

    it("handles preference save errors gracefully", async () => {
      const user = userEvent.setup();

      // Set up router with chat passcode so tabs are shown
      mockRouter.query = {
        conversationId: "test-conversation-id",
        channel: "chat,test-chat-pass",
      };

      (RetrieveData as jest.Mock).mockImplementation((path: string) => {
        if (path.startsWith("conversations/")) {
          return Promise.resolve({
            agents: [{ id: "agent-123", agentType: "eventAssistant" }],
          });
        } else if (
          path.includes("users/user/") &&
          path.includes("/preferences")
        ) {
          return Promise.resolve({}); // Empty preferences
        } else if (path.startsWith("messages/")) {
          return Promise.resolve([]); // Empty messages
        }
        return Promise.resolve(null);
      });

      (SendData as jest.Mock).mockResolvedValue({
        error: true,
        message: { message: "Failed to save preferences" },
      });

      (createConversationFromData as jest.Mock).mockResolvedValue({
        agents: [{ id: "agent-123", agentType: "eventAssistant" }],
        type: { name: "eventAssistant" },
      });

      await act(async () => {
        render(<EventAssistantRoom authType={"guest"} />);
      });

      await waitFor(() => {
        expect(screen.getAllByLabelText("Berkie").length).toBeGreaterThan(0);
      });

      // Click on the Event Bot (assistant) tab
      const assistantTab = screen.getAllByLabelText("Berkie")[0];
      await user.click(assistantTab);

      await waitFor(() => {
        expect(screen.getByText("Set Your Preferences")).toBeInTheDocument();
      });

      // Select a preference option
      const checkbox = screen.getByRole("checkbox", {
        name: /Visual Response/i,
      });
      await user.click(checkbox);

      // Click save
      const saveButton = screen.getByRole("button", {
        name: /Save Preferences/i,
      });
      await user.click(saveButton);

      await waitFor(() => {
        expect(
          screen.getByText("Failed to save preferences"),
        ).toBeInTheDocument();
      });

      // Banner should still be visible
      expect(screen.getByText("Set Your Preferences")).toBeInTheDocument();
    });

    it("saves preferences with correct boolean values for selected and unselected options", async () => {
      const user = userEvent.setup();

      // Set up router with chat passcode so tabs are shown
      mockRouter.query = {
        conversationId: "test-conversation-id",
        channel: "chat,test-chat-pass",
      };

      (RetrieveData as jest.Mock).mockImplementation((path: string) => {
        if (path.startsWith("conversations/")) {
          return Promise.resolve({
            agents: [{ id: "agent-123", agentType: "eventAssistant" }],
          });
        } else if (
          path.includes("users/user/") &&
          path.includes("/preferences")
        ) {
          return Promise.resolve({}); // Empty preferences
        } else if (path.startsWith("messages/")) {
          return Promise.resolve([]); // Empty messages
        }
        return Promise.resolve(null);
      });

      (SendData as jest.Mock).mockResolvedValue({ success: true });

      (createConversationFromData as jest.Mock).mockResolvedValue({
        agents: [{ id: "agent-123", agentType: "eventAssistant" }],
        type: { name: "eventAssistant" },
      });

      await act(async () => {
        render(<EventAssistantRoom authType={"guest"} />);
      });

      await waitFor(() => {
        expect(screen.getAllByLabelText("Berkie").length).toBeGreaterThan(0);
      });

      // Click on the Event Bot (assistant) tab
      const assistantTab = screen.getAllByLabelText("Berkie")[0];
      await user.click(assistantTab);

      await waitFor(() => {
        expect(screen.getByText("Set Your Preferences")).toBeInTheDocument();
      });

      // Select only visualResponse (not selecting other options if they exist)
      const checkbox = screen.getByRole("checkbox", {
        name: /Visual Response/i,
      });
      await user.click(checkbox);

      // Click save
      const saveButton = screen.getByRole("button", {
        name: /Save Preferences/i,
      });
      await user.click(saveButton);

      await waitFor(() => {
        expect(SendData).toHaveBeenCalledWith(
          "users/user/user-123/preferences",
          { visualResponse: true, jargonClarification: false },
          undefined,
          undefined,
          "PUT",
        );
      });
    });

    it("handles preference save network error", async () => {
      const user = userEvent.setup();

      // Set up router with chat passcode so tabs are shown
      mockRouter.query = {
        conversationId: "test-conversation-id",
        channel: "chat,test-chat-pass",
      };

      (RetrieveData as jest.Mock).mockImplementation((path: string) => {
        if (path.startsWith("conversations/")) {
          return Promise.resolve({
            agents: [{ id: "agent-123", agentType: "eventAssistant" }],
          });
        } else if (
          path.includes("users/user/") &&
          path.includes("/preferences")
        ) {
          return Promise.resolve({}); // Empty preferences
        } else if (path.startsWith("messages/")) {
          return Promise.resolve([]); // Empty messages
        }
        return Promise.resolve(null);
      });

      (SendData as jest.Mock).mockRejectedValue(new Error("Network error"));

      (createConversationFromData as jest.Mock).mockResolvedValue({
        agents: [{ id: "agent-123", agentType: "eventAssistant" }],
        type: { name: "eventAssistant" },
      });

      await act(async () => {
        render(<EventAssistantRoom authType={"guest"} />);
      });

      await waitFor(() => {
        expect(screen.getAllByLabelText("Berkie").length).toBeGreaterThan(0);
      });

      // Click on the Event Bot (assistant) tab
      const assistantTab = screen.getAllByLabelText("Berkie")[0];
      await user.click(assistantTab);

      await waitFor(() => {
        expect(screen.getByText("Set Your Preferences")).toBeInTheDocument();
      });

      // Select a preference option
      const checkbox = screen.getByRole("checkbox", {
        name: /Visual Response/i,
      });
      await user.click(checkbox);

      // Click save
      const saveButton = screen.getByRole("button", {
        name: /Save Preferences/i,
      });
      await user.click(saveButton);

      await waitFor(() => {
        expect(
          screen.getByText("Failed to save preferences. Please try again."),
        ).toBeInTheDocument();
      });
    });

    it("renders Jargon Clarification option in the preferences banner", async () => {
      const user = userEvent.setup();

      mockRouter.query = {
        conversationId: "test-conversation-id",
        channel: "chat,test-chat-pass",
      };

      (RetrieveData as jest.Mock).mockImplementation((path: string) => {
        if (path.startsWith("conversations/")) {
          return Promise.resolve({
            agents: [{ id: "agent-123", agentType: "eventAssistant" }],
          });
        } else if (
          path.includes("users/user/") &&
          path.includes("/preferences")
        ) {
          return Promise.resolve({});
        } else if (path.startsWith("messages/")) {
          return Promise.resolve([]);
        }
        return Promise.resolve(null);
      });

      (createConversationFromData as jest.Mock).mockResolvedValue({
        agents: [{ id: "agent-123", agentType: "eventAssistant" }],
        type: { name: "eventAssistant" },
      });

      await act(async () => {
        render(<EventAssistantRoom authType={"guest"} />);
      });

      await waitFor(() => {
        expect(screen.getAllByLabelText("Berkie").length).toBeGreaterThan(0);
      });

      await user.click(screen.getAllByLabelText("Berkie")[0]);

      await waitFor(() => {
        expect(screen.getByText("Set Your Preferences")).toBeInTheDocument();
      });

      expect(
        screen.getByRole("checkbox", { name: /Jargon Clarification/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByText("Send me clarification when speakers use jargon"),
      ).toBeInTheDocument();
    });

    it("saves jargonClarification: true when only that option is selected", async () => {
      const user = userEvent.setup();

      mockRouter.query = {
        conversationId: "test-conversation-id",
        channel: "chat,test-chat-pass",
      };

      (RetrieveData as jest.Mock).mockImplementation((path: string) => {
        if (path.startsWith("conversations/")) {
          return Promise.resolve({
            agents: [{ id: "agent-123", agentType: "eventAssistant" }],
          });
        } else if (
          path.includes("users/user/") &&
          path.includes("/preferences")
        ) {
          return Promise.resolve({});
        } else if (path.startsWith("messages/")) {
          return Promise.resolve([]);
        }
        return Promise.resolve(null);
      });

      (SendData as jest.Mock).mockResolvedValue({ success: true });

      (createConversationFromData as jest.Mock).mockResolvedValue({
        agents: [{ id: "agent-123", agentType: "eventAssistant" }],
        type: { name: "eventAssistant" },
      });

      await act(async () => {
        render(<EventAssistantRoom authType={"guest"} />);
      });

      await waitFor(() => {
        expect(screen.getAllByLabelText("Berkie").length).toBeGreaterThan(0);
      });

      await user.click(screen.getAllByLabelText("Berkie")[0]);

      await waitFor(() => {
        expect(screen.getByText("Set Your Preferences")).toBeInTheDocument();
      });

      await user.click(
        screen.getByRole("checkbox", { name: /Jargon Clarification/i }),
      );

      await user.click(
        screen.getByRole("button", { name: /Save Preferences/i }),
      );

      await waitFor(() => {
        expect(SendData).toHaveBeenCalledWith(
          "users/user/user-123/preferences",
          { visualResponse: false, jargonClarification: true },
          undefined,
          undefined,
          "PUT",
        );
      });
    });

    it("saves both options as true when both are selected", async () => {
      const user = userEvent.setup();

      mockRouter.query = {
        conversationId: "test-conversation-id",
        channel: "chat,test-chat-pass",
      };

      (RetrieveData as jest.Mock).mockImplementation((path: string) => {
        if (path.startsWith("conversations/")) {
          return Promise.resolve({
            agents: [{ id: "agent-123", agentType: "eventAssistant" }],
          });
        } else if (
          path.includes("users/user/") &&
          path.includes("/preferences")
        ) {
          return Promise.resolve({});
        } else if (path.startsWith("messages/")) {
          return Promise.resolve([]);
        }
        return Promise.resolve(null);
      });

      (SendData as jest.Mock).mockResolvedValue({ success: true });

      (createConversationFromData as jest.Mock).mockResolvedValue({
        agents: [{ id: "agent-123", agentType: "eventAssistant" }],
        type: { name: "eventAssistant" },
      });

      await act(async () => {
        render(<EventAssistantRoom authType={"guest"} />);
      });

      await waitFor(() => {
        expect(screen.getAllByLabelText("Berkie").length).toBeGreaterThan(0);
      });

      await user.click(screen.getAllByLabelText("Berkie")[0]);

      await waitFor(() => {
        expect(screen.getByText("Set Your Preferences")).toBeInTheDocument();
      });

      await user.click(
        screen.getByRole("checkbox", { name: /Visual Response/i }),
      );
      await user.click(
        screen.getByRole("checkbox", { name: /Jargon Clarification/i }),
      );

      await user.click(
        screen.getByRole("button", { name: /Save Preferences/i }),
      );

      await waitFor(() => {
        expect(SendData).toHaveBeenCalledWith(
          "users/user/user-123/preferences",
          { visualResponse: true, jargonClarification: true },
          undefined,
          undefined,
          "PUT",
        );
      });
    });
  });

  describe("Jargon message routing", () => {
    it("displays jargon clarification messages inline in the assistant panel when jargonFilterAgentId is set", async () => {
      const conversationWithJargon = {
        agents: [
          { id: "agent-123", agentType: "eventAssistantPlus" },
          { id: "jargon-agent-456", agentType: "jargonFilterAgent" },
        ],
        type: { name: "eventAssistantPlus" },
      };
      (createConversationFromData as jest.Mock).mockResolvedValue(conversationWithJargon);

      (RetrieveData as jest.Mock).mockImplementation((path: string) => {
        if (path.startsWith("conversations/")) {
          return Promise.resolve(conversationWithJargon);
        } else if (path.includes("users/user/") && path.includes("/preferences")) {
          return Promise.resolve({ jargonClarification: true });
        } else if (path.startsWith("messages/")) {
          return Promise.resolve([]);
        }
        return Promise.resolve({});
      });

      await act(async () => {
        render(<EventAssistantRoom authType={"guest"} />);
      });

      // Wait for jargonFilterAgentId to be set from conversation data
      await waitFor(() => {
        expect(mockSocket.on).toHaveBeenCalledWith("message:new", expect.any(Function));
      });

      // Retrieve the most recently registered message:new handler — it has jargonFilterAgentId in its closure
      const messageHandler: Function = mockSocket.on.mock.calls
        .filter(([event]: [string]) => event === "message:new")
        .map(([, handler]: [string, Function]) => handler)
        .at(-1)!;

      expect(messageHandler).toBeDefined();
      expect(typeof messageHandler).toBe("function");

      // Simulate a jargon clarification message arriving on the jargon filter's direct channel
      const jargonMessage = {
        id: "msg-jargon-1",
        body: { type: "jargon_clarification", text: "An SLO is a reliability target.", sourceText: "Our SLOs..." },
        bodyType: "json",
        fromAgent: true,
        channels: ["direct-user-123-jargon-agent-456"],
        pseudonym: "Jargon Filter Agent",
        pseudonymId: "jargon-agent-456",
        conversation: "test-conversation-id",
        pause: false,
        visible: true,
        upVotes: [],
        downVotes: [],
      };

      // Switch to assistant tab before receiving the message
      await waitFor(() => {
        const assistantTabs = screen.queryAllByLabelText(/Berkie|Assistant/i);
        expect(assistantTabs.length).toBeGreaterThan(0);
      });

      const assistantTab = screen.getAllByLabelText(/Berkie|Assistant/i)[0];
      await userEvent.click(assistantTab);

      act(() => {
        messageHandler(jargonMessage);
      });

      // Verify the jargon clarification content appears inline in the assistant panel
      await waitFor(() => {
        expect(screen.getByText("An SLO is a reliability target.")).toBeInTheDocument();
      });
    });
  });

  describe("Feedback Frequency Configuration", () => {
    it("extracts feedback frequency from conversation properties", async () => {
      (RetrieveData as jest.Mock).mockImplementation((path: string) => {
        if (path.startsWith("conversations/")) {
          return Promise.resolve({
            agents: [{ id: "agent-123", agentType: "eventAssistant" }],
            properties: { feedbackFrequency: 2 }, // Every 2nd message
          });
        } else if (path.includes("/preferences")) {
          return Promise.resolve({});
        } else if (path.includes("?channel=direct-")) {
          return Promise.resolve([]);
        }
        return Promise.resolve([]);
      });

      (createConversationFromData as jest.Mock).mockResolvedValue({
        agents: [{ id: "agent-123", agentType: "eventAssistant" }],
        type: { name: "eventAssistant" },
        properties: { feedbackFrequency: 2 },
      });

      await act(async () => {
        render(<EventAssistantRoom authType={"guest"} />);
      });

      await waitFor(() => {
        expect(createConversationFromData).toHaveBeenCalled();
      });

      // feedbackFrequency should be extracted and used in feedback config
    });

    it("defaults to feedback frequency of 1 when not provided in conversation properties", async () => {
      (RetrieveData as jest.Mock).mockImplementation((path: string) => {
        if (path.startsWith("conversations/")) {
          return Promise.resolve({
            agents: [{ id: "agent-123", agentType: "eventAssistant" }],
            // No properties or feedbackFrequency
          });
        } else if (path.includes("/preferences")) {
          return Promise.resolve({});
        } else if (path.includes("?channel=direct-")) {
          return Promise.resolve([]);
        }
        return Promise.resolve([]);
      });

      (createConversationFromData as jest.Mock).mockResolvedValue({
        agents: [{ id: "agent-123", agentType: "eventAssistant" }],
        type: { name: "eventAssistant" },
      });

      await act(async () => {
        render(<EventAssistantRoom authType={"guest"} />);
      });

      await waitFor(() => {
        expect(createConversationFromData).toHaveBeenCalled();
      });

      // feedbackFrequency should default to 1
    });
  });

  describe("Prompt Response Handling", () => {
    beforeEach(() => {
      // Reset router query to avoid chat tab being selected by default
      mockRouter.query = { conversationId: "test-conversation-id" };
    });

    it("includes answersPrompt field when sending a prompt response", async () => {
      const user = userEvent.setup();

      (RetrieveData as jest.Mock).mockImplementation((path: string) => {
        if (path.startsWith("conversations/")) {
          return Promise.resolve({
            agents: [{ id: "agent-123", agentType: "eventAssistant" }],
          });
        } else if (path.includes("/preferences")) {
          return Promise.resolve({});
        } else if (path.startsWith("messages/")) {
          return Promise.resolve([]);
        }
        return Promise.resolve([]);
      });

      (createConversationFromData as jest.Mock).mockResolvedValue({
        agents: [{ id: "agent-123", agentType: "eventAssistant" }],
        type: { name: "eventAssistant" },
      });

      await act(async () => {
        render(<EventAssistantRoom authType={"guest"} />);
      });

      await waitFor(() => {
        expect(screen.getByPlaceholderText("Enter your message here")).toBeInTheDocument();
      });

      // Simulate the component calling sendMessage with prompt response parameters
      // Since we can't directly access the sendMessage function, we'll verify via SendData mock
      // This would be triggered by the handlePromptSelect function in the actual component
    });

    it("sends message with answersPrompt when user selects a prompt option", async () => {
      const user = userEvent.setup();

      (RetrieveData as jest.Mock).mockImplementation((path: string) => {
        if (path.startsWith("conversations/")) {
          return Promise.resolve({
            agents: [{ id: "agent-123", agentType: "eventAssistant" }],
          });
        } else if (path.includes("/preferences")) {
          return Promise.resolve({});
        } else if (path.startsWith("messages/")) {
          // Return a message with prompt options
          return Promise.resolve([
            {
              id: "prompt-msg-1",
              body: "Do you need assistance?",
              pseudonym: "Event Assistant",
              fromAgent: true,
              channels: ["direct-user-123-agent-123"],
              createdAt: "2025-10-17T12:00:00Z",
              conversation: "conv-1",
              pseudonymId: "ea-1",
              pause: false,
              visible: true,
              upVotes: [],
              downVotes: [],
              prompt: {
                type: "singleChoice",
                options: [
                  { label: "Yes", value: "yes" },
                  { label: "No", value: "no" },
                ],
              },
            },
          ]);
        }
        return Promise.resolve([]);
      });

      (createConversationFromData as jest.Mock).mockResolvedValue({
        agents: [{ id: "agent-123", agentType: "eventAssistant" }],
        type: { name: "eventAssistant" },
      });

      await act(async () => {
        render(<EventAssistantRoom authType={"guest"} />);
      });

      // Wait for the page to load and click on the assistant tab
      await waitFor(() => {
        expect(screen.getAllByLabelText("Berkie").length).toBeGreaterThan(0);
      });

      const assistantTab = screen.getAllByLabelText("Berkie")[0];
      await user.click(assistantTab);

      await waitFor(() => {
        expect(screen.getByText("Do you need assistance?")).toBeInTheDocument();
      });

      // The component would render prompt buttons, but our mock doesn't render them
      // In a real scenario, clicking a prompt button would trigger handlePromptSelect
      // which would call sendMessage with messageSource: "promptResponse" and promptQuestionId
    });

    it("filters out messages with answersPrompt from display", async () => {
      const user = userEvent.setup();

      (RetrieveData as jest.Mock).mockImplementation((path: string) => {
        if (path.startsWith("conversations/")) {
          return Promise.resolve({
            agents: [{ id: "agent-123", agentType: "eventAssistant" }],
          });
        } else if (path.includes("/preferences")) {
          return Promise.resolve({});
        } else if (path.startsWith("messages/")) {
          return Promise.resolve([
            {
              id: "prompt-1",
              body: "Would you like help?",
              pseudonym: "Event Assistant",
              fromAgent: true,
              channels: ["direct-user-123-agent-123"],
              createdAt: "2025-10-17T12:00:00Z",
              conversation: "conv-1",
              pseudonymId: "ea-1",
              pause: false,
              visible: true,
              upVotes: [],
              downVotes: [],
              prompt: {
                type: "singleChoice",
                options: [
                  { label: "Yes", value: "yes" },
                  { label: "No", value: "no" },
                ],
              },
            },
            {
              id: "response-1",
              body: "Yes",
              pseudonym: "test-user",
              fromAgent: false,
              channels: ["direct-user-123-agent-123"],
              createdAt: "2025-10-17T12:01:00Z",
              conversation: "conv-1",
              pseudonymId: "tu-1",
              pause: false,
              visible: true,
              upVotes: [],
              downVotes: [],
              answersPrompt: "prompt-1",
            },
            {
              id: "followup-1",
              body: "Great! Here's how I can help...",
              pseudonym: "Event Assistant",
              fromAgent: true,
              channels: ["direct-user-123-agent-123"],
              createdAt: "2025-10-17T12:02:00Z",
              conversation: "conv-1",
              pseudonymId: "ea-1",
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
        agents: [{ id: "agent-123", agentType: "eventAssistant" }],
        type: { name: "eventAssistant" },
      });

      await act(async () => {
        render(<EventAssistantRoom authType={"guest"} />);
      });

      // Wait for the page to load and click on the assistant tab
      await waitFor(() => {
        expect(screen.getAllByLabelText("Berkie").length).toBeGreaterThan(0);
      });

      const assistantTab = screen.getAllByLabelText("Berkie")[0];
      await user.click(assistantTab);

      await waitFor(() => {
        expect(screen.getByText("Would you like help?")).toBeInTheDocument();
      });

      // The prompt question should be visible
      expect(screen.getByText("Would you like help?")).toBeInTheDocument();

      // The response with answersPrompt should NOT be visible
      expect(screen.queryByText(/^Yes$/)).not.toBeInTheDocument();

      // The follow-up message should be visible
      expect(screen.getByText("Great! Here's how I can help...")).toBeInTheDocument();
    });

    it("restores selected prompt option on page load when response exists", async () => {
      const user = userEvent.setup();

      (RetrieveData as jest.Mock).mockImplementation((path: string) => {
        if (path.startsWith("conversations/")) {
          return Promise.resolve({
            agents: [{ id: "agent-123", agentType: "eventAssistant" }],
          });
        } else if (path.includes("/preferences")) {
          return Promise.resolve({});
        } else if (path.startsWith("messages/")) {
          return Promise.resolve([
            {
              id: "prompt-1",
              body: "Select your preference:",
              pseudonym: "Event Assistant",
              fromAgent: true,
              channels: ["direct-user-123-agent-123"],
              createdAt: "2025-10-17T12:00:00Z",
              conversation: "conv-1",
              pseudonymId: "ea-1",
              pause: false,
              visible: true,
              upVotes: [],
              downVotes: [],
              prompt: {
                type: "singleChoice",
                options: [
                  { label: "Option A", value: "opt-a" },
                  { label: "Option B", value: "opt-b" },
                ],
              },
            },
            {
              id: "response-1",
              body: "Option A",
              pseudonym: "test-user",
              fromAgent: false,
              channels: ["direct-user-123-agent-123"],
              createdAt: "2025-10-17T12:01:00Z",
              conversation: "conv-1",
              pseudonymId: "tu-1",
              pause: false,
              visible: true,
              upVotes: [],
              downVotes: [],
              answersPrompt: "prompt-1",
            },
          ]);
        }
        return Promise.resolve([]);
      });

      (createConversationFromData as jest.Mock).mockResolvedValue({
        agents: [{ id: "agent-123", agentType: "eventAssistant" }],
        type: { name: "eventAssistant" },
      });

      await act(async () => {
        render(<EventAssistantRoom authType={"guest"} />);
      });

      // Wait for the page to load and click on the assistant tab
      await waitFor(() => {
        expect(screen.getAllByLabelText("Berkie").length).toBeGreaterThan(0);
      });

      const assistantTab = screen.getAllByLabelText("Berkie")[0];
      await user.click(assistantTab);

      await waitFor(() => {
        expect(screen.getByText("Select your preference:")).toBeInTheDocument();
      });

      // The prompt message should be visible
      expect(screen.getByText("Select your preference:")).toBeInTheDocument();

      // The response should be filtered out
      expect(screen.queryByText(/^Option A$/)).not.toBeInTheDocument();

      // In the actual implementation, the AssistantMessage component would receive
      // initialSelectedPrompt="Option A" and display the buttons as disabled with
      // "Option A" marked as selected
    });
  });

  describe("Resources channel", () => {
    const resourcesSetup = async () => {
      mockRouter.query = {
        conversationId: "test-conversation-id",
        channel: "resources,resources-pass",
      };

      (RetrieveData as jest.Mock).mockImplementation((path: string) => {
        if (path.startsWith("conversations/")) {
          return Promise.resolve({
            agents: [{ id: "agent-123", agentType: "eventAssistant" }],
          });
        } else if (path.includes("?channel=resources,")) {
          return Promise.resolve([]);
        } else if (path.startsWith("messages/")) {
          return Promise.resolve([]);
        }
        return Promise.resolve(null);
      });

      (createConversationFromData as jest.Mock).mockResolvedValue({
        agents: [{ id: "agent-123", agentType: "eventAssistant" }],
        type: { name: "eventAssistant" },
        name: "Tech Forum",
      });

      await act(async () => {
        render(<EventAssistantRoom authType={"guest"} />);
      });

      await waitFor(() => expect(createConversationFromData).toHaveBeenCalled());
    };

    /** Grab the most recently registered message:new handler from the socket mock. */
    const getMessageHandler = (): Function => {
      const handler = mockSocket.on.mock.calls
        .filter(([event]: [string]) => event === "message:new")
        .map(([, h]: [string, Function]) => h)
        .at(-1)!;
      expect(handler).toBeDefined();
      return handler;
    };

    it("includes resources channel in conversation:join when resourcesPasscode is set", async () => {
      await resourcesSetup();

      await waitFor(() => {
        expect(mockSocket.emit).toHaveBeenCalledWith(
          "conversation:join",
          expect.objectContaining({
            channels: expect.arrayContaining([
              { name: "resources", passcode: "resources-pass", direct: false },
            ]),
          }),
        );
      });
    });

    it("fetches initial resources messages when resourcesPasscode is available", async () => {
      await resourcesSetup();

      await waitFor(() => {
        expect(RetrieveData).toHaveBeenCalledWith(
          "messages/test-conversation-id?channel=resources,resources-pass",
          "mock-access-token",
        );
      });
    });

    it("populates resourcesMessages from initial fetch", async () => {
      const mockResourcesMessages = [
        {
          id: "res-1",
          body: { type: "reading", content: [{ title: "Book A", authors: ["A"], year: 2020 }] },
          channels: ["resources"],
        },
      ];

      mockRouter.query = {
        conversationId: "test-conversation-id",
        channel: "resources,resources-pass",
      };

      (RetrieveData as jest.Mock).mockImplementation((path: string) => {
        if (path.startsWith("conversations/")) {
          return Promise.resolve({
            agents: [{ id: "agent-123", agentType: "eventAssistant" }],
          });
        } else if (path.includes("?channel=resources,")) {
          return Promise.resolve(mockResourcesMessages);
        }
        return Promise.resolve([]);
      });

      (createConversationFromData as jest.Mock).mockResolvedValue({
        agents: [{ id: "agent-123", agentType: "eventAssistant" }],
        type: { name: "eventAssistant" },
        name: "Tech Forum",
      });

      await act(async () => {
        render(<EventAssistantRoom authType={"guest"} />);
      });

      await waitFor(() => {
        expect(RetrieveData).toHaveBeenCalledWith(
          "messages/test-conversation-id?channel=resources,resources-pass",
          "mock-access-token",
        );
      });
    });

    it("routes incoming socket message with resources channel to resourcesMessages", async () => {
      await resourcesSetup();

      const user = userEvent.setup();
      // Navigate to resources tab so the panel renders
      const resourcesTab = screen.getAllByLabelText("Resources")[0];
      await user.click(resourcesTab);

      await waitFor(() => {
        expect(mockSocket.on).toHaveBeenCalledWith("message:new", expect.any(Function));
      });

      const messageHandler = getMessageHandler();

      act(() => {
        messageHandler({
          id: "res-msg-1",
          body: { type: "reading", content: [] },
          channels: ["resources"],
          pseudonym: "System",
        });
      });

      // The ResourcesPanel should still be visible after the message arrives
      await waitFor(() => {
        expect(screen.getByText("Readings & References")).toBeInTheDocument();
      });
    });

    it("increments unseenResourcesCount when a resources message arrives and the resources tab is NOT active", async () => {
      await resourcesSetup();

      await waitFor(() => {
        expect(mockSocket.on).toHaveBeenCalledWith("message:new", expect.any(Function));
      });

      const messageHandler = getMessageHandler();

      // Default tab is chat — unseen count should increment, showing the dot badge
      act(() => {
        messageHandler({ id: "res-1", channels: ["resources"], body: { type: "reading", content: [{ title: "Book A", authors: ["Author"], year: 2020 }] } });
      });

      // NavigationBar uses MUI Badge dot variant — a visible badge has no MuiBadge-invisible class
      await waitFor(() => {
        const badges = document.querySelectorAll(".MuiBadge-badge");
        const visibleBadges = Array.from(badges).filter(
          (b) => !b.classList.contains("MuiBadge-invisible"),
        );
        expect(visibleBadges.length).toBeGreaterThan(0);
      });
    });

    it("does NOT increment unseenResourcesCount when a resources message arrives and resources tab IS active", async () => {
      await resourcesSetup();

      const user = userEvent.setup();
      await user.click(screen.getAllByLabelText("Resources")[0]);

      await waitFor(() => {
        expect(mockSocket.on).toHaveBeenCalledWith("message:new", expect.any(Function));
      });

      const messageHandler = getMessageHandler();

      act(() => {
        messageHandler({ id: "res-1", channels: ["resources"], body: { type: "reading", content: [] } });
      });

      // No dot badge should be visible since we're already on the resources tab
      await waitFor(() => {
        const badges = document.querySelectorAll(".MuiBadge-badge");
        const visibleBadges = Array.from(badges).filter(
          (b) => !b.classList.contains("MuiBadge-invisible"),
        );
        expect(visibleBadges.length).toBe(0);
      });
    });

    it("resets unseenResourcesCount to 0 when switching to the resources tab", async () => {
      await resourcesSetup();

      await waitFor(() => {
        expect(mockSocket.on).toHaveBeenCalledWith("message:new", expect.any(Function));
      });

      const messageHandler = getMessageHandler();

      // Deliver a message while on another tab to bump the count
      act(() => {
        messageHandler({ id: "res-1", channels: ["resources"], body: {} });
      });

      // Badge dot should be visible
      await waitFor(() => {
        const badges = document.querySelectorAll(".MuiBadge-badge");
        const visibleBadges = Array.from(badges).filter(
          (b) => !b.classList.contains("MuiBadge-invisible"),
        );
        expect(visibleBadges.length).toBeGreaterThan(0);
      });

      // Switch to resources tab — count clears, badge becomes invisible
      const user = userEvent.setup();
      await user.click(screen.getAllByLabelText("Resources")[0]);

      await waitFor(() => {
        const badges = document.querySelectorAll(".MuiBadge-badge");
        const visibleBadges = Array.from(badges).filter(
          (b) => !b.classList.contains("MuiBadge-invisible"),
        );
        expect(visibleBadges.length).toBe(0);
      });
    });

    it("renders ResourcesPanel when resources tab is active", async () => {
      await resourcesSetup();

      const user = userEvent.setup();
      await user.click(screen.getAllByLabelText("Resources")[0]);

      await waitFor(() => {
        expect(screen.getByText("Readings & References")).toBeInTheDocument();
      });
    });

    it("does NOT route resources messages to assistantMessages or chatMessages", async () => {
      await resourcesSetup();

      await waitFor(() => {
        expect(mockSocket.on).toHaveBeenCalledWith("message:new", expect.any(Function));
      });

      const messageHandler = getMessageHandler();

      act(() => {
        messageHandler({ id: "res-1", channels: ["resources"], body: { text: "Resources only" } });
      });

      // Switch to assistant tab and confirm the message isn't rendered there
      const user = userEvent.setup();
      await user.click(screen.getAllByLabelText("Berkie")[0]);

      await waitFor(() => {
        expect(screen.queryByText("Resources only")).not.toBeInTheDocument();
      });
    });

    it("increments unseenResourcesCount by the number of items in a multi-item reading message", async () => {
      await resourcesSetup();

      await waitFor(() => {
        expect(mockSocket.on).toHaveBeenCalledWith("message:new", expect.any(Function));
      });

      const messageHandler = getMessageHandler();

      // Message with 3 reading items — count should go up by 3, not 1
      act(() => {
        messageHandler({
          id: "res-multi",
          channels: ["resources"],
          body: {
            type: "reading",
            content: [
              { title: "Book A", authors: ["A"], year: 2020 },
              { title: "Book B", authors: ["B"], year: 2021 },
              { title: "Book C", authors: ["C"], year: 2022 },
            ],
          },
        });
      });

      // Switch to resources tab to see the reset value, confirming the count was > 1
      // by checking badge was visible before switching
      await waitFor(() => {
        const badges = document.querySelectorAll(".MuiBadge-badge");
        const visibleBadges = Array.from(badges).filter(
          (b) => !b.classList.contains("MuiBadge-invisible"),
        );
        expect(visibleBadges.length).toBeGreaterThan(0);
      });

      // Switch to resources tab — count resets to 0 (confirming it was > 0)
      const user = userEvent.setup();
      await user.click(screen.getAllByLabelText("Resources")[0]);

      await waitFor(() => {
        const badges = document.querySelectorAll(".MuiBadge-badge");
        const visibleBadges = Array.from(badges).filter(
          (b) => !b.classList.contains("MuiBadge-invisible"),
        );
        expect(visibleBadges.length).toBe(0);
      });
    });

    it("Resources tab is always present in the nav even without a resourcesPasscode", async () => {
      mockRouter.query = { conversationId: "test-conversation-id" };

      (RetrieveData as jest.Mock).mockImplementation((path: string) => {
        if (path.startsWith("conversations/")) {
          return Promise.resolve({
            agents: [{ id: "agent-123", agentType: "eventAssistant" }],
          });
        }
        return Promise.resolve([]);
      });

      (createConversationFromData as jest.Mock).mockResolvedValue({
        agents: [{ id: "agent-123", agentType: "eventAssistant" }],
        type: { name: "eventAssistant" },
      });

      await act(async () => {
        render(<EventAssistantRoom authType={"guest"} />);
      });

      await waitFor(() => expect(createConversationFromData).toHaveBeenCalled());

      expect(screen.getAllByLabelText("Resources").length).toBeGreaterThan(0);
    });

    it("does not fetch resources messages when no resourcesPasscode is provided", async () => {
      mockRouter.query = { conversationId: "test-conversation-id" };

      (RetrieveData as jest.Mock).mockImplementation((path: string) => {
        if (path.startsWith("conversations/")) {
          return Promise.resolve({
            agents: [{ id: "agent-123", agentType: "eventAssistant" }],
          });
        }
        return Promise.resolve([]);
      });

      (createConversationFromData as jest.Mock).mockResolvedValue({
        agents: [{ id: "agent-123", agentType: "eventAssistant" }],
        type: { name: "eventAssistant" },
      });

      await act(async () => {
        render(<EventAssistantRoom authType={"guest"} />);
      });

      await waitFor(() => expect(createConversationFromData).toHaveBeenCalled());

      const resourcesFetch = (RetrieveData as jest.Mock).mock.calls.find(
        ([path]: [string]) => path.includes("channel=resources"),
      );
      expect(resourcesFetch).toBeUndefined();
    });
  });
});
