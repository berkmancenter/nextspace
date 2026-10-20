import {
  SESSION_PALETTE,
  contrastRatio,
  mixHex,
  sessionColor,
  skyColors,
  skyCss,
  starRadius,
  haloOpacity,
  cgVarName,
} from '../../../../components/artifacts/sky/tokens';

const sky = skyColors.surfaceSky;

describe('sessionColor', () => {
  it('indexes the palette and wraps modulo its length', () => {
    expect(SESSION_PALETTE).toHaveLength(8);
    expect(sessionColor(0)).toBe(SESSION_PALETTE[0]);
    expect(sessionColor(7)).toBe(SESSION_PALETTE[7]);
    expect(sessionColor(8)).toBe(SESSION_PALETTE[0]);
    expect(sessionColor(10)).toBe(SESSION_PALETTE[2]);
    expect(sessionColor(-1)).toBe(SESSION_PALETTE[7]);
    expect(sessionColor(NaN)).toBe(SESSION_PALETTE[0]);
  });
  it('has 8 distinct colours', () => {
    expect(new Set(SESSION_PALETTE).size).toBe(8);
  });
});

describe('contrast on the sky surface', () => {
  it.each(SESSION_PALETTE.map((c, i) => [i + 1, c]))('session %i (%s) >= 5:1', (_i, c) => {
    expect(contrastRatio(c as string, sky)).toBeGreaterThanOrEqual(5);
  });

  const documented: Array<[keyof typeof skyColors, number]> = [
    ['star', 14.6],
    ['textPrimary', 14.6],
    ['textBody', 11.3],
    ['textSecondary', 8.1],
    ['label', 8.1],
    ['accent', 9.8],
    ['focusRing', 9.8],
    ['textRelation', 11.7],
    ['linkBase', 2.5],
    ['textPlaceholder', 4.8],
  ];
  it.each(documented)('%s matches documented ratio %f', (name, ratio) => {
    expect(contrastRatio(skyColors[name], sky)).toBeCloseTo(ratio, 0);
  });

  it('link, link-summary, prompt-link and fallback keep the designed ~5:1 (4.98 for the line tint)', () => {
    for (const n of ['link', 'linkSummary', 'promptLink', 'sessionFallback'] as const) {
      expect(contrastRatio(skyColors[n], sky)).toBeGreaterThanOrEqual(4.97);
    }
  });
});

describe('derived tokens', () => {
  it('mixHex matches the link derivation', () => {
    expect(skyColors.link).toBe(mixHex(skyColors.linkBase, skyColors.star, 60));
  });
  it('emits scoped css variables', () => {
    const css = skyCss();
    expect(css).toContain('.concept-sky {');
    expect(css).toContain('--cg-surface-sky: #1A1214;');
    expect(css).toContain('--cg-session-8:');
    expect(css).toContain('color-mix(in srgb, var(--cg-link-base) 60%, var(--cg-star))');
    expect(cgVarName('promptLink')).toBe('--cg-prompt-link');
  });
});

describe('geometry rules', () => {
  it('star radius caps at 14', () => {
    expect(starRadius(2)).toBe(5);
    expect(starRadius(40)).toBe(14);
  });
  it('halo opacity caps at .6', () => {
    expect(haloOpacity(1)).toBeCloseTo(0.2);
    expect(haloOpacity(50)).toBe(0.6);
  });
});
