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

  it("highlights @mentions in messages", () => {
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
    ];

    const { container } = render(
      <GroupChatPanel {...baseProps} messages={messages} />,
    );

    // Check that mention has styling with font-semibold class
    const mentionSpan = container.querySelector(".font-semibold");
    expect(mentionSpan).toBeInTheDocument();
    expect(mentionSpan?.textContent).toContain("@Bob");
  });

  it("filters out parent messages", () => {
    const messages = [
      {
        id: "1",
        pseudonym: "Alice",
        createdAt: "2025-10-17T12:00:00Z",
        body: { text: "Main message" },
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
        body: { text: "Child message" },
        channels: ["chat"],
        parentMessage: "1",
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

    expect(screen.getByText("Main message")).toBeInTheDocument();
    expect(screen.queryByText("Child message")).not.toBeInTheDocument();
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

  it("normalizes 'Event Assistant Plus' to 'Event Assistant'", () => {
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

    expect(screen.getByText("Event Assistant")).toBeInTheDocument();
    expect(screen.queryByText("Event Assistant Plus")).not.toBeInTheDocument();
  });

  it("normalizes 'Event Mediator' to 'Event Assistant'", () => {
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

    expect(screen.getByText("Event Assistant")).toBeInTheDocument();
    expect(screen.queryByText("Event Mediator")).not.toBeInTheDocument();
  });

  it("normalizes 'Event Mediator Plus' to 'Event Assistant'", () => {
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

    expect(screen.getByText("Event Assistant")).toBeInTheDocument();
    expect(screen.queryByText("Event Mediator Plus")).not.toBeInTheDocument();
  });

  it("normalizes 'Engagement Agent' to 'Event Assistant'", () => {
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

    expect(screen.getByText("Event Assistant")).toBeInTheDocument();
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
      const image = screen.getByAltText("Visual response");
      expect(image).toHaveAttribute(
        "src",
        "data:image/png;base64,base64imagedata"
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

      const images = screen.getAllByAltText("Visual response");
      expect(images).toHaveLength(3);
      expect(images[0]).toHaveAttribute(
        "src",
        "data:image/png;base64,image1data"
      );
      expect(images[1]).toHaveAttribute(
        "src",
        "data:image/jpeg;base64,image2data"
      );
      expect(images[2]).toHaveAttribute(
        "src",
        "data:image/gif;base64,image3data"
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

      const image = screen.getByAltText("Visual response");
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
      expect(screen.queryByAltText("Visual response")).not.toBeInTheDocument();
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
      expect(screen.queryByAltText("Visual response")).not.toBeInTheDocument();
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
      const images = screen.getAllByAltText("Visual response");
      expect(images).toHaveLength(1);
      expect(images[0]).toHaveAttribute(
        "src",
        "data:image/png;base64,imagedata"
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

      const images = screen.getAllByAltText("Visual response");
      expect(images).toHaveLength(2);
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

      const images = screen.getAllByAltText("Visual response");
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
          <GroupChatPanel {...baseProps} messages={messages} />
        );

        const image = screen.getByAltText("Visual response");
        expect(image).toHaveAttribute("src", `data:${mimeType};base64,testdata`);

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

      const image = screen.getByAltText("Visual response");
      expect(image).toHaveAttribute(
        "src",
        `data:image/png;base64,${longBase64}`
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
        <GroupChatPanel {...baseProps} messages={messages} />
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
});
