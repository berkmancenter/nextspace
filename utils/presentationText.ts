import type { CSSProperties } from 'react';

/**
 * Text sizes for the presentation view, which is read from across a room. Message text is at least
 * 24pt (2rem); names and timestamps grow less so more of each message fits on screen. rem rather than
 * px so the sizes still follow the browser's text-size setting.
 */
export const PRESENTATION_TEXT: Record<'message' | 'name' | 'meta', CSSProperties> = {
  message: { fontSize: '2rem', lineHeight: 1.45 },
  name: { fontSize: '1.5rem', lineHeight: 1.3 },
  meta: { fontSize: '1.125rem', lineHeight: 1.4 },
};
