import { useEffect, useState } from 'react';
import { Alert, Box, Button, TextField } from '@mui/material';
import LinkIcon from '@mui/icons-material/Link';
import { fetchArtifactPasscode } from '../../utils';
import { Artifact, ArtifactContainer } from '../../types.internal';

/**
 * Props for ArtifactShareLink.
 * @property container - The conversation or topic the link opens.
 * @property selectedArtifact - The artifact that is open, so the link can land on it.
 */
interface ArtifactShareLinkProps {
  container: ArtifactContainer;
  selectedArtifact?: Artifact;
}

/**
 * Admin-only, because only an admin may fetch the passcode the link carries. The link is
 * shown as well as copied: the clipboard is unavailable on a plain-http origin or when the
 * permission is denied, and the text can still be selected by hand.
 */
export const ArtifactShareLink = ({ container, selectedArtifact }: ArtifactShareLinkProps) => {
  const [passcode, setPasscode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A topic-passcode reader is listed only topic-scoped artifacts, so a link naming one of
  // the conversations' artifacts would silently open something else for them.
  const containerScope = container.topicId ? 'topic' : 'conversation';
  const linkedArtifactId = selectedArtifact?.scope === containerScope ? selectedArtifact.id : undefined;

  const link = passcode ? buildLink(passcode, linkedArtifactId) : null;

  useEffect(() => {
    setCopied(false);
  }, [linkedArtifactId]);

  const build = async () => {
    setWorking(true);
    setError(null);
    setCopied(false);
    try {
      const minted = await fetchArtifactPasscode(container);
      setPasscode(minted);
      try {
        await navigator.clipboard.writeText(buildLink(minted, linkedArtifactId));
        setCopied(true);
      } catch (err) {
        console.warn('Share link built but could not be copied:', err);
      }
    } catch (err) {
      setPasscode(null);
      setError(err instanceof Error ? err.message : 'Could not build a share link.');
    } finally {
      setWorking(false);
    }
  };

  return (
    <Box sx={{ mt: 2 }}>
      <Button size="small" variant="outlined" onClick={build} disabled={working} startIcon={<LinkIcon />}>
        {working ? 'Building link…' : 'Copy share link'}
      </Button>

      {error && (
        <Alert severity="error" sx={{ mt: 1 }}>
          {error}
        </Alert>
      )}

      {link && (
        <TextField
          fullWidth
          size="small"
          value={link}
          helperText={copied ? 'Copied. Anyone with this link can read these artifacts.' : 'Copy this link by hand.'}
          slotProps={{
            input: { readOnly: true },
            htmlInput: {
              'aria-label': 'Share link',
              onFocus: (event: React.FocusEvent<HTMLInputElement>) => event.target.select(),
            },
          }}
          sx={{ mt: 1 }}
        />
      )}
    </Box>
  );
};

/** This page's URL with the passcode, and the open artifact when the reader will be able to see it. */
function buildLink(passcode: string, artifactId?: string): string {
  const url = new URL(window.location.href);
  url.search = '';
  url.searchParams.set('artifactPasscode', passcode);
  if (artifactId) url.searchParams.set('artifact', artifactId);
  return url.toString();
}
