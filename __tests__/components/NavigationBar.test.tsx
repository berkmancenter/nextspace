import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NavigationBar } from "../../components/NavigationBar";

const baseProps = {
  activeTab: "assistant" as const,
  onTabChange: jest.fn(),
  unseenAssistantCount: 0,
  unseenChatCount: 0,
  showChat: true,
  showTranscript: true,
};

describe("NavigationBar", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders all three tabs when showChat and showTranscript are true", () => {
    render(<NavigationBar {...baseProps} />);

    // Both desktop and mobile navs render, so use getAllByLabelText
    expect(screen.getAllByLabelText("Event Bot").length).toBeGreaterThan(0);
    expect(screen.getAllByLabelText("Group Chat").length).toBeGreaterThan(0);
    expect(screen.getAllByLabelText("Transcript").length).toBeGreaterThan(0);
  });

  it("hides chat tab when showChat is false", () => {
    render(<NavigationBar {...baseProps} showChat={false} />);

    expect(screen.queryByLabelText("Group Chat")).not.toBeInTheDocument();
    expect(screen.getAllByLabelText("Event Bot").length).toBeGreaterThan(0);
    expect(screen.getAllByLabelText("Transcript").length).toBeGreaterThan(0);
  });

  it("hides transcript tab when showTranscript is false", () => {
    render(<NavigationBar {...baseProps} showTranscript={false} />);

    expect(screen.queryByLabelText("Transcript")).not.toBeInTheDocument();
    expect(screen.getAllByLabelText("Event Bot").length).toBeGreaterThan(0);
    expect(screen.getAllByLabelText("Group Chat").length).toBeGreaterThan(0);
  });

  it("only renders Event Bot tab when showChat and showTranscript are false", () => {
    render(
      <NavigationBar {...baseProps} showChat={false} showTranscript={false} />,
    );

    expect(screen.getAllByLabelText("Event Bot").length).toBeGreaterThan(0);
    expect(screen.queryByLabelText("Group Chat")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Transcript")).not.toBeInTheDocument();
  });

  it("marks the active tab with aria-current='page'", () => {
    render(<NavigationBar {...baseProps} activeTab="assistant" />);

    const activeBtns = screen
      .getAllByLabelText("Event Bot")
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

    const assistantBtns = screen.getAllByLabelText("Event Bot");
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
    expect(boldLabels[0].textContent).toBe("Event Bot");
  });

  it("renders both desktop nav and mobile nav", () => {
    const { container } = render(<NavigationBar {...baseProps} />);

    const navElements = container.querySelectorAll(
      "nav[aria-label='Main navigation']",
    );
    expect(navElements.length).toBe(2);
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

    it("hides badge when on the tab that has unseen messages", () => {
      const { container } = render(
        <NavigationBar
          {...baseProps}
          unseenChatCount={3}
          activeTab="chat"
        />,
      );

      // When on chat tab, badge should be invisible even with unseenChatCount > 0
      const badges = container.querySelectorAll(".MuiBadge-badge");
      const visibleBadges = Array.from(badges).filter(
        (badge) =>
          !(badge as HTMLElement).classList.contains("MuiBadge-invisible"),
      );
      expect(visibleBadges.length).toBe(0);
    });
  });
});
