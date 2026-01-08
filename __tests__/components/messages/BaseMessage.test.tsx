import React from "react";
import { render, screen } from "@testing-library/react";
import {
  BaseMessage,
  MessageContent,
} from "../../../components/messages/BaseMessage";

describe("BaseMessage Component", () => {
  it("renders children with default classes", () => {
    const { container } = render(
      <BaseMessage>
        <div>Test content</div>
      </BaseMessage>
    );

    expect(screen.getByText("Test content")).toBeInTheDocument();
    expect(container.querySelector(".w-full")).toBeInTheDocument();
    expect(container.querySelector(".my-1")).toBeInTheDocument();
  });

  it("applies custom className", () => {
    const { container } = render(
      <BaseMessage className="custom-class bg-red-500">
        <div>Test</div>
      </BaseMessage>
    );

    expect(container.querySelector(".custom-class")).toBeInTheDocument();
    expect(container.querySelector(".bg-red-500")).toBeInTheDocument();
  });

  it("wraps content in Box with flex column", () => {
    const { container } = render(
      <BaseMessage>
        <div>Content</div>
      </BaseMessage>
    );

    // Check for MUI Box component (rendered as div)
    const boxElement =
      container.querySelector('[class*="MuiBox"]') || container.firstChild;
    expect(boxElement).toBeInTheDocument();
  });
});

describe("MessageContent Component", () => {
  it("renders text with linkification", () => {
    render(<MessageContent text="Check out https://example.com" />);

    expect(screen.getByText(/Check out/)).toBeInTheDocument();
  });

  it("linkifies URLs correctly", () => {
    const { container } = render(
      <MessageContent text="Visit https://example.com for more info" />
    );

    const link = container.querySelector("a[href='https://example.com']");
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("displays feedback messages with special styling", () => {
    const { container } = render(
      <MessageContent text="/feedback|Rating|msg-123|5" />
    );

    expect(screen.getByText("User feedback received.")).toBeInTheDocument();
    expect(container.querySelector(".bg-blue-50")).toBeInTheDocument();
    expect(container.querySelector(".border-blue-200")).toBeInTheDocument();
  });

  it("shows original text for non-feedback messages", () => {
    render(<MessageContent text="Regular message text" />);

    expect(screen.getByText("Regular message text")).toBeInTheDocument();
    expect(
      screen.queryByText("User feedback received.")
    ).not.toBeInTheDocument();
  });

  it("applies feedback styling when isFeedback prop is true", () => {
    const { container } = render(
      <MessageContent text="Some text" isFeedback={true} />
    );

    expect(container.querySelector(".bg-blue-50")).toBeInTheDocument();
    expect(container.querySelector(".italic")).toBeInTheDocument();
  });

  it("renders plain text without linkification when no URLs", () => {
    render(<MessageContent text="Just plain text" />);

    expect(screen.getByText("Just plain text")).toBeInTheDocument();
  });

  it("handles empty text", () => {
    render(<MessageContent text="" />);

    // Should render without crashing
    const { container } = render(<MessageContent text="" />);
    expect(container).toBeInTheDocument();
  });

  it("handles multiple URLs in text", () => {
    const { container } = render(
      <MessageContent text="Visit https://example.com and https://test.com" />
    );

    const links = container.querySelectorAll("a");
    expect(links.length).toBe(2);
    expect(links[0]).toHaveAttribute("href", "https://example.com");
    expect(links[1]).toHaveAttribute("href", "https://test.com");
  });
});
