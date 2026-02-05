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
  query: { conversationId: "test-conversation-id" },
  isReady: true,
};

jest.mock("next/router", () => ({
  useRouter: () => mockRouter,
}));

// Mock socket.io-client
const mockSocket = {
  on: jest.fn(),
  off: jest.fn(),
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
    })),
  },
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
      const result = render(<EventAssistantRoom isAuthenticated={false} />);
      container = result.container;
    });

    // Should show loading indicator (animated circles)
    const loadingCircles = container!.querySelectorAll(".animate-bounce");
    expect(loadingCircles.length).toBeGreaterThan(0);
  });

  it("initializes socket connection on mount", async () => {
    await act(async () => {
      render(<EventAssistantRoom isAuthenticated={false} />);
    });

    await waitFor(() => {
      expect(mockUseSessionJoin).toHaveBeenCalled();
    });
  });

  it("sets up socket event listeners", async () => {
    await act(async () => {
      render(<EventAssistantRoom isAuthenticated={false} />);
    });

    // useSessionJoin handles error/connect/disconnect events internally
    // The page component sets up message:new listener
    await waitFor(() => {
      expect(mockSocket.on).toHaveBeenCalledWith("message:new", expect.any(Function));
    });
  });

  it("fetches conversation data when router is ready", async () => {
    await act(async () => {
      render(<EventAssistantRoom isAuthenticated={false} />);
    });

    await waitFor(() => {
      expect(RetrieveData).toHaveBeenCalledWith(
        "conversations/test-conversation-id",
        "mock-access-token"
      );
    });
  });

  it("displays error when conversation is not found", async () => {
    (RetrieveData as jest.Mock).mockResolvedValue(null);

    await act(async () => {
      render(<EventAssistantRoom isAuthenticated={false} />);
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
      render(<EventAssistantRoom isAuthenticated={false} />);
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
      render(<EventAssistantRoom isAuthenticated={false} />);
    });

    await waitFor(() => {
      expect(
        screen.getByText(
          "This conversation does not have an event assistant agent."
        )
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
      render(<EventAssistantRoom isAuthenticated={false} />);
    });

    await waitFor(() => {
      expect(screen.getByText("Failed to join session")).toBeInTheDocument();
    });
  });

  it("loads initial assistant messages on page load", async () => {
    const mockMessages = [
      { id: "1", body: "Hello", pseudonym: "User", channels: ["direct-user-123-agent-123"] },
      { id: "2", body: "Hi there!", pseudonym: "Event Assistant", channels: ["direct-user-123-agent-123"] },
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
      render(<EventAssistantRoom isAuthenticated={false} />);
    });

    await waitFor(() => {
      expect(RetrieveData).toHaveBeenCalledWith(
        "messages/test-conversation-id?channel=direct-user-123-agent-123",
        "mock-access-token"
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
      render(<EventAssistantRoom isAuthenticated={false} />);
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
      render(<EventAssistantRoom isAuthenticated={false} />);
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

  it("loads initial chat messages when chatPasscode becomes available", async () => {
    mockRouter.query = {
      conversationId: "test-conversation-id",
      channel: "chat,chat-pass",
    };

    const mockChatMessages = [
      { id: "1", body: "Chat message 1", pseudonym: "User1", channels: ["chat"] },
      { id: "2", body: "Chat message 2", pseudonym: "User2", channels: ["chat"] },
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
      render(<EventAssistantRoom isAuthenticated={false} />);
    });

    await waitFor(() => {
      expect(RetrieveData).toHaveBeenCalledWith(
        "messages/test-conversation-id?channel=chat,chat-pass",
        "mock-access-token"
      );
    });
  });
});
