import React from "react";
import { render, screen, waitFor, act } from "@testing-library/react";
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

    // Mock scrollIntoView
    Element.prototype.scrollIntoView = jest.fn();
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
});
