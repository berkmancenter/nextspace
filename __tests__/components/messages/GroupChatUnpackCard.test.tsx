import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { GroupChatUnpackCard } from '../../../components/messages/GroupChatUnpackCard';
import { PseudonymousMessage, UnpackExplanation } from '../../../types.internal';

const explanation: UnpackExplanation = {
  type: 'unpack_explanation',
  mode: 'passage',
  destination: 'groupChat',
  chunkIds: ['chunk-1'],
  passage: { start: '2025-10-17T10:43:05Z', end: '2025-10-17T10:43:40Z' },
  quote: 'Precedential weight concentrates in a few circuits, then decays under what we call doctrinal half-life.',
  whatTheyreSaying: "Most of a ruling's influence comes from a few appeals courts, and it fades at a steady rate.",
  whyItMatters: 'It explains why lower courts lean on a small set of rulings.',
  terms: [],
  headline: 'What the speaker meant by "doctrinal half-life"',
  footer: 'A participant asked Berkie to share this.',
  text: 'Plain-text copy of the explanation.',
};

const makeMessage = (bodyOverrides: Partial<UnpackExplanation> = {}): PseudonymousMessage => ({
  id: 'post-1',
  pseudonym: 'Berkie',
  pseudonymId: 'agent-1',
  createdAt: '2025-10-17T10:44:00Z',
  body: { ...explanation, ...bodyOverrides },
  bodyType: 'json',
  channels: ['chat'],
  conversation: 'conv-1',
  fromAgent: true,
  pause: false,
  visible: true,
  upVotes: [],
  downVotes: [],
});

describe('GroupChatUnpackCard', () => {
  it('names itself as an unpacked moment from the talk, with the headline as its heading', () => {
    render(<GroupChatUnpackCard message={makeMessage()} />);

    expect(screen.getByText('Unpacking a moment from the talk')).toBeInTheDocument();
    expect(screen.getByRole('article', { name: 'What the speaker meant by "doctrinal half-life"' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'What the speaker meant by "doctrinal half-life"' })).toBeInTheDocument();
  });

  it('shows the quote and the explanation in plain words', () => {
    render(<GroupChatUnpackCard message={makeMessage()} />);

    expect(screen.getByText(`"${explanation.quote}"`)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'In plain words' })).toBeInTheDocument();
    expect(screen.getByText(explanation.whatTheyreSaying)).toBeInTheDocument();
  });

  it('keeps why it matters in a collapsed section until it is opened', async () => {
    const user = userEvent.setup();
    render(<GroupChatUnpackCard message={makeMessage()} />);
    const section = screen.getByText('Why it matters').closest('details')!;

    expect(section).not.toHaveAttribute('open');
    expect(screen.getByText(explanation.whyItMatters)).not.toBeVisible();

    await user.click(screen.getByText('Why it matters'));

    expect(section).toHaveAttribute('open');
    expect(screen.getByText(explanation.whyItMatters)).toBeVisible();
  });

  it('offers no follow-up or other buttons', () => {
    render(<GroupChatUnpackCard message={makeMessage()} />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('shows the footer the server sent, word for word', () => {
    render(
      <GroupChatUnpackCard message={makeMessage({ footer: 'Posted because several people asked about this passage.' })} />,
    );

    expect(screen.getByText('Posted because several people asked about this passage.')).toBeInTheDocument();
  });

  it('names the card by its label when the post has no headline', () => {
    render(<GroupChatUnpackCard message={makeMessage({ headline: undefined })} />);

    expect(screen.getByRole('article', { name: 'Unpacking a moment from the talk' })).toBeInTheDocument();
  });

  it('can be found and focused by its message ID, for links from Private Chat', () => {
    render(<GroupChatUnpackCard message={makeMessage()} />);
    const card = document.getElementById('group-chat-message-post-1');

    expect(card).toBe(screen.getByRole('article'));
    expect(card).toHaveAttribute('tabindex', '-1');
  });

  it('has no accessibility violations, closed or open', async () => {
    const user = userEvent.setup();
    const { container } = render(<GroupChatUnpackCard message={makeMessage()} />);

    expect(await axe(container)).toHaveNoViolations();

    await user.click(screen.getByText('Why it matters'));

    expect(await axe(container)).toHaveNoViolations();
  });
});
