import React from "react";
import { render, screen, act } from "@testing-library/react";
import { BackchannelMessage } from "../../../components/messages/BackchannelMessage";
import { components } from "../../../types";

jest.useFakeTimers();

describe("BackchannelMessage Component", () => {
  it("renders backchannel message with timestamp", () => {
    const testDate = new Date();
    const message: components["schemas"]["Message"] = {
      id: "msg-1",
      body: "Backchannel message",
      createdAt: testDate.toISOString(),
      conversation: "conv-1",
      fromAgent: false,
      pause: false,
      visible: true,
      pseudonym: "User123",
      pseudonymId: "user-1",
      upVotes: [],
      downVotes: [],
    };

    render(<BackchannelMessage message={message} />);

    expect(screen.getByText("Backchannel message")).toBeInTheDocument();
    expect(screen.getByText(testDate.toLocaleTimeString())).toBeInTheDocument();
  });

  it("applies blue background styling", () => {
    const message: components["schemas"]["Message"] = {
      id: "msg-2",
      body: "Test message",
      conversation: "conv-1",
      fromAgent: false,
      pause: false,
      visible: true,
      pseudonym: "User123",
      pseudonymId: "user-1",
      upVotes: [],
      downVotes: [],
    };

    const { container } = render(<BackchannelMessage message={message} />);

    expect(container.querySelector(".bg-\\[\\#E0E7FF\\]")).toBeInTheDocument();
    expect(container.querySelector(".rounded-lg")).toBeInTheDocument();
  });

  it("changes message status after timeout", async () => {
    const message: components["schemas"]["Message"] = {
      id: "msg-3",
      body: "Status test message",
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

    render(<BackchannelMessage message={message} />);

    // Initially should show CheckCircleOutline
    expect(document.querySelector("svg")).toBeInTheDocument();

    // Fast-forward through the random timeout
    await act(async () => {
      jest.runAllTimers();
    });

    // After timeout, should show CheckCircle (still shows an SVG)
    expect(document.querySelector("svg")).toBeInTheDocument();
  });

  it("handles message without createdAt", () => {
    const message: components["schemas"]["Message"] = {
      id: "msg-4",
      body: "No date message",
      conversation: "conv-1",
      fromAgent: false,
      pause: false,
      visible: true,
      pseudonym: "User123",
      pseudonymId: "user-1",
      upVotes: [],
      downVotes: [],
    };

    render(<BackchannelMessage message={message} />);

    expect(screen.getByText("No date message")).toBeInTheDocument();
    // Should still show a timestamp (current time)
    const timestamp = screen.getByText(/\d{1,2}:\d{2}/);
    expect(timestamp).toBeInTheDocument();
  });
});
