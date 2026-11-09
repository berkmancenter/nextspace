import React from 'react';
import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { UnpackExplanationMessage } from '../../../components/messages/UnpackExplanationMessage';
import { PseudonymousMessage } from '../../../types.internal';
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
  it("labels the card 'Unpack this' and quotes the passage", () => {
    render(<UnpackExplanationMessage message={makeExplanationMessage()} />);

    expect(screen.getByText('Unpack this')).toBeInTheDocument();
    expect(screen.getByText('"Courts read the Fourth Amendment narrowly when it comes to metadata."')).toBeInTheDocument();
  });

  it('says when the passage was said', () => {
    render(<UnpackExplanationMessage message={makeExplanationMessage()} />);

    expect(screen.getByText(/^Said at 10:43\sAM$/)).toBeInTheDocument();
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
});
