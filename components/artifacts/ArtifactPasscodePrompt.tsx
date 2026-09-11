import { FormEvent, useState } from 'react';
import { Box, Button, TextField, Typography } from '@mui/material';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';

/**
 * Props for ArtifactPasscodePrompt.
 * @property onSubmit - Called with the passcode the reader entered.
 * @property retrying - True while a passcode that was just submitted is being checked.
 * @property rejected - True once a submitted passcode has come back refused.
 */
interface ArtifactPasscodePromptProps {
  onSubmit: (passcode: string) => void;
  retrying?: boolean;
  rejected?: boolean;
}

/**
 * What a reader sees when the artifact endpoints refuse a read.
 *
 * A wrong passcode, a missing passcode, and an id that matches nothing all come back as the
 * same 403 with the same message, on purpose — so the endpoint cannot be used to find out
 * which conversations exist or hold artifacts. That makes "you need this artifact's
 * passcode" the only reading a visitor can act on, and this page never claims an artifact
 * does or does not exist.
 */
export const ArtifactPasscodePrompt = ({ onSubmit, retrying, rejected }: ArtifactPasscodePromptProps) => {
  const [passcode, setPasscode] = useState('');

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = passcode.trim();
    if (trimmed) onSubmit(trimmed);
  };

  return (
    <Box
      component="form"
      onSubmit={handleSubmit}
      sx={{
        maxWidth: 460,
        mx: 'auto',
        mt: 6,
        p: 3,
        border: '1px solid #E2E8F0',
        borderRadius: 2,
        bgcolor: '#FFFFFF',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <LockOutlinedIcon fontSize="small" sx={{ color: '#4845D2' }} />
        <Typography variant="h6" component="h1" sx={{ fontWeight: 600 }}>
          This artifact needs a passcode
        </Typography>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Artifacts are shared with a passcode from whoever ran the event. Paste it here, or open the link they sent you — it
        carries the passcode already.
      </Typography>

      <TextField
        fullWidth
        size="small"
        label="Artifact passcode"
        value={passcode}
        onChange={(event) => setPasscode(event.target.value)}
        error={rejected}
        helperText={rejected ? 'That passcode was not accepted.' : ' '}
        slotProps={{ htmlInput: { 'aria-label': 'Artifact passcode' } }}
      />

      <Button type="submit" variant="contained" disabled={!passcode.trim() || retrying} sx={{ mt: 1 }}>
        {retrying ? 'Checking…' : 'Open'}
      </Button>
    </Box>
  );
};
