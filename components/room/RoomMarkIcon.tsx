import React from 'react';

/** The community room's mark, drawn beside the title in the room and lounge headers. */
export function RoomMarkIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 1.9 21 7.05v9.9L12 22.1 3 16.95v-9.9Z"
        stroke="var(--room-you-bg)"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M12 7.4 16.4 9.9v5L12 17.4 7.6 14.9v-5Z" fill="var(--room-you-bg)" />
    </svg>
  );
}
