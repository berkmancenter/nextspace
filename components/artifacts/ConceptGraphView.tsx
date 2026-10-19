import { useCallback, useMemo, useState } from 'react';
import { ReactNode } from 'react';
import { Box, useMediaQuery } from '@mui/material';
import { ConceptGraphPayload } from '../../types.internal';
import { trackArtifactEvent } from '../../utils/artifactAnalytics';
import { SkyFilter, filterSky, layoutOrbit, layoutSky } from '../../utils/conceptSky';
import { GraphFeedback } from './GraphFeedback';
import { SkyCanvas, VIEW_PAD } from './sky/SkyCanvas';
import { SkyControls } from './sky/SkyControls';
import { SkyLegend } from './sky/SkyLegend';
import { SkyList } from './sky/SkyList';
import { SkyPanel, SkyView } from './sky/SkyPanel';
import SkyStyle from './sky/SkyStyle';
import SkyViewStyle from './sky/SkyViewStyle';
import { buildScene, nodeKind } from './sky/scene';
import { cgVar, skyGeometry, skyShape } from './sky/tokens';
import { useTweenedPositions } from './sky/useTweenedPositions';

/**
 * Props for ConceptGraphView.
 * @property payload - The graph to draw. Every array may be empty; an artifact can exist before an event fills it in.
 * @property header - The artifact's own heading, shown at the top of the reading column.
 * @property conversationId - The conversation the graph came from, so its analytics events are attributed to it. Omitted on a series graph or a fixture.
 * @property height - Kept so existing callers still compile. The sky is a fixed-aspect frame that scales to its container's width, so there is no canvas height to set.
 */
interface ConceptGraphViewProps {
  payload: ConceptGraphPayload;
  conversationId?: string;
  height?: number;
  /** What the artifact is: its title, version and history. In the one-screen layout it heads the reading column rather than the page. */
  header?: ReactNode;
}

/** Below this width the sky's labels get too small to read, so the list is the default. */
const NARROW_QUERY = '(max-width:599px)';
/* Wide and tall enough for the one-screen layout: the sky beside a reading column, the whole thing exactly as
   tall as the window. Anything smaller gets the stacked layout, which scrolls like any page. */
const FIT_QUERY = '(min-width:1000px) and (min-height:680px)';
/** The sky's own proportions, padding included, so a box with this aspect ratio holds the canvas exactly. */
const SKY_ASPECT = `${skyGeometry.viewBox.width} / ${skyGeometry.viewBox.height + 2 * VIEW_PAD}`;
/** What a click may land on without clearing the selection: things to act on, the reading panel, and dialogs. */
const KEEP_SELECTION = 'button, a, input, textarea, select, aside, [role="button"], [role="radio"], .MuiDialog-root';
const SKY_RATIO = skyGeometry.viewBox.width / (skyGeometry.viewBox.height + 2 * VIEW_PAD);

/**
 * Draws a ConceptGraphArtifact as a dark "concept sky": concepts are bone-coloured stars, the
 * people in the room draw the constellations. Contributions are diamonds (or the line between
 * two concepts), solid when a direct quote survived and dashed when only a summary did, and
 * origin prompts are small pills dotted to what they led to. On a series graph each star's ring
 * is cut into one arc per session it appears in.
 *
 * Three views share one set of selections: Sky (every star at its fixed place), Orbit (the
 * selected concept at the centre, the rest on rings by distance) and List, the complete
 * keyboard and screen-reader equivalent. Filtering fades but never moves anything. Layout and
 * rules live in utils/conceptSky.ts; this component only holds the reader's state and wires
 * the pieces in components/artifacts/sky together.
 *
 * The dark theme is scoped to the `.concept-sky` container, so the surrounding app stays light.
 * Nothing that identifies a speaker (a pseudonym, a message id) is read or drawn anywhere in
 * the sky: these graphs come out of Chatham House Rule events. See {@link buildScene}.
 */
export const ConceptGraphView = ({ payload, header, conversationId }: ConceptGraphViewProps) => {
  const track = useCallback(
    (action: string, name: string, value?: number) => trackArtifactEvent(conversationId, 'graph', action, name, value),
    [conversationId],
  );
  const scene = useMemo(() => buildScene(payload), [payload]);
  const narrow = useMediaQuery(NARROW_QUERY, { noSsr: true });
  const fit = useMediaQuery(FIT_QUERY, { noSsr: true });
  const reduceMotion = useMediaQuery('(prefers-reduced-motion: reduce)', { noSsr: true });

  const [layout, setLayout] = useState<'sky' | 'orbit'>('sky');
  const [list, setList] = useState(narrow);
  const [filterRaw, setFilter] = useState<SkyFilter>('all');
  const [selectedRaw, setSelected] = useState<string | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [orbitCenter, setOrbitCenter] = useState<string | null>(null);

  // A revised payload can drop what was selected or filtered by; fall back rather than point at nothing.
  const selectedId = nodeKind(scene, selectedRaw) ? selectedRaw : null;
  const filter: SkyFilter = filterRaw !== 'all' && filterRaw >= scene.sessionCount ? 'all' : filterRaw;
  const view: SkyView = list ? 'list' : layout;

  const skyPositions = useMemo(() => layoutSky(scene.model), [scene.model]);
  const orbitPositions = useMemo(() => layoutOrbit(scene.model, orbitCenter).positions, [scene.model, orbitCenter]);
  const targetPositions = layout === 'orbit' ? orbitPositions : skyPositions;
  const positions = useTweenedPositions(targetPositions, reduceMotion);
  const filterState = useMemo(() => filterSky(scene.model, filter), [scene.model, filter]);

  const select = useCallback(
    (id: string | null) => {
      setSelected(id);
      if (id && nodeKind(scene, id) === 'concept') setOrbitCenter(id);
      // The node id is the graph's own identifier, not a speaker or message id.
      if (id) track('select', nodeKind(scene, id) ?? 'unknown');
    },
    [scene, track],
  );
  // Every way the selection is dropped goes through here so each is counted, with how it happened.
  const deselect = useCallback(
    (method: 'toggle' | 'panel' | 'escape' | 'empty_sky') => {
      setSelected(null);
      track('deselect', method);
    },
    [track],
  );
  // On the sky a second click on the selection clears it; chips and list rows always select.
  const toggle = useCallback(
    (id: string) => (selectedId === id ? deselect('toggle') : select(id)),
    [selectedId, select, deselect],
  );

  const changeView = (next: SkyView) => {
    track('view', next);
    if (next === 'list') {
      setList(true);
      return;
    }
    setList(false);
    setLayout(next);
  };

  const toggleOrbit = () => {
    if (view === 'orbit') return changeView('sky');
    if (selectedId && nodeKind(scene, selectedId) === 'concept') setOrbitCenter(selectedId);
    changeView('orbit');
  };

  const changeFilter = (next: SkyFilter) => {
    // Sessions are numbered from 1 in the picker ("Session 1"), so the value is that number.
    if (next === 'all') track('filter', 'full_series');
    else track('filter', 'session', next + 1);
    setFilter(next);
  };

  const controls = <SkyControls scene={scene} view={view} filter={filter} onView={changeView} onFilter={changeFilter} />;
  const canvas = (
    <SkyCanvas
      scene={scene}
      positions={positions}
      targetPositions={targetPositions}
      orbit={layout === 'orbit'}
      filter={filterState}
      hoverId={hoverId}
      selectedId={selectedId}
      onHover={setHoverId}
      onToggle={toggle}
    />
  );
  const listView = <SkyList scene={scene} filter={filter} selectedId={selectedId} onSelect={select} />;
  const panel = (
    <SkyPanel
      scene={scene}
      selectedId={selectedId}
      filter={filterState}
      view={view}
      onSelect={select}
      onClear={() => deselect('panel')}
      onToggleOrbit={toggleOrbit}
      fill={fit}
    />
  );
  const frameSx = {
    borderRadius: `${skyShape.radiusLg}px`,
    border: `1px solid ${cgVar('border')}`,
    overflow: 'hidden',
    bgcolor: cgVar('surfaceSky'),
  };
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && selectedId) deselect('escape');
  };
  // A click on empty sky, or on the card around it, puts the graph back as it was: nothing selected, nothing
  // dimmed. Anything you can act on, the reading panel you may be reading, and the dialogs opened from here
  // (which bubble through React even though they render elsewhere) are left alone.
  const onClick = (e: React.MouseEvent) => {
    if (!selectedId) return;
    if ((e.target as Element).closest(KEEP_SELECTION)) return;
    deselect('empty_sky');
  };
  const skySx = {
    borderRadius: `${skyShape.radiusLg}px`,
    border: `1px solid ${cgVar('border')}`,
    bgcolor: cgVar('surfaceSky'),
    color: cgVar('textBody'),
  };

  // One screen: the sky fills the height it is given, with the artifact's heading, the reading panel and
  // the feedback row stacked in a column beside it, so nothing is below the fold.
  if (fit) {
    return (
      <Box sx={{ height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
        <SkyStyle />
        <SkyViewStyle />
        <Box
          className="concept-sky"
          onKeyDown={onKeyDown}
          onClick={onClick}
          sx={{
            ...skySx,
            flex: 1,
            minHeight: 0,
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) clamp(340px, 30vw, 600px)',
            gap: 2,
            p: 1.5,
          }}
        >
          <Box sx={{ minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
            {controls}
            <Box
              sx={{
                flex: 1,
                minHeight: 0,
                containerType: 'size',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {view === 'list' ? (
                <Box sx={{ width: '100%', height: '100%', overflowY: 'auto' }}>{listView}</Box>
              ) : (
                // As large as fits both ways, at the canvas's own proportions, so the hover card stays on its star.
                <Box
                  sx={{
                    ...frameSx,
                    boxSizing: 'border-box',
                    width: `min(100cqw, calc(100cqh * ${SKY_RATIO}))`,
                    aspectRatio: SKY_ASPECT,
                  }}
                >
                  {canvas}
                </Box>
              )}
            </Box>
          </Box>
          <Box sx={{ minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {header}
            {panel}
            {/* The key lives in the reading column, which has room to spare, so the sky gets the full height. */}
            {view !== 'list' && <SkyLegend scene={scene} />}
          </Box>
        </Box>
        <GraphFeedback compact conversationId={conversationId} />
      </Box>
    );
  }

  return (
    <Box>
      <SkyStyle />
      <SkyViewStyle />
      {header && <Box sx={{ mb: 1.5 }}>{header}</Box>}
      <Box
        className="concept-sky"
        onKeyDown={onKeyDown}
        onClick={onClick}
        sx={{ ...skySx, display: 'flex', flexDirection: 'column', gap: 2, p: { xs: 1.5, sm: 2.5 } }}
      >
        {controls}
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'stretch' }}>
          <Box sx={{ flex: '999 1 600px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {view === 'list' ? (
              listView
            ) : (
              <>
                <Box sx={frameSx}>{canvas}</Box>
                <SkyLegend scene={scene} />
              </>
            )}
          </Box>
          {panel}
        </Box>
      </Box>
      <GraphFeedback conversationId={conversationId} />
    </Box>
  );
};
