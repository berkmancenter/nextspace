import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ThreadPanel } from "../../components/ThreadPanel";
import { PseudonymousMessage } from "../../types.internal";
import { InputEnhancer } from "../../types/inputEnhancer";

describe("ThreadPanel Component", () => {
  const mockParentMessage: PseudonymousMessage = {
    id: "parent-123",
    body: { text: "Parent message" },
    pseudonym: "User1",
    conversation: "conv-1",
    pseudonymId: "user1-id",
    fromAgent: false,
    pause: false,
    visible: true,
    upVotes: [],
    downVotes: [],
    channels: ["chat"],
    createdAt: new Date().toISOString(),
  };

  const mockReplies: PseudonymousMessage[] = [
    {
      id: "reply-1",
      body: { text: "First reply" },
      pseudonym: "User2",
      conversation: "conv-1",
      pseudonymId: "user2-id",
      fromAgent: false,
      pause: false,
      visible: true,
      upVotes: [],
      downVotes: [],
      channels: ["chat"],
      createdAt: new Date().toISOString(),
    },
    {
      id: "reply-2",
      body: { text: "Second reply" },
      pseudonym: "User1",
      conversation: "conv-1",
      pseudonymId: "user1-id",
      fromAgent: false,
      pause: false,
      visible: true,
      upVotes: [],
      downVotes: [],
      channels: ["chat"],
      createdAt: new Date().toISOString(),
    },
  ];

  const mockRenderAvatar = jest.fn((msg: PseudonymousMessage) => (
    <div data-testid={`avatar-${msg.id}`}>Avatar</div>
  ));

  const mockRenderMessageContent = jest.fn((msg: PseudonymousMessage) => {
    const text = typeof msg.body === "object" ? (msg.body as any).text : msg.body;
    return <div data-testid={`message-${msg.id}`}>{text}</div>;
  });

  const mockOnClose = jest.fn();
  const mockOnSendReply = jest.fn();

  const defaultProps = {
    parentMessage: mockParentMessage,
    replies: mockReplies,
    pseudonym: "User1",
    onClose: mockOnClose,
    onSendReply: mockOnSendReply,
    renderAvatar: mockRenderAvatar,
    renderMessageContent: mockRenderMessageContent,
    enhancers: [] as InputEnhancer<any>[],
    botName: "Test Bot",
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders the thread panel header", () => {
    render(<ThreadPanel {...defaultProps} />);
    expect(screen.getByText("Replies")).toBeInTheDocument();
  });

  it("renders the close button", () => {
    render(<ThreadPanel {...defaultProps} />);
    const closeButton = screen.getByLabelText("Close thread");
    expect(closeButton).toBeInTheDocument();
  });

  it("calls onClose when close button is clicked", () => {
    render(<ThreadPanel {...defaultProps} />);
    const closeButton = screen.getByLabelText("Close thread");
    fireEvent.click(closeButton);
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it("renders the parent message with 'Original Message' label", () => {
    render(<ThreadPanel {...defaultProps} />);
    expect(screen.getByText("Original Message")).toBeInTheDocument();
    expect(screen.getByTestId(`message-${mockParentMessage.id}`)).toBeInTheDocument();
  });

  it("renders all replies", () => {
    render(<ThreadPanel {...defaultProps} />);
    expect(screen.getByTestId(`message-${mockReplies[0].id}`)).toBeInTheDocument();
    expect(screen.getByTestId(`message-${mockReplies[1].id}`)).toBeInTheDocument();
  });

  it("shows correct reply count", () => {
    render(<ThreadPanel {...defaultProps} />);
    expect(screen.getByText("2 Replies")).toBeInTheDocument();
  });

  it("shows singular 'Reply' when there is one reply", () => {
    const singleReply = [mockReplies[0]];
    render(<ThreadPanel {...defaultProps} replies={singleReply} />);
    expect(screen.getByText("1 Reply")).toBeInTheDocument();
  });

  it("marks current user's messages with (You)", () => {
    render(<ThreadPanel {...defaultProps} />);
    const youLabels = screen.getAllByText("(You)");
    expect(youLabels.length).toBeGreaterThan(0);
  });

  it("displays timestamps for parent message and replies", () => {
    const fixedDate = new Date("2024-01-15T14:30:00");
    const parentWithTimestamp = {
      ...mockParentMessage,
      createdAt: fixedDate.toISOString(),
    };
    const repliesWithTimestamps = mockReplies.map((reply, idx) => ({
      ...reply,
      createdAt: new Date(fixedDate.getTime() + (idx + 1) * 60000).toISOString(),
    }));

    render(
      <ThreadPanel
        {...defaultProps}
        parentMessage={parentWithTimestamp}
        replies={repliesWithTimestamps}
      />
    );

    // Check parent message timestamp
    const parentTimestamp = fixedDate.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
    expect(screen.getByText(parentTimestamp)).toBeInTheDocument();

    // Check reply timestamps
    repliesWithTimestamps.forEach((reply) => {
      const replyTimestamp = new Date(reply.createdAt).toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
      });
      expect(screen.getByText(replyTimestamp)).toBeInTheDocument();
    });
  });

  it("renders reply input box by default", () => {
    render(<ThreadPanel {...defaultProps} />);
    const textarea = screen.getByPlaceholderText("Reply...");
    expect(textarea).toBeInTheDocument();
  });

  it("updates reply text when typing", () => {
    render(<ThreadPanel {...defaultProps} />);
    const textarea = screen.getByPlaceholderText("Reply...") as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "Test reply" } });
    expect(textarea.value).toBe("Test reply");
  });

  it("sends reply when Enter is pressed without Shift", () => {
    render(<ThreadPanel {...defaultProps} />);
    const textarea = screen.getByPlaceholderText("Reply...");
    fireEvent.change(textarea, { target: { value: "Test reply" } });
    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: false });

    expect(mockOnSendReply).toHaveBeenCalledWith("Test reply", mockParentMessage.id);
  });

  it("does not send reply when Enter is pressed with Shift", () => {
    render(<ThreadPanel {...defaultProps} />);
    const textarea = screen.getByPlaceholderText("Reply...");
    fireEvent.change(textarea, { target: { value: "Test reply" } });
    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: true });

    expect(mockOnSendReply).not.toHaveBeenCalled();
  });

  it("clears reply text after sending", () => {
    render(<ThreadPanel {...defaultProps} />);
    const textarea = screen.getByPlaceholderText("Reply...") as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "Test reply" } });
    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: false });

    expect(textarea.value).toBe("");
  });

  it("sends reply when send button is clicked", () => {
    render(<ThreadPanel {...defaultProps} />);
    const textarea = screen.getByPlaceholderText("Reply...");
    fireEvent.change(textarea, { target: { value: "Test reply" } });

    const sendButton = screen.getByLabelText("Send reply");
    fireEvent.click(sendButton);

    expect(mockOnSendReply).toHaveBeenCalledWith("Test reply", mockParentMessage.id);
  });

  it("disables send button when reply text is empty", () => {
    render(<ThreadPanel {...defaultProps} />);
    const sendButton = screen.getByLabelText("Send reply");
    expect(sendButton).toBeDisabled();
  });

  it("enables send button when reply text is not empty", () => {
    render(<ThreadPanel {...defaultProps} />);
    const textarea = screen.getByPlaceholderText("Reply...");
    fireEvent.change(textarea, { target: { value: "Test reply" } });

    const sendButton = screen.getByLabelText("Send reply");
    expect(sendButton).not.toBeDisabled();
  });

  it("does not send reply with only whitespace", () => {
    render(<ThreadPanel {...defaultProps} />);
    const textarea = screen.getByPlaceholderText("Reply...");
    fireEvent.change(textarea, { target: { value: "   " } });
    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: false });

    expect(mockOnSendReply).not.toHaveBeenCalled();
  });

  it("renders avatars for all messages", () => {
    render(<ThreadPanel {...defaultProps} />);
    expect(mockRenderAvatar).toHaveBeenCalledWith(mockParentMessage);
    mockReplies.forEach((reply) => {
      expect(mockRenderAvatar).toHaveBeenCalledWith(reply);
    });
  });

  it("renders message content for all messages", () => {
    render(<ThreadPanel {...defaultProps} />);
    expect(mockRenderMessageContent).toHaveBeenCalledWith(mockParentMessage);
    mockReplies.forEach((reply) => {
      expect(mockRenderMessageContent).toHaveBeenCalledWith(reply);
    });
  });


  it("renders enhancer buttons when provided", () => {
    const mockEnhancer: InputEnhancer<any> = {
      id: "test-enhancer",
      detectTrigger: jest.fn(() => null),
      getItems: jest.fn(() => []),
      onSelect: jest.fn(),
      renderItem: jest.fn(),
      button: {
        icon: "@",
        onClick: jest.fn((value, cursor) => ({ value: value + "@", cursorPos: cursor + 1 })),
        getTitle: jest.fn(() => "Test Enhancer"),
      },
    };

    render(<ThreadPanel {...defaultProps} enhancers={[mockEnhancer]} />);
    expect(screen.getByTitle("Test Enhancer")).toBeInTheDocument();
  });

  it("handles enhancer button click", () => {
    const mockEnhancer: InputEnhancer<any> = {
      id: "test-enhancer",
      detectTrigger: jest.fn(() => null),
      getItems: jest.fn(() => []),
      onSelect: jest.fn(),
      renderItem: jest.fn(),
      button: {
        icon: "@",
        onClick: jest.fn((value, cursor) => ({ value: value + "@", cursorPos: cursor + 1 })),
        getTitle: jest.fn(() => "Test Enhancer"),
      },
    };

    render(<ThreadPanel {...defaultProps} enhancers={[mockEnhancer]} />);
    const enhancerButton = screen.getByTitle("Test Enhancer");
    fireEvent.click(enhancerButton);

    expect(mockEnhancer.button.onClick).toHaveBeenCalled();
  });

  it("handles Escape key to close reply input", () => {
    render(<ThreadPanel {...defaultProps} />);
    const textarea = screen.getByPlaceholderText("Reply...");
    fireEvent.change(textarea, { target: { value: "Test" } });
    fireEvent.keyDown(textarea, { key: "Escape" });

    // After escape, reply button should be shown instead of textarea
    expect(screen.queryByPlaceholderText("Reply...")).not.toBeInTheDocument();
  });

  it("shows 'Reply to thread...' button when not replying", () => {
    render(<ThreadPanel {...defaultProps} />);
    const textarea = screen.getByPlaceholderText("Reply...");
    fireEvent.keyDown(textarea, { key: "Escape" });

    expect(screen.getByText("Reply to thread...")).toBeInTheDocument();
  });

  it("opens reply input when 'Reply to thread...' button is clicked", () => {
    render(<ThreadPanel {...defaultProps} />);
    const textarea = screen.getByPlaceholderText("Reply...");
    fireEvent.keyDown(textarea, { key: "Escape" });

    const replyButton = screen.getByText("Reply to thread...");
    fireEvent.click(replyButton);

    expect(screen.getByPlaceholderText("Reply...")).toBeInTheDocument();
  });

  it("handles empty replies array", () => {
    render(<ThreadPanel {...defaultProps} replies={[]} />);
    // Should not show the reply count divider when there are no replies
    expect(screen.queryByText(/\d+ Reply|\d+ Replies/)).not.toBeInTheDocument();
  });

  it("focuses textarea when reply input is opened", async () => {
    render(<ThreadPanel {...defaultProps} />);
    const textarea = screen.getByPlaceholderText("Reply...");

    // Close and reopen
    fireEvent.keyDown(textarea, { key: "Escape" });
    const replyButton = screen.getByText("Reply to thread...");
    fireEvent.click(replyButton);

    const newTextarea = screen.getByPlaceholderText("Reply...");
    await waitFor(() => {
      expect(newTextarea).toHaveFocus();
    });
  });
});
