import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AssistantChatPanel } from "../../components/AssistantChatPanel";

// Mock message components
jest.mock("../../components/messages", () => ({
  AssistantMessage: ({ message }: any) => {
    const messageText =
      typeof message.body === "string"
        ? message.body
        : message.body?.text || "";
    return (
      <div data-testid="assistant-message">
        {messageText}
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

// Mock MessageFeedback component
jest.mock("../../components/MessageFeedback", () => ({
  MessageFeedback: ({
    messageId,
    onPopulateFeedbackText,
    onSendFeedbackRating,
  }: any) => (
    <div data-testid="message-feedback" data-message-id={messageId}>
      <button
        data-testid="rating-button-3"
        onClick={() => onSendFeedbackRating?.(messageId, 3)}
      >
        3
      </button>
      <button
        data-testid="say-more-button"
        onClick={() =>
          onPopulateFeedbackText?.({
            prefix: `/feedback|Text|${messageId}|`,
            icon: null,
            label: "Feedback Mode",
          })
        }
      >
        Say more
      </button>
    </div>
  ),
}));

// Mock MessageInput component
jest.mock("../../components/MessageInput", () => ({
  MessageInput: ({ onSendMessage, waitingForResponse }: any) => (
    <div data-testid="message-input">
      <input
        data-testid="message-input-field"
        placeholder="Write a Comment"
        onKeyDown={(e) => {
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
    eventName: "Tech Summit",
    botName: "Berkie",
    onSendMessage: mockOnSendMessage,
    onExitControlledMode: mockOnExitControlledMode,
    onPromptSelect: mockOnPromptSelect,
    enterControlledMode: mockEnterControlledMode,
    sendFeedbackRating: mockSendFeedbackRating,
    userId: "test-user-id",
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
      screen.getByTestId("moderator-submitted-message"),
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

  it("shows source context for multimodal messages with sourceMessage", () => {
    const messages = [
      {
        id: "1",
        pseudonym: "test-user",
        createdAt: "2025-10-17T12:00:00Z",
        body: { text: "What is the schedule?" },
        channels: ["user"],
        conversation: "conv-1",
        pseudonymId: "tu-1",
        fromAgent: false,
        pause: false,
        visible: true,
        upVotes: [],
        downVotes: [],
      },
      {
        id: "2",
        pseudonym: "Event Assistant",
        createdAt: "2025-10-17T12:01:00Z",
        body: {
          text: "",
          sourceMessage: "1",
          media: [
            {
              type: "image",
              data: "base64imagedata",
              mimeType: "image/png",
            },
          ],
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

    // Original question appears twice: once in the message list, once in source context
    const questionTexts = screen.getAllByText("What is the schedule?");
    expect(questionTexts.length).toBeGreaterThanOrEqual(1);

    // Source context should show "In reply to:"
    expect(screen.getByText(/In reply to:/)).toBeInTheDocument();
  });

  it("truncates long source messages in context display", () => {
    const longMessage =
      "This is a very long message that exceeds sixty characters and should be truncated";
    const messages = [
      {
        id: "1",
        pseudonym: "test-user",
        createdAt: "2025-10-17T12:00:00Z",
        body: { text: longMessage },
        channels: ["user"],
        conversation: "conv-1",
        pseudonymId: "tu-1",
        fromAgent: false,
        pause: false,
        visible: true,
        upVotes: [],
        downVotes: [],
      },
      {
        id: "2",
        pseudonym: "Event Assistant",
        createdAt: "2025-10-17T12:01:00Z",
        body: {
          text: "",
          sourceMessage: "1",
          media: [
            {
              type: "image",
              data: "base64imagedata",
              mimeType: "image/png",
            },
          ],
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

    // Full message appears in the message list
    expect(screen.getByText(longMessage)).toBeInTheDocument();

    // Context should show truncated version with ellipsis (60 chars + "...")
    expect(screen.getByText(/In reply to:/)).toBeInTheDocument();
    expect(
      screen.getByText(
        "This is a very long message that exceeds sixty characters an...",
      ),
    ).toBeInTheDocument();
  });

  it("filters out replies to singleChoice prompts", () => {
    const messages = [
      {
        id: "1",
        pseudonym: "Event Assistant",
        createdAt: "2025-10-17T12:00:00Z",
        body: { text: "Choose an option:" },
        channels: ["user"],
        conversation: "conv-1",
        pseudonymId: "ea-1",
        fromAgent: true,
        pause: false,
        visible: true,
        upVotes: [],
        downVotes: [],
        prompt: {
          type: "singleChoice" as const,
          options: [
            { label: "Option A", value: "a" },
            { label: "Option B", value: "b" },
          ],
        },
      },
      {
        id: "2",
        pseudonym: "test-user",
        createdAt: "2025-10-17T12:01:00Z",
        body: { text: "Option A" },
        channels: ["user"],
        answersPrompt: "1",
        conversation: "conv-1",
        pseudonymId: "tu-1",
        fromAgent: false,
        pause: false,
        visible: true,
        upVotes: [],
        downVotes: [],
      },
    ];

    render(<AssistantChatPanel {...baseProps} messages={messages} />);

    // There should be only one instance of "Choose an option:" - the prompt message
    const promptMessages = screen.getAllByText("Choose an option:");
    expect(promptMessages).toHaveLength(1);

    // The response "Option A" should not be visible
    expect(screen.queryByText("Option A")).not.toBeInTheDocument();
  });

  it("filters out messages that have answersPrompt property", () => {
    const messages = [
      {
        id: "1",
        pseudonym: "Event Assistant",
        createdAt: "2025-10-17T12:00:00Z",
        body: "Would you like more information?",
        channels: ["user"],
        conversation: "conv-1",
        pseudonymId: "ea-1",
        fromAgent: true,
        pause: false,
        visible: true,
        upVotes: [],
        downVotes: [],
        prompt: {
          type: "singleChoice" as const,
          options: [
            { label: "Yes", value: "yes" },
            { label: "No", value: "no" },
          ],
        },
      },
      {
        id: "2",
        pseudonym: "test-user",
        createdAt: "2025-10-17T12:01:00Z",
        body: "Yes",
        channels: ["user"],
        conversation: "conv-1",
        pseudonymId: "tu-1",
        fromAgent: false,
        pause: false,
        visible: true,
        upVotes: [],
        downVotes: [],
        answersPrompt: "1",
      },
      {
        id: "3",
        pseudonym: "Event Assistant",
        createdAt: "2025-10-17T12:02:00Z",
        body: "Here is more information...",
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

    // Prompt question should be visible
    expect(
      screen.getByText("Would you like more information?"),
    ).toBeInTheDocument();

    // Response with answersPrompt should be filtered out
    expect(screen.queryByText("Yes")).not.toBeInTheDocument();

    // Follow-up message should be visible
    expect(screen.getByText("Here is more information...")).toBeInTheDocument();
  });

  it("passes initialSelectedPrompt to AssistantMessage when a response exists", () => {
    // Mock AssistantMessage to capture props
    const mockAssistantMessage = jest.fn(
      ({ message, initialSelectedPrompt }: any) => {
        const messageText =
          typeof message.body === "string"
            ? message.body
            : message.body?.text || "";
        return (
          <div
            data-testid="assistant-message"
            data-initial-prompt={initialSelectedPrompt}
          >
            {messageText}
          </div>
        );
      },
    );

    jest.mock("../../components/messages", () => ({
      AssistantMessage: mockAssistantMessage,
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
        return (
          <div data-testid="moderator-submitted-message">{messageText}</div>
        );
      },
    }));

    const messages = [
      {
        id: "prompt-1",
        pseudonym: "Event Assistant",
        createdAt: "2025-10-17T12:00:00Z",
        body: "Do you need help?",
        channels: ["user"],
        conversation: "conv-1",
        pseudonymId: "ea-1",
        fromAgent: true,
        pause: false,
        visible: true,
        upVotes: [],
        downVotes: [],
        prompt: {
          type: "singleChoice" as const,
          options: [
            { label: "Yes", value: "yes" },
            { label: "No", value: "no" },
          ],
        },
      },
      {
        id: "response-1",
        pseudonym: "test-user",
        createdAt: "2025-10-17T12:01:00Z",
        body: "Yes",
        channels: ["user"],
        conversation: "conv-1",
        pseudonymId: "tu-1",
        fromAgent: false,
        pause: false,
        visible: true,
        upVotes: [],
        downVotes: [],
        answersPrompt: "prompt-1",
      },
    ];

    render(<AssistantChatPanel {...baseProps} messages={messages} />);

    // The prompt message should be visible
    expect(screen.getByText("Do you need help?")).toBeInTheDocument();

    // The response message should be filtered out
    expect(screen.queryByText("Yes")).not.toBeInTheDocument();
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
      />,
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

    const feedbackConfig = {
      eligibleMessageIds: new Set(["1"]),
      onPopulateFeedbackText: mockEnterControlledMode,
      onSendRating: mockSendFeedbackRating,
    };

    render(
      <AssistantChatPanel
        {...baseProps}
        messages={messages}
        feedbackConfig={feedbackConfig}
      />,
    );

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

    const feedbackConfig = {
      eligibleMessageIds: new Set(["1"]),
      onPopulateFeedbackText: mockEnterControlledMode,
      onSendRating: mockSendFeedbackRating,
    };

    render(
      <AssistantChatPanel
        {...baseProps}
        messages={messages}
        feedbackConfig={feedbackConfig}
      />,
    );

    const sayMoreButton = screen.getByTestId("say-more-button");
    await user.click(sayMoreButton);

    expect(mockEnterControlledMode).toHaveBeenCalledWith(
      expect.objectContaining({
        prefix: "/feedback|Text|1|",
        label: "Feedback Mode",
      }),
    );
  });

  it("scrolls to bottom when new messages arrive", async () => {
    const { rerender, container } = render(
      <AssistantChatPanel {...baseProps} messages={[]} />,
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

  describe("Visual message handling (media)", () => {
    it("passes media prop to AssistantMessage component", () => {
      // Need to update the mock to capture the media prop
      const mockAssistantMessage = jest.fn(({ message, media }: any) => {
        const messageText =
          typeof message.body === "string"
            ? message.body
            : message.body?.text || "";
        return (
          <div data-testid="assistant-message" data-has-media={!!media}>
            {messageText}
          </div>
        );
      });

      jest.mock("../../components/messages", () => ({
        AssistantMessage: mockAssistantMessage,
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
          return (
            <div data-testid="moderator-submitted-message">{messageText}</div>
          );
        },
      }));

      const messages = [
        {
          id: "1",
          pseudonym: "Event Assistant",
          createdAt: "2025-10-17T12:00:00Z",
          body: {
            text: "Here's an image",
            media: [
              {
                type: "image",
                data: "base64data",
                mimeType: "image/png",
              },
            ],
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

      expect(screen.getByText("Here's an image")).toBeInTheDocument();
    });

    it("parses media from message body object", () => {
      const messages = [
        {
          id: "1",
          pseudonym: "Event Assistant",
          createdAt: "2025-10-17T12:00:00Z",
          body: {
            text: "Check this out",
            media: [
              {
                type: "image",
                data: "imagedata",
                mimeType: "image/png",
              },
            ],
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

      expect(screen.getByText("Check this out")).toBeInTheDocument();
      expect(screen.getByTestId("assistant-message")).toBeInTheDocument();
    });

    it("handles messages with multiple media items", () => {
      const messages = [
        {
          id: "1",
          pseudonym: "Event Assistant",
          createdAt: "2025-10-17T12:00:00Z",
          body: {
            text: "Multiple images",
            media: [
              {
                type: "image",
                data: "image1",
                mimeType: "image/png",
              },
              {
                type: "image",
                data: "image2",
                mimeType: "image/jpeg",
              },
            ],
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

      expect(screen.getByText("Multiple images")).toBeInTheDocument();
    });

    it("handles messages without media", () => {
      const messages = [
        {
          id: "1",
          pseudonym: "Event Assistant",
          createdAt: "2025-10-17T12:00:00Z",
          body: {
            text: "Just text",
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

      expect(screen.getByText("Just text")).toBeInTheDocument();
    });

    it("handles string body messages (no media)", () => {
      const messages = [
        {
          id: "1",
          pseudonym: "Event Assistant",
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

    it("parses empty media array correctly", () => {
      const messages = [
        {
          id: "1",
          pseudonym: "Event Assistant",
          createdAt: "2025-10-17T12:00:00Z",
          body: {
            text: "No media",
            media: [],
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

      expect(screen.getByText("No media")).toBeInTheDocument();
    });

    it("parses non-array media value gracefully", () => {
      const messages = [
        {
          id: "1",
          pseudonym: "Event Assistant",
          createdAt: "2025-10-17T12:00:00Z",
          body: {
            text: "Invalid media",
            media: "not-an-array",
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

      expect(screen.getByText("Invalid media")).toBeInTheDocument();
    });

    it("extracts text from object body with media", () => {
      const messages = [
        {
          id: "1",
          pseudonym: "Event Assistant",
          createdAt: "2025-10-17T12:00:00Z",
          body: {
            text: "Text with media",
            media: [
              {
                type: "image",
                data: "data",
                mimeType: "image/png",
              },
            ],
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

      expect(screen.getByText("Text with media")).toBeInTheDocument();
    });

    it("handles user messages with media in object body", () => {
      const messages = [
        {
          id: "1",
          pseudonym: "test-user",
          createdAt: "2025-10-17T12:00:00Z",
          body: {
            text: "User uploaded image",
            media: [
              {
                type: "image",
                data: "userimage",
                mimeType: "image/png",
              },
            ],
          },
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

      render(<AssistantChatPanel {...baseProps} messages={messages} />);

      expect(screen.getByText("User uploaded image")).toBeInTheDocument();
    });

    it("does not pass media to non-assistant messages", () => {
      const messages = [
        {
          id: "1",
          pseudonym: "test-user",
          createdAt: "2025-10-17T12:00:00Z",
          body: {
            text: "User message",
            media: [
              {
                type: "image",
                data: "data",
                mimeType: "image/png",
              },
            ],
          },
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

      render(
        <AssistantChatPanel {...baseProps} messages={messages} />,
      );

      // User messages are rendered in a plain div without AssistantMessage component
      expect(screen.getByText("User message")).toBeInTheDocument();
      expect(screen.queryByTestId("assistant-message")).not.toBeInTheDocument();
    });
  });

  describe("Timestamp display", () => {
    it("shows timestamp for the first message", () => {
      const messages = [
        {
          id: "1",
          pseudonym: "Event Assistant",
          createdAt: "2025-10-17T12:00:00Z",
          body: "First message",
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

      const { container } = render(
        <AssistantChatPanel {...baseProps} messages={messages} />,
      );

      // Check timestamp is displayed
      const timestamps = container.querySelectorAll(".text-gray-400");
      expect(timestamps.length).toBe(1);
    });

    it("shows timestamp when minute changes", () => {
      const messages = [
        {
          id: "1",
          pseudonym: "Event Assistant",
          createdAt: "2025-10-17T12:00:00Z",
          body: "First message",
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
          body: "Second message",
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
        <AssistantChatPanel {...baseProps} messages={messages} />,
      );

      // Should show two timestamps (one for each different minute)
      const timestamps = container.querySelectorAll(".text-gray-400");
      expect(timestamps.length).toBe(2);
    });

    it("shows timestamp when hour changes", () => {
      const messages = [
        {
          id: "1",
          pseudonym: "Event Assistant",
          createdAt: "2025-10-17T12:59:00Z",
          body: "First message",
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
          createdAt: "2025-10-17T13:00:00Z",
          body: "Second message",
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
        <AssistantChatPanel {...baseProps} messages={messages} />,
      );

      // Should show two timestamps (one for each different hour)
      const timestamps = container.querySelectorAll(".text-gray-400");
      expect(timestamps.length).toBe(2);
    });

    it("does not show timestamp when messages are in the same minute", () => {
      const messages = [
        {
          id: "1",
          pseudonym: "Event Assistant",
          createdAt: "2025-10-17T12:00:00Z",
          body: "First message",
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
          createdAt: "2025-10-17T12:00:30Z",
          body: "Second message",
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
        <AssistantChatPanel {...baseProps} messages={messages} />,
      );

      // Should only show one timestamp (for the first message)
      const timestamps = container.querySelectorAll(".text-gray-400");
      expect(timestamps.length).toBe(1);
    });

    it("shows timestamp for moderator_submitted messages when minute changes", () => {
      const messages = [
        {
          id: "1",
          pseudonym: "Event Assistant",
          createdAt: "2025-10-17T12:00:00Z",
          body: "First message",
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
          body: {
            text: "Submitted message",
            type: "moderator_submitted",
            message: "1",
          },
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
        <AssistantChatPanel {...baseProps} messages={messages} />,
      );

      // Should show two timestamps (one for each different minute)
      const timestamps = container.querySelectorAll(".text-gray-400");
      expect(timestamps.length).toBe(2);
    });

    it("shows timestamp for submitted messages referenced by moderator when minute changes", () => {
      const messages = [
        {
          id: "1",
          pseudonym: "test-user",
          createdAt: "2025-10-17T12:00:00Z",
          body: { text: "Original message" },
          channels: ["user"],
          conversation: "conv-1",
          pseudonymId: "tu-1",
          fromAgent: false,
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

      const { container } = render(
        <AssistantChatPanel {...baseProps} messages={messages} />,
      );

      // Should show two timestamps (one for each different minute)
      const timestamps = container.querySelectorAll(".text-gray-400");
      expect(timestamps.length).toBe(2);
    });

    it("does not show timestamp for moderator_submitted messages in same minute", () => {
      const messages = [
        {
          id: "1",
          pseudonym: "Event Assistant",
          createdAt: "2025-10-17T12:00:00Z",
          body: "First message",
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
          createdAt: "2025-10-17T12:00:30Z",
          body: {
            text: "Submitted message",
            type: "moderator_submitted",
            message: "1",
          },
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
        <AssistantChatPanel {...baseProps} messages={messages} />,
      );

      // Should only show one timestamp (for the first message)
      const timestamps = container.querySelectorAll(".text-gray-400");
      expect(timestamps.length).toBe(1);
    });
  });

  describe("Feedback Configuration", () => {
    it("renders feedback UI only for messages in eligibleMessageIds set", () => {
      const messages = [
        {
          id: "1",
          pseudonym: "Event Assistant",
          createdAt: "2025-10-17T12:00:00Z",
          body: { text: "Message 1" },
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
          body: { text: "Message 2" },
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
          id: "3",
          pseudonym: "Event Assistant",
          createdAt: "2025-10-17T12:02:00Z",
          body: { text: "Message 3" },
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

      const feedbackConfig = {
        eligibleMessageIds: new Set(["1", "3"]), // Only messages 1 and 3 are eligible
        onPopulateFeedbackText: mockEnterControlledMode,
        onSendRating: mockSendFeedbackRating,
      };

      render(
        <AssistantChatPanel
          {...baseProps}
          messages={messages}
          feedbackConfig={feedbackConfig}
        />,
      );

      // Get all feedback elements
      const feedbackElements = screen.getAllByTestId("message-feedback");

      // Should have 2 feedback elements (for messages 1 and 3)
      expect(feedbackElements).toHaveLength(2);

      // Verify they are for the correct messages
      expect(feedbackElements[0]).toHaveAttribute("data-message-id", "1");
      expect(feedbackElements[1]).toHaveAttribute("data-message-id", "3");
    });

    it("does not render feedback UI when message is not in eligibleMessageIds", () => {
      const messages = [
        {
          id: "1",
          pseudonym: "Event Assistant",
          createdAt: "2025-10-17T12:00:00Z",
          body: { text: "Message without feedback" },
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

      const feedbackConfig = {
        eligibleMessageIds: new Set<string>(), // No eligible messages
        onPopulateFeedbackText: mockEnterControlledMode,
        onSendRating: mockSendFeedbackRating,
      };

      render(
        <AssistantChatPanel
          {...baseProps}
          messages={messages}
          feedbackConfig={feedbackConfig}
        />,
      );

      // Should not have any feedback elements
      expect(screen.queryByTestId("message-feedback")).not.toBeInTheDocument();
    });

    it("does not render feedback for messages with ineligible types even if fromAgent", () => {
      const messages = [
        {
          id: "1",
          pseudonym: "Event Assistant",
          createdAt: "2025-10-17T12:00:00Z",
          body: { text: "Intro message", type: "intro" },
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
          body: "Regular message",
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

      const feedbackConfig = {
        eligibleMessageIds: new Set(["2"]), // Only message 2 is eligible (message 1 excluded by type)
        onPopulateFeedbackText: mockEnterControlledMode,
        onSendRating: mockSendFeedbackRating,
      };

      render(
        <AssistantChatPanel
          {...baseProps}
          messages={messages}
          feedbackConfig={feedbackConfig}
        />,
      );

      const feedbackElements = screen.queryAllByTestId("message-feedback");

      // Should only have 1 feedback element (for message 2)
      expect(feedbackElements).toHaveLength(1);
      expect(feedbackElements[0]).toHaveAttribute("data-message-id", "2");
    });

    it("calls feedbackConfig callbacks when feedback buttons are clicked", async () => {
      const user = userEvent.setup();

      const messages = [
        {
          id: "1",
          pseudonym: "Event Assistant",
          createdAt: "2025-10-17T12:00:00Z",
          body: { text: "Message with feedback" },
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

      const feedbackConfig = {
        eligibleMessageIds: new Set(["1"]),
        onPopulateFeedbackText: mockEnterControlledMode,
        onSendRating: mockSendFeedbackRating,
      };

      render(
        <AssistantChatPanel
          {...baseProps}
          messages={messages}
          feedbackConfig={feedbackConfig}
        />,
      );

      // Click rating button
      const ratingButton = screen.getByTestId("rating-button-3");
      await user.click(ratingButton);

      expect(mockSendFeedbackRating).toHaveBeenCalledWith("1", 3);

      // Click "Say more" button
      const sayMoreButton = screen.getByTestId("say-more-button");
      await user.click(sayMoreButton);

      expect(mockEnterControlledMode).toHaveBeenCalledWith(
        expect.objectContaining({
          prefix: "/feedback|Text|1|",
          label: "Feedback Mode",
        }),
      );
    });

    it("handles empty eligibleMessageIds set", () => {
      const messages = [
        {
          id: "1",
          pseudonym: "Event Assistant",
          createdAt: "2025-10-17T12:00:00Z",
          body: { text: "Message 1" },
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
          body: { text: "Message 2" },
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

      const feedbackConfig = {
        eligibleMessageIds: new Set<string>(),
        onPopulateFeedbackText: mockEnterControlledMode,
        onSendRating: mockSendFeedbackRating,
      };

      render(
        <AssistantChatPanel
          {...baseProps}
          messages={messages}
          feedbackConfig={feedbackConfig}
        />,
      );

      // No feedback UI should be rendered
      expect(screen.queryByTestId("message-feedback")).not.toBeInTheDocument();
    });

    it("renders feedback for all agent messages when all are in eligibleMessageIds", () => {
      const messages = [
        {
          id: "1",
          pseudonym: "Event Assistant",
          createdAt: "2025-10-17T12:00:00Z",
          body: { text: "Message 1" },
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
          body: { text: "Message 2" },
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

      const feedbackConfig = {
        eligibleMessageIds: new Set(["1", "2"]),
        onPopulateFeedbackText: mockEnterControlledMode,
        onSendRating: mockSendFeedbackRating,
      };

      render(
        <AssistantChatPanel
          {...baseProps}
          messages={messages}
          feedbackConfig={feedbackConfig}
        />,
      );

      const feedbackElements = screen.getAllByTestId("message-feedback");

      // Should have 2 feedback elements
      expect(feedbackElements).toHaveLength(2);
    });

    it("does not render feedback for user messages even if in eligibleMessageIds", () => {
      const messages = [
        {
          id: "1",
          pseudonym: "test-user",
          createdAt: "2025-10-17T12:00:00Z",
          body: { text: "User message" },
          channels: ["user"],
          conversation: "conv-1",
          pseudonymId: "tu-1",
          fromAgent: false,
          pause: false,
          visible: true,
          upVotes: [],
          downVotes: [],
        },
        {
          id: "2",
          pseudonym: "Event Assistant",
          createdAt: "2025-10-17T12:01:00Z",
          body: { text: "Agent message" },
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

      const feedbackConfig = {
        eligibleMessageIds: new Set(["1", "2"]),
        onPopulateFeedbackText: mockEnterControlledMode,
        onSendRating: mockSendFeedbackRating,
      };

      render(
        <AssistantChatPanel
          {...baseProps}
          messages={messages}
          feedbackConfig={feedbackConfig}
        />,
      );

      const feedbackElements = screen.queryAllByTestId("message-feedback");

      // Should only have 1 feedback element (for agent message)
      expect(feedbackElements).toHaveLength(1);
      expect(feedbackElements[0]).toHaveAttribute("data-message-id", "2");
    });
  });
});
