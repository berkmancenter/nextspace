import React from "react";
import {
  render,
  screen,
  waitFor,
  act,
  fireEvent,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import EventAssistantRoom from "../../pages/assistant";
import { JoinSession, RetrieveData, SendData } from "../../utils";
import { createConversationFromData } from "../../utils/Helpers";
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

    // Mock scrollIntoView for SlashCommandMenu
    HTMLElement.prototype.scrollIntoView = jest.fn();
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

    (createConversationFromData as jest.Mock).mockResolvedValue({
      agents: [{ id: "agent-123", agentType: "regular" }],
      type: { name: "eventAssistant" },
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

  describe("Slash Command Functionality", () => {
    const setupConnectedRoom = async () => {
      (JoinSession as jest.Mock).mockImplementation((onSuccess) => {
        onSuccess({ pseudonym: "test-pseudonym", userId: "user-123" });
      });
      (RetrieveData as jest.Mock).mockResolvedValue({
        agents: [{ id: "agent-456", agentType: "eventAssistantPlus" }],
      });
      (createConversationFromData as jest.Mock).mockResolvedValue({
        agents: [{ id: "agent-456", agentType: "eventAssistantPlus" }],
        type: { name: "eventAssistantPlus" },
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
        expect(
          screen.getByPlaceholderText("Write a Comment")
        ).toBeInTheDocument();
      });
    };

    it("shows slash command menu when typing '/'", async () => {
      await setupConnectedRoom();
      const user = userEvent.setup();
      const input = screen.getByPlaceholderText("Write a Comment");

      await user.type(input, "/");

      await waitFor(() => {
        expect(screen.getByText("/mod")).toBeInTheDocument();
        expect(
          screen.getByText("Submit a question to the moderator")
        ).toBeInTheDocument();
      });
    });

    it("hides slash command menu when space is typed after command", async () => {
      await setupConnectedRoom();
      const user = userEvent.setup();
      const input = screen.getByPlaceholderText("Write a Comment");

      await user.type(input, "/mod ");

      await waitFor(() => {
        expect(screen.queryByText("/mod")).not.toBeInTheDocument();
      });
    });

    it("hides slash command menu when input is cleared", async () => {
      await setupConnectedRoom();
      const user = userEvent.setup();
      const input = screen.getByPlaceholderText("Write a Comment");

      await user.type(input, "/");

      await waitFor(() => {
        expect(screen.getByText("/mod")).toBeInTheDocument();
      });

      await user.clear(input);

      await waitFor(() => {
        expect(screen.queryByText("/mod")).not.toBeInTheDocument();
      });
    });

    it("selects slash command when clicked", async () => {
      await setupConnectedRoom();
      const user = userEvent.setup();
      const input = screen.getByPlaceholderText(
        "Write a Comment"
      ) as HTMLInputElement;

      await user.type(input, "/");

      await waitFor(() => {
        expect(screen.getByText("/mod")).toBeInTheDocument();
      });

      const modCommand = screen.getByText("/mod");
      await user.click(modCommand);

      await waitFor(() => {
        expect(input.value).toBe("/mod ");
        expect(screen.queryByText("/mod")).not.toBeInTheDocument();
      });
    });

    it("positions cursor at end of command after selection", async () => {
      await setupConnectedRoom();
      const user = userEvent.setup();
      const input = screen.getByPlaceholderText(
        "Write a Comment"
      ) as HTMLInputElement;

      await user.type(input, "/");

      await waitFor(() => {
        expect(screen.getByText("/mod")).toBeInTheDocument();
      });

      const modCommand = screen.getByText("/mod");
      await user.click(modCommand);

      await waitFor(() => {
        expect(input.value).toBe("/mod ");
        // Cursor should be at position 5 (after "/mod ")
        expect(input.selectionStart).toBe(5);
        expect(input.selectionEnd).toBe(5);
      });
    });

    it("navigates slash commands with arrow keys", async () => {
      await setupConnectedRoom();
      const user = userEvent.setup();
      const input = screen.getByPlaceholderText("Write a Comment");

      await user.type(input, "/");

      await waitFor(() => {
        expect(screen.getByText("/mod")).toBeInTheDocument();
      });

      // Arrow down (wraps to same item if only one command)
      fireEvent.keyDown(window, { key: "ArrowDown", code: "ArrowDown" });

      // Arrow up (wraps to same item if only one command)
      fireEvent.keyDown(window, { key: "ArrowUp", code: "ArrowUp" });

      // Command menu should still be visible
      expect(screen.getByText("/mod")).toBeInTheDocument();
    });

    it("selects command with Enter key", async () => {
      await setupConnectedRoom();
      const user = userEvent.setup();
      const input = screen.getByPlaceholderText(
        "Write a Comment"
      ) as HTMLInputElement;

      // Click to focus, then type the slash
      await user.click(input);
      await user.keyboard("/");

      await waitFor(() => {
        expect(screen.getByText("/mod")).toBeInTheDocument();
        expect(input.value).toBe("/");
      });

      // Press Enter using fireEvent to trigger window-level keydown event
      fireEvent.keyDown(window, { key: "Enter", code: "Enter" });

      await waitFor(() => {
        expect(input.value).toBe("/mod ");
      });

      // Menu should be closed
      expect(screen.queryByText("/mod")).not.toBeInTheDocument();
    });

    it("closes slash menu with Escape key", async () => {
      await setupConnectedRoom();
      const user = userEvent.setup();
      const input = screen.getByPlaceholderText(
        "Write a Comment"
      ) as HTMLInputElement;

      await user.type(input, "/");

      await waitFor(() => {
        expect(screen.getByText("/mod")).toBeInTheDocument();
      });

      fireEvent.keyDown(window, { key: "Escape", code: "Escape" });

      await waitFor(() => {
        expect(screen.queryByText("/mod")).not.toBeInTheDocument();
        // Input value should remain
        expect(input.value).toBe("/");
      });
    });

    it("allows typing after slash command selection", async () => {
      await setupConnectedRoom();
      const user = userEvent.setup();
      const input = screen.getByPlaceholderText(
        "Write a Comment"
      ) as HTMLInputElement;

      await user.type(input, "/");

      await waitFor(() => {
        expect(screen.getByText("/mod")).toBeInTheDocument();
      });

      const modCommand = screen.getByText("/mod");
      await user.click(modCommand);

      await waitFor(() => {
        expect(input.value).toBe("/mod ");
      });

      await user.type(input, "My question for the moderator");

      await waitFor(() => {
        expect(input.value).toBe("/mod My question for the moderator");
      });
    });

    it("sends message with slash command prefix", async () => {
      await setupConnectedRoom();
      const user = userEvent.setup();
      const input = screen.getByPlaceholderText("Write a Comment");

      await user.type(input, "/");
      const modCommand = screen.getByText("/mod");
      await user.click(modCommand);

      await waitFor(() => {
        expect((input as HTMLInputElement).value).toBe("/mod ");
      });

      await user.type(input, "Test question");

      const sendButton = screen.getByLabelText("send message");
      await user.click(sendButton);

      await waitFor(() => {
        expect(SendData).toHaveBeenCalledWith("messages", {
          body: "/mod Test question",
          bodyType: "text",
          conversation: "test-conversation-id",
          channels: [{ name: "direct-user-123-agent-456" }],
        });
      });
    });

    it("shows slash menu again after clearing command text", async () => {
      await setupConnectedRoom();
      const user = userEvent.setup();
      const input = screen.getByPlaceholderText("Write a Comment");

      await user.type(input, "/mod something");

      await waitFor(() => {
        expect(screen.queryByText("/mod")).not.toBeInTheDocument();
      });

      // Clear and type slash again
      await user.clear(input);
      await user.type(input, "/");

      await waitFor(() => {
        expect(screen.getByText("/mod")).toBeInTheDocument();
      });
    });

    it("maintains focus on input after slash command selection", async () => {
      await setupConnectedRoom();
      const user = userEvent.setup();
      const input = screen.getByPlaceholderText("Write a Comment");

      await user.type(input, "/");

      await waitFor(() => {
        expect(screen.getByText("/mod")).toBeInTheDocument();
      });

      const modCommand = screen.getByText("/mod");
      await user.click(modCommand);

      await waitFor(() => {
        expect(document.activeElement).toBe(input);
      });
    });

    it("filters commands based on typed text", async () => {
      await setupConnectedRoom();
      const user = userEvent.setup();
      const input = screen.getByPlaceholderText("Write a Comment");

      // Type /m - should show /mod
      await user.type(input, "/m");

      await waitFor(() => {
        expect(screen.getByText("/mod")).toBeInTheDocument();
      });
    });

    it("hides menu when typed text matches no commands", async () => {
      await setupConnectedRoom();
      const user = userEvent.setup();
      const input = screen.getByPlaceholderText("Write a Comment");

      // Type /x - should not match any command
      await user.type(input, "/x");

      // Wait a bit to ensure menu doesn't appear
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(screen.queryByText("/mod")).not.toBeInTheDocument();
    });

    it("shows menu again when backspacing to matching text", async () => {
      await setupConnectedRoom();
      const user = userEvent.setup();
      const input = screen.getByPlaceholderText(
        "Write a Comment"
      ) as HTMLInputElement;

      // Type /xyz - no match
      await user.type(input, "/xyz");

      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(screen.queryByText("/mod")).not.toBeInTheDocument();

      // Backspace to /m - should show menu again
      await user.clear(input);
      await user.type(input, "/m");

      await waitFor(() => {
        expect(screen.getByText("/mod")).toBeInTheDocument();
      });
    });

    it("filtering is case insensitive", async () => {
      await setupConnectedRoom();
      const user = userEvent.setup();
      const input = screen.getByPlaceholderText("Write a Comment");

      // Type /M (uppercase) - should still show /mod
      await user.type(input, "/M");

      await waitFor(() => {
        expect(screen.getByText("/mod")).toBeInTheDocument();
      });
    });

    it("selects correct filtered command with Enter key", async () => {
      await setupConnectedRoom();
      const user = userEvent.setup();
      const input = screen.getByPlaceholderText(
        "Write a Comment"
      ) as HTMLInputElement;

      // Type /mo to filter
      await user.click(input);
      await user.keyboard("/mo");

      await waitFor(() => {
        expect(screen.getByText("/mod")).toBeInTheDocument();
      });

      // Press Enter to select
      fireEvent.keyDown(window, { key: "Enter", code: "Enter" });

      await waitFor(() => {
        expect(input.value).toBe("/mod ");
      });
    });

    it("does not send message when Enter selects a slash command", async () => {
      await setupConnectedRoom();
      const user = userEvent.setup();
      const input = screen.getByPlaceholderText(
        "Write a Comment"
      ) as HTMLInputElement;

      // Type / to show menu
      await user.click(input);
      await user.keyboard("/");

      await waitFor(() => {
        expect(screen.getByText("/mod")).toBeInTheDocument();
      });

      // Press Enter to select command - this should NOT send a message
      fireEvent.keyDown(window, { key: "Enter", code: "Enter" });
      fireEvent.keyUp(input, { key: "Enter", code: "Enter" });

      await waitFor(() => {
        expect(input.value).toBe("/mod ");
      });

      // SendData should not have been called
      expect(SendData).not.toHaveBeenCalled();
    });

    it("does not show slash menu when typing regular text", async () => {
      await setupConnectedRoom();
      const user = userEvent.setup();
      const input = screen.getByPlaceholderText("Write a Comment");

      await user.type(input, "Hello");

      // Wait a bit to ensure menu doesn't appear
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(screen.queryByText("/mod")).not.toBeInTheDocument();
    });

    it("does not show slash menu when typing slash mid-message", async () => {
      await setupConnectedRoom();
      const user = userEvent.setup();
      const input = screen.getByPlaceholderText("Write a Comment");

      await user.type(input, "Hello / world");

      // Wait a bit to ensure menu doesn't appear
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(screen.queryByText("/mod")).not.toBeInTheDocument();
    });
  });

  describe("Conversation-Type-Specific Commands", () => {
    it("shows /mod command for Event Assistant Plus", async () => {
      (JoinSession as jest.Mock).mockImplementation((onSuccess) => {
        onSuccess({ pseudonym: "test-pseudonym", userId: "user-123" });
      });
      (RetrieveData as jest.Mock).mockResolvedValue({
        agents: [{ id: "agent-456", agentType: "eventAssistantPlus" }],
      });
      (createConversationFromData as jest.Mock).mockResolvedValue({
        agents: [{ id: "agent-456", agentType: "eventAssistantPlus" }],
        type: { name: "eventAssistantPlus" },
      });

      await act(async () => {
        render(<EventAssistantRoom />);
      });

      await act(async () => {
        const connectHandler = mockSocket.on.mock.calls.find(
          (call) => call[0] === "connect"
        )?.[1];
        if (connectHandler) connectHandler();
      });

      await waitFor(() => {
        expect(
          screen.getByPlaceholderText("Write a Comment")
        ).toBeInTheDocument();
      });

      const user = userEvent.setup();
      const input = screen.getByPlaceholderText("Write a Comment");

      await user.type(input, "/");

      await waitFor(() => {
        expect(screen.getByText("/mod")).toBeInTheDocument();
      });
    });

    it("does not show /mod command for Event Assistant (non-Plus)", async () => {
      (JoinSession as jest.Mock).mockImplementation((onSuccess) => {
        onSuccess({ pseudonym: "test-pseudonym", userId: "user-123" });
      });
      (RetrieveData as jest.Mock).mockResolvedValue({
        agents: [{ id: "agent-456", agentType: "eventAssistant" }],
      });
      (createConversationFromData as jest.Mock).mockResolvedValue({
        agents: [{ id: "agent-456", agentType: "eventAssistant" }],
        type: { name: "eventAssistant" },
      });

      await act(async () => {
        render(<EventAssistantRoom />);
      });

      await act(async () => {
        const connectHandler = mockSocket.on.mock.calls.find(
          (call) => call[0] === "connect"
        )?.[1];
        if (connectHandler) connectHandler();
      });

      await waitFor(() => {
        expect(
          screen.getByPlaceholderText("Write a Comment")
        ).toBeInTheDocument();
      });

      const user = userEvent.setup();
      const input = screen.getByPlaceholderText("Write a Comment");

      await user.type(input, "/");

      // Wait a bit to ensure menu doesn't appear
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(screen.queryByText("/mod")).not.toBeInTheDocument();
    });
  });

  describe("Message Sending", () => {
    it("sends message when send button is clicked", async () => {
      (JoinSession as jest.Mock).mockImplementation((onSuccess) => {
        onSuccess({ pseudonym: "test-pseudonym", userId: "user-123" });
      });
      (RetrieveData as jest.Mock).mockResolvedValue({
        agents: [{ id: "agent-456", agentType: "eventAssistant" }],
      });
      (createConversationFromData as jest.Mock).mockResolvedValue({
        agents: [{ id: "agent-456", agentType: "eventAssistant" }],
        type: { name: "eventAssistant" },
      });

      await act(async () => {
        render(<EventAssistantRoom />);
      });

      await act(async () => {
        const connectHandler = mockSocket.on.mock.calls.find(
          (call) => call[0] === "connect"
        )?.[1];
        if (connectHandler) connectHandler();
      });

      await waitFor(() => {
        expect(
          screen.getByPlaceholderText("Write a Comment")
        ).toBeInTheDocument();
      });

      const user = userEvent.setup();
      const input = screen.getByPlaceholderText("Write a Comment");
      const sendButton = screen.getByLabelText("send message");

      await user.type(input, "Test message");
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

    it("clears input after sending message", async () => {
      (JoinSession as jest.Mock).mockImplementation((onSuccess) => {
        onSuccess({ pseudonym: "test-pseudonym", userId: "user-123" });
      });
      (RetrieveData as jest.Mock).mockResolvedValue({
        agents: [{ id: "agent-456", agentType: "eventAssistant" }],
      });
      (createConversationFromData as jest.Mock).mockResolvedValue({
        agents: [{ id: "agent-456", agentType: "eventAssistant" }],
        type: { name: "eventAssistant" },
      });

      await act(async () => {
        render(<EventAssistantRoom />);
      });

      await act(async () => {
        const connectHandler = mockSocket.on.mock.calls.find(
          (call) => call[0] === "connect"
        )?.[1];
        if (connectHandler) connectHandler();
      });

      await waitFor(() => {
        expect(
          screen.getByPlaceholderText("Write a Comment")
        ).toBeInTheDocument();
      });

      const user = userEvent.setup();
      const input = screen.getByPlaceholderText(
        "Write a Comment"
      ) as HTMLInputElement;
      const sendButton = screen.getByLabelText("send message");

      await user.type(input, "Test message");
      await user.click(sendButton);

      await waitFor(() => {
        expect(input.value).toBe("");
      });
    });
  });
});
