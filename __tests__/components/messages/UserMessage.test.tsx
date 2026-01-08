import React from "react";
import { render, screen } from "@testing-library/react";
import { UserMessage } from "../../../components/messages/UserMessage";
import { components } from "../../../types";

describe("UserMessage Component", () => {
  it("renders user message with default theme", () => {
    const message: components["schemas"]["Message"] = {
      id: "msg-1",
      body: "Hello world",
      createdAt: new Date().toISOString(),
      conversation: "conv-1",
      fromAgent: false,
      pause: false,
      visible: true,
      pseudonym: "User123",
      pseudonymId: "user-1",
      upVotes: [],
      downVotes: [],
    };

    render(<UserMessage message={message} />);

    expect(screen.getByText("Hello world")).toBeInTheDocument();
  });

  it("applies minimal styling", () => {
    const message: components["schemas"]["Message"] = {
      id: "msg-2",
      body: "Simple message",
      conversation: "conv-1",
      fromAgent: false,
      pause: false,
      visible: true,
      pseudonym: "User123",
      pseudonymId: "user-1",
      upVotes: [],
      downVotes: [],
    };

    const { container } = render(<UserMessage message={message} />);

    // Should have base classes but no special theme styling
    expect(container.querySelector(".w-full")).toBeInTheDocument();
    expect(container.querySelector(".my-1")).toBeInTheDocument();

    // Should NOT have theme-specific styling
    expect(container.querySelector(".bg-light-gray")).not.toBeInTheDocument();
    expect(container.querySelector(".bg-blue-50")).not.toBeInTheDocument();
    expect(container.querySelector(".bg-gray-100")).not.toBeInTheDocument();
  });

  it("handles string body content", () => {
    const message: components["schemas"]["Message"] = {
      id: "msg-3",
      body: "Test user message",
      conversation: "conv-1",
      fromAgent: false,
      pause: false,
      visible: true,
      pseudonym: "User123",
      pseudonymId: "user-1",
      upVotes: [],
      downVotes: [],
    };

    render(<UserMessage message={message} />);

    expect(screen.getByText("Test user message")).toBeInTheDocument();
  });

  it("renders without additional headers or decorations", () => {
    const message: components["schemas"]["Message"] = {
      id: "msg-4",
      body: "Plain message",
      conversation: "conv-1",
      fromAgent: false,
      pause: false,
      visible: true,
      pseudonym: "User123",
      pseudonymId: "user-1",
      upVotes: [],
      downVotes: [],
    };

    render(<UserMessage message={message} />);

    // Should not have any headers
    expect(screen.queryByText("Event Assistant")).not.toBeInTheDocument();
    expect(screen.queryByText("You Asked")).not.toBeInTheDocument();
    expect(screen.queryByText("Submitted")).not.toBeInTheDocument();
  });

  it("linkifies URLs in message content", () => {
    const message: components["schemas"]["Message"] = {
      id: "msg-5",
      body: "Check out https://example.com",
      conversation: "conv-1",
      fromAgent: false,
      pause: false,
      visible: true,
      pseudonym: "User123",
      pseudonymId: "user-1",
      upVotes: [],
      downVotes: [],
    };

    const { container } = render(<UserMessage message={message} />);

    // Check that a link was created
    const link = container.querySelector("a[href='https://example.com']");
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });
});
