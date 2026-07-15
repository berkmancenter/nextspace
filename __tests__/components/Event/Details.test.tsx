import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { EventDetails } from '../../../components';
import { Conversation } from '../../../types.internal';

describe('EventDetails', () => {
  const now = new Date('2026-08-01T10:00:00Z');
  const farFutureScheduledTime = '2026-08-01T16:00:00Z'; // more than 6 minutes past `now`

  const baseConversationData: Conversation = {
    id: 'conv-123',
    name: 'Test Event',
    active: false,
    locked: false,
    slug: 'test-event',
    draft: true,
    scheduledTime: farFutureScheduledTime,
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
    owner: { username: 'user1', password: 'foo', pseudonyms: [] },
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
    eventUrls: { moderator: [], participant: [] },
    type: {
      name: 'eventAssistant',
      label: 'Event Assistant',
      description: 'An assistant to answer questions about an event',
      platforms: [],
      properties: [],
    },
  };

  const renderAt = (conversationData: Conversation) =>
    render(<EventDetails conversationData={conversationData} now={now} />);

  const expandSection = (title: string) => fireEvent.click(screen.getByRole('button', { name: new RegExp(title) }));

  // Mirrors Details.tsx's short (seconds-less) date-time format so assertions stay env-independent.
  const shortDateTime = (iso: string) =>
    new Date(iso).toLocaleString([], {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });

  describe('section headers', () => {
    it('renders all six section headers', () => {
      renderAt(baseConversationData);
      expect(screen.getByRole('button', { name: /Event Details/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Schedule/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Platform & format/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Assistant configuration/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Moderators & presenters/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Reading & resources/ })).toBeInTheDocument();
    });

    it('starts every section collapsed', () => {
      renderAt({ ...baseConversationData, description: 'A talk about robots.', properties: { botName: 'Berkie' } });
      // Body content from an Event Details (first) and Assistant configuration (last) card stays hidden.
      expect(screen.queryByText('A talk about robots.')).not.toBeInTheDocument();
      expect(screen.queryByText('Berkie')).not.toBeInTheDocument();
    });

    it('expands a section when its header is clicked', () => {
      renderAt({ ...baseConversationData, description: 'A talk about robots.' });
      expect(screen.queryByText('A talk about robots.')).not.toBeInTheDocument();
      expandSection('Event Details');
      expect(screen.getByText('A talk about robots.')).toBeInTheDocument();
    });
  });

  describe('Event Details section', () => {
    it('shows the needs-attention callout for an unconfirmed (draft) event', () => {
      renderAt(baseConversationData);
      expandSection('Event Details');
      expect(screen.getByText(/leave it as-is/)).toBeInTheDocument();
    });

    it('does not show the needs-attention callout for a confirmed event', () => {
      renderAt({ ...baseConversationData, draft: false });
      expandSection('Event Details');
      expect(screen.queryByText(/leave it as-is/)).not.toBeInTheDocument();
    });

    it('shows the series name and a PUBLIC badge when the topic is public', () => {
      renderAt({ ...baseConversationData, topic: { ...(baseConversationData.topic as any), private: false } });
      expandSection('Event Details');
      expect(screen.getByText('Legal Frontiers Seminar Series')).toBeInTheDocument();
      expect(screen.getByText('PUBLIC')).toBeInTheDocument();
      expect(screen.getByText(/retained in memory for Berkie/)).toBeInTheDocument();
    });

    it('does not show a PUBLIC badge and shows private retention copy when the topic is private', () => {
      renderAt({ ...baseConversationData, topic: { ...(baseConversationData.topic as any), private: true } });
      expandSection('Event Details');
      expect(screen.queryByText('PUBLIC')).not.toBeInTheDocument();
      expect(screen.getByText(/not retained/)).toBeInTheDocument();
    });

    it('renders the description when present and omits it when absent', () => {
      const { rerender } = renderAt({ ...baseConversationData, description: 'A talk about robots.' });
      expandSection('Event Details');
      expect(screen.getByText('A talk about robots.')).toBeInTheDocument();
      rerender(<EventDetails conversationData={baseConversationData} now={now} />);
      expect(screen.queryByText('A talk about robots.')).not.toBeInTheDocument();
    });

    it('hides the needs-attention callout when its dismiss button is clicked', () => {
      renderAt(baseConversationData);
      expandSection('Event Details');
      expect(screen.getByText(/leave it as-is/)).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: /dismiss/i }));
      expect(screen.queryByText(/leave it as-is/)).not.toBeInTheDocument();
    });
  });

  describe('Schedule section', () => {
    it('shows a Needs attention chip in the header for an unconfirmed event', () => {
      renderAt(baseConversationData);
      const header = screen.getByRole('button', { name: /Schedule/ });
      expect(within(header).getByText('Needs attention')).toBeInTheDocument();
    });

    it('does not show a Needs attention chip when both start and end times are present', () => {
      renderAt({ ...baseConversationData, draft: false, scheduledEndTime: '2026-08-01T17:30:00Z' });
      const header = screen.getByRole('button', { name: /Schedule/ });
      expect(within(header).queryByText('Needs attention')).not.toBeInTheDocument();
    });

    it('does not show a Needs attention chip for an unconfirmed event whose times are all filled in', () => {
      renderAt({ ...baseConversationData, draft: true, scheduledEndTime: '2026-08-01T17:30:00Z' });
      const header = screen.getByRole('button', { name: /Schedule/ });
      expect(within(header).queryByText('Needs attention')).not.toBeInTheDocument();
    });

    it('does not show a Needs attention chip once the event has ended, even with a missing time', () => {
      renderAt({ ...baseConversationData, endTime: '2026-08-01T17:30:00Z' });
      const header = screen.getByRole('button', { name: /Schedule/ });
      expect(within(header).queryByText('Needs attention')).not.toBeInTheDocument();
    });

    it('shows the formatted start and end time without seconds when scheduledEndTime is present', () => {
      renderAt({ ...baseConversationData, scheduledEndTime: '2026-08-01T17:30:00Z' });
      expandSection('Schedule');
      expect(screen.getByText(shortDateTime(farFutureScheduledTime), { exact: false })).toBeInTheDocument();
      expect(screen.getByText(shortDateTime('2026-08-01T17:30:00Z'), { exact: false })).toBeInTheDocument();
    });

    it('shows "Not set yet" for a missing scheduledEndTime', () => {
      renderAt(baseConversationData);
      expandSection('Schedule');
      expect(screen.getByText('Not set yet')).toBeInTheDocument();
    });

    it("shows the viewer's time zone derived from scheduledTime", () => {
      renderAt(baseConversationData);
      expandSection('Schedule');
      const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      expect(screen.getByText('Time zone')).toBeInTheDocument();
      expect(screen.getByText(zone, { exact: false })).toBeInTheDocument();
    });

    it('labels the times "Started"/"Ended" and shows the actual run times for a past event', () => {
      renderAt({
        ...baseConversationData,
        draft: false,
        scheduledTime: farFutureScheduledTime,
        scheduledEndTime: '2026-08-01T17:30:00Z',
        startTime: '2026-08-01T16:03:00Z',
        endTime: '2026-08-01T17:45:00Z',
      });
      expandSection('Schedule');
      expect(screen.getByText('Started')).toBeInTheDocument();
      expect(screen.getByText('Ended')).toBeInTheDocument();
      expect(screen.queryByText('Starts')).not.toBeInTheDocument();
      expect(screen.queryByText('Ends')).not.toBeInTheDocument();
      // The actual run times, not the planned ones.
      expect(screen.getByText(shortDateTime('2026-08-01T16:03:00Z'), { exact: false })).toBeInTheDocument();
      expect(screen.getByText(shortDateTime('2026-08-01T17:45:00Z'), { exact: false })).toBeInTheDocument();
    });

    it('falls back to the scheduled times when a past event has no stamped run times', () => {
      renderAt({
        ...baseConversationData,
        draft: false,
        scheduledTime: farFutureScheduledTime,
        scheduledEndTime: '2026-08-01T17:30:00Z',
        endTime: '2026-08-01T17:45:00Z', // marks it past, but no startTime stamped
      });
      expandSection('Schedule');
      // startTime missing, so "Started" falls back to the scheduled start.
      expect(screen.getByText(shortDateTime(farFutureScheduledTime), { exact: false })).toBeInTheDocument();
    });
  });

  describe('Platform & format section', () => {
    it('shows a Needs attention chip when no Zoom link is configured', () => {
      renderAt(baseConversationData);
      const header = screen.getByRole('button', { name: /Platform & format/ });
      expect(within(header).getByText('Needs attention')).toBeInTheDocument();
    });

    it('shows the meeting link when configured, with no Needs attention chip', () => {
      renderAt({
        ...baseConversationData,
        draft: false,
        scheduledEndTime: '2026-08-01T17:30:00Z',
        properties: { zoomMeetingUrl: 'https://harvard.zoom.us/j/81244556677' },
      });
      expandSection('Platform & format');
      const link = screen.getByRole('link', { name: 'harvard.zoom.us/j/81244556677' });
      expect(link).toHaveAttribute('href', 'https://harvard.zoom.us/j/81244556677');
      const header = screen.getByRole('button', { name: /Platform & format/ });
      expect(within(header).queryByText('Needs attention')).not.toBeInTheDocument();
    });

    it('shows "No meeting link yet" when the Zoom link is missing', () => {
      renderAt(baseConversationData);
      expandSection('Platform & format');
      expect(screen.getByText('No meeting link yet')).toBeInTheDocument();
    });

    it('flags a present-but-invalid meeting link as needing review, with the Needs attention chip', () => {
      renderAt({ ...baseConversationData, properties: { zoomMeetingUrl: 'https://example.com' } });
      const header = screen.getByRole('button', { name: /Platform & format/ });
      expect(within(header).getByText('Needs attention')).toBeInTheDocument();
      expandSection('Platform & format');
      expect(screen.getByText(/not a valid zoom link/i)).toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /example\.com/ })).not.toBeInTheDocument();
    });

    it('does not show a Needs attention chip once the event has ended, even without a meeting link', () => {
      renderAt({ ...baseConversationData, endTime: '2026-08-01T17:30:00Z' });
      const header = screen.getByRole('button', { name: /Platform & format/ });
      expect(within(header).queryByText('Needs attention')).not.toBeInTheDocument();
    });
  });

  describe('Assistant configuration section', () => {
    it('shows a Default chip for an unconfirmed event and the calendar-invite-defaults note', () => {
      renderAt(baseConversationData);
      expandSection('Assistant configuration');
      const header = screen.getByRole('button', { name: /Assistant configuration/ });
      expect(within(header).getByText('Default')).toBeInTheDocument();
      expect(screen.getByText(/still on calendar-invite defaults/)).toBeInTheDocument();
    });

    it('hides the calendar-invite-defaults note when its dismiss button is clicked', () => {
      renderAt(baseConversationData);
      expandSection('Assistant configuration');
      expect(screen.getByText(/still on calendar-invite defaults/)).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: /dismiss/i }));
      expect(screen.queryByText(/still on calendar-invite defaults/)).not.toBeInTheDocument();
    });

    it('shows bot name, platform, and model from properties', () => {
      renderAt({
        ...baseConversationData,
        properties: { botName: 'Berkie', llmModel: { llmPlatform: 'openai', llmModel: 'gpt-4o-mini' } },
      });
      expandSection('Assistant configuration');
      expect(screen.getByText('Berkie')).toBeInTheDocument();
      expect(screen.getByText('openai')).toBeInTheDocument();
      expect(screen.getByText('gpt-4o-mini')).toBeInTheDocument();
    });

    it('shows all five organizer-controlled features with their on/off state, defaulting from the type when the conversation has no features array', () => {
      renderAt(baseConversationData);
      expandSection('Assistant configuration');
      expect(screen.getByText('Moderator Support')).toBeInTheDocument();
      expect(screen.getByText('Collective Voice')).toBeInTheDocument();
      expect(screen.getByText('Catalyst')).toBeInTheDocument();
      expect(screen.getByText('Reading Recommendations')).toBeInTheDocument();
      expect(screen.getByText('Series History')).toBeInTheDocument();
    });

    it('reflects an explicit disabled feature from the conversation', () => {
      renderAt({
        ...baseConversationData,
        features: [{ name: 'catalyst', enabled: false }],
      });
      expandSection('Assistant configuration');
      const catalystRow = screen.getByText('Catalyst').closest('[data-testid="feature-row"]') as HTMLElement;
      expect(within(catalystRow).getByText('Off')).toBeInTheDocument();
    });
  });

  describe('Moderators & presenters section', () => {
    it('shows dashed empty states when there are no moderators or presenters', () => {
      renderAt(baseConversationData);
      expandSection('Moderators & presenters');
      expect(screen.getByText(/No moderator assigned yet/)).toBeInTheDocument();
      expect(screen.getByText(/No presenters added yet/)).toBeInTheDocument();
    });

    it('shows moderator and presenter rows with bios when present', () => {
      renderAt({
        ...baseConversationData,
        moderators: [{ name: 'Jane Doe', bio: 'Runs the show.' }],
        presenters: [{ name: 'John Smith', bio: 'Robotics researcher.' }],
      });
      expandSection('Moderators & presenters');
      expect(screen.getByText('Jane Doe')).toBeInTheDocument();
      expect(screen.getByText('Runs the show.')).toBeInTheDocument();
      expect(screen.getByText('John Smith')).toBeInTheDocument();
      expect(screen.getByText('Robotics researcher.')).toBeInTheDocument();
    });
  });

  describe('Reading & resources section', () => {
    it('shows the needs-attention callout and resource rows', () => {
      renderAt({
        ...baseConversationData,
        resources: [
          {
            source: 'speaker',
            category: 'required',
            title: 'Intro to Robotics',
            url: 'https://example.com/paper.pdf',
            participantVisible: false,
            authors: ['A. Author'],
            year: '2024',
          },
        ],
      });
      expandSection('Reading & resources');
      expect(screen.getByText(/start out optional and hidden from participants/)).toBeInTheDocument();
      const link = screen.getByRole('link', { name: 'Intro to Robotics' });
      expect(link).toHaveAttribute('href', 'https://example.com/paper.pdf');
      expect(screen.getByText(/A. Author/)).toBeInTheDocument();
      expect(screen.getByText('Required')).toBeInTheDocument();
      expect(screen.getByText('Not visible to participants')).toBeInTheDocument();
    });

    it('does not tag a suggested resource as required', () => {
      renderAt({
        ...baseConversationData,
        resources: [{ source: 'speaker', category: 'suggested', title: 'Further Reading', participantVisible: true }],
      });
      expandSection('Reading & resources');
      expect(screen.queryByText('Required')).not.toBeInTheDocument();
    });

    it('hides the resources-default callout when its dismiss button is clicked', () => {
      renderAt(baseConversationData);
      expandSection('Reading & resources');
      expect(screen.getByText(/start out optional and hidden from participants/)).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: /dismiss/i }));
      expect(screen.queryByText(/start out optional and hidden from participants/)).not.toBeInTheDocument();
    });

    it('still shows the creation-defaults callout once the event is scheduled', () => {
      renderAt({ ...baseConversationData, draft: false, scheduledEndTime: '2026-08-01T17:30:00Z' });
      expandSection('Reading & resources');
      expect(screen.getByText(/start out optional and hidden from participants/)).toBeInTheDocument();
    });

    it('hides the creation-defaults callout once the event has ended, where there is no Edit action', () => {
      renderAt({ ...baseConversationData, draft: false, endTime: '2026-08-01T17:30:00Z' });
      expandSection('Reading & resources');
      expect(screen.queryByText(/start out optional and hidden from participants/)).not.toBeInTheDocument();
    });

    it('hides the creation-defaults callout for a missed event, where the action is Create a new event', () => {
      renderAt({ ...baseConversationData, scheduledTime: '2026-08-01T09:00:00Z' });
      expandSection('Reading & resources');
      expect(screen.queryByText(/start out optional and hidden from participants/)).not.toBeInTheDocument();
    });
  });

  it('renders without crashing when all optional fields are absent', () => {
    renderAt(baseConversationData);
    expect(screen.getByRole('button', { name: /Event Details/ })).toBeInTheDocument();
  });

  describe('openSectionRequest', () => {
    it('expands a collapsed section when a matching request arrives', () => {
      const { rerender } = render(
        <EventDetails conversationData={{ ...baseConversationData, properties: { botName: 'Berkie' } }} now={now} />,
      );
      // Assistant configuration starts collapsed, so its body content is hidden.
      expect(screen.queryByText('Berkie')).not.toBeInTheDocument();

      rerender(
        <EventDetails
          conversationData={{ ...baseConversationData, properties: { botName: 'Berkie' } }}
          now={now}
          openSectionRequest={{ id: 'cfg-1a', nonce: 1 }}
        />,
      );
      expect(screen.getByText('Berkie')).toBeInTheDocument();
    });
  });
});
