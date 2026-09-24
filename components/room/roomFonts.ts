import { CSSProperties } from 'react';
import { IBM_Plex_Mono, IBM_Plex_Sans, Space_Grotesk } from 'next/font/google';

const displayFont = Space_Grotesk({ subsets: ['latin'], weight: ['600', '700'] });
const bodyFont = IBM_Plex_Sans({ subsets: ['latin'], weight: ['400', '500', '600'] });
const monoFont = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500', '600'] });

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
