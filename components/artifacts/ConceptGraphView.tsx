import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box, Button, ButtonGroup, Typography } from '@mui/material';
import { max } from 'd3-array';
import { forceCenter, forceCollide, forceLink, forceManyBody, forceSimulation } from 'd3-force';
import { scaleSqrt } from 'd3-scale';
import { select } from 'd3-selection';
import { zoom as d3Zoom, zoomIdentity, type ZoomBehavior } from 'd3-zoom';
import {
  buildGraph,
  computeFitTransform,
  connectedIds,
  describeGraph,
  linkEndpointId,
  type GraphSimNode,
} from '../../utils/conceptGraph';
import { ConceptGraphPayload } from '../../types.internal';

/**
 * Props for ConceptGraphView.
 * @property payload - The graph to draw. Every array may be empty; an artifact can exist before an event fills it in.
 * @property height - Canvas height in pixels. Width always follows the container.
 */
interface ConceptGraphViewProps {
  payload: ConceptGraphPayload;
  height?: number;
}

/* Concepts take the app's own accent; contributions an amber that reads as a different
   kind of thing rather than a variant of the same one; origin prompts a teal that is
   neither. All three pass AA against the white canvas. */
const CONCEPT = '#4845D2';
const CONTRIBUTION = '#B45309';
const CONTRIBUTION_FILL = '#B4530914';
const ORIGIN = '#0E7490';
const ORIGIN_FILL = '#0E749010';
const LINK = '#CBD5E1';
const LINK_HOT = '#B45309';
const TEXT = '#0B0D0E';
const MUTED = '#64748B';
/** Resting colour for node labels — darker than MUTED, which washed out over white. */
const LABEL = '#334155';
const PANEL_BORDER = '#E2E8F0';

const DEFAULT_HEIGHT = 520;
const MIN_WIDTH = 320;
const ZOOM_STEP = 1.4;
const MIN_SCALE = 0.35;
const MAX_SCALE = 6;
/** Leaves a little air around the graph rather than fitting it flush to the edges. */
const FIT_MARGIN = 0.92;
/** How far a label hangs below the node it belongs to, which the fit has to allow for. */
const LABEL_DROP = 18;
/** The alpha below which the layout has stopped moving enough to be worth framing. */
const FIT_AT_ALPHA = 0.08;
const ORIGIN_PILL_HEIGHT = 22;

/** How many characters of an origin prompt fit in its pill before it needs eliding. */
const ORIGIN_LABEL_MAX = 32;

function truncate(text: string, limit: number): string {
  // trimEnd so a cut landing on a space doesn't leave one hanging before the ellipsis.
  return text.length > limit ? `${text.slice(0, limit - 1).trimEnd()}…` : text;
}

/**
 * Draws a ConceptGraphArtifact: concepts as circles, contributions as diamonds joining
 * however many concepts they relate, origin prompts as dashed pills attached to what came
 * out of them.
 *
 * Contributions are nodes rather than edges, which is what lets one of them join three or
 * more concepts — see {@link buildGraph}. Node size follows degree, counted over
 * contribution links only, so attribution never inflates a concept.
 *
 * A new version replaces the payload wholesale, so this keeps the positions of nodes that
 * survived the revision and lets the simulation settle the rest around them — a graph
 * revised mid-event shifts rather than scattering.
 */
export const ConceptGraphView = ({ payload, height = DEFAULT_HEIGHT }: ConceptGraphViewProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  /* Positions from the previous payload, so a live revision re-uses them instead of
     re-laying the whole graph out from scratch. */
  const positionsRef = useRef<Map<string, { x: number; y: number }>>(new Map());
  /* Set once the reader zooms or pans deliberately, after which the view is theirs and
     auto-fit stops touching it. */
  const hasUserZoomedRef = useRef(false);
  /** Whether this layout has been framed yet, so it is framed once rather than every tick. */
  const hasFittedRef = useRef(false);

  const [width, setWidth] = useState<number>(720);
  const [transform, setTransform] = useState({ x: 0, y: 0, k: 1 });
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Bumped on every simulation tick to pull the freshly written node positions into a render.
  const [, setTick] = useState(0);

  const { simNodes, links, originLinks, degree } = useMemo(() => buildGraph(payload), [payload]);
  const isEmpty = simNodes.length === 0;

  const rConcept = useMemo(() => {
    const maxDegree =
      max(
        simNodes.filter((n) => n.type === 'concept'),
        (n) => degree.get(n.id) ?? 0,
      ) || 1;
    return scaleSqrt()
      .domain([1, Math.max(1, maxDegree)])
      .range([10, 34])
      .clamp(true);
  }, [simNodes, degree]);

  const rContrib = useMemo(() => {
    const maxDegree =
      max(
        simNodes.filter((n) => n.type === 'contribution'),
        (n) => degree.get(n.id) ?? 0,
      ) || 2;
    return scaleSqrt()
      .domain([2, Math.max(2, maxDegree)])
      .range([5, 16])
      .clamp(true);
  }, [simNodes, degree]);

  /** An origin prompt has no meaningful degree, so its pill is sized by its label. */
  const originWidth = useCallback((node: GraphSimNode) => truncate(node.label, ORIGIN_LABEL_MAX).length * 5.6 + 20, []);

  const radiusOf = useCallback(
    (node: GraphSimNode): number => {
      if (node.type === 'concept') return rConcept(degree.get(node.id) ?? 0);
      if (node.type === 'contribution') return rContrib(degree.get(node.id) ?? 0);
      return ORIGIN_PILL_HEIGHT / 2;
    },
    [rConcept, rContrib, degree],
  );

  /* What the node actually occupies, which for an origin prompt is a wide pill rather than
     anything like its radius. Collision uses this: sizing a pill by its height alone lets it
     sit on top of whatever is beside it. */
  const footprintOf = useCallback(
    (node: GraphSimNode): number => (node.type === 'origin' ? originWidth(node) / 2 : radiusOf(node)),
    [radiusOf, originWidth],
  );

  // Track the container's width so the canvas fills it at every breakpoint.
  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const apply = () => setWidth(Math.max(MIN_WIDTH, element.clientWidth));
    apply();

    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(apply);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // The force simulation. Both link sets are fed to forceLink — origin nodes would have no
  // force acting on them otherwise and would drift off — while sizes come from `degree`,
  // which counts contribution links only.
  useEffect(() => {
    if (isEmpty) return;

    const positions = positionsRef.current;
    for (const node of simNodes) {
      const previous = positions.get(node.id);
      if (previous) {
        node.x = previous.x;
        node.y = previous.y;
      }
    }

    // A fresh layout gets a fresh fit: this run's nodes are somewhere new.
    hasFittedRef.current = false;

    const simulation = forceSimulation<GraphSimNode>(simNodes)
      .force(
        'link',
        forceLink<GraphSimNode, (typeof links)[number]>([...links, ...originLinks])
          .id((d) => d.id)
          .distance(70)
          .strength(0.6),
      )
      .force('charge', forceManyBody().strength(-220))
      .force(
        'collide',
        forceCollide<GraphSimNode>().radius((d) => footprintOf(d) + 14),
      )
      .force('center', forceCenter(width / 2, height / 2))
      .on('tick', () => {
        setTick((t) => t + 1);
        /* Frame the graph as soon as the layout has cooled enough to have stopped moving
           much, rather than waiting for the simulation's 'end' event: a resize or a remount
           restarts the simulation, and one that keeps restarting never reaches 'end' at all,
           which would leave the graph running off every edge of the canvas.

           Never over someone who has taken hold of the view, though — a version arriving
           mid-inspection must not yank it away from them. */
        if (!hasFittedRef.current && simulation.alpha() < FIT_AT_ALPHA) {
          hasFittedRef.current = true;
          if (!hasUserZoomedRef.current) fitToViewRef.current();
        }
      });

    return () => {
      for (const node of simNodes) {
        if (node.x !== undefined && node.y !== undefined) {
          positions.set(node.id, { x: node.x, y: node.y });
        }
      }
      simulation.stop();
    };
    // `radiusOf` is derived from simNodes and degree, both already dependencies here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [simNodes, links, originLinks, width, height, isEmpty]);

  // Smooth continuous zoom and pan.
  useEffect(() => {
    if (isEmpty || !svgRef.current) return;

    const svg = select(svgRef.current);
    const behavior = d3Zoom<SVGSVGElement, unknown>()
      .scaleExtent([MIN_SCALE, MAX_SCALE])
      .on('zoom', (event) => {
        // Only a gesture carries a sourceEvent; fitToView's own transform does not.
        if (event.sourceEvent) hasUserZoomedRef.current = true;
        setTransform({ x: event.transform.x, y: event.transform.y, k: event.transform.k });
      });

    zoomRef.current = behavior;
    svg.call(behavior);
    return () => {
      svg.on('.zoom', null);
      zoomRef.current = null;
    };
  }, [isEmpty]);

  /**
   * Frames the whole graph in the canvas.
   *
   * A force layout spreads as far as its nodes push each other and has no idea how big the
   * box is, so left alone it runs off every edge. This measures what was actually laid out —
   * labels and pill widths included — and picks the transform that brings it inside.
   */
  /** Applies {@link computeFitTransform} to the canvas, framing the whole graph in it. */
  const fitToView = useCallback(() => {
    const svg = svgRef.current;
    const behavior = zoomRef.current;
    if (!svg || !behavior) return;

    const extents = simNodes
      .filter((n) => n.x !== undefined && n.y !== undefined)
      .map((node) => ({
        x: node.x!,
        y: node.y!,
        halfWidth: footprintOf(node),
        halfHeight: radiusOf(node),
        // Labels hang below a concept or contribution, so the bottom needs the extra room.
        labelDrop: node.type === 'origin' ? 0 : LABEL_DROP,
      }));

    const fit = computeFitTransform(extents, width, height, {
      margin: FIT_MARGIN,
      minScale: MIN_SCALE,
      maxScale: MAX_SCALE,
    });
    if (!fit) return;

    select(svg).call(behavior.transform, zoomIdentity.translate(fit.x, fit.y).scale(fit.k));
  }, [simNodes, width, height, footprintOf, radiusOf]);

  /* Kept in a ref so the simulation's 'end' handler always calls the current one without
     the simulation having to be rebuilt whenever it changes. */
  const fitToViewRef = useRef(fitToView);
  useEffect(() => {
    fitToViewRef.current = fitToView;
  }, [fitToView]);

  /* The buttons step the zoom rather than animating it: easing the step would mean pulling
     in d3-transition and its five transitive modules for an effect the scroll and pinch
     gestures — which are already continuous — don't need. */
  const zoomBy = (factor: number) => {
    if (!svgRef.current || !zoomRef.current) return;
    select(svgRef.current).call(zoomRef.current.scaleBy, factor);
  };

  const activeId = hoverId ?? selectedId;
  const lit = useMemo(() => connectedIds(activeId, links, originLinks), [activeId, links, originLinks]);
  const activeNode = activeId ? simNodes.find((n) => n.id === activeId) : undefined;
  const nodeById = useMemo(() => new Map(simNodes.map((n) => [n.id, n])), [simNodes]);

  // Labels fade in continuously as you zoom past ~0.7x, so a dense graph reads as shape
  // first and text second.
  const labelOpacity = Math.max(0, Math.min(1, (transform.k - 0.45) / 0.35));

  const description = useMemo(() => describeGraph(payload), [payload]);

  if (isEmpty) {
    return (
      <Box
        sx={{
          border: `1px solid ${PANEL_BORDER}`,
          borderRadius: 1,
          p: 4,
          textAlign: 'center',
          bgcolor: '#FFFFFF',
        }}
      >
        <Typography variant="body2" color="text.secondary">
          This graph is empty so far. Concepts appear here as the conversation raises them.
        </Typography>
      </Box>
    );
  }

  const renderLinks = (linkSet: typeof links, dashed: boolean) =>
    linkSet.map((link, i) => {
      const source = nodeById.get(linkEndpointId(link.source));
      const target = nodeById.get(linkEndpointId(link.target));
      if (!source || !target || source.x === undefined || target.x === undefined) return null;
      const hot = !!lit && lit.has(source.id) && lit.has(target.id);
      return (
        <line
          key={`${dashed ? 'o' : 'l'}${i}`}
          x1={source.x}
          y1={source.y}
          x2={target.x}
          y2={target.y}
          stroke={hot ? LINK_HOT : dashed ? ORIGIN : LINK}
          strokeWidth={hot ? 2 : 1}
          strokeOpacity={hot ? 0.9 : dashed ? 0.45 : 0.8}
          strokeDasharray={dashed ? '4 3' : undefined}
        />
      );
    });

  return (
    <Box ref={containerRef} sx={{ width: '100%' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', mb: 1 }}>
        <ButtonGroup size="small" variant="outlined" aria-label="Graph zoom controls">
          <Button onClick={() => zoomBy(ZOOM_STEP)} aria-label="Zoom in">
            +
          </Button>
          <Button onClick={() => zoomBy(1 / ZOOM_STEP)} aria-label="Zoom out">
            −
          </Button>
          <Button onClick={fitToView} aria-label="Fit graph to view">
            fit
          </Button>
        </ButtonGroup>
        <Typography variant="caption" sx={{ color: MUTED, fontFamily: 'ui-monospace, monospace' }}>
          {transform.k.toFixed(2)}x
        </Typography>
        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', ml: 'auto' }}>
          <LegendChip color={CONCEPT} shape="circle" label="concept" />
          <LegendChip color={CONTRIBUTION} shape="diamond" label="contribution" />
          <LegendChip color={ORIGIN} shape="pill" label="origin prompt" />
        </Box>
      </Box>

      {/* The graph in sentences, for screen readers and anyone who would rather not parse a
          force layout. The picture above is a drawing of exactly this. */}
      <Box
        sx={{
          position: 'absolute',
          width: '1px',
          height: '1px',
          overflow: 'hidden',
          clip: 'rect(0 0 0 0)',
          whiteSpace: 'nowrap',
        }}
      >
        {description}
      </Box>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        height={height}
        role="img"
        aria-label="Concept graph. Circles are concepts, diamonds are contributions joining them, dashed pills are the prompts they came out of. Scroll or pinch to zoom, drag to pan."
        style={{
          display: 'block',
          background: '#FFFFFF',
          border: `1px solid ${PANEL_BORDER}`,
          borderRadius: 6,
          touchAction: 'none',
        }}
      >
        <g transform={`translate(${transform.x},${transform.y}) scale(${transform.k})`}>
          <g>{renderLinks(originLinks, true)}</g>
          <g>{renderLinks(links, false)}</g>
          <g>
            {simNodes.map((node) => {
              if (node.x === undefined || node.y === undefined) return null;
              const r = radiusOf(node);
              const dim = !!lit && !lit.has(node.id);
              const isActive = activeId === node.id;
              const labelFade = isActive ? 1 : Math.max(labelOpacity, r / 34);

              return (
                <g
                  key={node.id}
                  transform={`translate(${node.x},${node.y})`}
                  opacity={dim ? 0.25 : 1}
                  onMouseEnter={() => setHoverId(node.id)}
                  onMouseLeave={() => setHoverId(null)}
                  onClick={() => setSelectedId((current) => (current === node.id ? null : node.id))}
                  style={{ cursor: 'pointer' }}
                >
                  {node.type === 'concept' && (
                    <circle
                      r={r}
                      fill={CONCEPT}
                      fillOpacity={0.85}
                      stroke={isActive ? TEXT : '#FFFFFF'}
                      strokeWidth={isActive ? 2.5 : 1}
                    />
                  )}
                  {node.type === 'contribution' && (
                    <rect
                      x={-r * 0.75}
                      y={-r * 0.75}
                      width={r * 1.5}
                      height={r * 1.5}
                      transform="rotate(45)"
                      fill={CONTRIBUTION_FILL}
                      stroke={isActive ? TEXT : CONTRIBUTION}
                      strokeWidth={isActive ? 2 : 1.3}
                    />
                  )}
                  {node.type === 'origin' && (
                    <rect
                      x={-originWidth(node) / 2}
                      y={-ORIGIN_PILL_HEIGHT / 2}
                      width={originWidth(node)}
                      height={ORIGIN_PILL_HEIGHT}
                      rx={ORIGIN_PILL_HEIGHT / 2}
                      fill={ORIGIN_FILL}
                      stroke={isActive ? TEXT : ORIGIN}
                      strokeWidth={1.4}
                      strokeDasharray="4 3"
                    />
                  )}

                  {node.type === 'origin' ? (
                    <text
                      y={4}
                      textAnchor="middle"
                      fontSize={9.5}
                      fontFamily="ui-monospace, monospace"
                      fill={ORIGIN}
                      opacity={labelFade}
                      style={{ pointerEvents: 'none' }}
                    >
                      {truncate(node.label, ORIGIN_LABEL_MAX)}
                    </text>
                  ) : (
                    <text
                      y={r + 13}
                      textAnchor="middle"
                      fontSize={node.type === 'concept' ? 11 : 9.5}
                      fontFamily={node.type === 'concept' ? 'inherit' : 'ui-monospace, monospace'}
                      fill={isActive ? TEXT : LABEL}
                      opacity={labelFade}
                      style={{ pointerEvents: 'none' }}
                    >
                      {node.label}
                    </text>
                  )}
                </g>
              );
            })}
          </g>
        </g>
      </svg>

      <NodeDetail node={activeNode} degree={activeNode ? (degree.get(activeNode.id) ?? 0) : 0} />
    </Box>
  );
};

/**
 * The card under the canvas describing whatever node is hovered or selected.
 *
 * It shows the label and the statement and nothing else. A node may carry `provenance` — a
 * pseudonym, a message id — and none of it is drawn here on purpose: these graphs come out
 * of events held under the Chatham House Rule, and anyone reaching this page holds only the
 * artifact passcode. See {@link GraphNodeProvenance}.
 */
function NodeDetail({ node, degree }: { node?: GraphSimNode; degree: number }) {
  if (!node) {
    return (
      <Typography variant="caption" sx={{ display: 'block', mt: 1, color: MUTED }}>
        Hover or tap a node to read it. Scroll to zoom, drag to pan.
      </Typography>
    );
  }

  const kindLabel = node.type === 'origin' ? 'origin prompt' : node.type;
  const accent = node.type === 'concept' ? CONCEPT : node.type === 'contribution' ? CONTRIBUTION : ORIGIN;

  return (
    <Box
      data-testid="graph-node-detail"
      sx={{ mt: 1, p: 1.5, border: `1px solid ${PANEL_BORDER}`, borderLeft: `3px solid ${accent}`, borderRadius: 1 }}
    >
      <Typography
        variant="caption"
        sx={{ color: accent, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}
      >
        {kindLabel}
        {node.type !== 'origin' && ` · joins ${degree}`}
      </Typography>
      <Typography variant="body2" sx={{ color: TEXT, fontWeight: 500 }}>
        {node.label}
      </Typography>
      {node.statement && (
        <Typography variant="body2" sx={{ color: MUTED, mt: 0.5 }}>
          {node.statement}
        </Typography>
      )}
    </Box>
  );
}

/** One entry in the shape legend above the canvas. */
function LegendChip({ color, shape, label }: { color: string; shape: 'circle' | 'diamond' | 'pill'; label: string }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
        {shape === 'circle' && <circle cx="8" cy="8" r="5.5" fill={color} fillOpacity={0.85} />}
        {shape === 'diamond' && (
          <rect
            x="4"
            y="4"
            width="8"
            height="8"
            transform="rotate(45 8 8)"
            fill={`${color}22`}
            stroke={color}
            strokeWidth="1.4"
          />
        )}
        {shape === 'pill' && (
          <rect
            x="1"
            y="4.5"
            width="14"
            height="7"
            rx="3.5"
            fill={`${color}18`}
            stroke={color}
            strokeWidth="1.3"
            strokeDasharray="3 2"
          />
        )}
      </svg>
      <Typography variant="caption" sx={{ color: MUTED }}>
        {label}
      </Typography>
    </Box>
  );
}
