import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { MessageFeedback } from "../../components/MessageFeedback";

describe("MessageFeedback Component", () => {
  it("renders all feedback buttons", () => {
    const mockPopulateFeedback = jest.fn();
    const mockSendRating = jest.fn();

    render(
      <MessageFeedback
        messageId="msg-123"
        onPopulateFeedbackText={mockPopulateFeedback}
        onSendFeedbackRating={mockSendRating}
      />
    );

    expect(screen.getByText("How did the bot do?")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "No" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Meh" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "OK" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "WOW!" })).toBeInTheDocument();
  });

  it("calls onSendFeedbackRating when a feedback button is clicked", () => {
    const mockPopulateFeedback = jest.fn();
    const mockSendRating = jest.fn();

    render(
      <MessageFeedback
        messageId="msg-123"
        onPopulateFeedbackText={mockPopulateFeedback}
        onSendFeedbackRating={mockSendRating}
      />
    );

    const mehButton = screen.getByRole("radio", { name: "Meh" });
    fireEvent.click(mehButton);

    expect(mockSendRating).toHaveBeenCalledWith("msg-123", "Meh");
    expect(mockSendRating).toHaveBeenCalledTimes(1);
  });

  it("disables feedback buttons after a feedback is selected", () => {
    const mockPopulateFeedback = jest.fn();
    const mockSendRating = jest.fn();

    render(
      <MessageFeedback
        messageId="msg-123"
        onPopulateFeedbackText={mockPopulateFeedback}
        onSendFeedbackRating={mockSendRating}
      />
    );

    const wowButton = screen.getByRole("radio", { name: "WOW!" });
    fireEvent.click(wowButton);

    // Try clicking another button
    const noButton = screen.getByRole("radio", { name: "No" });
    fireEvent.click(noButton);

    // Should only have been called once
    expect(mockSendRating).toHaveBeenCalledTimes(1);
    expect(mockSendRating).toHaveBeenCalledWith("msg-123", "WOW!");
  });

  it("does not show 'Say more' message before rating selection", () => {
    const mockPopulateFeedback = jest.fn();
    const mockSendRating = jest.fn();

    render(
      <MessageFeedback
        messageId="msg-123"
        onPopulateFeedbackText={mockPopulateFeedback}
        onSendFeedbackRating={mockSendRating}
      />
    );

    expect(screen.queryByText("Event Assistant")).not.toBeInTheDocument();
    expect(
      screen.queryByText("Thank you for your input!")
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("Would you like to share more?")
    ).not.toBeInTheDocument();
  });

  it("shows 'Say more' message after rating selection", () => {
    const mockPopulateFeedback = jest.fn();
    const mockSendRating = jest.fn();

    render(
      <MessageFeedback
        messageId="msg-123"
        onPopulateFeedbackText={mockPopulateFeedback}
        onSendFeedbackRating={mockSendRating}
      />
    );

    const mehButton = screen.getByRole("radio", { name: "Meh" });
    fireEvent.click(mehButton);

    expect(screen.getByText("Thank you for your input!")).toBeInTheDocument();
    expect(
      screen.getByText("Would you like to share more?")
    ).toBeInTheDocument();
  });

  it("calls onPopulateFeedbackText when 'Would you like to share more?' link is clicked", () => {
    const mockPopulateFeedback = jest.fn();
    const mockSendRating = jest.fn();

    render(
      <MessageFeedback
        messageId="msg-123"
        onPopulateFeedbackText={mockPopulateFeedback}
        onSendFeedbackRating={mockSendRating}
      />
    );

    // First select a rating to show the message
    const mehButton = screen.getByRole("radio", { name: "Meh" });
    fireEvent.click(mehButton);

    // Then click the "Would you like to share more?" link
    const shareMoreLink = screen.getByText("Would you like to share more?");
    fireEvent.click(shareMoreLink);

    expect(mockPopulateFeedback).toHaveBeenCalledWith(
      expect.objectContaining({
        prefix: "/feedback|Text|msg-123|",
        label: "Feedback Mode",
      })
    );
  });

  it("displays text on buttons", () => {
    const mockPopulateFeedback = jest.fn();
    const mockSendRating = jest.fn();

    render(
      <MessageFeedback
        messageId="msg-123"
        onPopulateFeedbackText={mockPopulateFeedback}
        onSendFeedbackRating={mockSendRating}
      />
    );

    // Check that text is visible on buttons
    expect(screen.getByText("No")).toBeInTheDocument();
    expect(screen.getByText("Meh")).toBeInTheDocument();
    expect(screen.getByText("OK")).toBeInTheDocument();
    expect(screen.getByText("WOW!")).toBeInTheDocument();
  });

  it("returns null when required props are missing", () => {
    const { container } = render(<MessageFeedback />);

    expect(container.firstChild).toBeNull();
  });

  it("returns null when messageId is missing", () => {
    const mockPopulateFeedback = jest.fn();
    const mockSendRating = jest.fn();

    const { container } = render(
      <MessageFeedback
        onPopulateFeedbackText={mockPopulateFeedback}
        onSendFeedbackRating={mockSendRating}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it("shows check icon when button is selected", () => {
    const mockPopulateFeedback = jest.fn();
    const mockSendRating = jest.fn();

    const { container } = render(
      <MessageFeedback
        messageId="msg-123"
        onPopulateFeedbackText={mockPopulateFeedback}
        onSendFeedbackRating={mockSendRating}
      />
    );

    const wowButton = screen.getByRole("radio", { name: "WOW!" });
    fireEvent.click(wowButton);

    // After selection, the button should still display the text
    expect(screen.getByText("WOW!")).toBeInTheDocument();

    // Check icon should be present (MUI icons render as SVGs)
    const svgs = container.querySelectorAll("svg");
    expect(svgs.length).toBeGreaterThan(0);
  });
});
