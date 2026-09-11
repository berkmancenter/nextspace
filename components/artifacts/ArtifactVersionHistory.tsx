import { useEffect, useState } from 'react';
import { Alert, Box, Button, CircularProgress, List, ListItemButton, Typography } from '@mui/material';
import { fetchArtifactVersion, listArtifactVersions } from '../../utils';
import { Artifact, ArtifactVersion } from '../../types.internal';

/**
 * Props for ArtifactVersionHistory.
 * @property artifact - The artifact whose history to list.
 * @property artifactPasscode - The container's read passcode, if the reader is going on one.
 * @property viewingVersionNumber - Which version the panel beside this one is showing, so the list can mark it.
 * @property onSelectVersion - Called with the chosen version; the caller renders it.
 */
interface ArtifactVersionHistoryProps {
  artifact: Artifact;
  artifactPasscode?: string;
  viewingVersionNumber?: number;
  onSelectVersion: (version: ArtifactVersion) => void;
}

const PAGE_SIZE = 20;

/** A date and time short enough for a list row. */
export function formatStamp(isoString?: string): string {
  if (!isoString) return '';
  const stamp = new Date(isoString);
  return `${stamp.toLocaleDateString([], { month: 'short', day: 'numeric' })}, ${stamp.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  })}`;
}

/**
 * An artifact's saved revisions, newest first. Nothing is ever overwritten, so this is the
 * whole record of how the artifact got to where it is.
 *
 * Version numbers are strictly increasing but not contiguous — a failed append burns one —
 * so they are shown as identifiers rather than counted, and the list's length is what says
 * how many revisions there are.
 */
export const ArtifactVersionHistory = ({
  artifact,
  artifactPasscode,
  viewingVersionNumber,
  onSelectVersion,
}: ArtifactVersionHistoryProps) => {
  const [versions, setVersions] = useState<ArtifactVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Re-read from page one whenever the artifact changes or gains a version, so a revision
  // that arrives over the socket shows up in the history too.
  useEffect(() => {
    setVersions([]);
    setPage(1);
  }, [artifact.id, artifact.currentVersionNumber]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const result = await listArtifactVersions(artifact.id, artifactPasscode, { page, limit: PAGE_SIZE });
        if (cancelled) return;
        setVersions((prev) => (page === 1 ? result.results : [...prev, ...result.results]));
        setTotalPages(result.totalPages);
        setError(null);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load this artifact’s history.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [artifact.id, artifact.currentVersionNumber, artifactPasscode, page]);

  const handleSelect = async (version: ArtifactVersion) => {
    // The listing populates payloads, so the version in hand is usually enough to render.
    // Falling back to the numbered-version endpoint keeps this working if a future listing
    // returns metadata only.
    if (version.payload) {
      onSelectVersion(version);
      return;
    }
    try {
      onSelectVersion(await fetchArtifactVersion(artifact.id, version.versionNumber, artifactPasscode));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load that version.');
    }
  };

  return (
    <Box sx={{ borderTop: '1px solid #E2E8F0', mt: 2, pt: 1.5 }}>
      <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
        History
      </Typography>

      {error && (
        <Alert severity="warning" sx={{ mb: 1 }}>
          {error}
        </Alert>
      )}

      {loading && versions.length === 0 ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
          <CircularProgress size={20} />
        </Box>
      ) : (
        <List dense disablePadding>
          {versions.map((version) => {
            const isCurrent = version.versionNumber === artifact.currentVersionNumber;
            const isViewing = version.versionNumber === (viewingVersionNumber ?? artifact.currentVersionNumber);
            return (
              <ListItemButton
                key={version.id ?? version.versionNumber}
                selected={isViewing}
                onClick={() => handleSelect(version)}
                sx={{ borderRadius: 1, alignItems: 'flex-start', flexDirection: 'column', gap: 0.25 }}
              >
                <Typography variant="body2" sx={{ fontWeight: isViewing ? 600 : 400 }}>
                  Version {version.versionNumber}
                  {isCurrent && ' · latest'}
                </Typography>
                {version.note && (
                  <Typography variant="caption" color="text.secondary">
                    {version.note}
                  </Typography>
                )}
                <Typography variant="caption" color="text.secondary">
                  {formatStamp(version.createdAt)}
                </Typography>
              </ListItemButton>
            );
          })}
        </List>
      )}

      {page < totalPages && (
        <Button size="small" onClick={() => setPage((p) => p + 1)} disabled={loading} sx={{ mt: 0.5 }}>
          {loading ? 'Loading…' : 'Show earlier versions'}
        </Button>
      )}
    </Box>
  );
};
