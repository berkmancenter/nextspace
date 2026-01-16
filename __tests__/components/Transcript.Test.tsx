import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Transcript } from "../../components/Transcript";
import { RetrieveData } from "../../utils";

jest.mock("../../utils", () => ({
  RetrieveData: jest.fn(),
}));

describe("Transcript", () => {
  const mockSocket = {
    emit: jest.fn(),
    on: jest.fn(),
    off: jest.fn(),
    listenerCount: jest.fn().mockReturnValue(0),
  };

  const baseProps = {
    socket: mockSocket as any,
    conversationId: "conversation-1",
    transcriptPasscode: "passcode",
    apiAccessToken: "token",
  };

  const transcriptMessages = [
    {
      id: "m1",
      channels: ["transcript"],
      createdAt: "2025-10-17T12:01:00Z",
      body: { text: "Hello world" },
    },
    {
      id: "m2",
      channels: ["transcript"],
      createdAt: "2025-10-17T12:02:00Z",
      body: { text: "Second message" },
    },
  ];

  beforeAll(() => {
    Element.prototype.scrollIntoView = jest.fn();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    (RetrieveData as jest.Mock).mockResolvedValue(transcriptMessages);
  });

  const setupUser = () => userEvent.setup();

  const toggleTranscript = async (user: ReturnType<typeof setupUser>) => {
    // Find the toggle button - it changes aria-label based on state
    const toggle = screen.getByRole("button", {
      name: /transcript/i,
    });
    await user.click(toggle);
  };

  it("starts collapsed and can be toggled open and closed", async () => {
    const user = setupUser();
    render(<Transcript {...baseProps} />);

    // Should start collapsed with "Open transcript" button
    const toggle = screen.getByRole("button", {
      name: /Open transcript/i,
    });
    expect(toggle).toBeInTheDocument();

    // Should show vertical text when collapsed
    expect(screen.getAllByText("LIVE TRANSCRIPT").length).toBeGreaterThan(0);

    // Open the transcript
    await user.click(toggle);

    await waitFor(() => {
      expect(
        screen.getByRole("button", {
          name: /Close transcript/i,
        })
      ).toBeInTheDocument();
      // Should show horizontal header when open
      expect(screen.getAllByText("LIVE TRANSCRIPT").length).toBeGreaterThan(0);
    });

    // Close it again
    const closeButton = screen.getByRole("button", {
      name: /Close transcript/i,
    });
    await user.click(closeButton);

    await waitFor(() => {
      expect(
        screen.getByRole("button", {
          name: /Open transcript/i,
        })
      ).toBeInTheDocument();
    });
  });

  it("displays vertical text when collapsed", () => {
    render(<Transcript {...baseProps} />);

    // Should show vertical "LIVE TRANSCRIPT" text when collapsed
    expect(screen.getAllByText("LIVE TRANSCRIPT").length).toBeGreaterThan(0);

    // Should have the open button
    expect(
      screen.getByRole("button", { name: /Open transcript/i })
    ).toBeInTheDocument();
  });

  it("changes width when toggled", async () => {
    const user = setupUser();
    const { container } = render(<Transcript {...baseProps} />);

    const transcriptContainer = container.firstChild as HTMLElement;

    // Should start with collapsed width (w-16 = 64px)
    expect(transcriptContainer).toHaveClass("lg:w-16");

    // Open transcript
    await toggleTranscript(user);

    await waitFor(() => {
      // Should expand to full width (w-[33vw])
      expect(transcriptContainer).toHaveClass("lg:w-[33vw]");
    });
  });

  it("renders transcript messages when opened", async () => {
    const user = setupUser();
    render(<Transcript {...baseProps} />);

    // Should start collapsed, messages not visible
    expect(screen.queryByText("Hello world")).not.toBeInTheDocument();

    await toggleTranscript(user);

    await waitFor(() => {
      expect(screen.getByText("Hello world")).toBeInTheDocument();
      expect(screen.getByText("Second message")).toBeInTheDocument();
    });
  });

  it("auto-opens transcript when focusTimeRange is set", async () => {
    render(
      <Transcript
        {...baseProps}
        focusTimeRange={{
          start: new Date("2025-10-17T12:00:30Z"),
          end: new Date("2025-10-17T12:01:30Z"),
        }}
      />
    );

    // Should auto-open when focusTimeRange is provided
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /Close transcript/i })
      ).toBeInTheDocument();
    });

    // Should apply focus styles with purple highlight
    await waitFor(() => {
      const highlightedElement = document.getElementById(
        "transcript-message-m1"
      );
      expect(highlightedElement?.className).toContain("bg-[#4A0979]");
    });
  });

  it("applies focus styles when transcript is manually opened and focusTimeRange exists", async () => {
    const user = setupUser();

    // Start with transcript closed, no focusTimeRange
    const { rerender } = render(<Transcript {...baseProps} />);

    // Manually open transcript
    await toggleTranscript(user);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /Close transcript/i })
      ).toBeInTheDocument();
    });

    // Now set focusTimeRange
    rerender(
      <Transcript
        {...baseProps}
        focusTimeRange={{
          start: new Date("2025-10-17T12:00:30Z"),
          end: new Date("2025-10-17T12:01:30Z"),
        }}
      />
    );

    await waitFor(() => {
      const highlightedElement = document.getElementById(
        "transcript-message-m1"
      );
      expect(highlightedElement?.className).toContain("bg-[#4A0979]");
    });
  });

  it("preserves focus when transcript is manually closed and reopened", async () => {
    const user = setupUser();

    render(
      <Transcript
        {...baseProps}
        focusTimeRange={{
          start: new Date("2025-10-17T12:00:30Z"),
          end: new Date("2025-10-17T12:01:30Z"),
        }}
      />
    );

    // Should auto-open with focus
    await waitFor(() => {
      const highlightedElement = document.getElementById(
        "transcript-message-m1"
      );
      expect(highlightedElement?.className).toContain("bg-[#4A0979]");
    });

    // Manually close via toggle
    await toggleTranscript(user);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /Open transcript/i })
      ).toBeInTheDocument();
    });

    // Manually reopen → focus should still be applied
    await toggleTranscript(user);

    await waitFor(() => {
      const highlightedElement = document.getElementById(
        "transcript-message-m1"
      );
      expect(highlightedElement?.className).toContain("bg-[#4A0979]");
    });
  });

  it("clears focus when focusTimeRange prop is removed", async () => {
    const { rerender } = render(
      <Transcript
        {...baseProps}
        focusTimeRange={{
          start: new Date("2025-10-17T12:00:30Z"),
          end: new Date("2025-10-17T12:01:30Z"),
        }}
      />
    );

    // Should auto-open with focus
    await waitFor(() => {
      const highlightedElement = document.getElementById(
        "transcript-message-m1"
      );
      expect(highlightedElement?.className).toContain("bg-[#4A0979]");
    });

    // Remove focusTimeRange
    rerender(<Transcript {...baseProps} />);

    await waitFor(() => {
      const highlightedElement = document.getElementById(
        "transcript-message-m1"
      );
      expect(highlightedElement?.className).not.toContain("bg-[#4A0979]");
    });
  });

  it("updates focus when focusTimeRange changes", async () => {
    const { rerender } = render(
      <Transcript
        {...baseProps}
        focusTimeRange={{
          start: new Date("2025-10-17T12:00:30Z"),
          end: new Date("2025-10-17T12:01:30Z"),
        }}
      />
    );

    // Should auto-open and focus m1
    await waitFor(() => {
      expect(document.querySelector("#transcript-message-m1")).toHaveClass(
        "bg-[#4A0979]"
      );
    });

    // Change focusTimeRange to focus m2
    rerender(
      <Transcript
        {...baseProps}
        focusTimeRange={{
          start: new Date("2025-10-17T12:01:30Z"),
          end: new Date("2025-10-17T12:02:30Z"),
        }}
      />
    );

    await waitFor(() => {
      expect(document.querySelector("#transcript-message-m2")).toHaveClass(
        "bg-[#4A0979]"
      );
      expect(document.querySelector("#transcript-message-m1")).not.toHaveClass(
        "bg-[#4A0979]"
      );
    });
  });

  it("applies focus after messages load if focusTimeRange was set before messages arrived", async () => {
    (RetrieveData as jest.Mock).mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(() => resolve(transcriptMessages), 100)
        )
    );

    render(
      <Transcript
        {...baseProps}
        focusTimeRange={{
          start: new Date("2025-10-17T12:00:30Z"),
          end: new Date("2025-10-17T12:01:30Z"),
        }}
      />
    );

    // Should auto-open
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /Close transcript/i })
      ).toBeInTheDocument();
    });

    // Focus should apply once messages load
    await waitFor(
      () => {
        const highlightedElement = document.getElementById(
          "transcript-message-m1"
        );
        expect(highlightedElement?.className).toContain("bg-[#4A0979]");
      },
      { timeout: 300 }
    );
  });

  it("scrolls to the earliest message in focus range", async () => {
    const scrollIntoViewMock = jest.fn();
    Element.prototype.scrollIntoView = scrollIntoViewMock;

    render(
      <Transcript
        {...baseProps}
        focusTimeRange={{
          start: new Date("2025-10-17T12:00:30Z"),
          end: new Date("2025-10-17T12:01:30Z"),
        }}
      />
    );

    // Should auto-open and scroll
    await waitFor(
      () => {
        expect(scrollIntoViewMock).toHaveBeenCalled();
      },
      { timeout: 1000 }
    );
  });

  it("removes socket listener on unmount", () => {
    const { unmount } = render(<Transcript {...baseProps} />);

    // Verify subscription was initiated
    expect(mockSocket.emit).toHaveBeenCalledWith("channel:join", {
      conversationId: baseProps.conversationId,
      token: baseProps.apiAccessToken,
      channel: {
        name: "transcript",
        passcode: baseProps.transcriptPasscode,
      },
    });

    // Verify listener was added
    expect(mockSocket.on).toHaveBeenCalledWith(
      "message:new",
      expect.any(Function)
    );

    const addedHandler = mockSocket.on.mock.calls[0][1];

    unmount();

    // Verify cleanup was called with same handler
    expect(mockSocket.off).toHaveBeenCalledWith("message:new", addedHandler);
  });

  it("does not add duplicate socket listeners", () => {
    mockSocket.listenerCount.mockReturnValue(1); // Pretend listener exists

    render(<Transcript {...baseProps} />);

    // Should emit channel:join
    expect(mockSocket.emit).toHaveBeenCalledWith("channel:join", {
      conversationId: baseProps.conversationId,
      token: baseProps.apiAccessToken,
      channel: {
        name: "transcript",
        passcode: baseProps.transcriptPasscode,
      },
    });

    // Should still add listener (we removed hasListeners check)
    expect(mockSocket.on).toHaveBeenCalledWith(
      "message:new",
      expect.any(Function)
    );
  });

  it("removes old listener when socket changes", () => {
    const { rerender } = render(<Transcript {...baseProps} />);

    const firstHandler = mockSocket.on.mock.calls[0][1];

    // Verify first socket emitted channel:join
    expect(mockSocket.emit).toHaveBeenCalledWith("channel:join", {
      conversationId: baseProps.conversationId,
      token: baseProps.apiAccessToken,
      channel: {
        name: "transcript",
        passcode: baseProps.transcriptPasscode,
      },
    });

    // Change socket prop
    const newMockSocket = {
      emit: jest.fn(),
      on: jest.fn(),
      off: jest.fn(),
      listenerCount: jest.fn().mockReturnValue(0),
      auth: { token: "mock-token" },
      hasListeners: jest.fn(() => false),
    };

    rerender(<Transcript {...baseProps} socket={newMockSocket as any} />);

    // Old socket should have cleanup called
    expect(mockSocket.off).toHaveBeenCalledWith("message:new", firstHandler);

    // New socket should emit channel:join
    expect(newMockSocket.emit).toHaveBeenCalledWith("channel:join", {
      conversationId: baseProps.conversationId,
      token: baseProps.apiAccessToken,
      channel: {
        name: "transcript",
        passcode: baseProps.transcriptPasscode,
      },
    });

    // New socket should have listener added
    expect(newMockSocket.on).toHaveBeenCalledWith(
      "message:new",
      expect.any(Function)
    );
  });

  it("does not reopen transcript when new messages arrive", async () => {
    const user = setupUser();

    render(
      <Transcript
        {...baseProps}
        focusTimeRange={{
          start: new Date("2025-10-17T12:00:30Z"),
          end: new Date("2025-10-17T12:01:30Z"),
        }}
      />
    );

    // Should auto-open
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /Close transcript/i })
      ).toBeInTheDocument();
    });

    // User manually closes
    await toggleTranscript(user);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /Open transcript/i })
      ).toBeInTheDocument();
    });

    // Simulate new message arriving via socket
    const messageHandler = mockSocket.on.mock.calls.find(
      (call) => call[0] === "message:new"
    )?.[1];

    messageHandler?.({
      id: "m3",
      channels: ["transcript"],
      createdAt: "2025-10-17T12:01:15Z", // Within focus range
      body: { text: "New socket message" },
    });

    // Wait a bit
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Transcript should still be closed
    expect(
      screen.getByRole("button", { name: /Open transcript/i })
    ).toBeInTheDocument();
  });
});
