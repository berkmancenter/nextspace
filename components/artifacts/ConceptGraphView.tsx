import { useCallback, useMemo, useState } from 'react';
import { Box, useMediaQuery } from '@mui/material';
import { ConceptGraphPayload } from '../../types.internal';
import { trackEvent } from '../../utils/analytics';
import { SkyFilter, filterSky, layoutOrbit, layoutSky } from '../../utils/conceptSky';
import { GraphFeedback } from './GraphFeedback';
import { SkyCanvas } from './sky/SkyCanvas';
import { SkyControls } from './sky/SkyControls';
import { SkyLegend } from './sky/SkyLegend';
import { SkyList } from './sky/SkyList';
import { SkyPanel, SkyView } from './sky/SkyPanel';
import SkyStyle from './sky/SkyStyle';
import SkyViewStyle from './sky/SkyViewStyle';
import { buildScene, nodeKind } from './sky/scene';
import { cgVar, skyShape } from './sky/tokens';
import { useTweenedPositions } from './sky/useTweenedPositions';

/**
 * Props for ConceptGraphView.
 * @property payload - The graph to draw. Every array may be empty; an artifact can exist before an event fills it in.
 * @property height - Kept so existing callers still compile. The sky is a fixed-aspect frame that scales to its container's width, so there is no canvas height to set.
 */
interface ConceptGraphViewProps {
  payload: ConceptGraphPayload;
  height?: number;
}

/** Below this width the sky's labels get too small to read, so the list is the default. */
const NARROW_QUERY = '(max-width:599px)';

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
export const ConceptGraphView = ({ payload }: ConceptGraphViewProps) => {
  const scene = useMemo(() => buildScene(payload), [payload]);
  const narrow = useMediaQuery(NARROW_QUERY, { noSsr: true });
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
      if (id) trackEvent('graph', 'select', nodeKind(scene, id) ?? 'unknown');
    },
    [scene],
  );
  // On the sky a second click on the selection clears it; chips and list rows always select.
  const toggle = useCallback((id: string) => (selectedId === id ? setSelected(null) : select(id)), [selectedId, select]);

  const changeView = (next: SkyView) => {
    trackEvent('graph', 'view', next);
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
    trackEvent('graph', 'filter', next === 'all' ? 'full_series' : 'session');
    setFilter(next);
  };

  return (
    <Box>
      <SkyStyle />
      <SkyViewStyle />
      <Box
        className="concept-sky"
        onKeyDown={(e: React.KeyboardEvent) => {
          if (e.key === 'Escape' && selectedId) setSelected(null);
        }}
        sx={{
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          p: { xs: 1.5, sm: 2.5 },
          borderRadius: `${skyShape.radiusLg}px`,
          border: `1px solid ${cgVar('border')}`,
          bgcolor: cgVar('surfaceSky'),
          color: cgVar('textBody'),
        }}
      >
        <SkyControls scene={scene} view={view} filter={filter} onView={changeView} onFilter={changeFilter} />
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'stretch' }}>
          <Box sx={{ flex: '999 1 600px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {view === 'list' ? (
              <SkyList scene={scene} filter={filter} selectedId={selectedId} onSelect={select} />
            ) : (
              <>
                <Box
                  sx={{
                    borderRadius: `${skyShape.radiusLg}px`,
                    border: `1px solid ${cgVar('border')}`,
                    overflow: 'hidden',
                    bgcolor: cgVar('surfaceSky'),
                  }}
                >
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
                </Box>
                <SkyLegend scene={scene} />
              </>
            )}
          </Box>
          <SkyPanel
            scene={scene}
            selectedId={selectedId}
            filter={filterState}
            view={view}
            onSelect={select}
            onClear={() => setSelected(null)}
            onToggleOrbit={toggleOrbit}
          />
        </Box>
      </Box>
      <GraphFeedback />
    </Box>
  );
};
