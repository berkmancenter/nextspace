import { FC, useState } from 'react';
import { Check } from '@mui/icons-material';
import { respondToPoll } from '../../utils/pollHelpers';
import { PRESENTATION_TEXT } from '../../utils/presentationText';

export interface PollMessageBody {
  type: 'poll';
  pollId: string;
  text: string;
  title: string;
  choices: string[];
  multiSelect: boolean;
  allowNewChoices: boolean;
  whenResultsVisible: string;
  initialVotedChoice?: string;
}

interface PollMessageProps {
  body: PollMessageBody;
  counts: Record<string, number> | null;
  /** Enlarges the question, choices and counts for the presentation view. */
  presentation?: boolean;
}

export const PollMessage: FC<PollMessageProps> = ({ body, counts, presentation = false }) => {
  // The poll sets its own sizes, so it can't inherit the presentation view's larger message text.
  const titleSize = presentation ? PRESENTATION_TEXT.message.fontSize : '0.9375rem';
  const choiceSize = presentation ? PRESENTATION_TEXT.name.fontSize : '0.9375rem';
  const metaSize = presentation ? PRESENTATION_TEXT.meta.fontSize : '0.8125rem';
  const { pollId, title, choices = [], multiSelect, whenResultsVisible } = body;
  const isAlwaysReveal = whenResultsVisible === 'always';

  const [votedChoices, setVotedChoices] = useState<Set<string>>(
    body.initialVotedChoice ? new Set([body.initialVotedChoice]) : new Set(),
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasVoted = votedChoices.size > 0;
  const totalVotes = counts ? Object.values(counts).reduce((sum, n) => sum + n, 0) : 0;
  const showResults = isAlwaysReveal && counts !== null;

  const handleVote = async (choiceText: string) => {
    if (loading) return;
    if (votedChoices.has(choiceText)) return;

    setLoading(true);
    setError(null);

    const newVoted = new Set(votedChoices);
    newVoted.add(choiceText);
    setVotedChoices(newVoted);

    try {
      await respondToPoll(pollId, choiceText);
    } catch {
      setVotedChoices(votedChoices);
      setError('Could not record your vote. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        marginTop: '0.625rem',
        borderRadius: '10px',
        overflow: 'hidden',
        backgroundColor: 'var(--nx-poll-bg)',
        border: '1px solid var(--nx-poll-border)',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '0.625rem 0.875rem 0.5rem',
          borderBottom: '1px solid var(--nx-poll-divider)',
        }}
      >
        <p style={{ fontSize: titleSize, fontWeight: 600, color: 'var(--nx-poll-text)', margin: 0, lineHeight: 1.4 }}>
          {title}
        </p>
        {!hasVoted && (
          <p style={{ fontSize: metaSize, color: 'var(--nx-poll-meta)', margin: '2px 0 0', lineHeight: 1 }}>
            {multiSelect ? 'Select all that apply' : 'Select one'}
          </p>
        )}
      </div>

      {/* Choices */}
      <div style={{ padding: '0.375rem 0', width: '100%' }}>
        {choices.map((choice, i) => {
          const isSelected = votedChoices.has(choice);
          const count = counts?.[choice] ?? 0;
          const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
          const canVote = !loading && !hasVoted && !isSelected;

          return (
            <div
              key={choice}
              onClick={() => canVote && handleVote(choice)}
              style={{
                cursor: canVote ? 'pointer' : 'default',
                userSelect: 'none',
                borderTop: i > 0 ? '1px solid var(--nx-poll-row-divider)' : undefined,
                backgroundColor: isSelected ? 'var(--nx-poll-selected-bg)' : undefined,
                transition: 'background-color 0.15s ease',
              }}
            >
              {/* Content row */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '0.5rem',
                  padding: '0.5rem 0.875rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
                  {/* Selection indicator */}
                  <div
                    style={{
                      flexShrink: 0,
                      width: 16,
                      height: 16,
                      borderRadius: multiSelect ? '4px' : '50%',
                      border: `2px solid ${isSelected ? 'var(--nx-poll-check-bg)' : 'var(--nx-poll-check-border)'}`,
                      backgroundColor: isSelected ? 'var(--nx-poll-check-bg)' : 'transparent',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {isSelected && <Check sx={{ fontSize: '0.65rem', color: 'var(--nx-poll-check-fg)' }} />}
                  </div>
                  <span
                    style={{
                      fontSize: choiceSize,
                      color: isSelected ? 'var(--nx-poll-text)' : 'var(--nx-poll-choice)',
                      fontWeight: isSelected ? 600 : 400,
                      lineHeight: 1.35,
                    }}
                  >
                    {choice}
                  </span>
                </div>

                {/* Count */}
                {showResults && (
                  <span
                    style={{
                      flexShrink: 0,
                      fontSize: metaSize,
                      fontWeight: isSelected ? 600 : 400,
                      color: isSelected ? 'var(--nx-poll-count-selected)' : 'var(--nx-poll-count)',
                    }}
                  >
                    {pct}%
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div
        style={{
          padding: '0.375rem 0.875rem',
          borderTop: '1px solid var(--nx-poll-divider)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span style={{ fontSize: metaSize, color: 'var(--nx-poll-meta)' }}>
          {showResults ? `${totalVotes} vote${totalVotes !== 1 ? 's' : ''}` : hasVoted ? 'Vote recorded' : ''}
        </span>
        {!isAlwaysReveal && hasVoted && (
          <span style={{ fontSize: metaSize, color: 'var(--nx-poll-meta)', fontStyle: 'italic' }}>
            Results visible later
          </span>
        )}
      </div>

      {error && (
        <p style={{ fontSize: metaSize, color: 'var(--nx-error-text)', padding: '0 0.875rem 0.5rem', margin: 0 }}>{error}</p>
      )}
    </div>
  );
};
