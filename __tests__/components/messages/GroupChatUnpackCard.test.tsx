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

  it('keeps why it matters closed until the button opens it in place', async () => {
    const user = userEvent.setup();
    render(<GroupChatUnpackCard message={makeMessage()} />);
    const toggle = screen.getByRole('button', { name: 'Why it matters' });

    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText(explanation.whyItMatters)).not.toBeInTheDocument();

    await user.click(toggle);

    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(toggle).toHaveFocus();
    expect(screen.getByText(explanation.whyItMatters)).toBeInTheDocument();
    expect(document.getElementById(toggle.getAttribute('aria-controls')!)).toHaveTextContent(explanation.whyItMatters);

    await user.click(toggle);

    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText(explanation.whyItMatters)).not.toBeInTheDocument();
  });

  it('opens why it matters from the keyboard', async () => {
    const user = userEvent.setup();
    render(<GroupChatUnpackCard message={makeMessage()} />);

    await user.tab();
    expect(screen.getByRole('button', { name: 'Why it matters' })).toHaveFocus();
    await user.keyboard('{Enter}');

    expect(screen.getByText(explanation.whyItMatters)).toBeInTheDocument();
  });

  it('hands the explanation to the follow-up handler when asked', async () => {
    const user = userEvent.setup();
    const onAskFollowUp = jest.fn();
    render(<GroupChatUnpackCard message={makeMessage()} onAskFollowUp={onAskFollowUp} />);

    await user.click(screen.getByRole('button', { name: 'Ask a follow-up privately' }));

    expect(onAskFollowUp).toHaveBeenCalledWith(expect.objectContaining({ headline: explanation.headline }));
  });

  it('leaves out the follow-up button when there is nowhere to ask it', () => {
    render(<GroupChatUnpackCard message={makeMessage()} />);

    expect(screen.queryByRole('button', { name: 'Ask a follow-up privately' })).not.toBeInTheDocument();
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
    const { container } = render(<GroupChatUnpackCard message={makeMessage()} onAskFollowUp={jest.fn()} />);

    expect(await axe(container)).toHaveNoViolations();

    await user.click(screen.getByRole('button', { name: 'Why it matters' }));

    expect(await axe(container)).toHaveNoViolations();
  });
});
