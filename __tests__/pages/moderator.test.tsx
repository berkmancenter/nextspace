import { render, screen, waitFor } from "@testing-library/react";
import { act } from "react";
import { useRouter } from "next/router";
import { io } from "socket.io-client";
import ModeratorScreen from "../../pages/moderator";
import { JoinSession, RetrieveData } from "../../utils";

// Mock dependencies
jest.mock("next/router", () => ({
  useRouter: jest.fn(),
}));

jest.mock("socket.io-client", () => ({
  io: jest.fn(),
}));

jest.mock("../../components/Transcript", () => ({
  Transcript: jest.fn(() => <div data-testid="transcript-component" />),
}));

jest.mock("../../utils", () => ({
  Api: {
    get: jest.fn().mockReturnValue({
      SetTokens: jest.fn(),
      GetTokens: jest.fn().mockReturnValue({ access: "mock-token" }),
    }),
  },
  JoinSession: jest.fn(),
  GetChannelPasscode: jest.fn().mockReturnValue("mock-passcode"),
  RetrieveData: jest.fn(),
  QueryParamsError: jest.fn().mockReturnValue("Query params error"),
}));

jest.mock("react-scroll", () => ({
  animateScroll: {
    scrollToTop: jest.fn(),
  },
}));

describe("ModeratorScreen", () => {
  const mockRouter = {
    isReady: true,
    query: {
      conversationId: "test-conversation",
      channel: "moderator",
    },
  };

  const mockSocket = {
    on: jest.fn(),
    off: jest.fn(),
    emit: jest.fn(),
    hasListeners: jest.fn().mockReturnValue(false),
    connected: true,
  };

  const mockMessages = [
    {
      id: "1",
      pseudonym: "Back Channel Insights Agent",
      createdAt: "2025-10-17T12:00:00Z",
      channels: ["moderator"],
      body: {
        insights: [{ value: "Test insight" }],
        timestamp: {
          start: "2025-10-17T12:00:00Z",
          end: "2025-10-17T12:05:00Z",
        },
      },
    },
    {
      id: "2",
      pseudonym: "Back Channel Metrics Agent",
      createdAt: "2025-10-17T12:10:00Z",
      channels: ["moderator"],
      body: {
        metrics: [{ name: "happiness" }],
        timestamp: {
          start: "2025-10-17T12:10:00Z",
          end: "2025-10-17T12:15:00Z",
        },
      },
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
    (io as jest.Mock).mockReturnValue(mockSocket);
    (JoinSession as jest.Mock).mockImplementation((success) => success());
    (RetrieveData as jest.Mock).mockResolvedValue(mockMessages);
  });

  it("renders the moderator screen with insight and metric messages", async () => {
    await act(async () => {
      render(<ModeratorScreen isAuthenticated={true} />);
    });

    await waitFor(() => {
      expect(screen.getByText("Test insight")).toBeInTheDocument();
      expect(
        screen.getByText(/The audience is expressing/)
      ).toBeInTheDocument();
      expect(screen.getByText("“happiness”")).toBeInTheDocument();
    });
  });

  it("renders Transcript when transcript passcode exists", async () => {
    await act(async () => {
      render(<ModeratorScreen isAuthenticated />);
    });

    expect(screen.getByTestId("transcript-component")).toBeInTheDocument();
  });

  it("shows error message when query params are invalid", async () => {
    (useRouter as jest.Mock).mockReturnValue({
      ...mockRouter,
      query: {},
    });

    await act(async () => {
      render(<ModeratorScreen isAuthenticated={true} />);
    });

    await waitFor(() => {
      expect(screen.getByText("Query params error")).toBeInTheDocument();
    });
  });

  it("shows error message when API returns an error", async () => {
    (RetrieveData as jest.Mock).mockResolvedValue({
      error: true,
      message: { message: "API error" },
    });

    await act(async () => {
      render(<ModeratorScreen isAuthenticated={true} />);
    });

    await waitFor(() => {
      expect(screen.getByText("API error")).toBeInTheDocument();
    });
  });
});
