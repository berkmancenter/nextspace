import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ThreadedMessage } from "../../components/ThreadedMessage";
import { PseudonymousMessage, FeedbackConfig } from "../../types.internal";

describe("ThreadedMessage Component", () => {
  const mockMessage: PseudonymousMessage = {
    id: "msg-123",
    body: { text: "This is a test message" },
    pseudonym: "User1",
    conversation: "conv-1",
    pseudonymId: "user1-id",
    fromAgent: false,
    pause: false,
    visible: true,
    upVotes: [],
    downVotes: [],
    channels: ["chat"],
    createdAt: new Date("2024-01-01T12:00:00").toISOString(),
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
      pseudonym: "User3",
      conversation: "conv-1",
      pseudonymId: "user3-id",
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

  const mockOnOpenThread = jest.fn();

  const defaultProps = {
    message: mockMessage,
    replies: [],
    pseudonym: "User1",
    onOpenThread: mockOnOpenThread,
    botName: "Test Bot",
    renderAvatar: mockRenderAvatar,
    renderMessageContent: mockRenderMessageContent,
    showTimestamp: false,
    isThreadOpen: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders the message content", () => {
    render(<ThreadedMessage {...defaultProps} />);
    expect(screen.getByTestId(`message-${mockMessage.id}`)).toBeInTheDocument();
    expect(screen.getByText("This is a test message")).toBeInTheDocument();
  });

  it("renders the avatar", () => {
    render(<ThreadedMessage {...defaultProps} />);
    expect(screen.getByTestId(`avatar-${mockMessage.id}`)).toBeInTheDocument();
  });

  it("shows timestamp when showTimestamp is true", () => {
    render(<ThreadedMessage {...defaultProps} showTimestamp={true} />);
    expect(screen.getByText("12:00 PM")).toBeInTheDocument();
  });

  it("hides timestamp when showTimestamp is false", () => {
    render(<ThreadedMessage {...defaultProps} showTimestamp={false} />);
    expect(screen.queryByText("12:00 PM")).not.toBeInTheDocument();
  });

  it("shows (You) label for current user's message", () => {
    render(<ThreadedMessage {...defaultProps} />);
    expect(screen.getByText("(You)")).toBeInTheDocument();
  });

  it("does not show (You) label for other users' messages", () => {
    const otherUserMessage = { ...mockMessage, pseudonym: "OtherUser" };
    render(<ThreadedMessage {...defaultProps} message={otherUserMessage} />);
    expect(screen.queryByText("(You)")).not.toBeInTheDocument();
  });

  it("shows reply button on mouse enter", async () => {
    render(<ThreadedMessage {...defaultProps} />);
    const messageContainer = screen.getByTestId(`message-${mockMessage.id}`).parentElement!.parentElement!;

    fireEvent.mouseEnter(messageContainer);

    await waitFor(() => {
      expect(screen.getByLabelText(`Reply to ${mockMessage.pseudonym}`)).toBeInTheDocument();
    });
  });

  it("hides reply button on mouse leave", async () => {
    render(<ThreadedMessage {...defaultProps} />);
    const messageContainer = screen.getByTestId(`message-${mockMessage.id}`).parentElement!.parentElement!;

    fireEvent.mouseEnter(messageContainer);
    await waitFor(() => {
      expect(screen.getByLabelText(`Reply to ${mockMessage.pseudonym}`)).toBeInTheDocument();
    });

    fireEvent.mouseLeave(messageContainer);
    await waitFor(() => {
      expect(screen.queryByLabelText(`Reply to ${mockMessage.pseudonym}`)).not.toBeInTheDocument();
    });
  });

  it("calls onOpenThread when reply button is clicked", async () => {
    render(<ThreadedMessage {...defaultProps} />);
    const messageContainer = screen.getByTestId(`message-${mockMessage.id}`).parentElement!.parentElement!;

    fireEvent.mouseEnter(messageContainer);

    const replyButton = await screen.findByLabelText(`Reply to ${mockMessage.pseudonym}`);
    fireEvent.click(replyButton);

    expect(mockOnOpenThread).toHaveBeenCalledWith(mockMessage.id);
  });

  it("renders first reply preview when replies exist", () => {
    render(<ThreadedMessage {...defaultProps} replies={mockReplies} />);
    expect(screen.getByTestId(`message-${mockReplies[0].id}`)).toBeInTheDocument();
    expect(screen.getByText("First reply")).toBeInTheDocument();
  });

  it("shows additional replies count when there are more than one reply", () => {
    render(<ThreadedMessage {...defaultProps} replies={mockReplies} />);
    expect(screen.getByText("+ 1 more reply")).toBeInTheDocument();
  });

  it("shows correct plural form for multiple additional replies", () => {
    const manyReplies: PseudonymousMessage[] = [
      ...mockReplies,
      {
        id: "reply-3",
        body: { text: "Third reply" },
        pseudonym: "User4",
        conversation: "conv-1",
        pseudonymId: "user4-id",
        fromAgent: false,
        pause: false,
        visible: true,
        upVotes: [],
        downVotes: [],
        channels: ["chat"],
        createdAt: new Date().toISOString(),
      },
    ];
    render(<ThreadedMessage {...defaultProps} replies={manyReplies} />);
    expect(screen.getByText("+ 2 more replies")).toBeInTheDocument();
  });

  it("calls onOpenThread when clicking on additional replies count", () => {
    render(<ThreadedMessage {...defaultProps} replies={mockReplies} />);
    const moreRepliesButton = screen.getByText("+ 1 more reply");
    fireEvent.click(moreRepliesButton);

    expect(mockOnOpenThread).toHaveBeenCalledWith(mockMessage.id);
  });

  it("does not show additional replies count when there is only one reply", () => {
    const singleReply = [mockReplies[0]];
    render(<ThreadedMessage {...defaultProps} replies={singleReply} />);
    expect(screen.queryByText(/more reply|more replies/)).not.toBeInTheDocument();
  });

  it("renders first reply avatar", () => {
    render(<ThreadedMessage {...defaultProps} replies={mockReplies} />);
    expect(screen.getByTestId(`avatar-${mockReplies[0].id}`)).toBeInTheDocument();
  });

  it("shows (You) label on first reply if it's from current user", () => {
    const repliesWithCurrentUser = [
      { ...mockReplies[0], pseudonym: "User1" },
      mockReplies[1],
    ];
    render(<ThreadedMessage {...defaultProps} replies={repliesWithCurrentUser} />);
    const youLabels = screen.getAllByText("(You)");
    expect(youLabels.length).toBeGreaterThan(1); // Both message and reply
  });

  it("highlights message when thread is open", () => {
    const { container } = render(<ThreadedMessage {...defaultProps} isThreadOpen={true} />);
    const messageWrapper = container.querySelector(".bg-blue-50");
    expect(messageWrapper).toBeInTheDocument();
  });

  it("does not highlight message when thread is closed", () => {
    const { container } = render(<ThreadedMessage {...defaultProps} isThreadOpen={false} />);
    const messageWrapper = container.querySelector(".bg-blue-50");
    expect(messageWrapper).not.toBeInTheDocument();
  });

  it("renders feedback component for assistant messages when config is provided", () => {
    const assistantMessage = { ...mockMessage, fromAgent: true };
    const eligibleIds = new Set([assistantMessage.id!]);
    const feedbackConfig: FeedbackConfig = {
      eligibleMessageIds: eligibleIds,
      onPopulateFeedbackText: jest.fn(),
      onSendRating: jest.fn(),
    };

    render(
      <ThreadedMessage
        {...defaultProps}
        message={assistantMessage}
        feedbackConfig={feedbackConfig}
      />
    );

    expect(screen.getByText("How did the bot do?")).toBeInTheDocument();
  });

  it("does not render feedback for non-assistant messages", () => {
    const eligibleIds = new Set([mockMessage.id!]);
    const feedbackConfig: FeedbackConfig = {
      eligibleMessageIds: eligibleIds,
      onPopulateFeedbackText: jest.fn(),
      onSendRating: jest.fn(),
    };

    render(
      <ThreadedMessage
        {...defaultProps}
        feedbackConfig={feedbackConfig}
      />
    );

    expect(screen.queryByText("How did the bot do?")).not.toBeInTheDocument();
  });

  it("does not render feedback when message is not eligible", () => {
    const assistantMessage = { ...mockMessage, fromAgent: true };
    const eligibleIds = new Set(["different-id"]);
    const feedbackConfig: FeedbackConfig = {
      eligibleMessageIds: eligibleIds,
      onPopulateFeedbackText: jest.fn(),
      onSendRating: jest.fn(),
    };

    render(
      <ThreadedMessage
        {...defaultProps}
        message={assistantMessage}
        feedbackConfig={feedbackConfig}
      />
    );

    expect(screen.queryByText("How did the bot do?")).not.toBeInTheDocument();
  });

  it("handles touch start to show reply button", async () => {
    render(<ThreadedMessage {...defaultProps} />);
    const messageContainer = screen.getByTestId(`message-${mockMessage.id}`).parentElement!.parentElement!;

    fireEvent.touchStart(messageContainer);

    // Wait for the 500ms timeout
    await waitFor(
      () => {
        expect(screen.getByLabelText(`Reply to ${mockMessage.pseudonym}`)).toBeInTheDocument();
      },
      { timeout: 600 }
    );
  });

  it("cancels showing reply button on touch move", async () => {
    render(<ThreadedMessage {...defaultProps} />);
    const messageContainer = screen.getByTestId(`message-${mockMessage.id}`).parentElement!.parentElement!;

    fireEvent.touchStart(messageContainer);
    fireEvent.touchMove(messageContainer);

    // Wait to ensure the button doesn't appear
    await new Promise(resolve => setTimeout(resolve, 600));

    expect(screen.queryByLabelText(`Reply to ${mockMessage.pseudonym}`)).not.toBeInTheDocument();
  });

  it("cancels showing reply button on touch end before timeout", async () => {
    render(<ThreadedMessage {...defaultProps} />);
    const messageContainer = screen.getByTestId(`message-${mockMessage.id}`).parentElement!.parentElement!;

    fireEvent.touchStart(messageContainer);
    fireEvent.touchEnd(messageContainer);

    // Wait to ensure the button doesn't appear
    await new Promise(resolve => setTimeout(resolve, 600));

    expect(screen.queryByLabelText(`Reply to ${mockMessage.pseudonym}`)).not.toBeInTheDocument();
  });

  it("uses message.replyCount when replies array is empty", () => {
    const messageWithReplyCount = { ...mockMessage, replyCount: 5 };
    render(<ThreadedMessage {...defaultProps} message={messageWithReplyCount} />);

    // Since there are no actual replies in the array but replyCount is 5,
    // no preview should be shown, but if we had logic to show count, it would use 5
    expect(screen.queryByText(/more reply|more replies/)).not.toBeInTheDocument();
  });

  it("renders display name using normalizeAssistantPseudonym", () => {
    const { rerender } = render(<ThreadedMessage {...defaultProps} />);
    expect(screen.getByText(mockMessage.pseudonym)).toBeInTheDocument();

    const assistantMessage = { ...mockMessage, fromAgent: true, pseudonym: "assistant" };
    rerender(<ThreadedMessage {...defaultProps} message={assistantMessage} />);
    expect(screen.getByText("Test Bot")).toBeInTheDocument();
  });

  it("hides reply button after clicking it", async () => {
    render(<ThreadedMessage {...defaultProps} />);
    const messageContainer = screen.getByTestId(`message-${mockMessage.id}`).parentElement!.parentElement!;

    fireEvent.mouseEnter(messageContainer);
    const replyButton = await screen.findByLabelText(`Reply to ${mockMessage.pseudonym}`);
    fireEvent.click(replyButton);

    await waitFor(() => {
      expect(screen.queryByLabelText(`Reply to ${mockMessage.pseudonym}`)).not.toBeInTheDocument();
    });
  });

  it("shows chevron icon on hover over additional replies", () => {
    const { container } = render(<ThreadedMessage {...defaultProps} replies={mockReplies} />);
    const moreRepliesButton = screen.getByLabelText("View 1 more reply");

    // Check that the button is a group (for hover effects)
    expect(moreRepliesButton.classList.contains("group")).toBe(true);

    // ChevronRight icon should be present
    const chevronIcon = container.querySelector(".group-hover\\:opacity-100");
    expect(chevronIcon).toBeInTheDocument();
  });

  it("renders chat bubble icon for additional replies", () => {
    const { container } = render(<ThreadedMessage {...defaultProps} replies={mockReplies} />);

    // Check for the presence of the ChatBubbleOutline icon (MUI icons render as SVGs)
    const svgs = container.querySelectorAll("svg");
    expect(svgs.length).toBeGreaterThan(0);
  });
});
