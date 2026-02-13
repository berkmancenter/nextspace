import React from "react";
import { render, screen, waitFor, act, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import EventsPage from "../../../pages/admin/events";
import { Request } from "../../../utils";
import { getConversation } from "../../../utils/Helpers";
import { useSessionJoin } from "../../../utils/useSessionJoin";
import {
  generateAndDownloadUserMetricsReport,
  generateAndDownloadDirectMessageResponsesReport,
} from "../../../utils/eventReportGenerator";

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

jest.mock("../../../utils/eventReportGenerator", () => ({
  generateAndDownloadUserMetricsReport: jest.fn(),
  generateAndDownloadDirectMessageResponsesReport: jest.fn(),
}));

jest.mock("../../../utils/useSessionJoin", () => ({
  useSessionJoin: jest.fn(),
}));

describe("Events Page", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Always mock Request to return mockConversations unless overridden in a specific test
    (Request as jest.Mock).mockResolvedValue(mockConversations);

    // Mock useSessionJoin to return a default user ID
    (useSessionJoin as jest.Mock).mockReturnValue({ userId: "user-123" });

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
      expect(screen.getByText(/No upcoming events/i)).toBeInTheDocument();
    });
  });
});

describe("Events Page - Event Ordering", () => {
  const mockUserId = "user-123";

  beforeEach(() => {
    jest.clearAllMocks();

    // Always mock Request to return mockConversations unless overridden in a specific test
    (Request as jest.Mock).mockResolvedValue(mockConversations);

    (useSessionJoin as jest.Mock).mockReturnValue({ userId: mockUserId });

    // Mock fetch for detailed conversation calls
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => {
        return mockConversations;
      },
    });
  });

  it("should display events from mockConversations", async () => {
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

  it("should display active events before inactive events", async () => {
    const now = new Date();
    const pastDate = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000); // 2 days ago
    const futureDate = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000); // 2 days from now

    // Use similar structure to mockConversations at top of file
    const conversations = [
      {
        id: "1",
        name: "Future Inactive Event",
        createdAt: "2025-11-05T10:00:00Z",
        scheduledTime: futureDate, // Date object, not string
        active: false,
      },
      {
        id: "2",
        name: "Active Past Event",
        createdAt: "2025-11-04T10:00:00Z",
        scheduledTime: pastDate, // Date object, not string
        active: true,
      },
    ];

    (Request as jest.Mock).mockResolvedValue(conversations);
    (getConversation as jest.Mock)
      .mockResolvedValueOnce({
        id: "2",
        name: "Active Past Event",
        createdAt: "2025-11-04T10:00:00Z",
        scheduledTime: pastDate,
        active: true,
        owner: mockUserId,
        platformTypes: [],
        type: { label: "Test Agent" },
        eventUrls: {
          zoom: null,
          moderator: [],
          participant: [],
        },
      })
      .mockResolvedValueOnce({
        id: "1",
        name: "Future Inactive Event",
        createdAt: "2025-11-05T10:00:00Z",
        scheduledTime: futureDate,
        active: false,
        owner: mockUserId,
        platformTypes: [],
        type: { label: "Test Agent" },
        eventUrls: {
          zoom: null,
          moderator: [],
          participant: [],
        },
      });

    await act(async () => {
      render(<EventsPage authType={"user"} />);
    });

    await waitFor(
      () => {
        expect(screen.queryByText("Active Past Event")).toBeInTheDocument();
      },
      { timeout: 3000 },
    );

    // Get all event cards and check their order
    const eventHeadings = screen.getAllByRole("heading", { level: 5 });
    expect(eventHeadings[0]).toHaveTextContent("Active Past Event");
    expect(eventHeadings[1]).toHaveTextContent("Future Inactive Event");
  });

  it("should sort multiple active events by most recent first", async () => {
    const now = new Date();
    const recentActive = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000); // 1 day ago
    const olderActive = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000); // 5 days ago

    const conversations = [
      {
        id: "older-active",
        name: "Older Active Event",
        active: true,
        scheduledTime: olderActive.toISOString(),
        createdAt: olderActive.toISOString(),
        owner: "user-456",
        platformTypes: [],
        eventUrls: { moderator: [], participant: [] },
      },
      {
        id: "recent-active",
        name: "Recent Active Event",
        active: true,
        scheduledTime: recentActive.toISOString(),
        createdAt: recentActive.toISOString(),
        owner: "user-456",
        platformTypes: [],
        eventUrls: { moderator: [], participant: [] },
      },
    ];

    (Request as jest.Mock).mockResolvedValue(conversations);
    (getConversation as jest.Mock)
      .mockResolvedValueOnce({
        id: "recent-active",
        name: "Recent Active Event",
        active: true,
        scheduledTime: recentActive.toISOString(),
        createdAt: recentActive.toISOString(),
        owner: "user-456",
        platformTypes: [],
        type: { label: "Test Agent" },
        eventUrls: { zoom: null, moderator: [], participant: [] },
      })
      .mockResolvedValueOnce({
        id: "older-active",
        name: "Older Active Event",
        active: true,
        scheduledTime: olderActive.toISOString(),
        createdAt: olderActive.toISOString(),
        owner: "user-456",
        platformTypes: [],
        type: { label: "Test Agent" },
        eventUrls: { zoom: null, moderator: [], participant: [] },
      });

    await act(async () => {
      render(<EventsPage authType={"user"} />);
    });

    await waitFor(() => {
      expect(screen.queryByText("Recent Active Event")).toBeInTheDocument();
    });

    const eventHeadings = screen.getAllByRole("heading", { level: 5 });
    // More recent active event should be first
    expect(eventHeadings[0]).toHaveTextContent("Recent Active Event");
    expect(eventHeadings[1]).toHaveTextContent("Older Active Event");
  });

  it("should sort inactive events by most recent first", async () => {
    const now = new Date();
    const recent = new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000); // 1 day from now
    const older = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000); // 5 days from now

    const conversations = [
      {
        id: "older-event",
        name: "Older Event",
        active: false,
        scheduledTime: older.toISOString(),
        createdAt: older.toISOString(),
        owner: "user-456",
        platformTypes: [],
        eventUrls: { moderator: [], participant: [] },
      },
      {
        id: "recent-event",
        name: "Recent Event",
        active: false,
        scheduledTime: recent.toISOString(),
        createdAt: recent.toISOString(),
        owner: "user-456",
        platformTypes: [],
        eventUrls: { moderator: [], participant: [] },
      },
    ];

    (Request as jest.Mock).mockResolvedValue(conversations);
    (getConversation as jest.Mock)
      .mockResolvedValueOnce({
        id: "recent-event",
        name: "Recent Event",
        active: false,
        scheduledTime: recent.toISOString(),
        createdAt: recent.toISOString(),
        owner: "user-456",
        platformTypes: [],
        type: { label: "Test Agent" },
        eventUrls: { zoom: null, moderator: [], participant: [] },
      })
      .mockResolvedValueOnce({
        id: "older-event",
        name: "Older Event",
        active: false,
        scheduledTime: older.toISOString(),
        createdAt: older.toISOString(),
        owner: "user-456",
        platformTypes: [],
        type: { label: "Test Agent" },
        eventUrls: { zoom: null, moderator: [], participant: [] },
      });

    await act(async () => {
      render(<EventsPage authType={"user"} />);
    });

    await waitFor(() => {
      expect(screen.queryByText("Recent Event")).toBeInTheDocument();
    });

    const eventHeadings = screen.getAllByRole("heading", { level: 5 });
    // More recent event should be first
    expect(eventHeadings[0]).toHaveTextContent("Recent Event");
    expect(eventHeadings[1]).toHaveTextContent("Older Event");
  });
});

describe("Events Page - Event Ownership", () => {
  const mockUserId = "user-123";
  const otherUserId = "user-456";

  beforeEach(() => {
    jest.clearAllMocks();

    // Always mock Request to return mockConversations unless overridden in a specific test
    (Request as jest.Mock).mockResolvedValue(mockConversations);

    (useSessionJoin as jest.Mock).mockReturnValue({ userId: mockUserId });

    // Mock fetch for detailed conversation calls
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => {
        return mockConversations;
      },
    });
  });

  it("should correctly order and label owned vs non-owned events", async () => {
    const now = new Date();
    const recentDate = new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000);
    const olderDate = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);

    const conversations = [
      {
        id: "my-active",
        name: "My Active Event",
        active: true,
        scheduledTime: olderDate, // Date object, not string
        createdAt: olderDate.toISOString(),
        owner: mockUserId,
      },
      {
        id: "other-future",
        name: "Other Future Event",
        active: false,
        scheduledTime: recentDate, // Date object, not string
        createdAt: recentDate.toISOString(),
        owner: otherUserId,
      },
    ];

    (Request as jest.Mock).mockResolvedValue(conversations);
    (getConversation as jest.Mock)
      .mockResolvedValueOnce({
        id: "my-active",
        name: "My Active Event",
        active: true,
        scheduledTime: olderDate.toISOString(),
        createdAt: olderDate.toISOString(),
        owner: mockUserId,
        platformTypes: [],
        type: { label: "Test Agent" },
        eventUrls: { zoom: null, moderator: [], participant: [] },
      })
      .mockResolvedValueOnce({
        id: "other-future",
        name: "Other Future Event",
        active: false,
        scheduledTime: recentDate.toISOString(),
        createdAt: recentDate.toISOString(),
        owner: otherUserId,
        platformTypes: [],
        type: { label: "Test Agent" },
        eventUrls: { zoom: null, moderator: [], participant: [] },
      });

    await act(async () => {
      render(<EventsPage authType={"user"} />);
    });

    await waitFor(() => {
      expect(screen.queryByText("My Active Event")).toBeInTheDocument();
      expect(screen.queryByText("Other Future Event")).toBeInTheDocument();
    });

    // Verify ordering: active first, then non-active by most recent
    const allHeadings = screen.getAllByRole("heading", { level: 5 });
    expect(allHeadings[0]).toHaveTextContent("My Active Event");
    expect(allHeadings[1]).toHaveTextContent("Other Future Event");

    // Verify "My Event" badge appears only for owned event
    expect(screen.getByText("My Event")).toBeInTheDocument();

    // Verify delete button only appears for owned event
    const deleteButtons = screen.getAllByLabelText("Delete event");
    expect(deleteButtons).toHaveLength(1);
  });
  describe("Events Page - Download Reports", () => {
    const mockUserId = "user-123";

    beforeEach(() => {
      jest.clearAllMocks();
      (Request as jest.Mock).mockResolvedValue(mockConversations);
      (useSessionJoin as jest.Mock).mockReturnValue({ userId: mockUserId });

      // Mock successful report generation
      (generateAndDownloadUserMetricsReport as jest.Mock).mockResolvedValue(
        undefined,
      );
      (
        generateAndDownloadDirectMessageResponsesReport as jest.Mock
      ).mockResolvedValue(undefined);

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => mockConversations,
      });
    });

    it("should display download button only for inactive events", async () => {
      const inactiveEvent = {
        ...mockConversations[0],
        active: false,
        owner: mockUserId,
      };
      const activeEvent = {
        ...mockConversations[1],
        active: true,
        owner: mockUserId,
      };

      (Request as jest.Mock).mockResolvedValue([inactiveEvent, activeEvent]);
      (getConversation as jest.Mock)
        .mockResolvedValueOnce({
          ...inactiveEvent,
          platformTypes: availablePlatforms1,
          type: { label: "Test Agent" },
          eventUrls: { zoom: null, moderator: [], participant: [] },
        })
        .mockResolvedValueOnce({
          ...activeEvent,
          platformTypes: availablePlatforms2,
          type: { label: "Test Agent" },
          eventUrls: { zoom: null, moderator: [], participant: [] },
        });

      await act(async () => {
        render(<EventsPage authType={"user"} />);
      });

      await waitFor(() => {
        expect(screen.getByText("Test Event 1")).toBeInTheDocument();
      });

      // Download button should appear for inactive event
      const downloadButtons = screen.getAllByLabelText(
        "Download user metrics report",
      );
      expect(downloadButtons).toHaveLength(1);
    });

    it("should download reports when download button is clicked", async () => {
      const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now
      const inactiveEvent = {
        ...mockConversations[0],
        active: false,
        owner: mockUserId,
        scheduledTime: futureDate.toISOString(),
      };

      (Request as jest.Mock).mockResolvedValue([inactiveEvent]);
      (getConversation as jest.Mock).mockResolvedValueOnce({
        ...inactiveEvent,
        platformTypes: availablePlatforms1,
        type: { label: "Test Agent" },
        eventUrls: { zoom: null, moderator: [], participant: [] },
      });

      await act(async () => {
        render(<EventsPage authType={"user"} />);
      });

      await waitFor(() => {
        expect(screen.getByText("Test Event 1")).toBeInTheDocument();
      });

      const downloadButton = screen.getByLabelText(
        "Download user metrics report",
      );
      await userEvent.click(downloadButton);

      await waitFor(() => {
        expect(generateAndDownloadUserMetricsReport).toHaveBeenCalledWith(
          inactiveEvent.id,
          new Date(inactiveEvent.scheduledTime),
        );
        expect(
          generateAndDownloadDirectMessageResponsesReport,
        ).toHaveBeenCalledWith(inactiveEvent.id);
      });
    });

    it("should use createdAt when scheduledTime is not available", async () => {
      const createdDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days ago (past event)
      const inactiveEvent = {
        ...mockConversations[0],
        active: false,
        owner: mockUserId,
        scheduledTime: null,
        createdAt: createdDate.toISOString(),
      };

      (Request as jest.Mock).mockResolvedValue([inactiveEvent]);
      (getConversation as jest.Mock).mockResolvedValueOnce({
        ...inactiveEvent,
        platformTypes: availablePlatforms1,
        type: { label: "Test Agent" },
        eventUrls: { zoom: null, moderator: [], participant: [] },
      });

      await act(async () => {
        render(<EventsPage authType={"user"} />);
      });

      // Enable "Include past events" toggle to show the event
      const includePastEventsSwitch = screen.getByRole("switch", {
        name: /include past events/i,
      });
      await userEvent.click(includePastEventsSwitch);

      await waitFor(() => {
        expect(screen.getByText("Test Event 1")).toBeInTheDocument();
      });

      const downloadButton = screen.getByLabelText(
        "Download user metrics report",
      );
      await userEvent.click(downloadButton);

      await waitFor(() => {
        expect(generateAndDownloadUserMetricsReport).toHaveBeenCalledWith(
          inactiveEvent.id,
          new Date(inactiveEvent.createdAt!),
        );
      });
    });

    it("should show loading state during report download", async () => {
      const inactiveEvent = {
        ...mockConversations[0],
        active: false,
        owner: mockUserId,
      };

      // Mock a slow report generation
      (generateAndDownloadUserMetricsReport as jest.Mock).mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 1000)),
      );

      (Request as jest.Mock).mockResolvedValue([inactiveEvent]);
      (getConversation as jest.Mock).mockResolvedValueOnce({
        ...inactiveEvent,
        platformTypes: availablePlatforms1,
        type: { label: "Test Agent" },
        eventUrls: { zoom: null, moderator: [], participant: [] },
      });

      await act(async () => {
        render(<EventsPage authType={"user"} />);
      });

      await waitFor(() => {
        expect(screen.getByText("Test Event 1")).toBeInTheDocument();
      });

      const downloadButton = screen.getByLabelText(
        "Download user metrics report",
      );
      await userEvent.click(downloadButton);

      // Should show loading spinner
      await waitFor(() => {
        const buttons = screen.getAllByRole("button");
        const downloadButtonElement = buttons.find(
          (btn) =>
            btn.getAttribute("aria-label") === "Download user metrics report",
        );
        expect(downloadButtonElement).toBeDisabled();
      });
    });

    it("should handle report download errors gracefully", async () => {
      const inactiveEvent = {
        ...mockConversations[0],
        active: false,
        owner: mockUserId,
      };

      // Mock report generation failure
      const alertMock = jest
        .spyOn(window, "alert")
        .mockImplementation(() => {});
      (generateAndDownloadUserMetricsReport as jest.Mock).mockRejectedValue(
        new Error("Network error"),
      );

      (Request as jest.Mock).mockResolvedValue([inactiveEvent]);
      (getConversation as jest.Mock).mockResolvedValueOnce({
        ...inactiveEvent,
        platformTypes: availablePlatforms1,
        type: { label: "Test Agent" },
        eventUrls: { zoom: null, moderator: [], participant: [] },
      });

      await act(async () => {
        render(<EventsPage authType={"user"} />);
      });

      await waitFor(() => {
        expect(screen.getByText("Test Event 1")).toBeInTheDocument();
      });

      const downloadButton = screen.getByLabelText(
        "Download user metrics report",
      );
      await userEvent.click(downloadButton);

      await waitFor(() => {
        expect(alertMock).toHaveBeenCalledWith(
          "Failed to generate report. Please try again.",
        );
      });

      alertMock.mockRestore();
    });
  });
});
