import { cgVar, skyShape } from './tokens';

/** Shared `sx` fragments for the sky's panel, list, legend and controls. Colours are `--cg-*` vars, so use inside `.concept-sky`. */

export const eyebrowSx = {
  fontFamily: 'var(--cg-font-mono)',
  fontWeight: 500,
  fontSize: 11,
  letterSpacing: '0.14em',
  textTransform: 'uppercase' as const,
  color: cgVar('accent'),
};

export const mutedEyebrowSx = { ...eyebrowSx, color: cgVar('textSecondary'), letterSpacing: '0.12em' };

/** Pill buttons that jump to another concept or prompt. */
export const chipSx = {
  minHeight: 36,
  px: 1.5,
  py: 0.75,
  bgcolor: 'transparent',
  color: cgVar('textPrimary'),
  border: `1px solid ${cgVar('borderStrong')}`,
  borderRadius: `${skyShape.radiusPill}px`,
  font: '500 13px/1.2 var(--cg-font-sans)',
  cursor: 'pointer',
  textAlign: 'left' as const,
  '&:hover': { borderColor: cgVar('textPlaceholder') },
};

export const serifRelationSx = {
  fontFamily: 'var(--cg-font-serif)',
  fontStyle: 'italic',
  fontSize: 17,
  lineHeight: 1.3,
  color: cgVar('textRelation'),
};

/** A text-only button that looks like a relation phrase, at the 44px target minimum. */
export const linkButtonSx = {
  ...serifRelationSx,
  minHeight: skyShape.targetMin,
  p: 0,
  bgcolor: 'transparent',
  border: 0,
  textAlign: 'left' as const,
  cursor: 'pointer',
  '&:hover': { textDecoration: 'underline', textUnderlineOffset: '3px' },
};

export const noteSx = {
  m: 0,
  p: 1.75,
  border: `1px dashed ${cgVar('borderNote')}`,
  borderRadius: '12px',
  fontSize: 13,
  lineHeight: 1.5,
  color: cgVar('textSecondary'),
};
