import React from "react";

/**
 * JargonIcon — custom SVG icon for the Jargon Filter navigation item.
 *
 * Renders text lines with a magnifying glass overlapping them. The `color`
 * prop controls all stroke paths, making it easy to switch between active
 * (#1a1a1a) and inactive (#9E9E9E) states in the nav bar.
 *
 * @param size   Width/height in pixels (default 26)
 * @param color  Stroke color (default "currentColor")
 * @param className  Optional extra className
 */
export function JargonIcon({
  size = 26,
  color = "currentColor",
  className = "",
}: {
  size?: number;
  color?: string;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 26 26"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className || undefined}
      aria-hidden="true"
    >
      {/* Text lines — partially behind the magnifying glass */}
      <line x1="3.5" y1="9" x2="14.5" y2="9" stroke={color} strokeWidth="1.5" strokeLinecap="round" opacity="0.45" />
      <line x1="3.5" y1="12.5" x2="12" y2="12.5" stroke={color} strokeWidth="1.5" strokeLinecap="round" opacity="0.45" />
      <line x1="3.5" y1="16" x2="10" y2="16" stroke={color} strokeWidth="1.5" strokeLinecap="round" opacity="0.45" />
      {/* Magnifying glass — overlapping the text */}
      <circle cx="16" cy="11" r="5.2" stroke={color} strokeWidth="2" />
      {/* Handle */}
      <line x1="19.7" y1="14.7" x2="23" y2="18" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}
