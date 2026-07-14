import React from 'react';
import { render, screen, waitFor, act, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EventsPage from '../../../pages/admin/events';
import { Request } from '../../../utils';
import { getConversation, SendData } from '../../../utils/Helpers';
import { useSessionJoin } from '../../../hooks/useSessionJoin';
import {
  generateAndDownloadUserMetricsReport,
  generateAndDownloadDirectMessageResponsesReport,
} from '../../../utils/eventReportGenerator';

const conversationTypes1 = [
  { name: 'Agent1', label: 'Agent 1' },
  { name: 'Agent2', label: 'Agent 2' },
];
const conversationTypes2 = [{ name: 'Agent3', label: 'Agent 3' }];

const availablePlatforms1 = [
  { name: 'zoom', label: 'Zoom' },
  { name: 'nextspace', label: 'Nextspace' },
];

const availablePlatforms2 = [{ name: 'slack', label: 'Slack' }];
const mockConversations = [
  {
    id: '1',
    name: 'Test Event 1',
    createdAt: '2025-11-05T10:00:00Z',
    scheduledTime: new Date(new Date().getTime() + 120000), // 2 minutes in future
    active: false,
    platforms: ['zoom', 'nextspace'],
    agents: ['Agent1', 'Agent2'],
    zoomLink: 'https://zoom.us/j/123456789',
    moderatorLinks: [{ url: 'https://example.com/mod1', label: 'Moderator Link 1' }],
    participantLinks: [{ url: 'https://example.com/part1', label: 'Participant Link 1' }],
  },
  {
    id: '2',
    name: 'Active Event',
    createdAt: '2025-11-04T10:00:00Z',
    scheduledTime: null,
    active: true,
    platforms: ['slack'],
    agents: ['Agent3'],
    moderatorLinks: [],
    participantLinks: [{ url: 'https://example.com/part2', label: 'Participant Link 2' }],
  },
  {
    id: '3',
    name: 'Past Event',
    createdAt: '2025-10-01T10:00:00Z',
    scheduledTime: '2025-10-15T14:00:00Z',
    active: false,
    platforms: ['youtube'],
    agents: ['Agent4'],
    moderatorLinks: [],
    participantLinks: [],
  },
];

// Mock dependencies
const mockPush = jest.fn();
jest.mock('next/router', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

jest.mock('../../../utils', () => ({
  Request: jest.fn(), // Ensure Request is mocked
  getUserTimezone: jest.fn(() => 'America/New_York'), // Mock timezone
}));

jest.setTimeout(120000);

jest.mock('../../../utils/Helpers', () => {
  const actual = jest.requireActual('../../../utils/Helpers');
  return {
    ...actual,
    getConversation: jest.fn(),
    SendData: jest.fn(),
  };
});

jest.mock('../../../utils/eventReportGenerator', () => ({
  generateAndDownloadUserMetricsReport: jest.fn(),
  generateAndDownloadDirectMessageResponsesReport: jest.fn(),
}));

jest.mock('../../../hooks/useSessionJoin', () => ({
  useSessionJoin: jest.fn(),
}));

describe('Events Page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Always mock Request to return mockConversations unless overridden in a specific test
    (Request as jest.Mock).mockResolvedValue(mockConversations);

    // Reset getConversation mock to avoid stale one-time mock values leaking between tests
    (getConversation as jest.Mock).mockReset();

    // Mock useSessionJoin to return a default user ID
    (useSessionJoin as jest.Mock).mockReturnValue({ userId: 'user-123' });

    // Mock fetch for detailed conversation calls
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => {
        return mockConversations;
      },
    });
  });

  it('should render a loading state initially', async () => {
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
      render(<EventsPage authType={'user'} />);
    });

    // Check for skeleton elements (MUI Skeleton components)
    const skeletons = document.querySelectorAll('.MuiSkeleton-root');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('should fetch and display a list of events', async () => {
    (Request as jest.Mock).mockResolvedValue([...mockConversations]);

    (getConversation as jest.Mock)
      .mockResolvedValueOnce({
        ...mockConversations[0],
        platformTypes: availablePlatforms1,
        types: conversationTypes1,
        eventUrls: {
          zoom: { label: 'Zoom', url: 'https://zoom.us/j/12345333' },
          moderator: [],
          participant: [],
        },
      })
      .mockResolvedValueOnce({
        ...mockConversations[1],
        platformTypes: availablePlatforms2,
        types: conversationTypes2,
        eventUrls: {
          zoom: { label: 'Zoom', url: 'https://zoom.us/j/123456789' },
          moderator: [],
          participant: [],
        },
      });

    await act(async () => {
      render(<EventsPage authType={'user'} />);
    });

    await waitFor(
      () => {
        expect(screen.getByText('Test Event 1')).toBeInTheDocument();
        expect(screen.getByText('Active Event')).toBeInTheDocument();
      },
      { timeout: 3000 },
    );
  });

  it('should display an error message if fetching conversations fails', async () => {
    const errorMessage = 'Failed to fetch conversations.';
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
      render(<EventsPage authType={'user'} />);
    });

    await waitFor(() => {
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });
  });

  it('should load more events when "Load More" is clicked', async () => {
    const manyConversations = Array.from({ length: 10 }, (_, i) => ({
      id: `${i + 1}`,
      name: `Event ${i + 1}`,
      createdAt: '2025-11-05T10:00:00Z',
      scheduledTime: new Date(new Date().getTime() + (i + 1) * 86400000),
      active: false,
      platforms: ['zoom'],
      agents: ['Agent1'],
      platformTypes: [{ name: 'zoom', label: 'Zoom' }],
      types: conversationTypes1,
      eventUrls: {
        zoom: { label: 'Zoom', url: 'https://zoom.us/j/123456789' },
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
      render(<EventsPage authType={'user'} />);
    });

    await waitFor(
      () => {
        expect(screen.getByText('Event 1')).toBeInTheDocument();
      },
      { timeout: 3000 },
    );

    // Load More button should be visible
    const loadMoreButton = screen.getByText('Load More');
    expect(loadMoreButton).toBeInTheDocument();

    await userEvent.click(loadMoreButton);

    await waitFor(
      () => {
        expect(screen.getByText('Event 7')).toBeInTheDocument();
      },
      { timeout: 3000 },
    );
  });

  it('should display an empty state message when no events are found', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => {
        return [];
      },
    });
    (Request as jest.Mock).mockResolvedValue([]);

    await act(async () => {
      render(<EventsPage authType={'user'} />);
    });

    await waitFor(() => {
      expect(screen.getByText(/No events found/i)).toBeInTheDocument();
    });
  });
});

describe('Events Page - Event Ordering', () => {
  const mockUserId = 'user-123';

  beforeEach(() => {
    jest.clearAllMocks();
    (getConversation as jest.Mock).mockReset();

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

  it('should display events from mockConversations', async () => {
    (Request as jest.Mock).mockResolvedValue([...mockConversations]);

    (getConversation as jest.Mock)
      .mockResolvedValueOnce({
        ...mockConversations[0],
        platformTypes: availablePlatforms1,
        types: conversationTypes1,
        eventUrls: {
          zoom: { label: 'Zoom', url: 'https://zoom.us/j/12345333' },
          moderator: [],
          participant: [],
        },
      })
      .mockResolvedValueOnce({
        ...mockConversations[1],
        platformTypes: availablePlatforms2,
        types: conversationTypes2,
        eventUrls: {
          zoom: { label: 'Zoom', url: 'https://zoom.us/j/123456789' },
          moderator: [],
          participant: [],
        },
      });

    await act(async () => {
      render(<EventsPage authType={'user'} />);
    });

    await waitFor(
      () => {
        expect(screen.getByText('Test Event 1')).toBeInTheDocument();
        expect(screen.getByText('Active Event')).toBeInTheDocument();
      },
      { timeout: 3000 },
    );
  });

  // Opens the filter drawer and adds the given statuses to the Status multi-select.
  // Existing selections (active, upcoming) are preserved.
  const enableStatusFilters = async (...statuses: string[]) => {
    await userEvent.click(screen.getByRole('button', { name: /filters/i }));
    const statusSelect = await screen.findByLabelText('Status');
    await userEvent.click(statusSelect);
    for (const status of statuses) {
      await userEvent.click(await screen.findByRole('option', { name: new RegExp(status, 'i') }));
    }
    await userEvent.keyboard('{Escape}'); // close Select dropdown
    await userEvent.keyboard('{Escape}'); // close Drawer
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  };

  const makeEventDetail = (
    id: string,
    name: string,
    active: boolean,
    scheduledTime: string,
    startTime?: string,
    endTime?: string,
  ) => ({
    id,
    name,
    active,
    scheduledTime,
    startTime,
    endTime,
    createdAt: scheduledTime,
    owner: 'user-456',
    platformTypes: [],
    type: { name: 'eventAssistant', label: 'Test Agent' },
    eventUrls: { zoom: null, moderator: [], participant: [] },
  });

  it('default sort (Start Date newest) sorts by start/scheduled time descending', async () => {
    const now = new Date();
    const futureTime = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString();
    const recentPastTime = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString();
    const olderPastTime = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString();

    const activeEvent = makeEventDetail('active', 'Active Event', true, recentPastTime, recentPastTime);
    const futureEvent = makeEventDetail('future', 'Future Event', false, futureTime);
    const pastEvent = {
      ...makeEventDetail('past', 'Past Event', false, olderPastTime, olderPastTime),
      endTime: olderPastTime,
    };

    (Request as jest.Mock).mockResolvedValue([pastEvent, activeEvent, futureEvent]);
    (getConversation as jest.Mock).mockImplementation((id: string) => {
      const map: Record<string, object> = { active: activeEvent, future: futureEvent, past: pastEvent };
      return Promise.resolve(map[id]);
    });

    await act(async () => {
      render(<EventsPage authType={'user'} />);
    });

    // Enable past status filter to see all three
    await enableStatusFilters('past');
    await waitFor(() => expect(screen.getByText('Past Event')).toBeInTheDocument());

    const headings = screen.getAllByRole('heading', { level: 5 });
    expect(headings[0]).toHaveTextContent('Future Event');
    expect(headings[1]).toHaveTextContent('Active Event');
    expect(headings[2]).toHaveTextContent('Past Event');
  });

  it('Status sort places active → upcoming → past → missed', async () => {
    const now = new Date();
    const futureTime = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString();
    const pastTime = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString();

    const activeEvent = makeEventDetail('active', 'Active Event', true, pastTime, pastTime);
    const upcomingEvent = makeEventDetail('upcoming', 'Upcoming Event', false, futureTime);
    const pastEvent = { ...makeEventDetail('past', 'Past Event', false, pastTime, pastTime), endTime: pastTime };
    const missedEvent = makeEventDetail('missed', 'Missed Event', false, pastTime); // no startTime, no endTime

    (Request as jest.Mock).mockResolvedValue([missedEvent, pastEvent, upcomingEvent, activeEvent]);
    (getConversation as jest.Mock).mockImplementation((id: string) => {
      const map: Record<string, object> = {
        active: activeEvent,
        upcoming: upcomingEvent,
        past: pastEvent,
        missed: missedEvent,
      };
      return Promise.resolve(map[id]);
    });

    await act(async () => {
      render(<EventsPage authType={'user'} />);
    });

    await waitFor(() => expect(screen.getByText('Upcoming Event')).toBeInTheDocument());

    // Open drawer, switch to Status sort, and enable past + missed status filters
    await userEvent.click(screen.getByRole('button', { name: /filters/i }));
    await userEvent.click(await screen.findByLabelText('Sort By'));
    await userEvent.click(await screen.findByRole('option', { name: 'Status' }));
    // Sort By closes on selection — re-open Status select within the still-open drawer
    await userEvent.click(await screen.findByLabelText('Status'));
    await userEvent.click(await screen.findByRole('option', { name: /past/i }));
    await userEvent.click(await screen.findByRole('option', { name: /missed/i }));
    await userEvent.keyboard('{Escape}'); // close Status dropdown
    await userEvent.keyboard('{Escape}'); // close Drawer
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    await waitFor(() => expect(screen.getByText('Missed Event')).toBeInTheDocument());

    const headings = screen.getAllByRole('heading', { level: 5 });
    expect(headings[0]).toHaveTextContent('Active Event');
    expect(headings[1]).toHaveTextContent('Upcoming Event');
    expect(headings[2]).toHaveTextContent('Past Event');
    expect(headings[3]).toHaveTextContent('Missed Event');
  });

  it('Start Date oldest sort places past events before future events', async () => {
    const now = new Date();
    const futureTime = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString();
    const pastTime = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString();

    const futureEvent = makeEventDetail('future', 'Future Event', false, futureTime);
    const pastEvent = { ...makeEventDetail('past', 'Past Event', false, pastTime, pastTime), endTime: pastTime };

    (Request as jest.Mock).mockResolvedValue([futureEvent, pastEvent]);
    (getConversation as jest.Mock).mockImplementation((id: string) =>
      Promise.resolve(id === 'future' ? futureEvent : pastEvent),
    );

    await act(async () => {
      render(<EventsPage authType={'user'} />);
    });

    await waitFor(() => expect(screen.getByText('Future Event')).toBeInTheDocument());

    // Open drawer, switch to ascending sort, enable past events
    await userEvent.click(screen.getByRole('button', { name: /filters/i }));
    await userEvent.click(await screen.findByLabelText('Sort By'));
    await userEvent.click(await screen.findByRole('option', { name: 'Start Date (oldest)' }));
    await userEvent.keyboard('{Escape}');
    await userEvent.click(await screen.findByLabelText('Status'));
    await userEvent.click(await screen.findByRole('option', { name: /past/i }));
    await userEvent.keyboard('{Escape}');

    await waitFor(() => expect(screen.getByText('Past Event')).toBeInTheDocument());

    const headings = screen.getAllByRole('heading', { level: 5 });
    expect(headings[0]).toHaveTextContent('Past Event');
    expect(headings[1]).toHaveTextContent('Future Event');
  });

  it('should sort multiple active events by start time descending', async () => {
    const now = new Date();
    const recentStart = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString(); // 1 day ago
    const olderStart = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString(); // 5 days ago

    const recentActiveEvent = makeEventDetail('recent-active', 'Recent Active Event', true, recentStart, recentStart);
    const olderActiveEvent = makeEventDetail('older-active', 'Older Active Event', true, olderStart, olderStart);

    (Request as jest.Mock).mockResolvedValue([olderActiveEvent, recentActiveEvent]);
    (getConversation as jest.Mock).mockImplementation((id: string) =>
      Promise.resolve(id === 'recent-active' ? recentActiveEvent : olderActiveEvent),
    );

    await act(async () => {
      render(<EventsPage authType={'user'} />);
    });

    await waitFor(() => expect(screen.getByText('Recent Active Event')).toBeInTheDocument());

    const headings = screen.getAllByRole('heading', { level: 5 });
    expect(headings[0]).toHaveTextContent('Recent Active Event');
    expect(headings[1]).toHaveTextContent('Older Active Event');
  });

  it('should sort upcoming events by scheduled time descending (furthest first)', async () => {
    const now = new Date();
    const soonTime = new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000).toISOString(); // 1 day from now
    const laterTime = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000).toISOString(); // 5 days from now

    const soonEvent = makeEventDetail('soon', 'Soon Event', false, soonTime);
    const laterEvent = makeEventDetail('later', 'Later Event', false, laterTime);

    (Request as jest.Mock).mockResolvedValue([soonEvent, laterEvent]);
    (getConversation as jest.Mock).mockImplementation((id: string) =>
      Promise.resolve(id === 'soon' ? soonEvent : laterEvent),
    );

    await act(async () => {
      render(<EventsPage authType={'user'} />);
    });

    await waitFor(() => expect(screen.getByText('Later Event')).toBeInTheDocument());

    const headings = screen.getAllByRole('heading', { level: 5 });
    expect(headings[0]).toHaveTextContent('Later Event');
    expect(headings[1]).toHaveTextContent('Soon Event');
  });

  it('should sort an early-started event by startTime, not scheduledTime', async () => {
    const now = new Date();
    const scheduledLater = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000); // scheduled 5 days from now
    const startedEarly = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000); // but actually started yesterday
    const scheduledSoon = new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000); // another event scheduled 1 day from now

    const earlyStartedEvent = {
      id: 'early-started',
      name: 'Early Started Event',
      active: false,
      scheduledTime: scheduledLater.toISOString(),
      startTime: startedEarly.toISOString(),
      endTime: new Date(startedEarly.getTime() + 60 * 60 * 1000).toISOString(),
      createdAt: scheduledLater.toISOString(),
      owner: 'user-456',
      platformTypes: [],
      type: { name: 'eventAssistant', label: 'Test Agent' },
      eventUrls: { zoom: null, moderator: [], participant: [] },
    };
    const upcomingEvent = {
      id: 'upcoming',
      name: 'Upcoming Event',
      active: false,
      scheduledTime: scheduledSoon.toISOString(),
      createdAt: scheduledSoon.toISOString(),
      owner: 'user-456',
      platformTypes: [],
      type: { name: 'eventAssistant', label: 'Test Agent' },
      eventUrls: { zoom: null, moderator: [], participant: [] },
    };

    (Request as jest.Mock).mockResolvedValue([earlyStartedEvent, upcomingEvent]);
    (getConversation as jest.Mock).mockImplementation((id: string) =>
      Promise.resolve(id === 'early-started' ? earlyStartedEvent : upcomingEvent),
    );

    await act(async () => {
      render(<EventsPage authType={'user'} />);
    });

    await waitFor(() => expect(screen.getByText('Upcoming Event')).toBeInTheDocument());

    // Enable past events to also show the early-started event
    await enableStatusFilters('past');
    await waitFor(() => expect(screen.getByText('Early Started Event')).toBeInTheDocument());

    const eventHeadings = screen.getAllByRole('heading', { level: 5 });
    // Upcoming event (1 day away) should sort before early-started event (startTime yesterday)
    expect(eventHeadings[0]).toHaveTextContent('Upcoming Event');
    expect(eventHeadings[1]).toHaveTextContent('Early Started Event');
  });

  it('should display startTime on the card when an event was started early', async () => {
    const scheduledLater = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
    const startedEarly = new Date(2026, 0, 1, 9, 0, 0); // Jan 1 2026 09:00

    const event = {
      id: 'early-started',
      name: 'Early Started Event',
      active: false,
      scheduledTime: scheduledLater.toISOString(),
      startTime: startedEarly.toISOString(),
      endTime: new Date(startedEarly.getTime() + 60 * 60 * 1000).toISOString(),
      createdAt: scheduledLater.toISOString(),
      owner: 'user-456',
      platformTypes: [],
      type: { name: 'eventAssistant', label: 'Test Agent' },
      eventUrls: { zoom: null, moderator: [], participant: [] },
    };

    (Request as jest.Mock).mockResolvedValue([event]);
    (getConversation as jest.Mock).mockResolvedValue(event);

    await act(async () => {
      render(<EventsPage authType={'user'} />);
    });

    // Enable past events to show the early-started event
    await enableStatusFilters('past');
    await waitFor(() => expect(screen.getByText('Early Started Event')).toBeInTheDocument());

    // Should show January 1 (startTime), not the scheduledTime
    expect(screen.getByText(/january 1/i)).toBeInTheDocument();
  });
});

describe('Events Page - Filtering', () => {
  const mockUserId = 'user-123';

  beforeEach(() => {
    jest.clearAllMocks();
    (getConversation as jest.Mock).mockReset();
    (useSessionJoin as jest.Mock).mockReturnValue({ userId: mockUserId });
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => [] });
  });

  const now = () => new Date();
  const fromNow = (ms: number) => new Date(Date.now() + ms).toISOString();

  const makeEvent = (overrides: object) => ({
    id: 'ev',
    name: 'Event',
    active: false,
    scheduledTime: null,
    startTime: undefined,
    endTime: undefined,
    createdAt: new Date().toISOString(),
    owner: mockUserId,
    platformTypes: [],
    type: { name: 'eventAssistant', label: 'Test Agent' },
    eventUrls: { zoom: null, moderator: [], participant: [] },
    ...overrides,
  });

  const setStatusFilter = async (...statuses: string[]) => {
    await userEvent.click(screen.getByRole('button', { name: /filters/i }));
    const drawer = await screen.findByRole('dialog');
    // Remove all current status chips using Delete key while focused
    for (const name of ['Active', 'Upcoming', 'Past', 'Missed']) {
      const chip = within(drawer).queryByRole('button', { name: new RegExp(`^${name}$`) });
      if (chip) {
        chip.focus();
        await userEvent.keyboard('{Delete}');
      }
    }
    await waitFor(() =>
      expect(within(drawer).queryAllByRole('button', { name: /^Active$|^Upcoming$|^Past$|^Missed$/i })).toHaveLength(0),
    );
    if (statuses.length > 0) {
      const statusSelect = within(drawer).getByLabelText('Status');
      await userEvent.click(statusSelect);
      for (const status of statuses) {
        await userEvent.click(await screen.findByRole('option', { name: new RegExp(`^${status}$`, 'i') }));
      }
      await userEvent.keyboard('{Escape}'); // close dropdown
      await userEvent.keyboard('{Escape}'); // close drawer
    } else {
      // No dropdown was opened, close drawer directly via close button
      await userEvent.click(screen.getByRole('button', { name: 'close-filters' }));
    }
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  };

  it('empty status filter shows all events', async () => {
    const activeEvent = makeEvent({ id: 'a', name: 'Active Event', active: true, startTime: fromNow(-1000) });
    const upcomingEvent = makeEvent({ id: 'b', name: 'Upcoming Event', scheduledTime: fromNow(86400000) });
    const pastEvent = makeEvent({ id: 'c', name: 'Past Event', startTime: fromNow(-86400000), endTime: fromNow(-3600000) });

    (Request as jest.Mock).mockResolvedValue([activeEvent, upcomingEvent, pastEvent]);
    (getConversation as jest.Mock).mockImplementation((id: string) =>
      Promise.resolve({ a: activeEvent, b: upcomingEvent, c: pastEvent }[id]),
    );

    await act(async () => {
      render(<EventsPage authType="user" />);
    });
    await waitFor(() => expect(screen.getByText('Active Event')).toBeInTheDocument());

    await setStatusFilter(); // no statuses = clear all = show all

    await waitFor(() => {
      expect(screen.getByText('Active Event')).toBeInTheDocument();
      expect(screen.getByText('Upcoming Event')).toBeInTheDocument();
      expect(screen.getByText('Past Event')).toBeInTheDocument();
    });
  });

  it('active-only filter hides upcoming and past events', async () => {
    const activeEvent = makeEvent({ id: 'a', name: 'Active Event', active: true, startTime: fromNow(-1000) });
    const upcomingEvent = makeEvent({ id: 'b', name: 'Upcoming Event', scheduledTime: fromNow(86400000) });
    const pastEvent = makeEvent({ id: 'c', name: 'Past Event', startTime: fromNow(-86400000), endTime: fromNow(-3600000) });

    (Request as jest.Mock).mockResolvedValue([activeEvent, upcomingEvent, pastEvent]);
    (getConversation as jest.Mock).mockImplementation((id: string) =>
      Promise.resolve({ a: activeEvent, b: upcomingEvent, c: pastEvent }[id]),
    );

    await act(async () => {
      render(<EventsPage authType="user" />);
    });
    await waitFor(() => expect(screen.getByText('Active Event')).toBeInTheDocument());

    await setStatusFilter('active');

    await waitFor(() => expect(screen.queryByText('Upcoming Event')).not.toBeInTheDocument());
    expect(screen.getByText('Active Event')).toBeInTheDocument();
    expect(screen.queryByText('Past Event')).not.toBeInTheDocument();
  });

  it('past-only filter shows only past events', async () => {
    const activeEvent = makeEvent({ id: 'a', name: 'Active Event', active: true, startTime: fromNow(-1000) });
    const pastEvent = makeEvent({ id: 'c', name: 'Past Event', startTime: fromNow(-86400000), endTime: fromNow(-3600000) });

    (Request as jest.Mock).mockResolvedValue([activeEvent, pastEvent]);
    (getConversation as jest.Mock).mockImplementation((id: string) => Promise.resolve({ a: activeEvent, c: pastEvent }[id]));

    await act(async () => {
      render(<EventsPage authType="user" />);
    });
    await waitFor(() => expect(screen.getByText('Active Event')).toBeInTheDocument());

    await setStatusFilter('past');

    await waitFor(() => expect(screen.getByText('Past Event')).toBeInTheDocument());
    expect(screen.queryByText('Active Event')).not.toBeInTheDocument();
  });

  it('missed-only filter shows events with no start and no end time', async () => {
    const missedEvent = makeEvent({ id: 'a', name: 'Missed Event', scheduledTime: fromNow(-86400000) });
    const upcomingEvent = makeEvent({ id: 'b', name: 'Upcoming Event', scheduledTime: fromNow(86400000) });

    (Request as jest.Mock).mockResolvedValue([missedEvent, upcomingEvent]);
    (getConversation as jest.Mock).mockImplementation((id: string) =>
      Promise.resolve({ a: missedEvent, b: upcomingEvent }[id]),
    );

    await act(async () => {
      render(<EventsPage authType="user" />);
    });
    await waitFor(() => expect(screen.getByText('Upcoming Event')).toBeInTheDocument());

    await setStatusFilter('missed');

    await waitFor(() => expect(screen.getByText('Missed Event')).toBeInTheDocument());
    expect(screen.queryByText('Upcoming Event')).not.toBeInTheDocument();
  });

  it('my events only hides events owned by other users', async () => {
    const myEvent = makeEvent({ id: 'a', name: 'Owned Event', scheduledTime: fromNow(86400000), owner: mockUserId });
    const otherEvent = makeEvent({
      id: 'b',
      name: 'Other User Event',
      scheduledTime: fromNow(86400000),
      owner: 'other-user',
    });

    (Request as jest.Mock).mockResolvedValue([myEvent, otherEvent]);
    (getConversation as jest.Mock).mockImplementation((id: string) => Promise.resolve({ a: myEvent, b: otherEvent }[id]));

    await act(async () => {
      render(<EventsPage authType="user" />);
    });
    await waitFor(() => expect(screen.getByText('Owned Event')).toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: /filters/i }));
    await userEvent.click(await screen.findByText('My events only'));
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    await waitFor(() => expect(screen.queryByText('Other User Event')).not.toBeInTheDocument());
    expect(screen.getByText('Owned Event')).toBeInTheDocument();
  });

  it('my events only combined with status filter shows only my events of that status', async () => {
    const myUpcoming = makeEvent({ id: 'a', name: 'My Upcoming', scheduledTime: fromNow(86400000), owner: mockUserId });
    const otherUpcoming = makeEvent({
      id: 'b',
      name: 'Other Upcoming',
      scheduledTime: fromNow(86400000),
      owner: 'other-user',
    });
    const myActive = makeEvent({ id: 'c', name: 'My Active', active: true, startTime: fromNow(-1000), owner: mockUserId });

    (Request as jest.Mock).mockResolvedValue([myUpcoming, otherUpcoming, myActive]);
    (getConversation as jest.Mock).mockImplementation((id: string) =>
      Promise.resolve({ a: myUpcoming, b: otherUpcoming, c: myActive }[id]),
    );

    await act(async () => {
      render(<EventsPage authType="user" />);
    });
    await waitFor(() => expect(screen.getByText('My Upcoming')).toBeInTheDocument());

    // Enable my events only and set status to upcoming only
    await userEvent.click(screen.getByRole('button', { name: /filters/i }));
    const drawer = await screen.findByRole('dialog');
    await userEvent.click(within(drawer).getByText('My events only'));
    // Remove active chip via Delete key
    const activeChip = within(drawer).getByRole('button', { name: /^Active$/i });
    activeChip.focus();
    await userEvent.keyboard('{Delete}');
    await waitFor(() => expect(within(drawer).queryByRole('button', { name: /^Active$/i })).not.toBeInTheDocument());
    await userEvent.click(within(drawer).getByRole('button', { name: 'close-filters' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    await waitFor(() => expect(screen.queryByText('Other Upcoming')).not.toBeInTheDocument());
    expect(screen.getByText('My Upcoming')).toBeInTheDocument();
    expect(screen.queryByText('My Active')).not.toBeInTheDocument();
  });

  it('Load More button is hidden when all filtered results are loaded', async () => {
    const events = Array.from({ length: 3 }, (_, i) =>
      makeEvent({ id: `ev-${i}`, name: `Event ${i}`, scheduledTime: fromNow(86400000 * (i + 1)) }),
    );

    (Request as jest.Mock).mockResolvedValue(events);
    (getConversation as jest.Mock).mockImplementation((id: string) => Promise.resolve(events.find((e: any) => e.id === id)));

    await act(async () => {
      render(<EventsPage authType="user" />);
    });
    await waitFor(() => expect(screen.getByText('Event 0')).toBeInTheDocument());

    expect(screen.queryByRole('button', { name: /load more/i })).not.toBeInTheDocument();
  });

  it('filter drawer shows From and To date range fields', async () => {
    (Request as jest.Mock).mockResolvedValue([]);

    await act(async () => {
      render(<EventsPage authType="user" />);
    });

    await userEvent.click(screen.getByRole('button', { name: /filters/i }));

    const drawer = await screen.findByRole('dialog');
    expect(within(drawer).getAllByText('From').length).toBeGreaterThan(0);
    expect(within(drawer).getAllByText('To').length).toBeGreaterThan(0);

    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('reset button restores default filters and sort', async () => {
    const activeEvent = makeEvent({
      id: 'a',
      name: 'Active Event',
      active: true,
      startTime: fromNow(-1000),
      owner: mockUserId,
    });
    const pastEvent = makeEvent({ id: 'b', name: 'Past Event', startTime: fromNow(-86400000), endTime: fromNow(-3600000) });

    (Request as jest.Mock).mockResolvedValue([activeEvent, pastEvent]);
    (getConversation as jest.Mock).mockImplementation((id: string) => Promise.resolve({ a: activeEvent, b: pastEvent }[id]));

    await act(async () => {
      render(<EventsPage authType="user" />);
    });
    await waitFor(() => expect(screen.getByText('Active Event')).toBeInTheDocument());

    // Change filters: enable past, enable my events only, change sort
    await userEvent.click(screen.getByRole('button', { name: /filters/i }));
    const statusSelect = await screen.findByLabelText('Status');
    await userEvent.click(statusSelect);
    await userEvent.click(await screen.findByRole('option', { name: /^past$/i }));
    await userEvent.keyboard('{Escape}'); // close Status dropdown
    await userEvent.click(await screen.findByText('My events only'));
    await userEvent.click(await screen.findByLabelText('Sort By'));
    await userEvent.click(await screen.findByRole('option', { name: /status/i }));
    // Sort By dropdown closes on selection; click Reset while drawer is still open
    await userEvent.click(await screen.findByRole('button', { name: /reset/i }));
    await userEvent.keyboard('{Escape}'); // close drawer
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    // Past event should no longer be visible (back to active/upcoming only)
    await waitFor(() => expect(screen.getByText('Active Event')).toBeInTheDocument());
    expect(screen.queryByText('Past Event')).not.toBeInTheDocument();
  });
});

describe('Events Page - Missed badge', () => {
  const mockUserId = 'user-123';

  beforeEach(() => {
    jest.clearAllMocks();
    (getConversation as jest.Mock).mockReset();
    (useSessionJoin as jest.Mock).mockReturnValue({ userId: mockUserId });
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => [] });
  });

  const renderWithEvent = async (event: object, statuses = ['past', 'missed']) => {
    (Request as jest.Mock).mockResolvedValue([event]);
    (getConversation as jest.Mock).mockResolvedValue(event);
    await act(async () => {
      render(<EventsPage authType={'user'} />);
    });
    // Open filter drawer and enable the relevant statuses
    await userEvent.click(screen.getByRole('button', { name: /filters/i }));
    const statusSelect = await screen.findByLabelText('Status');
    await userEvent.click(statusSelect);
    for (const status of statuses) {
      await userEvent.click(await screen.findByRole('option', { name: new RegExp(status, 'i') }));
    }
    await userEvent.keyboard('{Escape}'); // close dropdown
    await userEvent.keyboard('{Escape}'); // close drawer
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  };

  it('shows Missed badge for a scheduled event whose time has passed and never started', async () => {
    const pastScheduled = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    await renderWithEvent({
      id: 'missed-scheduled',
      name: 'Missed Scheduled Event',
      active: false,
      scheduledTime: pastScheduled,
      createdAt: pastScheduled,
      owner: mockUserId,
      platformTypes: [],
      type: { name: 'eventAssistant', label: 'Test Agent' },
      eventUrls: { zoom: null, moderator: [], participant: [] },
    });
    await waitFor(() => expect(screen.getByText('Missed Scheduled Event')).toBeInTheDocument());
    expect(document.querySelector('.bg-yellow-100')).toBeInTheDocument();
  });

  it('shows Missed badge for an event with no scheduledTime that never started', async () => {
    const createdAt = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString();
    await renderWithEvent({
      id: 'missed-no-schedule',
      name: 'Unscheduled Failed Event',
      active: false,
      scheduledTime: null,
      createdAt,
      owner: mockUserId,
      platformTypes: [],
      type: { name: 'eventAssistant', label: 'Test Agent' },
      eventUrls: { zoom: null, moderator: [], participant: [] },
    });
    await waitFor(() => expect(screen.getByText('Unscheduled Failed Event')).toBeInTheDocument());
    expect(document.querySelector('.bg-yellow-100')).toBeInTheDocument();
  });

  it('does not show Missed badge for an active event', async () => {
    const pastScheduled = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString();
    (Request as jest.Mock).mockResolvedValue([
      {
        id: 'active-event',
        name: 'Active Event',
        active: true,
        scheduledTime: pastScheduled,
        startTime: pastScheduled,
        createdAt: pastScheduled,
        owner: mockUserId,
      },
    ]);
    (getConversation as jest.Mock).mockResolvedValue({
      id: 'active-event',
      name: 'Active Event',
      active: true,
      scheduledTime: pastScheduled,
      startTime: pastScheduled,
      createdAt: pastScheduled,
      owner: mockUserId,
      platformTypes: [],
      type: { name: 'eventAssistant', label: 'Test Agent' },
      eventUrls: { zoom: null, moderator: [], participant: [] },
    });
    await act(async () => {
      render(<EventsPage authType={'user'} />);
    });
    await waitFor(() => expect(screen.getByText('Active Event')).toBeInTheDocument());
    expect(screen.queryByText('Missed')).not.toBeInTheDocument();
  });

  it('does not show Missed badge for a completed event (has endTime)', async () => {
    const pastTime = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    await renderWithEvent({
      id: 'completed',
      name: 'Completed Event',
      active: false,
      scheduledTime: pastTime,
      startTime: pastTime,
      endTime: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: pastTime,
      owner: mockUserId,
      platformTypes: [],
      type: { name: 'eventAssistant', label: 'Test Agent' },
      eventUrls: { zoom: null, moderator: [], participant: [] },
    });
    await waitFor(() => expect(screen.getByText('Completed Event')).toBeInTheDocument());
    expect(document.querySelector('.bg-yellow-100')).not.toBeInTheDocument();
  });

  it('does not show Missed badge for an upcoming scheduled event', async () => {
    const futureTime = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
    (Request as jest.Mock).mockResolvedValue([
      {
        id: 'upcoming',
        name: 'Upcoming Event',
        active: false,
        scheduledTime: futureTime,
        createdAt: futureTime,
        owner: mockUserId,
      },
    ]);
    (getConversation as jest.Mock).mockResolvedValue({
      id: 'upcoming',
      name: 'Upcoming Event',
      active: false,
      scheduledTime: futureTime,
      createdAt: futureTime,
      owner: mockUserId,
      platformTypes: [],
      type: { name: 'eventAssistant', label: 'Test Agent' },
      eventUrls: { zoom: null, moderator: [], participant: [] },
    });
    await act(async () => {
      render(<EventsPage authType={'user'} />);
    });
    await waitFor(() => expect(screen.getByText('Upcoming Event')).toBeInTheDocument());
    expect(screen.queryByText('Missed')).not.toBeInTheDocument();
  });
});

describe('Events Page - Event Ownership', () => {
  const mockUserId = 'user-123';
  const otherUserId = 'user-456';

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

  it('should correctly order and label owned vs non-owned events', async () => {
    const now = new Date();
    const recentDate = new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000);
    const olderDate = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);

    const conversations = [
      {
        id: 'my-active',
        name: 'My Active Event',
        active: true,
        scheduledTime: olderDate, // Date object, not string
        createdAt: olderDate.toISOString(),
        owner: mockUserId,
      },
      {
        id: 'other-future',
        name: 'Other Future Event',
        active: false,
        scheduledTime: recentDate, // Date object, not string
        createdAt: recentDate.toISOString(),
        owner: otherUserId,
      },
    ];

    const myActiveDetail = {
      id: 'my-active',
      name: 'My Active Event',
      active: true,
      scheduledTime: olderDate.toISOString(),
      createdAt: olderDate.toISOString(),
      owner: mockUserId,
      platformTypes: [],
      type: { label: 'Test Agent' },
      eventUrls: { zoom: null, moderator: [], participant: [] },
    };
    const otherFutureDetail = {
      id: 'other-future',
      name: 'Other Future Event',
      active: false,
      scheduledTime: recentDate.toISOString(),
      createdAt: recentDate.toISOString(),
      owner: otherUserId,
      platformTypes: [],
      type: { label: 'Test Agent' },
      eventUrls: { zoom: null, moderator: [], participant: [] },
    };

    (Request as jest.Mock).mockResolvedValue(conversations);
    (getConversation as jest.Mock).mockImplementation((id: string) =>
      Promise.resolve(id === 'my-active' ? myActiveDetail : otherFutureDetail),
    );

    await act(async () => {
      render(<EventsPage authType={'user'} />);
    });

    await waitFor(() => {
      expect(screen.queryByText('My Active Event')).toBeInTheDocument();
      expect(screen.queryByText('Other Future Event')).toBeInTheDocument();
    });

    // olderDate (+5 days) > recentDate (+1 day), so My Active Event sorts first under Start Date newest
    const allHeadings = screen.getAllByRole('heading', { level: 5 });
    expect(allHeadings[0]).toHaveTextContent('My Active Event');
    expect(allHeadings[1]).toHaveTextContent('Other Future Event');

    // Verify "My Event" badge appears only for owned event
    expect(screen.getByText('My Event')).toBeInTheDocument();

    // Verify actions menu appears for all events
    const menuButtons = screen.getAllByRole('button', { name: /actions-menu-/i });
    expect(menuButtons).toHaveLength(2);
  });
  describe('Events Page - Download Reports', () => {
    const mockUserId = 'user-123';

    beforeEach(() => {
      jest.clearAllMocks();
      (Request as jest.Mock).mockResolvedValue(mockConversations);
      (useSessionJoin as jest.Mock).mockReturnValue({ userId: mockUserId });

      // Mock successful report generation
      (generateAndDownloadUserMetricsReport as jest.Mock).mockResolvedValue(undefined);
      (generateAndDownloadDirectMessageResponsesReport as jest.Mock).mockResolvedValue(undefined);

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => mockConversations,
      });
    });

    it('should display download button only for inactive events', async () => {
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
          type: { label: 'Test Agent' },
          eventUrls: { zoom: null, moderator: [], participant: [] },
        })
        .mockResolvedValueOnce({
          ...activeEvent,
          platformTypes: availablePlatforms2,
          type: { label: 'Test Agent' },
          eventUrls: { zoom: null, moderator: [], participant: [] },
        });

      await act(async () => {
        render(<EventsPage authType={'user'} />);
      });

      await waitFor(() => {
        expect(screen.getByText('Test Event 1')).toBeInTheDocument();
      });

      // Open menu for inactive event and verify Download Reports option is present
      const menuButton = screen.getByRole('button', { name: 'actions-menu-1' });
      await userEvent.click(menuButton);
      expect(screen.getByText('Download Reports')).toBeInTheDocument();
    });

    it('should download reports when download button is clicked', async () => {
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
        type: { label: 'Test Agent' },
        eventUrls: { zoom: null, moderator: [], participant: [] },
      });

      await act(async () => {
        render(<EventsPage authType={'user'} />);
      });

      await waitFor(() => {
        expect(screen.getByText('Test Event 1')).toBeInTheDocument();
      });

      await userEvent.click(screen.getByRole('button', { name: 'actions-menu-1' }));
      await userEvent.click(screen.getByText('Download Reports'));

      await waitFor(() => {
        expect(generateAndDownloadUserMetricsReport).toHaveBeenCalledWith(
          inactiveEvent.id,
          new Date(inactiveEvent.scheduledTime),
        );
        expect(generateAndDownloadDirectMessageResponsesReport).toHaveBeenCalledWith(inactiveEvent.id);
      });
    });

    it('should use createdAt when startTime and scheduledTime are not available', async () => {
      const createdDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days ago
      const inactiveEvent = {
        ...mockConversations[0],
        active: false,
        owner: mockUserId,
        scheduledTime: null,
        startTime: undefined,
        endTime: undefined,
        createdAt: createdDate.toISOString(),
      };

      (Request as jest.Mock).mockResolvedValue([inactiveEvent]);
      (getConversation as jest.Mock).mockResolvedValue({
        ...inactiveEvent,
        platformTypes: availablePlatforms1,
        type: { label: 'Test Agent' },
        eventUrls: { zoom: null, moderator: [], participant: [] },
      });

      await act(async () => {
        render(<EventsPage authType={'user'} />);
      });

      // Enable missed events via filter drawer
      await userEvent.click(screen.getByRole('button', { name: /filters/i }));
      const drawer = await screen.findByRole('dialog');
      // Remove default Active and Upcoming chips before selecting Missed
      for (const name of ['Active', 'Upcoming']) {
        const chip = within(drawer).queryByRole('button', { name: new RegExp(`^${name}$`) });
        if (chip) {
          chip.focus();
          await userEvent.keyboard('{Delete}');
        }
      }
      await waitFor(() => expect(within(drawer).queryAllByRole('button', { name: /^Active$|^Upcoming$/i })).toHaveLength(0));
      // Wait for the filter=[] re-fetch to complete (event becomes visible when status filter is empty)
      await waitFor(() => expect(screen.getByText('Test Event 1')).toBeInTheDocument());
      const statusSelect = within(drawer).getByLabelText('Status');
      await userEvent.click(statusSelect);
      await userEvent.click(await screen.findByRole('option', { name: /^missed$/i }));
      act(() => statusSelect.focus()); // restore focus to select before closing
      await userEvent.keyboard('{Escape}'); // close Select dropdown
      await waitFor(() => expect(screen.queryByRole('listbox')).not.toBeInTheDocument());
      await userEvent.keyboard('{Escape}'); // close Drawer
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

      await waitFor(() => {
        expect(screen.getByText('Test Event 1')).toBeInTheDocument();
      });

      await userEvent.click(screen.getByRole('button', { name: 'actions-menu-1' }));
      await userEvent.click(screen.getByText('Download Reports'));

      await waitFor(() => {
        expect(generateAndDownloadUserMetricsReport).toHaveBeenCalledWith(
          inactiveEvent.id,
          new Date(inactiveEvent.createdAt!),
        );
      });
    });

    it('should show loading state during report download', async () => {
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
        type: { label: 'Test Agent' },
        eventUrls: { zoom: null, moderator: [], participant: [] },
      });

      await act(async () => {
        render(<EventsPage authType={'user'} />);
      });

      await waitFor(() => {
        expect(screen.getByText('Test Event 1')).toBeInTheDocument();
      });

      const menuButton = screen.getByRole('button', { name: 'actions-menu-1' });
      await userEvent.click(menuButton);
      await userEvent.click(screen.getByText('Download Reports'));

      // Should show loading spinner instead of menu button
      await waitFor(() => {
        expect(screen.queryByRole('button', { name: 'actions-menu-1' })).not.toBeInTheDocument();
        expect(screen.getByRole('progressbar')).toBeInTheDocument();
      });
    });

    it('should handle report download errors gracefully', async () => {
      const inactiveEvent = {
        ...mockConversations[0],
        active: false,
        owner: mockUserId,
      };

      // Mock report generation failure
      const alertMock = jest.spyOn(window, 'alert').mockImplementation(() => {});
      (generateAndDownloadUserMetricsReport as jest.Mock).mockRejectedValue(new Error('Network error'));

      (Request as jest.Mock).mockResolvedValue([inactiveEvent]);
      (getConversation as jest.Mock).mockResolvedValueOnce({
        ...inactiveEvent,
        platformTypes: availablePlatforms1,
        type: { label: 'Test Agent' },
        eventUrls: { zoom: null, moderator: [], participant: [] },
      });

      await act(async () => {
        render(<EventsPage authType={'user'} />);
      });

      await waitFor(() => {
        expect(screen.getByText('Test Event 1')).toBeInTheDocument();
      });

      await userEvent.click(screen.getByRole('button', { name: 'actions-menu-1' }));
      await userEvent.click(screen.getByText('Download Reports'));

      await waitFor(() => {
        expect(alertMock).toHaveBeenCalledWith('Failed to generate report. Please try again.');
      });

      alertMock.mockRestore();
    });
  });
});

describe('Events Page - Admin Actions', () => {
  const mockUserId = 'user-123';
  const futureTime = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
  const pastTime = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

  const makeConversation = (overrides: object) => ({
    id: 'ev-1',
    name: 'Editable Event',
    active: false,
    scheduledTime: futureTime,
    createdAt: futureTime,
    owner: 'event-owner-456', //owner intentionally not the mockUserId used to perform the actions, to test that all admins can perform actions on each others' events
    platformTypes: [],
    type: { name: 'backChannel', label: 'Back Channel' },
    eventUrls: { zoom: null, moderator: [], participant: [] },
    ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    (getConversation as jest.Mock).mockReset();
    (useSessionJoin as jest.Mock).mockReturnValue({ userId: mockUserId });
    (SendData as jest.Mock).mockResolvedValue({ id: 'ev-1' });
  });

  const renderWithEvent = async (conv: object) => {
    (Request as jest.Mock).mockResolvedValue([conv]);
    (getConversation as jest.Mock).mockResolvedValueOnce(conv);
    await act(async () => {
      render(<EventsPage authType="user" />);
    });
    await waitFor(() => expect(screen.getByText('Editable Event')).toBeInTheDocument());
  };

  it('shows an edit button for a future inactive event', async () => {
    await renderWithEvent(makeConversation({}));
    const menuButton = screen.getByRole('button', { name: `actions-menu-ev-1` });
    await userEvent.click(menuButton);
    expect(screen.getByText(/edit event/i)).toBeInTheDocument();
  });

  it('does not show an edit button for an active event', async () => {
    await renderWithEvent(makeConversation({ active: true }));
    const menuButton = screen.getByRole('button', { name: `actions-menu-ev-1` });
    await userEvent.click(menuButton);
    expect(screen.queryByText(/edit event/i)).not.toBeInTheDocument();
  });

  it('does not show an edit button for a past event', async () => {
    // Past events are filtered out by filterConversations, so no card renders.
    // We just verify no edit button appears anywhere on the page.
    const pastConv = makeConversation({ scheduledTime: pastTime });
    (Request as jest.Mock).mockResolvedValue([pastConv]);
    (getConversation as jest.Mock).mockResolvedValueOnce(pastConv);
    await act(async () => {
      render(<EventsPage authType="user" />);
    });
    await waitFor(() => expect(screen.getByText(/No events found/i)).toBeInTheDocument());
    expect(screen.queryByLabelText('Edit event')).not.toBeInTheDocument();
  });
  it('does not show an edit button for a past inactive event that was previously started', async () => {
    const pastConv = makeConversation({ scheduledTime: pastTime, startTime: pastTime, endTime: pastTime });
    (Request as jest.Mock).mockResolvedValue([pastConv]);
    (getConversation as jest.Mock).mockResolvedValue(pastConv);
    await act(async () => {
      render(<EventsPage authType="user" />);
    });

    // Enable past events via filter drawer
    await userEvent.click(screen.getByRole('button', { name: /filters/i }));
    await userEvent.click(await screen.findByLabelText('Status'));
    await userEvent.click(await screen.findByRole('option', { name: /past/i }));
    await userEvent.keyboard('{Escape}'); // close Select dropdown
    await userEvent.keyboard('{Escape}'); // close Drawer
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    await waitFor(() => expect(screen.getByText('Editable Event')).toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: 'actions-menu-ev-1' }));
    expect(screen.queryByText(/edit event/i)).not.toBeInTheDocument();
  });

  it('does not show an edit button for an event with no type set', async () => {
    /* Legacy events may have no type object, which would produce /admin/undefined/edit/<id>
       if the edit button were shown. The canEdit guard prevents this. */
    await renderWithEvent(makeConversation({ type: undefined }));
    const menuButton = screen.getByRole('button', { name: `actions-menu-ev-1` });
    await userEvent.click(menuButton);
    expect(screen.queryByText(/edit event/i)).not.toBeInTheDocument();
  });

  it('navigates to the edit page when the edit button is clicked', async () => {
    const user = userEvent.setup();
    await renderWithEvent(makeConversation({}));
    const menuButton = await screen.findByRole('button', { name: `actions-menu-ev-1` });
    await user.click(menuButton);
    const editButton = await screen.findByText(/edit event/i);
    await user.click(editButton);
    expect(mockPush).toHaveBeenCalledWith('/admin/backChannel/edit/ev-1');
  });

  // --- Delete action ---

  it('shows a delete button in the actions menu', async () => {
    await renderWithEvent(makeConversation({}));
    const menuButton = screen.getByRole('button', { name: 'actions-menu-ev-1' });
    await userEvent.click(menuButton);
    expect(screen.getByText(/delete event/i)).toBeInTheDocument();
  });

  it('opens a confirmation dialog when delete event is clicked', async () => {
    const user = userEvent.setup();
    await renderWithEvent(makeConversation({}));
    await user.click(screen.getByRole('button', { name: 'actions-menu-ev-1' }));
    await user.click(screen.getByText(/delete event/i));
    expect(screen.getByText('Delete event?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /yes, delete/i })).toBeInTheDocument();
  });

  it('calls the delete API when the confirmation is accepted', async () => {
    const user = userEvent.setup();
    await renderWithEvent(makeConversation({}));
    await user.click(screen.getByRole('button', { name: 'actions-menu-ev-1' }));
    await user.click(screen.getByText(/delete event/i));
    await user.click(screen.getByRole('button', { name: /yes, delete/i }));
    await waitFor(() =>
      expect(SendData as jest.Mock).toHaveBeenCalledWith('conversations/ev-1', {}, undefined, {
        method: 'DELETE',
      }),
    );
  });

  it('does not call the delete API when cancel is clicked', async () => {
    const user = userEvent.setup();
    await renderWithEvent(makeConversation({}));
    await user.click(screen.getByRole('button', { name: 'actions-menu-ev-1' }));
    await user.click(screen.getByText(/delete event/i));
    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(SendData as jest.Mock).not.toHaveBeenCalled();
  });

  // --- Start / End action ---

  it('shows a start button for a future inactive event', async () => {
    await renderWithEvent(makeConversation({}));
    const menuButton = screen.getByRole('button', { name: 'actions-menu-ev-1' });
    await userEvent.click(menuButton);
    expect(screen.getByText(/start event/i)).toBeInTheDocument();
  });

  it('shows an end button for an active event', async () => {
    await renderWithEvent(makeConversation({ active: true }));
    const menuButton = screen.getByRole('button', { name: 'actions-menu-ev-1' });
    await userEvent.click(menuButton);
    expect(screen.getByText(/end event/i)).toBeInTheDocument();
  });

  it('calls the start API when start event is clicked', async () => {
    const user = userEvent.setup();
    await renderWithEvent(makeConversation({}));
    await user.click(screen.getByRole('button', { name: 'actions-menu-ev-1' }));
    await user.click(screen.getByText(/start event/i));
    await waitFor(() => expect(SendData as jest.Mock).toHaveBeenCalledWith('conversations/ev-1/start', {}));
  });

  it('calls the stop API when end event is clicked', async () => {
    const user = userEvent.setup();
    await renderWithEvent(makeConversation({ active: true }));
    await user.click(screen.getByRole('button', { name: 'actions-menu-ev-1' }));
    await user.click(screen.getByText(/end event/i));
    await waitFor(() => expect(SendData as jest.Mock).toHaveBeenCalledWith('conversations/ev-1/stop', {}));
  });
});
