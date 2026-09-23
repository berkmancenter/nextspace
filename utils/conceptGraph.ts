/**
 *
 * @file Turns a ConceptGraphArtifact payload into the nodes and links a force simulation
 * can lay out. Kept apart from the renderer so the structural rules — what counts as a
 * link, and what degree means — can be read and tested without a DOM.
 */

import type { SimulationLinkDatum, SimulationNodeDatum } from 'd3-force';
import { ConceptGraphPayload, GraphNodeProvenance } from '../types.internal';

/** Which of the three node kinds a simulation node is, and therefore how it is drawn. */
export type GraphNodeType = 'concept' | 'contribution' | 'origin';

/**
 * One node in the simulation. `x`/`y`/`vx`/`vy` are written in place by d3-force on every
 * tick, which is why these objects are mutable and reused rather than rebuilt per frame.
 * @property {string} id - Unique across all three payload arrays, so one map keyed by id is safe.
 * @property {string} label - What to draw on the canvas: a concept's label, an origin prompt's
 *   text, or — for a contribution — its statement when it has one, since that is the actual
 *   content a leaf carries, falling back to its `kind` for a contribution that is a plain
 *   relationship between concepts rather than any one person's account.
 * @property {string} [kind] - A contribution's short relationship verb, always present, for the detail panel.
 * @property {string} [statement] - A contribution's sentence-long account of the relationship, for the detail panel.
 */
export interface GraphSimNode extends SimulationNodeDatum {
  id: string;
  type: GraphNodeType;
  label: string;
  kind?: string;
  statement?: string;
  provenance?: GraphNodeProvenance;
}

/**
 * What a link carries when it IS a relationship, rather than a spoke from a contribution's
 * own node to one of the concepts it joins — see {@link buildGraph} for which links get this
 * and why. Everything a diamond would otherwise have held: a link is drawn interactively
 * (labelled, clickable, hoverable) exactly when it carries one of these.
 */
export interface GraphRelationship {
  id: string;
  kind: string;
  statement?: string;
  origin?: string;
  provenance?: GraphNodeProvenance;
}

/**
 * A link between two simulation nodes. d3-force replaces the `source` and `target` ids
 * with the node objects themselves on first tick, so read either through
 * {@link linkEndpointId}.
 */
export interface GraphSimLink extends SimulationLinkDatum<GraphSimNode> {
  relationship?: GraphRelationship;
}

/**
 * The laid-out form of a concept graph.
 * @property {GraphSimLink[]} links - Contribution links. These are what degree counts, and what the graph means.
 * @property {GraphSimLink[]} originLinks - Attribution links from an origin prompt to what came out of it. Drawn, never counted.
 * @property {Map<string, number>} degree - Link count per node id, which drives node size.
 */
export interface BuiltGraph {
  simNodes: GraphSimNode[];
  links: GraphSimLink[];
  originLinks: GraphSimLink[];
  degree: Map<string, number>;
}

/** Reads a link endpoint's id whether or not the simulation has resolved it to a node. */
export function linkEndpointId(endpoint: GraphSimLink['source']): string {
  return typeof endpoint === 'object' ? ((endpoint as GraphSimNode).id ?? String(endpoint)) : String(endpoint);
}

/**
 * Builds the simulation's nodes and links from an artifact payload.
 *
 * A contribution joining exactly two concepts becomes a direct link between them, carrying
 * itself as that link's {@link GraphRelationship} rather than a node of its own — a diamond
 * drawn only to join two things told the reader nothing a line couldn't, and doubled the
 * canvas's visual noise for it. A contribution joining three or more concepts at once still
 * gets its own node, since that is the one case a single line cannot express, and a
 * contribution attached to only one concept — a leaf, one account with nothing on its other
 * end to draw a line to — keeps its node for the same reason: there is no second point.
 *
 * Origin prompts are a third node kind, attached by a direct `origin` reference — and their
 * links are kept in a separate array because they must not count toward degree. Attribution
 * is not connectedness, and counting it would inflate every well-attributed concept for a
 * reason that has nothing to do with how the conversation related it to anything.
 *
 * Feed the simulation `[...links, ...originLinks]` so origin nodes have a force acting on
 * them; compute sizes from `degree`, which sees only `links`.
 *
 * @param payload - A ConceptGraphArtifact payload. Every array is optional: an artifact can exist before an event fills it in.
 * @returns The nodes, both link sets, and the degree map.
 */
export function buildGraph({
  concepts = [],
  contributions = [],
  originPrompts = [],
}: Partial<ConceptGraphPayload>): BuiltGraph {
  const simNodes: GraphSimNode[] = [];
  const links: GraphSimLink[] = [];
  const originLinks: GraphSimLink[] = [];
  const degree = new Map<string, number>();
  // A two-concept relationship has no node of its own for an origin-attribution line to
  // terminate at — tracked here so the origin pass below can skip it rather than push a link
  // to nothing. See the KNOWN GAP note there.
  const noNodeOfItsOwn = new Set<string>();

  for (const c of concepts) {
    simNodes.push({ id: c.id, type: 'concept', label: c.label, provenance: c.provenance });
    degree.set(c.id, 0);
  }
  for (const p of originPrompts) {
    simNodes.push({ id: p.id, type: 'origin', label: p.text, provenance: p.provenance });
    degree.set(p.id, 0);
  }
  for (const k of contributions) {
    if (k.concepts.length === 2) {
      const [a, b] = k.concepts;
      links.push({
        source: a,
        target: b,
        relationship: { id: k.id, kind: k.kind, statement: k.statement, origin: k.origin, provenance: k.provenance },
      });
      // Counted the same as it always was — a relationship still joins two concepts whether
      // or not it gets a node of its own to say so. `degree.set(k.id, 2)` isn't for sizing
      // anything (there is no node left to size); it's so a reader who selects this
      // relationship still sees "joins 2" reported the same way any other node's would be.
      degree.set(a, (degree.get(a) || 0) + 1);
      degree.set(b, (degree.get(b) || 0) + 1);
      degree.set(k.id, 2);
      noNodeOfItsOwn.add(k.id);
      continue;
    }

    simNodes.push({
      id: k.id,
      type: 'contribution',
      // A leaf's whole point is the statement it carries; a plain relationship between
      // concepts has none, and falls back to naming what it is.
      label: k.statement ?? k.kind,
      kind: k.kind,
      statement: k.statement,
      provenance: k.provenance,
    });
    degree.set(k.id, k.concepts.length);
    for (const cid of k.concepts) {
      links.push({ source: k.id, target: cid });
      degree.set(cid, (degree.get(cid) || 0) + 1);
    }
  }
  for (const n of [...concepts, ...contributions]) {
    // KNOWN GAP: a two-concept relationship's own `origin` is still carried on its link's
    // `relationship.origin` (a reader can still be told it came out of a prompt), but there
    // is no node here for a dashed attribution line to point at, so the line itself is not
    // drawn. Rare in practice — a relationship needs both an origin prompt and exactly two
    // concepts — and worth a floating attribution point (e.g. the relationship's own label
    // position) if it turns out to matter, rather than solved speculatively here.
    if (n.origin && !noNodeOfItsOwn.has(n.id)) originLinks.push({ source: n.origin, target: n.id });
  }

  return { simNodes, links, originLinks, degree };
}

/**
 * The set of node ids to keep lit while one node is hovered: the node itself and
 * everything a link touches it through, origin attachments included, so hovering a prompt
 * shows what came out of it.
 * @returns The connected ids, or null when nothing is hovered.
 */
export function connectedIds(
  hoverId: string | null,
  links: GraphSimLink[],
  originLinks: GraphSimLink[],
): Set<string> | null {
  if (!hoverId) return null;
  const connected = new Set<string>([hoverId]);
  for (const l of [...links, ...originLinks]) {
    const source = linkEndpointId(l.source);
    const target = linkEndpointId(l.target);
    if (source === hoverId) connected.add(target);
    if (target === hoverId) connected.add(source);
    // A two-concept relationship's own id is neither endpoint — it lives on the link as
    // metadata rather than as a node — so hovering or focusing it has to be matched this way
    // instead, and lights both concepts it joins since neither is "the" endpoint that matched.
    if (l.relationship?.id === hoverId) {
      connected.add(source);
      connected.add(target);
    }
  }
  return connected;
}

/**
 * A reading of the graph in sentences, for screen readers and for anyone who would rather
 * not parse a force layout. The visual is a picture of exactly this.
 */
export function describeGraph(payload: Partial<ConceptGraphPayload>): string {
  const { concepts = [], contributions = [], originPrompts = [] } = payload;
  if (concepts.length === 0 && contributions.length === 0) {
    return 'This graph is empty: no concepts have been added yet.';
  }

  const labelById = new Map<string, string>(concepts.map((c) => [c.id, c.label]));
  const promptById = new Map<string, string>(originPrompts.map((p) => [p.id, p.text]));

  const lines = [
    `A graph of ${concepts.length} concept${concepts.length === 1 ? '' : 's'} joined by ` +
      `${contributions.length} contribution${contributions.length === 1 ? '' : 's'}.`,
  ];

  for (const k of contributions) {
    const joined = k.concepts.map((id) => labelById.get(id) ?? id).join(', ');
    const origin = k.origin ? ` Asked in response to: ${promptById.get(k.origin) ?? k.origin}.` : '';
    lines.push(`${joined} — ${k.kind}.${k.statement ? ` ${k.statement}` : ''}${origin}`);
  }

  const unlinked = concepts.filter((c) => !contributions.some((k) => k.concepts.includes(c.id)));
  if (unlinked.length > 0) {
    lines.push(`Not yet joined to anything: ${unlinked.map((c) => c.label).join(', ')}.`);
  }

  return lines.join(' ');
}

/**
 * One node's extent on the canvas: where it sits, and how much room it takes around that
 * point. `halfWidth` is not always its radius — an origin prompt is a wide pill — and
 * `labelDrop` is the room its label needs below it.
 */
export interface NodeExtent {
  x: number;
  y: number;
  halfWidth: number;
  halfHeight: number;
  labelDrop?: number;
}

/** The transform to apply to the graph layer: translate then scale. */
export interface FitTransform {
  x: number;
  y: number;
  k: number;
}

/**
 * Works out the transform that brings a whole laid-out graph inside the canvas.
 *
 * A force simulation spreads as far as its nodes push each other and knows nothing about the
 * size of the box it is drawn in, so without this the graph simply runs off the edges. This
 * measures what was actually laid out — pill widths and the labels hanging below nodes
 * included — and centres it at the largest scale that still fits. A graph too vast to fit
 * even at `minScale` stops shrinking there instead: it is left to be panned rather than
 * squeezed down to dust.
 *
 * @param extents - Every placed node. An empty list has nothing to frame and returns null.
 * @param margin - Fraction of the canvas to fill, leaving a little air around the graph.
 * @returns The transform, or null when there is nothing to frame.
 */
export function computeFitTransform(
  extents: NodeExtent[],
  width: number,
  height: number,
  { margin = 0.92, minScale = 0.35, maxScale = 6 }: { margin?: number; minScale?: number; maxScale?: number } = {},
): FitTransform | null {
  if (extents.length === 0 || width <= 0 || height <= 0) return null;

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const extent of extents) {
    minX = Math.min(minX, extent.x - extent.halfWidth);
    maxX = Math.max(maxX, extent.x + extent.halfWidth);
    minY = Math.min(minY, extent.y - extent.halfHeight);
    maxY = Math.max(maxY, extent.y + extent.halfHeight + (extent.labelDrop ?? 0));
  }

  const spanX = maxX - minX;
  const spanY = maxY - minY;
  // A single node, or several stacked exactly, spans nothing in one direction; scale on
  // whichever direction has extent rather than dividing by zero.
  const scaleX = spanX > 0 ? (width / spanX) * margin : Infinity;
  const scaleY = spanY > 0 ? (height / spanY) * margin : Infinity;
  const unclamped = Math.min(scaleX, scaleY);
  const k = Math.max(minScale, Math.min(maxScale, Number.isFinite(unclamped) ? unclamped : maxScale));

  return {
    k,
    x: width / 2 - (k * (minX + maxX)) / 2,
    y: height / 2 - (k * (minY + maxY)) / 2,
  };
}

/** Where a candidate label would sit if drawn — either its primary spot or one of its {@link LabelCandidate.alternates}. */
export interface LabelPosition {
  x: number;
  y: number;
}

/**
 * A label wanting to be drawn, measured in screen pixels.
 * @property {number} priority - Higher wins a collision. Degree is the natural choice: the better-connected node is the one worth naming.
 * @property {boolean} [required] - Never dropped for overlapping another label. The node under the cursor and its neighbours are named over whatever other label has to give way — but never over a {@link hardObstacle}; see below.
 * @property {boolean} [hardObstacle] - Not a label at all, just a reservation — a node's own circle, or a shown origin pill. No candidate may be drawn over one of these, `required` or not: a label is worth losing space over another label's tidiness, never worth hiding a different node entirely and blocking its own click target.
 * @property {LabelPosition[]} [alternates] - Other spots to try, in order, before the label is dropped — e.g. above a node rather than only ever below it. Same size, different anchor; the first spot (this candidate's own `x`/`y`, tried first) or alternate that clears every rule wins.
 */
export interface LabelCandidate {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  priority: number;
  required?: boolean;
  hardObstacle?: boolean;
  alternates?: LabelPosition[];
}

/**
 * Chooses which labels can be drawn without overlapping each other, and where.
 *
 * A force layout puts nodes where the forces leave them, which in a dense graph is close
 * enough together that their labels collide and the text becomes unreadable — several words
 * printed over each other are worth less than one word printed clearly. So labels are placed
 * greedily, best first: a candidate tries its own spot, then each of its `alternates` in
 * turn, and takes the first one that fits rather than being dropped outright — the reader
 * gets more names on screen for the same crowding, at no cost to legibility, since a chosen
 * alternate is held to exactly the same rules as the primary spot would have been.
 *
 * This only works on labels of a fixed screen size. Labels that scale with the graph collide
 * identically at every zoom, so dropping them would hide the same words however far in the
 * reader zoomed; at a fixed size, zooming spreads the nodes apart on screen and the labels
 * come back by themselves. That is what makes zoom worth having on a crowded graph.
 *
 * A spot that would land on a {@link LabelCandidate.hardObstacle} is ruled out outright,
 * `required` or not — required only ever overrides a collision with another label, since
 * focusing on a well-connected node makes every one of its neighbours required at once, and
 * without this a tight focused view could paper an unrelated node's own circle with someone
 * else's caption, hiding it and blocking its click target.
 *
 * @param candidates - Every label that wants to be drawn, in screen coordinates.
 * @param padding - Breathing room required between two labels.
 * @returns Each visible id mapped to the position it was actually drawn at.
 */
export function selectVisibleLabels(candidates: LabelCandidate[], padding = 2): Map<string, LabelPosition> {
  const overlapsWith = (box: { x: number; y: number; width: number; height: number }, other: typeof box) =>
    Math.abs(box.x - other.x) * 2 < box.width + other.width + padding * 2 &&
    Math.abs(box.y - other.y) * 2 < box.height + other.height + padding * 2;

  // Obstacles are not competing for space — a node's circle, or a shown origin pill, is
  // already there regardless of what any label wants — so they are seeded into `placed`
  // up front rather than taking their turn in the priority order below. A required label
  // sorts ahead of everything else in that order, which would otherwise let it be checked,
  // and placed, before a lower-priority obstacle ever got a turn to block it.
  const obstacles = candidates.filter((c) => c.hardObstacle);
  const contenders = candidates.filter((c) => !c.hardObstacle);

  const ordered = contenders.sort((a, b) => {
    if (!!b.required !== !!a.required) return b.required ? 1 : -1;
    return b.priority - a.priority;
  });

  const placed: { x: number; y: number; width: number; height: number }[] = obstacles.map(({ x, y, width, height }) => ({
    x,
    y,
    width,
    height,
  }));
  const visible = new Map<string, LabelPosition>();

  for (const candidate of ordered) {
    const spots = [{ x: candidate.x, y: candidate.y }, ...(candidate.alternates ?? [])];

    for (const spot of spots) {
      const box = { x: spot.x, y: spot.y, width: candidate.width, height: candidate.height };
      if (obstacles.some((obstacle) => overlapsWith(box, obstacle))) continue;

      const overlaps = placed.some((other) => overlapsWith(box, other));

      // A required label is drawn even over a neighbouring label: being told what is under
      // the cursor matters more than the tidiness of a label it happens to land on. It still
      // can't land on an obstacle — ruled out above, before this check ever runs.
      if (!overlaps || candidate.required) {
        placed.push(box);
        visible.set(candidate.id, spot);
        break;
      }
    }
  }

  return visible;
}

/**
 * Roughly how wide a string renders, without measuring it in the DOM.
 *
 * Close enough to lay labels out: the ratio is the average advance width of the typeface as a
 * fraction of its size, and a label whose estimate is a few pixels out still reads, whereas
 * measuring every label on every frame of a running simulation would not.
 */
export function estimateTextWidth(text: string, fontSize: number, ratio = 0.55): number {
  return text.length * fontSize * ratio;
}

/**
 * Breaks a label into lines that each fit within `maxWidth`, so a long one — a leaf's
 * statement, in particular — wraps into a block near its node instead of a single line wide
 * enough to run through whatever else is on the canvas.
 *
 * Greedy word wrap: a word is added to the current line as long as the line still fits, and
 * moved to a new one the moment it would not. A single word wider than `maxWidth` on its own
 * is left whole on its own line rather than split — this wraps prose, not code, and breaking
 * a word mid-letter would read worse than one slightly wide line.
 *
 * @param text - The label to wrap. An empty string wraps to a single empty line, so the caller
 *   always has at least one line to measure and draw.
 * @param maxWidth - The widest a line may be, in the same screen-pixel units as {@link estimateTextWidth}.
 * @param fontSize - Passed through to {@link estimateTextWidth} for each candidate line.
 * @param ratio - Passed through to {@link estimateTextWidth}.
 * @returns One or more lines, in order.
 */
export function wrapLabel(text: string, maxWidth: number, fontSize: number, ratio = 0.55): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [''];

  const lines: string[] = [];
  let line = words[0];

  for (const word of words.slice(1)) {
    const candidate = `${line} ${word}`;
    if (estimateTextWidth(candidate, fontSize, ratio) <= maxWidth) {
      line = candidate;
    } else {
      lines.push(line);
      line = word;
    }
  }
  lines.push(line);

  return lines;
}

/**
 * The sessions a graph draws on, in the order they first appear, with each mapped to its
 * position in that order.
 *
 * A series graph folds in every conversation under a topic, so its nodes carry different
 * `provenance.conversationId` values and which session raised what is worth seeing. A single
 * event's graph has at most one, and there is nothing to distinguish — so this returns an
 * empty map and the caller draws the graph in one colour.
 *
 * A session is not a person: this is the one provenance field safe to render to everyone, and
 * the sessions are numbered by first appearance because a conversation id means nothing to a
 * reader. See {@link GraphNodeProvenance}.
 *
 * @returns Conversation id to zero-based session index, or an empty map for a graph from one session.
 */
export function sessionIndexById(payload: Partial<ConceptGraphPayload>): Map<string, number> {
  const { concepts = [], contributions = [], originPrompts = [] } = payload;
  const ordered = new Map<string, number>();

  for (const node of [...concepts, ...contributions, ...originPrompts]) {
    const id = node.provenance?.conversationId;
    if (id && !ordered.has(id)) ordered.set(id, ordered.size);
  }

  return ordered.size > 1 ? ordered : new Map();
}
