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
  estimateTextWidth,
  linkEndpointId,
  selectVisibleLabels,
  sessionIndexById,
  wrapLabel,
  type GraphSimNode,
} from '../../utils/conceptGraph';
import { ConceptGraphPayload } from '../../types.internal';
import { trackEvent } from '../../utils/analytics';

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
/* Concepts on a series graph are coloured by the session that raised them. Five hues that
   stay apart from each other, from the contribution amber, and against white; a sixth session
   and beyond falls back to the plain concept colour rather than inventing a hue nobody can
   tell from the last one. */
const SESSION_COLORS = ['#4845D2', '#0E7490', '#9333EA', '#166534', '#B91C1C'];
const CONTRIBUTION = '#B45309';
const CONTRIBUTION_FILL = '#B4530914';
const ORIGIN = '#0E7490';
const ORIGIN_FILL = '#0E749010';
/* Darker than the panel border it's close to in hue, and drawn wider below — a link is
   what tells the reader a graph exists at all, and a pale one recedes against link-dense
   areas until it reads as empty canvas. */
const LINK = '#94A3B8';
const LINK_HOT = '#B45309';
const TEXT = '#0B0D0E';
const MUTED = '#64748B';
/** Resting colour for node labels — darker than MUTED, which washed out over white. */
const LABEL = '#334155';
/** The label overlay's own backdrop, so a wrapped block reads against a clear card of its
    own instead of whatever line or node happens to be behind it. Opaque, matching the
    canvas: over blank space it is invisible, and only shows as a card where it needs to. */
const LABEL_BG = '#FFFFFF';
const PANEL_BORDER = '#E2E8F0';

const DEFAULT_HEIGHT = 520;
const MIN_WIDTH = 320;
const ZOOM_STEP = 1.4;
const MIN_SCALE = 0.35;
const MAX_SCALE = 6;
/** Leaves a little air around the graph rather than fitting it flush to the edges. */
const FIT_MARGIN = 0.92;
/** Tighter than {@link FIT_MARGIN}: a focused node and its one or two neighbours would
    otherwise be framed with the same generous air meant for a whole graph, and end up
    looking lost in the middle of the canvas. */
const FOCUS_MARGIN = 0.75;
/** How long a focus change takes to pan/zoom into place. */
const FOCUS_DURATION_MS = 420;
/** How far a contribution link bows away from a straight line, as a fraction of its own
    length — enough to read as a deliberate curve, not so much it loops back on itself. */
const LINK_CURVATURE = 0.12;
/** How far a label's block hangs below the node it belongs to, before its own height, which
    the fit has to allow for. Wide enough that the two read as separate even when the node
    itself has shrunk to a few screen pixels at low zoom. */
const LABEL_GAP = 5;
/** How wide a label may run before wrapping to another line — a leaf's statement stays a
    block near its node rather than a single line long enough to cross the canvas. */
const LABEL_MAX_WIDTH = 130;
/** Spacing between wrapped lines, as a multiple of font size. */
const LABEL_LINE_HEIGHT_FACTOR = 1.3;
/** Air between a label's text and the edge of its background card. */
const LABEL_PADDING_X = 4;
const LABEL_PADDING_Y = 3;
/** How often to re-frame a settling layout. Every tick would be wasted work at 60fps. */
const FIT_EVERY_TICKS = 4;
const ORIGIN_PILL_HEIGHT = 22;
const CONCEPT_LABEL_SIZE = 11.5;
/** The golden angle, which is what spreads a spiral evenly rather than into spokes. */
const SEED_ANGLE = Math.PI * (3 - Math.sqrt(5));
const SEED_SPACING = 24;
const CONTRIBUTION_LABEL_SIZE = 9.5;

/**
 * Draws a ConceptGraphArtifact: concepts as circles, contributions as diamonds joining
 * however many concepts they relate, origin prompts as dashed pills attached to what came
 * out of them.
 *
 * Contributions are nodes rather than edges, which is what lets one of them join three or
 * more concepts — see {@link buildGraph}. Node size follows degree, counted over
 * contribution links only, so attribution never inflates a concept.
 *
 * A contribution's diamond is labelled by its statement when it has one — a leaf's whole
 * content — rather than its short `kind`, which is why a long one may not resolve at low
 * zoom: it collides with whatever is near it under the same label-placement rules as any
 * other crowded label, and reappears once zooming spreads its neighbours far enough apart to
 * read the whole thing. A contribution with no statement, a plain relationship between
 * concepts nobody's account carries alone, is labelled by its `kind` instead.
 *
 * Every label wraps to {@link wrapLabel} rather than running as one line — a leaf's statement
 * stays a block near its own node instead of a line long enough to cross the canvas — and
 * draws on its own background card, so it reads as itself rather than the edge or node
 * happening to sit behind it. See `labelInfo` below.
 *
 * Origin prompts are hidden until the reader asks for them — most concepts and contributions
 * carry no `origin` at all, so drawing every prompt unconditionally would spend canvas space
 * and force-layout pull on something most readers are not looking for. The "Show origin
 * prompts" button reveals all of them at once, each pill sized to its whole, unelided text.
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
  /* The live simulation, so a pure resize (see the effect below) can retarget it in place
     instead of the graph-rebuilding effect having to own width/height at all. */
  const simulationRef = useRef<ReturnType<typeof forceSimulation<GraphSimNode>> | null>(null);
  /* What the simulation-building effect actually saw width/height as, kept current without
     being one of that effect's own dependencies — see the same effect for why. */
  const boxRef = useRef({ width: 720, height: DEFAULT_HEIGHT });
  /* Set once the reader zooms or pans deliberately, after which the view is theirs and
     auto-fit stops touching it. */
  const hasUserZoomedRef = useRef(false);
  /* The scale a wheel/drag gesture started at, captured on d3-zoom's 'start' so 'end' can
     tell a scale change (zoom) from a pure translation (pan) — d3-zoom fires the same
     start/zoom/end lifecycle for both, and only the delta between the two says which one a
     reader actually did. Cleared once the gesture's 'end' fires. */
  const gestureStartRef = useRef<{ k: number; sourceType: string } | null>(null);
  /* Mirrors `selectedId` for the simulation's tick/end handlers below, which close over this
     once when the simulation is built rather than re-reading React state every frame — while
     a node is focused, the settling layout's own periodic re-fit must not yank the camera
     back to the whole graph. */
  const selectedIdRef = useRef<string | null>(null);
  /* The previous value of `selectedId`, so the focus effect can tell a real transition (into
     focus, out of focus, or to a different node) from a no-op re-run and skip animating on
     first mount, when there is nothing to animate from. */
  const prevSelectedRef = useRef<string | null>(null);
  /* The in-flight focus/unfocus animation's requestAnimationFrame id, so a new one cancels
     whatever the previous focus change was still doing rather than fighting it for the
     transform. */
  const focusAnimRef = useRef<number | null>(null);
  /* The last committed transform, read by `animateTo` as its animation's starting point.
     Kept as a ref rather than reading the `transform` state directly so `animateTo` itself
     never needs `transform` in its own dependency list. */
  const transformRef = useRef({ x: 0, y: 0, k: 1 });

  const [width, setWidth] = useState<number>(720);
  const [transform, setTransform] = useState({ x: 0, y: 0, k: 1 });
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  /* Off by default: an origin prompt is secondary, attribution-shaped information most nodes
     don't even carry, and always drawing it would spend canvas space and force-layout pull on
     something most readers are not looking for. A manual toggle rather than the same
     hover-to-reveal treatment as a statement, since browsing every prompt in the graph at
     once is a real thing to want to do, not just a side effect of pointing at one node. */
  const [showOrigins, setShowOrigins] = useState(false);
  /* Bumped on every simulation tick to pull the freshly written node positions into a
     render. It is also a dependency of the label layout below: d3 moves nodes by mutating
     them in place, so the array they live in never changes identity and is no signal at all
     that anything has moved. */
  const [tick, setTick] = useState(0);

  useEffect(() => {
    transformRef.current = transform;
  }, [transform]);

  const { simNodes, links, originLinks, degree } = useMemo(() => buildGraph(payload), [payload]);
  const isEmpty = simNodes.length === 0;
  const hasOrigins = useMemo(() => simNodes.some((n) => n.type === 'origin'), [simNodes]);

  /* A series graph folds in every event under a topic, so which session raised a concept is
     worth seeing; a single event's graph has nothing to distinguish and this is empty. */
  const sessions = useMemo(() => sessionIndexById(payload), [payload]);

  const conceptColor = useCallback(
    (node: GraphSimNode) => {
      const session = node.provenance?.conversationId ? sessions.get(node.provenance.conversationId) : undefined;
      return session === undefined ? CONCEPT : (SESSION_COLORS[session] ?? CONCEPT);
    },
    [sessions],
  );

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
      ) || 1;
    return scaleSqrt()
      .domain([1, Math.max(1, maxDegree)])
      .range([5, 16])
      .clamp(true);
  }, [simNodes, degree]);

  /** An origin prompt has no meaningful degree, so its pill is sized by its full label — never
      elided, so showing one always means reading the whole prompt. */
  const originWidth = useCallback((node: GraphSimNode) => node.label.length * 5.6 + 20, []);

  /**
   * How a concept or contribution's label breaks into lines and how much room that block
   * needs, computed once per layout rather than inline in both the fit and the label overlay
   * below — a leaf's statement can run to several lines, and both places need to agree on
   * exactly how many.
   *
   * Independent of zoom: line breaks are decided in fixed screen-pixel units, the same units
   * the label overlay itself is drawn in, so wrapping never changes as the reader zooms.
   */
  const labelInfo = useMemo(() => {
    const info = new Map<string, { lines: string[]; width: number; height: number; lineHeight: number; fontSize: number }>();
    for (const node of simNodes) {
      if (node.type === 'origin') continue;
      const fontSize = node.type === 'concept' ? CONCEPT_LABEL_SIZE : CONTRIBUTION_LABEL_SIZE;
      const ratio = node.type === 'contribution' ? 0.62 : 0.55;
      const lines = wrapLabel(node.label, LABEL_MAX_WIDTH, fontSize, ratio);
      const lineHeight = fontSize * LABEL_LINE_HEIGHT_FACTOR;
      info.set(node.id, {
        lines,
        width: Math.max(...lines.map((line) => estimateTextWidth(line, fontSize, ratio))),
        height: lines.length * lineHeight,
        lineHeight,
        fontSize,
      });
    }
    return info;
  }, [simNodes]);

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
  //
  // Deliberately NOT keyed on width/height — see the resize effect just below this one. A
  // rebuild here means a brand new simulation object, seeded fresh and re-ignited at full
  // strength (alpha 1), which is right for an actually new or revised graph but wrong for a
  // mere resize: a resize this component causes itself (the node-detail card below the
  // canvas changing height, which can toggle a scrollbar and shrink the tracked width) would
  // otherwise retrigger this same rebuild on every render it touches, throwing every node
  // back into motion each time — which is what "jittery, unstable, can't click a node" turned
  // out to be. `boxRef` is how this effect still gets a real width/height to seed and centre
  // with, without depending on either.
  useEffect(() => {
    if (isEmpty) return;

    const { width: boxWidth, height: boxHeight } = boxRef.current;
    const positions = positionsRef.current;
    /* A node keeps the place it held in the previous version — ids are stable across
       versions, so a concept that survived a revision is the same node and should not jump.
       Anything new starts on a small spiral around the middle of the canvas: d3's own
       initial placement is centred on the origin, which is the top-left corner here, so the
       first frame would otherwise be drawn off the edge before the forces pull it back. */
    simNodes.forEach((node, i) => {
      const previous = positions.get(node.id);
      if (previous) {
        node.x = previous.x;
        node.y = previous.y;
        return;
      }
      if (node.x === undefined || node.y === undefined) {
        const angle = i * SEED_ANGLE;
        const radius = SEED_SPACING * Math.sqrt(i + 0.5);
        node.x = boxWidth / 2 + radius * Math.cos(angle);
        node.y = boxHeight / 2 + radius * Math.sin(angle);
      }
    });

    // Counted per run, so a fresh layout is framed from its first frames.
    let ticksSinceFit = FIT_EVERY_TICKS;

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
      .force('center', forceCenter(boxWidth / 2, boxHeight / 2))
      .on('tick', () => {
        setTick((t) => t + 1);
        /* Keep the graph framed as it settles, rather than framing it once at the end.
           A force layout spreads for a second or two after it starts, and it knows nothing
           about the size of the box it is drawn in, so a graph framed only at the end spends
           that whole time with nodes wandering off the edges — and a simulation that keeps
           being restarted by a remount never reaches its end event at all.

           Never over someone who has taken hold of the view, though: once the reader has
           zoomed or panned, the view is theirs, and a version arriving mid-inspection must
           not yank it away from them. Same while a node is focused — the whole-graph fit is
           exactly the view the reader has deliberately zoomed away from. */
        ticksSinceFit += 1;
        if (!hasUserZoomedRef.current && !selectedIdRef.current && ticksSinceFit >= FIT_EVERY_TICKS) {
          ticksSinceFit = 0;
          fitToViewRef.current();
        }
      })
      // And once more when it stops for good, on the arrangement the reader is left with.
      .on('end', () => {
        if (!hasUserZoomedRef.current && !selectedIdRef.current) fitToViewRef.current();
      });

    simulationRef.current = simulation;

    return () => {
      for (const node of simNodes) {
        if (node.x !== undefined && node.y !== undefined) {
          positions.set(node.id, { x: node.x, y: node.y });
        }
      }
      simulation.stop();
      simulationRef.current = null;
    };
    // `radiusOf` is derived from simNodes and degree, both already dependencies here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [simNodes, links, originLinks, isEmpty]);

  // A pure resize retargets the existing simulation instead of the effect above rebuilding
  // it — see its own comment for why a rebuild is the wrong response to this. A gentle nudge
  // (not a full alpha-1 restart) is enough to drift an already-settled layout to the new
  // middle; skipped on the very first run, since the effect above already centred on these
  // same values when it created the simulation.
  const boxMounted = useRef(false);
  useEffect(() => {
    boxRef.current = { width, height };
    if (!boxMounted.current) {
      boxMounted.current = true;
      return;
    }
    const simulation = simulationRef.current;
    if (!simulation) return;
    simulation.force('center', forceCenter(width / 2, height / 2));
    simulation.alpha(Math.max(simulation.alpha(), 0.3)).restart();
  }, [width, height]);

  // Smooth continuous zoom and pan.
  useEffect(() => {
    if (isEmpty || !svgRef.current) return;

    const svg = select(svgRef.current);
    const behavior = d3Zoom<SVGSVGElement, unknown>()
      .scaleExtent([MIN_SCALE, MAX_SCALE])
      // Set explicitly rather than left to d3-zoom's default, which reads the SVG's own
      // viewBox.baseVal on every gesture — a real browser supports that fine, but we already
      // track width/height ourselves, and reading it out of the DOM on every zoom is one more
      // thing to keep in sync for no reason (and jsdom does not support it at all).
      .extent([
        [0, 0],
        [width, height],
      ])
      .on('start', (event) => {
        // Only a gesture carries a sourceEvent; fitToView's own transform does not, and isn't
        // usage worth counting.
        if (event.sourceEvent) gestureStartRef.current = { k: event.transform.k, sourceType: event.sourceEvent.type };
      })
      .on('zoom', (event) => {
        // Only a gesture carries a sourceEvent; fitToView's own transform does not.
        if (event.sourceEvent) hasUserZoomedRef.current = true;
        setTransform({ x: event.transform.x, y: event.transform.y, k: event.transform.k });
      })
      .on('end', (event) => {
        // One event per whole gesture rather than per animation frame: d3-zoom already
        // batches a drag's or a scroll run's many intermediate 'zoom' calls behind a single
        // 'start'/'end' pair, which is what keeps this from flooding Matomo.
        const start = gestureStartRef.current;
        gestureStartRef.current = null;
        if (!start || !event.sourceEvent) return;
        const wasZoom = Math.abs(event.transform.k - start.k) > 1e-3;
        trackEvent('graph', wasZoom ? 'zoom' : 'pan', start.sourceType === 'wheel' ? 'scroll' : 'drag');
      });

    zoomRef.current = behavior;
    svg.call(behavior);
    return () => {
      svg.on('.zoom', null);
      zoomRef.current = null;
    };
    // width/height deliberately excluded: the effect below keeps the extent current on a
    // resize without tearing this whole behaviour down and reattaching its listeners.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEmpty]);

  // Keeps the extent current on a resize, without tearing down and reattaching the zoom
  // behaviour's listeners the way rebuilding it in the effect above would on every resize.
  useEffect(() => {
    zoomRef.current?.extent([
      [0, 0],
      [width, height],
    ]);
  }, [width, height]);

  /**
   * Every placed node's extent, in the shape {@link computeFitTransform} wants — labels and
   * pill widths included — optionally narrowed to a subset of ids. Shared by the whole-graph
   * fit and the focus fit below, so the two can never disagree about what a node occupies.
   */
  const buildExtents = useCallback(
    (idFilter?: Set<string>) =>
      simNodes
        // Hidden origin nodes still hold a position from the simulation, but framing around
        // something nobody can see would waste canvas the rest of the graph could use.
        .filter(
          (n) =>
            n.x !== undefined &&
            n.y !== undefined &&
            (showOrigins || n.type !== 'origin') &&
            (!idFilter || idFilter.has(n.id)),
        )
        .map((node) => ({
          x: node.x!,
          y: node.y!,
          halfWidth: footprintOf(node),
          halfHeight: radiusOf(node),
          // A label's block hangs below a concept or contribution, so the bottom needs room
          // for its actual wrapped height — a leaf's statement may run several lines deep.
          labelDrop: node.type === 'origin' ? 0 : LABEL_GAP + (labelInfo.get(node.id)?.height ?? 0),
        })),
    [simNodes, showOrigins, footprintOf, radiusOf, labelInfo],
  );

  /**
   * Eases the canvas from wherever it currently sits to `target`, rather than snapping —
   * used for a deliberate focus change, never for the settling simulation's own repeated
   * re-fits, which still snap on every tick as before.
   *
   * Hand-rolled rather than pulled in from d3-transition: the step buttons already skip
   * animation for the same reason (see below), and a focus change is the one place here that
   * actually wants easing, which a dozen lines of `requestAnimationFrame` covers on its own.
   */
  const animateTo = useCallback((target: { x: number; y: number; k: number }) => {
    const svg = svgRef.current;
    const behavior = zoomRef.current;
    if (!svg || !behavior) return;

    if (focusAnimRef.current !== null) cancelAnimationFrame(focusAnimRef.current);

    const start = transformRef.current;
    const startTime = performance.now();
    // Interpolating `k` in log space is what makes the zoom read as a constant rate of
    // change rather than slowing to a crawl on the way to a much smaller scale.
    const logStart = Math.log(start.k);
    const logTarget = Math.log(target.k);

    const step = (now: number) => {
      const t = Math.min(1, (now - startTime) / FOCUS_DURATION_MS);
      const eased = 1 - (1 - t) ** 3;
      const k = Math.exp(logStart + (logTarget - logStart) * eased);
      const x = start.x + (target.x - start.x) * eased;
      const y = start.y + (target.y - start.y) * eased;
      select(svg).call(behavior.transform, zoomIdentity.translate(x, y).scale(k));

      focusAnimRef.current = t < 1 ? requestAnimationFrame(step) : null;
    };
    focusAnimRef.current = requestAnimationFrame(step);
  }, []);

  /**
   * Frames the whole graph in the canvas.
   *
   * A force layout spreads as far as its nodes push each other and has no idea how big the
   * box is, so left alone it runs off every edge. This measures what was actually laid out
   * and picks the transform that brings it inside.
   *
   * Snaps by default, the way the settling simulation's own repeated calls always have; pass
   * `animate` for a reader-initiated return to the whole graph (the "fit" button, or
   * deselecting), where a jump-cut would read as a glitch rather than a deliberate zoom out.
   */
  const fitToView = useCallback(
    (animate = false) => {
      const svg = svgRef.current;
      const behavior = zoomRef.current;
      if (!svg || !behavior) return;

      /* No floor on this one: the whole point of "fit" is that it shows the whole graph, so
         a graph wide enough to need a scale below MIN_SCALE gets it — the alternative is a
         fit button that crops what it claims to frame. */
      const fit = computeFitTransform(buildExtents(), width, height, {
        margin: FIT_MARGIN,
        minScale: 0,
        maxScale: MAX_SCALE,
      });
      if (!fit) return;

      /* MIN_SCALE remains the floor for a reader's own scroll/pinch/− on an ordinary graph —
         the everyday case where zooming out past it would just shrink things to dust for no
         reason. But it must never be tighter than what fit itself just needed, and a reader
         deliberately zooming out past the whole graph — to get their bearings, or just because
         they want to — is one step further out than fit, the same as one press of "−" would
         give them from any other view. */
      behavior.scaleExtent([Math.min(MIN_SCALE, fit.k / ZOOM_STEP), MAX_SCALE]);

      if (animate) animateTo(fit);
      else select(svg).call(behavior.transform, zoomIdentity.translate(fit.x, fit.y).scale(fit.k));
    },
    [buildExtents, width, height, animateTo],
  );

  /* Kept in a ref so the simulation's 'end' handler always calls the current one without
     the simulation having to be rebuilt whenever it changes. */
  const fitToViewRef = useRef(fitToView);
  useEffect(() => {
    fitToViewRef.current = fitToView;
  }, [fitToView]);

  /* Re-frame when origin prompts are shown or hidden, so the graph actually uses the canvas
     space that gains or loses — never over a reader who has already taken hold of the view.
     Skips its first firing, on mount, since the simulation's own tick/end handlers already
     own the initial fit; re-running it here too would just be redundant. */
  const showOriginsMounted = useRef(false);
  useEffect(() => {
    if (!showOriginsMounted.current) {
      showOriginsMounted.current = true;
      return;
    }
    if (!hasUserZoomedRef.current) fitToViewRef.current();
  }, [showOrigins]);

  /**
   * Focus mode: a click on a node frames it and whatever it is joined to, rather than
   * leaving the camera where it was and only dimming the rest — deselecting reverses it,
   * panning back out to the whole graph. Guarded to real transitions (`prevSelectedRef`) so
   * mounting with nothing selected doesn't animate a "return" from nowhere, and skipped
   * while the graph is still building (`isEmpty`), before there is anything to frame.
   */
  useEffect(() => {
    const prev = prevSelectedRef.current;
    prevSelectedRef.current = selectedId;
    selectedIdRef.current = selectedId;
    if (isEmpty || prev === selectedId) return;

    /* The camera is about to pan under a pointer that has not itself moved — a real browser
       still re-evaluates which node that pointer sits over as the layout shifts beneath it,
       which would otherwise leave some node the reader never asked about lit once the pan
       settles. Clearing it here means the dim/highlight state reflects only the focus change
       itself; a genuine hover re-establishes on the reader's next actual mouse movement. */
    setHoverId(null);

    if (selectedId) {
      const focusIds = connectedIds(selectedId, links, originLinks) ?? new Set([selectedId]);
      const target = computeFitTransform(buildExtents(focusIds), width, height, {
        margin: FOCUS_MARGIN,
        minScale: MIN_SCALE,
        maxScale: MAX_SCALE,
      });
      if (target) animateTo(target);
    } else if (prev !== null) {
      fitToView(true);
    }
  }, [selectedId, links, originLinks, buildExtents, width, height, animateTo, fitToView, isEmpty]);

  // Escape is the reader's other way out of focus, beside clicking the focused node again,
  // clicking empty canvas, or the "fit" button.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelectedId(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  /* The buttons step the zoom rather than animating it: easing the step would mean pulling
     in d3-transition and its five transitive modules for an effect the scroll and pinch
     gestures — which are already continuous — don't need. */
  const zoomBy = (factor: number) => {
    if (!svgRef.current || !zoomRef.current) return;
    trackEvent('graph', factor > 1 ? 'zoom_in' : 'zoom_out', 'button');
    select(svgRef.current).call(zoomRef.current.scaleBy, factor);
  };

  const activeId = hoverId ?? selectedId;
  const lit = useMemo(() => connectedIds(activeId, links, originLinks), [activeId, links, originLinks]);
  const activeNode = activeId ? simNodes.find((n) => n.id === activeId) : undefined;
  const nodeById = useMemo(() => new Map(simNodes.map((n) => [n.id, n])), [simNodes]);

  /**
   * Which labels to draw, and where, in screen coordinates.
   *
   * Every concept and contribution wants a label; in a dense graph they cannot all have one
   * without printing over each other, so the better-connected node wins the space. Whatever
   * is under the cursor keeps its label regardless, along with everything it is joined to,
   * since that is precisely what the reader is asking about.
   */
  const visibleLabels = useMemo(() => {
    const candidates = simNodes
      .filter((node) => node.type !== 'origin' && node.x !== undefined && node.y !== undefined)
      .map((node) => {
        const mono = node.type === 'contribution';
        const info = labelInfo.get(node.id);
        const lines = info?.lines ?? [node.label];
        const lineHeight = info?.lineHeight ?? CONTRIBUTION_LABEL_SIZE;
        const fontSize = info?.fontSize ?? CONTRIBUTION_LABEL_SIZE;
        const blockWidth = info?.width ?? estimateTextWidth(node.label, fontSize, mono ? 0.62 : 0.55);
        const blockHeight = info?.height ?? lineHeight;
        const screenX = node.x! * transform.k + transform.x;
        const screenY = node.y! * transform.k + transform.y;
        const screenRadius = radiusOf(node) * transform.k;
        // Below the node is the preferred spot — a block's top sits a small gap below the
        // node's edge, `y` its vertical centre, matching how selectVisibleLabels treats every
        // box — but a busier node may have something sitting right there. Above, left, and
        // right are offered as fallbacks rather than losing the label outright: same node,
        // same block, just anchored a different way each time, tried in turn only once the
        // spot before it has already lost.
        const yBelow = screenY + screenRadius + LABEL_GAP + blockHeight / 2;
        const yAbove = screenY - screenRadius - LABEL_GAP - blockHeight / 2;
        const xRight = screenX + screenRadius + LABEL_GAP + blockWidth / 2;
        const xLeft = screenX - screenRadius - LABEL_GAP - blockWidth / 2;
        return {
          node,
          mono,
          fontSize,
          lines,
          lineHeight,
          isActive: activeId === node.id,
          // Screen position: the node's place in the graph, put through the current zoom.
          x: screenX,
          y: yBelow,
          /* Not yet worth adding, but worth remembering:
             - Diagonal fallbacks (NE/NW/SE/SW) after these four — a cheap extension of the
               same mechanism, for a label that still has room but not along an axis.
             - Leader lines from an offset label back to its node — once a label can land to
               the side, it can occasionally read as belonging to a neighbour instead in a
               dense cluster. Would need to stay thin/low-opacity so it doesn't undo the
               link-visibility fix links themselves just got. */
          alternates: [
            { x: screenX, y: yAbove },
            { x: xRight, y: screenY },
            { x: xLeft, y: screenY },
          ],
          width: blockWidth,
          height: blockHeight,
          priority: degree.get(node.id) ?? 0,
          required: activeId === node.id || (!!lit && lit.has(node.id)),
        };
      })
      .filter((candidate) => {
        // Nothing outside the canvas is worth the space it would take from a label inside it.
        const marginX = candidate.width / 2;
        const marginY = candidate.height / 2;
        return (
          candidate.x > -marginX && candidate.x < width + marginX && candidate.y > -marginY && candidate.y < height + marginY
        );
      });

    /* An origin prompt draws its text inside its own pill, in the zoomed layer, so it is
       never a candidate here — but when shown it is very much in the way. Marking the pills
       as obstacles is what keeps a label from being printed across one; when origins are
       hidden there is nothing to reserve space for. */
    const pills = showOrigins
      ? simNodes
          .filter((node) => node.type === 'origin' && node.x !== undefined && node.y !== undefined)
          .map((node) => ({
            id: node.id,
            x: node.x! * transform.k + transform.x,
            y: node.y! * transform.k + transform.y,
            width: originWidth(node) * transform.k,
            height: ORIGIN_PILL_HEIGHT * transform.k,
            priority: 0,
            hardObstacle: true,
          }))
      : [];

    /* Every concept and contribution reserves its own circle or diamond against ANY label —
       including a required one — the same way a shown origin pill does above. Without this,
       a busy hub's own label (or, while it's focused or hovered, one of its neighbours',
       which `required` makes unconditional) could paper directly over an unrelated node
       sitting right next to it, hiding that node and blocking its own click target. `priority`
       plays no part here: unlike a label, a node's circle is not competing for space, it is
       simply already there, so it always wins regardless of whose label it blocks. */
    const nodeFootprints = simNodes
      .filter((node) => node.type !== 'origin' && node.x !== undefined && node.y !== undefined)
      .map((node) => {
        const diameter = 2 * radiusOf(node) * transform.k;
        return {
          id: `__footprint_${node.id}`,
          x: node.x! * transform.k + transform.x,
          y: node.y! * transform.k + transform.y,
          width: diameter,
          height: diameter,
          priority: 0,
          hardObstacle: true,
        };
      });

    const visible = selectVisibleLabels([
      ...pills,
      ...nodeFootprints,
      ...candidates.map(({ node, x, y, alternates, width: w, height: h, priority, required }) => ({
        id: node.id,
        x,
        y,
        alternates,
        width: w,
        height: h,
        priority,
        required,
      })),
    ]);

    // The chosen spot may be the alternate (above) rather than the candidate's own default
    // (below) — `visible` is what selectVisibleLabels actually settled on for each id.
    return candidates.flatMap((candidate) => {
      const at = visible.get(candidate.node.id);
      return at ? [{ ...candidate, x: at.x, y: at.y }] : [];
    });
    // `tick` is in the dependency list because node positions are mutated in place: without
    // it the labels would stay where the nodes started while the nodes themselves moved off.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [simNodes, tick, transform, radiusOf, originWidth, degree, activeId, lit, width, height, showOrigins, labelInfo]);

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
      const stroke = hot ? LINK_HOT : dashed ? ORIGIN : LINK;
      const strokeWidth = hot ? 2.75 : dashed ? 1.25 : 1.75;
      const strokeOpacity = hot ? 0.95 : dashed ? 0.55 : 0.9;
      const style = { transition: 'stroke 150ms ease, stroke-width 150ms ease, stroke-opacity 150ms ease' };

      // An origin link is attribution, drawn straight and out of the way. A contribution
      // link gets a gentle bow instead of a straight line — contributions already join
      // three or more concepts as their own node (see buildGraph), so a bundle of straight
      // spokes reads as a rigid star; a shared curvature reads as one thing radiating out.
      // The bow's direction comes from the pair of ids, not randomness, so it never
      // flickers between renders of the same link.
      if (dashed) {
        return (
          <line
            key={`o${i}`}
            x1={source.x}
            y1={source.y}
            x2={target.x!}
            y2={target.y}
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeOpacity={strokeOpacity}
            strokeDasharray="4 3"
            style={style}
          />
        );
      }

      const dx = target.x! - source.x!;
      const dy = target.y! - source.y!;
      const length = Math.hypot(dx, dy);
      const sign = source.id < target.id ? 1 : -1;
      const bow = length * LINK_CURVATURE * sign;
      const nx = length > 0 ? -dy / length : 0;
      const ny = length > 0 ? dx / length : 0;
      const controlX = (source.x! + target.x!) / 2 + nx * bow;
      const controlY = (source.y! + target.y!) / 2 + ny * bow;

      return (
        <path
          key={`l${i}`}
          d={`M ${source.x} ${source.y} Q ${controlX} ${controlY} ${target.x} ${target.y}`}
          fill="none"
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeOpacity={strokeOpacity}
          style={style}
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
          <Button
            onClick={() => {
              trackEvent('graph', 'fit', 'button');
              // A focused node has already claimed the camera; clearing the selection is what
              // hands it back, and the focus effect above animates the actual pan/zoom out.
              // With nothing selected there is no such effect to rely on, so this snaps the
              // view itself, exactly as it always has.
              if (selectedId !== null) setSelectedId(null);
              else fitToView();
            }}
            aria-label="Fit graph to view"
          >
            fit
          </Button>
        </ButtonGroup>
        {hasOrigins && (
          <Button size="small" variant="outlined" onClick={() => setShowOrigins((v) => !v)} aria-pressed={showOrigins}>
            {showOrigins ? 'Hide origin prompts' : 'Show origin prompts'}
          </Button>
        )}
        <Typography variant="caption" sx={{ color: MUTED, fontFamily: 'ui-monospace, monospace' }}>
          {transform.k.toFixed(2)}x
        </Typography>
        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', ml: 'auto' }}>
          {sessions.size > 0 ? (
            /* Sessions are numbered by first appearance: a conversation id says nothing to a
               reader, and a session is the one piece of provenance safe to show them. */
            Array.from(sessions.values())
              .sort((a, b) => a - b)
              .map((index) => (
                <LegendChip
                  key={index}
                  color={SESSION_COLORS[index] ?? CONCEPT}
                  shape="circle"
                  label={`session ${index + 1}`}
                />
              ))
          ) : (
            <LegendChip color={CONCEPT} shape="circle" label="concept" />
          )}
          <LegendChip color={CONTRIBUTION} shape="diamond" label="contribution" />
          {/* Unconditional here would legend a shape this graph never draws — the same
              condition already gates the "Show origin prompts" button above. */}
          {hasOrigins && <LegendChip color={ORIGIN} shape="pill" label="origin prompt" />}
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
        aria-label={`Concept graph. Circles are concepts, diamonds are contributions joining them${
          hasOrigins ? `, dashed pills are the prompts they came out of${showOrigins ? '' : ' — currently hidden'}` : ''
        }. Scroll or pinch to zoom, drag to pan. Click a node to focus on it and its neighbours, click empty space or press Escape to return to the whole graph.`}
        /* A node's own click stops here before it bubbles, so this only ever fires for a
           click that lands on empty canvas — the reader's other way to drop focus, besides
           clicking the focused node again, the "fit" button, or Escape. */
        onClick={() => setSelectedId(null)}
        style={{
          display: 'block',
          background: '#FFFFFF',
          border: `1px solid ${PANEL_BORDER}`,
          borderRadius: 6,
          touchAction: 'none',
        }}
      >
        <defs>
          {/* One shared halo for whatever is focused, regardless of node kind or session
              colour — the glow is about being the thing in focus, not about repeating a
              colour the fill and stroke already carry. */}
          <filter id="concept-graph-focus-halo" x="-60%" y="-60%" width="220%" height="220%">
            <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor={TEXT} floodOpacity="0.35" />
          </filter>
        </defs>
        <g transform={`translate(${transform.x},${transform.y}) scale(${transform.k})`}>
          {showOrigins && <g>{renderLinks(originLinks, true)}</g>}
          <g>{renderLinks(links, false)}</g>
          <g>
            {simNodes.map((node) => {
              if (node.x === undefined || node.y === undefined) return null;
              if (node.type === 'origin' && !showOrigins) return null;
              const r = radiusOf(node);
              const dim = !!lit && !lit.has(node.id);
              const isActive = activeId === node.id;

              return (
                <g
                  key={node.id}
                  data-node-id={node.id}
                  transform={`translate(${node.x},${node.y})`}
                  opacity={dim ? 0.25 : 1}
                  onMouseEnter={() => setHoverId(node.id)}
                  onMouseLeave={() => setHoverId(null)}
                  onClick={(event) => {
                    // Stops here so the svg's own onClick — background click, which drops
                    // focus — never also fires for the same click.
                    event.stopPropagation();
                    setSelectedId((current) => (current === node.id ? null : node.id));
                  }}
                  style={{ cursor: 'pointer', transition: 'opacity 200ms ease' }}
                >
                  {node.type === 'concept' && (
                    <circle
                      r={r}
                      fill={conceptColor(node)}
                      fillOpacity={0.85}
                      stroke={isActive ? TEXT : '#FFFFFF'}
                      strokeWidth={isActive ? 2.5 : 1}
                      filter={isActive ? 'url(#concept-graph-focus-halo)' : undefined}
                      style={{ transition: 'stroke 150ms ease, stroke-width 150ms ease' }}
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
                      filter={isActive ? 'url(#concept-graph-focus-halo)' : undefined}
                      style={{ transition: 'stroke 150ms ease, stroke-width 150ms ease' }}
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
                      filter={isActive ? 'url(#concept-graph-focus-halo)' : undefined}
                      style={{ transition: 'stroke 150ms ease, stroke-width 150ms ease' }}
                    />
                  )}

                  {/* An origin prompt's text sits inside its own pill, which is the shape of
                      the node rather than a label beside it, sized by originWidth to fit the
                      whole prompt — showing one at all means reading it in full, never an
                      ellipsis. Concept and contribution labels are drawn in the overlay below,
                      at a fixed size. */}
                  {node.type === 'origin' && (
                    <text
                      y={4}
                      textAnchor="middle"
                      fontSize={9.5}
                      fontFamily="ui-monospace, monospace"
                      fill={ORIGIN}
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

        {/* Labels live outside the zoomed layer, so they keep one size however far in the
            reader zooms — which is what lets zooming spread crowded nodes apart until their
            labels stop colliding and reappear. Each is wrapped into a block near its own node
            rather than one line long enough to run across the canvas, and drawn on its own
            background card so it reads as itself rather than blending into whatever line or
            node happens to sit behind it. */}
        <g>
          {visibleLabels.map(
            ({ node, x, y, fontSize, mono, isActive, lines, lineHeight, width: blockWidth, height: blockHeight }) => {
              const dimmed = !!lit && !lit.has(node.id);
              // The block's own top edge, worked back from its centre `y`; the first line's
              // baseline sits fontSize below that, which is roughly a line's ascent.
              const blockTop = y - blockHeight / 2;
              const firstBaseline = blockTop + fontSize;
              return (
                <g key={node.id} opacity={dimmed ? 0.25 : 1} style={{ transition: 'opacity 200ms ease' }}>
                  <rect
                    x={x - blockWidth / 2 - LABEL_PADDING_X}
                    y={blockTop - LABEL_PADDING_Y}
                    width={blockWidth + LABEL_PADDING_X * 2}
                    height={blockHeight + LABEL_PADDING_Y * 2}
                    rx={3}
                    fill={LABEL_BG}
                    stroke={PANEL_BORDER}
                    strokeWidth={1}
                    style={{ pointerEvents: 'none' }}
                  />
                  {lines.map((line, i) => (
                    <text
                      key={i}
                      x={x}
                      y={firstBaseline + i * lineHeight}
                      textAnchor="middle"
                      fontSize={fontSize}
                      fontFamily={mono ? 'ui-monospace, monospace' : 'inherit'}
                      fill={isActive ? TEXT : LABEL}
                      style={{ pointerEvents: 'none' }}
                    >
                      {line}
                    </text>
                  ))}
                </g>
              );
            },
          )}
        </g>
      </svg>

      <NodeDetail
        node={activeNode}
        degree={activeNode ? (degree.get(activeNode.id) ?? 0) : 0}
        session={activeNode?.provenance?.conversationId ? sessions.get(activeNode.provenance.conversationId) : undefined}
      />
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
function NodeDetail({ node, degree, session }: { node?: GraphSimNode; degree: number; session?: number }) {
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
        {session !== undefined && ` · session ${session + 1}`}
      </Typography>
      <Typography variant="body2" sx={{ color: TEXT, fontWeight: 500 }}>
        {/* On the canvas a contribution is labelled by its statement when it has one; here
            that would repeat the line below, so this always names the relationship itself. */}
        {node.type === 'contribution' ? (node.kind ?? node.label) : node.label}
      </Typography>
      {node.statement && (
        <Typography variant="body2" sx={{ color: MUTED, mt: 0.5 }}>
          {node.statement}
        </Typography>
      )}
      {/* Only a concept ever carries this — a series graph that outgrew its size cap folds a
          less-connected concept into a related one rather than dropping it, and this is the
          one place that fold stays visible, on demand, without spending canvas space on it. */}
      {node.foldedFrom && node.foldedFrom.length > 0 && (
        <Typography variant="caption" sx={{ display: 'block', color: MUTED, mt: 0.5, fontStyle: 'italic' }}>
          Also encompasses: {node.foldedFrom.join(', ')}
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
