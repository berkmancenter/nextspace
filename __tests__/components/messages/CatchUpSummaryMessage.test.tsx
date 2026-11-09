import React from 'react';
import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { CatchUpSummaryMessage } from '../../../components/messages/CatchUpSummaryMessage';
import { PseudonymousMessage } from '../../../types.internal';
import { formatTimeRange } from '../../../utils/catchUp';

const localTime = (hours: number, minutes: number) => new Date(2025, 9, 17, hours, minutes).toISOString();

// Testing Library turns the narrow no-break space newer ICU versions put before AM and PM into a
// plain space in the page text, but leaves the expected string alone.
const plainSpaces = (text: string) => text.replace(/\u202f/g, ' ');

const makeSummaryMessage = (bodyOverrides: Record<string, unknown> = {}): PseudonymousMessage => ({
  id: 'summary-1',
  pseudonym: 'Berkie',
  pseudonymId: 'agent-1',
  createdAt: localTime(10, 45),
  body: {
    type: 'catch_up_summary',
    requestMessage: 'request-1',
    chunkIds: ['chunk-1', 'chunk-2'],
    passage: { start: localTime(10, 43), end: localTime(10, 45) },
    earlierSpeech: false,
    inShort: 'The speaker argued that phone records get less protection than calls.',
    whatTheyCovered: ['Why courts treat metadata differently', 'A 1979 case about phone numbers'],
    comingUp: null,
    text: 'Plain-text copy of the summary.',
    ...bodyOverrides,
  },
  bodyType: 'json',
  channels: ['direct-user-1-agent-1'],
  conversation: 'conv-1',
  fromAgent: true,
  pause: false,
  visible: true,
  upVotes: [],
  downVotes: [],
});

describe('CatchUpSummaryMessage', () => {
  it('shows when the summarized passages were said', () => {
    render(<CatchUpSummaryMessage message={makeSummaryMessage()} />);

    expect(
      screen.getByText(plainSpaces(formatTimeRange(new Date(localTime(10, 43)), new Date(localTime(10, 45))))),
    ).toBeInTheDocument();
  });

  it("shows the summary under an 'In short' heading", () => {
    render(<CatchUpSummaryMessage message={makeSummaryMessage()} />);

    expect(screen.getByRole('heading', { name: 'In short' })).toBeInTheDocument();
    expect(screen.getByText('The speaker argued that phone records get less protection than calls.')).toBeInTheDocument();
  });

  it("lists the points under a 'What they covered' heading", () => {
    render(<CatchUpSummaryMessage message={makeSummaryMessage()} />);

    expect(screen.getByRole('heading', { name: 'What they covered' })).toBeInTheDocument();
    expect(screen.getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      'Why courts treat metadata differently',
      'A 1979 case about phone numbers',
    ]);
  });

  it("leaves out 'What they covered' when the summary has no points", () => {
    render(<CatchUpSummaryMessage message={makeSummaryMessage({ whatTheyCovered: [] })} />);

    expect(screen.queryByRole('heading', { name: 'What they covered' })).not.toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('shows every point even when two are the same', () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    render(<CatchUpSummaryMessage message={makeSummaryMessage({ whatTheyCovered: ['Metadata', 'Metadata'] })} />);

    expect(screen.getAllByRole('listitem').map((item) => item.textContent)).toEqual(['Metadata', 'Metadata']);
    expect(consoleError).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it("shows 'Coming up' only when the speaker announced what's next", () => {
    const { rerender } = render(<CatchUpSummaryMessage message={makeSummaryMessage()} />);
    expect(screen.queryByRole('heading', { name: 'Coming up' })).not.toBeInTheDocument();

    rerender(<CatchUpSummaryMessage message={makeSummaryMessage({ comingUp: 'A walk through the 1979 case.' })} />);

    expect(screen.getByRole('heading', { name: 'Coming up' })).toBeInTheDocument();
    expect(screen.getByText('A walk through the 1979 case.')).toBeInTheDocument();
  });

  it('says when the summary covers speech from before the last 60 seconds', () => {
    const earlierSpeechNote = 'Nothing was said in the last 60 seconds, so this covers what was said just before.';
    const { rerender } = render(<CatchUpSummaryMessage message={makeSummaryMessage()} />);
    expect(screen.queryByText(earlierSpeechNote)).not.toBeInTheDocument();

    rerender(<CatchUpSummaryMessage message={makeSummaryMessage({ earlierSpeech: true })} />);

    expect(screen.getByText(earlierSpeechNote)).toBeInTheDocument();
  });

  it('says catch-ups are private and not fact-checked', () => {
    render(<CatchUpSummaryMessage message={makeSummaryMessage()} />);

    expect(
      screen.getByText(
        "Catch-ups are only for you. They aren't shared or counted toward Group Chat posts. Berkie summarizes what the speaker said; it doesn't check whether claims are correct.",
      ),
    ).toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    const { container } = render(
      <CatchUpSummaryMessage message={makeSummaryMessage({ earlierSpeech: true, comingUp: 'A walk through the case.' })} />,
    );

    expect(await axe(container)).toHaveNoViolations();
  });
});
