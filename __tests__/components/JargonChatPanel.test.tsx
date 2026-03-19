import React from "react";
import { render, screen } from "@testing-library/react";
import { JargonChatPanel } from "../../components/JargonChatPanel";
import { PseudonymousMessage } from "../../types.internal";

const makeJargonMessage = (
  overrides: Partial<PseudonymousMessage> = {},
): PseudonymousMessage => ({
  id: "msg-1",
  pseudonym: "Jargon Filter Agent",
  pseudonymId: "jargon-agent-1",
  createdAt: "2025-10-17T12:00:00Z",
  body: {
    type: "jargon_clarification",
    text: "An SLO is a target for how reliable a service should be.",
    sourceText: "Our SLOs are defined in terms of error budget.",
  },
  channels: ["direct-user-1-jargon-agent-1"],
  conversation: "conv-1",
  fromAgent: true,
  pause: false,
  visible: true,
  upVotes: [],
  downVotes: [],
  ...overrides,
});

describe("JargonChatPanel", () => {
  it("renders the header", () => {
    render(<JargonChatPanel messages={[]} />);
    expect(screen.getByRole("heading", { level: 2 })).toBeInTheDocument();
    expect(screen.getByText(/jargon filter/i)).toBeInTheDocument();
  });

  it("renders the subtitle with 'Jargon Filter'", () => {
    render(<JargonChatPanel messages={[]} />);
    expect(screen.getByText(/jargon filter — technical terms/i)).toBeInTheDocument();
  });

  it("includes the event name in the header when provided", () => {
    render(<JargonChatPanel messages={[]} eventName="Tech Summit" />);
    expect(screen.getByText("Tech Summit")).toBeInTheDocument();
  });

  it("shows fallback event name when omitted", () => {
    render(<JargonChatPanel messages={[]} />);
    expect(screen.getByText("Your Event")).toBeInTheDocument();
  });

  it("renders no message cards when messages is empty", () => {
    const { container } = render(<JargonChatPanel messages={[]} />);
    expect(container.querySelectorAll("[data-testid='jargon-card']").length).toBe(0);
  });

  it("does not render a message input box", () => {
    render(<JargonChatPanel messages={[makeJargonMessage()]} />);
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("renders the source text for a jargon_clarification message", () => {
    render(<JargonChatPanel messages={[makeJargonMessage()]} />);
    expect(
      screen.getByText("Our SLOs are defined in terms of error budget."),
    ).toBeInTheDocument();
  });

  it("renders the plain English text for a jargon_clarification message", () => {
    render(<JargonChatPanel messages={[makeJargonMessage()]} />);
    expect(
      screen.getByText("An SLO is a target for how reliable a service should be."),
    ).toBeInTheDocument();
  });

  it("renders 'Original' and 'Plain English' section labels", () => {
    render(<JargonChatPanel messages={[makeJargonMessage()]} />);
    expect(screen.getByText(/original/i)).toBeInTheDocument();
    expect(screen.getByText(/plain english/i)).toBeInTheDocument();
  });

  it("skips messages that are not jargon_clarification type", () => {
    const nonJargon = makeJargonMessage({
      body: { type: "text", text: "This is a normal message" },
    });
    render(<JargonChatPanel messages={[nonJargon]} />);
    expect(screen.queryByText("This is a normal message")).not.toBeInTheDocument();
  });

  it("skips string body messages", () => {
    const stringBody = makeJargonMessage({ body: "plain string message" });
    render(<JargonChatPanel messages={[stringBody]} />);
    expect(screen.queryByText("plain string message")).not.toBeInTheDocument();
  });

  it("renders multiple jargon cards", () => {
    const messages = [
      makeJargonMessage({
        id: "msg-1",
        body: {
          type: "jargon_clarification",
          text: "An SLO is a reliability target.",
          sourceText: "Our SLOs...",
        },
      }),
      makeJargonMessage({
        id: "msg-2",
        createdAt: "2025-10-17T12:01:00Z",
        body: {
          type: "jargon_clarification",
          text: "A sidecar runs alongside your app to handle networking.",
          sourceText: "The sidecar proxy intercepts all traffic.",
        },
      }),
    ];
    render(<JargonChatPanel messages={messages} />);
    expect(screen.getByText("An SLO is a reliability target.")).toBeInTheDocument();
    expect(
      screen.getByText("A sidecar runs alongside your app to handle networking."),
    ).toBeInTheDocument();
  });

  it("renders a timestamp for the first message", () => {
    render(<JargonChatPanel messages={[makeJargonMessage()]} />);
    // Timestamp is rendered as a locale time string — just check something time-like is present
    const timePattern = /\d{1,2}:\d{2}/;
    expect(screen.getByText(timePattern)).toBeInTheDocument();
  });

  it("renders one timestamp when two messages share the same minute", () => {
    const messages = [
      makeJargonMessage({ id: "msg-1", createdAt: "2025-10-17T12:00:30Z" }),
      makeJargonMessage({ id: "msg-2", createdAt: "2025-10-17T12:00:45Z" }),
    ];
    render(<JargonChatPanel messages={messages} />);
    const timePattern = /\d{1,2}:\d{2}/;
    expect(screen.getAllByText(timePattern).length).toBe(1);
  });

  it("renders two timestamps when messages are in different minutes", () => {
    const messages = [
      makeJargonMessage({ id: "msg-1", createdAt: "2025-10-17T12:00:00Z" }),
      makeJargonMessage({ id: "msg-2", createdAt: "2025-10-17T12:01:00Z" }),
    ];
    render(<JargonChatPanel messages={messages} />);
    const timePattern = /\d{1,2}:\d{2}/;
    expect(screen.getAllByText(timePattern).length).toBe(2);
  });
});
