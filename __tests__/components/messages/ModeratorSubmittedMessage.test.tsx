import React from "react";
import { render, screen } from "@testing-library/react";
import { ModeratorSubmittedMessage } from "../../../components/messages/ModeratorSubmittedMessage";
import { components } from "../../../types";

describe("ModeratorSubmittedMessage Component", () => {
  it("renders moderator submitted message with SUBMITTED header", () => {
    const message: components["schemas"]["Message"] = {
      id: "msg-1",
      body: "Question has been submitted",
      createdAt: new Date().toISOString(),
      conversation: "conv-1",
      fromAgent: true,
      pause: false,
      visible: true,
      pseudonym: "Event Assistant",
      pseudonymId: "ea-1",
      upVotes: [],
      downVotes: [],
    };

    render(<ModeratorSubmittedMessage message={message} />);

    expect(screen.getByText("Question has been submitted")).toBeInTheDocument();
    expect(screen.getByText("Submitted")).toBeInTheDocument();
  });

  it("applies blue background and left border styling", () => {
    const message: components["schemas"]["Message"] = {
      id: "msg-2",
      body: "Confirmation message",
      conversation: "conv-1",
      fromAgent: true,
      pause: false,
      visible: true,
      pseudonym: "Event Assistant",
      pseudonymId: "ea-1",
      upVotes: [],
      downVotes: [],
    };

    const { container } = render(
      <ModeratorSubmittedMessage message={message} />
    );

    expect(container.querySelector(".bg-blue-50")).toBeInTheDocument();
    expect(container.querySelector(".border-l-4")).toBeInTheDocument();
    expect(container.querySelector(".border-blue-500")).toBeInTheDocument();
  });

  it("renders CheckCircleOutline icon", () => {
    const message: components["schemas"]["Message"] = {
      id: "msg-3",
      body: "Submitted text",
      conversation: "conv-1",
      fromAgent: true,
      pause: false,
      visible: true,
      pseudonym: "Event Assistant",
      pseudonymId: "ea-1",
      upVotes: [],
      downVotes: [],
    };

    const { container } = render(
      <ModeratorSubmittedMessage message={message} />
    );

    // Check for MUI icon (SVG)
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("handles string body content", () => {
    const message: components["schemas"]["Message"] = {
      id: "msg-4",
      body: "Your question was submitted to the moderator",
      conversation: "conv-1",
      fromAgent: true,
      pause: false,
      visible: true,
      pseudonym: "Event Assistant",
      pseudonymId: "ea-1",
      upVotes: [],
      downVotes: [],
    };

    render(<ModeratorSubmittedMessage message={message} />);

    expect(
      screen.getByText("Your question was submitted to the moderator")
    ).toBeInTheDocument();
  });
});
