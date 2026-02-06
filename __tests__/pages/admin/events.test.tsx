import React from "react";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import EventsPage from "../../../pages/admin/events";
import { Request } from "../../../utils";
import { getConversation } from "../../../utils/Helpers";

const conversationTypes1 = [
  { name: "Agent1", label: "Agent 1" },
  { name: "Agent2", label: "Agent 2" },
];
const conversationTypes2 = [{ name: "Agent3", label: "Agent 3" }];

const availablePlatforms1 = [
  { name: "zoom", label: "Zoom" },
  { name: "nextspace", label: "Nextspace" },
];

const availablePlatforms2 = [{ name: "slack", label: "Slack" }];
const mockConversations = [
  {
    id: "1",
    name: "Test Event 1",
    createdAt: "2025-11-05T10:00:00Z",
    scheduledTime: new Date(new Date().getTime() + 120000), // 2 minutes in future
    active: false,
    platforms: ["zoom", "nextspace"],
    agents: ["Agent1", "Agent2"],
    zoomLink: "https://zoom.us/j/123456789",
    moderatorLinks: [
      { url: "https://example.com/mod1", label: "Moderator Link 1" },
    ],
    participantLinks: [
      { url: "https://example.com/part1", label: "Participant Link 1" },
    ],
  },
  {
    id: "2",
    name: "Active Event",
    createdAt: "2025-11-04T10:00:00Z",
    scheduledTime: null,
    active: true,
    platforms: ["slack"],
    agents: ["Agent3"],
    moderatorLinks: [],
    participantLinks: [
      { url: "https://example.com/part2", label: "Participant Link 2" },
    ],
  },
  {
    id: "3",
    name: "Past Event",
    createdAt: "2025-10-01T10:00:00Z",
    scheduledTime: "2025-10-15T14:00:00Z",
    active: false,
    platforms: ["youtube"],
    agents: ["Agent4"],
    moderatorLinks: [],
    participantLinks: [],
  },
];

// Mock dependencies
jest.mock("next/router", () => ({
  useRouter: () => ({
    push: jest.fn(),
  }),
}));

jest.mock("../../../utils", () => ({
  Request: jest.fn(), // Ensure Request is mocked
  getUserTimezone: jest.fn(() => "America/New_York"), // Mock timezone
}));

jest.setTimeout(120000);

jest.mock("../../../utils/Helpers", () => {
  const actual = jest.requireActual("../../../utils/Helpers");
  return {
    ...actual,
    getConversation: jest.fn(),
  };
});

describe("Events Page", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Always mock Request to return mockConversations unless overridden in a specific test
    (Request as jest.Mock).mockResolvedValue(mockConversations);

    // Mock fetch for detailed conversation calls
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => {
        return mockConversations;
      },
    });
  });

  it("should render a loading state initially", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () =>
        new Promise((resolve, reject) => {
          // Never call resolve or reject to keep the promise pending
        }),
    });
    (Request as jest.Mock).mockImplementation(
      () =>
        new Promise((resolve, reject) => {
          // Never call resolve or reject to keep the promise pending
        }),
    ); // Simulates a loading state that never resolves

    await act(async () => {
      render(<EventsPage authType={"user"} />);
    });

    // Check for skeleton elements (MUI Skeleton components)
    const skeletons = document.querySelectorAll(".MuiSkeleton-root");
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("should fetch and display a list of events", async () => {
    (Request as jest.Mock).mockResolvedValue([...mockConversations]);

    (getConversation as jest.Mock)
      .mockResolvedValueOnce({
        ...mockConversations[0],
        platformTypes: availablePlatforms1,
        types: conversationTypes1,
        eventUrls: {
          zoom: { label: "Zoom", url: "https://zoom.us/j/12345333" },
          moderator: [],
          participant: [],
        },
      })
      .mockResolvedValueOnce({
        ...mockConversations[1],
        platformTypes: availablePlatforms2,
        types: conversationTypes2,
        eventUrls: {
          zoom: { label: "Zoom", url: "https://zoom.us/j/123456789" },
          moderator: [],
          participant: [],
        },
      });
    const result = await Request("conversations/userConversations");
    console.log("Request returns:", result);

    await act(async () => {
      render(<EventsPage authType={"user"} />);
    });

    await waitFor(
      () => {
        expect(screen.getByText("Test Event 1")).toBeInTheDocument();
        expect(screen.getByText("Active Event")).toBeInTheDocument();
      },
      { timeout: 3000 },
    );
  });

  it("should display an error message if fetching conversations fails", async () => {
    const errorMessage = "Failed to fetch conversations.";
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => {
        return {
          error: true,
          message: { message: errorMessage },
        };
      },
    });
    (Request as jest.Mock).mockResolvedValue({
      error: true,
      message: { message: errorMessage },
    });

    await act(async () => {
      render(<EventsPage authType={"user"} />);
    });

    await waitFor(() => {
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });
  });

  it('should load more events when "Load More" is clicked', async () => {
    const manyConversations = Array.from({ length: 10 }, (_, i) => ({
      id: `${i + 1}`,
      name: `Event ${i + 1}`,
      createdAt: "2025-11-05T10:00:00Z",
      scheduledTime: new Date(new Date().getTime() + (i + 1) * 86400000),
      active: false,
      platforms: ["zoom"],
      agents: ["Agent1"],
      platformTypes: [{ name: "zoom", label: "Zoom" }],
      types: conversationTypes1,
      eventUrls: {
        zoom: { label: "Zoom", url: "https://zoom.us/j/123456789" },
        moderator: [],
        participant: [],
      },
    }));
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => {
        return manyConversations;
      },
    });
    (Request as jest.Mock).mockResolvedValue([...manyConversations]);

    (getConversation as jest.Mock)
      // Mock first 6 detailed fetches
      .mockResolvedValueOnce(manyConversations[0])
      .mockResolvedValueOnce(manyConversations[1])
      .mockResolvedValueOnce(manyConversations[2])
      .mockResolvedValueOnce(manyConversations[3])
      .mockResolvedValueOnce(manyConversations[4])
      .mockResolvedValueOnce(manyConversations[5])
      // Mock next 4 detailed fetches
      .mockResolvedValueOnce(manyConversations[6])
      .mockResolvedValueOnce(manyConversations[7])
      .mockResolvedValueOnce(manyConversations[8])
      .mockResolvedValueOnce(manyConversations[9]);

    await act(async () => {
      render(<EventsPage authType={"user"} />);
    });

    await waitFor(
      () => {
        expect(screen.getByText("Event 1")).toBeInTheDocument();
      },
      { timeout: 3000 },
    );

    console.log(screen.debug());

    // Load More button should be visible
    const loadMoreButton = screen.getByText("Load More");
    expect(loadMoreButton).toBeInTheDocument();

    await userEvent.click(loadMoreButton);

    await waitFor(
      () => {
        expect(screen.getByText("Event 7")).toBeInTheDocument();
      },
      { timeout: 3000 },
    );
  });

  it("should display an empty state message when no events are found", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => {
        return [];
      },
    });
    (Request as jest.Mock).mockResolvedValue([]);

    await act(async () => {
      render(<EventsPage authType={"user"} />);
    });

    await waitFor(() => {
      expect(
        screen.getByText(/Currently you have no events scheduled/i),
      ).toBeInTheDocument();
    });
  });
});
