import { useState } from 'react';
import { Box, Button, TextField, Typography } from '@mui/material';
import { trackArtifactEvent } from '../../utils/artifactAnalytics';

const RATING_OPTIONS = ['No', 'Meh', 'OK', 'WOW!'] as const;
const MUTED = '#64748B';
const PANEL_BORDER = '#E2E8F0';

/**
 * A lightweight "was this graph clear?" prompt for a concept graph artifact, reported
 * through the same analytics pipeline (trackArtifactEvent) the graph's own select, view,
 * filter and deselect tracking uses, attributed to the conversation when there is one.
 *
 * MessageFeedback, the chat equivalent, posts a rating into the conversation as a
 * specially-tagged message (`/feedback|Rating|...`) — that only works because that screen
 * already has a live conversation, a channel passcode, and someone with standing to send a
 * message in it. None of that holds here: a reader of this graph may hold only the artifact
 * passcode, for a conversation that is long over, with no message-sending channel to post
 * into. Matomo is the durable record instead of the transcript.
 *
 * Only the rating and the length of any free text are sent: what a reader typed never leaves
 * the page, since an event name is stored and reported in the clear.
 * @property compact - One-line layout for the one-screen graph.
 * @property conversationId - The conversation the graph belongs to, for attribution.
 */
export const GraphFeedback = ({ compact = false, conversationId }: { compact?: boolean; conversationId?: string }) => {
  const [rating, setRating] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [textSent, setTextSent] = useState(false);

  const handleRate = (option: string) => {
    if (rating !== null) return;
    setRating(option);
    trackArtifactEvent(conversationId, 'graph', 'feedback_rating', option);
  };

  const handleSendText = () => {
    const trimmed = text.trim();
    if (!trimmed || textSent) return;
    trackArtifactEvent(conversationId, 'graph', 'feedback_text', 'submitted', trimmed.length);
    setTextSent(true);
  };

  return (
    <Box
      sx={
        compact
          ? { display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap', minHeight: 40 }
          : { mt: 2, pt: 1.5, borderTop: `1px solid ${PANEL_BORDER}` }
      }
    >
      <Typography
        variant="caption"
        id="graph-feedback-label"
        sx={{ display: compact ? 'inline' : 'block', color: MUTED, mb: compact ? 0 : 0.75 }}
      >
        Is this graph interesting, useful and clear?
      </Typography>
      <Box role="radiogroup" aria-labelledby="graph-feedback-label" sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        {RATING_OPTIONS.map((option) => (
          <Button
            key={option}
            size="small"
            variant={rating === option ? 'contained' : 'outlined'}
            role="radio"
            aria-checked={rating === option}
            disabled={rating !== null}
            onClick={() => handleRate(option)}
            sx={{
              textTransform: 'none',
              // Disabled buttons default to grey; keep the chosen one in the primary colour and
              // dim the rest so the selection stays visible after submitting.
              '&.Mui-disabled':
                rating === option ? { bgcolor: 'primary.main', color: 'primary.contrastText' } : { opacity: 0.5 },
            }}
          >
            {option}
          </Button>
        ))}
      </Box>

      {rating !== null && (
        <Box
          sx={{
            display: 'flex',
            gap: 1,
            mt: compact ? 0 : 1,
            alignItems: 'center',
            flexWrap: 'wrap',
            flex: compact ? 1 : undefined,
          }}
        >
          <Typography variant="body2" sx={{ color: MUTED }}>
            Thanks!
          </Typography>
          {textSent ? (
            <Typography variant="body2" sx={{ color: MUTED, fontStyle: 'italic' }}>
              Noted.
            </Typography>
          ) : (
            <>
              <TextField
                size="small"
                placeholder="Anything else? (optional)"
                value={text}
                onChange={(event) => setText(event.target.value)}
                inputProps={{ 'aria-label': 'Additional feedback' }}
                sx={{ flexGrow: 1, minWidth: 180 }}
              />
              <Button size="small" variant="contained" onClick={handleSendText} disabled={!text.trim()}>
                Send
              </Button>
            </>
          )}
        </Box>
      )}
    </Box>
  );
};
