import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PollMessage } from '../../../components/messages/PollMessage';
import type { PollMessageBody } from '../../../components/messages/PollMessage';
import { respondToPoll } from '../../../utils/pollHelpers';

jest.mock('../../../utils/pollHelpers', () => ({
  respondToPoll: jest.fn(),
}));

const mockRespondToPoll = respondToPoll as jest.Mock;

const basePollBody: PollMessageBody = {
  type: 'poll',
  pollId: 'poll-1',
  text: 'Tell us what you think!',
  title: 'Best language?',
  choices: ['TypeScript', 'Python', 'Rust'],
  multiSelect: false,
  allowNewChoices: false,
  whenResultsVisible: 'always',
};

const baseCounts = { TypeScript: 5, Python: 3, Rust: 2 };

const baseProps = {
  body: basePollBody,
  counts: baseCounts,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockRespondToPoll.mockResolvedValue({ ok: true });
});

describe('PollMessage', () => {
  describe('rendering', () => {
    it('renders the poll title', () => {
      render(<PollMessage {...baseProps} />);
      expect(screen.getByText('Best language?')).toBeInTheDocument();
    });

    it('renders all choices', () => {
      render(<PollMessage {...baseProps} />);
      expect(screen.getByText('TypeScript')).toBeInTheDocument();
      expect(screen.getByText('Python')).toBeInTheDocument();
      expect(screen.getByText('Rust')).toBeInTheDocument();
    });

    it('shows vote counts as percentages when whenResultsVisible is always and counts provided', () => {
      render(<PollMessage {...baseProps} />);
      // 5/10 = 50%, 3/10 = 30%, 2/10 = 20%
      expect(screen.getByText('50%')).toBeInTheDocument();
      expect(screen.getByText('30%')).toBeInTheDocument();
      expect(screen.getByText('20%')).toBeInTheDocument();
    });

    it('shows total vote count', () => {
      render(<PollMessage {...baseProps} />);
      expect(screen.getByText('10 votes')).toBeInTheDocument();
    });

    it('shows singular "vote" for total of 1', () => {
      render(<PollMessage {...baseProps} counts={{ TypeScript: 1, Python: 0, Rust: 0 }} />);
      expect(screen.getByText('1 vote')).toBeInTheDocument();
    });

    it('shows "Select one" hint for single-select unvoted poll', () => {
      render(<PollMessage {...baseProps} />);
      expect(screen.getByText('Select one')).toBeInTheDocument();
    });

    it('shows "Select all that apply" hint for multiSelect poll', () => {
      render(<PollMessage {...baseProps} body={{ ...basePollBody, multiSelect: true }} />);
      expect(screen.getByText('Select all that apply')).toBeInTheDocument();
    });

    it('seeds voted choice from initialVotedChoice', () => {
      render(<PollMessage {...baseProps} body={{ ...basePollBody, initialVotedChoice: 'TypeScript' }} />);
      expect(screen.queryByText('Select one')).not.toBeInTheDocument();
    });
  });

  describe('voting', () => {
    it('calls respondToPoll with the correct pollId and choice', async () => {
      render(<PollMessage {...baseProps} />);
      fireEvent.click(screen.getByText('TypeScript'));
      await waitFor(() => expect(mockRespondToPoll).toHaveBeenCalledWith('poll-1', 'TypeScript'));
    });

    it('does not call respondToPoll when clicking a different choice after already voting', async () => {
      render(<PollMessage {...baseProps} body={{ ...basePollBody, initialVotedChoice: 'Python' }} />);
      fireEvent.click(screen.getByText('TypeScript'));
      await waitFor(() => expect(mockRespondToPoll).not.toHaveBeenCalled());
    });

    it('does not call respondToPoll when clicking already-selected choice', async () => {
      render(<PollMessage {...baseProps} body={{ ...basePollBody, initialVotedChoice: 'TypeScript' }} />);
      fireEvent.click(screen.getByText('TypeScript'));
      await waitFor(() => expect(mockRespondToPoll).not.toHaveBeenCalled());
    });

    it('shows error message on API failure', async () => {
      mockRespondToPoll.mockRejectedValue(new Error('Network error'));
      render(<PollMessage {...baseProps} />);
      fireEvent.click(screen.getByText('TypeScript'));
      await waitFor(() => expect(screen.getByText('Could not record your vote. Please try again.')).toBeInTheDocument());
    });
  });

  describe('results not always visible', () => {
    it('does not show percentages when whenResultsVisible is not always', () => {
      render(<PollMessage {...baseProps} body={{ ...basePollBody, whenResultsVisible: 'threshold_only' }} />);
      expect(screen.queryByText('50%')).not.toBeInTheDocument();
    });

    it('shows "Results visible later" after voting on non-always poll', async () => {
      render(<PollMessage {...baseProps} body={{ ...basePollBody, whenResultsVisible: 'threshold_only' }} />);
      fireEvent.click(screen.getByText('TypeScript'));
      await waitFor(() => expect(screen.getByText('Results visible later')).toBeInTheDocument());
    });
  });
});
