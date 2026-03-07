import React from "react";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import EventAssistantRoom from "../../pages/assistant";
import { RetrieveData, SendData } from "../../utils";
import { createConversationFromData } from "../../utils/Helpers";
import { io } from "socket.io-client";
import { useSessionJoin } from "../../utils/useSessionJoin";

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
          return Promise.resolve([]); // Return empty chat messages
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

      await waitFor(() => {
        expect(
          screen.getByPlaceholderText("Enter your message here"),
        ).toBeInTheDocument();
      });

      // Wait for all promises to resolve (conversation data loading)
      await act(async () => {
        await Promise.resolve(); // Let RetrieveData promise resolve
        await Promise.resolve(); // Let createConversationFromData promise resolve
      });

      // Allow React to process state updates
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
      });

      const user = userEvent.setup();

      // Click on the Event Assistant tab to switch from Chat (default) to Assistant
      const assistantTab = screen.getByText("Event Assistant");
      await user.click(assistantTab);

      const input = screen.getByPlaceholderText("Enter your message here");

      await user.type(input, "/");

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

      // Click on the Event Assistant tab to switch from Chat (default) to Assistant
      const assistantTab = screen.getByText("Event Assistant");
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

      (RetrieveData as jest.Mock)
        .mockResolvedValueOnce({
          agents: [{ id: "agent-123", agentType: "eventAssistant" }],
        })
        .mockResolvedValueOnce([]) // Empty chat messages
        .mockResolvedValueOnce({}) // Empty preferences object
        .mockResolvedValueOnce([]); // Empty assistant messages

      (createConversationFromData as jest.Mock).mockResolvedValue({
        agents: [{ id: "agent-123", agentType: "eventAssistant" }],
        type: { name: "eventAssistant" },
      });

      await act(async () => {
        render(<EventAssistantRoom authType={"guest"} />);
      });

      await waitFor(() => {
        expect(screen.getByText("Event Assistant")).toBeInTheDocument();
      });

      // Click on the Event Assistant tab to show preferences
      const assistantTab = screen.getByText("Event Assistant");
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
        } else if (path.includes("users/user/") && path.includes("/preferences")) {
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
        expect(screen.getByText("Event Assistant")).toBeInTheDocument();
      });

      // Click on the Event Assistant tab
      const assistantTab = screen.getByText("Event Assistant");
      await user.click(assistantTab);

      await waitFor(() => {
        expect(screen.getByPlaceholderText("Enter your message here")).toBeInTheDocument();
      });

      // Wait for preferences to be loaded and the banner to be hidden
      await waitFor(
        () => {
          expect(
            screen.queryByText("Set Your Preferences"),
          ).not.toBeInTheDocument();
        },
        { timeout: 2000 }
      );
    });

    it("shows preferences banner when preferences fetch returns error", async () => {
      const user = userEvent.setup();

      // Set up router with chat passcode so tabs are shown
      mockRouter.query = {
        conversationId: "test-conversation-id",
        channel: "chat,test-chat-pass",
      };

      (RetrieveData as jest.Mock)
        .mockResolvedValueOnce({
          agents: [{ id: "agent-123", agentType: "eventAssistant" }],
        })
        .mockResolvedValueOnce([]) // Empty chat messages
        .mockResolvedValueOnce({
          error: true,
          message: { message: "Failed to fetch preferences" },
        })
        .mockResolvedValueOnce([]); // Empty assistant messages

      (createConversationFromData as jest.Mock).mockResolvedValue({
        agents: [{ id: "agent-123", agentType: "eventAssistant" }],
        type: { name: "eventAssistant" },
      });

      await act(async () => {
        render(<EventAssistantRoom authType={"guest"} />);
      });

      await waitFor(() => {
        expect(screen.getByText("Event Assistant")).toBeInTheDocument();
      });

      // Click on the Event Assistant tab
      const assistantTab = screen.getByText("Event Assistant");
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

      (RetrieveData as jest.Mock)
        .mockResolvedValueOnce({
          agents: [{ id: "agent-123", agentType: "eventAssistant" }],
        })
        .mockResolvedValueOnce([]) // Empty chat messages
        .mockResolvedValueOnce({}) // Empty preferences
        .mockResolvedValueOnce([]); // Empty assistant messages

      (SendData as jest.Mock).mockResolvedValue({ success: true });

      (createConversationFromData as jest.Mock).mockResolvedValue({
        agents: [{ id: "agent-123", agentType: "eventAssistant" }],
        type: { name: "eventAssistant" },
      });

      await act(async () => {
        render(<EventAssistantRoom authType={"guest"} />);
      });

      await waitFor(() => {
        expect(screen.getByText("Event Assistant")).toBeInTheDocument();
      });

      // Click on the Event Assistant tab
      const assistantTab = screen.getByText("Event Assistant");
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
          { visualResponse: true },
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

      (RetrieveData as jest.Mock)
        .mockResolvedValueOnce({
          agents: [{ id: "agent-123", agentType: "eventAssistant" }],
        })
        .mockResolvedValueOnce([]) // Empty chat messages
        .mockResolvedValueOnce({}) // Empty preferences
        .mockResolvedValueOnce([]); // Empty assistant messages

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
        expect(screen.getByText("Event Assistant")).toBeInTheDocument();
      });

      // Click on the Event Assistant tab
      const assistantTab = screen.getByText("Event Assistant");
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
        expect(screen.getByText("Failed to save preferences")).toBeInTheDocument();
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

      (RetrieveData as jest.Mock)
        .mockResolvedValueOnce({
          agents: [{ id: "agent-123", agentType: "eventAssistant" }],
        })
        .mockResolvedValueOnce([]) // Empty chat messages
        .mockResolvedValueOnce({}) // Empty preferences
        .mockResolvedValueOnce([]); // Empty assistant messages

      (SendData as jest.Mock).mockResolvedValue({ success: true });

      (createConversationFromData as jest.Mock).mockResolvedValue({
        agents: [{ id: "agent-123", agentType: "eventAssistant" }],
        type: { name: "eventAssistant" },
      });

      await act(async () => {
        render(<EventAssistantRoom authType={"guest"} />);
      });

      await waitFor(() => {
        expect(screen.getByText("Event Assistant")).toBeInTheDocument();
      });

      // Click on the Event Assistant tab
      const assistantTab = screen.getByText("Event Assistant");
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
          { visualResponse: true },
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

      (RetrieveData as jest.Mock)
        .mockResolvedValueOnce({
          agents: [{ id: "agent-123", agentType: "eventAssistant" }],
        })
        .mockResolvedValueOnce([]) // Empty chat messages
        .mockResolvedValueOnce({}) // Empty preferences
        .mockResolvedValueOnce([]); // Empty assistant messages

      (SendData as jest.Mock).mockRejectedValue(new Error("Network error"));

      (createConversationFromData as jest.Mock).mockResolvedValue({
        agents: [{ id: "agent-123", agentType: "eventAssistant" }],
        type: { name: "eventAssistant" },
      });

      await act(async () => {
        render(<EventAssistantRoom authType={"guest"} />);
      });

      await waitFor(() => {
        expect(screen.getByText("Event Assistant")).toBeInTheDocument();
      });

      // Click on the Event Assistant tab
      const assistantTab = screen.getByText("Event Assistant");
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
  });
});
