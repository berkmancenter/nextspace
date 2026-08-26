import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { CommunityGroupChatPanel } from '../../../components/room/CommunityGroupChatPanel';

jest.mock('../../../hooks/useAutoScroll', () => ({
  useAutoScroll: jest.fn().mockReturnValue({
    messagesContainerRef: { current: null },
    messagesEndRef: { current: null },
    scrollToBottom: jest.fn(),
    isAtBottom: true,
  }),
}));

jest.mock('../../../components/room/CommunityMessageInput', () => ({
  CommunityMessageInput: ({ onSendMessage, tab, isEmptyRoom }: any) => (
    <div data-testid="community-message-input" data-tab={tab} data-empty-room={isEmptyRoom ? 'true' : 'false'}>
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

describe('CommunityGroupChatPanel', () => {
  const mockOnSendMessage = jest.fn().mockResolvedValue(true);

  const baseProps = {
    messages: [],
    realName: 'Priya Raghunathan',
    botName: 'Berkie',
    memberCount: 204,
    mentionTargets: [],
    onSendMessage: mockOnSendMessage,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows the empty-state hero when there are no messages yet', () => {
    render(<CommunityGroupChatPanel {...baseProps} />);
    expect(screen.getByText('A permanent room for the Berkman Klein community.')).toBeInTheDocument();
    expect(screen.getByText(/204 members have been invited/)).toBeInTheDocument();
    expect(screen.getByText(/Berkie is here too/)).toBeInTheDocument();
  });

  it('renders a member introduction card for a memberIntro message from Berkie', () => {
    const introMessage = {
      id: 'intro-1',
      fromAgent: true,
      pseudonym: 'Berkie',
      createdAt: '2026-08-26T00:00:00.000Z',
      body: {
        type: 'memberIntro',
        text: 'Lucia Navarro Ibanez just joined.',
        content: {
          name: 'Lucia Navarro Ibanez',
          role: 'Fellow, metaLAB',
          joinedLabel: 'joined this week',
          bio: 'Studies how museums decide what to digitise.',
        },
      },
    };

    render(<CommunityGroupChatPanel {...baseProps} messages={[introMessage as any]} />);

    expect(screen.getByRole('group', { name: 'Introduction posted by Berkie' })).toBeInTheDocument();
    expect(screen.getByText('Lucia Navarro Ibanez')).toBeInTheDocument();
    expect(screen.getByText('Fellow, metaLAB · joined this week')).toBeInTheDocument();
    expect(screen.getByText('Studies how museums decide what to digitise.')).toBeInTheDocument();
  });

  it('renders an ordinary message normally rather than as an introduction card', () => {
    const plainMessage = {
      id: 'plain-1',
      pseudonym: 'Priya Raghunathan',
      createdAt: '2026-08-26T00:00:00.000Z',
      body: 'just a normal message',
    };

    render(<CommunityGroupChatPanel {...baseProps} messages={[plainMessage as any]} />);

    expect(screen.queryByRole('group', { name: 'Introduction posted by Berkie' })).not.toBeInTheDocument();
    expect(screen.getByText('just a normal message')).toBeInTheDocument();
  });

  it('falls back to a countless empty-state line when the member count is unknown', () => {
    render(<CommunityGroupChatPanel {...baseProps} memberCount={undefined} />);
    expect(screen.getByText("Nothing has been said yet — you're first.")).toBeInTheDocument();
    expect(screen.queryByText(/members have been invited/)).not.toBeInTheDocument();
  });

  it('tells the composer the room is empty so it can adjust its placeholder', () => {
    render(<CommunityGroupChatPanel {...baseProps} />);
    expect(screen.getByTestId('community-message-input')).toHaveAttribute('data-empty-room', 'true');
  });

  it('does not show the empty-state hero once there are messages', () => {
    const messages = [
      {
        id: '1',
        pseudonym: 'Sofia Marchetti',
        createdAt: '2026-01-05T12:00:00Z',
        body: { text: 'Hello room' },
        channels: ['chat'],
        conversation: 'conv-1',
        pseudonymId: 'sofia-1',
        fromAgent: false,
        pause: false,
        visible: true,
        upVotes: [],
        downVotes: [],
      },
    ];
    render(<CommunityGroupChatPanel {...baseProps} messages={messages} />);
    expect(screen.queryByText('A permanent room for the Berkman Klein community.')).not.toBeInTheDocument();
    expect(screen.getByTestId('community-message-input')).toHaveAttribute('data-empty-room', 'false');
  });

  it("renders a member's message with their real name", () => {
    const messages = [
      {
        id: '1',
        pseudonym: 'Sofia Marchetti',
        createdAt: '2026-01-05T12:00:00Z',
        body: { text: 'Hello room' },
        channels: ['chat'],
        conversation: 'conv-1',
        pseudonymId: 'sofia-1',
        fromAgent: false,
        pause: false,
        visible: true,
        upVotes: [],
        downVotes: [],
      },
    ];
    render(<CommunityGroupChatPanel {...baseProps} messages={messages} />);
    expect(screen.getByText('Sofia Marchetti')).toBeInTheDocument();
    expect(screen.getByText('Hello room')).toBeInTheDocument();
  });

  it("labels the current user's own message as (You)", () => {
    const messages = [
      {
        id: '1',
        pseudonym: 'Priya Raghunathan',
        createdAt: '2026-01-05T12:00:00Z',
        body: { text: 'My own message' },
        channels: ['chat'],
        conversation: 'conv-1',
        pseudonymId: 'priya-1',
        fromAgent: false,
        pause: false,
        visible: true,
        upVotes: [],
        downVotes: [],
      },
    ];
    render(<CommunityGroupChatPanel {...baseProps} messages={messages} />);
    expect(screen.getByText('(You)')).toBeInTheDocument();
  });

  it('marks a Berkie message with the AI agent pill', () => {
    const messages = [
      {
        id: '1',
        pseudonym: 'Berkie',
        createdAt: '2026-01-05T12:00:00Z',
        body: { text: 'Hi, I am here if you need me.' },
        channels: ['chat'],
        conversation: 'conv-1',
        pseudonymId: 'berkie-1',
        fromAgent: true,
        pause: false,
        visible: true,
        upVotes: [],
        downVotes: [],
      },
    ];
    render(<CommunityGroupChatPanel {...baseProps} messages={messages} />);
    expect(screen.getByText('AI agent')).toBeInTheDocument();
  });

  it('sends a typed message through onSendMessage', async () => {
    const user = userEvent.setup();
    render(<CommunityGroupChatPanel {...baseProps} />);
    await user.type(screen.getByTestId('message-input-field'), 'hello everyone{Enter}');
    expect(mockOnSendMessage).toHaveBeenCalledWith('hello everyone');
  });

  it('passes the group tab and member names to the composer for @ mentions', () => {
    render(<CommunityGroupChatPanel {...baseProps} mentionTargets={['Sofia Marchetti']} />);
    expect(screen.getByTestId('community-message-input')).toHaveAttribute('data-tab', 'chat');
  });

  it('has no accessibility violations in the empty state', async () => {
    const { container } = render(<CommunityGroupChatPanel {...baseProps} />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no accessibility violations with messages', async () => {
    const messages = [
      {
        id: '1',
        pseudonym: 'Sofia Marchetti',
        createdAt: '2026-01-05T12:00:00Z',
        body: { text: 'Hello room' },
        channels: ['chat'],
        conversation: 'conv-1',
        pseudonymId: 'sofia-1',
        fromAgent: false,
        pause: false,
        visible: true,
        upVotes: [],
        downVotes: [],
      },
    ];
    const { container } = render(<CommunityGroupChatPanel {...baseProps} messages={messages} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
