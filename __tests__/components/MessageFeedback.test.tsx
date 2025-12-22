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
    expect(screen.getByText("Say more")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Nah" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Meh" })).toBeInTheDocument();
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
    const nahButton = screen.getByRole("radio", { name: "Nah" });
    fireEvent.click(nahButton);

    // Should only have been called once
    expect(mockSendRating).toHaveBeenCalledTimes(1);
    expect(mockSendRating).toHaveBeenCalledWith("msg-123", "WOW!");
  });

  it("calls onPopulateFeedbackText when Say more button is clicked", () => {
    const mockPopulateFeedback = jest.fn();
    const mockSendRating = jest.fn();

    render(
      <MessageFeedback
        messageId="msg-123"
        onPopulateFeedbackText={mockPopulateFeedback}
        onSendFeedbackRating={mockSendRating}
      />
    );

    const sayMoreButton = screen.getByText("Say more");
    fireEvent.click(sayMoreButton);

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
    expect(screen.getByText("Nah")).toBeInTheDocument();
    expect(screen.getByText("Meh")).toBeInTheDocument();
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
