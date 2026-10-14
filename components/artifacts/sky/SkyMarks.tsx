import React from 'react';
import { cgVar, skyGeometry as G, haloOpacity } from './tokens';

/**
 * Small SVG marks for legends and panels. Colours come from `--cg-*` tokens, so render them
 * inside a `.concept-sky` container. Dashed always means "summary only, no direct quote".
 */

type MarkProps = { size?: number; title?: string; className?: string };

const svgProps = (title?: string) => (title ? { role: 'img', 'aria-label': title } : { 'aria-hidden': true });

/** Concept star with halo; `selected` adds the link-coloured ring. */
export function StarMark({
  size = 24,
  degree = 5,
  selected = false,
  title,
  className,
}: MarkProps & { degree?: number; selected?: boolean }) {
  const id = React.useId();
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" className={className} {...svgProps(title)}>
      <defs>
        <filter id={id} x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation={G.star.haloBlur} />
        </filter>
      </defs>
      <circle
        cx="24"
        cy="24"
        r={8 * G.star.haloScale}
        fill={cgVar('star')}
        opacity={haloOpacity(degree)}
        filter={`url(#${id})`}
      />
      {selected && (
        <circle cx="24" cy="24" r="13" fill="none" stroke={cgVar('link')} strokeWidth={G.star.selectedRingWidth} />
      )}
      <circle cx="24" cy="24" r="8" fill={cgVar('star')} />
    </svg>
  );
}

export const SelectedStarMark = (p: MarkProps & { degree?: number }) => <StarMark {...p} selected />;

/** Statement diamond (solid outline: has a direct quote). `dashed` = summary only. */
function Diamond({ size = 24, dashed, filled, title, className }: MarkProps & { dashed: boolean; filled?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} {...svgProps(title)}>
      <rect
        x="6.5"
        y="6.5"
        width="11"
        height="11"
        rx={G.diamond.cornerRadius}
        transform="rotate(45 12 12)"
        fill={filled ? cgVar('link') : cgVar('surfaceSky')}
        stroke={cgVar('link')}
        strokeWidth={G.diamond.strokeWidth}
        strokeDasharray={dashed ? G.diamond.dash : undefined}
      />
    </svg>
  );
}

export const StatementDiamondMark = (p: MarkProps & { filled?: boolean }) => <Diamond {...p} dashed={false} />;
export const SummaryDiamondMark = (p: MarkProps & { filled?: boolean }) => <Diamond {...p} dashed />;

function Line({
  width = 48,
  dashed,
  title,
  className,
}: {
  width?: number;
  dashed: boolean;
  title?: string;
  className?: string;
}) {
  return (
    <svg width={width} height={12} viewBox="0 0 48 12" className={className} {...svgProps(title)}>
      <line
        x1="2"
        y1="6"
        x2="46"
        y2="6"
        stroke={cgVar('link')}
        strokeWidth="2"
        strokeLinecap={dashed ? undefined : 'round'}
        strokeDasharray={dashed ? G.line.summaryDash : undefined}
      />
    </svg>
  );
}

/** Quote line: two concepts joined by a direct quote (solid). */
export const QuoteLineMark = (p: { width?: number; title?: string; className?: string }) => <Line {...p} dashed={false} />;
/** Summary line: summary-level link, no direct quote (dashed). */
export const SummaryLineMark = (p: { width?: number; title?: string; className?: string }) => <Line {...p} dashed />;

/**
 * Origin-prompt pill: outlined in the session colour, filled with the sky colour;
 * `filled` (hover / selected) fills it with the session colour.
 */
export function PromptPillMark({
  color,
  filled = false,
  width = 28,
  title,
  className,
}: {
  /** Session colour, e.g. sessionColor(i) or sessionVar(i). */
  color: string;
  filled?: boolean;
  width?: number;
  title?: string;
  className?: string;
}) {
  return (
    <svg width={width} height={(width * 14) / 28} viewBox="0 0 28 14" className={className} {...svgProps(title)}>
      <rect
        x="1"
        y="1"
        width="26"
        height="12"
        rx="6"
        fill={filled ? color : cgVar('surfaceSky')}
        stroke={color}
        strokeWidth="1.5"
      />
    </svg>
  );
}
