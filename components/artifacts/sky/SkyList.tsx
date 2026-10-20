import { Box } from '@mui/material';
import { SkyFilter, listEntries } from '../../../utils/conceptSky';
import { SkyScene, sessionName } from './scene';
import { eyebrowSx } from './styles';
import { cgVar, skyShape } from './tokens';

interface SkyListProps {
  scene: SkyScene;
  filter: SkyFilter;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

const nameButtonSx = {
  minHeight: skyShape.targetMin,
  p: 0,
  bgcolor: 'transparent',
  border: 0,
  cursor: 'pointer',
  textAlign: 'left' as const,
  color: cgVar('textPrimary'),
  font: '400 19px/1.3 var(--cg-font-serif)',
  '&[aria-pressed="true"]': { color: cgVar('accent') },
};

const metaSx = { ...eyebrowSx, color: cgVar('textSecondary'), letterSpacing: '0.08em' };

/**
 * Every concept, most connected first, with what it connects to; then every origin prompt.
 * This is the complete equivalent of the sky for keyboard and screen-reader readers, not a
 * fallback, so it lists the same things the sky draws and each is a button that opens the
 * reading panel. Contributions are reached from their concepts' panels, as on the sky.
 */
export function SkyList({ scene, filter, selectedId, onSelect }: SkyListProps) {
  const entries = listEntries(scene.model, filter);
  const prompts = [...scene.prompts.values()];
  return (
    <Box
      sx={{
        p: 3,
        borderRadius: `${skyShape.radiusLg}px`,
        border: `1px solid ${cgVar('border')}`,
        bgcolor: cgVar('surfacePanel'),
        overflowWrap: 'anywhere',
      }}
    >
      <Box
        component="h2"
        sx={{ m: 0, mb: 2, fontFamily: 'var(--cg-font-serif)', fontWeight: 400, fontSize: 26, color: cgVar('textPrimary') }}
      >
        All concepts, most connected first
      </Box>
      {entries.length === 0 ? (
        <Box component="p" sx={{ m: 0, color: cgVar('textSecondary') }}>
          Nothing here yet.
        </Box>
      ) : (
        <Box component="ol" sx={{ m: 0, p: 0, listStyle: 'none' }}>
          {entries.map((entry) => {
            const sessions = scene.conceptSessions.get(entry.id) ?? [];
            return (
              <Box
                component="li"
                key={entry.id}
                sx={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'baseline',
                  gap: '4px 12px',
                  py: 1.5,
                  borderTop: `1px solid ${cgVar('divider')}`,
                }}
              >
                <Box
                  component="button"
                  type="button"
                  aria-pressed={selectedId === entry.id}
                  sx={nameButtonSx}
                  onClick={() => onSelect(entry.id)}
                >
                  {entry.label}
                </Box>
                <Box component="span" sx={metaSx}>
                  {entry.degree} {entry.degree === 1 ? 'connection' : 'connections'} · {entry.contributionCount}{' '}
                  {entry.contributionCount === 1 ? 'contribution' : 'contributions'}
                  {sessions.length > 0 && ` · ${sessions.map((i) => sessionName(i)).join(', ')}`}
                </Box>
                {entry.connections.length > 0 && (
                  <Box
                    component="p"
                    sx={{ flexBasis: '100%', m: 0, fontSize: 13, lineHeight: 1.5, color: cgVar('textBody') }}
                  >
                    Connects to {entry.connections.map((c) => c.label).join(', ')}
                  </Box>
                )}
              </Box>
            );
          })}
        </Box>
      )}

      {prompts.length > 0 && (
        <>
          <Box
            component="h2"
            sx={{
              m: 0,
              mt: 3,
              mb: 1,
              fontFamily: 'var(--cg-font-serif)',
              fontWeight: 400,
              fontSize: 26,
              color: cgVar('textPrimary'),
            }}
          >
            Origin prompts
          </Box>
          <Box component="ul" sx={{ m: 0, p: 0, listStyle: 'none' }}>
            {prompts.map((prompt) => (
              <Box component="li" key={prompt.id} sx={{ py: 0.5, borderTop: `1px solid ${cgVar('divider')}` }}>
                <Box
                  component="button"
                  type="button"
                  aria-pressed={selectedId === prompt.id}
                  sx={{ ...nameButtonSx, fontSize: 17 }}
                  onClick={() => onSelect(prompt.id)}
                >
                  {prompt.text}
                </Box>
              </Box>
            ))}
          </Box>
        </>
      )}
    </Box>
  );
}
