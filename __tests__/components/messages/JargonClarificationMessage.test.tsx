import React from 'react';
import { render, screen } from '@testing-library/react';
import { JargonClarificationMessage } from '../../../components/messages/JargonClarificationMessage';
import { PseudonymousMessage } from '../../../types.internal';

const makeJargonMessage = (overrides: Partial<PseudonymousMessage> = {}): PseudonymousMessage => ({
  id: 'msg-1',
  pseudonym: 'Jargon Filter Agent',
  pseudonymId: 'jargon-agent-1',
  createdAt: '2025-10-17T12:00:00Z',
  body: {
    type: 'jargon_clarification',
    text: 'An SLO is a target for how reliable a service should be.',
    sourceText: 'Our SLOs are defined in terms of error budget.',
  },
  channels: ['direct-user-1-jargon-agent-1'],
  conversation: 'conv-1',
  fromAgent: true,
  pause: false,
  visible: true,
  upVotes: [],
  downVotes: [],
  ...overrides,
});

describe('JargonClarificationMessage', () => {
  it('renders the source text for a jargon_clarification message', () => {
    render(<JargonClarificationMessage message={makeJargonMessage()} />);
    expect(screen.getByText('Our SLOs are defined in terms of error budget.')).toBeInTheDocument();
  });

  it('renders the plain English text for a jargon_clarification message', () => {
    render(<JargonClarificationMessage message={makeJargonMessage()} />);
    expect(screen.getByText('An SLO is a target for how reliable a service should be.')).toBeInTheDocument();
  });

  it("renders 'Original' and 'Plain English' section labels", () => {
    render(<JargonClarificationMessage message={makeJargonMessage()} />);
    expect(screen.getByText(/original/i)).toBeInTheDocument();
    expect(screen.getByText(/plain english/i)).toBeInTheDocument();
  });

  it('renders only Plain English section when sourceText is missing', () => {
    const messageWithoutSource = makeJargonMessage({
      body: {
        type: 'jargon_clarification',
        text: 'An SLO is a target for how reliable a service should be.',
      },
    });
    render(<JargonClarificationMessage message={messageWithoutSource} />);
    expect(screen.getByText(/plain english/i)).toBeInTheDocument();
    expect(screen.getByText('An SLO is a target for how reliable a service should be.')).toBeInTheDocument();
    // Original section should not appear
    expect(screen.queryByText(/original/i)).not.toBeInTheDocument();
  });

  it('strips the legacy summary section from older messages', () => {
    const message = makeJargonMessage({
      body: {
        type: 'jargon_clarification',
        text: '**Summary:**\n\nThis is a summary of the discussion.\n\n- **SLO** — A reliability target.\n- **error budget** — The allowed failure rate.',
        sourceText: 'Our SLOs are defined in terms of error budget.',
      },
    });
    render(<JargonClarificationMessage message={message} />);
    expect(screen.queryByText(/Summary/)).not.toBeInTheDocument();
    expect(screen.queryByText('This is a summary of the discussion.')).not.toBeInTheDocument();
    expect(screen.getByText(/A reliability target/, { exact: false })).toBeInTheDocument();
  });

  it('renders new jargon filter messages without the summary section', () => {
    const message = makeJargonMessage({
      body: {
        type: 'jargon_clarification',
        text: '- **SLO** — A reliability target.\n- **error budget** — The allowed failure rate.',
        sourceText: 'Our SLOs are defined in terms of error budget.',
      },
    });
    render(<JargonClarificationMessage message={message} />);
    expect(screen.queryByText(/Summary/)).not.toBeInTheDocument();
    expect(screen.getByText(/A reliability target/, { exact: false })).toBeInTheDocument();
  });
});
