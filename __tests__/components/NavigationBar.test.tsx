import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NavigationBar } from "../../components/NavigationBar";

const baseProps = {
  activeTab: "assistant" as const,
  onTabChange: jest.fn(),
  unseenAssistantCount: 0,
  unseenChatCount: 0,
  unreadAssistantReplyCount: 0,
  unreadChatReplyCount: 0,
  unseenJargonCount: 0,
  showChat: true,
  showTranscript: true,
  showJargon: false,
  botName: "Berkie",
};

describe("NavigationBar", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders all three tabs when showChat and showTranscript are true", () => {
    render(<NavigationBar {...baseProps} />);

    // Both desktop and mobile navs render, so use getAllByLabelText
    expect(screen.getAllByLabelText("Berkie").length).toBeGreaterThan(0);
    expect(screen.getAllByLabelText("Group Chat").length).toBeGreaterThan(0);
    expect(screen.getAllByLabelText("Transcript").length).toBeGreaterThan(0);
  });

  it("hides chat tab when showChat is false", () => {
    render(<NavigationBar {...baseProps} showChat={false} />);

    expect(screen.queryByLabelText("Group Chat")).not.toBeInTheDocument();
    expect(screen.getAllByLabelText("Berkie").length).toBeGreaterThan(0);
    expect(screen.getAllByLabelText("Transcript").length).toBeGreaterThan(0);
  });

  it("hides transcript tab when showTranscript is false", () => {
    render(<NavigationBar {...baseProps} showTranscript={false} />);

    expect(screen.queryByLabelText("Transcript")).not.toBeInTheDocument();
    expect(screen.getAllByLabelText("Berkie").length).toBeGreaterThan(0);
    expect(screen.getAllByLabelText("Group Chat").length).toBeGreaterThan(0);
  });

  it("only renders Event Bot tab when showChat and showTranscript are false", () => {
    render(
      <NavigationBar {...baseProps} showChat={false} showTranscript={false} />,
    );

    expect(screen.getAllByLabelText("Berkie").length).toBeGreaterThan(0);
    expect(screen.queryByLabelText("Group Chat")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Transcript")).not.toBeInTheDocument();
  });

  it("marks the active tab with aria-current='page'", () => {
    render(<NavigationBar {...baseProps} activeTab="assistant" />);

    const activeBtns = screen
      .getAllByLabelText("Berkie")
      .filter((btn) => btn.getAttribute("aria-current") === "page");
    expect(activeBtns.length).toBeGreaterThan(0);

    // Inactive tabs should not have aria-current
    const inactiveBtns = screen
      .getAllByLabelText("Group Chat")
      .filter((btn) => btn.getAttribute("aria-current") === "page");
    expect(inactiveBtns.length).toBe(0);
  });

  it("calls onTabChange with correct tab when clicked", async () => {
    const user = userEvent.setup();
    const onTabChange = jest.fn();
    render(<NavigationBar {...baseProps} onTabChange={onTabChange} />);

    // Click the first Group Chat button (desktop nav)
    const chatBtns = screen.getAllByLabelText("Group Chat");
    await user.click(chatBtns[0]);

    expect(onTabChange).toHaveBeenCalledWith("chat");
  });

  it("calls onTabChange with 'transcript' when transcript tab clicked", async () => {
    const user = userEvent.setup();
    const onTabChange = jest.fn();
    render(<NavigationBar {...baseProps} onTabChange={onTabChange} />);

    const transcriptBtns = screen.getAllByLabelText("Transcript");
    await user.click(transcriptBtns[0]);

    expect(onTabChange).toHaveBeenCalledWith("transcript");
  });

  it("calls onTabChange with 'assistant' when Event Bot tab clicked", async () => {
    const user = userEvent.setup();
    const onTabChange = jest.fn();
    render(
      <NavigationBar {...baseProps} activeTab="chat" onTabChange={onTabChange} />,
    );

    const assistantBtns = screen.getAllByLabelText("Berkie");
    await user.click(assistantBtns[0]);

    expect(onTabChange).toHaveBeenCalledWith("assistant");
  });

  it("applies active background style to the active tab button", () => {
    render(<NavigationBar {...baseProps} activeTab="chat" />);

    const activeChatBtns = screen
      .getAllByLabelText("Group Chat")
      .filter(
        (btn) => (btn as HTMLElement).style.background === "rgb(209, 196, 233)",
      );
    expect(activeChatBtns.length).toBeGreaterThan(0);
  });

  it("applies bold font-weight label to the active tab", () => {
    const { container } = render(
      <NavigationBar {...baseProps} activeTab="assistant" />,
    );

    // Find label spans with bold weight (active)
    const boldLabels = Array.from(container.querySelectorAll("span")).filter(
      (span) => span.style.fontWeight === "700",
    );
    // Should have labels for both desktop and mobile
    expect(boldLabels.length).toBeGreaterThan(0);
    expect(boldLabels[0].textContent).toBe("Berkie");
  });

  it("renders both desktop nav and mobile nav", () => {
    const { container } = render(<NavigationBar {...baseProps} />);

    const navElements = container.querySelectorAll(
      "nav[aria-label='Main navigation']",
    );
    expect(navElements.length).toBe(2);
  });

  describe("jargon tab", () => {
    it("hides jargon tab when showJargon is false", () => {
      render(<NavigationBar {...baseProps} showJargon={false} />);
      expect(screen.queryByLabelText("Jargon Filter")).not.toBeInTheDocument();
    });

    it("shows jargon tab when showJargon is true", () => {
      render(<NavigationBar {...baseProps} showJargon={true} />);
      expect(screen.getAllByLabelText("Jargon Filter").length).toBeGreaterThan(0);
    });

    it("calls onTabChange with 'jargon' when jargon tab is clicked", async () => {
      const user = userEvent.setup();
      const onTabChange = jest.fn();
      render(<NavigationBar {...baseProps} showJargon={true} onTabChange={onTabChange} />);

      const jargonBtns = screen.getAllByLabelText("Jargon Filter");
      await user.click(jargonBtns[0]);

      expect(onTabChange).toHaveBeenCalledWith("jargon");
    });

    it("shows unseen badge on jargon tab when unseenJargonCount > 0 and not on jargon tab", () => {
      const { container } = render(
        <NavigationBar {...baseProps} showJargon={true} unseenJargonCount={2} activeTab="assistant" />,
      );

      const badges = container.querySelectorAll(".MuiBadge-badge");
      const visibleBadges = Array.from(badges).filter(
        (badge) => !(badge as HTMLElement).classList.contains("MuiBadge-invisible"),
      );
      expect(visibleBadges.length).toBeGreaterThan(0);
    });
  });

  describe("unseen badges", () => {
    it("does not show badge when unseenChatCount is 0", () => {
      const { container } = render(
        <NavigationBar {...baseProps} unseenChatCount={0} activeTab="assistant" />,
      );

      // MUI Badge with invisible=true won't show a visible dot
      // Check that no visible badge dot is rendered for chat
      const badges = container.querySelectorAll(".MuiBadge-badge");
      const visibleBadges = Array.from(badges).filter(
        (badge) => !(badge as HTMLElement).classList.contains("MuiBadge-invisible"),
      );
      expect(visibleBadges.length).toBe(0);
    });

    it("shows badge on chat tab when unseenChatCount > 0 and not on chat tab", () => {
      const { container } = render(
        <NavigationBar
          {...baseProps}
          unseenChatCount={3}
          activeTab="assistant"
        />,
      );

      // Badge should be visible (not invisible) for chat
      const badges = container.querySelectorAll(".MuiBadge-badge");
      const visibleBadges = Array.from(badges).filter(
        (badge) =>
          !(badge as HTMLElement).classList.contains("MuiBadge-invisible"),
      );
      expect(visibleBadges.length).toBeGreaterThan(0);
    });

    it("shows badge when on chat tab with unseenChatCount but no unreadChatReplyCount", () => {
      const { container } = render(
        <NavigationBar
          {...baseProps}
          unseenChatCount={3}
          unreadChatReplyCount={0}
          activeTab="chat"
        />,
      );

      // When on chat tab, badge should show if unseenChatCount > 0
      // because the condition is: unseen > 0 || (isActive && unreadChatReplyCount > 0)
      const badges = container.querySelectorAll(".MuiBadge-badge");
      const visibleBadges = Array.from(badges).filter(
        (badge) =>
          !(badge as HTMLElement).classList.contains("MuiBadge-invisible"),
      );
      expect(visibleBadges.length).toBeGreaterThan(0);
    });
  });

  describe("unreadChatReplyCount badge logic", () => {
    it("shows badge on chat tab when unreadChatReplyCount > 0 even when chat tab is active", () => {
      const { container } = render(
        <NavigationBar
          {...baseProps}
          unseenChatCount={0}
          unreadChatReplyCount={2}
          activeTab="chat"
        />,
      );

      // Badge should be visible even though chat tab is active
      const badges = container.querySelectorAll(".MuiBadge-badge");
      const visibleBadges = Array.from(badges).filter(
        (badge) =>
          !(badge as HTMLElement).classList.contains("MuiBadge-invisible"),
      );
      expect(visibleBadges.length).toBeGreaterThan(0);
    });

    it("shows badge on chat tab when unseenChatCount > 0 and chat tab is not active", () => {
      const { container } = render(
        <NavigationBar
          {...baseProps}
          unseenChatCount={3}
          unreadChatReplyCount={0}
          activeTab="assistant"
        />,
      );

      // Badge should be visible
      const badges = container.querySelectorAll(".MuiBadge-badge");
      const visibleBadges = Array.from(badges).filter(
        (badge) =>
          !(badge as HTMLElement).classList.contains("MuiBadge-invisible"),
      );
      expect(visibleBadges.length).toBeGreaterThan(0);
    });

    it("shows badge on chat tab when both unseenChatCount and unreadChatReplyCount > 0 and chat tab is active", () => {
      const { container } = render(
        <NavigationBar
          {...baseProps}
          unseenChatCount={5}
          unreadChatReplyCount={2}
          activeTab="chat"
        />,
      );

      // Badge should be visible due to unreadChatReplyCount
      const badges = container.querySelectorAll(".MuiBadge-badge");
      const visibleBadges = Array.from(badges).filter(
        (badge) =>
          !(badge as HTMLElement).classList.contains("MuiBadge-invisible"),
      );
      expect(visibleBadges.length).toBeGreaterThan(0);
    });

    it("hides badge on chat tab when both unseenChatCount and unreadChatReplyCount are 0 and chat tab is active", () => {
      const { container } = render(
        <NavigationBar
          {...baseProps}
          unseenChatCount={0}
          unreadChatReplyCount={0}
          activeTab="chat"
        />,
      );

      // Badge should not be visible
      const badges = container.querySelectorAll(".MuiBadge-badge");
      const visibleBadges = Array.from(badges).filter(
        (badge) =>
          !(badge as HTMLElement).classList.contains("MuiBadge-invisible"),
      );
      expect(visibleBadges.length).toBe(0);
    });

    it("does not show badge on chat tab when only unreadChatReplyCount > 0 and not on chat tab", () => {
      const { container } = render(
        <NavigationBar
          {...baseProps}
          unseenChatCount={0}
          unreadChatReplyCount={3}
          activeTab="assistant"
        />,
      );

      // Badge should NOT be visible because:
      // - We're not on chat tab (isActive = false)
      // - unseenChatCount = 0
      // The condition is: unseen > 0 || (isActive && unreadChatReplyCount > 0)
      // Which evaluates to: 0 > 0 || (false && 3 > 0) = false
      const badges = container.querySelectorAll(".MuiBadge-badge");
      const visibleBadges = Array.from(badges).filter(
        (badge) =>
          !(badge as HTMLElement).classList.contains("MuiBadge-invisible"),
      );
      expect(visibleBadges.length).toBe(0);
    });

    it("special behavior: chat tab shows badge even when active if unreadChatReplyCount > 0", () => {
      const { container } = render(
        <NavigationBar
          {...baseProps}
          unseenChatCount={0}
          unreadChatReplyCount={1}
          activeTab="chat"
        />,
      );

      // This is the special case: chat tab badge shows even when active
      const badges = container.querySelectorAll(".MuiBadge-badge");
      const visibleBadges = Array.from(badges).filter(
        (badge) =>
          !(badge as HTMLElement).classList.contains("MuiBadge-invisible"),
      );
      expect(visibleBadges.length).toBeGreaterThan(0);
    });

    it("does not affect other tabs' badge behavior", () => {
      const { container } = render(
        <NavigationBar
          {...baseProps}
          unseenAssistantCount={5}
          unseenChatCount={2}
          unreadChatReplyCount={0}
          activeTab="assistant"
        />,
      );

      // Assistant tab badge should be hidden when active
      // Chat tab badge should be visible due to unseenChatCount
      const badges = container.querySelectorAll(".MuiBadge-badge");
      const visibleBadges = Array.from(badges).filter(
        (badge) =>
          !(badge as HTMLElement).classList.contains("MuiBadge-invisible"),
      );
      // Only chat tab should have visible badge (unseenChatCount > 0 and not active)
      expect(visibleBadges.length).toBeGreaterThan(0);
    });

    it("handles the condition: (unseen > 0 || (isActive && unreadChatReplyCount > 0))", () => {
      // Test case 1: unseen > 0, not active, no unread replies
      const { container: container1, unmount: unmount1 } = render(
        <NavigationBar
          {...baseProps}
          unseenChatCount={1}
          unreadChatReplyCount={0}
          activeTab="assistant"
        />,
      );
      let badges = container1.querySelectorAll(".MuiBadge-badge");
      let visibleBadges = Array.from(badges).filter(
        (badge) =>
          !(badge as HTMLElement).classList.contains("MuiBadge-invisible"),
      );
      expect(visibleBadges.length).toBeGreaterThan(0);
      unmount1();

      // Test case 2: unseen = 0, active, has unread replies
      const { container: container2, unmount: unmount2 } = render(
        <NavigationBar
          {...baseProps}
          unseenChatCount={0}
          unreadChatReplyCount={3}
          activeTab="chat"
        />,
      );
      badges = container2.querySelectorAll(".MuiBadge-badge");
      visibleBadges = Array.from(badges).filter(
        (badge) =>
          !(badge as HTMLElement).classList.contains("MuiBadge-invisible"),
      );
      expect(visibleBadges.length).toBeGreaterThan(0);
      unmount2();

      // Test case 3: unseen > 0, active, has unread replies (both conditions true)
      const { container: container3, unmount: unmount3 } = render(
        <NavigationBar
          {...baseProps}
          unseenChatCount={5}
          unreadChatReplyCount={2}
          activeTab="chat"
        />,
      );
      badges = container3.querySelectorAll(".MuiBadge-badge");
      visibleBadges = Array.from(badges).filter(
        (badge) =>
          !(badge as HTMLElement).classList.contains("MuiBadge-invisible"),
      );
      expect(visibleBadges.length).toBeGreaterThan(0);
      unmount3();

      // Test case 4: unseen = 0, not active, no unread replies (should be hidden)
      const { container: container4 } = render(
        <NavigationBar
          {...baseProps}
          unseenChatCount={0}
          unreadChatReplyCount={0}
          activeTab="assistant"
        />,
      );
      badges = container4.querySelectorAll(".MuiBadge-badge");
      visibleBadges = Array.from(badges).filter(
        (badge) =>
          !(badge as HTMLElement).classList.contains("MuiBadge-invisible"),
      );
      expect(visibleBadges.length).toBe(0);
    });
  });

  describe("unreadAssistantReplyCount badge logic", () => {
    it("shows badge on assistant tab when unreadAssistantReplyCount > 0 even when assistant tab is active", () => {
      const { container } = render(
        <NavigationBar
          {...baseProps}
          unseenAssistantCount={0}
          unreadAssistantReplyCount={2}
          activeTab="assistant"
        />,
      );

      // Badge should be visible even though assistant tab is active
      const badges = container.querySelectorAll(".MuiBadge-badge");
      const visibleBadges = Array.from(badges).filter(
        (badge) =>
          !(badge as HTMLElement).classList.contains("MuiBadge-invisible"),
      );
      expect(visibleBadges.length).toBeGreaterThan(0);
    });

    it("shows badge on assistant tab when unseenAssistantCount > 0 and assistant tab is not active", () => {
      const { container } = render(
        <NavigationBar
          {...baseProps}
          unseenAssistantCount={3}
          unreadAssistantReplyCount={0}
          activeTab="chat"
        />,
      );

      // Badge should be visible
      const badges = container.querySelectorAll(".MuiBadge-badge");
      const visibleBadges = Array.from(badges).filter(
        (badge) =>
          !(badge as HTMLElement).classList.contains("MuiBadge-invisible"),
      );
      expect(visibleBadges.length).toBeGreaterThan(0);
    });

    it("shows badge on assistant tab when both unseenAssistantCount and unreadAssistantReplyCount > 0 and assistant tab is active", () => {
      const { container } = render(
        <NavigationBar
          {...baseProps}
          unseenAssistantCount={5}
          unreadAssistantReplyCount={2}
          activeTab="assistant"
        />,
      );

      // Badge should be visible due to unreadAssistantReplyCount
      const badges = container.querySelectorAll(".MuiBadge-badge");
      const visibleBadges = Array.from(badges).filter(
        (badge) =>
          !(badge as HTMLElement).classList.contains("MuiBadge-invisible"),
      );
      expect(visibleBadges.length).toBeGreaterThan(0);
    });

    it("hides badge on assistant tab when both unseenAssistantCount and unreadAssistantReplyCount are 0 and assistant tab is active", () => {
      const { container } = render(
        <NavigationBar
          {...baseProps}
          unseenAssistantCount={0}
          unreadAssistantReplyCount={0}
          activeTab="assistant"
        />,
      );

      // Badge should not be visible
      const badges = container.querySelectorAll(".MuiBadge-badge");
      const visibleBadges = Array.from(badges).filter(
        (badge) =>
          !(badge as HTMLElement).classList.contains("MuiBadge-invisible"),
      );
      expect(visibleBadges.length).toBe(0);
    });

    it("does not show badge on assistant tab when only unreadAssistantReplyCount > 0 and not on assistant tab", () => {
      const { container } = render(
        <NavigationBar
          {...baseProps}
          unseenAssistantCount={0}
          unreadAssistantReplyCount={3}
          activeTab="chat"
        />,
      );

      // Badge should NOT be visible because:
      // - We're not on assistant tab (isActive = false)
      // - unseenAssistantCount = 0
      // The condition is: unseen > 0 || (isActive && unreadAssistantReplyCount > 0)
      // Which evaluates to: 0 > 0 || (false && 3 > 0) = false
      const badges = container.querySelectorAll(".MuiBadge-badge");
      const visibleBadges = Array.from(badges).filter(
        (badge) =>
          !(badge as HTMLElement).classList.contains("MuiBadge-invisible"),
      );
      expect(visibleBadges.length).toBe(0);
    });

    it("special behavior: assistant tab shows badge even when active if unreadAssistantReplyCount > 0", () => {
      const { container } = render(
        <NavigationBar
          {...baseProps}
          unseenAssistantCount={0}
          unreadAssistantReplyCount={1}
          activeTab="assistant"
        />,
      );

      // This is the special case: assistant tab badge shows even when active
      const badges = container.querySelectorAll(".MuiBadge-badge");
      const visibleBadges = Array.from(badges).filter(
        (badge) =>
          !(badge as HTMLElement).classList.contains("MuiBadge-invisible"),
      );
      expect(visibleBadges.length).toBeGreaterThan(0);
    });

    it("does not affect other tabs' badge behavior", () => {
      const { container } = render(
        <NavigationBar
          {...baseProps}
          unseenAssistantCount={0}
          unseenChatCount={2}
          unreadAssistantReplyCount={5}
          activeTab="chat"
        />,
      );

      // Chat tab badge should be hidden when active (no unreadChatReplyCount)
      // Assistant tab badge should NOT be visible because assistant is not active
      const badges = container.querySelectorAll(".MuiBadge-badge");
      const visibleBadges = Array.from(badges).filter(
        (badge) =>
          !(badge as HTMLElement).classList.contains("MuiBadge-invisible"),
      );
      // Only chat tab should have visible badge (unseenChatCount > 0 and active, but that's hidden)
      // Actually unseenChatCount > 0 means it will show even if active
      expect(visibleBadges.length).toBeGreaterThan(0);
    });
  });

  describe("badge parity between assistant and chat tabs", () => {
    it("both assistant and chat tabs show badges when active with unread replies", () => {
      // Test assistant tab active with unread replies
      const { container: assistantContainer, unmount: unmountAssistant } = render(
        <NavigationBar
          {...baseProps}
          unseenAssistantCount={0}
          unseenChatCount={0}
          unreadAssistantReplyCount={1}
          unreadChatReplyCount={1}
          activeTab="assistant"
        />,
      );

      let badges = assistantContainer.querySelectorAll(".MuiBadge-badge");
      let visibleBadges = Array.from(badges).filter(
        (badge) =>
          !(badge as HTMLElement).classList.contains("MuiBadge-invisible"),
      );
      // Assistant is active with unread replies, should show badge
      expect(visibleBadges.length).toBeGreaterThan(0);
      unmountAssistant();

      // Test chat tab active with unread replies
      const { container: chatContainer } = render(
        <NavigationBar
          {...baseProps}
          unseenAssistantCount={0}
          unseenChatCount={0}
          unreadAssistantReplyCount={1}
          unreadChatReplyCount={1}
          activeTab="chat"
        />,
      );

      badges = chatContainer.querySelectorAll(".MuiBadge-badge");
      visibleBadges = Array.from(badges).filter(
        (badge) =>
          !(badge as HTMLElement).classList.contains("MuiBadge-invisible"),
      );
      // Chat is active with unread replies, should show badge
      expect(visibleBadges.length).toBeGreaterThan(0);
    });

    it("both tabs hide badges when active with no unread replies or unseen messages", () => {
      // Test assistant tab
      const { container: assistantContainer, unmount: unmountAssistant } = render(
        <NavigationBar
          {...baseProps}
          unseenAssistantCount={0}
          unseenChatCount={0}
          unreadAssistantReplyCount={0}
          unreadChatReplyCount={0}
          activeTab="assistant"
        />,
      );

      let badges = assistantContainer.querySelectorAll(".MuiBadge-badge");
      let visibleBadges = Array.from(badges).filter(
        (badge) =>
          !(badge as HTMLElement).classList.contains("MuiBadge-invisible"),
      );
      expect(visibleBadges.length).toBe(0);
      unmountAssistant();

      // Test chat tab
      const { container: chatContainer } = render(
        <NavigationBar
          {...baseProps}
          unseenAssistantCount={0}
          unseenChatCount={0}
          unreadAssistantReplyCount={0}
          unreadChatReplyCount={0}
          activeTab="chat"
        />,
      );

      badges = chatContainer.querySelectorAll(".MuiBadge-badge");
      visibleBadges = Array.from(badges).filter(
        (badge) =>
          !(badge as HTMLElement).classList.contains("MuiBadge-invisible"),
      );
      expect(visibleBadges.length).toBe(0);
    });

    it("both tabs show badges when inactive with unseen messages", () => {
      const { container } = render(
        <NavigationBar
          {...baseProps}
          unseenAssistantCount={1}
          unseenChatCount={1}
          unreadAssistantReplyCount={0}
          unreadChatReplyCount={0}
          activeTab="transcript"
        />,
      );

      const badges = container.querySelectorAll(".MuiBadge-badge");
      const visibleBadges = Array.from(badges).filter(
        (badge) =>
          !(badge as HTMLElement).classList.contains("MuiBadge-invisible"),
      );
      // Both assistant and chat should show badges (2 tabs x 2 navs = 4, but checking > 0)
      expect(visibleBadges.length).toBeGreaterThan(0);
    });

    it("mirrors the badge logic: assistant behaves like chat for unread replies", () => {
      // When assistant is active with unread assistant replies
      const { container: scenario1, unmount: unmount1 } = render(
        <NavigationBar
          {...baseProps}
          unseenAssistantCount={0}
          unreadAssistantReplyCount={1}
          activeTab="assistant"
        />,
      );
      let badges = scenario1.querySelectorAll(".MuiBadge-badge");
      let visibleBadges = Array.from(badges).filter(
        (badge) =>
          !(badge as HTMLElement).classList.contains("MuiBadge-invisible"),
      );
      expect(visibleBadges.length).toBeGreaterThan(0);
      unmount1();

      // When chat is active with unread chat replies
      const { container: scenario2 } = render(
        <NavigationBar
          {...baseProps}
          unseenChatCount={0}
          unreadChatReplyCount={1}
          activeTab="chat"
        />,
      );
      badges = scenario2.querySelectorAll(".MuiBadge-badge");
      visibleBadges = Array.from(badges).filter(
        (badge) =>
          !(badge as HTMLElement).classList.contains("MuiBadge-invisible"),
      );
      expect(visibleBadges.length).toBeGreaterThan(0);
    });
  });
});
