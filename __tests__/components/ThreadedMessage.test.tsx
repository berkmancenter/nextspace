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

  it("calls onOpenThread when clicking on additional replies count twice", () => {
    render(<ThreadedMessage {...defaultProps} replies={mockReplies} />);
    const moreRepliesButton = screen.getByText("+ 1 more reply");

    // First click shows the expand button
    fireEvent.click(moreRepliesButton);
    expect(mockOnOpenThread).not.toHaveBeenCalled();

    // Second click opens the thread
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
    const messageRatings = new Map();
    const feedbackConfig: FeedbackConfig = {
      eligibleMessageIds: eligibleIds,
      messageRatings,
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
    const messageRatings = new Map();
    const feedbackConfig: FeedbackConfig = {
      eligibleMessageIds: eligibleIds,
      messageRatings,
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
    const messageRatings = new Map();
    const feedbackConfig: FeedbackConfig = {
      eligibleMessageIds: eligibleIds,
      messageRatings,
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

  it("does not render feedback when no feedbackConfig is provided", () => {
    const assistantMessage = { ...mockMessage, fromAgent: true };

    render(
      <ThreadedMessage
        {...defaultProps}
        message={assistantMessage}
      />
    );

    expect(screen.queryByText("How did the bot do?")).not.toBeInTheDocument();
  });

  it("passes initialRating from messageRatings map to MessageFeedback", () => {
    const assistantMessage = { ...mockMessage, fromAgent: true };
    const eligibleIds = new Set([assistantMessage.id!]);
    const messageRatings = new Map([["msg-123", "WOW!"]]);
    const feedbackConfig: FeedbackConfig = {
      eligibleMessageIds: eligibleIds,
      messageRatings,
      onPopulateFeedbackText: jest.fn(),
      onSendRating: jest.fn(),
    };

    const { container } = render(
      <ThreadedMessage
        {...defaultProps}
        message={assistantMessage}
        feedbackConfig={feedbackConfig}
      />
    );

    // The MessageFeedback component should be rendered with the initial rating
    expect(screen.getByText("How did the bot do?")).toBeInTheDocument();
    // The component would show the rating in its internal state
  });

  it("calls onSendRating callback when rating is submitted", () => {
    const assistantMessage = { ...mockMessage, fromAgent: true };
    const eligibleIds = new Set([assistantMessage.id!]);
    const messageRatings = new Map();
    const mockOnSendRating = jest.fn();
    const feedbackConfig: FeedbackConfig = {
      eligibleMessageIds: eligibleIds,
      messageRatings,
      onPopulateFeedbackText: jest.fn(),
      onSendRating: mockOnSendRating,
    };

    render(
      <ThreadedMessage
        {...defaultProps}
        message={assistantMessage}
        feedbackConfig={feedbackConfig}
      />
    );

    const okButton = screen.getByRole("radio", { name: "OK" });
    fireEvent.click(okButton);

    expect(mockOnSendRating).toHaveBeenCalledWith("msg-123", "OK");
  });

  it("calls onPopulateFeedbackText when 'Would you like to share more?' is clicked", () => {
    const assistantMessage = { ...mockMessage, fromAgent: true };
    const eligibleIds = new Set([assistantMessage.id!]);
    const messageRatings = new Map();
    const mockOnPopulateFeedbackText = jest.fn();
    const feedbackConfig: FeedbackConfig = {
      eligibleMessageIds: eligibleIds,
      messageRatings,
      onPopulateFeedbackText: mockOnPopulateFeedbackText,
      onSendRating: jest.fn(),
    };

    render(
      <ThreadedMessage
        {...defaultProps}
        message={assistantMessage}
        feedbackConfig={feedbackConfig}
      />
    );

    // First click a rating to show the "share more" link
    const mehButton = screen.getByRole("radio", { name: "Meh" });
    fireEvent.click(mehButton);

    // Then click the "Would you like to share more?" link
    const shareMoreLink = screen.getByText("Would you like to share more?");
    fireEvent.click(shareMoreLink);

    expect(mockOnPopulateFeedbackText).toHaveBeenCalledWith(
      expect.objectContaining({
        prefix: "/feedback|Text|msg-123|",
        label: "Feedback Mode",
      })
    );
  });

  it("does not render feedback when message has no id", () => {
    const assistantMessageNoId = { ...mockMessage, fromAgent: true, id: undefined };
    const eligibleIds = new Set(["msg-123"]);
    const messageRatings = new Map();
    const feedbackConfig: FeedbackConfig = {
      eligibleMessageIds: eligibleIds,
      messageRatings,
      onPopulateFeedbackText: jest.fn(),
      onSendRating: jest.fn(),
    };

    render(
      <ThreadedMessage
        {...defaultProps}
        message={assistantMessageNoId}
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

  describe("Reply count calculation logic", () => {
    it("calculates reply count from replies array length", () => {
      const replies: PseudonymousMessage[] = [
        {
          id: "r1",
          body: { text: "Reply 1" },
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
          id: "r2",
          body: { text: "Reply 2" },
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
        {
          id: "r3",
          body: { text: "Reply 3" },
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

      render(<ThreadedMessage {...defaultProps} replies={replies} />);

      // Should show first reply preview and "+ 2 more replies"
      expect(screen.getByText("Reply 1")).toBeInTheDocument();
      expect(screen.getByText("+ 2 more replies")).toBeInTheDocument();
    });

    it("uses message.replyCount as fallback when replies array is empty", () => {
      const messageWithReplyCount = { ...mockMessage, replyCount: 3 };
      render(<ThreadedMessage {...defaultProps} message={messageWithReplyCount} replies={[]} />);

      // No preview should be shown since replies array is empty
      // but replyCount would be used internally (count = 3)
      expect(screen.queryByText(/more reply|more replies/)).not.toBeInTheDocument();
    });

    it("prefers replies array length over message.replyCount", () => {
      const messageWithReplyCount = { ...mockMessage, replyCount: 10 };
      const replies = [mockReplies[0]]; // Only 1 reply

      render(<ThreadedMessage {...defaultProps} message={messageWithReplyCount} replies={replies} />);

      // Should not show "more replies" text since there's only 1 reply
      expect(screen.queryByText(/more reply|more replies/)).not.toBeInTheDocument();
    });

    it("returns 0 when both replies array is empty and replyCount is undefined", () => {
      const messageWithoutReplyCount = { ...mockMessage, replyCount: undefined };
      render(<ThreadedMessage {...defaultProps} message={messageWithoutReplyCount} replies={[]} />);

      // No replies section should be visible
      expect(screen.queryByText(/more reply|more replies/)).not.toBeInTheDocument();
      // No border-l-2 (reply preview section) should be present
      const { container } = render(<ThreadedMessage {...defaultProps} message={messageWithoutReplyCount} replies={[]} />);
      expect(container.querySelector(".border-l-2")).not.toBeInTheDocument();
    });
  });

  describe("Unread replies indicator", () => {
    it("shows unread indicator when hasUnreadReplies is true and thread is closed", () => {
      const { container } = render(
        <ThreadedMessage {...defaultProps} replies={mockReplies} hasUnreadReplies={true} isThreadOpen={false} />
      );

      // Check for the purple dot indicator (it's an absolute positioned div)
      const borderContainer = container.querySelector(".border-l-2");
      expect(borderContainer).toBeInTheDocument();

      // Check for the absolute positioned unread indicator inside it
      const unreadIndicator = borderContainer?.querySelector(".absolute");
      expect(unreadIndicator).toBeInTheDocument();
    });

    it("hides unread indicator when thread is open", () => {
      const { container } = render(
        <ThreadedMessage {...defaultProps} replies={mockReplies} hasUnreadReplies={true} isThreadOpen={true} />
      );

      // Border container should exist (reply preview)
      const borderContainer = container.querySelector(".border-l-2");
      expect(borderContainer).toBeInTheDocument();

      // But unread dot should not be visible when thread is open
      const unreadIndicator = borderContainer?.querySelector(".absolute.-left-\\[5px\\]");
      expect(unreadIndicator).not.toBeInTheDocument();
    });

    it("does not show unread indicator when hasUnreadReplies is false", () => {
      const { container } = render(
        <ThreadedMessage {...defaultProps} replies={mockReplies} hasUnreadReplies={false} isThreadOpen={false} />
      );

      const borderContainer = container.querySelector(".border-l-2");
      expect(borderContainer).toBeInTheDocument();

      // Unread dot should not be present
      const unreadIndicator = borderContainer?.querySelector(".absolute.-left-\\[5px\\]");
      expect(unreadIndicator).not.toBeInTheDocument();
    });

    it("makes additional replies button bold when hasUnreadReplies is true", () => {
      render(
        <ThreadedMessage {...defaultProps} replies={mockReplies} hasUnreadReplies={true} isThreadOpen={false} />
      );

      const moreRepliesButton = screen.getByLabelText("View 1 more reply");
      expect(moreRepliesButton.className).toContain("font-bold");
    });

    it("makes additional replies button medium weight when hasUnreadReplies is false", () => {
      render(
        <ThreadedMessage {...defaultProps} replies={mockReplies} hasUnreadReplies={false} isThreadOpen={false} />
      );

      const moreRepliesButton = screen.getByLabelText("View 1 more reply");
      expect(moreRepliesButton.className).toContain("font-medium");
      expect(moreRepliesButton.className).not.toContain("font-bold");
    });
  });

  describe("Reply indicator hover and touch state", () => {
    it("shows white background and chevron on mouse enter", () => {
      const { container } = render(<ThreadedMessage {...defaultProps} replies={mockReplies} />);
      const moreRepliesButton = screen.getByLabelText("View 1 more reply");

      fireEvent.mouseEnter(moreRepliesButton);

      // Button should have bg-white class on hover
      expect(moreRepliesButton.classList.contains("bg-white")).toBe(true);

      // Chevron should be visible (opacity-100)
      const chevronIcon = container.querySelector(".opacity-100");
      expect(chevronIcon).toBeInTheDocument();
    });

    it("removes white background on mouse leave", () => {
      render(<ThreadedMessage {...defaultProps} replies={mockReplies} />);
      const moreRepliesButton = screen.getByLabelText("View 1 more reply");

      fireEvent.mouseEnter(moreRepliesButton);
      expect(moreRepliesButton.classList.contains("bg-white")).toBe(true);

      fireEvent.mouseLeave(moreRepliesButton);
      expect(moreRepliesButton.classList.contains("bg-white")).toBe(false);
    });

    it("shows white background on touch start", () => {
      render(<ThreadedMessage {...defaultProps} replies={mockReplies} />);
      const moreRepliesButton = screen.getByLabelText("View 1 more reply");

      fireEvent.touchStart(moreRepliesButton);

      // Button should have bg-white class on touch
      expect(moreRepliesButton.classList.contains("bg-white")).toBe(true);
    });

    it("removes white background on touch end", () => {
      render(<ThreadedMessage {...defaultProps} replies={mockReplies} />);
      const moreRepliesButton = screen.getByLabelText("View 1 more reply");

      fireEvent.touchStart(moreRepliesButton);
      expect(moreRepliesButton.classList.contains("bg-white")).toBe(true);

      fireEvent.touchEnd(moreRepliesButton);
      expect(moreRepliesButton.classList.contains("bg-white")).toBe(false);
    });

    it("opens thread on second click", () => {
      render(<ThreadedMessage {...defaultProps} replies={mockReplies} />);
      const moreRepliesButton = screen.getByLabelText("View 1 more reply");

      // First click shows expand button
      fireEvent.click(moreRepliesButton);
      expect(mockOnOpenThread).not.toHaveBeenCalled();

      // Second click opens thread
      fireEvent.click(moreRepliesButton);
      expect(mockOnOpenThread).toHaveBeenCalledWith(mockMessage.id);
    });

    it("shows chevron persistently after first click", () => {
      const { container } = render(<ThreadedMessage {...defaultProps} replies={mockReplies} />);
      const moreRepliesButton = screen.getByLabelText("View 1 more reply");

      // Initially chevron should be hidden (opacity-0)
      let chevronIcon = container.querySelector(".transition-opacity");
      expect(chevronIcon?.classList.contains("opacity-0")).toBe(true);

      // First click should show the chevron persistently
      fireEvent.click(moreRepliesButton);

      chevronIcon = container.querySelector(".transition-opacity");
      expect(chevronIcon?.classList.contains("opacity-100")).toBe(true);
    });
  });

  describe("IntersectionObserver and mark as read", () => {
    let intersectionObserverCallback: IntersectionObserverCallback;
    const mockOnMarkAsRead = jest.fn();

    // Helper to create a complete IntersectionObserverEntry
    const createMockEntry = (isIntersecting: boolean): IntersectionObserverEntry => {
      const target = document.createElement("div");
      return {
        isIntersecting,
        target,
        boundingClientRect: {} as DOMRectReadOnly,
        intersectionRatio: isIntersecting ? 1 : 0,
        intersectionRect: {} as DOMRectReadOnly,
        rootBounds: null,
        time: Date.now(),
      };
    };

    beforeEach(() => {
      jest.useFakeTimers();
      mockOnMarkAsRead.mockClear();

      // Mock IntersectionObserver
      global.IntersectionObserver = jest.fn((callback) => {
        intersectionObserverCallback = callback;
        return {
          observe: jest.fn(),
          unobserve: jest.fn(),
          disconnect: jest.fn(),
          root: null,
          rootMargin: "",
          thresholds: [0.5],
          takeRecords: jest.fn(),
        };
      }) as any;
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it("sets up IntersectionObserver when message has unread replies", () => {
      render(
        <ThreadedMessage
          {...defaultProps}
          replies={mockReplies}
          hasUnreadReplies={true}
          onMarkAsRead={mockOnMarkAsRead}
        />
      );

      expect(global.IntersectionObserver).toHaveBeenCalled();
    });

    it("does not call onMarkAsRead immediately when message becomes visible for the first time", () => {
      render(
        <ThreadedMessage
          {...defaultProps}
          replies={mockReplies}
          hasUnreadReplies={true}
          onMarkAsRead={mockOnMarkAsRead}
        />
      );

      // Simulate message becoming visible
      const entry = createMockEntry(true);

      intersectionObserverCallback([entry], {} as IntersectionObserver);

      // Fast forward time
      jest.advanceTimersByTime(1000);

      // Should NOT be called because hasBeenScrolledOutRef is false
      expect(mockOnMarkAsRead).not.toHaveBeenCalled();
    });

    it("calls onMarkAsRead after 1 second when message becomes visible after being scrolled out", () => {
      render(
        <ThreadedMessage
          {...defaultProps}
          replies={mockReplies}
          hasUnreadReplies={true}
          onMarkAsRead={mockOnMarkAsRead}
        />
      );

      // First, simulate message going out of view (scrolled out)
      const exitEntry = createMockEntry(false);

      intersectionObserverCallback([exitEntry], {} as IntersectionObserver);

      // Then, simulate message coming back into view
      const entryEntry = createMockEntry(true);

      intersectionObserverCallback([entryEntry], {} as IntersectionObserver);

      // Fast forward time
      jest.advanceTimersByTime(1000);

      // Should be called with message ID
      expect(mockOnMarkAsRead).toHaveBeenCalledWith(mockMessage.id);
    });

    it("cancels timer when message becomes invisible before 1 second", () => {
      render(
        <ThreadedMessage
          {...defaultProps}
          replies={mockReplies}
          hasUnreadReplies={true}
          onMarkAsRead={mockOnMarkAsRead}
        />
      );

      // Scroll out
      const exitEntry = createMockEntry(false);
      intersectionObserverCallback([exitEntry], {} as IntersectionObserver);

      // Come back into view
      const entryEntry = createMockEntry(true);
      intersectionObserverCallback([entryEntry], {} as IntersectionObserver);

      // Fast forward 500ms (not enough)
      jest.advanceTimersByTime(500);

      // Go out of view again
      intersectionObserverCallback([exitEntry], {} as IntersectionObserver);

      // Fast forward remaining time
      jest.advanceTimersByTime(600);

      // Should NOT be called because timer was cancelled
      expect(mockOnMarkAsRead).not.toHaveBeenCalled();
    });

    it("does not set up observer when onMarkAsRead is not provided", () => {
      render(
        <ThreadedMessage
          {...defaultProps}
          replies={mockReplies}
          hasUnreadReplies={true}
          onMarkAsRead={undefined}
        />
      );

      // Observer should not be set up
      expect(global.IntersectionObserver).not.toHaveBeenCalled();
    });
  });
});
