import React from "react";
import { render, screen } from "@testing-library/react";
import { SubmittedMessage } from "../../../components/messages/SubmittedMessage";
import { components } from "../../../types";

describe("SubmittedMessage Component", () => {
  it("renders submitted message with YOU ASKED header", () => {
    const message: components["schemas"]["Message"] = {
      id: "msg-1",
      body: "User submitted question",
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

    render(<SubmittedMessage message={message} />);

    expect(screen.getByText("User submitted question")).toBeInTheDocument();
    expect(screen.getByText("You Asked")).toBeInTheDocument();
  });

  it("applies avatar background and left border styling", () => {
    const message: components["schemas"]["Message"] = {
      id: "msg-2",
      body: "Test question",
      conversation: "conv-1",
      fromAgent: false,
      pause: false,
      visible: true,
      pseudonym: "User123",
      pseudonymId: "user-1",
      upVotes: [],
      downVotes: [],
    };

    const { container } = render(<SubmittedMessage message={message} />);

    const styledDiv = container.querySelector(".border-l-4");
    expect(styledDiv).toBeInTheDocument();
    expect(styledDiv).toHaveStyle({ backgroundColor: expect.any(String) });
    expect(styledDiv).toHaveStyle({ borderLeftColor: expect.any(String) });
  });

  it("renders AccountCircle icon", () => {
    const message: components["schemas"]["Message"] = {
      id: "msg-3",
      body: "Question text",
      conversation: "conv-1",
      fromAgent: false,
      pause: false,
      visible: true,
      pseudonym: "User123",
      pseudonymId: "user-1",
      upVotes: [],
      downVotes: [],
    };

    const { container } = render(<SubmittedMessage message={message} />);

    // Check for MUI icon (SVG)
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("handles string body content", () => {
    const message: components["schemas"]["Message"] = {
      id: "msg-4",
      body: "Simple string question",
      conversation: "conv-1",
      fromAgent: false,
      pause: false,
      visible: true,
      pseudonym: "User123",
      pseudonymId: "user-1",
      upVotes: [],
      downVotes: [],
    };

    render(<SubmittedMessage message={message} />);

    expect(screen.getByText("Simple string question")).toBeInTheDocument();
  });
});
