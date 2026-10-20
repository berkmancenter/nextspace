import { CSSProperties } from 'react';
import localFont from 'next/font/local';

/* Bundled rather than fetched from Google at build time: next/font/google downloads on
   every cache miss, so a bad response from Google fails the production build. Files and
   their licence are in ./fonts. Space Grotesk and IBM Plex Sans carry a weight axis, so
   one file covers their range; IBM Plex Mono ships a file per weight. */
const displayFont = localFont({
  src: [{ path: './fonts/space-grotesk-variable.woff2', weight: '600 700', style: 'normal' }],
  display: 'swap',
  fallback: ['sans-serif'],
});

const bodyFont = localFont({
  src: [{ path: './fonts/ibm-plex-sans-variable.woff2', weight: '400 600', style: 'normal' }],
  display: 'swap',
  fallback: ['sans-serif'],
});

const monoFont = localFont({
  src: [
    { path: './fonts/ibm-plex-mono-400.woff2', weight: '400', style: 'normal' },
    { path: './fonts/ibm-plex-mono-500.woff2', weight: '500', style: 'normal' },
    { path: './fonts/ibm-plex-mono-600.woff2', weight: '600', style: 'normal' },
  ],
  display: 'swap',
  fallback: ['monospace'],
});

/**
 * The room's fonts, as custom properties for communityRoom.module.css to read. Shared because
 * anything MUI renders through a portal sits outside the room's markup and inherits nothing,
 * so those components have to be handed the same variables the room page sets.
 */
export const roomFontVariables = {
  '--room-font-display': displayFont.style.fontFamily,
  '--room-font-body': bodyFont.style.fontFamily,
  '--room-font-mono': monoFont.style.fontFamily,
} as CSSProperties;
