import { useEffect, useRef } from 'react';
import { Alert, Box, CircularProgress, Divider, Typography } from '@mui/material';
import type { Socket } from 'socket.io-client';
import { ArtifactList } from './ArtifactList';
import { ArtifactPasscodePrompt } from './ArtifactPasscodePrompt';
import { ArtifactShareLink } from './ArtifactShareLink';
import { ArtifactView } from './ArtifactView';
import { GenerateGraphButton } from './GenerateGraphButton';
import { useArtifacts } from '../../hooks/useArtifacts';
import { trackArtifactEvent } from '../../utils/artifactAnalytics';
import { Artifact, ArtifactContainer, AuthType } from '../../types.internal';

/** The page's own header (the navigation bar) and footer, which the graph's one-screen layout sits between. */
const PAGE_CHROME_PX = 64 + 72;

/**
 * Props for ArtifactsBrowser.
 * @property container - Which conversation's or topic's artifacts to read. Null until the route is ready.
 * @property artifactPasscode - The container's read passcode, when the reader is going on one.
 * @property authType - Decides whether the organizer's generate action is offered at all; the endpoint does the enforcing.
 * @property socket - A connected socket for live revisions, joined to the container's own room.
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
 * Both routes render this — a conversation's artifacts and a topic's differ only in which
 * room the socket joins, not in how they are read or updated — so the two pages stay a route
 * and a container each rather than two copies of a browser that drift apart.
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

  /* A passcode typed into the prompt is judged by the read it triggers: refused again means failure. Only the
     outcome is tracked, never the passcode. `sawLoading` waits for that read to actually start, so the stale
     not-loading render that follows the submit is not mistaken for its result. */
  const pendingPasscode = useRef<{ sawLoading: boolean } | null>(null);
  useEffect(() => {
    const pending = pendingPasscode.current;
    if (!pending) return;
    if (loading) {
      pending.sawLoading = true;
      return;
    }
    if (!pending.sawLoading) return;
    pendingPasscode.current = null;
    trackArtifactEvent(
      container?.conversationId,
      'artifact',
      'passcode_submit',
      needsPasscode || error ? 'failure' : 'success',
    );
  }, [loading, needsPasscode, error, container?.conversationId]);

  const handlePasscodeSubmit = (passcode: string) => {
    if (passcode === artifactPasscode) {
      // Nothing will be re-read for the same passcode, and it is the one that was just refused.
      trackArtifactEvent(container?.conversationId, 'artifact', 'passcode_submit', 'failure');
    } else {
      pendingPasscode.current = { sawLoading: false };
    }
    onPasscodeSubmit(passcode);
  };

  const selected: Artifact | undefined = artifacts.find((artifact) => artifact.id === selectedArtifactId) ?? artifacts[0];
  const isTopic = !!container?.topicId;
  // An admin's topic listing also holds the topic's conversation graphs, which are not the
  // series graph; only a graph scoped like the container counts as already existing here.
  const containerScope = isTopic ? 'topic' : 'conversation';
  const isGraph = selected?.type === 'ConceptGraphArtifact';
  const conceptGraphArtifact = artifacts.find(
    (artifact) => artifact.type === 'ConceptGraphArtifact' && artifact.scope === containerScope,
  );

  if (needsPasscode) {
    return (
      <ArtifactPasscodePrompt onSubmit={handlePasscodeSubmit} retrying={loading} rejected={!!artifactPasscode && !loading} />
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
    // A graph is a picture rather than prose, so it gets the whole window, exactly one screen tall (below the
    // page's own header and footer); documents keep a readable measure and scroll.
    <Box
      sx={{
        maxWidth: isGraph ? 'none' : 1180,
        mx: 'auto',
        px: { xs: 2, sm: 3 },
        py: { xs: 2, sm: 4 },
        ...(isGraph && {
          boxSizing: 'border-box',
          height: { md: `calc(100dvh - ${PAGE_CHROME_PX}px)` },
          display: { md: 'flex' },
          flexDirection: 'column',
          py: { xs: 2, md: 1.5 },
        }),
      }}
    >
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '240px minmax(0, 1fr)' },
          gap: { xs: 2, md: isGraph ? 2 : 4 },
          alignItems: { xs: 'start', md: isGraph ? 'stretch' : 'start' },
          ...(isGraph && { flex: { md: 1 }, minHeight: 0, '& > *': { minHeight: 0 } }),
        }}
      >
        <Box component="nav" aria-label="Artifacts" sx={{ minWidth: 0, ...(isGraph && { overflowY: { md: 'auto' } }) }}>
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

          {/* Minting the share link and generating a graph are the organizer's actions
              rather than a reader's: the passcode route and the generate route both refuse
              anyone but an admin, so this only decides whether to offer them. */}
          {authType === 'admin' && container && <ArtifactShareLink container={container} selectedArtifact={selected} />}
          {authType === 'admin' && container && (
            <GenerateGraphButton
              container={container}
              artifact={conceptGraphArtifact}
              onGenerated={(result) => {
                reload();
                if (result.artifact?.id) onSelectArtifact(result.artifact.id);
              }}
            />
          )}
        </Box>

        {selected ? (
          <ArtifactView
            artifact={selected}
            artifactPasscode={artifactPasscode}
            conversationId={container?.conversationId}
            isLive={liveArtifactIds.has(selected.id)}
          />
        ) : (
          <Typography variant="body2" color="text.secondary">
            {emptyMessage}
          </Typography>
        )}
      </Box>
    </Box>
  );
};
