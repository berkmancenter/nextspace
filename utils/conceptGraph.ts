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
 * @property {string} label - What to draw: a concept's label, a contribution's kind, an origin prompt's text.
 * @property {string} [statement] - A contribution's sentence-long account of the relationship, for the detail panel.
 */
export interface GraphSimNode extends SimulationNodeDatum {
  id: string;
  type: GraphNodeType;
  label: string;
  statement?: string;
  provenance?: GraphNodeProvenance;
}

/**
 * A link between two simulation nodes. d3-force replaces the `source` and `target` ids
 * with the node objects themselves on first tick, so read either through
 * {@link linkEndpointId}.
 */
export type GraphSimLink = SimulationLinkDatum<GraphSimNode>;

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
 * Contributions are nodes, not edges: a contribution links to each concept it joins, which
 * is what lets one of them join three or more concepts at once. Origin prompts are a third
 * node kind, attached by a direct `origin` reference — and their links are kept in a
 * separate array because they must not count toward degree. Attribution is not
 * connectedness, and counting it would inflate every well-attributed concept for a reason
 * that has nothing to do with how the conversation related it to anything.
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

  for (const c of concepts) {
    simNodes.push({ id: c.id, type: 'concept', label: c.label, provenance: c.provenance });
    degree.set(c.id, 0);
  }
  for (const p of originPrompts) {
    simNodes.push({ id: p.id, type: 'origin', label: p.text, provenance: p.provenance });
    degree.set(p.id, 0);
  }
  for (const k of contributions) {
    simNodes.push({
      id: k.id,
      type: 'contribution',
      label: k.kind,
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
    if (n.origin) originLinks.push({ source: n.origin, target: n.id });
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
 * included — and centres it at the largest scale that still fits.
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
