import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AssistantChatPanel } from "../../components/AssistantChatPanel";

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
}));

// Mock MessageInput component
jest.mock("../../components/MessageInput", () => ({
  MessageInput: ({ onSendMessage, waitingForResponse }: any) => (
    <div data-testid="message-input">
      <input
        data-testid="message-input-field"
        placeholder="Write a Comment"
        onKeyPress={(e) => {
          if (e.key === "Enter" && e.currentTarget.value) {
            onSendMessage(e.currentTarget.value);
            e.currentTarget.value = "";
          }
        }}
        disabled={waitingForResponse}
      />
    </div>
  ),
}));

describe("AssistantChatPanel", () => {
  const mockOnSendMessage = jest.fn();
  const mockOnExitControlledMode = jest.fn();
  const mockOnPromptSelect = jest.fn();
  const mockEnterControlledMode = jest.fn();
  const mockSendFeedbackRating = jest.fn();

  const baseProps = {
    messages: [],
    pseudonym: "test-user",
    waitingForResponse: false,
    controlledMode: null,
    slashCommands: [],
    onSendMessage: mockOnSendMessage,
    onExitControlledMode: mockOnExitControlledMode,
    onPromptSelect: mockOnPromptSelect,
    enterControlledMode: mockEnterControlledMode,
    sendFeedbackRating: mockSendFeedbackRating,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders without messages", () => {
    render(<AssistantChatPanel {...baseProps} />);

    expect(screen.getByTestId("message-input")).toBeInTheDocument();
    expect(screen.queryByTestId("assistant-message")).not.toBeInTheDocument();
  });

  it("renders assistant messages", () => {
    const messages = [
      {
        id: "1",
        pseudonym: "Event Assistant",
        createdAt: "2025-10-17T12:00:00Z",
        body: "Hello, how can I help?",
        channels: ["user"],
        conversation: "conv-1",
        pseudonymId: "ea-1",
        fromAgent: true,
        pause: false,
        visible: true,
        upVotes: [],
        downVotes: [],
      },
    ];

    render(<AssistantChatPanel {...baseProps} messages={messages} />);

    expect(screen.getByText("Hello, how can I help?")).toBeInTheDocument();
    expect(screen.getByTestId("assistant-message")).toBeInTheDocument();
  });

  it("renders user messages", () => {
    const messages = [
      {
        id: "2",
        pseudonym: "test-user",
        createdAt: "2025-10-17T12:01:00Z",
        body: { text: "I need help" },
        channels: ["user"],
        conversation: "conv-1",
        pseudonymId: "ea-1",
        fromAgent: true,
        pause: false,
        visible: true,
        upVotes: [],
        downVotes: [],
      },
    ];

    render(<AssistantChatPanel {...baseProps} messages={messages} />);

    expect(screen.getByText("I need help")).toBeInTheDocument();
  });

  it("renders moderator_submitted messages", () => {
    const messages = [
      {
        id: "3",
        pseudonym: "test-user",
        createdAt: "2025-10-17T12:02:00Z",
        body: {
          text: "This was submitted",
          type: "moderator_submitted",
          message: "1",
        },
        channels: ["user"],
        conversation: "conv-1",
        pseudonymId: "ea-1",
        fromAgent: true,
        pause: false,
        visible: true,
        upVotes: [],
        downVotes: [],
      },
    ];

    render(<AssistantChatPanel {...baseProps} messages={messages} />);

    expect(screen.getByText("This was submitted")).toBeInTheDocument();
    expect(
      screen.getByTestId("moderator-submitted-message")
    ).toBeInTheDocument();
  });

  it("renders submitted messages (referenced by moderator)", () => {
    const messages = [
      {
        id: "1",
        pseudonym: "test-user",
        createdAt: "2025-10-17T12:00:00Z",
        body: { text: "Original message" },
        channels: ["user"],
        conversation: "conv-1",
        pseudonymId: "ea-1",
        fromAgent: true,
        pause: false,
        visible: true,
        upVotes: [],
        downVotes: [],
      },
      {
        id: "2",
        pseudonym: "Event Assistant",
        createdAt: "2025-10-17T12:01:00Z",
        body: { text: "Response", type: "moderator_submitted", message: "1" },
        channels: ["user"],
        conversation: "conv-1",
        pseudonymId: "ea-1",
        fromAgent: true,
        pause: false,
        visible: true,
        upVotes: [],
        downVotes: [],
      },
    ];

    render(<AssistantChatPanel {...baseProps} messages={messages} />);

    expect(screen.getByText("Original message")).toBeInTheDocument();
    expect(screen.getByTestId("submitted-message")).toBeInTheDocument();
  });

  it("filters out parent messages", () => {
    const messages = [
      {
        id: "1",
        pseudonym: "test-user",
        createdAt: "2025-10-17T12:00:00Z",
        body: { text: "Main message" },
        channels: ["user"],
        conversation: "conv-1",
        pseudonymId: "ea-1",
        fromAgent: true,
        pause: false,
        visible: true,
        upVotes: [],
        downVotes: [],
      },
      {
        id: "2",
        pseudonym: "test-user",
        createdAt: "2025-10-17T12:01:00Z",
        body: { text: "Child message" },
        channels: ["user"],
        parentMessage: "1",
        conversation: "conv-1",
        pseudonymId: "ea-1",
        fromAgent: true,
        pause: false,
        visible: true,
        upVotes: [],
        downVotes: [],
      },
    ];

    render(<AssistantChatPanel {...baseProps} messages={messages} />);

    expect(screen.getByText("Main message")).toBeInTheDocument();
    expect(screen.queryByText("Child message")).not.toBeInTheDocument();
  });

  it("shows loading indicator when waiting for response", () => {
    const messages = [
      {
        id: "1",
        pseudonym: "Event Assistant",
        createdAt: "2025-10-17T12:00:00Z",
        body: { text: "Hello" },
        channels: ["user"],
        conversation: "conv-1",
        pseudonymId: "ea-1",
        fromAgent: true,
        pause: false,
        visible: true,
        upVotes: [],
        downVotes: [],
      },
      {
        id: "2",
        pseudonym: "test-user",
        createdAt: "2025-10-17T12:01:00Z",
        body: { text: "Tell me more" },
        channels: ["user"],
        conversation: "conv-1",
        pseudonymId: "tu-1",
        fromAgent: false,
        pause: false,
        visible: true,
        upVotes: [],
        downVotes: [],
      },
    ];

    const { container } = render(
      <AssistantChatPanel
        {...baseProps}
        messages={messages}
        waitingForResponse={true}
      />
    );

    // Should show animated SVG bot loading indicator below the user's message
    const loadingIndicator = container.querySelector(".animate-bounce");
    expect(loadingIndicator).toBeInTheDocument();
  });

  it("calls onSendMessage when user sends a message", async () => {
    const user = userEvent.setup();

    render(<AssistantChatPanel {...baseProps} />);

    const input = screen.getByTestId("message-input-field");

    await user.type(input, "Test message");
    await user.keyboard("{Enter}");

    expect(mockOnSendMessage).toHaveBeenCalledWith("Test message");
  });

  it("calls sendFeedbackRating when rating button is clicked", async () => {
    const user = userEvent.setup();

    const messages = [
      {
        id: "1",
        pseudonym: "Event Assistant",
        createdAt: "2025-10-17T12:00:00Z",
        body: { text: "Hello" },
        channels: ["user"],
        conversation: "conv-1",
        pseudonymId: "ea-1",
        fromAgent: true,
        pause: false,
        visible: true,
        upVotes: [],
        downVotes: [],
      },
    ];

    render(<AssistantChatPanel {...baseProps} messages={messages} />);

    const ratingButton = screen.getByTestId("rating-button-3");
    await user.click(ratingButton);

    expect(mockSendFeedbackRating).toHaveBeenCalledWith("1", 3);
  });

  it("calls enterControlledMode when 'Say more' is clicked", async () => {
    const user = userEvent.setup();

    const messages = [
      {
        id: "1",
        pseudonym: "Event Assistant",
        createdAt: "2025-10-17T12:00:00Z",
        body: { text: "Hello" },
        channels: ["user"],
        conversation: "conv-1",
        pseudonymId: "ea-1",
        fromAgent: true,
        pause: false,
        visible: true,
        upVotes: [],
        downVotes: [],
      },
    ];

    render(<AssistantChatPanel {...baseProps} messages={messages} />);

    const sayMoreButton = screen.getByTestId("say-more-button");
    await user.click(sayMoreButton);

    expect(mockEnterControlledMode).toHaveBeenCalledWith(
      expect.objectContaining({
        prefix: "/feedback|Text|1|",
        label: "Feedback Mode",
      })
    );
  });

  it("scrolls to bottom when new messages arrive", async () => {
    const { rerender, container } = render(
      <AssistantChatPanel {...baseProps} messages={[]} />
    );

    // Get the scrollable messages container
    const messagesContainer = container.querySelector(".overflow-y-auto");

    // Mock scrollTop and scrollHeight
    Object.defineProperty(messagesContainer, "scrollHeight", {
      configurable: true,
      value: 1000,
    });

    const scrollTopSpy = jest.fn();
    Object.defineProperty(messagesContainer, "scrollTop", {
      configurable: true,
      set: scrollTopSpy,
      get: () => 0,
    });

    const newMessages = [
      {
        id: "1",
        pseudonym: "Event Assistant",
        createdAt: "2025-10-17T12:00:00Z",
        body: { text: "New message" },
        channels: ["user"],
        conversation: "conv-1",
        pseudonymId: "ea-1",
        fromAgent: true,
        pause: false,
        visible: true,
        upVotes: [],
        downVotes: [],
      },
    ];

    rerender(<AssistantChatPanel {...baseProps} messages={newMessages} />);

    await waitFor(() => {
      expect(scrollTopSpy).toHaveBeenCalledWith(1000);
    });
  });

  it("parses message body correctly for string input", () => {
    const messages = [
      {
        id: "1",
        pseudonym: "test-user",
        createdAt: "2025-10-17T12:00:00Z",
        body: "Simple string message",
        channels: ["user"],
        conversation: "conv-1",
        pseudonymId: "ea-1",
        fromAgent: true,
        pause: false,
        visible: true,
        upVotes: [],
        downVotes: [],
      },
    ];

    render(<AssistantChatPanel {...baseProps} messages={messages} />);

    expect(screen.getByText("Simple string message")).toBeInTheDocument();
  });

  it("parses message body correctly for object input", () => {
    const messages = [
      {
        id: "1",
        pseudonym: "test-user",
        createdAt: "2025-10-17T12:00:00Z",
        body: { text: "Object message", someField: "value" },
        channels: ["user"],
        conversation: "conv-1",
        pseudonymId: "ea-1",
        fromAgent: true,
        pause: false,
        visible: true,
        upVotes: [],
        downVotes: [],
      },
    ];

    render(<AssistantChatPanel {...baseProps} messages={messages} />);

    expect(screen.getByText("Object message")).toBeInTheDocument();
  });
});
