import React from 'react';
import { render, screen, waitFor, act, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EventsPage from '../../../pages/admin/events';
import { Request } from '../../../utils';
import { getConversation, SendData } from '../../../utils/Helpers';
import { useSessionJoin } from '../../../utils/useSessionJoin';
import {
  generateAndDownloadUserMetricsReport,
  generateAndDownloadDirectMessageResponsesReport,
} from '../../../utils/eventReportGenerator';
import { setupSortedConversations } from '../../fixtures/eventMocks';

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

jest.mock('../../../utils/useSessionJoin', () => ({
  useSessionJoin: jest.fn(),
}));

describe('Events Page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Always mock Request to return mockConversations unless overridden in a specific test
    (Request as jest.Mock).mockResolvedValue(mockConversations);

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
      expect(
        screen.getByText(/No events found. Create your first event, or adjust your filters to see more events./i),
      ).toBeInTheDocument();
    });
  });
});

describe('Events Page - Event Ordering', () => {
  const mockUserId = 'user-123';

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

  it('should display active events before inactive events', async () => {
    const now = new Date();
    const pastDate = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000); // 2 days ago
    const futureDate = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000); // 2 days from now

    // Use similar structure to mockConversations at top of file
    const conversations = [
      {
        id: '1',
        name: 'Future Inactive Event',
        createdAt: '2025-11-05T10:00:00Z',
        scheduledTime: futureDate, // Date object, not string
        active: false,
      },
      {
        id: '2',
        name: 'Active Past Event',
        createdAt: '2025-11-04T10:00:00Z',
        scheduledTime: pastDate, // Date object, not string
        active: true,
      },
    ];

    (Request as jest.Mock).mockResolvedValue(conversations);
    (getConversation as jest.Mock)
      .mockResolvedValueOnce({
        id: '2',
        name: 'Active Past Event',
        createdAt: '2025-11-04T10:00:00Z',
        scheduledTime: pastDate,
        active: true,
        owner: mockUserId,
        platformTypes: [],
        type: { label: 'Test Agent' },
        eventUrls: {
          zoom: null,
          moderator: [],
          participant: [],
        },
      })
      .mockResolvedValueOnce({
        id: '1',
        name: 'Future Inactive Event',
        createdAt: '2025-11-05T10:00:00Z',
        scheduledTime: futureDate,
        active: false,
        owner: mockUserId,
        platformTypes: [],
        type: { label: 'Test Agent' },
        eventUrls: {
          zoom: null,
          moderator: [],
          participant: [],
        },
      });

    await act(async () => {
      render(<EventsPage authType={'user'} />);
    });

    await waitFor(
      () => {
        expect(screen.queryByText('Active Past Event')).toBeInTheDocument();
      },
      { timeout: 3000 },
    );

    // Get all event cards and check their order
    const eventHeadings = screen.getAllByRole('heading', { level: 5 });
    expect(eventHeadings[0]).toHaveTextContent('Active Past Event');
    expect(eventHeadings[1]).toHaveTextContent('Future Inactive Event');
  });

  it('should sort multiple active events by most recent first', async () => {
    const now = new Date();
    const recentActive = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000); // 1 day ago
    const olderActive = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000); // 5 days ago

    const conversations = [
      {
        id: 'older-active',
        name: 'Older Active Event',
        active: true,
        scheduledTime: olderActive.toISOString(),
        createdAt: olderActive.toISOString(),
        owner: 'user-456',
        platformTypes: [],
        eventUrls: { moderator: [], participant: [] },
      },
      {
        id: 'recent-active',
        name: 'Recent Active Event',
        active: true,
        scheduledTime: recentActive.toISOString(),
        createdAt: recentActive.toISOString(),
        owner: 'user-456',
        platformTypes: [],
        eventUrls: { moderator: [], participant: [] },
      },
    ];

    (Request as jest.Mock).mockResolvedValue(conversations);
    (getConversation as jest.Mock)
      .mockResolvedValueOnce({
        id: 'recent-active',
        name: 'Recent Active Event',
        active: true,
        scheduledTime: recentActive.toISOString(),
        createdAt: recentActive.toISOString(),
        owner: 'user-456',
        platformTypes: [],
        type: { label: 'Test Agent' },
        eventUrls: { zoom: null, moderator: [], participant: [] },
      })
      .mockResolvedValueOnce({
        id: 'older-active',
        name: 'Older Active Event',
        active: true,
        scheduledTime: olderActive.toISOString(),
        createdAt: olderActive.toISOString(),
        owner: 'user-456',
        platformTypes: [],
        type: { label: 'Test Agent' },
        eventUrls: { zoom: null, moderator: [], participant: [] },
      });

    await act(async () => {
      render(<EventsPage authType={'user'} />);
    });

    await waitFor(() => {
      expect(screen.queryByText('Recent Active Event')).toBeInTheDocument();
    });

    const eventHeadings = screen.getAllByRole('heading', { level: 5 });
    // More recent active event should be first
    expect(eventHeadings[0]).toHaveTextContent('Recent Active Event');
    expect(eventHeadings[1]).toHaveTextContent('Older Active Event');
  });

  it('should sort events by scheduled time descending (latest first) by default', async () => {
    setupSortedConversations();

    await act(async () => {
      render(<EventsPage authType={'user'} />);
    });

    const eventHeadings = screen.getAllByRole('heading', { level: 5 });
    // Future scheduled event should be first by default (descending), past event should be hidden
    console.log(eventHeadings.map((h) => h.textContent));
    expect(eventHeadings[0]).toHaveTextContent('Future Event');
    expect(eventHeadings[1]).toHaveTextContent('Middle Event');
    expect(eventHeadings[2]).toBeUndefined(); // Past event should not be shown by default
  });
});

describe('Events Page - All Other Event Sorting/Filtering', () => {
  const mockUserId = 'user-123';
  beforeEach(async () => {
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

    setupSortedConversations();

    await act(async () => {
      render(<EventsPage authType={'user'} />);
    });

    // Open filters
    const filtersButton = screen.getByRole('button', { name: /filters/i });
    await userEvent.click(filtersButton);

    expect(screen.queryByText('Filters & Sorting')).toBeInTheDocument();
  });

  it('should sort events by scheduled time ascending (oldest first) when that sort is applied in filters', async () => {
    // Click on Sort By select
    const sortBySelect = screen.getByLabelText(/sort by/i);
    await userEvent.click(sortBySelect);

    // Change sort to "Oldest"
    const oldestOption = await screen.findByRole('option', { name: /oldest/i });
    await userEvent.click(oldestOption);

    // Dismiss filters drawer by clicking close-filters button
    const closeFiltersButton = screen.getByRole('button', { name: /close-filters/i });
    await userEvent.click(closeFiltersButton);

    // Wait for close
    await waitFor(() => {
      expect(screen.queryByText('Filters & Sorting')).not.toBeInTheDocument();
    });

    const eventHeadings = screen.getAllByRole('heading', { level: 5 });
    // Earliest scheduled event should be first when sorted ascending by scheduled time
    // expect(eventHeadings[0]).toHaveTextContent('Earliest Event');
    expect(eventHeadings[0]).toHaveTextContent('Middle Event');
    expect(eventHeadings[1]).toHaveTextContent('Future Event');
  });

  it('should sort events by scheduled time ascending (oldest first) and show past events when that sort/filter is applied', async () => {
    const sortBySelect = screen.getByLabelText(/sort by/i);
    // Click on Sort By select
    await userEvent.click(sortBySelect);

    // Change sort to "Oldest"
    const oldestOption = await screen.findByRole('option', { name: /oldest/i });
    await userEvent.click(oldestOption);

    // Click on Status filter
    const statusFilter = screen.getByLabelText(/status/i);
    await userEvent.click(statusFilter);

    // Click Past Events option
    const pastEventsOption = await screen.findByRole('option', { name: /past events/i });
    await userEvent.click(pastEventsOption);

    // Dismiss filters drawer by clicking outside the drawer (simulate clicking backdrop)
    const backdrop = document.querySelector('.MuiBackdrop-root') as HTMLElement;
    await userEvent.click(backdrop);

    // Wait for close
    await waitFor(() => {
      expect(screen.queryByText('Filters & Sorting')).not.toBeInTheDocument();
    });

    const eventHeadings = screen.getAllByRole('heading', { level: 5 });
    // Earliest scheduled event in the past should be first when sorted ascending by scheduled time
    expect(eventHeadings[0]).toHaveTextContent('Earliest Event');
    expect(eventHeadings[1]).toHaveTextContent('Middle Event');
    expect(eventHeadings[2]).toHaveTextContent('Future Event');
  });

  it('should sort events by date created ascending when that sort is applied in filters', async () => {
    // Click on Sort By select
    const sortBySelect = screen.getByLabelText(/sort by/i);
    await userEvent.click(sortBySelect);

    const dateCreatedAscOption = await screen.findByRole('option', { name: /date created \(ascending\)/i });
    await userEvent.click(dateCreatedAscOption);

    // Dismiss filters drawer by clicking outside the drawer (simulate clicking backdrop)
    const backdrop = document.querySelector('.MuiBackdrop-root') as HTMLElement;
    await userEvent.click(backdrop);

    // Wait for close
    await waitFor(() => {
      expect(screen.queryByText('Filters & Sorting')).not.toBeInTheDocument();
    });

    const eventHeadings = screen.getAllByRole('heading', { level: 5 });
    // Middle event should be first when sorted ascending by date created given the createdAt times in setupSortedConversations
    expect(eventHeadings[0]).toHaveTextContent('Middle Event');
    expect(eventHeadings[1]).toHaveTextContent('Future Event');
  });

  it('should not show events before start date filter', async () => {
    // Set start date <input> field to after the earliest event
    // const startDateInput = screen.getByLabelText(/start date/i, { selector: 'input' });
    // fireEvent.change(startDateInput, { target: { value: '2025-11-01' } });
    // // Ensure value is set correctly (some date libraries/components can be finicky about this)
    // expect(startDateInput).toHaveValue('2025-11-01');

    // Find the "Start Date" picker's container group
    const startDateGroup = screen.getByRole('group', { name: /start date/i });

    // Click the month section and type
    const monthSection = within(startDateGroup).getByRole('spinbutton', { name: /month/i });
    await userEvent.click(monthSection);
    await userEvent.keyboard('11');
    // Click the day section and type
    const daySection = within(startDateGroup).getByRole('spinbutton', { name: /day/i });
    await userEvent.click(daySection);
    await userEvent.keyboard('01');
    // Click the year section and type
    const yearSection = within(startDateGroup).getByRole('spinbutton', { name: /year/i });
    await userEvent.click(yearSection);
    await userEvent.keyboard('2025');

    // Dismiss filters drawer
    const closeFiltersButton = screen.getByRole('button', { name: /close-filters/i });
    await userEvent.click(closeFiltersButton);

    await waitFor(() => {
      expect(screen.queryByText('Filters & Sorting')).not.toBeInTheDocument();
    });

    // Earliest Event should not be visible; later events should remain
    expect(screen.queryByText('Earliest Event')).not.toBeInTheDocument();
    expect(screen.getByText('Middle Event')).toBeInTheDocument();
    expect(screen.getByText('Future Event')).toBeInTheDocument();
  });

  it('should not show events after end date filter', async () => {
    // Find the "End Date" picker's container group
    const endDateGroup = screen.getByRole('group', { name: /end date/i });
    // Click the month section and type
    const monthSection = within(endDateGroup).getByRole('spinbutton', { name: /month/i });
    await userEvent.click(monthSection);
    await userEvent.keyboard('11');
    // Click the day section and type
    const daySection = within(endDateGroup).getByRole('spinbutton', { name: /day/i });
    await userEvent.click(daySection);
    await userEvent.keyboard('01');
    // Click the year section and type
    const yearSection = within(endDateGroup).getByRole('spinbutton', { name: /year/i });
    await userEvent.click(yearSection);
    await userEvent.keyboard('2025');

    // Dismiss filters drawer
    const closeFiltersButton = screen.getByRole('button', { name: /close-filters/i });
    await userEvent.click(closeFiltersButton);

    await waitFor(() => {
      expect(screen.queryByText('Filters & Sorting')).not.toBeInTheDocument();
    });

    // Future Event should not be visible; earlier but not past events should remain
    expect(screen.queryByText('Future Event')).not.toBeInTheDocument();
    expect(screen.queryByText('Middle Event')).not.toBeInTheDocument();
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

    (Request as jest.Mock).mockResolvedValue(conversations);
    (getConversation as jest.Mock)
      .mockResolvedValueOnce({
        id: 'my-active',
        name: 'My Active Event',
        active: true,
        scheduledTime: olderDate.toISOString(),
        createdAt: olderDate.toISOString(),
        owner: mockUserId,
        platformTypes: [],
        type: { label: 'Test Agent' },
        eventUrls: { zoom: null, moderator: [], participant: [] },
      })
      .mockResolvedValueOnce({
        id: 'other-future',
        name: 'Other Future Event',
        active: false,
        scheduledTime: recentDate.toISOString(),
        createdAt: recentDate.toISOString(),
        owner: otherUserId,
        platformTypes: [],
        type: { label: 'Test Agent' },
        eventUrls: { zoom: null, moderator: [], participant: [] },
      });

    await act(async () => {
      render(<EventsPage authType={'user'} />);
    });

    await waitFor(() => {
      expect(screen.queryByText('My Active Event')).toBeInTheDocument();
      expect(screen.queryByText('Other Future Event')).toBeInTheDocument();
    });

    // Verify ordering: active first, then non-active by most recent
    const allHeadings = screen.getAllByRole('heading', { level: 5 });
    expect(allHeadings[0]).toHaveTextContent('My Active Event');
    expect(allHeadings[1]).toHaveTextContent('Other Future Event');

    // Verify "My Event" badge appears only for owned event
    expect(screen.getByText('My Event')).toBeInTheDocument();

    // Click menu button (aria-label="actions-menu")
    const menuButton = screen.getByRole('button', { name: 'actions-menu-my-active' });
    await userEvent.click(menuButton);

    // Verify delete button only appears for owned event
    const deleteButtons = screen.getAllByText(/delete event/i);
    expect(deleteButtons).toHaveLength(1);
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

      const menuButton = screen.getByRole('button', { name: `actions-menu-${inactiveEvent.id}` });
      await userEvent.click(menuButton);

      // Download button should appear for inactive event
      const downloadButtons = screen.getAllByText(/download metrics/i);
      expect(downloadButtons).toHaveLength(1);
    });

    it('should download reports when download button is clicked', async () => {
      const pastDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days ago (past event)
      const inactiveEvent = {
        ...mockConversations[0],
        active: false,
        owner: mockUserId,
        scheduledTime: pastDate.toISOString(),
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

      // Open filters
      const filtersButton = screen.getByRole('button', { name: /filters/i });
      await userEvent.click(filtersButton);

      // Enable "past events" in "event-status-select" dropdown
      const eventStatusSelect = screen.getByLabelText('Status');
      await userEvent.click(eventStatusSelect);
      const includePastEventsOption = within(screen.getByRole('listbox')).getByText(/Past Events/i);
      await userEvent.click(includePastEventsOption);

      // Dismiss filters drawer by clicking outside the drawer (simulate clicking backdrop)
      const backdrop = document.querySelector('.MuiBackdrop-root') as HTMLElement;
      await userEvent.click(backdrop);

      await waitFor(() => {
        expect(screen.queryByText('Filters & Sorting')).not.toBeInTheDocument();
      });

      await waitFor(() => {
        expect(screen.getByText('Test Event 1')).toBeInTheDocument();
      });

      const menuButton = screen.getByRole('button', { name: `actions-menu-${inactiveEvent.id}` });
      await userEvent.click(menuButton);

      const downloadButton = screen.getByText(/download metrics/i);
      await userEvent.click(downloadButton);

      await waitFor(() => {
        expect(generateAndDownloadUserMetricsReport).toHaveBeenCalledWith(
          inactiveEvent.id,
          new Date(inactiveEvent.scheduledTime),
        );
        expect(generateAndDownloadDirectMessageResponsesReport).toHaveBeenCalledWith(inactiveEvent.id);
      });
    });

    it('should use createdAt when scheduledTime is not available', async () => {
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
        type: { label: 'Test Agent' },
        eventUrls: { zoom: null, moderator: [], participant: [] },
      });

      await act(async () => {
        render(<EventsPage authType={'user'} />);
      });

      // Open filters
      const filtersButton = screen.getByRole('button', { name: /filters/i });
      await userEvent.click(filtersButton);

      // Enable "past events" in "event-status-select" dropdown
      const eventStatusSelect = screen.getByLabelText('Status');
      await userEvent.click(eventStatusSelect);
      const includePastEventsOption = within(screen.getByRole('listbox')).getByText(/Past Events/i);
      await userEvent.click(includePastEventsOption);

      // Dismiss filters drawer by clicking outside the drawer (simulate clicking backdrop)
      const backdrop = document.querySelector('.MuiBackdrop-root') as HTMLElement;
      await userEvent.click(backdrop);

      await waitFor(() => {
        expect(screen.queryByText('Filters & Sorting')).not.toBeInTheDocument();
      });

      await waitFor(() => {
        expect(screen.getByText('Test Event 1')).toBeInTheDocument();
      });

      const menuButton = screen.getByRole('button', { name: `actions-menu-${inactiveEvent.id}` });
      await userEvent.click(menuButton);

      const downloadButton = screen.getByText(/download metrics/i);
      await userEvent.click(downloadButton);

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

      const menuButton = screen.getByRole('button', { name: `actions-menu-${inactiveEvent.id}` });
      await userEvent.click(menuButton);

      const downloadButton = screen.getByText(/download metrics/i);
      await userEvent.click(downloadButton);

      // Should show loading spinner instead of menu button
      await waitFor(() => {
        expect(menuButton).not.toBeInTheDocument();
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

      const menuButton = screen.getByRole('button', { name: `actions-menu-${inactiveEvent.id}` });
      await userEvent.click(menuButton);

      const downloadButton = screen.getByText(/download metrics/i);
      await userEvent.click(downloadButton);

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
    owner: mockUserId,
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

  it('shows an edit button for a future inactive event owned by the current user', async () => {
    await renderWithEvent(makeConversation({}));
    // Click menu button (aria-label="actions-menu")
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

  it('does not show an actions menu for an event owned by another user', async () => {
    await renderWithEvent(makeConversation({ owner: 'someone-else' }));
    const menuButton = screen.queryByRole('button', { name: `actions-menu-ev-1` });
    expect(menuButton).not.toBeInTheDocument();
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
    await waitFor(() =>
      expect(
        screen.getByText('No events found. Create your first event, or adjust your filters to see more events.'),
      ).toBeInTheDocument(),
    );
    const menuButton = screen.queryByRole('button', { name: 'actions-menu' });
    expect(menuButton).not.toBeInTheDocument();
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

  it('shows a delete button for an event owned by the current user', async () => {
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

  it('shows a start button for a future inactive owned event', async () => {
    await renderWithEvent(makeConversation({}));
    const menuButton = screen.getByRole('button', { name: 'actions-menu-ev-1' });
    await userEvent.click(menuButton);
    expect(screen.getByText(/start event/i)).toBeInTheDocument();
  });

  it('shows an end button for an active owned event', async () => {
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
