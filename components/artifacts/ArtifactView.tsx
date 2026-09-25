import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { Alert, Box, Button, Chip, Dialog, DialogContent, DialogTitle, Typography } from '@mui/material';
import HistoryIcon from '@mui/icons-material/History';
import { ArtifactVersionHistory, formatStamp } from './ArtifactVersionHistory';
import { DocumentArtifactView } from './DocumentArtifactView';
import { trackArtifactEvent } from '../../utils/artifactAnalytics';
import { Artifact, ArtifactVersion, ConceptGraphPayload, DocumentPayload } from '../../types.internal';

/* The graph renderer pulls in d3's force, zoom and scale modules and measures the DOM to
   lay itself out, so it is loaded on demand and never on the server. A conversation whose
   only artifact is a document never downloads any of it. */
const ConceptGraphView = dynamic(() => import('./ConceptGraphView').then((m) => m.ConceptGraphView), {
  ssr: false,
  loading: () => (
    <Typography variant="body2" color="text.secondary">
      Loading graph…
    </Typography>
  ),
});

/**
 * Props for ArtifactView.
 * @property artifact - The artifact to show, at its latest version.
 * @property artifactPasscode - The container's read passcode, threaded through to the history calls.
 * @property conversationId - The conversation the artifact belongs to, for analytics attribution. Absent on a series.
 * @property isLive - True when a new version of this artifact arrived over the socket during this visit.
 */
interface ArtifactViewProps {
  artifact: Artifact;
  artifactPasscode?: string;
  conversationId?: string;
  isLive?: boolean;
}

const TYPE_LABEL: Record<string, string> = {
  DocumentArtifact: 'Document',
  ConceptGraphArtifact: 'Concept graph',
};

/**
 * One artifact: its heading, the version being shown, and whichever renderer its `type`
 * calls for.
 *
 * A new version can arrive over the socket at any moment. When the reader is looking at the
 * latest version they simply see the new one; when they have stepped back into the history
 * the view stays where they put it and the arrival is offered as a link rather than taken.
 */
export const ArtifactView = ({ artifact, artifactPasscode, conversationId, isLive }: ArtifactViewProps) => {
  const [viewingVersion, setViewingVersion] = useState<ArtifactVersion | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  // Stepping to another artifact drops any historical version being viewed with it.
  useEffect(() => {
    setViewingVersion(null);
  }, [artifact.id]);

  const version = viewingVersion ?? artifact.currentVersion;
  const isHistorical = !!viewingVersion && viewingVersion.versionNumber !== artifact.currentVersionNumber;

  const track = (action: string, name: string, value?: number) =>
    trackArtifactEvent(conversationId, 'artifact', action, name, value);
  const openHistory = () => {
    setShowHistory(true);
    track('history_open', artifact.type);
  };
  const closeHistory = () => {
    setShowHistory(false);
    track('history_close', artifact.type);
  };
  // Version numbers are the artifact's own counter, not anything a reader typed.
  const showLatest = () => {
    setViewingVersion(null);
    track('version_select', 'latest', artifact.currentVersionNumber);
  };

  const historyPanel = (
    <ArtifactVersionHistory
      artifact={artifact}
      artifactPasscode={artifactPasscode}
      viewingVersionNumber={viewingVersion?.versionNumber}
      onSelectVersion={(selected) => {
        const isCurrent = selected.versionNumber === artifact.currentVersionNumber;
        setViewingVersion(isCurrent ? null : selected);
        track('version_select', isCurrent ? 'latest' : 'earlier', selected.versionNumber);
      }}
    />
  );

  // A concept graph fills the window, so its heading is folded into the reading column beside the sky and the
  // history opens over it. Colours are inherited: the heading sits on the dark sky or, on a narrow screen, above it.
  if (artifact.type === 'ConceptGraphArtifact' && version) {
    return (
      <Box sx={{ minWidth: 0, height: '100%', minHeight: 0 }}>
        <ConceptGraphView
          payload={version.payload as ConceptGraphPayload}
          conversationId={conversationId}
          header={
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, color: 'inherit' }}>
              <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, flexWrap: 'wrap' }}>
                <Typography variant="subtitle1" component="h1" sx={{ fontWeight: 600, lineHeight: 1.25 }}>
                  {artifact.title}
                </Typography>
                {isLive && !isHistorical && (
                  <Chip size="small" variant="outlined" label="updated just now" sx={{ color: 'inherit' }} />
                )}
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                <Typography variant="caption" sx={{ opacity: 0.75 }}>
                  Version {version.versionNumber ?? artifact.currentVersionNumber}
                  {version.createdAt ? ` · ${formatStamp(version.createdAt)}` : ''}
                </Typography>
                <Button
                  size="small"
                  color="inherit"
                  startIcon={<HistoryIcon />}
                  onClick={openHistory}
                  sx={{ minWidth: 0, py: 0, textTransform: 'none' }}
                >
                  History
                </Button>
              </Box>
              {version.note && (
                <Typography
                  variant="caption"
                  title={version.note}
                  sx={{
                    opacity: 0.75,
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                >
                  {version.note}
                </Typography>
              )}
              {isHistorical && (
                <Alert
                  severity="info"
                  sx={{ py: 0 }}
                  action={
                    <Button size="small" onClick={showLatest}>
                      Latest
                    </Button>
                  }
                >
                  Showing version {viewingVersion!.versionNumber}. Version {artifact.currentVersionNumber} is current.
                </Alert>
              )}
            </Box>
          }
        />
        <Dialog open={showHistory} onClose={closeHistory} fullWidth maxWidth="sm" scroll="paper">
          <DialogTitle>Version history</DialogTitle>
          <DialogContent>{historyPanel}</DialogContent>
        </Dialog>
      </Box>
    );
  }

  return (
    <Box sx={{ minWidth: 0 }}>
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, flexWrap: 'wrap' }}>
        <Typography variant="h6" component="h1" sx={{ fontWeight: 600 }}>
          {artifact.title}
        </Typography>
        <Chip size="small" variant="outlined" label={TYPE_LABEL[artifact.type] ?? artifact.type} />
        {artifact.locked && <Chip size="small" variant="outlined" label="locked" />}
        {artifact.generationStatus === 'pending' && (
          <Chip size="small" color="primary" variant="outlined" label="generating…" />
        )}
        {artifact.generationStatus === 'failed' && <Chip size="small" color="error" variant="outlined" label="failed" />}
        {isLive && !isHistorical && <Chip size="small" color="primary" variant="outlined" label="updated just now" />}
      </Box>

      {artifact.description && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          {artifact.description}
        </Typography>
      )}

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap', mt: 1, mb: 1.5 }}>
        <Typography variant="caption" color="text.secondary">
          Version {version?.versionNumber ?? artifact.currentVersionNumber}
          {version?.createdAt ? ` · ${formatStamp(version.createdAt)}` : ''}
          {version?.note ? ` · ${version.note}` : ''}
        </Typography>
        <Button
          size="small"
          startIcon={<HistoryIcon />}
          onClick={showHistory ? closeHistory : openHistory}
          aria-expanded={showHistory}
        >
          {showHistory ? 'Hide history' : 'History'}
        </Button>
      </Box>

      {isHistorical && (
        <Alert
          severity="info"
          sx={{ mb: 1.5 }}
          action={
            <Button size="small" onClick={showLatest}>
              Latest
            </Button>
          }
        >
          Showing version {viewingVersion!.versionNumber}. Version {artifact.currentVersionNumber} is the current one.
        </Alert>
      )}

      {!version ? (
        artifact.generationStatus === 'pending' ? (
          <Alert severity="info">Generating…</Alert>
        ) : artifact.generationStatus === 'failed' ? (
          <Alert severity="warning">{artifact.generationError ?? 'Generation failed to produce a version.'}</Alert>
        ) : (
          <Alert severity="warning">This artifact has no readable version yet.</Alert>
        )
      ) : artifact.type === 'DocumentArtifact' ? (
        <DocumentArtifactView payload={version.payload as DocumentPayload} />
      ) : (
        /* A type this build has no renderer for. Showing the payload beats showing nothing,
           and makes it obvious what arrived. */
        <Box>
          <Alert severity="info" sx={{ mb: 1 }}>
            This artifact is a {artifact.type}, which this app has no renderer for yet.
          </Alert>
          <Box
            component="pre"
            sx={{ p: 2, bgcolor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 1, overflowX: 'auto', fontSize: 12 }}
          >
            {JSON.stringify(version.payload, null, 2)}
          </Box>
        </Box>
      )}

      {showHistory && historyPanel}
    </Box>
  );
};
