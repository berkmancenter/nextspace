import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { Alert, Box, Button, Chip, Typography } from '@mui/material';
import HistoryIcon from '@mui/icons-material/History';
import { ArtifactVersionHistory, formatStamp } from './ArtifactVersionHistory';
import { DocumentArtifactView } from './DocumentArtifactView';
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
 * @property isLive - True when a new version of this artifact arrived over the socket during this visit.
 */
interface ArtifactViewProps {
  artifact: Artifact;
  artifactPasscode?: string;
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
export const ArtifactView = ({ artifact, artifactPasscode, isLive }: ArtifactViewProps) => {
  const [viewingVersion, setViewingVersion] = useState<ArtifactVersion | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  // Stepping to another artifact drops any historical version being viewed with it.
  useEffect(() => {
    setViewingVersion(null);
  }, [artifact.id]);

  const version = viewingVersion ?? artifact.currentVersion;
  const isHistorical = !!viewingVersion && viewingVersion.versionNumber !== artifact.currentVersionNumber;

  return (
    <Box sx={{ minWidth: 0 }}>
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, flexWrap: 'wrap' }}>
        <Typography variant="h6" component="h1" sx={{ fontWeight: 600 }}>
          {artifact.title}
        </Typography>
        <Chip size="small" variant="outlined" label={TYPE_LABEL[artifact.type] ?? artifact.type} />
        {artifact.locked && <Chip size="small" variant="outlined" label="locked" />}
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
          onClick={() => setShowHistory((shown) => !shown)}
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
            <Button size="small" onClick={() => setViewingVersion(null)}>
              Latest
            </Button>
          }
        >
          Showing version {viewingVersion!.versionNumber}. Version {artifact.currentVersionNumber} is the current one.
        </Alert>
      )}

      {!version ? (
        <Alert severity="warning">This artifact has no readable version yet.</Alert>
      ) : artifact.type === 'ConceptGraphArtifact' ? (
        <ConceptGraphView payload={version.payload as ConceptGraphPayload} />
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

      {showHistory && (
        <ArtifactVersionHistory
          artifact={artifact}
          artifactPasscode={artifactPasscode}
          viewingVersionNumber={viewingVersion?.versionNumber}
          onSelectVersion={(selected) =>
            setViewingVersion(selected.versionNumber === artifact.currentVersionNumber ? null : selected)
          }
        />
      )}
    </Box>
  );
};
