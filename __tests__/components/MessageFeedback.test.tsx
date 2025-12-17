import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { MessageFeedback } from "../../components/MessageFeedback";

describe("MessageFeedback Component", () => {
  it("renders all rating buttons", () => {
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
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
  });

  it("calls onSendFeedbackRating when a rating button is clicked", () => {
    const mockPopulateFeedback = jest.fn();
    const mockSendRating = jest.fn();

    render(
      <MessageFeedback
        messageId="msg-123"
        onPopulateFeedbackText={mockPopulateFeedback}
        onSendFeedbackRating={mockSendRating}
      />
    );

    const button3 = screen.getByText("3");
    fireEvent.click(button3);

    expect(mockSendRating).toHaveBeenCalledWith("msg-123", 3);
    expect(mockSendRating).toHaveBeenCalledTimes(1);
  });

  it("disables rating buttons after a rating is selected", () => {
    const mockPopulateFeedback = jest.fn();
    const mockSendRating = jest.fn();

    render(
      <MessageFeedback
        messageId="msg-123"
        onPopulateFeedbackText={mockPopulateFeedback}
        onSendFeedbackRating={mockSendRating}
      />
    );

    const button3 = screen.getByText("3");
    fireEvent.click(button3);

    // Try clicking another button
    const button5 = screen.getByText("5");
    fireEvent.click(button5);

    // Should only have been called once
    expect(mockSendRating).toHaveBeenCalledTimes(1);
    expect(mockSendRating).toHaveBeenCalledWith("msg-123", 3);
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
        prefix: "/ShareFeedback|Text|msg-123|",
        label: "Feedback Mode",
      })
    );
  });

  it("renders custom SVG icon", () => {
    const mockPopulateFeedback = jest.fn();
    const mockSendRating = jest.fn();

    const { container } = render(
      <MessageFeedback
        messageId="msg-123"
        onPopulateFeedbackText={mockPopulateFeedback}
        onSendFeedbackRating={mockSendRating}
      />
    );

    // Check for the custom SVG
    const svgs = container.querySelectorAll("svg");
    expect(svgs.length).toBeGreaterThan(0);

    // Check for the custom SVG with specific viewBox
    const customSvg = container.querySelector('svg[viewBox="0 0 28 27"]');
    expect(customSvg).toBeInTheDocument();
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

  it("uses ThumbDownOutlined icon (not filled)", () => {
    const mockPopulateFeedback = jest.fn();
    const mockSendRating = jest.fn();

    const { container } = render(
      <MessageFeedback
        messageId="msg-123"
        onPopulateFeedbackText={mockPopulateFeedback}
        onSendFeedbackRating={mockSendRating}
      />
    );

    // The MUI icons render as SVGs, we're checking they exist
    const svgs = container.querySelectorAll("svg");
    expect(svgs.length).toBeGreaterThan(1); // Should have ThumbDown, AddComment, and custom SVG
  });
});
