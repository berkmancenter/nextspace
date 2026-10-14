/**
 * Design tokens for the dark "concept sky" (All Too Human constellation handoff).
 *
 * Names are semantic (role-based) and prefixed `--cg-` as CSS custom properties, scoped to
 * the `.concept-sky` container (see SkyStyle.tsx) so the dark theme never leaks into the app.
 * Dual-use colours are split into separate tokens even where the values coincide
 * (star vs textPrimary, accent vs focusRing) so the designer can move them independently.
 *
 * Components must take colours from here (or `var(--cg-*)`), never from hex literals.
 */

/** WCAG contrast helpers and hex mixing, kept here so the tokens can be verified in tests. */
const toLinear = (v: number): number => {
  const s = v / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};

const parseHex = (hex: string): [number, number, number] => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

export const relativeLuminance = (hex: string): number => {
  const [r, g, b] = parseHex(hex);
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
};

/** WCAG 2 contrast ratio between two #rrggbb colours (1..21). */
export const contrastRatio = (a: string, b: string): number => {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
};

/** sRGB mix like CSS `color-mix(in srgb, a pct%, b)`; returns #rrggbb. */
export const mixHex = (a: string, b: string, pctA: number): string => {
  const ca = parseHex(a);
  const cb = parseHex(b);
  const out = ca.map((v, i) => Math.round((v * pctA) / 100 + cb[i] * (1 - pctA / 100)));
  return `#${out.map((v) => v.toString(16).padStart(2, '0')).join('')}`.toUpperCase();
};

/**
 * Session palette: 8 SOLID colours (never dashed; dashed is reserved for "summary only").
 * PLACEHOLDERS: the designer will change these. Sessions 1-5 are the designer's placeholders
 * (Clay shifted lighter/more orange to separate it from the line colour); 6-8 are additions.
 * Every entry must keep >= 5:1 on the sky surface (enforced in tests).
 */
export const SESSION_PALETTE = [
  '#B5C99A', // 1 Sage
  '#3E9C93', // 2 Teal
  '#7E98D6', // 3 Dusk
  '#E3BDEB', // 4 Heather
  '#F09A5E', // 5 Clay (lighter than designer's, apart from the crimson line)
  '#E6C84A', // 6 Gold
  '#5FC3E8', // 7 Sky blue
  '#D9709F', // 8 Rose
] as const;

/**
 * Colour for the Nth session (0-based). Wraps modulo the palette length, so sessions past the
 * last colour reuse the palette in order. Negative / non-integer indexes are normalised.
 */
export const sessionColor = (index: number): string => {
  const n = SESSION_PALETTE.length;
  const i = Math.floor(Number.isFinite(index) ? index : 0);
  return SESSION_PALETTE[((i % n) + n) % n];
};

const LINK_BASE = '#A51C30'; // Harvard crimson, the source hue; never drawn directly (2.5:1 on the sky)
const STAR = '#EDE4D3';

/** Raw colour values. Keys are camelCase forms of the `--cg-` CSS variable names. */
export const skyColors = {
  surfaceSky: '#1A1214',
  surfaceSkyGlow: '#241719',
  surfacePanel: '#211719',
  surfaceControl: '#241A1C',
  surfaceTile: '#2A1E20',
  border: '#2E2123',
  borderStrong: '#3B2A2C',
  divider: '#33262A',
  borderNote: '#4A3638',
  star: STAR,
  textPrimary: '#EDE4D3',
  textBody: '#D6C9B8',
  textSecondary: '#B9A99E',
  label: '#B9A99E',
  textPlaceholder: '#8F7F76',
  linkBase: LINK_BASE,
  /** Derived: link-base 60% with star (mirrors the CSS color-mix). */
  link: mixHex(LINK_BASE, STAR, 60),
  /** Reserved: summary links look the same as participant links for now. */
  linkSummary: mixHex(LINK_BASE, STAR, 60),
  accent: '#E2B48A',
  focusRing: '#E2B48A',
  textRelation: '#E9C9A5',
  /** Neutral ash; the rule is reuse-in-order (sessionColor), this is for "no session". */
  sessionFallback: '#B9A99E',
  /** Dotted connector from an origin prompt to its session's concepts. */
  promptLink: '#B9A99E',
} as const;

export type SkyColorName = keyof typeof skyColors;

const kebab = (s: string): string => s.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

/** CSS variable name for a colour token, e.g. cgVar('surfaceSky') -> '--cg-surface-sky'. */
export const cgVarName = (name: SkyColorName): string => `--cg-${kebab(name)}`;

/** `var(--cg-...)` reference, for use in MUI sx or SVG attributes inside `.concept-sky`. */
export const cgVar = (name: SkyColorName): string => `var(${cgVarName(name)})`;

/** Session colour as a CSS var reference (1-based to match the `--cg-session-N` names). */
export const sessionVar = (index: number): string => {
  const n = SESSION_PALETTE.length;
  const i = ((Math.floor(index) % n) + n) % n;
  return `var(--cg-session-${i + 1})`;
};

export const skyFonts = {
  serif: "'Fraunces Variable', Georgia, 'Times New Roman', serif",
  sans: "'Hanken Grotesk Variable', system-ui, -apple-system, 'Segoe UI', sans-serif",
  mono: "'JetBrains Mono Variable', ui-monospace, 'SFMono-Regular', Menlo, monospace",
} as const;

export const skyType = {
  display: 46,
  title: 32,
  voice: 21,
  subtitle: 19,
  relation: 17,
  body: 14,
  label: 12,
  labelEmphasis: 13,
  eyebrow: 11,
  eyebrowLetterSpacing: '0.14em',
} as const;

export const skyShape = { radiusLg: 20, radiusMd: 12, radiusPill: 999, targetMin: 44 } as const;

/** Opacity states (fractions). */
export const skyOpacity = {
  lineRest: 0.8,
  lineActive: 1,
  /** Lines outside the hovered constellation. */
  lineDim: 0.1,
  /** Lines outside the active filter. */
  lineFade: 0.05,
  spokeRest: 0.45,
  spokeActive: 0.95,
  spokeDim: 0.07,
  /** Nodes outside the hovered constellation. */
  nodeDim: 0.22,
  /** Nodes outside the active filter. */
  nodeFade: 0.12,
} as const;

export const skyMotion = {
  ease: 'cubic-bezier(.2,.75,.2,1)',
  orbitMs: 900,
  fadeMs: 300,
} as const;

export const skyGeometry = {
  viewBox: { width: 1000, height: 680 },
  orbitCenter: { x: 500, y: 340 },
  orbitRingRadii: [0, 120, 210, 285, 320],
  star: {
    baseRadius: 3,
    maxRadius: 14,
    haloScale: 1.9,
    haloBlur: 3.5,
    haloBaseOpacity: 0.15,
    haloPerDegree: 0.05,
    haloMaxOpacity: 0.6,
    selectedRingOffset: 5,
    selectedRingWidth: 2,
  },
  diamond: { size: 11, cornerRadius: 1.5, strokeWidth: 1.5, dash: '3 2', hoverScale: 1.35 },
  line: { width: 1.25, activeWidth: 2, summaryDash: '4 4' },
  spoke: { width: 1, activeWidth: 1.5 },
  /** Dotted prompt connector. */
  promptLink: { width: 1, dash: '1.5 3' },
  label: { strokeWidth: 3, emphasisDegree: 5 },
} as const;

/** Star radius rule: min(3 + degree, 14). */
export const starRadius = (degree: number): number =>
  Math.min(skyGeometry.star.baseRadius + degree, skyGeometry.star.maxRadius);

/** Halo radius: 1.9x the star radius. */
export const haloRadius = (degree: number): number => starRadius(degree) * skyGeometry.star.haloScale;

/** Halo opacity: min(.15 + degree * .05, .6). */
export const haloOpacity = (degree: number): number =>
  Math.min(skyGeometry.star.haloBaseOpacity + degree * skyGeometry.star.haloPerDegree, skyGeometry.star.haloMaxOpacity);

/** CSS variable declarations (without selector) for the sky container. */
export const skyCssVariables = (): Record<string, string> => {
  const vars: Record<string, string> = {};
  (Object.keys(skyColors) as SkyColorName[]).forEach((k) => {
    vars[cgVarName(k)] = skyColors[k];
  });
  // Derived link colours are expressed in CSS so they follow link-base / star.
  vars['--cg-link'] = 'color-mix(in srgb, var(--cg-link-base) 60%, var(--cg-star))';
  vars['--cg-link-summary'] = 'var(--cg-link)';
  SESSION_PALETTE.forEach((c, i) => {
    vars[`--cg-session-${i + 1}`] = c;
  });
  vars['--cg-font-serif'] = skyFonts.serif;
  vars['--cg-font-sans'] = skyFonts.sans;
  vars['--cg-font-mono'] = skyFonts.mono;
  vars['--cg-ease'] = skyMotion.ease;
  vars['--cg-orbit-duration'] = `${skyMotion.orbitMs}ms`;
  vars['--cg-fade'] = `${skyMotion.fadeMs}ms`;
  return vars;
};

/** The `.concept-sky { ... }` rule text. */
export const skyCss = (): string => {
  const body = Object.entries(skyCssVariables())
    .map(([k, v]) => `  ${k}: ${v};`)
    .join('\n');
  return `.concept-sky {\n${body}\n  background: var(--cg-surface-sky);\n  color: var(--cg-text-body);\n  font-family: var(--cg-font-sans);\n}\n@media (prefers-reduced-motion: reduce) {\n  .concept-sky { --cg-orbit-duration: 0ms; --cg-fade: 0ms; }\n}\n`;
};
