import { Box, List, ListItemButton, Typography } from '@mui/material';
import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import { formatStamp } from './ArtifactVersionHistory';
import { Artifact } from '../../types.internal';

/**
 * Props for ArtifactList.
 * @property artifacts - The container's artifacts, newest first.
 * @property selectedId - Which artifact is open.
 * @property liveArtifactIds - Artifacts that gained a version over the socket during this visit; marked with a dot.
 * @property onSelect - Called with the id of the artifact to open.
 */
interface ArtifactListProps {
  artifacts: Artifact[];
  selectedId?: string;
  liveArtifactIds?: Set<string>;
  onSelect: (artifactId: string) => void;
}

function typeIcon(type: string) {
  return type === 'ConceptGraphArtifact' ? (
    <AccountTreeOutlinedIcon fontSize="small" sx={{ color: '#B45309' }} />
  ) : (
    <DescriptionOutlinedIcon fontSize="small" sx={{ color: '#4845D2' }} />
  );
}

/**
 * The rail of a container's artifacts. Each row carries what the list endpoint already
 * populates — title, kind, current version, and when that version was written — so the
 * whole set renders without a request per artifact.
 */
export const ArtifactList = ({ artifacts, selectedId, liveArtifactIds, onSelect }: ArtifactListProps) => {
  if (artifacts.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ p: 1 }}>
        No artifacts yet.
      </Typography>
    );
  }

  return (
    <List dense disablePadding aria-label="Artifacts">
      {artifacts.map((artifact) => (
        <ListItemButton
          key={artifact.id}
          selected={artifact.id === selectedId}
          onClick={() => onSelect(artifact.id)}
          sx={{ borderRadius: 1, alignItems: 'flex-start', gap: 1, py: 1 }}
        >
          <Box sx={{ mt: 0.25 }}>{typeIcon(artifact.type)}</Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="body2" sx={{ fontWeight: artifact.id === selectedId ? 600 : 400 }}>
              {artifact.title}
              {liveArtifactIds?.has(artifact.id) && (
                <Box
                  component="span"
                  aria-label="updated during this visit"
                  sx={{
                    display: 'inline-block',
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    bgcolor: 'primary.main',
                    ml: 0.75,
                    verticalAlign: 'middle',
                  }}
                />
              )}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              v{artifact.currentVersionNumber}
              {artifact.currentVersion?.createdAt ? ` · ${formatStamp(artifact.currentVersion.createdAt)}` : ''}
            </Typography>
          </Box>
        </ListItemButton>
      ))}
    </List>
  );
};
