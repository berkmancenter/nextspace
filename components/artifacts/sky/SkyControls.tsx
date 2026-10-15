import { Box } from '@mui/material';
import { SkyFilter } from '../../../utils/conceptSky';
import { SkyScene } from './scene';
import { SkyView } from './SkyPanel';
import { cgVar, skyShape } from './tokens';

interface SkyControlsProps {
  scene: SkyScene;
  view: SkyView;
  filter: SkyFilter;
  onView: (view: SkyView) => void;
  onFilter: (filter: SkyFilter) => void;
}

const VIEWS: { id: SkyView; label: string }[] = [
  { id: 'sky', label: 'Sky' },
  { id: 'orbit', label: 'Orbit' },
  { id: 'list', label: 'List' },
];

/**
 * The view switch (Sky, Orbit, List) and the session filter. The filter is hidden unless the
 * graph spans two or more sessions: with one or none there is nothing to filter by, and a
 * dropdown with a single option would only be a control that does nothing.
 */
export function SkyControls({ scene, view, filter, onView, onFilter }: SkyControlsProps) {
  const sessions = Array.from({ length: scene.sessionCount }, (_, i) => i);
  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 1.5 }}>
      <Box role="group" aria-label="View" sx={{ display: 'inline-flex', gap: 0.5 }}>
        {VIEWS.map(({ id, label }) => (
          <Box
            key={id}
            component="button"
            type="button"
            aria-pressed={view === id}
            onClick={() => onView(id)}
            sx={{
              minWidth: skyShape.targetMin,
              minHeight: skyShape.targetMin,
              px: 2,
              border: `1px solid ${cgVar('borderStrong')}`,
              borderRadius: `${skyShape.radiusPill}px`,
              bgcolor: view === id ? cgVar('star') : 'transparent',
              color: view === id ? cgVar('surfaceSky') : cgVar('textPrimary'),
              font: '600 14px var(--cg-font-sans)',
              cursor: 'pointer',
            }}
          >
            {label}
          </Box>
        ))}
      </Box>
      {scene.sessionCount >= 2 && (
        <Box
          component="label"
          sx={{ display: 'inline-flex', alignItems: 'center', gap: 1, fontSize: 13, color: cgVar('textSecondary') }}
        >
          Show
          <Box
            component="select"
            value={String(filter)}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
              onFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))
            }
            sx={{
              minHeight: skyShape.targetMin,
              px: 1.5,
              border: `1px solid ${cgVar('borderStrong')}`,
              borderRadius: `${skyShape.radiusMd}px`,
              bgcolor: cgVar('surfaceControl'),
              color: cgVar('textPrimary'),
              font: '500 14px var(--cg-font-sans)',
            }}
          >
            <option value="all">Full series</option>
            {sessions.map((i) => (
              <option key={i} value={i}>
                {scene.sessionLabels[i]}
              </option>
            ))}
          </Box>
        </Box>
      )}
    </Box>
  );
}
