import { useState } from 'react';
import { Alert, Box, Button, CircularProgress } from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import { generateConceptGraph } from '../../utils';
import { ConceptGraphGenerationResult } from '../../types.internal';

/**
 * Props for GenerateGraphButton.
 * @property conversationId - The finished conversation to map.
 * @property hasExistingGraph - Whether this conversation already has a graph, which changes what the action is called.
 * @property onGenerated - Called with the result of a run that wrote something, so the caller can pick the artifact up.
 */
interface GenerateGraphButtonProps {
  conversationId: string;
  hasExistingGraph?: boolean;
  onGenerated: (result: ConceptGraphGenerationResult) => void;
}

/** Reads the removal counts back as a sentence, or returns null when nothing was removed. */
function describeReport(report: ConceptGraphGenerationResult['report']): string | null {
  if (!report) return null;
  const parts = [
    report.mergedConcepts ? `${report.mergedConcepts} concept(s) merged` : null,
    report.droppedConcepts ? `${report.droppedConcepts} concept(s) dropped` : null,
    report.droppedContributions ? `${report.droppedContributions} contribution(s) dropped` : null,
    report.droppedStatements ? `${report.droppedStatements} statement(s) removed` : null,
    report.droppedOriginPrompts ? `${report.droppedOriginPrompts} prompt(s) dropped` : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : null;
}

/**
 * The organizer's trigger for building a concept graph out of a finished event.
 *
 * Shown to administrators only — the endpoint refuses anyone else, and this is the
 * affordance, not the enforcement. Re-running is the supported way to redo a poor
 * extraction: it appends a version rather than overwriting, so both attempts stay readable,
 * which is why the button stays available once a graph exists.
 */
export const GenerateGraphButton = ({ conversationId, hasExistingGraph, onGenerated }: GenerateGraphButtonProps) => {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<ConceptGraphGenerationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setRunning(true);
    setResult(null);
    setError(null);
    try {
      const generation = await generateConceptGraph(conversationId);
      setResult(generation);
      if (generation.generated) onGenerated(generation);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not generate a concept graph.');
    } finally {
      setRunning(false);
    }
  };

  const removed = result?.generated ? describeReport(result.report) : null;

  return (
    <Box sx={{ mt: 2 }}>
      <Button
        size="small"
        variant="outlined"
        onClick={run}
        disabled={running}
        startIcon={running ? <CircularProgress size={14} /> : <AutoAwesomeIcon />}
      >
        {running ? 'Reading the event…' : hasExistingGraph ? 'Regenerate concept graph' : 'Generate concept graph'}
      </Button>

      {error && (
        <Alert severity="error" sx={{ mt: 1 }}>
          {error}
        </Alert>
      )}

      {/* A run that mapped nothing is a result, not a failure — the event record can simply
          be too thin, or nothing in it can survive the Chatham House checks. */}
      {result && !result.generated && (
        <Alert severity="info" sx={{ mt: 1 }}>
          Nothing was written. {result.reason ?? 'There was too little of the event record to map.'}
        </Alert>
      )}

      {result?.generated && (
        <Alert severity="success" sx={{ mt: 1 }}>
          Wrote version {result.version?.versionNumber}
          {removed ? ` · ${removed}` : ''}
        </Alert>
      )}
    </Box>
  );
};
