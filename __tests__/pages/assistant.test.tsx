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
      const result = render(<EventAssistantRoom />);
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
      render(<EventAssistantRoom />);
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
      render(<EventAssistantRoom />);
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
      render(<EventAssistantRoom />);
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
      render(<EventAssistantRoom />);
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
      render(<EventAssistantRoom />);
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
      render(<EventAssistantRoom />);
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
      render(<EventAssistantRoom />);
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
      render(<EventAssistantRoom />);
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
      render(<EventAssistantRoom />);
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
      render(<EventAssistantRoom />);
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
      render(<EventAssistantRoom />);
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
      render(<EventAssistantRoom />);
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
      render(<EventAssistantRoom />);
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
      render(<EventAssistantRoom />);
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
    (SendData as jest.Mock).mockResolvedValue({ success: true });

    await act(async () => {
      render(<EventAssistantRoom />);
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
      render(<EventAssistantRoom />);
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
      render(<EventAssistantRoom />);
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
      render(<EventAssistantRoom />);
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
      // Should render as AssistantMessage component
      expect(
        assistantMessage.closest('[data-testid="assistant-message"]')
      ).toBeInTheDocument();
    });
  });

  it("displays user messages with no theme", async () => {
    (JoinSession as jest.Mock).mockImplementation((onSuccess) => {
      onSuccess({ pseudonym: "TestUser", userId: "user-123" });
    });

    await act(async () => {
      render(<EventAssistantRoom />);
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
      // Should render as UserMessage component
      expect(
        userMessage.closest('[data-testid="user-message"]')
      ).toBeInTheDocument();
    });
  });

  it("does not re-initialize socket if already connecting", async () => {
    (JoinSession as jest.Mock).mockImplementation((onSuccess) => {
      setTimeout(() => {
        onSuccess({ pseudonym: "test-pseudonym", userId: "user-123" });
      }, 100);
    });

    await act(async () => {
      const { rerender } = render(<EventAssistantRoom />);
      rerender(<EventAssistantRoom />);
    });

    await waitFor(() => {
      expect(JoinSession).toHaveBeenCalledTimes(1);
    });
  });

  describe("MessageFeedback Integration", () => {
    it("renders MessageFeedback component for assistant messages", async () => {
      (JoinSession as jest.Mock).mockImplementation((onSuccess) => {
        onSuccess({ pseudonym: "test-pseudonym", userId: "user-123" });
      });

      await act(async () => {
        render(<EventAssistantRoom />);
      });

      // Simulate socket connection
      await act(async () => {
        const connectHandler = mockSocket.on.mock.calls.find(
          (call) => call[0] === "connect"
        )?.[1];
        if (connectHandler) connectHandler();
      });

      // Simulate receiving an assistant message with ID
      await act(async () => {
        const messageHandler = mockSocket.on.mock.calls.find(
          (call) => call[0] === "message:new"
        )?.[1];
        if (messageHandler) {
          messageHandler({
            id: "msg-123",
            body: "Assistant response",
            pseudonym: "Event Assistant",
            createdAt: new Date().toISOString(),
          });
        }
      });

      await waitFor(() => {
        const feedbackComponent = screen.getByTestId("message-feedback");
        expect(feedbackComponent).toBeInTheDocument();
        expect(feedbackComponent).toHaveAttribute("data-message-id", "msg-123");
      });
    });

    it("renders MessageFeedback inside DirectMessage for assistant messages", async () => {
      (JoinSession as jest.Mock).mockImplementation((onSuccess) => {
        onSuccess({ pseudonym: "test-pseudonym", userId: "user-123" });
      });

      await act(async () => {
        render(<EventAssistantRoom />);
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
            id: "msg-123",
            body: "Assistant response",
            pseudonym: "Event Assistant",
            createdAt: new Date().toISOString(),
          });
        }
      });

      await waitFor(() => {
        const assistantMessage = screen.getByTestId("assistant-message");
        expect(assistantMessage).toBeInTheDocument();
        // MessageFeedback should be inside AssistantMessage
        const feedbackInside = assistantMessage.querySelector(
          '[data-testid="message-feedback"]'
        );
        expect(feedbackInside).toBeInTheDocument();
      });
    });

    it("does not render MessageFeedback for user messages", async () => {
      (JoinSession as jest.Mock).mockImplementation((onSuccess) => {
        onSuccess({ pseudonym: "TestUser", userId: "user-123" });
      });

      await act(async () => {
        render(<EventAssistantRoom />);
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
            id: "msg-456",
            body: "User message",
            pseudonym: "TestUser",
            createdAt: new Date().toISOString(),
          });
        }
      });

      await waitFor(() => {
        expect(screen.getByText("User message")).toBeInTheDocument();
      });

      // MessageFeedback should not be present for user messages
      expect(screen.queryByTestId("message-feedback")).not.toBeInTheDocument();
    });

    it("handles rating button click and sends feedback", async () => {
      const user = userEvent.setup();
      (JoinSession as jest.Mock).mockImplementation((onSuccess) => {
        onSuccess({ pseudonym: "test-pseudonym", userId: "user-123" });
      });
      (RetrieveData as jest.Mock).mockResolvedValue({
        agents: [{ id: "agent-456", agentType: "eventAssistant" }],
      });
      (SendData as jest.Mock).mockResolvedValue({ success: true });

      await act(async () => {
        render(<EventAssistantRoom />);
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
            id: "msg-789",
            body: "How can I help you?",
            pseudonym: "Event Assistant",
            createdAt: new Date().toISOString(),
          });
        }
      });

      await waitFor(() => {
        expect(screen.getByTestId("rating-button-3")).toBeInTheDocument();
      });

      const ratingButton = screen.getByTestId("rating-button-3");
      await user.click(ratingButton);

      await waitFor(() => {
        expect(SendData).toHaveBeenCalledWith("messages", {
          body: "/feedback|Rating|msg-789|3",
          bodyType: "text",
          conversation: "test-conversation-id",
          channels: [{ name: "direct-user-123-agent-456" }],
        });
      });
    });

    it("enters controlled mode when Say more button is clicked", async () => {
      const user = userEvent.setup();
      (JoinSession as jest.Mock).mockImplementation((onSuccess) => {
        onSuccess({ pseudonym: "test-pseudonym", userId: "user-123" });
      });

      await act(async () => {
        render(<EventAssistantRoom />);
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
            id: "msg-321",
            body: "What do you think?",
            pseudonym: "Event Assistant",
            createdAt: new Date().toISOString(),
          });
        }
      });

      await waitFor(() => {
        expect(screen.getByTestId("say-more-button")).toBeInTheDocument();
      });

      const sayMoreButton = screen.getByTestId("say-more-button");
      await user.click(sayMoreButton);

      await waitFor(() => {
        // Should show controlled mode indicator with "Feedback Mode"
        expect(screen.getByText(/Feedback Mode/i)).toBeInTheDocument();
      });
    });

    it("sends feedback text with correct prefix in controlled mode", async () => {
      const user = userEvent.setup();
      (JoinSession as jest.Mock).mockImplementation((onSuccess) => {
        onSuccess({ pseudonym: "test-pseudonym", userId: "user-123" });
      });
      (RetrieveData as jest.Mock).mockResolvedValue({
        agents: [{ id: "agent-456", agentType: "eventAssistant" }],
      });
      (SendData as jest.Mock).mockResolvedValue({ success: true });

      await act(async () => {
        render(<EventAssistantRoom />);
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
            id: "msg-999",
            body: "Test response",
            pseudonym: "Event Assistant",
            createdAt: new Date().toISOString(),
          });
        }
      });

      // Click Say more to enter controlled mode
      const sayMoreButton = await screen.findByTestId("say-more-button");
      await user.click(sayMoreButton);

      // Type feedback text
      const messageInput = screen.getByPlaceholderText("Write a Comment");
      await user.type(messageInput, "Great response!");

      // Send the message
      const sendButton = screen.getByLabelText("send message");
      await user.click(sendButton);

      await waitFor(() => {
        expect(SendData).toHaveBeenCalledWith("messages", {
          body: "/feedback|Text|msg-999|Great response!",
          bodyType: "text",
          conversation: "test-conversation-id",
          channels: [{ name: "direct-user-123-agent-456" }],
        });
      });
    });

    it("exits controlled mode after sending feedback", async () => {
      const user = userEvent.setup();
      (JoinSession as jest.Mock).mockImplementation((onSuccess) => {
        onSuccess({ pseudonym: "test-pseudonym", userId: "user-123" });
      });
      (RetrieveData as jest.Mock).mockResolvedValue({
        agents: [{ id: "agent-456", agentType: "eventAssistant" }],
      });
      (SendData as jest.Mock).mockResolvedValue({ success: true });

      await act(async () => {
        render(<EventAssistantRoom />);
      });

      // Simulate socket connection and message
      await act(async () => {
        const connectHandler = mockSocket.on.mock.calls.find(
          (call) => call[0] === "connect"
        )?.[1];
        if (connectHandler) connectHandler();
      });

      await act(async () => {
        const messageHandler = mockSocket.on.mock.calls.find(
          (call) => call[0] === "message:new"
        )?.[1];
        if (messageHandler) {
          messageHandler({
            id: "msg-111",
            body: "Test",
            pseudonym: "Event Assistant",
            createdAt: new Date().toISOString(),
          });
        }
      });

      // Enter controlled mode
      const sayMoreButton = await screen.findByTestId("say-more-button");
      await user.click(sayMoreButton);

      await waitFor(() => {
        expect(screen.getByText(/Feedback Mode/i)).toBeInTheDocument();
      });

      // Send feedback
      const messageInput = screen.getByPlaceholderText("Write a Comment");
      await user.type(messageInput, "Feedback text");
      const sendButton = screen.getByLabelText("send message");
      await user.click(sendButton);

      await waitFor(() => {
        // Should exit controlled mode - "Feedback Mode" should not be visible
        expect(screen.queryByText(/Feedback Mode/i)).not.toBeInTheDocument();
      });
    });

    it("allows exiting controlled mode with Escape key", async () => {
      const user = userEvent.setup();
      (JoinSession as jest.Mock).mockImplementation((onSuccess) => {
        onSuccess({ pseudonym: "test-pseudonym", userId: "user-123" });
      });

      await act(async () => {
        render(<EventAssistantRoom />);
      });

      // Simulate socket connection and message
      await act(async () => {
        const connectHandler = mockSocket.on.mock.calls.find(
          (call) => call[0] === "connect"
        )?.[1];
        if (connectHandler) connectHandler();
      });

      await act(async () => {
        const messageHandler = mockSocket.on.mock.calls.find(
          (call) => call[0] === "message:new"
        )?.[1];
        if (messageHandler) {
          messageHandler({
            id: "msg-222",
            body: "Test",
            pseudonym: "Event Assistant",
            createdAt: new Date().toISOString(),
          });
        }
      });

      // Enter controlled mode
      const sayMoreButton = await screen.findByTestId("say-more-button");
      await user.click(sayMoreButton);

      await waitFor(() => {
        expect(screen.getByText(/Feedback Mode/i)).toBeInTheDocument();
      });

      // Press Escape to exit
      await user.keyboard("{Escape}");

      await waitFor(() => {
        expect(screen.queryByText(/Feedback Mode/i)).not.toBeInTheDocument();
      });
    });
  });

  describe("Controlled Input Bug Fixes", () => {
    it("does not wait for response after sending a rating", async () => {
      const user = userEvent.setup();
      (JoinSession as jest.Mock).mockImplementation((onSuccess) => {
        onSuccess({ pseudonym: "test-pseudonym", userId: "user-123" });
      });
      (RetrieveData as jest.Mock).mockResolvedValue({
        agents: [{ id: "agent-456", agentType: "eventAssistant" }],
      });
      (SendData as jest.Mock).mockResolvedValue({ success: true });

      await act(async () => {
        render(<EventAssistantRoom />);
      });

      // Simulate socket connection and message
      await act(async () => {
        const connectHandler = mockSocket.on.mock.calls.find(
          (call) => call[0] === "connect"
        )?.[1];
        if (connectHandler) connectHandler();
      });

      await act(async () => {
        const messageHandler = mockSocket.on.mock.calls.find(
          (call) => call[0] === "message:new"
        )?.[1];
        if (messageHandler) {
          messageHandler({
            id: "msg-rating-test",
            body: "How did I do?",
            pseudonym: "Event Assistant",
            createdAt: new Date().toISOString(),
          });
        }
      });

      // Click rating button
      const ratingButton = await screen.findByTestId("rating-button-3");
      await user.click(ratingButton);

      await waitFor(() => {
        expect(SendData).toHaveBeenCalledWith("messages", {
          body: "/feedback|Rating|msg-rating-test|3",
          bodyType: "text",
          conversation: "test-conversation-id",
          channels: [{ name: "direct-user-123-agent-456" }],
        });
      });

      // Input should remain enabled - not waiting for response
      const messageInput = screen.getByPlaceholderText("Write a Comment");
      await user.type(messageInput, "Follow-up message");

      const sendButton = screen.getByLabelText("send message");
      // Button should be enabled immediately after rating (not waiting)
      expect(sendButton).not.toBeDisabled();
    });

    it("does not wait for response after sending free-form text feedback", async () => {
      const user = userEvent.setup();
      (JoinSession as jest.Mock).mockImplementation((onSuccess) => {
        onSuccess({ pseudonym: "test-pseudonym", userId: "user-123" });
      });
      (RetrieveData as jest.Mock).mockResolvedValue({
        agents: [{ id: "agent-456", agentType: "eventAssistant" }],
      });
      (SendData as jest.Mock).mockResolvedValue({ success: true });

      await act(async () => {
        render(<EventAssistantRoom />);
      });

      // Simulate socket connection and message
      await act(async () => {
        const connectHandler = mockSocket.on.mock.calls.find(
          (call) => call[0] === "connect"
        )?.[1];
        if (connectHandler) connectHandler();
      });

      await act(async () => {
        const messageHandler = mockSocket.on.mock.calls.find(
          (call) => call[0] === "message:new"
        )?.[1];
        if (messageHandler) {
          messageHandler({
            id: "msg-text-feedback",
            body: "What do you think?",
            pseudonym: "Event Assistant",
            createdAt: new Date().toISOString(),
          });
        }
      });

      // Enter controlled mode via Say more button
      const sayMoreButton = await screen.findByTestId("say-more-button");
      await user.click(sayMoreButton);

      // Send text feedback
      const messageInput = screen.getByPlaceholderText("Write a Comment");
      await user.type(messageInput, "This was very helpful!");
      await user.click(screen.getByLabelText("send message"));

      await waitFor(() => {
        expect(SendData).toHaveBeenCalledWith("messages", {
          body: "/feedback|Text|msg-text-feedback|This was very helpful!",
          bodyType: "text",
          conversation: "test-conversation-id",
          channels: [{ name: "direct-user-123-agent-456" }],
        });
      });

      // Input should be cleared and ready for immediate use
      await waitFor(() => {
        expect(messageInput).toHaveValue("");
      });

      // Should be able to type and send another message immediately
      await user.type(messageInput, "Another message");
      const sendButton = screen.getByLabelText("send message");
      // Button should be enabled (not waiting for response)
      expect(sendButton).not.toBeDisabled();
    });

    it("waits for response after regular message but not after feedback", async () => {
      const user = userEvent.setup();
      (JoinSession as jest.Mock).mockImplementation((onSuccess) => {
        onSuccess({ pseudonym: "test-pseudonym", userId: "user-123" });
      });
      (RetrieveData as jest.Mock).mockResolvedValue({
        agents: [{ id: "agent-456", agentType: "eventAssistant" }],
      });
      // Make SendData take time to complete
      (SendData as jest.Mock).mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(() => resolve({ success: true }), 50)
          )
      );

      await act(async () => {
        render(<EventAssistantRoom />);
      });

      // Simulate socket connection
      await act(async () => {
        const connectHandler = mockSocket.on.mock.calls.find(
          (call) => call[0] === "connect"
        )?.[1];
        if (connectHandler) connectHandler();
      });

      const messageInput = screen.getByPlaceholderText("Write a Comment");
      const sendButton = screen.getByLabelText("send message");

      // Send a regular message
      await user.type(messageInput, "Regular question");
      await user.click(sendButton);

      // Should be waiting for response - button disabled
      await waitFor(() => {
        expect(sendButton).toBeDisabled();
      });

      // Simulate bot response
      await act(async () => {
        const messageHandler = mockSocket.on.mock.calls.find(
          (call) => call[0] === "message:new"
        )?.[1];
        if (messageHandler) {
          messageHandler({
            id: "msg-bot-response",
            body: "Here's my answer",
            pseudonym: "Event Assistant",
            createdAt: new Date().toISOString(),
          });
        }
      });

      // Now send a rating - should NOT wait
      const ratingButton = await screen.findByTestId("rating-button-3");
      await user.click(ratingButton);

      await waitFor(() => {
        expect(SendData).toHaveBeenLastCalledWith("messages", {
          body: "/feedback|Rating|msg-bot-response|3",
          bodyType: "text",
          conversation: "test-conversation-id",
          channels: [{ name: "direct-user-123-agent-456" }],
        });
      });

      // Input should be enabled immediately after rating
      await user.type(messageInput, "x");
      await waitFor(() => {
        expect(sendButton).not.toBeDisabled();
      });
    });

    it("allows sending multiple controlled mode messages in succession", async () => {
      const user = userEvent.setup();
      (JoinSession as jest.Mock).mockImplementation((onSuccess) => {
        onSuccess({ pseudonym: "test-pseudonym", userId: "user-123" });
      });
      (RetrieveData as jest.Mock).mockResolvedValue({
        agents: [{ id: "agent-456", agentType: "eventAssistant" }],
      });
      (SendData as jest.Mock).mockResolvedValue({ success: true });

      await act(async () => {
        render(<EventAssistantRoom />);
      });

      // Simulate socket connection and message
      await act(async () => {
        const connectHandler = mockSocket.on.mock.calls.find(
          (call) => call[0] === "connect"
        )?.[1];
        if (connectHandler) connectHandler();
      });

      await act(async () => {
        const messageHandler = mockSocket.on.mock.calls.find(
          (call) => call[0] === "message:new"
        )?.[1];
        if (messageHandler) {
          messageHandler({
            id: "msg-first",
            body: "Test message",
            pseudonym: "Event Assistant",
            createdAt: new Date().toISOString(),
          });
        }
      });

      // Enter controlled mode and send first feedback
      const sayMoreButton = await screen.findByTestId("say-more-button");
      await user.click(sayMoreButton);

      const messageInput = screen.getByPlaceholderText("Write a Comment");
      await user.type(messageInput, "First feedback");
      await user.click(screen.getByLabelText("send message"));

      await waitFor(() => {
        expect(SendData).toHaveBeenCalledWith("messages", {
          body: "/feedback|Text|msg-first|First feedback",
          bodyType: "text",
          conversation: "test-conversation-id",
          channels: [{ name: "direct-user-123-agent-456" }],
        });
      });

      // Input should be cleared and ready for next message
      expect(messageInput).toHaveValue("");

      // Should be able to immediately type and send another message
      await user.type(messageInput, "Second message");
      await user.click(screen.getByLabelText("send message"));

      await waitFor(() => {
        expect(SendData).toHaveBeenCalledWith("messages", {
          body: "Second message",
          bodyType: "text",
          conversation: "test-conversation-id",
          channels: [{ name: "direct-user-123-agent-456" }],
        });
      });

      expect(messageInput).toHaveValue("");
    });

    it("does not set waitingForResponse for controlled mode messages", async () => {
      const user = userEvent.setup();
      (JoinSession as jest.Mock).mockImplementation((onSuccess) => {
        onSuccess({ pseudonym: "test-pseudonym", userId: "user-123" });
      });
      (RetrieveData as jest.Mock).mockResolvedValue({
        agents: [{ id: "agent-456", agentType: "eventAssistant" }],
      });
      (SendData as jest.Mock).mockResolvedValue({ success: true });

      await act(async () => {
        render(<EventAssistantRoom />);
      });

      // Simulate socket connection and message
      await act(async () => {
        const connectHandler = mockSocket.on.mock.calls.find(
          (call) => call[0] === "connect"
        )?.[1];
        if (connectHandler) connectHandler();
      });

      await act(async () => {
        const messageHandler = mockSocket.on.mock.calls.find(
          (call) => call[0] === "message:new"
        )?.[1];
        if (messageHandler) {
          messageHandler({
            id: "msg-controlled",
            body: "Test message",
            pseudonym: "Event Assistant",
            createdAt: new Date().toISOString(),
          });
        }
      });

      // Enter controlled mode
      const sayMoreButton = await screen.findByTestId("say-more-button");
      await user.click(sayMoreButton);

      // Send feedback message
      const messageInput = screen.getByPlaceholderText("Write a Comment");
      await user.type(messageInput, "Feedback");
      await user.click(screen.getByLabelText("send message"));

      await waitFor(() => {
        expect(SendData).toHaveBeenCalled();
      });

      // Send button should NOT be disabled (waitingForResponse should be false)
      // Wait a moment to ensure state updates
      await waitFor(() => {
        expect(messageInput).toHaveValue("");
      });

      // Type another message - button should be enabled
      await user.type(messageInput, "Next");
      const sendButton = screen.getByLabelText("send message");
      expect(sendButton).not.toBeDisabled();
    });

    it("sets waitingForResponse for regular messages but not controlled mode", async () => {
      const user = userEvent.setup();
      (JoinSession as jest.Mock).mockImplementation((onSuccess) => {
        onSuccess({ pseudonym: "test-pseudonym", userId: "user-123" });
      });
      (RetrieveData as jest.Mock).mockResolvedValue({
        agents: [{ id: "agent-456", agentType: "eventAssistant" }],
      });
      // Make SendData take some time to complete
      (SendData as jest.Mock).mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(() => resolve({ success: true }), 50)
          )
      );

      await act(async () => {
        render(<EventAssistantRoom />);
      });

      // Simulate socket connection
      await act(async () => {
        const connectHandler = mockSocket.on.mock.calls.find(
          (call) => call[0] === "connect"
        )?.[1];
        if (connectHandler) connectHandler();
      });

      // Send a regular message
      const messageInput = screen.getByPlaceholderText("Write a Comment");
      await user.type(messageInput, "Regular message");
      await user.click(screen.getByLabelText("send message"));

      // Send button should be disabled while waiting
      await waitFor(() => {
        expect(screen.getByLabelText("send message")).toBeDisabled();
      });

      // Wait for send to complete and get response
      await act(async () => {
        const messageHandler = mockSocket.on.mock.calls.find(
          (call) => call[0] === "message:new"
        )?.[1];
        if (messageHandler) {
          messageHandler({
            id: "msg-response",
            body: "Response",
            pseudonym: "Event Assistant",
            createdAt: new Date().toISOString(),
          });
        }
      });

      // Now button should be enabled again
      await user.type(messageInput, "x");
      await waitFor(() => {
        expect(screen.getByLabelText("send message")).not.toBeDisabled();
      });
    });

    it("maintains input state as fully controlled", async () => {
      const user = userEvent.setup();
      (JoinSession as jest.Mock).mockImplementation((onSuccess) => {
        onSuccess({ pseudonym: "test-pseudonym", userId: "user-123" });
      });
      (RetrieveData as jest.Mock).mockResolvedValue({
        agents: [{ id: "agent-456", agentType: "eventAssistant" }],
      });
      (SendData as jest.Mock).mockResolvedValue({ success: true });

      await act(async () => {
        render(<EventAssistantRoom />);
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

      // Type and verify input value updates
      await user.type(messageInput, "Test");
      expect(messageInput.value).toBe("Test");

      // Clear and type again
      await user.clear(messageInput);
      expect(messageInput.value).toBe("");

      await user.type(messageInput, "New text");
      expect(messageInput.value).toBe("New text");

      // Send message
      await user.click(screen.getByLabelText("send message"));

      // Input should be cleared
      await waitFor(() => {
        expect(messageInput.value).toBe("");
      });

      // Should be able to type again immediately
      await user.type(messageInput, "After send");
      expect(messageInput.value).toBe("After send");
    });

    it("allows alternating between regular and controlled mode messages", async () => {
      const user = userEvent.setup();
      (JoinSession as jest.Mock).mockImplementation((onSuccess) => {
        onSuccess({ pseudonym: "test-pseudonym", userId: "user-123" });
      });
      (RetrieveData as jest.Mock).mockResolvedValue({
        agents: [{ id: "agent-456", agentType: "eventAssistant" }],
      });
      (SendData as jest.Mock).mockResolvedValue({ success: true });

      await act(async () => {
        render(<EventAssistantRoom />);
      });

      // Simulate socket connection and assistant message
      await act(async () => {
        const connectHandler = mockSocket.on.mock.calls.find(
          (call) => call[0] === "connect"
        )?.[1];
        if (connectHandler) connectHandler();
      });

      await act(async () => {
        const messageHandler = mockSocket.on.mock.calls.find(
          (call) => call[0] === "message:new"
        )?.[1];
        if (messageHandler) {
          messageHandler({
            id: "msg-alt",
            body: "Assistant says hi",
            pseudonym: "Event Assistant",
            createdAt: new Date().toISOString(),
          });
        }
      });

      const messageInput = screen.getByPlaceholderText("Write a Comment");

      // 1. Send regular message
      await user.type(messageInput, "Regular 1");
      await user.click(screen.getByLabelText("send message"));
      await waitFor(() => expect(messageInput).toHaveValue(""));

      // Simulate assistant response to reset waitingForResponse after regular message
      await act(async () => {
        const messageHandler = mockSocket.on.mock.calls.find(
          (call) => call[0] === "message:new"
        )?.[1];
        if (messageHandler) {
          messageHandler({
            id: "msg-response-1",
            body: "Response 1",
            pseudonym: "Event Assistant",
            createdAt: new Date().toISOString(),
          });
        }
      });

      // 2. Enter controlled mode and send feedback (use the original message's button)
      const sayMoreButtons = await screen.findAllByTestId("say-more-button");
      await user.click(sayMoreButtons[0]); // Click the first button (original message)
      await user.type(messageInput, "Feedback 1");
      await user.click(screen.getByLabelText("send message"));
      await waitFor(() => expect(messageInput).toHaveValue(""));

      // 3. Send another regular message
      await user.type(messageInput, "Regular 2");
      await user.click(screen.getByLabelText("send message"));
      await waitFor(() => expect(messageInput).toHaveValue(""));

      // Simulate assistant response to reset waitingForResponse
      await act(async () => {
        const messageHandler = mockSocket.on.mock.calls.find(
          (call) => call[0] === "message:new"
        )?.[1];
        if (messageHandler) {
          messageHandler({
            id: "msg-response",
            body: "Got it",
            pseudonym: "Event Assistant",
            createdAt: new Date().toISOString(),
          });
        }
      });

      // 4. Enter controlled mode again and send feedback
      const sayMoreButtonsAgain = await screen.findAllByTestId(
        "say-more-button"
      );
      await user.click(sayMoreButtonsAgain[0]);
      await user.type(messageInput, "Feedback 2");
      await user.click(screen.getByLabelText("send message"));
      await waitFor(() => expect(messageInput).toHaveValue(""));

      // All messages should have been sent
      expect(SendData).toHaveBeenCalledTimes(4);
    });

    it("clears input and exits controlled mode simultaneously", async () => {
      const user = userEvent.setup();
      (JoinSession as jest.Mock).mockImplementation((onSuccess) => {
        onSuccess({ pseudonym: "test-pseudonym", userId: "user-123" });
      });
      (RetrieveData as jest.Mock).mockResolvedValue({
        agents: [{ id: "agent-456", agentType: "eventAssistant" }],
      });
      (SendData as jest.Mock).mockResolvedValue({ success: true });

      await act(async () => {
        render(<EventAssistantRoom />);
      });

      // Simulate socket connection and message
      await act(async () => {
        const connectHandler = mockSocket.on.mock.calls.find(
          (call) => call[0] === "connect"
        )?.[1];
        if (connectHandler) connectHandler();
      });

      await act(async () => {
        const messageHandler = mockSocket.on.mock.calls.find(
          (call) => call[0] === "message:new"
        )?.[1];
        if (messageHandler) {
          messageHandler({
            id: "msg-clear",
            body: "Test",
            pseudonym: "Event Assistant",
            createdAt: new Date().toISOString(),
          });
        }
      });

      // Enter controlled mode
      const sayMoreButton = await screen.findByTestId("say-more-button");
      await user.click(sayMoreButton);

      await waitFor(() => {
        expect(screen.getByText(/Feedback Mode/i)).toBeInTheDocument();
      });

      // Type and send
      const messageInput = screen.getByPlaceholderText("Write a Comment");
      await user.type(messageInput, "Clear me");
      await user.click(screen.getByLabelText("send message"));

      // Both input should be cleared AND controlled mode should be exited
      await waitFor(() => {
        expect(messageInput).toHaveValue("");
        expect(screen.queryByText(/Feedback Mode/i)).not.toBeInTheDocument();
      });
    });

    it("handles Enter key in controlled mode without freezing", async () => {
      const user = userEvent.setup();
      (JoinSession as jest.Mock).mockImplementation((onSuccess) => {
        onSuccess({ pseudonym: "test-pseudonym", userId: "user-123" });
      });
      (RetrieveData as jest.Mock).mockResolvedValue({
        agents: [{ id: "agent-456", agentType: "eventAssistant" }],
      });
      (SendData as jest.Mock).mockResolvedValue({ success: true });

      await act(async () => {
        render(<EventAssistantRoom />);
      });

      // Simulate socket connection and message
      await act(async () => {
        const connectHandler = mockSocket.on.mock.calls.find(
          (call) => call[0] === "connect"
        )?.[1];
        if (connectHandler) connectHandler();
      });

      await act(async () => {
        const messageHandler = mockSocket.on.mock.calls.find(
          (call) => call[0] === "message:new"
        )?.[1];
        if (messageHandler) {
          messageHandler({
            id: "msg-enter",
            body: "Test",
            pseudonym: "Event Assistant",
            createdAt: new Date().toISOString(),
          });
        }
      });

      // Enter controlled mode
      const sayMoreButton = await screen.findByTestId("say-more-button");
      await user.click(sayMoreButton);

      const messageInput = screen.getByPlaceholderText("Write a Comment");

      // Send feedback with Enter key
      await user.type(messageInput, "Feedback via Enter{Enter}");

      await waitFor(() => {
        expect(SendData).toHaveBeenCalled();
        expect(messageInput).toHaveValue("");
      });

      // Should be able to type again immediately
      await user.type(messageInput, "Next message");
      expect(messageInput).toHaveValue("Next message");
    });
  });

  describe("Message Filtering and Submitted ID", () => {
    it("filters out messages with parentMessage from rendering", async () => {
      (JoinSession as jest.Mock).mockImplementation((onSuccess) => {
        onSuccess({ pseudonym: "test-pseudonym", userId: "user-123" });
      });
      (RetrieveData as jest.Mock).mockResolvedValue({
        agents: [{ id: "agent-456", agentType: "eventAssistant" }],
      });

      await act(async () => {
        render(<EventAssistantRoom />);
      });

      // Simulate socket connection
      await act(async () => {
        const connectHandler = mockSocket.on.mock.calls.find(
          (call) => call[0] === "connect"
        )?.[1];
        if (connectHandler) connectHandler();
      });

      // Add a regular message (should be displayed)
      await act(async () => {
        const messageHandler = mockSocket.on.mock.calls.find(
          (call) => call[0] === "message:new"
        )?.[1];
        if (messageHandler) {
          messageHandler({
            id: "msg-regular",
            body: "Regular message",
            pseudonym: "Event Assistant",
            createdAt: new Date().toISOString(),
          });
        }
      });

      // Add a message with parentMessage (should NOT be displayed)
      await act(async () => {
        const messageHandler = mockSocket.on.mock.calls.find(
          (call) => call[0] === "message:new"
        )?.[1];
        if (messageHandler) {
          messageHandler({
            id: "msg-with-parent",
            body: "Child message",
            pseudonym: "test-pseudonym",
            createdAt: new Date().toISOString(),
            parentMessage: "msg-regular",
          });
        }
      });

      // Regular message should be visible
      await waitFor(() => {
        expect(screen.getByText("Regular message")).toBeInTheDocument();
      });

      // Message with parentMessage should NOT be visible
      expect(screen.queryByText("Child message")).not.toBeInTheDocument();
    });

    it("recognizes Event Assistant Plus messages", async () => {
      (JoinSession as jest.Mock).mockImplementation((onSuccess) => {
        onSuccess({ pseudonym: "test-pseudonym", userId: "user-123" });
      });
      (RetrieveData as jest.Mock).mockResolvedValue({
        agents: [{ id: "agent-456", agentType: "eventAssistantPlus" }],
      });

      await act(async () => {
        render(<EventAssistantRoom />);
      });

      // Simulate socket connection
      await act(async () => {
        const connectHandler = mockSocket.on.mock.calls.find(
          (call) => call[0] === "connect"
        )?.[1];
        if (connectHandler) connectHandler();
      });

      // Add Event Assistant Plus message
      await act(async () => {
        const messageHandler = mockSocket.on.mock.calls.find(
          (call) => call[0] === "message:new"
        )?.[1];
        if (messageHandler) {
          messageHandler({
            id: "msg-plus",
            body: "Message from Plus",
            pseudonym: "Event Assistant Plus",
            createdAt: new Date().toISOString(),
          });
        }
      });

      await waitFor(() => {
        expect(screen.getByText("Message from Plus")).toBeInTheDocument();
      });

      // Should render as AssistantMessage
      const messageElement = screen
        .getByText("Message from Plus")
        .closest('[data-testid="assistant-message"]');
      expect(messageElement).toBeInTheDocument();
    });

    it("finds and applies submitted theme to referenced message", async () => {
      (JoinSession as jest.Mock).mockImplementation((onSuccess) => {
        onSuccess({ pseudonym: "test-pseudonym", userId: "user-123" });
      });
      (RetrieveData as jest.Mock).mockResolvedValue({
        agents: [{ id: "agent-456", agentType: "eventAssistant" }],
      });

      await act(async () => {
        render(<EventAssistantRoom />);
      });

      // Simulate socket connection
      await act(async () => {
        const connectHandler = mockSocket.on.mock.calls.find(
          (call) => call[0] === "connect"
        )?.[1];
        if (connectHandler) connectHandler();
      });

      // Add a user question that will be referenced
      await act(async () => {
        const messageHandler = mockSocket.on.mock.calls.find(
          (call) => call[0] === "message:new"
        )?.[1];
        if (messageHandler) {
          messageHandler({
            id: "msg-question",
            body: "User question text",
            pseudonym: "test-pseudonym",
            createdAt: new Date().toISOString(),
          });
        }
      });

      // Add a moderator_submitted message that references the question
      await act(async () => {
        const messageHandler = mockSocket.on.mock.calls.find(
          (call) => call[0] === "message:new"
        )?.[1];
        if (messageHandler) {
          messageHandler({
            id: "msg-confirmation",
            body: {
              text: "Your question has been submitted",
              type: "moderator_submitted",
              message: "msg-question",
            },
            pseudonym: "Event Assistant",
            createdAt: new Date().toISOString(),
          });
        }
      });

      await waitFor(() => {
        expect(screen.getByText("User question text")).toBeInTheDocument();
        expect(
          screen.getByText("Your question has been submitted")
        ).toBeInTheDocument();
      });

      // The referenced message should render as SubmittedMessage
      const questionElement = screen
        .getByText("User question text")
        .closest('[data-testid="submitted-message"]');
      expect(questionElement).toBeInTheDocument();
    });

    it("handles multiple moderator_submitted messages correctly", async () => {
      (JoinSession as jest.Mock).mockImplementation((onSuccess) => {
        onSuccess({ pseudonym: "test-pseudonym", userId: "user-123" });
      });
      (RetrieveData as jest.Mock).mockResolvedValue({
        agents: [{ id: "agent-456", agentType: "eventAssistant" }],
      });

      await act(async () => {
        render(<EventAssistantRoom />);
      });

      // Simulate socket connection
      await act(async () => {
        const connectHandler = mockSocket.on.mock.calls.find(
          (call) => call[0] === "connect"
        )?.[1];
        if (connectHandler) connectHandler();
      });

      // Add first question
      await act(async () => {
        const messageHandler = mockSocket.on.mock.calls.find(
          (call) => call[0] === "message:new"
        )?.[1];
        if (messageHandler) {
          messageHandler({
            id: "msg-q1",
            body: "First question",
            pseudonym: "test-pseudonym",
            createdAt: new Date().toISOString(),
          });
        }
      });

      // Add second question
      await act(async () => {
        const messageHandler = mockSocket.on.mock.calls.find(
          (call) => call[0] === "message:new"
        )?.[1];
        if (messageHandler) {
          messageHandler({
            id: "msg-q2",
            body: "Second question",
            pseudonym: "test-pseudonym",
            createdAt: new Date().toISOString(),
          });
        }
      });

      // Add first confirmation
      await act(async () => {
        const messageHandler = mockSocket.on.mock.calls.find(
          (call) => call[0] === "message:new"
        )?.[1];
        if (messageHandler) {
          messageHandler({
            id: "msg-conf1",
            body: {
              text: "First submitted",
              type: "moderator_submitted",
              message: "msg-q1",
            },
            pseudonym: "Event Assistant",
            createdAt: new Date().toISOString(),
          });
        }
      });

      // Add second confirmation
      await act(async () => {
        const messageHandler = mockSocket.on.mock.calls.find(
          (call) => call[0] === "message:new"
        )?.[1];
        if (messageHandler) {
          messageHandler({
            id: "msg-conf2",
            body: {
              text: "Second submitted",
              type: "moderator_submitted",
              message: "msg-q2",
            },
            pseudonym: "Event Assistant",
            createdAt: new Date().toISOString(),
          });
        }
      });

      await waitFor(() => {
        expect(screen.getByText("First question")).toBeInTheDocument();
        expect(screen.getByText("Second question")).toBeInTheDocument();
        expect(screen.getByText("First submitted")).toBeInTheDocument();
        expect(screen.getByText("Second submitted")).toBeInTheDocument();
      });

      // BOTH referenced messages should render as SubmittedMessage
      const firstQuestion = screen
        .getByText("First question")
        .closest('[data-testid="submitted-message"]');
      const secondQuestion = screen
        .getByText("Second question")
        .closest('[data-testid="submitted-message"]');

      expect(firstQuestion).toBeInTheDocument();
      expect(secondQuestion).toBeInTheDocument();
    });

    it("does not add messages with parentMessage to state", async () => {
      (JoinSession as jest.Mock).mockImplementation((onSuccess) => {
        onSuccess({ pseudonym: "test-pseudonym", userId: "user-123" });
      });
      (RetrieveData as jest.Mock).mockResolvedValue({
        agents: [{ id: "agent-456", agentType: "eventAssistant" }],
      });

      await act(async () => {
        render(<EventAssistantRoom />);
      });

      // Simulate socket connection
      await act(async () => {
        const connectHandler = mockSocket.on.mock.calls.find(
          (call) => call[0] === "connect"
        )?.[1];
        if (connectHandler) connectHandler();
      });

      // Add regular message
      await act(async () => {
        const messageHandler = mockSocket.on.mock.calls.find(
          (call) => call[0] === "message:new"
        )?.[1];
        if (messageHandler) {
          messageHandler({
            id: "msg-1",
            body: "Message one",
            pseudonym: "test-pseudonym",
            createdAt: new Date().toISOString(),
          });
        }
      });

      // Add message with parentMessage
      await act(async () => {
        const messageHandler = mockSocket.on.mock.calls.find(
          (call) => call[0] === "message:new"
        )?.[1];
        if (messageHandler) {
          messageHandler({
            id: "msg-2",
            body: "Message two with parent",
            pseudonym: "test-pseudonym",
            createdAt: new Date().toISOString(),
            parentMessage: "msg-1",
          });
        }
      });

      // Only the first message should be rendered
      await waitFor(() => {
        expect(screen.getByText("Message one")).toBeInTheDocument();
      });

      // Second message should not exist at all
      expect(
        screen.queryByText("Message two with parent")
      ).not.toBeInTheDocument();

      // Verify only one message component was rendered (could be user or assistant message)
      const userMessages = screen.queryAllByTestId("user-message");
      const assistantMessages = screen.queryAllByTestId("assistant-message");
      const totalMessages = userMessages.length + assistantMessages.length;
      expect(totalMessages).toBe(1);
    });
  });
});
