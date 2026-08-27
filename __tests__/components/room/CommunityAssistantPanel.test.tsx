import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { CommunityAssistantPanel } from '../../../components/room/CommunityAssistantPanel';

jest.mock('../../../hooks/useAutoScroll', () => ({
  useAutoScroll: jest.fn().mockReturnValue({
    messagesContainerRef: { current: null },
    messagesEndRef: { current: null },
    scrollToBottom: jest.fn(),
    isAtBottom: true,
  }),
}));

jest.mock('../../../components/room/CommunityMessageInput', () => ({
  CommunityMessageInput: ({ onSendMessage, tab }: any) => (
    <div data-testid="community-message-input" data-tab={tab}>
      <input
        aria-label="Message"
        data-testid="message-input-field"
        onKeyPress={(e) => {
          if (e.key === 'Enter' && (e.target as HTMLInputElement).value) {
            onSendMessage((e.target as HTMLInputElement).value);
            (e.target as HTMLInputElement).value = '';
          }
        }}
      />
    </div>
  ),
}));

describe('CommunityAssistantPanel', () => {
  const mockOnSendMessage = jest.fn().mockResolvedValue(true);

  const baseProps = {
    messages: [],
    realName: 'Priya Raghunathan',
    botName: 'Berkie',
    onSendMessage: mockOnSendMessage,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows the empty-state hero when there are no messages yet', () => {
    render(<CommunityAssistantPanel {...baseProps} />);
    expect(screen.getByText("I read the room, so you don't have to.")).toBeInTheDocument();
    expect(
      screen.getByText(
        'Everything posted in Group Chat is what I know. Nothing you say here is visible to anyone else in the room.',
      ),
    ).toBeInTheDocument();
  });

  it('offers the three suggestion chips in the empty state', () => {
    render(<CommunityAssistantPanel {...baseProps} />);
    expect(screen.getByRole('button', { name: 'What did I miss this week?' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Who has joined recently?' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Who here works on procurement?' })).toBeInTheDocument();
  });

  it('states the limits of what Berkie can see', () => {
    render(<CommunityAssistantPanel {...baseProps} />);
    expect(
      screen.getByText(
        "I can be wrong, and I can't see anything outside this room — no email, no publications, no other Nextspace events.",
      ),
    ).toBeInTheDocument();
  });

  it('sends a suggestion chip as a message when clicked', async () => {
    const user = userEvent.setup();
    render(<CommunityAssistantPanel {...baseProps} />);
    await user.click(screen.getByRole('button', { name: 'What did I miss this week?' }));
    expect(mockOnSendMessage).toHaveBeenCalledWith('What did I miss this week?');
  });

  it('does not show the empty-state hero once there are messages', () => {
    const messages = [
      {
        id: '1',
        pseudonym: 'Priya Raghunathan',
        createdAt: '2026-01-05T12:00:00Z',
        body: { text: 'What did I miss?' },
        channels: ['assistant'],
        conversation: 'conv-1',
        pseudonymId: 'priya-1',
        fromAgent: false,
        pause: false,
        visible: true,
        upVotes: [],
        downVotes: [],
      },
    ];
    render(<CommunityAssistantPanel {...baseProps} messages={messages} />);
    expect(screen.queryByText("I read the room, so you don't have to.")).not.toBeInTheDocument();
  });

  it("renders the member's own message and Berkie's reply", () => {
    const messages = [
      {
        id: '1',
        pseudonym: 'Priya Raghunathan',
        createdAt: '2026-01-05T12:00:00Z',
        body: { text: 'What did I miss?' },
        channels: ['assistant'],
        conversation: 'conv-1',
        pseudonymId: 'priya-1',
        fromAgent: false,
        pause: false,
        visible: true,
        upVotes: [],
        downVotes: [],
      },
      {
        id: '2',
        pseudonym: 'Berkie',
        createdAt: '2026-01-05T12:01:00Z',
        body: { text: 'Three new members joined this week.' },
        channels: ['assistant'],
        conversation: 'conv-1',
        pseudonymId: 'berkie-1',
        fromAgent: true,
        pause: false,
        visible: true,
        upVotes: [],
        downVotes: [],
      },
    ];
    render(<CommunityAssistantPanel {...baseProps} messages={messages} />);
    expect(screen.getByText('What did I miss?')).toBeInTheDocument();
    expect(screen.getByText('Three new members joined this week.')).toBeInTheDocument();
    expect(screen.getByText('AI Bot')).toBeInTheDocument();
  });

  it('passes the assistant tab to the composer', () => {
    render(<CommunityAssistantPanel {...baseProps} />);
    expect(screen.getByTestId('community-message-input')).toHaveAttribute('data-tab', 'assistant');
  });

  it('sends a typed message through onSendMessage', async () => {
    const user = userEvent.setup();
    render(<CommunityAssistantPanel {...baseProps} />);
    await user.type(screen.getByTestId('message-input-field'), 'hello Berkie{Enter}');
    expect(mockOnSendMessage).toHaveBeenCalledWith('hello Berkie');
  });

  it('shows a thinking indicator while waiting for a response', () => {
    const messages = [
      {
        id: '1',
        pseudonym: 'Priya Raghunathan',
        createdAt: '2026-01-05T12:00:00Z',
        body: { text: 'What did I miss?' },
        channels: ['assistant'],
        conversation: 'conv-1',
        pseudonymId: 'priya-1',
        fromAgent: false,
        pause: false,
        visible: true,
        upVotes: [],
        downVotes: [],
      },
    ];
    render(<CommunityAssistantPanel {...baseProps} messages={messages} waitingForResponse />);
    expect(screen.getByText('thinking...')).toBeInTheDocument();
  });

  it('marks a message that has not reached the server yet as waiting to send', () => {
    render(
      <CommunityAssistantPanel
        {...baseProps}
        pendingMessages={[{ id: 'queued-0', body: 'What did I miss this week?', tab: 'assistant' }]}
      />,
    );

    expect(screen.getByText('What did I miss this week?')).toBeInTheDocument();
    expect(screen.getByText('Waiting to send')).toBeInTheDocument();
  });

  it('has no accessibility violations in the empty state', async () => {
    const { container } = render(<CommunityAssistantPanel {...baseProps} />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no accessibility violations with messages', async () => {
    const messages = [
      {
        id: '1',
        pseudonym: 'Priya Raghunathan',
        createdAt: '2026-01-05T12:00:00Z',
        body: { text: 'What did I miss?' },
        channels: ['assistant'],
        conversation: 'conv-1',
        pseudonymId: 'priya-1',
        fromAgent: false,
        pause: false,
        visible: true,
        upVotes: [],
        downVotes: [],
      },
    ];
    const { container } = render(<CommunityAssistantPanel {...baseProps} messages={messages} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
