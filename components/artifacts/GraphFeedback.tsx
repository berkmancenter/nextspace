import { useState } from 'react';
import { Box, Button, TextField, Typography } from '@mui/material';
import { trackEvent } from '../../utils/analytics';

const RATING_OPTIONS = ['No', 'Meh', 'OK', 'WOW!'] as const;
const MUTED = '#64748B';
const PANEL_BORDER = '#E2E8F0';

/**
 * A lightweight "was this graph clear?" prompt for a concept graph artifact, reported
 * through the same analytics pipeline (trackEvent) the canvas's own zoom/pan/fit tracking
 * already uses.
 *
 * MessageFeedback, the chat equivalent, posts a rating into the conversation as a
 * specially-tagged message (`/feedback|Rating|...`) — that only works because that screen
 * already has a live conversation, a channel passcode, and someone with standing to send a
 * message in it. None of that holds here: a reader of this graph may hold only the artifact
 * passcode, for a conversation that is long over, with no message-sending channel to post
 * into. Matomo is the durable record instead of the transcript, the same trade this
 * component's zoom/pan/fit tracking already made.
 */
export const GraphFeedback = () => {
  const [rating, setRating] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [textSent, setTextSent] = useState(false);

  const handleRate = (option: string) => {
    if (rating !== null) return;
    setRating(option);
    trackEvent('graph', 'feedback_rating', option);
  };

  const handleSendText = () => {
    const trimmed = text.trim();
    if (!trimmed || textSent) return;
    trackEvent('graph', 'feedback_text', trimmed);
    setTextSent(true);
  };

  return (
    <Box sx={{ mt: 2, pt: 1.5, borderTop: `1px solid ${PANEL_BORDER}` }}>
      <Typography variant="caption" id="graph-feedback-label" sx={{ display: 'block', color: MUTED, mb: 0.75 }}>
        Was this graph clear?
      </Typography>
      <Box role="radiogroup" aria-labelledby="graph-feedback-label" sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        {RATING_OPTIONS.map((option) => (
          <Button
            key={option}
            size="small"
            variant="outlined"
            role="radio"
            aria-checked={rating === option}
            disabled={rating !== null}
            onClick={() => handleRate(option)}
            sx={{ textTransform: 'none' }}
          >
            {option}
          </Button>
        ))}
      </Box>

      {rating !== null && (
        <Box sx={{ display: 'flex', gap: 1, mt: 1, alignItems: 'center', flexWrap: 'wrap' }}>
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
