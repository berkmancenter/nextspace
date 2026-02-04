import React from "react";
import { render, screen, act } from "@testing-library/react";
import { AssistantMessage } from "../../../components/messages/AssistantMessage";
import { components } from "../../../types";

describe("AssistantMessage Component", () => {
  it("renders assistant message content", () => {
    const testDate = new Date();
    const message: components["schemas"]["Message"] = {
      id: "msg-1",
      body: "Assistant message",
      createdAt: testDate.toISOString(),
      conversation: "conv-1",
      fromAgent: true,
      pause: false,
      visible: true,
      pseudonym: "Event Assistant",
      pseudonymId: "ea-1",
      upVotes: [],
      downVotes: [],
    };

    render(<AssistantMessage message={message} />);

    expect(screen.getByText("Assistant message")).toBeInTheDocument();
  });

  it("renders without background styling when no prompt options", () => {
    const message: components["schemas"]["Message"] = {
      id: "msg-2",
      body: "Simple message",
      conversation: "conv-1",
      fromAgent: true,
      pause: false,
      visible: true,
      pseudonym: "Event Assistant",
      pseudonymId: "ea-1",
      upVotes: [],
      downVotes: [],
    };

    const { container } = render(<AssistantMessage message={message} />);
    // No background class — parent provides the bubble styling
    expect(container.querySelector(".bg-light-gray")).not.toBeInTheDocument();
    expect(screen.getByText("Simple message")).toBeInTheDocument();
  });

  it("renders prompt options with purple background", () => {
    const mockOnPromptSelect = jest.fn();
    const message: components["schemas"]["Message"] = {
      id: "msg-3",
      body: "Choose an option",
      conversation: "conv-1",
      fromAgent: true,
      pause: false,
      visible: true,
      pseudonym: "Event Assistant",
      pseudonymId: "ea-1",
      upVotes: [],
      downVotes: [],
      prompt: {
        type: "singleChoice" as const,
        options: [
          { label: "Option 1", value: "opt1" },
          { label: "Option 2", value: "opt2" },
        ],
      },
    };

    const { container } = render(
      <AssistantMessage message={message} onPromptSelect={mockOnPromptSelect} />
    );

    // Check for purple styling on messages with prompt options
    expect(container.querySelector(".bg-purple-100")).toBeInTheDocument();
    expect(container.querySelector(".border-purple-500")).toBeInTheDocument();

    // Check buttons render
    expect(screen.getByText("Option 1")).toBeInTheDocument();
    expect(screen.getByText("Option 2")).toBeInTheDocument();
  });

  it("disables all buttons after selecting a prompt option", () => {
    const mockOnPromptSelect = jest.fn();
    const message: components["schemas"]["Message"] = {
      id: "msg-4",
      body: "Choose an option",
      conversation: "conv-1",
      fromAgent: true,
      pause: false,
      visible: true,
      pseudonym: "Event Assistant",
      pseudonymId: "ea-1",
      upVotes: [],
      downVotes: [],
      prompt: {
        type: "singleChoice" as const,
        options: [
          { label: "Option 1", value: "opt1" },
          { label: "Option 2", value: "opt2" },
        ],
      },
    };

    const { getByText } = render(
      <AssistantMessage message={message} onPromptSelect={mockOnPromptSelect} />
    );

    const button1 = getByText("Option 1");
    const button2 = getByText("Option 2");

    expect(button1).not.toBeDisabled();
    expect(button2).not.toBeDisabled();

    // Click first option
    act(() => {
      button1.click();
    });

    expect(mockOnPromptSelect).toHaveBeenCalledWith("opt1", "msg-4");
    expect(button1).toBeDisabled();
    expect(button2).toBeDisabled();
  });

  it("does not show Event Assistant header when prompt options present", () => {
    const message: components["schemas"]["Message"] = {
      id: "msg-7",
      body: "Choose",
      conversation: "conv-1",
      fromAgent: true,
      pause: false,
      visible: true,
      pseudonym: "Event Assistant",
      pseudonymId: "ea-1",
      upVotes: [],
      downVotes: [],
      prompt: {
        type: "singleChoice" as const,
        options: [{ label: "Option", value: "opt" }],
      },
    };

    render(<AssistantMessage message={message} />);

    expect(screen.queryByText("Event Assistant")).not.toBeInTheDocument();
  });
});
