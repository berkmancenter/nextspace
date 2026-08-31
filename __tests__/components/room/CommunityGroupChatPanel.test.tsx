import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { CommunityGroupChatPanel } from '../../../components/room/CommunityGroupChatPanel';
import { useAutoScroll } from '../../../hooks/useAutoScroll';

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
    mentionTargets: [],
    onSendMessage: mockOnSendMessage,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows the empty-state hero when there are no messages yet', () => {
    render(<CommunityGroupChatPanel {...baseProps} />);
    expect(screen.getByText('A permanent room for the Berkman Klein community.')).toBeInTheDocument();
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

  it('heads the introduction card with its own Berkie label and the bot badge', () => {
    const introMessage = {
      id: 'intro-2',
      fromAgent: true,
      pseudonym: 'Berkie',
      createdAt: '2026-08-26T00:00:00.000Z',
      body: {
        type: 'memberIntro',
        text: 'Tomas Alvarez just joined.',
        content: {
          name: 'Tomas Alvarez',
          role: 'Affiliate, Cyberlaw Clinic',
          joinedLabel: 'joined yesterday',
          bio: 'Works on platform liability.',
        },
      },
    };

    render(<CommunityGroupChatPanel {...baseProps} messages={[introMessage as any]} />);

    const card = screen.getByRole('group', { name: 'Introduction posted by Berkie' });
    expect(within(card).getByText('Introduced by Berkie')).toBeInTheDocument();
    expect(within(card).getByText('AI Bot')).toBeInTheDocument();
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

  it('invites the first message when the room is empty', () => {
    render(<CommunityGroupChatPanel {...baseProps} />);
    expect(screen.getByText("Nothing has been said yet. You're first.")).toBeInTheDocument();
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

  it('marks a Berkie message with the AI bot pill', () => {
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
    expect(screen.getByText('AI Bot')).toBeInTheDocument();
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

  it('marks a message that has not reached the server yet as waiting to send', () => {
    render(
      <CommunityGroupChatPanel
        {...baseProps}
        pendingMessages={[{ id: 'queued-0', body: "Perfect, I'll add both to the syllabus draft tonight.", tab: 'chat' }]}
      />,
    );

    expect(screen.getByText("Perfect, I'll add both to the syllabus draft tonight.")).toBeInTheDocument();
    expect(screen.getByText('Waiting to send')).toBeInTheDocument();
  });

  it('drops the waiting-to-send marker once the message has been delivered', () => {
    const delivered = {
      id: 'm-1',
      pseudonym: 'Priya Raghunathan',
      body: "Perfect, I'll add both to the syllabus draft tonight.",
      createdAt: '2026-08-26T10:00:00.000Z',
    };

    render(<CommunityGroupChatPanel {...baseProps} messages={[delivered as any]} pendingMessages={[]} />);

    expect(screen.queryByText('Waiting to send')).not.toBeInTheDocument();
  });

  it('replaces the waiting label with a failure when the server refused the message', () => {
    render(
      <CommunityGroupChatPanel
        {...baseProps}
        pendingMessages={[{ id: 'queued-0', body: 'foo', tab: 'chat', failed: true }]}
      />,
    );

    expect(screen.getByText('Message could not be sent.')).toBeInTheDocument();
    expect(screen.queryByText('Waiting to send')).not.toBeInTheDocument();
  });

  describe('day dividers', () => {
    const onDay = (id: string, iso: string) => ({
      id,
      pseudonym: 'Priya Raghunathan',
      body: { text: id },
      createdAt: iso,
    });

    it('heads each day of the feed with its date', () => {
      render(
        <CommunityGroupChatPanel
          {...baseProps}
          messages={[onDay('a', '2026-08-13T09:00:00.000Z'), onDay('b', '2026-08-14T09:00:00.000Z')] as any}
        />,
      );

      expect(screen.getByText('Thursday, 13 August')).toBeInTheDocument();
      expect(screen.getByText('Friday, 14 August')).toBeInTheDocument();
    });

    it('heads a day once however many messages it holds', () => {
      render(
        <CommunityGroupChatPanel
          {...baseProps}
          messages={
            [
              onDay('a', '2026-08-13T09:00:00.000Z'),
              onDay('b', '2026-08-13T11:30:00.000Z'),
              onDay('c', '2026-08-13T18:45:00.000Z'),
            ] as any
          }
        />,
      );

      expect(screen.getAllByText('Thursday, 13 August')).toHaveLength(1);
    });
  });

  describe('the jump-to-latest pill', () => {
    const message = (id: string) => ({
      id,
      pseudonym: 'Priya Raghunathan',
      body: { text: id },
      createdAt: '2026-08-26T00:00:00.000Z',
    });

    const scrollAway = () =>
      (useAutoScroll as jest.Mock).mockReturnValue({
        messagesContainerRef: { current: null },
        messagesEndRef: { current: null },
        scrollToBottom: jest.fn(),
        isAtBottom: false,
      });

    const returnToBottom = () =>
      (useAutoScroll as jest.Mock).mockReturnValue({
        messagesContainerRef: { current: null },
        messagesEndRef: { current: null },
        scrollToBottom: jest.fn(),
        isAtBottom: true,
      });

    afterEach(returnToBottom);

    it('marks the pill once a message arrives while the member is scrolled away', () => {
      scrollAway();
      const { rerender } = render(<CommunityGroupChatPanel {...baseProps} messages={[message('a') as any]} />);

      expect(screen.getByRole('button', { name: 'Jump to latest messages' })).toBeInTheDocument();

      rerender(<CommunityGroupChatPanel {...baseProps} messages={[message('a'), message('b')] as any} />);

      expect(screen.getByRole('button', { name: 'Jump to latest messages, new messages below' })).toBeInTheDocument();
    });

    it('never counts the new messages', () => {
      scrollAway();
      const { rerender } = render(<CommunityGroupChatPanel {...baseProps} messages={[message('a') as any]} />);
      rerender(<CommunityGroupChatPanel {...baseProps} messages={[message('a'), message('b'), message('c')] as any} />);

      expect(screen.queryByText(/\d+ new messages/)).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: /new messages below/ })).toHaveTextContent('Jump to latest');
    });

    it('drops the mark once the member has been back at the latest message', () => {
      scrollAway();
      const { rerender } = render(<CommunityGroupChatPanel {...baseProps} messages={[message('a') as any]} />);
      rerender(<CommunityGroupChatPanel {...baseProps} messages={[message('a'), message('b')] as any} />);

      returnToBottom();
      rerender(<CommunityGroupChatPanel {...baseProps} messages={[message('a'), message('b')] as any} />);
      expect(screen.queryByRole('button', { name: /Jump to latest/ })).not.toBeInTheDocument();

      scrollAway();
      rerender(<CommunityGroupChatPanel {...baseProps} messages={[message('a'), message('b')] as any} />);
      expect(screen.getByRole('button', { name: 'Jump to latest messages' })).toBeInTheDocument();
    });
  });

  it('offers a retry on a refused message', async () => {
    const user = userEvent.setup();
    const onRetryPendingMessage = jest.fn();

    render(
      <CommunityGroupChatPanel
        {...baseProps}
        pendingMessages={[{ id: 'queued-0', body: 'foo', tab: 'chat', failed: true }]}
        onRetryPendingMessage={onRetryPendingMessage}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Try sending again' }));

    expect(onRetryPendingMessage).toHaveBeenCalledWith('queued-0');
  });

  it('offers no retry on a message that is still waiting', () => {
    render(
      <CommunityGroupChatPanel
        {...baseProps}
        pendingMessages={[{ id: 'queued-0', body: 'foo', tab: 'chat' }]}
        onRetryPendingMessage={jest.fn()}
      />,
    );

    expect(screen.queryByRole('button', { name: 'Try sending again' })).not.toBeInTheDocument();
  });

  it('shows a held first message instead of the empty-state hero', () => {
    render(
      <CommunityGroupChatPanel
        {...baseProps}
        pendingMessages={[{ id: 'queued-0', body: 'First thing said here.', tab: 'chat' }]}
      />,
    );

    expect(screen.queryByText('A permanent room for the Berkman Klein community.')).not.toBeInTheDocument();
    expect(screen.getByText('First thing said here.')).toBeInTheDocument();
  });

  it('shows a queued reply as waiting to send inside the open thread', async () => {
    const parent = {
      id: 'parent-1',
      pseudonym: 'Sofia Marchetti',
      body: 'Both Aadhaar pieces are in the shared folder now.',
      createdAt: '2026-08-26T09:00:00.000Z',
    };

    render(
      <CommunityGroupChatPanel
        {...baseProps}
        messages={[parent as any]}
        pendingMessages={[{ id: 'queued-3', body: 'Reading them tonight.', tab: 'chat', parentMessageId: 'parent-1' }]}
      />,
    );

    expect(screen.queryByText('Reading them tonight.')).not.toBeInTheDocument();

    // The reply control only appears on hover, and it is ThreadedMessage's own
    // wrapper that carries the handler, three levels above the bubble text.
    const bubble = screen.getByText('Both Aadhaar pieces are in the shared folder now.');
    fireEvent.mouseEnter(bubble.parentElement!.parentElement!.parentElement!);
    fireEvent.click(await screen.findByLabelText('Reply to Sofia Marchetti'));

    expect(screen.getByText('Reading them tonight.')).toBeInTheDocument();
    expect(screen.getByText('Waiting to send')).toBeInTheDocument();
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
  describe("telling the reader's own messages apart", () => {
    const namesake = {
      id: 'namesake-1',
      body: { text: 'Posted by a different account under the same name' },
      pseudonym: 'Priya Raghunathan',
      owner: 'another-account-id',
      fromAgent: false,
      visible: true,
      createdAt: new Date('2026-08-13T10:00:00Z').toISOString(),
    };

    it("does not dress a namesake's message as the reader's own", () => {
      render(
        <CommunityGroupChatPanel
          {...baseProps}
          realName="Priya Raghunathan"
          currentUserId="my-account-id"
          messages={[namesake as any]}
        />,
      );

      expect(screen.queryByText('(You)')).not.toBeInTheDocument();
    });

    it('recognises a message the reader owns', () => {
      const mine = { ...namesake, id: 'mine-1', owner: 'my-account-id' };
      render(
        <CommunityGroupChatPanel
          {...baseProps}
          realName="Priya Raghunathan"
          currentUserId="my-account-id"
          messages={[mine as any]}
        />,
      );

      expect(screen.getByText('(You)')).toBeInTheDocument();
    });
  });
});
