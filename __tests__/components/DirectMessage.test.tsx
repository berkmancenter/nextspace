import React from "react";
import { render, screen, act } from "@testing-library/react";
import { DirectMessage } from "../../components/DirectMessage";

jest.useFakeTimers();

describe("DirectMessage Component", () => {
  it("renders with default theme", () => {
    const testDate = new Date();
    render(<DirectMessage text="Hello world" date={testDate} />);

    expect(screen.getByText("Hello world")).toBeInTheDocument();
    expect(screen.queryByText("Event Assistant")).not.toBeInTheDocument();
  });

  it("renders with assistant theme", () => {
    const testDate = new Date();
    render(
      <DirectMessage
        text="Assistant message"
        date={testDate}
        theme="assistant"
      />
    );

    expect(screen.getByText("Assistant message")).toBeInTheDocument();
    expect(screen.getByText("Event Assistant")).toBeInTheDocument();
    expect(
      screen.queryByText(testDate.toLocaleTimeString())
    ).not.toBeInTheDocument();
  });

  it("renders with backchannel theme", () => {
    const testDate = new Date();
    render(
      <DirectMessage
        text="back channel message"
        date={testDate}
        theme="backchannel"
      />
    );

    expect(screen.getByText("back channel message")).toBeInTheDocument();
    expect(screen.getByText(testDate.toLocaleTimeString())).toBeInTheDocument();
    expect(screen.queryByText("Event Assistant")).not.toBeInTheDocument();
  });

  it("changes message status after timeout for backchannel theme", async () => {
    const testDate = new Date();
    render(
      <DirectMessage
        text="Status test message"
        date={testDate}
        theme="backchannel"
      />
    );

    // Initially should show CheckCircleOutline
    expect(document.querySelector("svg")).toBeInTheDocument();

    // Fast-forward through the random timeout
    await act(async () => {
      jest.runAllTimers();
    });

    // After timeout, should show CheckCircle
    expect(document.querySelector("svg")).toBeInTheDocument();
  });

  it("applies correct class based on theme", () => {
    const testDate = new Date();

    const { rerender } = render(<DirectMessage text="Test" date={testDate} />);
    expect(document.querySelector(".w-full.my-1")).toBeInTheDocument();
    expect(document.querySelector(".bg-light-gray")).not.toBeInTheDocument();

    rerender(<DirectMessage text="Test" date={testDate} theme="assistant" />);
    expect(document.querySelector(".bg-light-gray")).toBeInTheDocument();

    rerender(<DirectMessage text="Test" date={testDate} theme="backchannel" />);
    expect(document.querySelector(".bg-\\[\\#E0E7FF\\]")).toBeInTheDocument();
  });

  it("displays feedback messages with special styling", () => {
    const testDate = new Date();

    render(
      <DirectMessage
        text="/feedback|Rating|msg-123|5"
        date={testDate}
        theme="assistant"
      />
    );

    expect(screen.getByText("User feedback received.")).toBeInTheDocument();
    expect(
      document.querySelector(".bg-blue-50.border.border-blue-200")
    ).toBeInTheDocument();
  });
});
