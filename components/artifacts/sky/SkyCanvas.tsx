import React, { memo, useEffect, useId, useMemo, useRef } from 'react';
import { Box } from '@mui/material';
import {
  ContributionPlacement,
  Point,
  PROMPT_PILL,
  SkyFilterState,
  STRONG_LABEL_DEGREE,
  conceptLabelLines,
  focusSet,
  placeContributions,
  placePrompts,
  polarPoint,
  promptConceptLinks,
  promptContributionLinks,
  sessionArcs,
} from '../../../utils/conceptSky';
import {
  NodeKind,
  SkyScene,
  conceptLabel,
  joined,
  nodeKind,
  promptColor,
  relationPhrase,
  sessionName,
  sessionOfNode,
} from './scene';
import { eyebrowSx } from './styles';
import { visibleLabels } from './visibleLabels';
import { cgVar, haloOpacity, haloRadius, sessionVar, skyGeometry as G, skyOpacity as O, starRadius } from './tokens';

interface SkyCanvasProps {
  scene: SkyScene;
  /** Where each concept is drawn right now: Sky, Orbit, or a frame between them. */
  positions: Map<string, Point>;
  /** Where the stars are headed. Orbit thins its labels against these, so the set holds still through the glide. */
  targetPositions: Map<string, Point>;
  orbit: boolean;
  filter: SkyFilterState;
  hoverId: string | null;
  selectedId: string | null;
  onHover: (id: string | null) => void;
  /** The pointer or focus has stayed on a concept or prompt for DWELL_MS. Gets the node's kind, never its id; contributions are never reported. */
  onDwell?: (kind: NodeKind) => void;
  /** A click on the sky: selects, or clears when the thing is already selected. */
  onToggle: (id: string) => void;
}

/** Air above and below the 1000x680 frame: a star on Orbit's outer ring sits 20 units from the edge, and its label hangs below it. */
export const VIEW_PAD = 36;
const RING_OFFSET = 3.5;
const RING_WIDTH = 2.25;
const SELECT_RING_OFFSET = 9;
const HIT_PAD = 12;
/** How long a node must stay hovered or focused before it counts as looked at rather than passed over. */
export const DWELL_MS = 500;
/** An invisible stroke wide enough to hover or tap a line, which is only 1.25px itself. */
const LINE_HIT_WIDTH = 14;

const arcPath = (radius: number, start: number, end: number): string => {
  const a = polarPoint({ x: 0, y: 0 }, radius, start);
  const b = polarPoint({ x: 0, y: 0 }, radius, end);
  return `M ${a.x.toFixed(2)} ${a.y.toFixed(2)} A ${radius} ${radius} 0 ${end - start > Math.PI ? 1 : 0} 1 ${b.x.toFixed(2)} ${b.y.toFixed(2)}`;
};

const translate = (p: Point) => `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})`;

/**
 * The sky itself: stars, session rings, contribution diamonds and lines, origin-prompt pills
 * and the dotted connectors from pills to what they led to, all in the fixed 1000x680 viewBox
 * that scales to its container (so there is no zoom or pan).
 *
 * Draw order puts connectors and lines under diamonds, pills and stars, so what can be
 * clicked is never covered by something that cannot.
 */
export const SkyCanvas = memo(function SkyCanvas({
  scene,
  positions,
  targetPositions,
  orbit,
  filter,
  hoverId,
  selectedId,
  onHover,
  onDwell,
  onToggle,
}: SkyCanvasProps) {
  const { model } = scene;
  const uid = useId();
  const glowId = `${uid}-glow`;
  const skyId = `${uid}-bg`;

  const placements = useMemo(() => placeContributions(model, positions), [model, positions]);
  const placementById = useMemo(() => new Map(placements.map((p) => [p.id, p])), [placements]);
  const labelled = useMemo(() => (orbit ? visibleLabels(scene, targetPositions) : null), [orbit, scene, targetPositions]);
  const promptPositions = useMemo(() => placePrompts(model, positions, placements), [model, positions, placements]);
  const focusId = hoverId ?? selectedId;
  const focus = useMemo(() => focusSet(model, focusId), [model, focusId]);

  // One event per continuous hover: the timer is keyed on the hovered id alone, so leaving, a new target or
  // unmounting cancels it, while a new scene or callback identity mid-hover (a filter change, a parent
  // re-render) neither restarts nor re-fires it. Those two are read through refs. A contribution is never reported.
  const sceneRef = useRef(scene);
  const onDwellRef = useRef(onDwell);
  sceneRef.current = scene;
  onDwellRef.current = onDwell;
  useEffect(() => {
    const kind = nodeKind(sceneRef.current, hoverId);
    if (!kind || kind === 'contribution') return;
    const timer = setTimeout(() => onDwellRef.current?.(kind), DWELL_MS);
    return () => clearTimeout(timer);
  }, [hoverId]);

  const payload = model.payload;
  const conceptList = payload.concepts ?? [];
  const promptList = payload.originPrompts ?? [];

  const conceptDim = (id: string) => (focus && !focus.concepts.has(id) ? O.nodeDim : 1);
  const contributionDim = (id: string) => (focus && !focus.contributions.has(id) ? O.nodeDim : 1);
  const promptDim = (id: string) => (focus && !focus.ids.has(id) ? O.nodeDim : 1);

  /** Whether the focused thing lights this contribution's line, or the spoke to one concept. */
  const lit = (contributionId: string, conceptIds: string[]) => {
    if (!focusId) return false;
    if (focusId === contributionId) return true;
    const kind = nodeKind(scene, focusId);
    if (kind === 'concept') return conceptIds.includes(focusId);
    return kind === 'prompt' && !!focus?.contributions.has(contributionId);
  };

  const bind = (id: string, label: string) => ({
    role: 'button' as const,
    tabIndex: 0,
    'aria-label': label,
    'aria-pressed': selectedId === id,
    onPointerEnter: () => onHover(id),
    onPointerLeave: () => onHover(null),
    onFocus: () => onHover(id),
    onBlur: () => onHover(null),
    onClick: () => onToggle(id),
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onToggle(id);
      }
    },
  });

  // Connectors: at rest only prompt -> concept; a selected prompt adds its contributions.
  const connectors = [
    ...promptConceptLinks(payload),
    ...(selectedId && scene.prompts.has(selectedId) ? promptContributionLinks(payload, selectedId) : []),
  ];

  const anchor = hoverId ? anchorOf(hoverId, scene, positions, placementById, promptPositions) : null;

  return (
    <Box sx={{ position: 'relative' }}>
      <svg
        viewBox={`0 ${-VIEW_PAD} ${G.viewBox.width} ${G.viewBox.height + 2 * VIEW_PAD}`}
        role="group"
        aria-label="Concept sky. Tab moves between concepts, contributions and prompts. Enter selects, Escape clears."
        style={{ display: 'block', width: '100%', height: 'auto' }}
      >
        <defs>
          <radialGradient id={skyId} cx="50%" cy="45%" r="75%">
            <stop offset="0" style={{ stopColor: cgVar('surfaceSkyGlow') }} />
            <stop offset="0.7" style={{ stopColor: cgVar('surfaceSky') }} />
          </radialGradient>
          <filter id={glowId} x="-150%" y="-150%" width="400%" height="400%">
            <feGaussianBlur stdDeviation={G.star.haloBlur} />
          </filter>
        </defs>
        <rect y={-VIEW_PAD} width={G.viewBox.width} height={G.viewBox.height + 2 * VIEW_PAD} fill={`url(#${skyId})`} />

        {orbit && (
          <g aria-hidden="true">
            {[1, 2, 3].map((k) => (
              <g key={k}>
                <circle
                  cx={G.orbitCenter.x}
                  cy={G.orbitCenter.y}
                  r={G.orbitRingRadii[k]}
                  fill="none"
                  stroke={cgVar('star')}
                  strokeOpacity={0.07}
                />
                <text
                  x={G.orbitCenter.x + 8}
                  y={G.orbitCenter.y - G.orbitRingRadii[k] - 8}
                  fill={cgVar('textSecondary')}
                  fillOpacity={0.55}
                  fontSize={10}
                  letterSpacing="0.1em"
                  fontFamily="var(--cg-font-mono)"
                >
                  {k === 1 ? '1 STEP' : `${k} STEPS`}
                </text>
              </g>
            ))}
          </g>
        )}

        {/* Dotted connectors from origin prompts. */}
        <g aria-hidden="true" style={{ pointerEvents: 'none' }}>
          {connectors.map((c) => {
            const from = promptPositions.get(c.promptId);
            const to = positions.get(c.targetId) ?? placementById.get(c.targetId)?.position;
            if (!from || !to) return null;
            const faded = filter.prompts.get(c.promptId)?.inFilter === false;
            const dim = focus && !(focus.ids.has(c.promptId) && focus.ids.has(c.targetId));
            return (
              <line
                key={`${c.promptId}-${c.targetId}`}
                className="cg-fade"
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                stroke={cgVar('promptLink')}
                strokeWidth={G.promptLink.width}
                strokeDasharray={G.promptLink.dash}
                strokeLinecap="round"
                opacity={faded ? O.lineFade : dim ? O.lineDim : 0.75}
              />
            );
          })}
        </g>

        {/* Contributions joining exactly two concepts are the line between them. */}
        <g>
          {placements
            .filter((p) => p.shape === 'line')
            .map((p) => {
              const [a, b] = p.concepts.map((id) => positions.get(id)!);
              const k = scene.contributions.get(p.id)!;
              const fade = filter.contributions.get(p.id);
              const active = lit(p.id, p.concepts);
              const opacity = fade && !fade.inFilter ? fade.lineOpacity : focus ? (active ? 1 : O.lineDim) : O.lineRest;
              const names = p.concepts.map((id) => conceptLabel(scene, id));
              return (
                <g
                  key={p.id}
                  className="cg-node"
                  {...bind(
                    p.id,
                    `${relationPhrase(k.kind)}, ${p.dashed ? 'summary only' : 'quote'}, joins ${joined(names)}`,
                  )}
                >
                  <line
                    className="cg-fade"
                    x1={a.x}
                    y1={a.y}
                    x2={b.x}
                    y2={b.y}
                    stroke={cgVar('linkSummary')}
                    strokeWidth={active ? G.line.activeWidth : G.line.width}
                    strokeDasharray={p.dashed ? G.line.summaryDash : undefined}
                    strokeLinecap={p.dashed ? undefined : 'round'}
                    opacity={opacity}
                  />
                  <line
                    className="cg-focus-ring"
                    x1={a.x}
                    y1={a.y}
                    x2={b.x}
                    y2={b.y}
                    stroke={cgVar('focusRing')}
                    strokeWidth={4}
                    strokeDasharray="3 3"
                    fill="none"
                  />
                  <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="transparent" strokeWidth={LINE_HIT_WIDTH} />
                </g>
              );
            })}
        </g>

        {/* Spokes of diamonds. */}
        <g aria-hidden="true" style={{ pointerEvents: 'none' }}>
          {placements
            .filter((p) => p.shape === 'diamond')
            .flatMap((p) => {
              const fade = filter.contributions.get(p.id);
              return p.concepts.map((id) => {
                const to = positions.get(id)!;
                const touches = lit(p.id, [id]);
                const opacity =
                  fade && !fade.inFilter ? fade.lineOpacity : focus ? (touches ? O.spokeActive : O.spokeDim) : O.spokeRest;
                return (
                  <line
                    key={`${p.id}-${id}`}
                    className="cg-fade"
                    x1={p.position.x}
                    y1={p.position.y}
                    x2={to.x}
                    y2={to.y}
                    stroke={cgVar('linkSummary')}
                    strokeWidth={touches ? G.spoke.activeWidth : G.spoke.width}
                    strokeDasharray={p.dashed ? '3 3' : undefined}
                    opacity={opacity}
                  />
                );
              });
            })}
        </g>

        {/* Diamonds. */}
        <g>
          {placements
            .filter((p) => p.shape === 'diamond')
            .map((p) => {
              const k = scene.contributions.get(p.id)!;
              const hot = hoverId === p.id || selectedId === p.id;
              const fade = filter.contributions.get(p.id);
              const opacity = fade && !fade.inFilter ? fade.opacity : contributionDim(p.id);
              const names = p.concepts.map((id) => conceptLabel(scene, id));
              const half = G.diamond.size / 2;
              return (
                <g
                  key={p.id}
                  className="cg-node"
                  transform={translate(p.position)}
                  opacity={opacity}
                  {...bind(
                    p.id,
                    `${relationPhrase(k.kind)}, ${p.dashed ? 'summary only' : 'quote'}, joins ${joined(names)}`,
                  )}
                >
                  <circle r={HIT_PAD + 2} fill="transparent" />
                  <rect
                    className="cg-focus-ring"
                    x={-half - 4}
                    y={-half - 4}
                    width={G.diamond.size + 8}
                    height={G.diamond.size + 8}
                    rx={G.diamond.cornerRadius}
                    transform="rotate(45)"
                    fill="none"
                    stroke={cgVar('focusRing')}
                    strokeWidth={2}
                    strokeDasharray="3 3"
                  />
                  <g transform={`scale(${hot ? G.diamond.hoverScale : 1})`}>
                    <rect
                      x={-half}
                      y={-half}
                      width={G.diamond.size}
                      height={G.diamond.size}
                      rx={G.diamond.cornerRadius}
                      transform="rotate(45)"
                      fill={hot ? cgVar('link') : cgVar('surfaceSky')}
                      stroke={cgVar('link')}
                      strokeWidth={G.diamond.strokeWidth}
                      strokeDasharray={p.dashed ? G.diamond.dash : undefined}
                    />
                  </g>
                </g>
              );
            })}
        </g>

        {/* Origin prompts: text-less pills, outlined at rest, filled when hovered or selected. */}
        <g>
          {promptList.map((prompt) => {
            const at = promptPositions.get(prompt.id);
            if (!at) return null;
            const color = promptColor(scene, prompt.id);
            const hot = hoverId === prompt.id || selectedId === prompt.id;
            const fade = filter.prompts.get(prompt.id);
            const opacity = fade && !fade.inFilter ? fade.opacity : promptDim(prompt.id);
            const session = sessionOfNode(scene, prompt);
            const led = scene.model.payload.concepts?.filter((c) => c.origin === prompt.id).length ?? 0;
            const label = `Origin prompt${session !== undefined ? `, ${sessionName(session).toLowerCase()}` : ''}, led to ${led}`;
            const { width, height } = PROMPT_PILL;
            return (
              <g key={prompt.id} className="cg-node" transform={translate(at)} opacity={opacity} {...bind(prompt.id, label)}>
                <rect x={-width / 2 - 8} y={-height / 2 - 8} width={width + 16} height={height + 16} fill="transparent" />
                <rect
                  className="cg-focus-ring"
                  x={-width / 2 - 4}
                  y={-height / 2 - 4}
                  width={width + 8}
                  height={height + 8}
                  rx={height / 2 + 4}
                  fill="none"
                  stroke={cgVar('focusRing')}
                  strokeWidth={2}
                  strokeDasharray="3 3"
                />
                <rect
                  x={-width / 2}
                  y={-height / 2}
                  width={width}
                  height={height}
                  rx={height / 2}
                  fill={hot ? color : cgVar('surfaceSky')}
                  stroke={color}
                  strokeWidth={1.5}
                />
              </g>
            );
          })}
        </g>

        {/* Stars last, so they sit above every line. */}
        <g>
          {conceptList.map((concept) => {
            const at = positions.get(concept.id);
            if (!at) return null;
            const degree = model.degree.get(concept.id) ?? 0;
            const r = starRadius(degree);
            const fade = filter.concepts.get(concept.id);
            const opacity = fade && !fade.inFilter ? fade.opacity : conceptDim(concept.id);
            const strong = focusId ? concept.id === focusId : degree >= STRONG_LABEL_DEGREE;
            const sessions = scene.conceptSessions.get(concept.id) ?? [];
            const ringR = r + RING_OFFSET;
            const arcs = scene.sessionCount > 0 ? sessionArcs(sessions, ringR) : [];
            const lines = conceptLabelLines(concept.label);
            return (
              <g
                key={concept.id}
                className="cg-node"
                transform={translate(at)}
                opacity={opacity}
                data-concept-id={concept.id}
                {...bind(concept.id, `${concept.label}, concept, ${degree} ${degree === 1 ? 'connection' : 'connections'}`)}
              >
                <circle r={r + HIT_PAD} fill="transparent" />
                <circle
                  r={haloRadius(degree)}
                  fill={cgVar('star')}
                  opacity={haloOpacity(degree)}
                  filter={`url(#${glowId})`}
                />
                {arcs.map((arc) => {
                  const stroke = sessions.length === 0 ? cgVar('sessionFallback') : sessionVar(arc.sessionIndex);
                  return arc.end - arc.start >= Math.PI * 2 - 1e-6 ? (
                    <circle key={arc.sessionIndex} r={ringR} fill="none" stroke={stroke} strokeWidth={RING_WIDTH} />
                  ) : (
                    <path
                      key={arc.sessionIndex}
                      d={arcPath(ringR, arc.start, arc.end)}
                      fill="none"
                      stroke={stroke}
                      strokeWidth={RING_WIDTH}
                      strokeLinecap="butt"
                    />
                  );
                })}
                {selectedId === concept.id && (
                  <circle
                    r={r + SELECT_RING_OFFSET}
                    fill="none"
                    stroke={cgVar('link')}
                    strokeWidth={G.star.selectedRingWidth}
                  />
                )}
                <circle
                  className="cg-focus-ring"
                  r={r + SELECT_RING_OFFSET}
                  fill="none"
                  stroke={cgVar('focusRing')}
                  strokeWidth={2}
                  strokeDasharray="3 3"
                />
                <circle r={r} fill={cgVar('star')} />
                {(!labelled || labelled.has(concept.id) || concept.id === focusId || concept.id === selectedId) && (
                  <text
                    y={r + 16}
                    textAnchor="middle"
                    fill={strong ? cgVar('textPrimary') : cgVar('label')}
                    fontSize={strong ? 13 : 12}
                    fontWeight={strong ? 500 : 400}
                    stroke={cgVar('surfaceSky')}
                    strokeWidth={G.label.strokeWidth}
                    strokeLinejoin="round"
                    paintOrder="stroke"
                    style={{ pointerEvents: 'none', fontFamily: 'var(--cg-font-sans)' }}
                  >
                    {lines.map((line, i) => (
                      <tspan key={i} x={0} dy={i === 0 ? 0 : '1.25em'}>
                        {line}
                      </tspan>
                    ))}
                  </text>
                )}
              </g>
            );
          })}
        </g>
      </svg>

      {filter.isEmpty && (
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 1,
            p: 3,
            textAlign: 'center',
            pointerEvents: 'none',
          }}
        >
          {conceptList.length === 0 ? (
            <>
              <Box component="p" sx={emptyTitle}>
                This graph is empty so far
              </Box>
              <Box component="p" sx={emptyBody}>
                Stars appear here as the event goes on and its concepts are drawn out.
              </Box>
            </>
          ) : (
            <>
              <Box component="p" sx={emptyTitle}>
                This part of the sky is still below the horizon
              </Box>
              <Box component="p" sx={emptyBody}>
                Nothing from this session has been placed yet. Concepts from other sessions stay faintly in place so the
                series reads as one sky.
              </Box>
            </>
          )}
        </Box>
      )}

      {anchor && <HoverCard scene={scene} id={hoverId!} at={anchor} />}
    </Box>
  );
});

const emptyTitle = {
  m: 0,
  fontFamily: 'var(--cg-font-serif)',
  fontSize: 'clamp(22px, 4vw, 30px)',
  lineHeight: 1.15,
  color: cgVar('textPrimary'),
};
const emptyBody = { m: 0, maxWidth: 420, fontSize: 15, lineHeight: 1.5, color: cgVar('textSecondary') };

function anchorOf(
  id: string,
  scene: SkyScene,
  positions: Map<string, Point>,
  placements: Map<string, ContributionPlacement>,
  prompts: Map<string, Point>,
): Point | null {
  return positions.get(id) ?? placements.get(id)?.position ?? prompts.get(id) ?? null;
}

/**
 * The card beside whatever is hovered or focused. Placed by percentage of the viewBox, so it
 * follows the sky as it scales without measuring anything, and flips to the left of the star
 * near the right edge so it is never cut off. Decorative: the same facts are in the aria
 * labels and the reading panel.
 */
function HoverCard({ scene, id, at }: { scene: SkyScene; id: string; at: Point }) {
  const kind = nodeKind(scene, id);
  if (!kind) return null;
  let eyebrow = '';
  let title = '';
  let meta = '';
  if (kind === 'concept') {
    const n = scene.model.contributionsOf.get(id)?.length ?? 0;
    eyebrow = `Concept · joins ${scene.model.degree.get(id) ?? 0}`;
    title = conceptLabel(scene, id);
    meta = `${n} ${n === 1 ? 'contribution touches' : 'contributions touch'} this concept. Select to read.`;
  } else if (kind === 'contribution') {
    const k = scene.contributions.get(id)!;
    const names = (scene.model.contributionConcepts.get(id) ?? []).map((c) => conceptLabel(scene, c));
    eyebrow = `${k.statement ? 'Quote' : 'Summary only'} · joins ${names.length}`;
    title = relationPhrase(k.kind);
    meta = names.join(', ');
  } else {
    const prompt = scene.prompts.get(id)!;
    const session = sessionOfNode(scene, prompt);
    const led = (scene.model.payload.concepts ?? []).filter((c) => c.origin === id).length;
    eyebrow = `Origin prompt${session !== undefined ? ` · ${sessionName(session)}` : ''}`;
    title = `Led to ${led} ${led === 1 ? 'concept' : 'concepts'}`;
    meta = 'Select to read the prompt.';
  }
  const xPct = (at.x / G.viewBox.width) * 100;
  const yPct = ((at.y + VIEW_PAD) / (G.viewBox.height + 2 * VIEW_PAD)) * 100;
  const flip = at.x > G.viewBox.width * 0.68;
  return (
    <Box
      aria-hidden="true"
      sx={{
        position: 'absolute',
        top: `calc(${yPct}% - 44px)`,
        ...(flip ? { right: `calc(${100 - xPct}% + 40px)` } : { left: `calc(${xPct}% + 40px)` }),
        width: 230,
        maxWidth: '45%',
        boxSizing: 'border-box',
        p: '12px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        bgcolor: cgVar('surfaceControl'),
        border: `1px solid ${cgVar('borderNote')}`,
        borderRadius: '12px',
        boxShadow: '0 12px 32px rgba(0,0,0,.4)',
        pointerEvents: 'none',
      }}
    >
      <Box sx={eyebrowSx}>{eyebrow}</Box>
      <Box sx={{ fontFamily: 'var(--cg-font-serif)', fontSize: 17, lineHeight: 1.25, color: cgVar('textPrimary') }}>
        {title}
      </Box>
      <Box sx={{ fontSize: 12, lineHeight: 1.45, color: cgVar('textSecondary') }}>{meta}</Box>
    </Box>
  );
}
