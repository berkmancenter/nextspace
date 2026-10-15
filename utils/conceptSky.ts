/**
 *
 * @file The pure logic behind the concept sky: what a concept's degree is, where every star
 * sits, how the Orbit view rearranges them, which sessions a star's ring is cut into, and
 * what stays lit when something is hovered or filtered. Kept apart from the renderer, like
 * {@link ./conceptGraph}, so the rules can be read and tested without a DOM.
 *
 * Nothing here reads the DOM or the clock, and every position is derived from ids alone: the
 * same payload always yields the same sky, which is what lets a reader come back to a series
 * and find every star where they left it.
 */

import { ConceptGraphPayload } from '../types.internal';
import { estimateTextWidth, wrapLabel } from './conceptGraph';

/* ---------- geometry constants ---------- */

/** Every position is in a fixed viewBox this size; the renderer scales it to fit. */
export const SKY_WIDTH = 1000;
export const SKY_HEIGHT = 680;
export const SKY_CENTER = { x: 500, y: 340 };
/** Orbit rings by hop distance. Index 0 is the centre; the last also holds disconnected concepts. */
export const ORBIT_RINGS = [0, 120, 210, 285, 320];
/** How long the sky takes to glide between Sky and Orbit layouts. */
export const ORBIT_DURATION_MS = 900;
/** A concept's label wraps at about this many characters, matching the design reference. */
const LABEL_WRAP_CHARS = 18;
const LABEL_FONT_SIZE = 12;
const LABEL_LINE_HEIGHT = 15;
/** An origin prompt drawn without text: a small pill. */
export const PROMPT_PILL = { width: 26, height: 12 };

/** Opacity states for the filter. Dimming on hover is a separate concern, see {@link focusSet}. */
export const SKY_OPACITY = { inView: 1, conceptOut: 0.12, lineOut: 0.05, nodeDim: 0.22, lineDim: 0.1 };

export interface Point {
  x: number;
  y: number;
}

/** A shape's footprint around its own position, for collision checks. */
interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Same string hash as the design reference, mapped to [0, 1], so positions match it for the same ids. */
function hash(str: string): number {
  let x = 2166136261;
  for (let i = 0; i < str.length; i++) {
    x ^= str.charCodeAt(i);
    x = Math.imul(x, 16777619);
  }
  return (x >>> 0) / 4294967295;
}

const boxesOverlap = (a: Box, b: Box, pad = 0) =>
  Math.abs(a.x - b.x) * 2 < a.width + b.width + pad * 2 && Math.abs(a.y - b.y) * 2 < a.height + b.height + pad * 2;

/* ---------- model ---------- */

/** What a star's size and glow say, from its degree. Size means total connections, never distance. */
export function starRadius(degree: number): number {
  return Math.min(3 + degree, 14);
}

/** Stars with this many connections or more get a prominent label even at rest. */
export const STRONG_LABEL_DEGREE = 5;

/**
 * How a contribution is drawn. Two concepts: it IS the line between them. One or three or
 * more: a diamond, since a line cannot express either (one has no second end, many have no
 * single pair).
 */
export type ContributionShape = 'line' | 'diamond';

/**
 * Everything the other functions need, derived once from a payload. Contributions or prompts
 * naming a concept that does not exist are tolerated, never throw: concept ids they cite that
 * are unknown are dropped.
 * @property {Map<string, Set<string>>} adjacency - Neighbour concepts per concept, through shared contributions only.
 * @property {Map<string, number>} degree - Distinct neighbour concepts. Origin prompts are excluded: attribution is not connectedness.
 * @property {Map<string, string[]>} contributionsOf - Ids of contributions touching each concept, in payload order.
 */
export interface SkyModel {
  payload: Partial<ConceptGraphPayload>;
  conceptIds: string[];
  adjacency: Map<string, Set<string>>;
  degree: Map<string, number>;
  contributionConcepts: Map<string, string[]>;
  contributionsOf: Map<string, string[]>;
  /** The most connected concept, ties going to the one listed first; null for an empty graph. */
  topConcept: string | null;
}

export function buildSkyModel(payload: Partial<ConceptGraphPayload>): SkyModel {
  const { concepts = [], contributions = [] } = payload;
  const conceptIds = concepts.map((c) => c.id);
  const known = new Set(conceptIds);
  const adjacency = new Map<string, Set<string>>(conceptIds.map((id) => [id, new Set<string>()]));
  const contributionsOf = new Map<string, string[]>(conceptIds.map((id) => [id, []]));
  const contributionConcepts = new Map<string, string[]>();

  for (const k of contributions) {
    const joined = [...new Set(k.concepts)].filter((id) => known.has(id));
    contributionConcepts.set(k.id, joined);
    for (const a of joined) {
      contributionsOf.get(a)!.push(k.id);
      for (const b of joined) if (a !== b) adjacency.get(a)!.add(b);
    }
  }

  const degree = new Map<string, number>(conceptIds.map((id) => [id, adjacency.get(id)!.size]));
  let topConcept: string | null = null;
  for (const id of conceptIds) if (topConcept === null || degree.get(id)! > degree.get(topConcept)!) topConcept = id;

  return { payload, conceptIds, adjacency, degree, contributionConcepts, contributionsOf, topConcept };
}

/** Whether a contribution is a line or a diamond. See {@link ContributionShape}. */
export function contributionShape(conceptCount: number): ContributionShape {
  return conceptCount === 2 ? 'line' : 'diamond';
}

/**
 * Whether a contribution is drawn solid or dashed: solid when it carries a quote, dashed
 * when it is a summary only. Independent of its shape.
 */
export function isDashedContribution(k: { statement?: string }): boolean {
  return !k.statement;
}

/* ---------- label footprints ---------- */

/** A concept's label broken into lines, as the sky draws it beneath the star. */
export function conceptLabelLines(label: string): string[] {
  return wrapLabel(label, estimateTextWidth('x'.repeat(LABEL_WRAP_CHARS), LABEL_FONT_SIZE), LABEL_FONT_SIZE);
}

/**
 * The space a star and its label take together: the star's circle, with the label hung
 * beneath it. Returned as one box so a collision with either counts.
 */
function starFootprint(p: Point, degree: number, label: string): Box {
  const r = starRadius(degree);
  const lines = conceptLabelLines(label);
  const labelWidth = Math.max(...lines.map((l) => estimateTextWidth(l, LABEL_FONT_SIZE)));
  const width = Math.max(2 * r, labelWidth);
  const top = p.y - r;
  const bottom = p.y + r + 3 + lines.length * LABEL_LINE_HEIGHT;
  return { x: p.x, y: (top + bottom) / 2, width, height: bottom - top };
}

/* ---------- sky layout ---------- */

const MARGIN = { left: 70, right: 70, top: 50, bottom: 70 };

function clampToSky(p: { x: number; y: number }) {
  p.x = Math.max(MARGIN.left, Math.min(SKY_WIDTH - MARGIN.right, p.x));
  p.y = Math.max(MARGIN.top, Math.min(SKY_HEIGHT - MARGIN.bottom, p.y));
}

/** Graphs with at least this many concepts are stretched to fill the frame, see {@link spreadToFrame}. */
const SPREAD_MIN_CONCEPTS = 3;

const quantile = (sorted: number[], q: number) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];

/**
 * Scales points about the middle of the crowd so it fills the margins, then clamps to them.
 * Never shrinks. In a big graph the lone, weakly connected stars drift far from the knot
 * the hubs form, and stretching to the extreme points would leave the knot as it was, so the
 * middle 80% of the points set the scale there (and the outliers are pushed to the margins).
 */
function spreadToFrame(points: { x: number; y: number }[]) {
  const trim = points.length >= 20 ? 0.1 : 0;
  const range = (values: number[]) => {
    const sorted = [...values].sort((a, b) => a - b);
    return [quantile(sorted, trim), quantile(sorted, 1 - trim - 1e-9)];
  };
  const [minX, maxX] = range(points.map((q) => q.x));
  const [minY, maxY] = range(points.map((q) => q.y));
  const availW = SKY_WIDTH - MARGIN.left - MARGIN.right;
  const availH = SKY_HEIGHT - MARGIN.top - MARGIN.bottom;
  const sx = maxX > minX ? Math.max(1, availW / (maxX - minX)) : 1;
  const sy = maxY > minY ? Math.max(1, availH / (maxY - minY)) : 1;
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  for (const q of points) {
    q.x = MARGIN.left + availW / 2 + (q.x - cx) * sx;
    q.y = MARGIN.top + availH / 2 + (q.y - cy) * sy;
    clampToSky(q);
  }
}

/**
 * Where every concept sits in the sky. A force layout like the design reference's, seeded by
 * id rather than by random numbers, so the same payload always gives the same positions.
 *
 * Concepts are visited in id order so that two payloads listing the same concepts in a
 * different order still agree. After the forces settle, a relaxation pass pushes apart any
 * star whose label would land on another's, because the forces only know about points.
 *
 * Positions are recomputed on every load: the payload carries none. That means a star moves
 * when the graph around it changes — the stable-across-events sky the design asks for needs
 * positions stored with the concepts, which is a backend change not made here.
 *
 * @returns Concept id to position, rounded to a tenth of a unit.
 */
export function layoutSky(model: SkyModel): Map<string, Point> {
  const ids = [...model.conceptIds].sort();
  const out = new Map<string, Point>();
  if (ids.length === 0) return out;
  if (ids.length === 1) {
    out.set(ids[0], { ...SKY_CENTER });
    return out;
  }

  const p = new Map<string, { x: number; y: number; vx: number; vy: number }>();
  for (const id of ids) {
    const a = hash(id) * Math.PI * 2;
    const r = 120 + hash(`${id}:r`) * 180;
    p.set(id, { x: SKY_CENTER.x + r * Math.cos(a), y: SKY_CENTER.y + r * Math.sin(a), vx: 0, vy: 0 });
  }

  const N = 400;
  for (let it = 0; it < N; it++) {
    const alpha = 1 - it / N;
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const A = p.get(ids[i])!;
        const B = p.get(ids[j])!;
        let dx = B.x - A.x;
        let dy = B.y - A.y;
        const d2 = dx * dx + dy * dy || 0.01;
        const d = Math.sqrt(d2);
        const f = (2400 / d2) * alpha;
        dx /= d;
        dy /= d;
        A.vx -= dx * f;
        A.vy -= dy * f;
        B.vx += dx * f;
        B.vy += dy * f;
      }
    }
    for (const id of ids) {
      for (const o of model.adjacency.get(id)!) {
        if (o < id) continue;
        const A = p.get(id)!;
        const B = p.get(o)!;
        const dx = B.x - A.x;
        const dy = B.y - A.y;
        const d = Math.sqrt(dx * dx + dy * dy) || 1;
        const f = (d - 110) * 0.02 * alpha;
        A.vx += (dx / d) * f;
        A.vy += (dy / d) * f;
        B.vx -= (dx / d) * f;
        B.vy -= (dy / d) * f;
      }
    }
    for (const id of ids) {
      const A = p.get(id)!;
      A.vx += (SKY_CENTER.x - A.x) * 0.004 * alpha;
      A.vy += (SKY_CENTER.y - A.y) * 0.004 * alpha;
      A.x += A.vx;
      A.y += A.vy;
      clampToSky(A);
      A.vx *= 0.6;
      A.vy *= 0.6;
    }
  }

  // The forces settle a graph into a knot in the middle while the sides of the frame stay empty,
  // and the relaxation below cannot undo that: it only nudges pairs apart, and at fifty long
  // labels it oscillates against its neighbours instead of settling. Stretching the settled
  // layout to fill the frame first leaves it little to do, and gives a small graph the whole
  // sky rather than a corner of it.
  if (ids.length >= SPREAD_MIN_CONCEPTS) spreadToFrame(ids.map((id) => p.get(id)!));

  const label = new Map((model.payload.concepts ?? []).map((c) => [c.id, c.label]));
  const footprint = (id: string) => starFootprint(p.get(id)!, model.degree.get(id)!, label.get(id) ?? '');

  // Separate by the axis of least penetration, half each way. Bounded: a pass that moves
  // nothing ends it, and a crowd too dense to separate stops after the cap rather than spin.
  for (let pass = 0; pass < 80; pass++) {
    let moved = false;
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const a = footprint(ids[i]);
        const b = footprint(ids[j]);
        if (!boxesOverlap(a, b, 3)) continue;
        const penX = (a.width + b.width) / 2 + 6 - Math.abs(a.x - b.x);
        const penY = (a.height + b.height) / 2 + 6 - Math.abs(a.y - b.y);
        const A = p.get(ids[i])!;
        const B = p.get(ids[j])!;
        if (penX < penY) {
          const s = a.x <= b.x ? 1 : -1;
          A.x -= (s * penX) / 2;
          B.x += (s * penX) / 2;
        } else {
          const s = a.y <= b.y ? 1 : -1;
          A.y -= (s * penY) / 2;
          B.y += (s * penY) / 2;
        }
        clampToSky(A);
        clampToSky(B);
        moved = true;
      }
    }
    if (!moved) break;
  }

  for (const id of model.conceptIds) {
    const A = p.get(id)!;
    out.set(id, { x: Math.round(A.x * 10) / 10, y: Math.round(A.y * 10) / 10 });
  }
  return out;
}

/* ---------- orbit ---------- */

export interface OrbitLayout {
  /** The concept at the middle. */
  center: string | null;
  positions: Map<string, Point>;
  /** Ring index per concept: 0 centre, 1-3 hop distance, 4 for four or more hops or disconnected. */
  ring: Map<string, number>;
}

/**
 * Arranges every concept around one of them, by how many steps away it is.
 *
 * Each ring is ordered by the angle of the stars it hangs from on the ring inside, so related
 * stars stay together, then spaced evenly. Because the label of one star on a crowded outer
 * ring can land on the next, a light pass then nudges colliding pairs apart along their ring
 * — the design reference ships without this and lists it as a known gap. It is deliberately
 * light: a ring with more stars than fit still overlaps, and that is left to the label
 * thinning the renderer already does.
 *
 * @param selected - The concept to centre. Anything that is not a concept falls back to the most connected one.
 */
export function layoutOrbit(model: SkyModel, selected?: string | null): OrbitLayout {
  const positions = new Map<string, Point>();
  const ring = new Map<string, number>();
  const center = selected && model.adjacency.has(selected) ? selected : model.topConcept;
  if (center === null) return { center, positions, ring };

  const dist = new Map<string, number>([[center, 0]]);
  const queue = [center];
  for (let head = 0; head < queue.length; head++) {
    const u = queue[head];
    for (const v of model.adjacency.get(u)!) {
      if (!dist.has(v)) {
        dist.set(v, dist.get(u)! + 1);
        queue.push(v);
      }
    }
  }

  const rings: string[][] = [[], [], [], [], []];
  for (const id of model.conceptIds) {
    if (id === center) continue;
    const k = Math.min(dist.get(id) ?? 4, 4);
    ring.set(id, k);
    rings[k].push(id);
  }
  ring.set(center, 0);
  positions.set(center, { ...SKY_CENTER });

  const angle = new Map<string, number>([[center, 0]]);
  for (let k = 1; k <= 4; k++) {
    if (rings[k].length === 0) continue;
    if (k === 1) {
      // Everything here hangs from the centre, so there is no parent angle to follow: spread evenly from 12 o'clock.
      const step = (2 * Math.PI) / rings[1].length;
      rings[1].forEach((id, i) => angle.set(id, -Math.PI / 2 + i * step));
      continue;
    }
    // Where each star would sit directly outward of its parents. One with no parent on the
    // ring inside (a disconnected concept, in ring 4) has no preference and is spread evenly.
    const withParents: { id: string; a: number }[] = [];
    const orphans: string[] = [];
    for (const id of rings[k]) {
      let sx = 0;
      let sy = 0;
      let any = false;
      for (const v of model.adjacency.get(id)!) {
        if (angle.has(v) && dist.get(v) === k - 1) {
          sx += Math.cos(angle.get(v)!);
          sy += Math.sin(angle.get(v)!);
          any = true;
        }
      }
      if (any) withParents.push({ id, a: Math.atan2(sy, sx) });
      else orphans.push(id);
    }
    // Sort is stable, so equal angles keep payload order.
    withParents.sort((x, y) => x.a - y.a);
    const orphanStep = (2 * Math.PI) / Math.max(orphans.length, 1);
    const items = [...withParents, ...orphans.map((id, i) => ({ id, a: -Math.PI / 2 + i * orphanStep }))].sort(
      (x, y) => x.a - y.a,
    );
    spreadAngles(items);
    for (const it of items) angle.set(it.id, it.a);
  }

  const place = (id: string) => {
    const r = ORBIT_RINGS[ring.get(id)!];
    const a = angle.get(id)!;
    positions.set(id, { x: SKY_CENTER.x + r * Math.cos(a), y: SKY_CENTER.y + r * Math.sin(a) });
  };
  for (const id of model.conceptIds) if (id !== center) place(id);

  nudgeOrbitLabels(model, center, ring, angle, place, positions);

  for (const [id, pt] of positions) positions.set(id, { x: Math.round(pt.x * 10) / 10, y: Math.round(pt.y * 10) / 10 });
  return { center, positions, ring };
}

/**
 * Pushes angles (already sorted, going round the circle) apart until neighbours are at least
 * a minimum gap from each other, without otherwise moving them, so a star stays near the
 * parents it hangs from. The gap is at most an even share of the circle, which is what an
 * evenly spaced ring would give, so a full ring ends up spread rather than bunched.
 */
function spreadAngles(items: { a: number }[]) {
  const n = items.length;
  if (n < 2) return;
  const gap = Math.min((2 * Math.PI) / n, 0.5);
  for (let pass = 0; pass < 200; pass++) {
    let moved = false;
    for (let i = 0; i < n; i++) {
      const cur = items[i];
      const next = items[(i + 1) % n];
      const space = i === n - 1 ? next.a + 2 * Math.PI - cur.a : next.a - cur.a;
      if (space < gap - 1e-9) {
        const push = (gap - space) / 2;
        cur.a -= push;
        next.a += push;
        moved = true;
      }
    }
    if (!moved) return;
  }
}

/** Wraps an angle difference into (-PI, PI]. */
const wrapAngle = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

function nudgeOrbitLabels(
  model: SkyModel,
  center: string,
  ring: Map<string, number>,
  angle: Map<string, number>,
  place: (id: string) => void,
  positions: Map<string, Point>,
) {
  const label = new Map((model.payload.concepts ?? []).map((c) => [c.id, c.label]));
  const ids = model.conceptIds.filter((id) => id !== center);
  const box = (id: string) => starFootprint(positions.get(id)!, model.degree.get(id)!, label.get(id) ?? '');
  const STEP = 0.02;

  for (let pass = 0; pass < 120; pass++) {
    let moved = false;
    const all = [center, ...ids];
    for (let i = 0; i < all.length; i++) {
      for (let j = i + 1; j < all.length; j++) {
        const a = all[i];
        const b = all[j];
        if (!boxesOverlap(box(a), box(b), 2)) continue;
        // The centre never moves; between two stars the outer one gives way, and on one ring both do.
        const ra = a === center ? -1 : ring.get(a)!;
        const rb = ring.get(b)!;
        const aMoves = a !== center && ra >= rb;
        const bMoves = rb >= ra;
        const diff = wrapAngle(angle.get(b)! - (a === center ? angle.get(b)! : angle.get(a)!));
        const dir = diff >= 0 ? 1 : -1;
        if (aMoves) angle.set(a, angle.get(a)! - dir * STEP * (bMoves ? 1 : 2));
        if (bMoves) angle.set(b, angle.get(b)! + dir * STEP * (aMoves ? 1 : 2));
        if (aMoves) place(a);
        if (bMoves) place(b);
        moved = true;
      }
    }
    if (!moved) break;
  }
}

/** The glide's ease-out curve, `cubic-bezier(.2,.75,.2,1)`, as the design specifies. t and result are in [0, 1]. */
export function orbitEase(t: number): number {
  const [x1, y1, x2, y2] = [0.2, 0.75, 0.2, 1];
  const bez = (a: number, b: number, s: number) => 3 * a * (1 - s) * (1 - s) * s + 3 * b * (1 - s) * s * s + s * s * s;
  const clamped = Math.max(0, Math.min(1, t));
  let s = clamped;
  // Newton, then bisection as a fallback — the curve is monotonic in x so either converges.
  for (let i = 0; i < 8; i++) {
    const err = bez(x1, x2, s) - clamped;
    const slope = 3 * x1 * (1 - s) * (1 - s) + 6 * (x2 - x1) * (1 - s) * s + 3 * (1 - x2) * s * s;
    if (Math.abs(err) < 1e-6 || Math.abs(slope) < 1e-6) break;
    s -= err / slope;
  }
  if (s < 0 || s > 1 || Math.abs(bez(x1, x2, s) - clamped) > 1e-4) {
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 30; i++) {
      s = (lo + hi) / 2;
      if (bez(x1, x2, s) < clamped) lo = s;
      else hi = s;
    }
  }
  return bez(y1, y2, s);
}

/**
 * Where each id is `t` of the way (0 to 1, linear time) from one layout to another, eased.
 * An id missing from either layout is skipped, so a tween survives the payload changing mid-glide.
 */
export function tweenPositions(from: Map<string, Point>, to: Map<string, Point>, t: number): Map<string, Point> {
  const k = orbitEase(t);
  const out = new Map<string, Point>();
  for (const [id, b] of to) {
    const a = from.get(id);
    if (!a) continue;
    out.set(id, { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k });
  }
  return out;
}

/* ---------- contributions ---------- */

export interface ContributionPlacement {
  id: string;
  shape: ContributionShape;
  /** Solid outline when false: it carries a quote. */
  dashed: boolean;
  /** Where the diamond sits, or a line's midpoint (for hover cards and hit-testing). */
  position: Point;
  /** The concepts it joins that exist; a line's two ends, or a diamond's spokes. */
  concepts: string[];
}

/**
 * Places every contribution relative to where the concepts it joins currently are, so it
 * works for Sky and Orbit positions alike and follows a tween frame by frame.
 *
 * A diamond sits at the centre of its concepts. A single-concept one would land exactly on
 * its star there, so it is set a little way off instead, fanned in the upper half so it clears the label
 * below, and several leaves on one star do not stack. Contributions that join no known
 * concept are omitted — there is nowhere to draw them.
 */
export function placeContributions(model: SkyModel, positions: Map<string, Point>): ContributionPlacement[] {
  const out: ContributionPlacement[] = [];
  const leafCount = new Map<string, number>();
  const leafSeen = new Map<string, number>();
  for (const k of model.payload.contributions ?? []) {
    const cs = model.contributionConcepts.get(k.id) ?? [];
    if (cs.length === 1) leafCount.set(cs[0], (leafCount.get(cs[0]) ?? 0) + 1);
  }

  for (const k of model.payload.contributions ?? []) {
    const cs = (model.contributionConcepts.get(k.id) ?? []).filter((id) => positions.has(id));
    if (cs.length === 0) continue;
    const shape = contributionShape(cs.length);
    let position: Point;
    if (cs.length === 1) {
      const c = cs[0];
      const n = leafCount.get(c)!;
      const i = leafSeen.get(c) ?? 0;
      leafSeen.set(c, i + 1);
      const step = Math.min(0.7, 2.2 / n);
      const a = -Math.PI / 2 + (i - (n - 1) / 2) * step;
      const dist = starRadius(model.degree.get(c) ?? 0) + 22;
      const base = positions.get(c)!;
      position = { x: base.x + dist * Math.cos(a), y: base.y + dist * Math.sin(a) };
    } else {
      position = {
        x: cs.reduce((s, c) => s + positions.get(c)!.x, 0) / cs.length,
        y: cs.reduce((s, c) => s + positions.get(c)!.y, 0) / cs.length,
      };
    }
    out.push({ id: k.id, shape, dashed: isDashedContribution(k), position, concepts: cs });
  }
  return out;
}

/* ---------- origin prompts ---------- */

/** A connector from an origin prompt to something that came out of it. */
export interface PromptLink {
  promptId: string;
  targetId: string;
}

/** At rest a prompt is joined only to the concepts whose `origin` it is. Unknown prompt ids are ignored. */
export function promptConceptLinks(payload: Partial<ConceptGraphPayload>): PromptLink[] {
  const prompts = new Set((payload.originPrompts ?? []).map((p) => p.id));
  return (payload.concepts ?? [])
    .filter((c) => c.origin && prompts.has(c.origin))
    .map((c) => ({ promptId: c.origin!, targetId: c.id }));
}

/**
 * The extra connectors drawn once a prompt is selected: to the contributions (diamonds and
 * lines) whose `origin` it is. Not drawn at rest, where every prompt joining every
 * contribution would bury the sky in lines.
 */
export function promptContributionLinks(payload: Partial<ConceptGraphPayload>, promptId: string): PromptLink[] {
  return (payload.contributions ?? []).filter((k) => k.origin === promptId).map((k) => ({ promptId, targetId: k.id }));
}

/**
 * What a prompt led to, for its "led to N" eyebrow. The eyebrow counts concepts; contributions
 * are returned too for anything that wants the fuller picture.
 */
export function promptLedTo(
  payload: Partial<ConceptGraphPayload>,
  promptId: string,
): { concepts: number; contributions: number } {
  return {
    concepts: (payload.concepts ?? []).filter((c) => c.origin === promptId).length,
    contributions: (payload.contributions ?? []).filter((k) => k.origin === promptId).length,
  };
}

/**
 * Where each prompt's pill sits: near the middle of what it led to, nudged clear of every
 * star, label, diamond and other pill.
 *
 * Anchored on its concepts' centroid, falling back to the concepts of its contributions, then
 * to the middle of the sky — so a prompt that produced nothing drawable still has somewhere
 * to be. The nudge walks outward in widening rings and takes the first free spot, so it is
 * deterministic and stays as close to the centroid as the crowd allows. In a graph too
 * crowded to leave a free spot within reach the least-bad (closest) candidate is used rather
 * than none, because a prompt that vanished would also hide its connectors.
 *
 * @param positions - Current concept positions: Sky or Orbit, or a tween frame.
 */
export function placePrompts(
  model: SkyModel,
  positions: Map<string, Point>,
  contributionPlacements: ContributionPlacement[] = placeContributions(model, positions),
): Map<string, Point> {
  const payload = model.payload;
  const labels = new Map((payload.concepts ?? []).map((c) => [c.id, c.label]));
  const obstacles: Box[] = [];
  for (const [id, p] of positions) obstacles.push(starFootprint(p, model.degree.get(id) ?? 0, labels.get(id) ?? ''));
  for (const c of contributionPlacements) obstacles.push({ x: c.position.x, y: c.position.y, width: 20, height: 20 });

  const out = new Map<string, Point>();
  const placementById = new Map(contributionPlacements.map((c) => [c.id, c]));
  const pill = (p: Point): Box => ({ x: p.x, y: p.y, width: PROMPT_PILL.width, height: PROMPT_PILL.height });
  const inBounds = (p: Point) =>
    p.x >= PROMPT_PILL.width / 2 &&
    p.x <= SKY_WIDTH - PROMPT_PILL.width / 2 &&
    p.y >= PROMPT_PILL.height / 2 &&
    p.y <= SKY_HEIGHT - PROMPT_PILL.height / 2;

  for (const prompt of payload.originPrompts ?? []) {
    let anchors = (payload.concepts ?? [])
      .filter((c) => c.origin === prompt.id && positions.has(c.id))
      .map((c) => positions.get(c.id)!);
    if (anchors.length === 0) {
      anchors = (payload.contributions ?? [])
        .filter((k) => k.origin === prompt.id)
        .flatMap((k) => placementById.get(k.id)?.concepts ?? [])
        .map((id) => positions.get(id)!);
    }
    const anchor =
      anchors.length === 0
        ? { ...SKY_CENTER }
        : {
            x: anchors.reduce((s, a) => s + a.x, 0) / anchors.length,
            y: anchors.reduce((s, a) => s + a.y, 0) / anchors.length,
          };

    let chosen: Point | null = null;
    search: for (let radius = 0; radius <= 160; radius += 8) {
      const steps = radius === 0 ? 1 : Math.max(8, Math.round(radius / 3));
      // Start the sweep at a per-prompt angle so two prompts sharing a centroid fan apart.
      const offset = hash(prompt.id) * Math.PI * 2;
      for (let s = 0; s < steps; s++) {
        const a = offset + (s / steps) * Math.PI * 2;
        const candidate = { x: anchor.x + radius * Math.cos(a), y: anchor.y + radius * Math.sin(a) };
        if (!inBounds(candidate)) continue;
        if (obstacles.some((o) => boxesOverlap(pill(candidate), o, 3))) continue;
        chosen = candidate;
        break search;
      }
    }
    const final = chosen ?? {
      x: Math.max(13, Math.min(SKY_WIDTH - 13, anchor.x)),
      y: Math.max(6, Math.min(SKY_HEIGHT - 6, anchor.y)),
    };
    final.x = Math.round(final.x * 10) / 10;
    final.y = Math.round(final.y * 10) / 10;
    out.set(prompt.id, final);
    obstacles.push(pill(final));
  }
  return out;
}

/* ---------- sessions ---------- */

/**
 * Conversation id to zero-based session index, or an empty map for a graph from fewer than two
 * sessions (nothing to distinguish, so no rings or filter).
 *
 * A series payload lists its `sessions` with an `order` by event date, and that wins, so
 * "Session 3" is the third event rather than the third conversation to turn up in the data.
 * Without it, sessions are numbered by first appearance across concepts (their own
 * provenance, then every conversation they list), contributions and prompts.
 */
export function sessionIndex(payload: Partial<ConceptGraphPayload>): Map<string, number> {
  if (payload.sessions && payload.sessions.length > 0) {
    const ranked = [...payload.sessions].sort((a, b) => a.order - b.order);
    const ordered = new Map<string, number>();
    for (const s of ranked) if (!ordered.has(s.conversationId)) ordered.set(s.conversationId, ordered.size);
    return ordered.size > 1 ? ordered : new Map();
  }
  const { concepts = [], contributions = [], originPrompts = [] } = payload;
  const ordered = new Map<string, number>();
  const see = (id?: string) => {
    if (id && !ordered.has(id)) ordered.set(id, ordered.size);
  };
  for (const c of concepts) {
    see(c.provenance?.conversationId);
    c.conversationIds?.forEach(see);
  }
  for (const node of [...contributions, ...originPrompts]) see(node.provenance?.conversationId);
  return ordered.size > 1 ? ordered : new Map();
}

/**
 * What to call a session in the filter and the ring key: its title when the payload gives one,
 * else "Session N", with the date after it ("Session 3 · Oct 2") when there is one.
 */
export function sessionLabel(payload: Partial<ConceptGraphPayload>, index: number): string {
  const entry = sessionIndex(payload);
  const conversationId = [...entry].find(([, i]) => i === index)?.[0];
  const meta = payload.sessions?.find((s) => s.conversationId === conversationId);
  if (meta?.title) return meta.title;
  const base = `Session ${index + 1}`;
  const date = meta?.date ? new Date(meta.date) : null;
  if (!date || Number.isNaN(date.getTime())) return base;
  return `${base} · ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })}`;
}

/**
 * Which sessions each concept belongs to, as indices from {@link sessionIndex}, sorted.
 *
 * KNOWN GAP: this is an inference. A concept's sessions are its own `provenance.conversationId`
 * plus those of every contribution that touches it. A series graph is refined rather than
 * rebuilt, and when two sessions' concepts are merged the merge leaves no record of which
 * sessions raised the survivor, so a concept two sessions both raised but that no
 * contribution from one of them touches will show only the other. The planned fix, after the
 * demo, is for the backend to send a per-concept session list; replace this function's body
 * with a read of that and nothing downstream changes.
 *
 * @returns Concept id to sorted session indices. Empty arrays throughout for a graph from a single session, as {@link sessionIndex} reports none.
 */
export function conceptSessions(model: SkyModel): Map<string, number[]> {
  const index = sessionIndex(model.payload);
  const out = new Map<string, Set<number>>(model.conceptIds.map((id) => [id, new Set()]));
  const add = (id: string, conversationId?: string) => {
    const i = conversationId === undefined ? undefined : index.get(conversationId);
    if (i !== undefined) out.get(id)?.add(i);
  };
  for (const c of model.payload.concepts ?? []) {
    // The backend's own list wins: it survives merges and folds, which the inference cannot see.
    const listed = (c.conversationIds ?? []).filter((id) => index.has(id));
    if (listed.length > 0) listed.forEach((id) => add(c.id, id));
    else add(c.id, c.provenance?.conversationId);
  }
  const listedIds = new Set(
    (model.payload.concepts ?? []).filter((c) => c.conversationIds?.some((id) => index.has(id))).map((c) => c.id),
  );
  for (const k of model.payload.contributions ?? []) {
    for (const id of model.contributionConcepts.get(k.id) ?? [])
      if (!listedIds.has(id)) add(id, k.provenance?.conversationId);
  }
  return new Map([...out].map(([id, s]) => [id, [...s].sort((a, b) => a - b)]));
}

/** One stretch of a star's session ring. Angles are radians clockwise from 12 o'clock. */
export interface SessionArc {
  sessionIndex: number;
  start: number;
  end: number;
}

/**
 * Cuts a star's ring into one arc per session, clockwise from 12 o'clock in session order.
 *
 * A star from a single session gets one full ring, since a ring of one arc with gaps would
 * only look broken. Otherwise arcs are equal with small gaps between them, and no arc is
 * shorter than `minArcLength` along the ring — a tiny star's ring is a few pixels around, and
 * without a floor its arcs would be specks. If the floor and gaps cannot all fit, gaps are
 * given up first, then arcs share the ring equally.
 *
 * @param sessionIndices - The concept's sessions, from {@link conceptSessions}. None draws one full ring unattributed (index 0).
 * @param ringRadius - Radius the ring is drawn at, to turn the minimum length into an angle.
 * @param gap - Space between arcs, radians.
 * @param minArcLength - Shortest an arc may be, in the same units as `ringRadius`.
 */
export function sessionArcs(
  sessionIndices: number[],
  ringRadius: number,
  { gap = 0.14, minArcLength = 5 }: { gap?: number; minArcLength?: number } = {},
): SessionArc[] {
  const sorted = [...new Set(sessionIndices)].sort((a, b) => a - b);
  if (sorted.length <= 1) return [{ sessionIndex: sorted[0] ?? 0, start: 0, end: Math.PI * 2 }];

  const slot = (Math.PI * 2) / sorted.length;
  const minAngle = ringRadius > 0 ? minArcLength / ringRadius : slot;
  const arcAngle = Math.min(slot, Math.max(slot - gap, minAngle));
  const gapAngle = slot - arcAngle;
  // Half a gap before the first arc, so the ring is symmetric about 12 o'clock.
  return sorted.map((sessionIndex, i) => {
    const start = gapAngle / 2 + i * slot;
    return { sessionIndex, start, end: start + arcAngle };
  });
}

/** A point on a circle at a clockwise-from-12-o'clock angle, to draw {@link sessionArcs} with. */
export function polarPoint(center: Point, radius: number, angle: number): Point {
  return { x: center.x + radius * Math.sin(angle), y: center.y - radius * Math.cos(angle) };
}

/* ---------- filter ---------- */

/** 'all' for the full series, or a zero-based session index (see {@link sessionIndex}). There is no season filter. */
export type SkyFilter = 'all' | number;

export interface FadeEntry {
  inFilter: boolean;
  opacity: number;
}
/** A contribution's diamond fades like a node; its lines and spokes fade lower still. */
export interface ContributionFade extends FadeEntry {
  lineOpacity: number;
}

export interface SkyFilterState {
  concepts: Map<string, FadeEntry>;
  contributions: Map<string, ContributionFade>;
  prompts: Map<string, FadeEntry>;
  /** Nothing is in view: show the "still below the horizon" state over the faded sky. */
  isEmpty: boolean;
}

/**
 * What the filter fades. It never moves anything: the whole sky stays in place and what is
 * outside the filter drops to 12% (its lines to 5%).
 *
 * A concept is in a session when {@link conceptSessions} says so. A contribution is in when
 * its own session matches, or — with no provenance to say — when all its concepts are in.
 * A prompt is in by its own session, else when any concept it led to is. A session index the
 * graph does not have puts everything out, as does any session filter on a single-session
 * graph, which has no sessions to filter by.
 */
export function filterSky(model: SkyModel, filter: SkyFilter): SkyFilterState {
  const sessions = conceptSessions(model);
  const index = sessionIndex(model.payload);
  const conceptIn = (id: string) => filter === 'all' || (sessions.get(id) ?? []).includes(filter);
  const sessionOf = (conversationId?: string) => (conversationId === undefined ? undefined : index.get(conversationId));
  const concepts = new Map<string, FadeEntry>();
  const contributions = new Map<string, ContributionFade>();
  const prompts = new Map<string, FadeEntry>();

  for (const id of model.conceptIds) {
    const inFilter = conceptIn(id);
    concepts.set(id, { inFilter, opacity: inFilter ? SKY_OPACITY.inView : SKY_OPACITY.conceptOut });
  }
  for (const k of model.payload.contributions ?? []) {
    const cs = model.contributionConcepts.get(k.id) ?? [];
    const own = sessionOf(k.provenance?.conversationId);
    const inFilter = filter === 'all' || (own !== undefined ? own === filter : cs.length > 0 && cs.every(conceptIn));
    contributions.set(k.id, {
      inFilter,
      opacity: inFilter ? SKY_OPACITY.inView : SKY_OPACITY.conceptOut,
      lineOpacity: inFilter ? SKY_OPACITY.inView : SKY_OPACITY.lineOut,
    });
  }
  for (const p of model.payload.originPrompts ?? []) {
    const own = sessionOf(p.provenance?.conversationId);
    const led = (model.payload.concepts ?? []).filter((c) => c.origin === p.id);
    const inFilter = filter === 'all' || (own !== undefined ? own === filter : led.some((c) => conceptIn(c.id)));
    prompts.set(p.id, { inFilter, opacity: inFilter ? SKY_OPACITY.inView : SKY_OPACITY.conceptOut });
  }

  return { concepts, contributions, prompts, isEmpty: ![...concepts.values()].some((c) => c.inFilter) };
}

/* ---------- hover / focus ---------- */

export interface FocusSet {
  /** Every id (concept, contribution or prompt) kept at full strength. */
  ids: Set<string>;
  concepts: Set<string>;
  contributions: Set<string>;
}

/**
 * What stays at full strength while something is hovered or keyboard-focused; the rest dims.
 *
 * A concept keeps its neighbours and every contribution touching it. A contribution keeps
 * itself and the concepts it joins. A prompt keeps the concepts and contributions it led to.
 * A prompt that is the origin of anything kept is kept as well, so the reader can see where
 * a thing came from. An id the graph does not know yields just that id, and null (nothing
 * hovered) yields null so the caller knows not to dim anything.
 */
export function focusSet(model: SkyModel, id: string | null | undefined): FocusSet | null {
  if (!id) return null;
  const concepts = new Set<string>();
  const contributions = new Set<string>();
  const payload = model.payload;

  if (model.adjacency.has(id)) {
    concepts.add(id);
    for (const n of model.adjacency.get(id)!) concepts.add(n);
    for (const k of model.contributionsOf.get(id)!) contributions.add(k);
  } else if (model.contributionConcepts.has(id)) {
    contributions.add(id);
    for (const c of model.contributionConcepts.get(id)!) concepts.add(c);
  } else if ((payload.originPrompts ?? []).some((p) => p.id === id)) {
    for (const c of payload.concepts ?? []) if (c.origin === id) concepts.add(c.id);
    for (const k of payload.contributions ?? []) if (k.origin === id) contributions.add(k.id);
  }

  const ids = new Set<string>([id, ...concepts, ...contributions]);
  const kept = [
    ...(payload.concepts ?? []).filter((c) => concepts.has(c.id)),
    ...(payload.contributions ?? []).filter((k) => contributions.has(k.id)),
  ];
  const promptIds = new Set((payload.originPrompts ?? []).map((p) => p.id));
  // Only the focused node's own origin, not the whole neighbourhood's: otherwise hovering a
  // hub would keep every prompt in the sky lit, and the dimming would say nothing.
  for (const n of kept) if (n.id === id && n.origin && promptIds.has(n.origin)) ids.add(n.origin);

  return { ids, concepts, contributions };
}

/* ---------- list view ---------- */

export interface ListEntry {
  id: string;
  label: string;
  degree: number;
  /** Contributions touching the concept: the "voices" count. */
  contributionCount: number;
  /** Neighbour concepts, labelled, in payload order. */
  connections: { id: string; label: string }[];
  foldedFrom: string[];
}

/**
 * Every concept for the list view — the full equivalent of the sky for keyboard and
 * screen-reader use — most connected first, ties by label so the order is stable.
 * Pass a filter to list only what the sky shows at full strength.
 */
export function listEntries(model: SkyModel, filter: SkyFilter = 'all'): ListEntry[] {
  const state = filterSky(model, filter);
  const concepts = model.payload.concepts ?? [];
  const label = new Map(concepts.map((c) => [c.id, c.label]));
  const visible = (id: string) => state.concepts.get(id)?.inFilter ?? false;

  return concepts
    .filter((c) => visible(c.id))
    .map((c) => ({
      id: c.id,
      label: c.label,
      degree: model.degree.get(c.id)!,
      contributionCount: model.contributionsOf.get(c.id)!.filter((k) => state.contributions.get(k)?.inFilter).length,
      connections: model.conceptIds
        .filter((id) => model.adjacency.get(c.id)!.has(id) && visible(id))
        .map((id) => ({ id, label: label.get(id)! })),
      foldedFrom: c.foldedFrom ?? [],
    }))
    .sort((a, b) => b.degree - a.degree || a.label.localeCompare(b.label));
}
