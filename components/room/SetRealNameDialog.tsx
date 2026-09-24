import React, { useState } from 'react';
import { Dialog } from '@mui/material';
import { SaveRealNameResult } from '../../types.internal';
import { roomFontVariables } from './roomFonts';
import styles from './communityRoom.module.css';

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
          // The portal puts this outside the room, so styles.root has to travel with it.
          className: `${styles.root} ${styles.nameDialogPaper}`,
          style: roomFontVariables,
        },
      }}
    >
      <div className="flex flex-col gap-4">
        <h2 id="set-real-name-title" className={styles.nameDialogTitle}>
          Set your name for this room
        </h2>

        {confirming ? (
          <>
            <p id="set-real-name-description" className={styles.nameDialogBody}>
              Everyone here will see your messages under this name, and it cannot be changed later.
            </p>
            <p className={styles.nameDialogName}>{trimmed}</p>
            <div className={styles.nameDialogActions}>
              <button type="button" className={styles.nameDialogPrimary} onClick={save} disabled={saving}>
                Yes, use this name
              </button>
              <button
                type="button"
                className={styles.nameDialogSecondary}
                onClick={() => setConfirming(false)}
                disabled={saving}
              >
                Back
              </button>
            </div>
          </>
        ) : (
          <>
            <p id="set-real-name-description" className={styles.nameDialogBody}>
              This room shows real names rather than pseudonyms, so it needs one for you before you can post. You can keep
              reading without setting one.
            </p>
            <div className="flex flex-col gap-2">
              <label htmlFor="set-real-name-field" className={styles.nameDialogLabel}>
                Your name
              </label>
              <input
                id="set-real-name-field"
                className={styles.nameDialogInput}
                value={name}
                onChange={(event) => setName(event.target.value)}
                aria-describedby={problem ? 'set-real-name-problem' : undefined}
                aria-invalid={!!problem}
                autoFocus
              />
              {problem && (
                <p id="set-real-name-problem" role="alert" className={styles.nameDialogError}>
                  {problem}
                </p>
              )}
            </div>
            <div className={styles.nameDialogActions}>
              <button type="button" className={styles.nameDialogPrimary} onClick={review}>
                Set my name
              </button>
              <button type="button" className={styles.nameDialogSecondary} onClick={onDismiss}>
                I&apos;m just reading
              </button>
            </div>
          </>
        )}
      </div>
    </Dialog>
  );
}
