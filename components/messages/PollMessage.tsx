import { FC, useState } from 'react';
import { Check } from '@mui/icons-material';
import { respondToPoll } from '../../utils/pollHelpers';

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
}

export const PollMessage: FC<PollMessageProps> = ({ body, counts }) => {
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
        backgroundColor: 'white',
        border: '1px solid rgba(0,0,0,0.1)',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '0.625rem 0.875rem 0.5rem',
          borderBottom: '1px solid rgba(0,0,0,0.07)',
        }}
      >
        <p style={{ fontSize: '0.9375rem', fontWeight: 600, color: '#1f2937', margin: 0, lineHeight: 1.4 }}>{title}</p>
        {!hasVoted && (
          <p style={{ fontSize: '0.8125rem', color: '#9ca3af', margin: '2px 0 0', lineHeight: 1 }}>
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
                borderTop: i > 0 ? '1px solid rgba(0,0,0,0.05)' : undefined,
                backgroundColor: isSelected ? 'rgba(72,69,210,0.1)' : undefined,
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
                      border: `2px solid ${isSelected ? '#4845D2' : 'rgba(0,0,0,0.25)'}`,
                      backgroundColor: isSelected ? '#4845D2' : 'transparent',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {isSelected && <Check sx={{ fontSize: '0.65rem', color: 'white' }} />}
                  </div>
                  <span
                    style={{
                      fontSize: '0.9375rem',
                      color: isSelected ? '#1f2937' : '#374151',
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
                      fontSize: '0.8125rem',
                      fontWeight: isSelected ? 600 : 400,
                      color: isSelected ? '#4845D2' : '#6b7280',
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
          borderTop: '1px solid rgba(0,0,0,0.07)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span style={{ fontSize: '0.8125rem', color: '#9ca3af' }}>
          {showResults ? `${totalVotes} vote${totalVotes !== 1 ? 's' : ''}` : hasVoted ? 'Vote recorded' : ''}
        </span>
        {!isAlwaysReveal && hasVoted && (
          <span style={{ fontSize: '0.8125rem', color: '#9ca3af', fontStyle: 'italic' }}>Results visible later</span>
        )}
      </div>

      {error && <p style={{ fontSize: '0.8125rem', color: '#ef4444', padding: '0 0.875rem 0.5rem', margin: 0 }}>{error}</p>}
    </div>
  );
};
