import React, { useState } from 'react';
import { Button, Dialog, TextField } from '@mui/material';
import { SaveRealNameResult } from '../../types.internal';

interface SetRealNameDialogProps {
  open: boolean;
  onSave: (name: string) => Promise<SaveRealNameResult>;
  onDismiss: () => void;
}

/**
 * Asks an admin what this room should call them, since a room attributes messages to a real
 * name and an admin has none until they claim one. Nothing but the two buttons closes it,
 * because the name cannot be changed once saved.
 */
export function SetRealNameDialog({ open, onSave, onDismiss }: SetRealNameDialogProps) {
  const [name, setName] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const trimmed = name.trim();

  const review = () => {
    if (!trimmed) {
      setProblem('Enter a name before continuing.');
      return;
    }
    setProblem(null);
    setConfirming(true);
  };

  const save = async () => {
    setSaving(true);
    let result: SaveRealNameResult = { ok: false };
    try {
      result = await onSave(trimmed);
    } catch (error) {
      // Letting this through would leave every button disabled in a dialog nothing else closes.
      console.error('Could not claim a real name for this room:', error);
    } finally {
      setSaving(false);
    }
    if (result.ok) return;
    setConfirming(false);
    setProblem(
      result.taken
        ? 'Someone in this room is already using that name. Choose a different one.'
        : 'That name could not be saved. Try again.',
    );
  };

  return (
    <Dialog
      open={open}
      // Backdrop clicks and Escape both arrive here; neither may close this.
      onClose={() => {}}
      disableEscapeKeyDown
      aria-labelledby="set-real-name-title"
      aria-describedby="set-real-name-description"
      slotProps={{
        paper: {
          sx: { borderRadius: '16px', padding: '32px 24px', maxWidth: '440px' },
        },
      }}
    >
      <div className="flex flex-col gap-4">
        <h2 id="set-real-name-title" className="text-2xl font-bold text-gray-900">
          Set your name for this room
        </h2>

        {confirming ? (
          <>
            <p id="set-real-name-description" className="text-gray-600 text-base leading-relaxed">
              Everyone here will see your messages under this name, and it cannot be changed later.
            </p>
            <p className="text-lg font-bold text-gray-900">{trimmed}</p>
            <div className="flex flex-col gap-3">
              <Button onClick={save} disabled={saving}>
                Yes, use this name
              </Button>
              <Button onClick={() => setConfirming(false)} disabled={saving}>
                Back
              </Button>
            </div>
          </>
        ) : (
          <>
            <p id="set-real-name-description" className="text-gray-600 text-base leading-relaxed">
              This room shows real names rather than pseudonyms, so it needs one for you before you can post. You can keep
              reading without setting one.
            </p>
            <TextField
              label="Your name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              error={!!problem}
              helperText={problem ?? ' '}
              autoFocus
              fullWidth
            />
            <div className="flex flex-col gap-3">
              <Button onClick={review}>Set my name</Button>
              <Button onClick={onDismiss}>I&apos;m just reading</Button>
            </div>
          </>
        )}
      </div>
    </Dialog>
  );
}
