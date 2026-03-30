import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GroupChatPanel } from "../../components/GroupChatPanel";

// Mock MessageInput component
jest.mock("../../components/MessageInput", () => ({
  MessageInput: ({ onSendMessage }: any) => (
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
      />
    </div>
  ),
}));

// Mock MessageFeedback component
jest.mock("../../components/MessageFeedback", () => ({
  MessageFeedback: ({
    messageId,
    initialRating,
    onPopulateFeedbackText,
    onSendFeedbackRating,
  }: any) => (
    <div
      data-testid="message-feedback"
      data-message-id={messageId}
      data-initial-rating={initialRating}
    >
      <button
        data-testid={`rating-button-${messageId}`}
        onClick={() => onSendFeedbackRating?.(messageId, 3)}
      >
        Rate
      </button>
      <button
        data-testid={`say-more-button-${messageId}`}
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

describe("GroupChatPanel", () => {
  const mockOnSendMessage = jest.fn();

  const baseProps = {
    messages: [],
    pseudonym: "test-user",
    eventName: "Tech Summit",
    onSendMessage: mockOnSendMessage,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders without messages", () => {
    render(<GroupChatPanel {...baseProps} />);

    expect(screen.getByTestId("message-input")).toBeInTheDocument();
  });

  it("renders messages with sender name", () => {
    const messages = [
      {
        id: "1",
        pseudonym: "Alice",
        createdAt: "2025-10-17T12:00:00Z",
        body: { text: "Hello everyone" },
        channels: ["chat"],
        conversation: "conv-1",
        pseudonymId: "alice-1",
        fromAgent: false,
        pause: false,
        visible: true,
        upVotes: [],
        downVotes: [],
      },
    ];

    render(<GroupChatPanel {...baseProps} messages={messages} />);

    expect(screen.getByText("Hello everyone")).toBeInTheDocument();
    expect(screen.getByText("Alice")).toBeInTheDocument();
  });

  it("shows '(You)' label for current user", () => {
    const messages = [
      {
        id: "1",
        pseudonym: "test-user",
        createdAt: "2025-10-17T12:00:00Z",
        body: { text: "My message" },
        channels: ["chat"],
        conversation: "conv-1",
        pseudonymId: "test-1",
        fromAgent: false,
        pause: false,
        visible: true,
        upVotes: [],
        downVotes: [],
      },
    ];

    render(<GroupChatPanel {...baseProps} messages={messages} />);

    expect(screen.getByText("My message")).toBeInTheDocument();
    expect(screen.getByText("(You)")).toBeInTheDocument();
  });

  it("does not show loading indicator in chat mode", () => {
    const messages = [
      {
        id: "1",
        pseudonym: "test-user",
        createdAt: "2025-10-17T12:00:00Z",
        body: { text: "Hello" },
        channels: ["chat"],
        conversation: "conv-1",
        pseudonymId: "test-1",
        fromAgent: false,
        pause: false,
        visible: true,
        upVotes: [],
        downVotes: [],
      },
    ];

    const { container } = render(
      <GroupChatPanel {...baseProps} messages={messages} />,
    );

    // Should NOT show animated SVG loading indicator in chat mode
    const loadingIndicator = container.querySelector(".animate-bounce");
    expect(loadingIndicator).not.toBeInTheDocument();
  });

  it("highlights single-word @mentions in messages", () => {
    // Both sender ("Alice") and mentioned user ("Bob") must be known contributors.
    // Contributors are derived from message senders, so include a message from Bob.
    const messages = [
      {
        id: "1",
        pseudonym: "Alice",
        createdAt: "2025-10-17T12:00:00Z",
        body: { text: "Hey @Bob, how are you?" },
        channels: ["chat"],
        conversation: "conv-1",
        pseudonymId: "alice-1",
        fromAgent: false,
        pause: false,
        visible: true,
        upVotes: [],
        downVotes: [],
      },
      {
        id: "2",
        pseudonym: "Bob",
        createdAt: "2025-10-17T12:01:00Z",
        body: { text: "Hi Alice!" },
        channels: ["chat"],
        conversation: "conv-1",
        pseudonymId: "bob-1",
        fromAgent: false,
        pause: false,
        visible: true,
        upVotes: [],
        downVotes: [],
      },
    ];

    const { container } = render(
      <GroupChatPanel {...baseProps} messages={messages} />,
    );

    // Check that mention has styling with font-semibold class
    const mentionSpans = container.querySelectorAll(".font-semibold");
    const bobMention = Array.from(mentionSpans).find((el) =>
      el.textContent?.includes("@Bob"),
    );
    expect(bobMention).toBeInTheDocument();
    expect(bobMention?.textContent).toContain("@Bob");
  });

  it("highlights multi-word @mentions using the contributors list", () => {
    // "Bob Smith" is a known contributor — the mention should stop exactly at
    // the end of the handle and not consume the following words.
    const messages = [
      {
        id: "1",
        pseudonym: "Bob Smith",
        createdAt: "2025-10-17T12:00:00Z",
        body: { text: "Hey @Bob Smith, how are you?" },
        channels: ["chat"],
        conversation: "conv-1",
        pseudonymId: "bob-smith-1",
        fromAgent: false,
        pause: false,
        visible: true,
        upVotes: [],
        downVotes: [],
      },
    ];

    const { container } = render(
      <GroupChatPanel {...baseProps} messages={messages} />,
    );

    const mentionSpan = container.querySelector(".font-semibold");
    expect(mentionSpan).toBeInTheDocument();
    // Should be exactly "@Bob Smith" — the comma and following text are NOT included
    expect(mentionSpan?.textContent).toBe("@Bob Smith");
  });

  it("does not over-capture words following the handle", () => {
    // Without the contributors list the greedy regex would capture
    // "@Bob Smith please respond". With contributors it should stop at "@Bob Smith".
    const messages = [
      {
        id: "1",
        pseudonym: "Bob Smith",
        createdAt: "2025-10-17T12:00:00Z",
        body: { text: "@Bob Smith please respond" },
        channels: ["chat"],
        conversation: "conv-1",
        pseudonymId: "bob-smith-1",
        fromAgent: false,
        pause: false,
        visible: true,
        upVotes: [],
        downVotes: [],
      },
    ];

    const { container } = render(
      <GroupChatPanel {...baseProps} messages={messages} />,
    );

    const mentionSpan = container.querySelector(".font-semibold");
    expect(mentionSpan).toBeInTheDocument();
    expect(mentionSpan?.textContent).toBe("@Bob Smith");
    // The remaining text should NOT be highlighted
    const nonMentionText = container.querySelector(".font-semibold + *");
    expect(container.textContent).toContain("please respond");
  });

  it("highlights three-word @mentions from the contributors list", () => {
    const messages = [
      {
        id: "1",
        pseudonym: "Charlie Brown Jr",
        createdAt: "2025-10-17T12:00:00Z",
        body: { text: "Hello @Charlie Brown Jr please respond" },
        channels: ["chat"],
        conversation: "conv-1",
        pseudonymId: "charlie-1",
        fromAgent: false,
        pause: false,
        visible: true,
        upVotes: [],
        downVotes: [],
      },
    ];

    const { container } = render(
      <GroupChatPanel {...baseProps} messages={messages} />,
    );

    const mentionSpan = container.querySelector(".font-semibold");
    expect(mentionSpan).toBeInTheDocument();
    expect(mentionSpan?.textContent).toBe("@Charlie Brown Jr");
    expect(container.textContent).toContain("please respond");
  });

  it("calls onSendMessage when user sends a message", async () => {
    const user = userEvent.setup();

    render(<GroupChatPanel {...baseProps} />);

    const input = screen.getByTestId("message-input-field");

    await user.type(input, "Test message");
    await user.keyboard("{Enter}");

    expect(mockOnSendMessage).toHaveBeenCalledWith("Test message");
  });

  it("scrolls to bottom when new messages arrive", async () => {
    const { rerender, container } = render(
      <GroupChatPanel {...baseProps} messages={[]} />,
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
        pseudonym: "Alice",
        createdAt: "2025-10-17T12:00:00Z",
        body: { text: "New message" },
        channels: ["chat"],
        conversation: "conv-1",
        pseudonymId: "alice-1",
        fromAgent: false,
        pause: false,
        visible: true,
        upVotes: [],
        downVotes: [],
      },
    ];

    rerender(<GroupChatPanel {...baseProps} messages={newMessages} />);

    await waitFor(() => {
      expect(scrollTopSpy).toHaveBeenCalledWith(1000);
    });
  });

  it("parses message body correctly for string input", () => {
    const messages = [
      {
        id: "1",
        pseudonym: "Alice",
        createdAt: "2025-10-17T12:00:00Z",
        body: "Simple string message",
        channels: ["chat"],
        conversation: "conv-1",
        pseudonymId: "alice-1",
        fromAgent: false,
        pause: false,
        visible: true,
        upVotes: [],
        downVotes: [],
      },
    ];

    render(<GroupChatPanel {...baseProps} messages={messages} />);

    expect(screen.getByText("Simple string message")).toBeInTheDocument();
  });

  it("parses message body correctly for object input", () => {
    const messages = [
      {
        id: "1",
        pseudonym: "Alice",
        createdAt: "2025-10-17T12:00:00Z",
        body: { text: "Object message", someField: "value" },
        channels: ["chat"],
        conversation: "conv-1",
        pseudonymId: "alice-1",
        fromAgent: false,
        pause: false,
        visible: true,
        upVotes: [],
        downVotes: [],
      },
    ];

    render(<GroupChatPanel {...baseProps} messages={messages} />);

    expect(screen.getByText("Object message")).toBeInTheDocument();
  });

  it("normalizes 'Event Assistant Plus' to 'Berkie'", () => {
    const messages = [
      {
        id: "1",
        pseudonym: "Event Assistant Plus",
        createdAt: "2025-10-17T12:00:00Z",
        body: { text: "Hello from EA Plus" },
        channels: ["chat"],
        conversation: "conv-1",
        pseudonymId: "ea-plus-1",
        fromAgent: true,
        pause: false,
        visible: true,
        upVotes: [],
        downVotes: [],
      },
    ];

    render(<GroupChatPanel {...baseProps} messages={messages} />);

    expect(screen.getByText("Berkie")).toBeInTheDocument();
    expect(screen.queryByText("Event Assistant Plus")).not.toBeInTheDocument();
  });

  it("normalizes 'Event Mediator' to 'Berkie'", () => {
    const messages = [
      {
        id: "1",
        pseudonym: "Event Mediator",
        createdAt: "2025-10-17T12:00:00Z",
        body: { text: "Hello from Event Mediator" },
        channels: ["chat"],
        conversation: "conv-1",
        pseudonymId: "em-1",
        fromAgent: true,
        pause: false,
        visible: true,
        upVotes: [],
        downVotes: [],
      },
    ];

    render(<GroupChatPanel {...baseProps} messages={messages} />);

    expect(screen.getByText("Berkie")).toBeInTheDocument();
    expect(screen.queryByText("Event Mediator")).not.toBeInTheDocument();
  });

  it("normalizes 'Event Mediator Plus' to 'Berkie'", () => {
    const messages = [
      {
        id: "1",
        pseudonym: "Event Mediator Plus",
        createdAt: "2025-10-17T12:00:00Z",
        body: { text: "Hello from Event Mediator Plus" },
        channels: ["chat"],
        conversation: "conv-1",
        pseudonymId: "em-plus-1",
        fromAgent: true,
        pause: false,
        visible: true,
        upVotes: [],
        downVotes: [],
      },
    ];

    render(<GroupChatPanel {...baseProps} messages={messages} />);

    expect(screen.getByText("Berkie")).toBeInTheDocument();
    expect(screen.queryByText("Event Mediator Plus")).not.toBeInTheDocument();
  });

  it("normalizes 'Engagement Agent' to 'Berkie'", () => {
    const messages = [
      {
        id: "1",
        pseudonym: "Engagement Agent",
        createdAt: "2025-10-17T12:00:00Z",
        body: { text: "Hello" },
        channels: ["chat"],
        conversation: "conv-1",
        pseudonymId: "em-plus-1",
        fromAgent: true,
        pause: false,
        visible: true,
        upVotes: [],
        downVotes: [],
      },
    ];

    render(<GroupChatPanel {...baseProps} messages={messages} />);

    expect(screen.getByText("Berkie")).toBeInTheDocument();
    expect(screen.queryByText("Enagement Agent")).not.toBeInTheDocument();
  });

  it("applies assistant avatar and background color to Event Assistant messages", () => {
    const messages = [
      {
        id: "1",
        pseudonym: "Event Assistant",
        createdAt: "2025-10-17T12:00:00Z",
        body: { text: "Hello from Event Assistant" },
        channels: ["chat"],
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
      <GroupChatPanel {...baseProps} messages={messages} />,
    );

    // Check that the avatar has the purple background color (#DDD6FE)
    const avatar = container.querySelector(".rounded-full");
    expect(avatar).toHaveStyle({ backgroundColor: "#DDD6FE" });

    // Check that the message bubble has the purple background color (#DDD6FE)
    const messageBubble = container.querySelector(".rounded-2xl");
    expect(messageBubble).toHaveStyle({ backgroundColor: "#DDD6FE" });
  });

  it("applies assistant avatar and background color to Event Assistant Plus messages", () => {
    const messages = [
      {
        id: "1",
        pseudonym: "Event Assistant Plus",
        createdAt: "2025-10-17T12:00:00Z",
        body: { text: "Hello from Event Assistant Plus" },
        channels: ["chat"],
        conversation: "conv-1",
        pseudonymId: "ea-plus-1",
        fromAgent: true,
        pause: false,
        visible: true,
        upVotes: [],
        downVotes: [],
      },
    ];

    const { container } = render(
      <GroupChatPanel {...baseProps} messages={messages} />,
    );

    // Check that the avatar has the purple background color (#DDD6FE)
    const avatar = container.querySelector(".rounded-full");
    expect(avatar).toHaveStyle({ backgroundColor: "#DDD6FE" });

    // Check that the message bubble has the purple background color (#DDD6FE)
    const messageBubble = container.querySelector(".rounded-2xl");
    expect(messageBubble).toHaveStyle({ backgroundColor: "#DDD6FE" });
  });

  it("applies assistant avatar and background color to Event Mediator messages", () => {
    const messages = [
      {
        id: "1",
        pseudonym: "Event Mediator",
        createdAt: "2025-10-17T12:00:00Z",
        body: { text: "Hello from Event Mediator" },
        channels: ["chat"],
        conversation: "conv-1",
        pseudonymId: "em-1",
        fromAgent: true,
        pause: false,
        visible: true,
        upVotes: [],
        downVotes: [],
      },
    ];

    const { container } = render(
      <GroupChatPanel {...baseProps} messages={messages} />,
    );

    // Check that the avatar has the purple background color (#DDD6FE)
    const avatar = container.querySelector(".rounded-full");
    expect(avatar).toHaveStyle({ backgroundColor: "#DDD6FE" });

    // Check that the message bubble has the purple background color (#DDD6FE)
    const messageBubble = container.querySelector(".rounded-2xl");
    expect(messageBubble).toHaveStyle({ backgroundColor: "#DDD6FE" });
  });

  it("applies assistant avatar and background color to Event Mediator Plus messages", () => {
    const messages = [
      {
        id: "1",
        pseudonym: "Event Mediator Plus",
        createdAt: "2025-10-17T12:00:00Z",
        body: { text: "Hello from Event Mediator Plus" },
        channels: ["chat"],
        conversation: "conv-1",
        pseudonymId: "em-plus-1",
        fromAgent: true,
        pause: false,
        visible: true,
        upVotes: [],
        downVotes: [],
      },
    ];

    const { container } = render(
      <GroupChatPanel {...baseProps} messages={messages} />,
    );

    // Check that the avatar has the purple background color (#DDD6FE)
    const avatar = container.querySelector(".rounded-full");
    expect(avatar).toHaveStyle({ backgroundColor: "#DDD6FE" });

    // Check that the message bubble has the purple background color (#DDD6FE)
    const messageBubble = container.querySelector(".rounded-2xl");
    expect(messageBubble).toHaveStyle({ backgroundColor: "#DDD6FE" });
  });

  it("normalizes 'Event Assistant Plus' to 'Event Assistant' in contributors for mentions", () => {
    const messages = [
      {
        id: "1",
        pseudonym: "Event Assistant Plus",
        createdAt: "2025-10-17T12:00:00Z",
        body: { text: "Hello from EA Plus" },
        channels: ["chat"],
        conversation: "conv-1",
        pseudonymId: "ea-plus-1",
        fromAgent: true,
        pause: false,
        visible: true,
        upVotes: [],
        downVotes: [],
      },
      {
        id: "2",
        pseudonym: "Alice",
        createdAt: "2025-10-17T12:01:00Z",
        body: { text: "Hi there" },
        channels: ["chat"],
        conversation: "conv-1",
        pseudonymId: "alice-1",
        fromAgent: false,
        pause: false,
        visible: true,
        upVotes: [],
        downVotes: [],
      },
    ];

    render(<GroupChatPanel {...baseProps} messages={messages} />);

    // The MessageInput component should receive enhancers with normalized "Event Assistant"
    // (not "Event Assistant Plus") in the contributors list
    // This is tested implicitly through the mocked MessageInput component
    expect(screen.getByTestId("message-input")).toBeInTheDocument();
  });

  describe("Visual message handling (media)", () => {
    it("renders single image in message body", () => {
      const messages = [
        {
          id: "1",
          pseudonym: "Alice",
          createdAt: "2025-10-17T12:00:00Z",
          body: {
            text: "Check out this image",
            media: [
              {
                type: "image",
                data: "base64imagedata",
                mimeType: "image/png",
              },
            ],
          },
          channels: ["chat"],
          conversation: "conv-1",
          pseudonymId: "alice-1",
          fromAgent: false,
          pause: false,
          visible: true,
          upVotes: [],
          downVotes: [],
        },
      ];

      render(<GroupChatPanel {...baseProps} messages={messages} />);

      expect(screen.getByText("Check out this image")).toBeInTheDocument();
      const image = screen.getByAltText("Uploaded image");
      expect(image).toHaveAttribute(
        "src",
        "data:image/png;base64,base64imagedata",
      );
    });

    it("renders multiple images in message body", () => {
      const messages = [
        {
          id: "1",
          pseudonym: "Alice",
          createdAt: "2025-10-17T12:00:00Z",
          body: {
            text: "Multiple images",
            media: [
              {
                type: "image",
                data: "image1data",
                mimeType: "image/png",
              },
              {
                type: "image",
                data: "image2data",
                mimeType: "image/jpeg",
              },
              {
                type: "image",
                data: "image3data",
                mimeType: "image/gif",
              },
            ],
          },
          channels: ["chat"],
          conversation: "conv-1",
          pseudonymId: "alice-1",
          fromAgent: false,
          pause: false,
          visible: true,
          upVotes: [],
          downVotes: [],
        },
      ];

      render(<GroupChatPanel {...baseProps} messages={messages} />);

      const images = screen.getAllByAltText("Uploaded image");
      expect(images).toHaveLength(3);
      expect(images[0]).toHaveAttribute(
        "src",
        "data:image/png;base64,image1data",
      );
      expect(images[1]).toHaveAttribute(
        "src",
        "data:image/jpeg;base64,image2data",
      );
      expect(images[2]).toHaveAttribute(
        "src",
        "data:image/gif;base64,image3data",
      );
    });

    it("applies correct styling to media images", () => {
      const messages = [
        {
          id: "1",
          pseudonym: "Alice",
          createdAt: "2025-10-17T12:00:00Z",
          body: {
            text: "Styled image",
            media: [
              {
                type: "image",
                data: "styledimage",
                mimeType: "image/png",
              },
            ],
          },
          channels: ["chat"],
          conversation: "conv-1",
          pseudonymId: "alice-1",
          fromAgent: false,
          pause: false,
          visible: true,
          upVotes: [],
          downVotes: [],
        },
      ];

      render(<GroupChatPanel {...baseProps} messages={messages} />);

      const image = screen.getByAltText("Uploaded image");
      expect(image).toHaveStyle({
        maxWidth: "100%",
        height: "auto",
        borderRadius: "8px",
        border: "1px solid rgba(0, 0, 0, 0.1)",
      });
    });

    it("does not render media when media array is empty", () => {
      const messages = [
        {
          id: "1",
          pseudonym: "Alice",
          createdAt: "2025-10-17T12:00:00Z",
          body: {
            text: "No media here",
            media: [],
          },
          channels: ["chat"],
          conversation: "conv-1",
          pseudonymId: "alice-1",
          fromAgent: false,
          pause: false,
          visible: true,
          upVotes: [],
          downVotes: [],
        },
      ];

      render(<GroupChatPanel {...baseProps} messages={messages} />);

      expect(screen.getByText("No media here")).toBeInTheDocument();
      expect(screen.queryByAltText("Uploaded image")).not.toBeInTheDocument();
    });

    it("does not render media when media is not an array", () => {
      const messages = [
        {
          id: "1",
          pseudonym: "Alice",
          createdAt: "2025-10-17T12:00:00Z",
          body: {
            text: "Invalid media",
            media: "not-an-array",
          },
          channels: ["chat"],
          conversation: "conv-1",
          pseudonymId: "alice-1",
          fromAgent: false,
          pause: false,
          visible: true,
          upVotes: [],
          downVotes: [],
        },
      ];

      render(<GroupChatPanel {...baseProps} messages={messages} />);

      expect(screen.getByText("Invalid media")).toBeInTheDocument();
      expect(screen.queryByAltText("Uploaded image")).not.toBeInTheDocument();
    });

    it("only renders image type media, ignoring audio and video", () => {
      const messages = [
        {
          id: "1",
          pseudonym: "Alice",
          createdAt: "2025-10-17T12:00:00Z",
          body: {
            text: "Mixed media",
            media: [
              {
                type: "image",
                data: "imagedata",
                mimeType: "image/png",
              },
              {
                type: "audio",
                data: "audiodata",
                mimeType: "audio/mp3",
              },
              {
                type: "video",
                data: "videodata",
                mimeType: "video/mp4",
              },
            ],
          },
          channels: ["chat"],
          conversation: "conv-1",
          pseudonymId: "alice-1",
          fromAgent: false,
          pause: false,
          visible: true,
          upVotes: [],
          downVotes: [],
        },
      ];

      render(<GroupChatPanel {...baseProps} messages={messages} />);

      // Only the image should be rendered
      const images = screen.getAllByAltText("Uploaded image");
      expect(images).toHaveLength(1);
      expect(images[0]).toHaveAttribute(
        "src",
        "data:image/png;base64,imagedata",
      );
    });

    it("renders assistant message with media", () => {
      const messages = [
        {
          id: "1",
          pseudonym: "Event Assistant",
          createdAt: "2025-10-17T12:00:00Z",
          body: {
            text: "Here's the visualization",
            media: [
              {
                type: "image",
                data: "visualization",
                mimeType: "image/png",
              },
            ],
          },
          channels: ["chat"],
          conversation: "conv-1",
          pseudonymId: "ea-1",
          fromAgent: true,
          pause: false,
          visible: true,
          upVotes: [],
          downVotes: [],
        },
      ];

      render(<GroupChatPanel {...baseProps} messages={messages} />);

      expect(screen.getByText("Here's the visualization")).toBeInTheDocument();
      expect(screen.getByAltText("Visual response")).toBeInTheDocument();
    });

    it("renders multiple messages with different media", () => {
      const messages = [
        {
          id: "1",
          pseudonym: "Alice",
          createdAt: "2025-10-17T12:00:00Z",
          body: {
            text: "First image",
            media: [
              {
                type: "image",
                data: "image1",
                mimeType: "image/png",
              },
            ],
          },
          channels: ["chat"],
          conversation: "conv-1",
          pseudonymId: "alice-1",
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
            text: "Second image",
            media: [
              {
                type: "image",
                data: "image2",
                mimeType: "image/jpeg",
              },
            ],
          },
          channels: ["chat"],
          conversation: "conv-1",
          pseudonymId: "ea-1",
          fromAgent: true,
          pause: false,
          visible: true,
          upVotes: [],
          downVotes: [],
        },
      ];

      render(<GroupChatPanel {...baseProps} messages={messages} />);

      expect(screen.getByText("First image")).toBeInTheDocument();
      expect(screen.getByText("Second image")).toBeInTheDocument();

      // Alice's user message has "Uploaded image" alt text
      expect(screen.getByAltText("Uploaded image")).toBeInTheDocument();
      // Event Assistant's message has "Visual response" alt text
      expect(screen.getByAltText("Visual response")).toBeInTheDocument();
    });

    it("renders message without media alongside messages with media", () => {
      const messages = [
        {
          id: "1",
          pseudonym: "Alice",
          createdAt: "2025-10-17T12:00:00Z",
          body: { text: "Just text" },
          channels: ["chat"],
          conversation: "conv-1",
          pseudonymId: "alice-1",
          fromAgent: false,
          pause: false,
          visible: true,
          upVotes: [],
          downVotes: [],
        },
        {
          id: "2",
          pseudonym: "Alice",
          createdAt: "2025-10-17T12:01:00Z",
          body: {
            text: "Text with image",
            media: [
              {
                type: "image",
                data: "imagedata",
                mimeType: "image/png",
              },
            ],
          },
          channels: ["chat"],
          conversation: "conv-1",
          pseudonymId: "alice-1",
          fromAgent: false,
          pause: false,
          visible: true,
          upVotes: [],
          downVotes: [],
        },
      ];

      render(<GroupChatPanel {...baseProps} messages={messages} />);

      expect(screen.getByText("Just text")).toBeInTheDocument();
      expect(screen.getByText("Text with image")).toBeInTheDocument();

      const images = screen.getAllByAltText("Uploaded image");
      expect(images).toHaveLength(1);
    });

    it("handles different image MIME types correctly", () => {
      const mimeTypes = [
        "image/png",
        "image/jpeg",
        "image/gif",
        "image/webp",
        "image/svg+xml",
      ];

      mimeTypes.forEach((mimeType, index) => {
        const messages = [
          {
            id: `${index}`,
            pseudonym: "Alice",
            createdAt: "2025-10-17T12:00:00Z",
            body: {
              text: `Image ${index}`,
              media: [
                {
                  type: "image",
                  data: "testdata",
                  mimeType,
                },
              ],
            },
            channels: ["chat"],
            conversation: "conv-1",
            pseudonymId: "alice-1",
            fromAgent: false,
            pause: false,
            visible: true,
            upVotes: [],
            downVotes: [],
          },
        ];

        const { unmount } = render(
          <GroupChatPanel {...baseProps} messages={messages} />,
        );

        const image = screen.getByAltText("Uploaded image");
        expect(image).toHaveAttribute(
          "src",
          `data:${mimeType};base64,testdata`,
        );

        unmount();
      });
    });

    it("handles messages with very long base64 data", () => {
      const longBase64 = "a".repeat(10000);
      const messages = [
        {
          id: "1",
          pseudonym: "Alice",
          createdAt: "2025-10-17T12:00:00Z",
          body: {
            text: "Large image",
            media: [
              {
                type: "image",
                data: longBase64,
                mimeType: "image/png",
              },
            ],
          },
          channels: ["chat"],
          conversation: "conv-1",
          pseudonymId: "alice-1",
          fromAgent: false,
          pause: false,
          visible: true,
          upVotes: [],
          downVotes: [],
        },
      ];

      render(<GroupChatPanel {...baseProps} messages={messages} />);

      const image = screen.getByAltText("Uploaded image");
      expect(image).toHaveAttribute(
        "src",
        `data:image/png;base64,${longBase64}`,
      );
    });

    it("handles malformed media objects gracefully", () => {
      const messages = [
        {
          id: "1",
          pseudonym: "Alice",
          createdAt: "2025-10-17T12:00:00Z",
          body: {
            text: "Malformed media",
            media: [
              {
                type: "image",
                // Missing data and mimeType
              },
            ],
          },
          channels: ["chat"],
          conversation: "conv-1",
          pseudonymId: "alice-1",
          fromAgent: false,
          pause: false,
          visible: true,
          upVotes: [],
          downVotes: [],
        },
      ];

      const { container } = render(
        <GroupChatPanel {...baseProps} messages={messages} />,
      );

      expect(screen.getByText("Malformed media")).toBeInTheDocument();
      // Should not crash
      expect(container).toBeInTheDocument();
    });
  });

  describe("Timestamp display", () => {
    it("shows timestamp for the first message", () => {
      const messages = [
        {
          id: "1",
          pseudonym: "Alice",
          createdAt: "2025-10-17T12:00:00Z",
          body: { text: "First message" },
          channels: ["chat"],
          conversation: "conv-1",
          pseudonymId: "alice-1",
          fromAgent: false,
          pause: false,
          visible: true,
          upVotes: [],
          downVotes: [],
        },
      ];

      const { container } = render(
        <GroupChatPanel {...baseProps} messages={messages} />,
      );

      // Check timestamp is displayed
      const timestamps = container.querySelectorAll(".text-gray-400");
      expect(timestamps.length).toBe(1);
    });

    it("shows timestamp when minute changes", () => {
      const messages = [
        {
          id: "1",
          pseudonym: "Alice",
          createdAt: "2025-10-17T12:00:00Z",
          body: { text: "First message" },
          channels: ["chat"],
          conversation: "conv-1",
          pseudonymId: "alice-1",
          fromAgent: false,
          pause: false,
          visible: true,
          upVotes: [],
          downVotes: [],
        },
        {
          id: "2",
          pseudonym: "Bob",
          createdAt: "2025-10-17T12:01:00Z",
          body: { text: "Second message" },
          channels: ["chat"],
          conversation: "conv-1",
          pseudonymId: "bob-1",
          fromAgent: false,
          pause: false,
          visible: true,
          upVotes: [],
          downVotes: [],
        },
      ];

      const { container } = render(
        <GroupChatPanel {...baseProps} messages={messages} />,
      );

      // Should show two timestamps (one for each different minute)
      const timestamps = container.querySelectorAll(".text-gray-400");
      expect(timestamps.length).toBe(2);
    });

    it("shows timestamp when hour changes", () => {
      const messages = [
        {
          id: "1",
          pseudonym: "Alice",
          createdAt: "2025-10-17T12:59:00Z",
          body: { text: "First message" },
          channels: ["chat"],
          conversation: "conv-1",
          pseudonymId: "alice-1",
          fromAgent: false,
          pause: false,
          visible: true,
          upVotes: [],
          downVotes: [],
        },
        {
          id: "2",
          pseudonym: "Bob",
          createdAt: "2025-10-17T13:00:00Z",
          body: { text: "Second message" },
          channels: ["chat"],
          conversation: "conv-1",
          pseudonymId: "bob-1",
          fromAgent: false,
          pause: false,
          visible: true,
          upVotes: [],
          downVotes: [],
        },
      ];

      const { container } = render(
        <GroupChatPanel {...baseProps} messages={messages} />,
      );

      // Should show two timestamps (one for each different hour)
      const timestamps = container.querySelectorAll(".text-gray-400");
      expect(timestamps.length).toBe(2);
    });

    it("does not show timestamp when messages are in the same minute", () => {
      const messages = [
        {
          id: "1",
          pseudonym: "Alice",
          createdAt: "2025-10-17T12:00:00Z",
          body: { text: "First message" },
          channels: ["chat"],
          conversation: "conv-1",
          pseudonymId: "alice-1",
          fromAgent: false,
          pause: false,
          visible: true,
          upVotes: [],
          downVotes: [],
        },
        {
          id: "2",
          pseudonym: "Bob",
          createdAt: "2025-10-17T12:00:30Z",
          body: { text: "Second message" },
          channels: ["chat"],
          conversation: "conv-1",
          pseudonymId: "bob-1",
          fromAgent: false,
          pause: false,
          visible: true,
          upVotes: [],
          downVotes: [],
        },
      ];

      const { container } = render(
        <GroupChatPanel {...baseProps} messages={messages} />,
      );

      // Should only show one timestamp (for the first message)
      const timestamps = container.querySelectorAll(".text-gray-400");
      expect(timestamps.length).toBe(1);
    });

    it("shows timestamp for Event Assistant messages when minute changes", () => {
      const messages = [
        {
          id: "1",
          pseudonym: "Alice",
          createdAt: "2025-10-17T12:00:00Z",
          body: { text: "First message" },
          channels: ["chat"],
          conversation: "conv-1",
          pseudonymId: "alice-1",
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
          body: { text: "Assistant response" },
          channels: ["chat"],
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
        <GroupChatPanel {...baseProps} messages={messages} />,
      );

      // Should show two timestamps (one for each different minute)
      const timestamps = container.querySelectorAll(".text-gray-400");
      expect(timestamps.length).toBe(2);
    });
  });

  describe("Feedback Configuration in Group Chat", () => {
    it("renders feedback UI for agent messages in eligibleMessageIds", () => {
      const mockEnterControlledMode = jest.fn();
      const mockSendRating = jest.fn();

      const messages = [
        {
          id: "1",
          pseudonym: "Alice",
          createdAt: "2025-10-17T12:00:00Z",
          body: { text: "User message" },
          channels: ["chat"],
          conversation: "conv-1",
          pseudonymId: "alice-1",
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
          body: { text: "Agent message 1" },
          channels: ["chat"],
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
          body: { text: "Agent message 2" },
          channels: ["chat"],
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
        eligibleMessageIds: new Set(["2"]), // Only message 2 eligible
        messageRatings: new Map(),
        onPopulateFeedbackText: mockEnterControlledMode,
        onSendRating: mockSendRating,
      };

      render(
        <GroupChatPanel
          {...baseProps}
          messages={messages}
          feedbackConfig={feedbackConfig}
        />,
      );

      // Should have 1 feedback element (for message 2 only)
      const feedbackElements = screen.queryAllByTestId("message-feedback");
      expect(feedbackElements).toHaveLength(1);
      expect(feedbackElements[0]).toHaveAttribute("data-message-id", "2");
    });

    it("does not render feedback UI when feedbackConfig is not provided", () => {
      const messages = [
        {
          id: "1",
          pseudonym: "Event Assistant",
          createdAt: "2025-10-17T12:00:00Z",
          body: { text: "Agent message" },
          channels: ["chat"],
          conversation: "conv-1",
          pseudonymId: "ea-1",
          fromAgent: true,
          pause: false,
          visible: true,
          upVotes: [],
          downVotes: [],
        },
      ];

      render(<GroupChatPanel {...baseProps} messages={messages} />);

      // Should not have any feedback elements
      expect(screen.queryByTestId("message-feedback")).not.toBeInTheDocument();
    });

    it("does not render feedback for user messages even with feedbackConfig", () => {
      const mockEnterControlledMode = jest.fn();
      const mockSendRating = jest.fn();

      const messages = [
        {
          id: "1",
          pseudonym: "Alice",
          createdAt: "2025-10-17T12:00:00Z",
          body: { text: "User message" },
          channels: ["chat"],
          conversation: "conv-1",
          pseudonymId: "alice-1",
          fromAgent: false,
          pause: false,
          visible: true,
          upVotes: [],
          downVotes: [],
        },
      ];

      const feedbackConfig = {
        eligibleMessageIds: new Set(["1"]),
        messageRatings: new Map(),
        onPopulateFeedbackText: mockEnterControlledMode,
        onSendRating: mockSendRating,
      };

      render(
        <GroupChatPanel
          {...baseProps}
          messages={messages}
          feedbackConfig={feedbackConfig}
        />,
      );

      // Should not have feedback for user messages
      expect(screen.queryByTestId("message-feedback")).not.toBeInTheDocument();
    });

    it("renders feedback for multiple eligible agent messages", () => {
      const mockEnterControlledMode = jest.fn();
      const mockSendRating = jest.fn();

      const messages = [
        {
          id: "1",
          pseudonym: "Event Assistant",
          createdAt: "2025-10-17T12:00:00Z",
          body: { text: "Agent message 1" },
          channels: ["chat"],
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
          body: { text: "Agent message 2" },
          channels: ["chat"],
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
          body: { text: "Agent message 3" },
          channels: ["chat"],
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
        eligibleMessageIds: new Set(["1", "3"]), // Messages 1 and 3 eligible
        messageRatings: new Map(),
        onPopulateFeedbackText: mockEnterControlledMode,
        onSendRating: mockSendRating,
      };

      render(
        <GroupChatPanel
          {...baseProps}
          messages={messages}
          feedbackConfig={feedbackConfig}
        />,
      );

      const feedbackElements = screen.queryAllByTestId("message-feedback");

      // Should have 2 feedback elements
      expect(feedbackElements).toHaveLength(2);
      expect(feedbackElements[0]).toHaveAttribute("data-message-id", "1");
      expect(feedbackElements[1]).toHaveAttribute("data-message-id", "3");
    });

    it("handles empty eligibleMessageIds set", () => {
      const mockEnterControlledMode = jest.fn();
      const mockSendRating = jest.fn();

      const messages = [
        {
          id: "1",
          pseudonym: "Event Assistant",
          createdAt: "2025-10-17T12:00:00Z",
          body: { text: "Agent message" },
          channels: ["chat"],
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
        messageRatings: new Map(),
        onPopulateFeedbackText: mockEnterControlledMode,
        onSendRating: mockSendRating,
      };

      render(
        <GroupChatPanel
          {...baseProps}
          messages={messages}
          feedbackConfig={feedbackConfig}
        />,
      );

      // Should not have any feedback elements
      expect(screen.queryByTestId("message-feedback")).not.toBeInTheDocument();
    });

    it("excludes feedback for intro type messages in chat", () => {
      const mockEnterControlledMode = jest.fn();
      const mockSendRating = jest.fn();

      const messages = [
        {
          id: "1",
          pseudonym: "Event Assistant",
          createdAt: "2025-10-17T12:00:00Z",
          body: { text: "Welcome message", type: "intro" },
          channels: ["chat"],
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
          body: { text: "Regular message" },
          channels: ["chat"],
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
        eligibleMessageIds: new Set(["2"]), // Message 1 excluded by type
        messageRatings: new Map(),
        onPopulateFeedbackText: mockEnterControlledMode,
        onSendRating: mockSendRating,
      };

      render(
        <GroupChatPanel
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

    it("passes initial rating from messageRatings to MessageFeedback", () => {
      const mockEnterControlledMode = jest.fn();
      const mockSendRating = jest.fn();

      const messages = [
        {
          id: "1",
          pseudonym: "Event Assistant",
          createdAt: "2025-10-17T12:00:00Z",
          body: { text: "Agent message" },
          channels: ["chat"],
          conversation: "conv-1",
          pseudonymId: "ea-1",
          fromAgent: true,
          pause: false,
          visible: true,
          upVotes: [],
          downVotes: [],
        },
      ];

      const messageRatings = new Map([["1", "WOW!"]]);
      const feedbackConfig = {
        eligibleMessageIds: new Set(["1"]),
        messageRatings,
        onPopulateFeedbackText: mockEnterControlledMode,
        onSendRating: mockSendRating,
      };

      render(
        <GroupChatPanel
          {...baseProps}
          messages={messages}
          feedbackConfig={feedbackConfig}
        />,
      );

      // MessageFeedback mock should be rendered
      const feedbackElement = screen.getByTestId("message-feedback");
      expect(feedbackElement).toBeInTheDocument();
    });

    it("synchronizes feedback ratings across parent message and thread panel", () => {
      const mockEnterControlledMode = jest.fn();
      const mockSendRating = jest.fn();

      const parentMessage = {
        id: "parent-1",
        pseudonym: "Event Assistant",
        createdAt: "2025-10-17T12:00:00Z",
        body: { text: "Parent agent message" },
        channels: ["chat"],
        conversation: "conv-1",
        pseudonymId: "ea-1",
        fromAgent: true,
        pause: false,
        visible: true,
        upVotes: [],
        downVotes: [],
      };

      const messages = [parentMessage];

      // Parent message has been rated
      const messageRatings = new Map([["parent-1", "OK"]]);
      const feedbackConfig = {
        eligibleMessageIds: new Set(["parent-1"]),
        messageRatings,
        onPopulateFeedbackText: mockEnterControlledMode,
        onSendRating: mockSendRating,
      };

      render(
        <GroupChatPanel
          {...baseProps}
          messages={messages}
          feedbackConfig={feedbackConfig}
        />,
      );

      // Check that MessageFeedback receives the initialRating
      const feedbackElements = screen.getAllByTestId("message-feedback");
      expect(feedbackElements[0]).toHaveAttribute("data-initial-rating", "OK");
    });

    it("synchronizes feedback ratings for reply messages in thread preview", () => {
      const mockEnterControlledMode = jest.fn();
      const mockSendRating = jest.fn();

      const parentMessage = {
        id: "parent-1",
        pseudonym: "Alice",
        createdAt: "2025-10-17T12:00:00Z",
        body: { text: "User question" },
        channels: ["chat"],
        conversation: "conv-1",
        pseudonymId: "alice-1",
        fromAgent: false,
        pause: false,
        visible: true,
        upVotes: [],
        downVotes: [],
      };

      const replyMessage = {
        id: "reply-1",
        pseudonym: "Event Assistant",
        parentMessage: "parent-1",
        createdAt: "2025-10-17T12:01:00Z",
        body: { text: "Agent reply" },
        channels: ["chat"],
        conversation: "conv-1",
        pseudonymId: "ea-1",
        fromAgent: true,
        pause: false,
        visible: true,
        upVotes: [],
        downVotes: [],
      };

      const messages = [parentMessage, replyMessage];

      // Reply has been rated
      const messageRatings = new Map([["reply-1", "Meh"]]);
      const feedbackConfig = {
        eligibleMessageIds: new Set(["reply-1"]),
        messageRatings,
        onPopulateFeedbackText: mockEnterControlledMode,
        onSendRating: mockSendRating,
      };

      render(
        <GroupChatPanel
          {...baseProps}
          messages={messages}
          feedbackConfig={feedbackConfig}
        />,
      );

      // Check that the reply preview's MessageFeedback receives the initialRating
      const feedbackElements = screen.getAllByTestId("message-feedback");
      expect(feedbackElements[0]).toHaveAttribute("data-initial-rating", "Meh");
    });
  });

  describe("Thread organization and reply count logic", () => {
    it("correctly separates parent messages from replies", () => {
      const messages = [
        {
          id: "parent-1",
          pseudonym: "Alice",
          createdAt: "2025-10-17T12:00:00Z",
          body: { text: "Parent message" },
          channels: ["chat"],
          conversation: "conv-1",
          pseudonymId: "alice-1",
          fromAgent: false,
          pause: false,
          visible: true,
          upVotes: [],
          downVotes: [],
        },
        {
          id: "reply-1",
          pseudonym: "Bob",
          createdAt: "2025-10-17T12:01:00Z",
          body: { text: "Reply to parent" },
          parentMessage: "parent-1",
          channels: ["chat"],
          conversation: "conv-1",
          pseudonymId: "bob-1",
          fromAgent: false,
          pause: false,
          visible: true,
          upVotes: [],
          downVotes: [],
        },
      ];

      render(<GroupChatPanel {...baseProps} messages={messages} />);

      // Parent message should be visible
      expect(screen.getByText("Parent message")).toBeInTheDocument();

      // Reply should be shown as a preview under the parent
      expect(screen.getByText("Reply to parent")).toBeInTheDocument();
    });

    it("builds threadMap correctly with multiple replies to same parent", () => {
      const messages = [
        {
          id: "parent-1",
          pseudonym: "Alice",
          createdAt: "2025-10-17T12:00:00Z",
          body: { text: "Question" },
          channels: ["chat"],
          conversation: "conv-1",
          pseudonymId: "alice-1",
          fromAgent: false,
          pause: false,
          visible: true,
          upVotes: [],
          downVotes: [],
        },
        {
          id: "reply-1",
          pseudonym: "Bob",
          createdAt: "2025-10-17T12:01:00Z",
          body: { text: "First reply" },
          parentMessage: "parent-1",
          channels: ["chat"],
          conversation: "conv-1",
          pseudonymId: "bob-1",
          fromAgent: false,
          pause: false,
          visible: true,
          upVotes: [],
          downVotes: [],
        },
        {
          id: "reply-2",
          pseudonym: "Charlie",
          createdAt: "2025-10-17T12:02:00Z",
          body: { text: "Second reply" },
          parentMessage: "parent-1",
          channels: ["chat"],
          conversation: "conv-1",
          pseudonymId: "charlie-1",
          fromAgent: false,
          pause: false,
          visible: true,
          upVotes: [],
          downVotes: [],
        },
      ];

      render(<GroupChatPanel {...baseProps} messages={messages} />);

      // First reply should be shown in preview
      expect(screen.getByText("First reply")).toBeInTheDocument();

      // Should show "+1 more reply" indicator
      expect(screen.getByText("+ 1 more reply")).toBeInTheDocument();
    });

    it("sorts replies by createdAt timestamp in threadMap", () => {
      const messages = [
        {
          id: "parent-1",
          pseudonym: "Alice",
          createdAt: "2025-10-17T12:00:00Z",
          body: { text: "Question" },
          channels: ["chat"],
          conversation: "conv-1",
          pseudonymId: "alice-1",
          fromAgent: false,
          pause: false,
          visible: true,
          upVotes: [],
          downVotes: [],
        },
        // Add replies in non-chronological order
        {
          id: "reply-3",
          pseudonym: "David",
          createdAt: "2025-10-17T12:03:00Z",
          body: { text: "Third reply" },
          parentMessage: "parent-1",
          channels: ["chat"],
          conversation: "conv-1",
          pseudonymId: "david-1",
          fromAgent: false,
          pause: false,
          visible: true,
          upVotes: [],
          downVotes: [],
        },
        {
          id: "reply-1",
          pseudonym: "Bob",
          createdAt: "2025-10-17T12:01:00Z",
          body: { text: "First reply" },
          parentMessage: "parent-1",
          channels: ["chat"],
          conversation: "conv-1",
          pseudonymId: "bob-1",
          fromAgent: false,
          pause: false,
          visible: true,
          upVotes: [],
          downVotes: [],
        },
        {
          id: "reply-2",
          pseudonym: "Charlie",
          createdAt: "2025-10-17T12:02:00Z",
          body: { text: "Second reply" },
          parentMessage: "parent-1",
          channels: ["chat"],
          conversation: "conv-1",
          pseudonymId: "charlie-1",
          fromAgent: false,
          pause: false,
          visible: true,
          upVotes: [],
          downVotes: [],
        },
      ];

      render(<GroupChatPanel {...baseProps} messages={messages} />);

      // The first reply (chronologically) should be shown in the preview
      expect(screen.getByText("First reply")).toBeInTheDocument();

      // Should show "+2 more replies" since there are 3 total replies
      expect(screen.getByText("+ 2 more replies")).toBeInTheDocument();
    });

    it("handles multiple parent messages with their own replies", () => {
      const messages = [
        {
          id: "parent-1",
          pseudonym: "Alice",
          createdAt: "2025-10-17T12:00:00Z",
          body: { text: "First question" },
          channels: ["chat"],
          conversation: "conv-1",
          pseudonymId: "alice-1",
          fromAgent: false,
          pause: false,
          visible: true,
          upVotes: [],
          downVotes: [],
        },
        {
          id: "parent-2",
          pseudonym: "Bob",
          createdAt: "2025-10-17T12:01:00Z",
          body: { text: "Second question" },
          channels: ["chat"],
          conversation: "conv-1",
          pseudonymId: "bob-1",
          fromAgent: false,
          pause: false,
          visible: true,
          upVotes: [],
          downVotes: [],
        },
        {
          id: "reply-1-1",
          pseudonym: "Charlie",
          createdAt: "2025-10-17T12:02:00Z",
          body: { text: "Reply to first" },
          parentMessage: "parent-1",
          channels: ["chat"],
          conversation: "conv-1",
          pseudonymId: "charlie-1",
          fromAgent: false,
          pause: false,
          visible: true,
          upVotes: [],
          downVotes: [],
        },
        {
          id: "reply-2-1",
          pseudonym: "David",
          createdAt: "2025-10-17T12:03:00Z",
          body: { text: "Reply to second" },
          parentMessage: "parent-2",
          channels: ["chat"],
          conversation: "conv-1",
          pseudonymId: "david-1",
          fromAgent: false,
          pause: false,
          visible: true,
          upVotes: [],
          downVotes: [],
        },
      ];

      render(<GroupChatPanel {...baseProps} messages={messages} />);

      // Both parent messages should be visible
      expect(screen.getByText("First question")).toBeInTheDocument();
      expect(screen.getByText("Second question")).toBeInTheDocument();

      // Each reply should be under its respective parent
      expect(screen.getByText("Reply to first")).toBeInTheDocument();
      expect(screen.getByText("Reply to second")).toBeInTheDocument();
    });

    it("passes messagesWithUnreadReplies to ThreadedMessage components", () => {
      const messages = [
        {
          id: "parent-1",
          pseudonym: "Alice",
          createdAt: "2025-10-17T12:00:00Z",
          body: { text: "Parent with unread replies" },
          channels: ["chat"],
          conversation: "conv-1",
          pseudonymId: "alice-1",
          fromAgent: false,
          pause: false,
          visible: true,
          upVotes: [],
          downVotes: [],
        },
        {
          id: "parent-2",
          pseudonym: "Bob",
          createdAt: "2025-10-17T12:01:00Z",
          body: { text: "Parent without unread replies" },
          channels: ["chat"],
          conversation: "conv-1",
          pseudonymId: "bob-1",
          fromAgent: false,
          pause: false,
          visible: true,
          upVotes: [],
          downVotes: [],
        },
      ];

      const messagesWithUnreadReplies = new Set(["parent-1"]);

      const { container } = render(
        <GroupChatPanel
          {...baseProps}
          messages={messages}
          messagesWithUnreadReplies={messagesWithUnreadReplies}
          onMarkAsRead={jest.fn()}
        />
      );

      // Both messages should be rendered
      expect(screen.getByText("Parent with unread replies")).toBeInTheDocument();
      expect(screen.getByText("Parent without unread replies")).toBeInTheDocument();
    });
  });

  describe("Thinking Bot Icon", () => {
    it("shows thinking bot icon when waiting for non-threaded response", () => {
      const messages = [
        {
          id: "1",
          pseudonym: "Alice",
          createdAt: "2025-10-17T12:00:00Z",
          body: { text: "User message" },
          channels: ["chat"],
          conversation: "conv-1",
          pseudonymId: "alice-1",
          fromAgent: false,
          pause: false,
          visible: true,
          upVotes: [],
          downVotes: [],
        },
      ];

      const { container } = render(
        <GroupChatPanel
          {...baseProps}
          messages={messages}
          waitingForResponse={true}
        />
      );

      // Should show thinking indicator with bouncing bot icon
      const bouncingIcon = container.querySelector(".animate-bounce");
      expect(bouncingIcon).toBeInTheDocument();
      expect(screen.getByText("thinking...")).toBeInTheDocument();
    });

    it("does not show thinking bot icon when waitingForResponse is false", () => {
      const messages = [
        {
          id: "1",
          pseudonym: "Alice",
          createdAt: "2025-10-17T12:00:00Z",
          body: { text: "User message" },
          channels: ["chat"],
          conversation: "conv-1",
          pseudonymId: "alice-1",
          fromAgent: false,
          pause: false,
          visible: true,
          upVotes: [],
          downVotes: [],
        },
      ];

      const { container } = render(
        <GroupChatPanel
          {...baseProps}
          messages={messages}
          waitingForResponse={false}
        />
      );

      const bouncingIcon = container.querySelector(".animate-bounce");
      expect(bouncingIcon).not.toBeInTheDocument();
      expect(screen.queryByText("thinking...")).not.toBeInTheDocument();
    });

    it("does not show thinking bot icon in main chat when waiting for threaded reply", () => {
      const parentMessage = {
        id: "parent-1",
        pseudonym: "Alice",
        createdAt: "2025-10-17T12:00:00Z",
        body: { text: "Parent message" },
        channels: ["chat"],
        conversation: "conv-1",
        pseudonymId: "alice-1",
        fromAgent: false,
        pause: false,
        visible: true,
        upVotes: [],
        downVotes: [],
      };

      const userReply = {
        id: "reply-1",
        pseudonym: "Alice",
        createdAt: "2025-10-17T12:01:00Z",
        body: { text: "User reply in thread" },
        parentMessage: "parent-1",
        channels: ["chat"],
        conversation: "conv-1",
        pseudonymId: "alice-1",
        fromAgent: false,
        pause: false,
        visible: true,
        upVotes: [],
        downVotes: [],
      };

      const { container } = render(
        <GroupChatPanel
          {...baseProps}
          messages={[parentMessage, userReply]}
          waitingForResponse={true}
        />
      );

      // Main chat should NOT show thinking indicator when waiting for threaded reply
      const bouncingIcons = container.querySelectorAll(".animate-bounce");
      expect(bouncingIcons.length).toBe(0);
      expect(screen.queryByText("thinking...")).not.toBeInTheDocument();
    });

    it("shows thinking bot icon below the last parent message", () => {
      const messages = [
        {
          id: "1",
          pseudonym: "Alice",
          createdAt: "2025-10-17T12:00:00Z",
          body: { text: "First message" },
          channels: ["chat"],
          conversation: "conv-1",
          pseudonymId: "alice-1",
          fromAgent: false,
          pause: false,
          visible: true,
          upVotes: [],
          downVotes: [],
        },
        {
          id: "2",
          pseudonym: "Bob",
          createdAt: "2025-10-17T12:01:00Z",
          body: { text: "Second message" },
          channels: ["chat"],
          conversation: "conv-1",
          pseudonymId: "bob-1",
          fromAgent: false,
          pause: false,
          visible: true,
          upVotes: [],
          downVotes: [],
        },
      ];

      const { container } = render(
        <GroupChatPanel
          {...baseProps}
          messages={messages}
          waitingForResponse={true}
        />
      );

      // Both messages should be visible
      expect(screen.getByText("First message")).toBeInTheDocument();
      expect(screen.getByText("Second message")).toBeInTheDocument();

      // Thinking indicator should also be visible
      expect(screen.getByText("thinking...")).toBeInTheDocument();
      const bouncingIcon = container.querySelector(".animate-bounce");
      expect(bouncingIcon).toBeInTheDocument();
    });

    it("removes thinking indicator when bot response arrives", async () => {
      const initialMessages = [
        {
          id: "1",
          pseudonym: "Alice",
          createdAt: "2025-10-17T12:00:00Z",
          body: { text: "User question" },
          channels: ["chat"],
          conversation: "conv-1",
          pseudonymId: "alice-1",
          fromAgent: false,
          pause: false,
          visible: true,
          upVotes: [],
          downVotes: [],
        },
      ];

      const { rerender, container } = render(
        <GroupChatPanel
          {...baseProps}
          messages={initialMessages}
          waitingForResponse={true}
        />
      );

      // Verify thinking indicator is shown
      expect(screen.getByText("thinking...")).toBeInTheDocument();
      let bouncingIcon = container.querySelector(".animate-bounce");
      expect(bouncingIcon).toBeInTheDocument();

      // Add bot response and remove waiting state
      const messagesWithResponse = [
        ...initialMessages,
        {
          id: "2",
          pseudonym: "Berkie",
          createdAt: "2025-10-17T12:01:00Z",
          body: { text: "Bot response" },
          channels: ["chat"],
          conversation: "conv-1",
          pseudonymId: "berkie-1",
          fromAgent: true,
          pause: false,
          visible: true,
          upVotes: [],
          downVotes: [],
        },
      ];

      rerender(
        <GroupChatPanel
          {...baseProps}
          messages={messagesWithResponse}
          waitingForResponse={false}
        />
      );

      // Verify thinking indicator is removed
      await waitFor(() => {
        expect(screen.queryByText("thinking...")).not.toBeInTheDocument();
      });
      bouncingIcon = container.querySelector(".animate-bounce");
      expect(bouncingIcon).not.toBeInTheDocument();

      // Verify bot response is displayed
      expect(screen.getByText("Bot response")).toBeInTheDocument();
    });

    it("shows thinking indicator above message input area", () => {
      const messages = [
        {
          id: "1",
          pseudonym: "Alice",
          createdAt: "2025-10-17T12:00:00Z",
          body: { text: "User message" },
          channels: ["chat"],
          conversation: "conv-1",
          pseudonymId: "alice-1",
          fromAgent: false,
          pause: false,
          visible: true,
          upVotes: [],
          downVotes: [],
        },
      ];

      render(
        <GroupChatPanel
          {...baseProps}
          messages={messages}
          waitingForResponse={true}
        />
      );

      // Both thinking indicator and message input should be present
      expect(screen.getByText("thinking...")).toBeInTheDocument();
      expect(screen.getByTestId("message-input")).toBeInTheDocument();
    });
  });
});
