import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThreadedMessage } from '../../components/ThreadedMessage';
import { ThreadPanel } from '../../components/ThreadPanel';
import { MessageModeration } from '../../components/ModerationControls';
import { PseudonymousMessage } from '../../types.internal';

const make = (id: string, overrides: Record<string, unknown> = {}): PseudonymousMessage =>
  ({
    id,
    body: { text: `text ${id}` },
    pseudonym: `User ${id}`,
    owner: `owner-${id}`,
    fromAgent: false,
    channels: ['chat'],
    createdAt: new Date('2024-01-01T12:00:00').toISOString(),
    ...overrides,
  }) as PseudonymousMessage;

const renderAvatar = (m: PseudonymousMessage) => <div>{`avatar-${m.id}`}</div>;
const renderMessageContent = (m: PseudonymousMessage) => <div data-testid={`content-${m.id}`}>{m.body?.text}</div>;

const makeModeration = (authorHidden = false): MessageModeration => ({
  onToggleHidden: jest.fn(),
  onToggleHideAuthor: jest.fn(),
  isAuthorHidden: jest.fn(() => authorHidden),
});

const threadedProps = {
  replies: [] as PseudonymousMessage[],
  pseudonym: 'Me',
  botName: 'Bot',
  renderAvatar,
  renderMessageContent,
  showTimestamp: false,
};

const panelProps = {
  replies: [] as PseudonymousMessage[],
  pseudonym: 'Me',
  botName: 'Bot',
  onClose: jest.fn(),
  onSendReply: jest.fn(),
  renderAvatar,
  renderMessageContent,
  enhancers: [],
};

describe('ThreadedMessage moderation', () => {
  it('draws no controls without moderation', () => {
    render(<ThreadedMessage {...threadedProps} message={make('a')} />);
    expect(screen.queryByRole('button', { name: 'Hide' })).not.toBeInTheDocument();
    expect(screen.queryByText('Hide all from this user')).not.toBeInTheDocument();
  });

  it('draws Hide and Hide all for an admin and wires them up', () => {
    const moderation = makeModeration();
    const message = make('a');
    render(<ThreadedMessage {...threadedProps} message={message} moderation={moderation} />);

    fireEvent.click(screen.getByRole('button', { name: 'Hide' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Skip' }));
    expect(moderation.onToggleHidden).toHaveBeenCalledWith(message, undefined);

    fireEvent.click(screen.getByRole('button', { name: 'Hide all from this user' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Skip' }));
    expect(moderation.onToggleHideAuthor).toHaveBeenCalledWith(message, false, undefined);
  });

  it('opens the reason menu from a real pointer sequence (hover, press, release) inside a row', async () => {
    const user = userEvent.setup();
    const moderation = makeModeration();
    const message = make('a');
    render(<ThreadedMessage {...threadedProps} message={message} moderation={moderation} />);

    await user.hover(screen.getByText('User a'));
    await user.click(screen.getByRole('button', { name: 'Hide' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Harassment' }));
    expect(moderation.onToggleHidden).toHaveBeenCalledWith(message, 'harassment');
  });

  it('marks a hidden row with the theme-aware hook instead of forcing a text color', () => {
    render(<ThreadedMessage {...threadedProps} message={make('a', { hidden: true })} moderation={makeModeration()} />);
    // The room stylesheet re-surfaces .message-hidden per theme; a fixed text-gray-900 would
    // leave the (light) dark-theme author name unreadable on the grey row.
    const row = screen.getByText('User a').closest('.message-hidden');
    expect(row).toHaveClass('bg-gray-200');
    expect(row).not.toHaveClass('text-gray-900');
  });

  it('does not stack the white hover surface on a hidden row', async () => {
    const user = userEvent.setup();
    render(<ThreadedMessage {...threadedProps} message={make('a', { hidden: true })} moderation={makeModeration()} />);
    await user.hover(screen.getByText('User a'));
    const row = screen.getByText('User a').closest('.message-row');
    expect(row).not.toHaveClass('bg-white');
  });

  it('offers Unhide, Unhide all and a Hidden label on a hidden message', () => {
    const moderation = makeModeration(true);
    const message = make('a', { hidden: true });
    const { container } = render(<ThreadedMessage {...threadedProps} message={message} moderation={moderation} />);

    expect(screen.getByText('Hidden')).toBeInTheDocument();
    expect(container.querySelector('.bg-gray-200')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Unhide' }));
    expect(moderation.onToggleHidden).toHaveBeenCalledWith(message);
    fireEvent.click(screen.getByRole('button', { name: 'Unhide all' }));
    expect(moderation.onToggleHideAuthor).toHaveBeenCalledWith(message, true);
  });

  it('shows a hidden reply as hidden with its own controls', () => {
    const reply = make('r', { hidden: true });
    render(<ThreadedMessage {...threadedProps} message={make('a')} replies={[reply]} moderation={makeModeration()} />);
    expect(screen.getByText('Hidden')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Unhide' })).toBeInTheDocument();
  });

  it('renders a body-less stub as the placeholder', () => {
    const stub = { id: 's', hidden: true, body: null, createdAt: new Date().toISOString() } as PseudonymousMessage;
    render(<ThreadedMessage {...threadedProps} message={stub} />);
    expect(screen.getByTestId('hidden-message-placeholder')).toBeInTheDocument();
    expect(screen.queryByTestId('content-s')).not.toBeInTheDocument();
  });
});

describe('ThreadPanel moderation', () => {
  it('draws no controls without moderation', () => {
    render(<ThreadPanel {...panelProps} parentMessage={make('p')} replies={[make('r')]} />);
    expect(screen.queryByRole('button', { name: 'Hide' })).not.toBeInTheDocument();
  });

  it('draws controls on the parent and every reply for an admin', () => {
    const moderation = makeModeration();
    const reply = make('r');
    render(<ThreadPanel {...panelProps} parentMessage={make('p')} replies={[reply]} moderation={moderation} />);

    const hides = screen.getAllByRole('button', { name: 'Hide' });
    expect(hides).toHaveLength(2);
    fireEvent.click(hides[1]);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Skip' }));
    expect(moderation.onToggleHidden).toHaveBeenCalledWith(reply, undefined);
  });

  it('greys out a hidden reply and labels it', () => {
    const { container } = render(
      <ThreadPanel
        {...panelProps}
        parentMessage={make('p')}
        replies={[make('r', { hidden: true })]}
        moderation={makeModeration()}
      />,
    );
    expect(screen.getByText('Hidden')).toBeInTheDocument();
    expect(container.querySelector('.bg-gray-200')).not.toBeNull();
  });

  it('renders a stub reply as the placeholder', () => {
    const stub = { id: 's', hidden: true, body: null, createdAt: new Date().toISOString() } as PseudonymousMessage;
    render(<ThreadPanel {...panelProps} parentMessage={make('p')} replies={[stub]} />);
    expect(screen.getByTestId('hidden-message-placeholder')).toBeInTheDocument();
  });

  it('offers Hide all on the parent and each reply, and Unhide all when the author is hidden', () => {
    const moderation = makeModeration();
    render(<ThreadPanel {...panelProps} parentMessage={make('p')} replies={[make('r')]} moderation={moderation} />);
    const hideAll = screen.getAllByRole('button', { name: 'Hide all from this user' });
    expect(hideAll).toHaveLength(2);
    fireEvent.click(hideAll[0]);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Skip' }));
    expect(moderation.onToggleHideAuthor).toHaveBeenCalledWith(expect.objectContaining({ id: 'p' }), false, undefined);

    const hiddenAuthor = makeModeration(true);
    render(<ThreadPanel {...panelProps} parentMessage={make('p2')} moderation={hiddenAuthor} />);
    fireEvent.click(screen.getByRole('button', { name: 'Unhide all' }));
    expect(hiddenAuthor.onToggleHideAuthor).toHaveBeenCalledWith(expect.objectContaining({ id: 'p2' }), true);
  });

  it('omits Hide all for a message with no owner or from the bot', () => {
    render(
      <ThreadPanel
        {...panelProps}
        parentMessage={make('p', { owner: undefined })}
        replies={[make('r', { fromAgent: true })]}
        moderation={makeModeration()}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Hide all from this user' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Hide' })).toHaveLength(2);
  });

  it('greys a hidden parent and its hidden replies for an admin', () => {
    const { container } = render(
      <ThreadPanel
        {...panelProps}
        parentMessage={make('p', { hidden: true })}
        replies={[make('r1', { hidden: true }), make('r2', { hidden: true })]}
        moderation={makeModeration()}
      />,
    );
    expect(screen.getAllByText('Hidden')).toHaveLength(3);
    expect(container.querySelectorAll('.bg-gray-200')).toHaveLength(3);
    expect(screen.getAllByRole('button', { name: 'Unhide' })).toHaveLength(3);
  });

  it('draws no Hidden label or grey when nothing is hidden', () => {
    const { container } = render(
      <ThreadPanel {...panelProps} parentMessage={make('p')} replies={[make('r')]} moderation={makeModeration()} />,
    );
    expect(screen.queryByText('Hidden')).not.toBeInTheDocument();
    expect(container.querySelector('.bg-gray-200')).toBeNull();
  });

  it('renders a stub parent as the placeholder', () => {
    const stub = { id: 's', hidden: true, body: null, createdAt: new Date().toISOString() } as PseudonymousMessage;
    render(<ThreadPanel {...panelProps} parentMessage={stub} />);
    expect(screen.getByTestId('hidden-message-placeholder')).toBeInTheDocument();
  });
});
