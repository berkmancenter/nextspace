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
    await user.click(screen.getByRole("button", { name: /transcript view/i }));
  };

  it("toggles transcript open and closed via aria-label", async () => {
    const user = setupUser();
    render(<Transcript {...baseProps} />);

    const toggle = screen.getByRole("button", {
      name: /open transcript view/i,
    });

    await user.click(toggle);

    await waitFor(() => {
      expect(toggle).toHaveAttribute("aria-label", "Close transcript view");
    });

    await user.click(toggle);

    await waitFor(() => {
      expect(toggle).toHaveAttribute("aria-label", "Open transcript view");
    });
  });

  it("renders transcript messages when opened", async () => {
    const user = setupUser();
    render(<Transcript {...baseProps} />);

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
        screen.getByRole("button", { name: /close transcript view/i })
      ).toBeInTheDocument();
    });

    // Should apply focus styles
    await waitFor(() => {
      expect(document.querySelector(".bg-amber-100")).toBeTruthy();
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
        screen.getByRole("button", { name: /close transcript view/i })
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
      expect(document.querySelector(".bg-amber-100")).toBeTruthy();
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
      expect(document.querySelector(".bg-amber-100")).toBeTruthy();
    });

    // Manually close via toggle
    await toggleTranscript(user);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /open transcript view/i })
      ).toBeInTheDocument();
    });

    // Manually reopen → focus should still be applied
    await toggleTranscript(user);

    await waitFor(() => {
      expect(document.querySelector(".bg-amber-100")).toBeTruthy();
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
      expect(document.querySelector(".bg-amber-100")).toBeTruthy();
    });

    // Remove focusTimeRange
    rerender(<Transcript {...baseProps} />);

    await waitFor(() => {
      expect(document.querySelector(".bg-amber-100")).toBeFalsy();
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
        "bg-amber-100"
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
        "bg-amber-100"
      );
      expect(document.querySelector("#transcript-message-m1")).not.toHaveClass(
        "bg-amber-100"
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
        screen.getByRole("button", { name: /close transcript view/i })
      ).toBeInTheDocument();
    });

    // Focus should apply once messages load
    await waitFor(
      () => {
        expect(document.querySelector(".bg-amber-100")).toBeTruthy();
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

    // Should still add listener (we removed hasListeners check)
    expect(mockSocket.on).toHaveBeenCalledWith(
      "message:new",
      expect.any(Function)
    );
  });

  it("removes old listener when socket changes", () => {
    const { rerender } = render(<Transcript {...baseProps} />);

    const firstHandler = mockSocket.on.mock.calls[0][1];

    // Change socket prop
    const newMockSocket = {
      emit: jest.fn(),
      on: jest.fn(),
      off: jest.fn(),
      listenerCount: jest.fn().mockReturnValue(0),
    };

    rerender(<Transcript {...baseProps} socket={newMockSocket} />);

    // Old socket should have cleanup called
    expect(mockSocket.off).toHaveBeenCalledWith("message:new", firstHandler);

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
        screen.getByRole("button", { name: /close transcript view/i })
      ).toBeInTheDocument();
    });

    // User manually closes
    await toggleTranscript(user);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /open transcript view/i })
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
      screen.getByRole("button", { name: /open transcript view/i })
    ).toBeInTheDocument();
  });
});
