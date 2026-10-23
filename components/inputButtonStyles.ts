/** Shared `sx` for the composer's round enhancer (chip) buttons and send icon, used by the message input and thread reply. */
export const chipButtonSx = {
  padding: '6px',
  fontSize: '0.875rem',
  color: 'var(--nx-chip-btn-fg)',
  backgroundColor: 'var(--nx-chip-btn-bg)',
  border: 'var(--nx-chip-btn-border)',
  borderRadius: '50%',
  width: '32px',
  height: '32px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  '&:hover': {
    color: 'var(--nx-chip-btn-hover-fg)',
    backgroundColor: 'var(--nx-chip-btn-hover-bg)',
  },
};

export const sendIconSx = {
  color: 'var(--nx-send-fg)',
  backgroundColor: 'var(--nx-send-bg)',
  borderRadius: '50%',
  padding: '4px',
  transform: 'rotate(-45deg)',
};
