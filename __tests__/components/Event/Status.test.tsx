import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EventStatus } from '../../../components';
import { Conversation } from '../../../types.internal';

const mockPush = jest.fn();
jest.mock('next/router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('../../../utils/SessionManager', () => ({
  __esModule: true,
  default: {
    get: () => ({
      getSessionInfo: () => ({ userId: 'current-user-id' }),
    }),
  },
}));

const writeText = jest.fn();
Object.assign(navigator, { clipboard: { writeText } });

describe('EventStatus (pending state)', () => {
  // `now` sits well before the scheduled start, so a draft event derives to `pending`
  // (unconfirmed, but not yet within the 6-minute edit-lockout that flips it to `missed`).
  const now = new Date('2026-08-01T10:00:00Z');
  const farFutureScheduledTime = '2026-08-01T16:00:00Z';

  const baseConversationData: Conversation = {
    id: 'conv-123',
    name: 'Test Event',
    active: false,
    locked: false,
    slug: 'test-event',
    draft: true,
    scheduledTime: farFutureScheduledTime,
    owner: 'current-user-id',
    topic: {
      name: 'Legal Frontiers Seminar Series',
      conversations: [],
      votingAllowed: false,
      owner: { username: 'user1', password: 'foo', pseudonyms: [] },
      conversationCreationAllowed: false,
      private: false,
      archivable: false,
      followers: [],
    },
    createdAt: '2025-10-17T00:00:00Z',
    channels: [{ name: 'transcript', passcode: 'trans-pass', direct: false }],
    agents: [],
    followed: undefined,
    messageCount: 10,
    adapters: [],
    messages: [],
    followers: [],
    enableDMs: [],
    experiments: [],
    eventUrls: {
      moderator: [{ label: 'Moderator link', url: 'http://localhost:8080/assistant/?conversationId=conv-123' }],
      participant: [{ label: 'Participant link', url: 'http://localhost:8080/fake/?conversationId=conv-123' }],
    },
    type: {
      name: 'eventAssistant',
      label: 'Event Assistant',
      description: 'An assistant to answer questions about an event',
      platforms: [],
      properties: [],
    },
  };

  const renderStatus = (overrides: Partial<Conversation> = {}, onJumpToSection = jest.fn()) => {
    const data = { ...baseConversationData, ...overrides };
    render(<EventStatus conversationData={data} now={now} onJumpToSection={onJumpToSection} />);
    return { onJumpToSection };
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('operations bar', () => {
    it('shows a "Not started" status pill', () => {
      renderStatus();
      expect(screen.getByText('Not started')).toBeInTheDocument();
    });

    it('renders moderator, participant, and zoom link chips', () => {
      renderStatus({
        eventUrls: {
          ...baseConversationData.eventUrls,
          zoom: { label: 'Zoom', url: 'https://zoom.us/j/123456789' },
        },
      });
      expect(screen.getByRole('button', { name: /moderator link/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /participant link/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /zoom/i })).toBeInTheDocument();
    });

    it('disables the link chips in the pending state', () => {
      renderStatus();
      const moderatorChip = screen.getByRole('button', { name: /moderator link/i });
      expect(moderatorChip).toHaveAttribute('aria-disabled', 'true');
    });

    it('does not copy to the clipboard when a disabled chip is clicked', async () => {
      const user = userEvent.setup();
      renderStatus();
      await user.click(screen.getByRole('button', { name: /moderator link/i }));
      expect(writeText).not.toHaveBeenCalled();
    });

    it('renders neutral gray link-chip dots while the event is unconfirmed', () => {
      renderStatus();
      const moderatorChip = screen.getByRole('button', { name: /moderator link/i });
      expect(within(moderatorChip).getByTestId('chip-dot')).toHaveStyle({ backgroundColor: '#B0B0B8' });
    });

    it('uses the brand-colored dot once the event is confirmed', () => {
      // draft: false with a far-future start derives to `scheduled`, so the chips are live and colored.
      renderStatus({ draft: false });
      const moderatorChip = screen.getByRole('button', { name: /moderator link/i });
      expect(within(moderatorChip).getByTestId('chip-dot')).toHaveStyle({ backgroundColor: '#4845D2' });
    });

    it('does not render a "Start Event" button', () => {
      renderStatus();
      expect(screen.queryByRole('button', { name: /start event/i })).not.toBeInTheDocument();
    });

    it('renders an "Edit" action that navigates to the edit page', async () => {
      const user = userEvent.setup();
      renderStatus();
      const editButton = screen.getByRole('button', { name: /^edit$/i });
      await user.click(editButton);
      expect(mockPush).toHaveBeenCalledWith('/admin/eventAssistant/edit/conv-123');
    });

    it('shows a hint line noting details still need confirming', () => {
      renderStatus();
      expect(screen.getByText(/still need confirming/i)).toBeInTheDocument();
    });
  });

  describe('readiness banner', () => {
    it('renders the "Almost ready" checklist heading', () => {
      renderStatus();
      expect(screen.getByText(/almost ready/i)).toBeInTheDocument();
    });

    it('lists the Series row and rows for missing details only', () => {
      // baseConversationData has a start time but no end time and no meeting link.
      renderStatus();
      expect(screen.getByText('Series')).toBeInTheDocument();
      expect(screen.getByText('End time')).toBeInTheDocument();
      expect(screen.getByText('Platform & meeting link')).toBeInTheDocument();
    });

    it('does not list a row for Assistant configuration, which is never a missing field', () => {
      renderStatus();
      expect(screen.queryByText('Assistant configuration')).not.toBeInTheDocument();
    });

    it('lists only the Series row when every schedule and platform detail is filled in', () => {
      renderStatus({
        scheduledEndTime: '2026-08-01T17:30:00Z',
        eventUrls: {
          ...baseConversationData.eventUrls,
          zoom: { label: 'Zoom', url: 'https://zoom.us/j/123456789' },
        },
      });
      expect(screen.getByText('Series')).toBeInTheDocument();
      expect(screen.queryByText('End time')).not.toBeInTheDocument();
      expect(screen.queryByText('Start time')).not.toBeInTheDocument();
      expect(screen.queryByText('Platform & meeting link')).not.toBeInTheDocument();
    });

    it('shows the Platform & meeting link row when no meeting link is configured', () => {
      renderStatus();
      expect(screen.getByText('Platform & meeting link')).toBeInTheDocument();
    });

    it('hides the Platform & meeting link row when a meeting link is configured', () => {
      renderStatus({
        eventUrls: {
          ...baseConversationData.eventUrls,
          zoom: { label: 'Zoom', url: 'https://zoom.us/j/123456789' },
        },
      });
      expect(screen.queryByText('Platform & meeting link')).not.toBeInTheDocument();
    });

    it('hides the End time row when a scheduled end time is set', () => {
      renderStatus({ scheduledEndTime: '2026-08-01T17:30:00Z' });
      expect(screen.queryByText('End time')).not.toBeInTheDocument();
    });

    it('calls onJumpToSection with the target card id when a Review control is clicked', async () => {
      const user = userEvent.setup();
      const { onJumpToSection } = renderStatus();
      const endTimeRow = screen.getByText('End time').closest('[data-testid="checklist-row"]') as HTMLElement;
      await user.click(within(endTimeRow).getByRole('button', { name: /review/i }));
      expect(onJumpToSection).toHaveBeenCalledWith('sched-1a');
    });

    it('jumps to the Event Details card from the Series row', async () => {
      const user = userEvent.setup();
      const { onJumpToSection } = renderStatus();
      const seriesRow = screen.getByText('Series').closest('[data-testid="checklist-row"]') as HTMLElement;
      await user.click(within(seriesRow).getByRole('button', { name: /review/i }));
      expect(onJumpToSection).toHaveBeenCalledWith('details-1a');
    });

    it('hides the Series row after its Dismiss button is clicked', async () => {
      const user = userEvent.setup();
      renderStatus();
      const seriesRow = screen.getByText('Series').closest('[data-testid="checklist-row"]') as HTMLElement;
      await user.click(within(seriesRow).getByRole('button', { name: /dismiss/i }));
      expect(screen.queryByText('Series')).not.toBeInTheDocument();
    });
  });
});
