import { Alert, Box, Button, CircularProgress, Divider, Typography } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import type { Socket } from 'socket.io-client';
import { ArtifactList } from './ArtifactList';
import { ArtifactPasscodePrompt } from './ArtifactPasscodePrompt';
import { ArtifactShareLink } from './ArtifactShareLink';
import { ArtifactView } from './ArtifactView';
import { GenerateGraphButton } from './GenerateGraphButton';
import { useArtifacts } from '../../hooks/useArtifacts';
import { Artifact, ArtifactContainer, AuthType } from '../../types.internal';

/**
 * Props for ArtifactsBrowser.
 * @property container - Which conversation's or topic's artifacts to read. Null until the route is ready.
 * @property artifactPasscode - The container's read passcode, when the reader is going on one.
 * @property authType - Decides whether the organizer's generate action is offered at all; the endpoint does the enforcing.
 * @property socket - A connected socket for live revisions. A topic has no room to join, so it passes none.
 * @property selectedArtifactId - Which artifact to open; falls back to the first.
 * @property onSelectArtifact - Called when the reader opens another artifact.
 * @property onPasscodeSubmit - Called with a passcode typed into the prompt.
 * @property emptyMessage - What to say when the container has published nothing.
 */
interface ArtifactsBrowserProps {
  container: ArtifactContainer | null;
  artifactPasscode?: string;
  authType: AuthType;
  socket?: Socket | null;
  selectedArtifactId?: string;
  onSelectArtifact: (artifactId: string) => void;
  onPasscodeSubmit: (passcode: string) => void;
  emptyMessage: string;
}

/**
 * The artifacts of one container: a rail of what it holds beside whichever one is open.
 *
 * Both routes render this — a conversation's artifacts and a topic's differ in where they are
 * read from and whether anything arrives live, not in how they are read — so the two pages
 * stay a route and a container each rather than two copies of a browser that drift apart.
 *
 * A topic is refreshed by hand because topic-scoped artifacts are not broadcast: there is no
 * topic-wide socket room, so a series graph changes only when an event ends and nothing tells
 * this page about it.
 */
export const ArtifactsBrowser = ({
  container,
  artifactPasscode,
  authType,
  socket,
  selectedArtifactId,
  onSelectArtifact,
  onPasscodeSubmit,
  emptyMessage,
}: ArtifactsBrowserProps) => {
  const { artifacts, loading, error, needsPasscode, liveArtifactIds, reload } = useArtifacts({
    container,
    artifactPasscode,
    socket,
  });

  const selected: Artifact | undefined = artifacts.find((artifact) => artifact.id === selectedArtifactId) ?? artifacts[0];
  const isTopic = !!container?.topicId;
  // An admin's topic listing also holds the topic's conversation graphs, which are not the
  // series graph; only a graph scoped like the container counts as already existing here.
  const containerScope = isTopic ? 'topic' : 'conversation';
  const hasGraphForContainer = artifacts.some(
    (artifact) => artifact.type === 'ConceptGraphArtifact' && artifact.scope === containerScope,
  );

  if (needsPasscode) {
    return (
      <ArtifactPasscodePrompt onSubmit={onPasscodeSubmit} retrying={loading} rejected={!!artifactPasscode && !loading} />
    );
  }

  if (loading && artifacts.length === 0 && !error) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 1180, mx: 'auto', px: { xs: 2, sm: 3 }, py: { xs: 2, sm: 4 } }}>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '240px minmax(0, 1fr)' },
          gap: { xs: 2, md: 4 },
          alignItems: 'start',
        }}
      >
        <Box component="nav" aria-label="Artifacts" sx={{ minWidth: 0 }}>
          <Typography
            variant="overline"
            sx={{ color: 'text.secondary', letterSpacing: '0.08em', display: 'block', mb: 0.5 }}
          >
            Artifacts
          </Typography>
          <Divider sx={{ mb: 1 }} />
          <ArtifactList
            artifacts={artifacts}
            selectedId={selected?.id}
            liveArtifactIds={liveArtifactIds}
            onSelect={onSelectArtifact}
          />

          {/* A conversation's artifacts arrive over the socket; a topic's have no room to
              arrive in, so refreshing one is the reader's job rather than ours. */}
          {isTopic && (
            <Button size="small" startIcon={<RefreshIcon />} onClick={reload} disabled={loading} sx={{ mt: 1 }}>
              {loading ? 'Refreshing…' : 'Refresh'}
            </Button>
          )}

          {/* Minting the share link and generating a graph are the organizer's actions
              rather than a reader's: the passcode route and the generate route both refuse
              anyone but an admin, so this only decides whether to offer them. */}
          {authType === 'admin' && container && <ArtifactShareLink container={container} selectedArtifact={selected} />}
          {authType === 'admin' && container && (
            <GenerateGraphButton
              container={container}
              hasExistingGraph={hasGraphForContainer}
              onGenerated={(result) => {
                reload();
                if (result.artifact?.id) onSelectArtifact(result.artifact.id);
              }}
            />
          )}
        </Box>

        {selected ? (
          <ArtifactView artifact={selected} artifactPasscode={artifactPasscode} isLive={liveArtifactIds.has(selected.id)} />
        ) : (
          <Typography variant="body2" color="text.secondary">
            {emptyMessage}
          </Typography>
        )}
      </Box>
    </Box>
  );
};
