import React from "react";

/**
 * BotIcon — custom robot SVG used throughout the app for the Event Assistant.
 *
 * Matches the "thinking..." indicator in AssistantChatPanel and the nav bar icon.
 *
 * @param size   Width/height in pixels (default 26)
 * @param color  Stroke/fill color (default "currentColor")
 * @param className  Optional extra className
 */
export function BotIcon({
  size = 26,
  color = "currentColor",
  className = "",
  bouncing = false,
}: {
  size?: number;
  color?: string;
  className?: string;
  /** When true, animates the antenna dot with a bounce to indicate "thinking" */
  bouncing?: boolean;
}) {
  return (
    <svg
      viewBox="0 -4 32 36"
      width={size}
      height={size}
      fill="none"
      stroke={color}
      strokeWidth="1.5"
      className={`${bouncing ? "overflow-visible" : ""}${className ? ` ${className}` : ""}` || undefined}
      aria-hidden="true"
    >
      {/* Antenna dot — bounces independently when bouncing=true */}
      <circle
        cx="16"
        cy="5.5"
        r="2"
        fill={color}
        className={bouncing ? "animate-bounce" : undefined}
      />
      {/* Antenna line */}
      <line x1="16" y1="7.5" x2="16" y2="10" />
      {/* Head */}
      <rect x="8" y="10" width="16" height="12" rx="6" />
      {/* Eyes */}
      <circle cx="12" cy="16" r="1.5" fill={color} />
      <circle cx="20" cy="16" r="1.5" fill={color} />
      {/* Smile */}
      <path d="M13 19 Q16 21 19 19" strokeLinecap="round" fill="none" />
      {/* Arms */}
      <line x1="8" y1="15" x2="4.5" y2="13" />
      <line x1="24" y1="15" x2="27.5" y2="13" />
      {/* Body/Base */}
      <rect x="13" y="22" width="6" height="5" rx="2" />
    </svg>
  );
}
