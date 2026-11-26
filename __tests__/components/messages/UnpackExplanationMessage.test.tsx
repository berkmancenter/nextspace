import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { UnpackExplanationMessage } from '../../../components/messages/UnpackExplanationMessage';
import { PseudonymousMessage, UnpackShareOutcome } from '../../../types.internal';
import { ConversationTypeProvider } from '../../../context/ConversationTypeContext';

// Built from local time so the "Said at" assertion holds in any time zone.
const passageStart = new Date(2025, 9, 17, 10, 43, 5).toISOString();
const passageEnd = new Date(2025, 9, 17, 10, 43, 40).toISOString();

const makeExplanationMessage = (bodyOverrides: Record<string, unknown> = {}): PseudonymousMessage => ({
  id: 'msg-1',
  pseudonym: 'Berkie',
  pseudonymId: 'agent-1',
  createdAt: '2025-10-17T10:44:00Z',
  body: {
    type: 'unpack_explanation',
    mode: 'passage',
    destination: 'privateChat',
    chunkIds: ['chunk-1', 'chunk-2'],
    passage: { start: passageStart, end: passageEnd },
    quote: 'Courts read the Fourth Amendment narrowly when it comes to metadata.',
    whatTheyreSaying: 'The speaker says courts give phone records less protection than the contents of calls.',
    whyItMatters: 'This is why the talk focuses on records rather than wiretaps.',
    terms: [
      {
        term: 'Fourth Amendment',
        text: 'The part of the US Constitution that limits when the government can search people and their things.',
      },
      { term: 'Metadata', text: 'Information about a call, like who called whom and when, but not what was said.' },
    ],
    headline: 'Why phone records get less protection',
    text: 'Plain-text copy of the explanation.',
    ...bodyOverrides,
  },
  channels: ['direct-user-1-agent-1'],
  conversation: 'conv-1',
  fromAgent: true,
  pause: false,
  visible: true,
  upVotes: [],
  downVotes: [],
});

describe('UnpackExplanationMessage', () => {
  it("shows the passage in its own 'Unpack this' bubble, before the explanation", () => {
    render(<UnpackExplanationMessage message={makeExplanationMessage()} />);
    const quote = '"Courts read the Fourth Amendment narrowly when it comes to metadata."';

    const ask = screen.getByTestId('unpack-ask');
    const explanation = screen.getByTestId('unpack-explanation');

    expect(within(ask).getByText('Unpack this')).toBeInTheDocument();
    expect(within(ask).getByText(quote)).toBeInTheDocument();
    expect(within(explanation).queryByText(quote)).not.toBeInTheDocument();
    expect(ask.compareDocumentPosition(explanation)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it('says when the passage was said at the top of the explanation', () => {
    render(<UnpackExplanationMessage message={makeExplanationMessage()} />);

    expect(within(screen.getByTestId('unpack-explanation')).getByText(/^Said at 10:43\sAM$/)).toBeInTheDocument();
  });

  it("shows what the speaker is saying under an 'In plain words' heading", () => {
    render(<UnpackExplanationMessage message={makeExplanationMessage()} />);

    expect(screen.getByRole('heading', { name: 'In plain words' })).toBeInTheDocument();
    expect(
      screen.getByText('The speaker says courts give phone records less protection than the contents of calls.'),
    ).toBeInTheDocument();
  });

  it("shows why it matters under a 'Why it matters here' heading", () => {
    render(<UnpackExplanationMessage message={makeExplanationMessage()} />);

    expect(screen.getByRole('heading', { name: 'Why it matters here' })).toBeInTheDocument();
    expect(screen.getByText('This is why the talk focuses on records rather than wiretaps.')).toBeInTheDocument();
  });

  it('lists each term with its explanation', () => {
    render(<UnpackExplanationMessage message={makeExplanationMessage()} />);

    expect(screen.getByRole('heading', { name: 'Terms in this passage' })).toBeInTheDocument();
    expect(screen.getAllByRole('term').map((term) => term.textContent)).toEqual(['Fourth Amendment', 'Metadata']);
    expect(screen.getAllByRole('definition').map((definition) => definition.textContent)).toEqual([
      'The part of the US Constitution that limits when the government can search people and their things.',
      'Information about a call, like who called whom and when, but not what was said.',
    ]);
  });

  it('leaves out the terms section when the passage has no specialist terms', () => {
    render(<UnpackExplanationMessage message={makeExplanationMessage({ terms: [] })} />);

    expect(screen.queryByRole('heading', { name: 'Terms in this passage' })).not.toBeInTheDocument();
    expect(screen.queryByRole('term')).not.toBeInTheDocument();
  });

  it("says that Berkie doesn't check whether the claim is correct", () => {
    render(<UnpackExplanationMessage message={makeExplanationMessage()} />);

    expect(
      screen.getByText("Berkie unpacks what the speaker said. It doesn't check whether the claim is correct."),
    ).toBeInTheDocument();
  });

  it("names the event's assistant in the note about checking claims", () => {
    render(
      <ConversationTypeProvider initialBotName="Juniper">
        <UnpackExplanationMessage message={makeExplanationMessage()} />
      </ConversationTypeProvider>,
    );

    expect(
      screen.getByText("Juniper unpacks what the speaker said. It doesn't check whether the claim is correct."),
    ).toBeInTheDocument();
  });

  it('shows every term when the same term appears twice', () => {
    const logError = jest.spyOn(console, 'error').mockImplementation(() => {});
    const term = { term: 'Metadata', text: 'Information about a call.' };

    render(<UnpackExplanationMessage message={makeExplanationMessage({ terms: [term, term] })} />);

    expect(screen.getAllByRole('term')).toHaveLength(2);
    expect(logError.mock.calls.flat().map(String).join(' ')).not.toContain('same key');
    logError.mockRestore();
  });

  it('has no accessibility violations', async () => {
    const { container } = render(<UnpackExplanationMessage message={makeExplanationMessage()} />);

    expect(await axe(container)).toHaveNoViolations();
  });
  describe('Share to Group Chat', () => {
    const deferred = () => {
      let resolve!: (outcome: UnpackShareOutcome) => void;
      const promise = new Promise<UnpackShareOutcome>((r) => (resolve = r));
      return { promise, resolve };
    };

    const renderShareable = (onShare: jest.Mock, onOpenGroupChatPost = jest.fn()) =>
      render(
        <UnpackExplanationMessage
          message={makeExplanationMessage()}
          onShareToGroupChat={onShare}
          onOpenGroupChatPost={onOpenGroupChatPost}
        />,
      );

    const shareButton = () => screen.getByRole('button', { name: 'Share to Group Chat' });

    it('shows a share made earlier, without moving focus to it', () => {
      render(
        <UnpackExplanationMessage
          message={makeExplanationMessage()}
          onShareToGroupChat={jest.fn()}
          onOpenGroupChatPost={jest.fn()}
          shareOutcome={{ ok: true, status: 'sent', messageId: 'post-1' }}
        />,
      );

      expect(screen.getByRole('status')).toHaveTextContent('Shared to Group Chat');
      expect(screen.queryByRole('button', { name: 'Share to Group Chat' })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'See it in Group Chat' })).not.toHaveFocus();
    });

    it('shows a share the server saved on the card, so it survives a reload', async () => {
      const user = userEvent.setup();
      const onOpenGroupChatPost = jest.fn();
      render(
        <UnpackExplanationMessage
          message={makeExplanationMessage({ groupChatShare: { status: 'sent', messageId: 'post-1' } })}
          onShareToGroupChat={jest.fn()}
          onOpenGroupChatPost={onOpenGroupChatPost}
        />,
      );

      expect(screen.getByRole('status')).toHaveTextContent('Shared to Group Chat');
      expect(screen.queryByRole('button', { name: 'Share to Group Chat' })).not.toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'See it in Group Chat' }));
      expect(onOpenGroupChatPost).toHaveBeenCalledWith('post-1');
    });

    it('shows a saved "already in Group Chat" share in the words of the note', () => {
      render(
        <UnpackExplanationMessage
          message={makeExplanationMessage({ groupChatShare: { status: 'alreadyPosted', messageId: 'post-0' } })}
          onShareToGroupChat={jest.fn()}
          onOpenGroupChatPost={jest.fn()}
          alreadyPostedNoteTexts={{ 'post-0': 'Someone already shared this part of the talk.' }}
        />,
      );

      expect(screen.getByRole('status')).toHaveTextContent('Someone already shared this part of the talk.');
    });

    it("shows the server's own words for the Group Chat time limit", async () => {
      const user = userEvent.setup();
      renderShareable(
        jest.fn().mockResolvedValue({
          ok: false,
          reason: 'groupChatRateLimited',
          message: 'You can post to Group Chat once every 3 minutes.',
        }),
      );

      await user.click(shareButton());

      expect(await screen.findByRole('alert')).toHaveTextContent('You can post to Group Chat once every 3 minutes.');
    });

    it("says it's already in Group Chat in the words of the note the server posted", () => {
      render(
        <UnpackExplanationMessage
          message={makeExplanationMessage()}
          onShareToGroupChat={jest.fn()}
          onOpenGroupChatPost={jest.fn()}
          shareOutcome={{ ok: true, status: 'alreadyPosted', messageId: 'post-0' }}
          alreadyPostedNoteTexts={{ 'post-0': 'Someone already shared this part of the talk.' }}
        />,
      );

      expect(screen.getByRole('status')).toHaveTextContent('Someone already shared this part of the talk.');
    });

    it('links to the existing post before the note arrives', () => {
      render(
        <UnpackExplanationMessage
          message={makeExplanationMessage()}
          onShareToGroupChat={jest.fn()}
          onOpenGroupChatPost={jest.fn()}
          shareOutcome={{ ok: true, status: 'alreadyPosted', messageId: 'post-0' }}
        />,
      );

      expect(screen.getByRole('status')).toBeEmptyDOMElement();
      expect(screen.getByRole('button', { name: 'See it in Group Chat' })).toBeInTheDocument();
    });

    it('shows a refusal from earlier', () => {
      render(
        <UnpackExplanationMessage
          message={makeExplanationMessage()}
          onShareToGroupChat={jest.fn()}
          shareOutcome={{ ok: false, reason: 'noGroupChat' }}
        />,
      );

      expect(screen.getByRole('alert')).toHaveTextContent('This event has no Group Chat to share to.');
      expect(shareButton()).toHaveAttribute('aria-disabled', 'true');
    });

    it("says the share posts under the participant's name", () => {
      renderShareable(jest.fn());

      expect(shareButton()).toHaveAccessibleDescription('Posts the full explanation to Group Chat under your name');
    });

    it('leaves the button out when sharing is not offered', () => {
      render(<UnpackExplanationMessage message={makeExplanationMessage()} />);

      expect(screen.queryByRole('button', { name: 'Share to Group Chat' })).not.toBeInTheDocument();
    });

    it('shares this card by its message ID, once, while the first share is in flight', async () => {
      const user = userEvent.setup();
      const pending = deferred();
      const onShare = jest.fn(() => pending.promise);
      renderShareable(onShare);

      await user.click(shareButton());
      await user.click(shareButton());

      expect(onShare).toHaveBeenCalledTimes(1);
      expect(onShare).toHaveBeenCalledWith('msg-1');
      expect(shareButton()).toHaveAttribute('aria-disabled', 'true');
      expect(shareButton()).toHaveAccessibleDescription('Sharing…');
    });

    it('confirms the post and moves focus to a way to see it', async () => {
      const user = userEvent.setup();
      const onOpenGroupChatPost = jest.fn();
      renderShareable(jest.fn().mockResolvedValue({ ok: true, status: 'sent', messageId: 'post-1' }), onOpenGroupChatPost);

      await user.click(shareButton());

      expect(await screen.findByText('Shared to Group Chat.')).toBeInTheDocument();
      const seeIt = screen.getByRole('button', { name: 'See it in Group Chat' });
      await waitFor(() => expect(seeIt).toHaveFocus());
      expect(seeIt).toHaveAccessibleDescription('Shared to Group Chat.');
      await user.click(seeIt);
      expect(onOpenGroupChatPost).toHaveBeenCalledWith('post-1');
    });

    it('links to the existing post when Group Chat already explains the passage', async () => {
      const user = userEvent.setup();
      const onOpenGroupChatPost = jest.fn();
      renderShareable(
        jest.fn().mockResolvedValue({ ok: true, status: 'alreadyPosted', messageId: 'post-0' }),
        onOpenGroupChatPost,
      );

      await user.click(shareButton());

      await user.click(await screen.findByRole('button', { name: 'See it in Group Chat' }));
      expect(onOpenGroupChatPost).toHaveBeenCalledWith('post-0');
    });

    it.each([
      ['groupChatRateLimited', "You've shared to Group Chat recently. Wait a few minutes, then try again."],
      ['noGroupChat', 'This event has no Group Chat to share to.'],
      ['cardNotFound', 'This explanation is no longer available to share.'],
      ['eventLocked', "This event is locked, so Berkie can't post to Group Chat."],
      ['chunkNotInTranscript', "This passage is no longer in the transcript, so it can't be shared."],
      ['eventNotStarted', 'You can share to Group Chat once the event starts.'],
      ['eventEnded', "This event has ended, so you can't share to Group Chat anymore."],
      ['unpackFailed', 'Someone else is sharing this passage right now. Try again in a moment.'],
      ['wrongPasscode', "This page's link has changed. Reload the page, then try again."],
      [undefined, 'Something went wrong. Try again.'],
    ])('explains a %s refusal by its reason', async (reason, message) => {
      const user = userEvent.setup();
      renderShareable(jest.fn().mockResolvedValue({ ok: false, reason }));

      await user.click(shareButton());

      expect(await screen.findByRole('alert')).toHaveTextContent(message);
    });

    it.each(['groupChatRateLimited', 'eventNotStarted', 'unpackFailed'])(
      'lets the participant try again after a %s refusal, which may pass',
      async (reason) => {
        const user = userEvent.setup();
        const onShare = jest
          .fn()
          .mockResolvedValueOnce({ ok: false, reason })
          .mockResolvedValueOnce({ ok: true, status: 'sent', messageId: 'post-1' });
        renderShareable(onShare);

        await user.click(shareButton());
        await screen.findByRole('alert');
        await user.click(shareButton());

        expect(await screen.findByText('Shared to Group Chat.')).toBeInTheDocument();
      },
    );

    it.each(['noGroupChat', 'eventEnded'])('stops offering the share after a %s refusal', async (reason) => {
      const user = userEvent.setup();
      const onShare = jest.fn().mockResolvedValue({ ok: false, reason });
      renderShareable(onShare);

      await user.click(shareButton());
      await screen.findByRole('alert');
      await user.click(shareButton());

      expect(shareButton()).toHaveAttribute('aria-disabled', 'true');
      expect(onShare).toHaveBeenCalledTimes(1);
    });

    it('has no accessibility violations after sharing', async () => {
      const user = userEvent.setup();
      const { container } = renderShareable(jest.fn().mockResolvedValue({ ok: true, status: 'sent', messageId: 'post-1' }));

      expect(await axe(container)).toHaveNoViolations();
      await user.click(shareButton());
      await screen.findByText('Shared to Group Chat.');

      expect(await axe(container)).toHaveNoViolations();
    });
  });
});
