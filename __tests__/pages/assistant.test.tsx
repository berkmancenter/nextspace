import React from "react";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import EventAssistantRoom from "../../pages/assistant";
import { JoinSession, RetrieveData, SendData } from "../../utils";
import { io } from "socket.io-client";

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

// Mock utils
jest.mock("../../utils", () => ({
  Api: {
    get: jest.fn(() => ({
      GetTokens: jest.fn(() => ({ access: "mock-access-token" })),
    })),
  },
  JoinSession: jest.fn(),
  RetrieveData: jest.fn(),
  SendData: jest.fn(),
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
  });

  it("renders loading state initially", async () => {
    mockRouter.isReady = true;

    // Mock JoinSession to succeed and create socket
    (JoinSession as jest.Mock).mockImplementation(async (onSuccess) => {
      await act(() => {
        onSuccess({ pseudonym: "test-pseudonym", userId: "user-123" });
      });
    });

    let container;
    await act(async () => {
      const result = render(<EventAssistantRoom isAuthenticated={false} />);
      container = result.container;
    });

    // At this point socket exists but isConnected is still false (not connected yet)
    // Should show loading indicator (animated circles)
    const loadingCircles = container!.querySelectorAll(".animate-bounce");
    expect(loadingCircles.length).toBeGreaterThan(0);
  });

  it("initializes socket connection on mount", async () => {
    (JoinSession as jest.Mock).mockImplementation((onSuccess) => {
      onSuccess({ pseudonym: "test-pseudonym", userId: "user-123" });
    });

    await act(async () => {
      render(<EventAssistantRoom isAuthenticated={false} />);
    });

    await waitFor(() => {
      expect(JoinSession).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(io).toHaveBeenCalledWith(process.env.NEXT_PUBLIC_SOCKET_URL, {
        auth: { token: "mock-access-token" },
      });
    });
  });

  it("sets up socket event listeners", async () => {
    (JoinSession as jest.Mock).mockImplementation((onSuccess) => {
      onSuccess({ pseudonym: "test-pseudonym", userId: "user-123" });
    });

    await act(async () => {
      render(<EventAssistantRoom isAuthenticated={false} />);
    });

    await waitFor(() => {
      expect(mockSocket.on).toHaveBeenCalledWith("error", expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith(
        "connect",
        expect.any(Function)
      );
      expect(mockSocket.on).toHaveBeenCalledWith(
        "disconnect",
        expect.any(Function)
      );
    });
  });

  it("fetches conversation data when router is ready", async () => {
    (JoinSession as jest.Mock).mockImplementation((onSuccess) => {
      onSuccess({ pseudonym: "test-pseudonym", userId: "user-123" });
    });

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
    (JoinSession as jest.Mock).mockImplementation((onSuccess) => {
      onSuccess({ pseudonym: "test-pseudonym", userId: "user-123" });
    });
    (RetrieveData as jest.Mock).mockResolvedValue(null);

    await act(async () => {
      render(<EventAssistantRoom isAuthenticated={false} />);
    });

    await waitFor(() => {
      expect(screen.getByText("Conversation not found.")).toBeInTheDocument();
    });
  });

  it("displays error when conversation has an error", async () => {
    (JoinSession as jest.Mock).mockImplementation((onSuccess) => {
      onSuccess({ pseudonym: "test-pseudonym", userId: "user-123" });
    });
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
    (JoinSession as jest.Mock).mockImplementation((onSuccess) => {
      onSuccess({ pseudonym: "test-pseudonym", userId: "user-123" });
    });
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
    (JoinSession as jest.Mock).mockImplementation((onSuccess) => {
      onSuccess({ pseudonym: "test-pseudonym", userId: "user-123" });
    });

    await act(async () => {
      render(<EventAssistantRoom isAuthenticated={false} />);
    });

    // Simulate socket connection
    await act(async () => {
      const connectHandler = mockSocket.on.mock.calls.find(
        (call) => call[0] === "connect"
      )?.[1];
      if (connectHandler) connectHandler();
    });

    await waitFor(() => {
      expect(screen.getByText("Ask the Event Assistant")).toBeInTheDocument();
    });
  });

  it("joins conversation room when data is loaded", async () => {
    (JoinSession as jest.Mock).mockImplementation((onSuccess) => {
      onSuccess({ pseudonym: "test-pseudonym", userId: "user-123" });
    });
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
    (JoinSession as jest.Mock).mockImplementation((onSuccess) => {
      onSuccess({ pseudonym: "test-pseudonym", userId: "user-123" });
    });

    await act(async () => {
      render(<EventAssistantRoom isAuthenticated={false} />);
    });

    // Simulate socket connection
    await act(async () => {
      const connectHandler = mockSocket.on.mock.calls.find(
        (call) => call[0] === "connect"
      )?.[1];
      if (connectHandler) connectHandler();
    });

    const messageTime = new Date(Date.now() - 120 * 1000).toISOString(); // two minutes ago

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

    // Ensure message time is accurate
    await waitFor(() => {
      expect(
        screen.getByText(
          new Date(messageTime).toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
          })
        )
      ).toBeInTheDocument();
    });
  });

  it("displays message input field with pseudonym", async () => {
    (JoinSession as jest.Mock).mockImplementation((onSuccess) => {
      onSuccess({ pseudonym: "TestUser123", userId: "user-123" });
    });

    await act(async () => {
      render(<EventAssistantRoom isAuthenticated={false} />);
    });

    // Simulate socket connection
    await act(async () => {
      const connectHandler = mockSocket.on.mock.calls.find(
        (call) => call[0] === "connect"
      )?.[1];
      if (connectHandler) connectHandler();
    });

    await waitFor(() => {
      expect(screen.getByText("Writing as TestUser123")).toBeInTheDocument();
      expect(
        screen.getByPlaceholderText("Write a Comment")
      ).toBeInTheDocument();
    });
  });

  it("sends message when send button is clicked", async () => {
    const user = userEvent.setup();
    (JoinSession as jest.Mock).mockImplementation((onSuccess) => {
      onSuccess({ pseudonym: "TestUser123", userId: "user-123" });
    });
    (RetrieveData as jest.Mock).mockResolvedValue({
      agents: [{ id: "agent-456", agentType: "eventAssistant" }],
    });
    (SendData as jest.Mock).mockResolvedValue({ success: true });

    await act(async () => {
      render(<EventAssistantRoom isAuthenticated={false} />);
    });

    // Simulate socket connection
    await act(async () => {
      const connectHandler = mockSocket.on.mock.calls.find(
        (call) => call[0] === "connect"
      )?.[1];
      if (connectHandler) connectHandler();
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
    (JoinSession as jest.Mock).mockImplementation((onSuccess) => {
      onSuccess({ pseudonym: "TestUser123", userId: "user-123" });
    });
    (RetrieveData as jest.Mock).mockResolvedValue({
      agents: [{ id: "agent-456", agentType: "eventAssistant" }],
    });
    (SendData as jest.Mock).mockResolvedValue({ success: true });

    await act(async () => {
      render(<EventAssistantRoom isAuthenticated={false} />);
    });

    // Simulate socket connection
    await act(async () => {
      const connectHandler = mockSocket.on.mock.calls.find(
        (call) => call[0] === "connect"
      )?.[1];
      if (connectHandler) connectHandler();
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
    (JoinSession as jest.Mock).mockImplementation((onSuccess) => {
      onSuccess({ pseudonym: "TestUser123", userId: "user-123" });
    });

    await act(async () => {
      render(<EventAssistantRoom isAuthenticated={false} />);
    });

    // Simulate socket connection
    await act(async () => {
      const connectHandler = mockSocket.on.mock.calls.find(
        (call) => call[0] === "connect"
      )?.[1];
      if (connectHandler) connectHandler();
    });

    await waitFor(() => {
      const sendButton = screen.getByLabelText("send message");
      expect(sendButton).toBeDisabled();
    });
  });

  it("disables send button while waiting for response", async () => {
    const user = userEvent.setup();
    (JoinSession as jest.Mock).mockImplementation((onSuccess) => {
      onSuccess({ pseudonym: "TestUser123", userId: "user-123" });
    });
    (RetrieveData as jest.Mock).mockResolvedValue({
      agents: [{ id: "agent-456", agentType: "eventAssistant" }],
    });
    (SendData as jest.Mock).mockImplementation(
      () => new Promise((resolve) => setTimeout(resolve, 1000))
    );

    await act(async () => {
      render(<EventAssistantRoom isAuthenticated={false} />);
    });

    // Simulate socket connection
    await act(async () => {
      const connectHandler = mockSocket.on.mock.calls.find(
        (call) => call[0] === "connect"
      )?.[1];
      if (connectHandler) connectHandler();
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
    (JoinSession as jest.Mock).mockImplementation((onSuccess) => {
      onSuccess({ pseudonym: "TestUser123", userId: "user-123" });
    });
    (RetrieveData as jest.Mock).mockResolvedValue({
      agents: [{ id: "agent-456", agentType: "eventAssistant" }],
    });

    // Print all mock data
    console.log("Full mock data:", {
      calls: (RetrieveData as jest.Mock).mock.calls,
      results: (RetrieveData as jest.Mock).mock.results,
      instances: (RetrieveData as jest.Mock).mock.instances,
    });
    (SendData as jest.Mock).mockResolvedValue({ success: true });

    await act(async () => {
      render(<EventAssistantRoom isAuthenticated={false} />);
    });

    // Simulate socket connection
    await act(async () => {
      const connectHandler = mockSocket.on.mock.calls.find(
        (call) => call[0] === "connect"
      )?.[1];
      if (connectHandler) connectHandler();
    });

    const messageInput = screen.getByPlaceholderText(
      "Write a Comment"
    ) as HTMLInputElement;
    await user.type(messageInput, "Test message");

    const sendButton = screen.getByLabelText("send message");
    await user.click(sendButton);

    await waitFor(() => {
      expect(messageInput.value).toBe("");
    });
  });

  it("handles JoinSession errors gracefully", async () => {
    (JoinSession as jest.Mock).mockImplementation((onSuccess, onError) => {
      onError("Failed to join session");
    });

    await act(async () => {
      render(<EventAssistantRoom isAuthenticated={false} />);
    });

    await waitFor(() => {
      expect(screen.getByText("Failed to join session")).toBeInTheDocument();
    });
  });

  it("handles conversation fetch errors gracefully", async () => {
    (JoinSession as jest.Mock).mockImplementation((onSuccess) => {
      onSuccess({ pseudonym: "test-pseudonym", userId: "user-123" });
    });
    (RetrieveData as jest.Mock).mockRejectedValue(new Error("Network error"));

    await act(async () => {
      render(<EventAssistantRoom isAuthenticated={false} />);
    });

    await waitFor(() => {
      expect(
        screen.getByText("Failed to fetch conversation data.")
      ).toBeInTheDocument();
    });
  });

  it("displays assistant messages with special theme", async () => {
    (JoinSession as jest.Mock).mockImplementation((onSuccess) => {
      onSuccess({ pseudonym: "test-pseudonym", userId: "user-123" });
    });

    await act(async () => {
      render(<EventAssistantRoom isAuthenticated={false} />);
    });

    // Simulate socket connection
    await act(async () => {
      const connectHandler = mockSocket.on.mock.calls.find(
        (call) => call[0] === "connect"
      )?.[1];
      if (connectHandler) connectHandler();
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
      expect(
        assistantMessage.closest('[data-theme="assistant"]')
      ).toBeInTheDocument();
    });
  });

  it("displays user messages with no theme", async () => {
    (JoinSession as jest.Mock).mockImplementation((onSuccess) => {
      onSuccess({ pseudonym: "TestUser", userId: "user-123" });
    });

    await act(async () => {
      render(<EventAssistantRoom isAuthenticated={false} />);
    });

    // Simulate socket connection
    await act(async () => {
      const connectHandler = mockSocket.on.mock.calls.find(
        (call) => call[0] === "connect"
      )?.[1];
      if (connectHandler) connectHandler();
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

  it("does not re-initialize socket if already connecting", async () => {
    (JoinSession as jest.Mock).mockImplementation((onSuccess) => {
      setTimeout(() => {
        onSuccess({ pseudonym: "test-pseudonym", userId: "user-123" });
      }, 100);
    });

    await act(async () => {
      const { rerender } = render(
        <EventAssistantRoom isAuthenticated={false} />
      );
      rerender(<EventAssistantRoom isAuthenticated={false} />);
    });

    await waitFor(() => {
      expect(JoinSession).toHaveBeenCalledTimes(1);
    });
  });

  it("conversation history is shown if user is already authenticated", async () => {
    (JoinSession as jest.Mock).mockImplementation((onSuccess) => {
      onSuccess({ pseudonym: "TestUser", userId: "user-123" });
    });

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
      if (
        endpoint ===
        "messages/test-conversation-id?channel=direct-user-123-agent-456"
      ) {
        return Promise.resolve([...mockHistory]);
      }
      return Promise.resolve(null);
    });

    await act(async () => {
      render(<EventAssistantRoom isAuthenticated={true} />);
    });

    // Simulate socket connection
    await act(async () => {
      const connectHandler = mockSocket.on.mock.calls.find(
        (call) => call[0] === "connect"
      )?.[1];
      if (connectHandler) connectHandler();
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
