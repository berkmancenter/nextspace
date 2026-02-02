import React from "react";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import EventAssistantRoom from "../../pages/assistant";
import { RetrieveData, SendData } from "../../utils";
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

// Mock react-scroll
jest.mock("react-scroll", () => ({
  Element: ({ children }: any) => <div>{children}</div>,
  scroller: {
    scrollTo: jest.fn(),
  },
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
}));

// Mock useSessionJoin hook
const mockUseSessionJoin = jest.fn();
jest.mock("../../utils/useSessionJoin", () => ({
  useSessionJoin: (...args: any[]) => mockUseSessionJoin(...args),
}));

// Mock DirectMessage component
jest.mock("../../components", () => ({
  DirectMessage: ({ text, theme }: any) => (
    <div data-testid="direct-message" data-theme={theme}>
      {text}
    </div>
  ),
}));

// Mock CheckAuthHeader
jest.mock("../../utils/Helpers", () => ({
  CheckAuthHeader: jest.fn(() => ({ props: {} })),
}));

describe("EventAssistantRoom", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPush.mockReset();
    (RetrieveData as jest.Mock).mockResolvedValue({
      agents: [{ id: "agent-123", agentType: "eventAssistant" }],
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

  it("renders chat interface when connected", async () => {
    await act(async () => {
      render(<EventAssistantRoom isAuthenticated={false} />);
    });

    await waitFor(() => {
      expect(screen.getByText("Ask the Event Assistant")).toBeInTheDocument();
    });
  });

  it("joins conversation room when data is loaded", async () => {
    (RetrieveData as jest.Mock).mockResolvedValue({
      agents: [{ id: "agent-456", agentType: "eventAssistant" }],
    });

    await act(async () => {
      render(<EventAssistantRoom isAuthenticated={false} />);
    });

    await waitFor(() => {
      expect(mockSocket.emit).toHaveBeenCalledWith("conversation:join", {
        conversationId: "test-conversation-id",
        token: "mock-access-token",
        channel: { name: "direct-user-123-agent-456" },
      });
    });
  });

  it("displays messages when received", async () => {
    await act(async () => {
      render(<EventAssistantRoom isAuthenticated={false} />);
    });

    const messageTime = new Date(Date.now() - 120 * 1000).toISOString();

    // Simulate receiving a message
    await act(async () => {
      const messageHandler = mockSocket.on.mock.calls.find(
        (call) => call[0] === "message:new"
      )?.[1];
      if (messageHandler) {
        messageHandler({
          body: "Hello from assistant",
          pseudonym: "Event Assistant",
          createdAt: messageTime,
        });
      }
    });

    await waitFor(() => {
      expect(screen.getByText("Hello from assistant")).toBeInTheDocument();
    });
  });

  it("displays message input field with pseudonym", async () => {
    mockUseSessionJoin.mockReturnValue({
      socket: mockSocket,
      pseudonym: "TestUser123",
      userId: "user-123",
      isConnected: true,
      errorMessage: null,
    });

    await act(async () => {
      render(<EventAssistantRoom isAuthenticated={false} />);
    });

    await waitFor(() => {
      expect(screen.getByText("Writing as TestUser123")).toBeInTheDocument();
      expect(screen.getByPlaceholderText("Write a Comment")).toBeInTheDocument();
    });
  });

  it("sends message when send button is clicked", async () => {
    const user = userEvent.setup();
    (RetrieveData as jest.Mock).mockResolvedValue({
      agents: [{ id: "agent-456", agentType: "eventAssistant" }],
    });
    (SendData as jest.Mock).mockResolvedValue({ success: true });

    await act(async () => {
      render(<EventAssistantRoom isAuthenticated={false} />);
    });

    const messageInput = screen.getByPlaceholderText("Write a Comment");
    await user.type(messageInput, "Test message");

    const sendButton = screen.getByLabelText("send message");
    await user.click(sendButton);

    await waitFor(() => {
      expect(SendData).toHaveBeenCalledWith("messages", {
        body: "Test message",
        bodyType: "text",
        conversation: "test-conversation-id",
        channels: [{ name: "direct-user-123-agent-456" }],
      });
    });
  });

  it("sends message when Enter key is pressed", async () => {
    const user = userEvent.setup();
    (RetrieveData as jest.Mock).mockResolvedValue({
      agents: [{ id: "agent-456", agentType: "eventAssistant" }],
    });
    (SendData as jest.Mock).mockResolvedValue({ success: true });

    await act(async () => {
      render(<EventAssistantRoom isAuthenticated={false} />);
    });

    const messageInput = screen.getByPlaceholderText("Write a Comment");
    await user.type(messageInput, "Test message{Enter}");

    await waitFor(() => {
      expect(SendData).toHaveBeenCalledWith("messages", {
        body: "Test message",
        bodyType: "text",
        conversation: "test-conversation-id",
        channels: [{ name: "direct-user-123-agent-456" }],
      });
    });
  });

  it("disables send button when message is empty", async () => {
    await act(async () => {
      render(<EventAssistantRoom isAuthenticated={false} />);
    });

    await waitFor(() => {
      const sendButton = screen.getByLabelText("send message");
      expect(sendButton).toBeDisabled();
    });
  });

  it("disables send button while waiting for response", async () => {
    const user = userEvent.setup();
    (RetrieveData as jest.Mock).mockResolvedValue({
      agents: [{ id: "agent-456", agentType: "eventAssistant" }],
    });
    (SendData as jest.Mock).mockImplementation(
      () => new Promise((resolve) => setTimeout(resolve, 1000))
    );

    await act(async () => {
      render(<EventAssistantRoom isAuthenticated={false} />);
    });

    const messageInput = screen.getByPlaceholderText("Write a Comment");
    await user.type(messageInput, "Test message");

    const sendButton = screen.getByLabelText("send message");
    await user.click(sendButton);

    // Button should be disabled while waiting
    expect(sendButton).toBeDisabled();
  });

  it("clears input field after sending message", async () => {
    const user = userEvent.setup();
    (RetrieveData as jest.Mock).mockResolvedValue({
      agents: [{ id: "agent-456", agentType: "eventAssistant" }],
    });
    (SendData as jest.Mock).mockResolvedValue({ success: true });

    await act(async () => {
      render(<EventAssistantRoom isAuthenticated={false} />);
    });

    const messageInput = screen.getByPlaceholderText("Write a Comment") as HTMLInputElement;
    await user.type(messageInput, "Test message");

    const sendButton = screen.getByLabelText("send message");
    await user.click(sendButton);

    await waitFor(() => {
      expect(messageInput.value).toBe("");
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

  it("handles conversation fetch errors gracefully", async () => {
    (RetrieveData as jest.Mock).mockRejectedValue(new Error("Network error"));

    await act(async () => {
      render(<EventAssistantRoom isAuthenticated={false} />);
    });

    await waitFor(() => {
      expect(screen.getByText("Failed to fetch conversation data.")).toBeInTheDocument();
    });
  });

  it("displays assistant messages with special theme", async () => {
    await act(async () => {
      render(<EventAssistantRoom isAuthenticated={false} />);
    });

    // Simulate receiving an assistant message
    await act(async () => {
      const messageHandler = mockSocket.on.mock.calls.find(
        (call) => call[0] === "message:new"
      )?.[1];
      if (messageHandler) {
        messageHandler({
          body: "Assistant response",
          pseudonym: "Event Assistant",
          createdAt: new Date().toISOString(),
        });
      }
    });

    await waitFor(() => {
      const assistantMessage = screen.getByText("Assistant response");
      expect(assistantMessage.closest('[data-theme="assistant"]')).toBeInTheDocument();
    });
  });

  it("displays user messages with no theme", async () => {
    mockUseSessionJoin.mockReturnValue({
      socket: mockSocket,
      pseudonym: "TestUser",
      userId: "user-123",
      isConnected: true,
      errorMessage: null,
    });

    await act(async () => {
      render(<EventAssistantRoom isAuthenticated={false} />);
    });

    // Simulate receiving a user message
    await act(async () => {
      const messageHandler = mockSocket.on.mock.calls.find(
        (call) => call[0] === "message:new"
      )?.[1];
      if (messageHandler) {
        messageHandler({
          body: "User message",
          pseudonym: "TestUser",
          createdAt: new Date().toISOString(),
        });
      }
    });

    await waitFor(() => {
      const userMessage = screen.getByText("User message");
      expect(userMessage.closest('[data-theme="none"]')).toBeInTheDocument();
    });
  });

  it("conversation history is shown if user is already authenticated", async () => {
    const mockHistory = [
      {
        body: "This is a past message.",
        pseudonym: "TestUser",
        createdAt: new Date(Date.now() - 100000).toISOString(),
      },
      {
        body: "This is a past response.",
        pseudonym: "Event Assistant",
        createdAt: new Date(Date.now() - 90000).toISOString(),
      },
    ];

    // Mock RetrieveData to return different values based on the endpoint
    (RetrieveData as jest.Mock).mockImplementation((endpoint) => {
      if (endpoint === "conversations/test-conversation-id") {
        return Promise.resolve({
          agents: [{ id: "agent-456", agentType: "eventAssistant" }],
        });
      }
      if (endpoint === "messages/test-conversation-id?channel=direct-user-123-agent-456") {
        return Promise.resolve([...mockHistory]);
      }
      return Promise.resolve(null);
    });

    await act(async () => {
      render(<EventAssistantRoom isAuthenticated={true} />);
    });

    await waitFor(() => {
      expect(RetrieveData).toHaveBeenCalledWith(
        "conversations/test-conversation-id",
        "mock-access-token"
      );
    });

    await waitFor(() => {
      expect(RetrieveData).toHaveBeenCalledWith(
        "messages/test-conversation-id?channel=direct-user-123-agent-456",
        "mock-access-token"
      );
    });

    await waitFor(() => {
      expect(screen.getByText("This is a past message.")).toBeInTheDocument();
      expect(screen.getByText("This is a past response.")).toBeInTheDocument();
    });
  });
});
