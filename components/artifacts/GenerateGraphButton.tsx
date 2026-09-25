import { useEffect, useRef, useState } from 'react';
import { Alert, Box, Button, CircularProgress } from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import { generateConceptGraph } from '../../utils';
import { Artifact, ArtifactContainer, ConceptGraphGenerationResult } from '../../types.internal';

/**
 * Props for GenerateGraphButton.
 * @property container - The finished conversation to map, or the topic whose series to fold into one graph.
 * @property artifact - The container's current concept-graph artifact, if one exists yet. Its
 *   `generationStatus` is the live, socket-updated source of truth for whether a run is in
 *   flight — this component does not track that on its own.
 * @property onGenerated - Called once the claim is made, so the caller can pick the (now pending) artifact up.
 */
interface GenerateGraphButtonProps {
  container: ArtifactContainer;
  artifact?: Artifact;
  onGenerated: (result: ConceptGraphGenerationResult) => void;
}

type GraphStatus = 'idle' | 'pending' | 'ready' | 'failed';

/** An artifact predating generationStatus is treated as 'ready' — it only ever existed once a version did. */
function statusOf(artifact: Artifact | undefined): GraphStatus {
  if (!artifact) return 'idle';
  return artifact.generationStatus ?? 'ready';
}

/**
 * The organizer's trigger for building a concept graph out of a finished event, or out of a
 * whole series when it is given a topic.
 *
 * Shown to administrators only — the endpoint refuses anyone else, and this is the
 * affordance, not the enforcement. Re-running is the supported way to redo a poor extraction:
 * it appends a version rather than overwriting, so both attempts stay readable, which is why
 * the button stays available once a graph exists. On a topic it is also how a series that
 * predates the feature gets backfilled.
 *
 * Generation runs in a background job: POST /v1/artifacts/generate only claims the artifact
 * and enqueues the run, so this component's job is to reflect the `artifact` prop's real
 * `generationStatus` (kept live by the parent via useArtifacts' socket listeners), not the
 * POST call's own duration. A completion alert is only shown for a run *this instance*
 * observed go pending → ready/failed, so an admin who merely opens the page to an
 * already-finished graph doesn't see a stale "just wrote a version" banner.
 */
export const GenerateGraphButton = ({ container, artifact, onGenerated }: GenerateGraphButtonProps) => {
  const [submitting, setSubmitting] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [completion, setCompletion] = useState<{ type: 'success' | 'failure'; message: string } | null>(null);

  const status = statusOf(artifact);
  const awaitingResultRef = useRef(false);
  const previousStatusRef = useRef<GraphStatus>(status);

  useEffect(() => {
    const previous = previousStatusRef.current;
    previousStatusRef.current = status;
    if (!awaitingResultRef.current || previous !== 'pending') return;

    if (status === 'ready') {
      awaitingResultRef.current = false;
      setCompletion({ type: 'success', message: `Wrote version ${artifact?.currentVersionNumber ?? ''}` });
    } else if (status === 'failed') {
      awaitingResultRef.current = false;
      setCompletion({
        type: 'failure',
        message: `Generation didn't produce a new version. ${artifact?.generationError ?? 'There was too little of the event record to map.'}`,
      });
    }
  }, [status, artifact]);

  const run = async () => {
    setSubmitting(true);
    setRequestError(null);
    setCompletion(null);
    awaitingResultRef.current = true;
    try {
      const generation = await generateConceptGraph(container);
      onGenerated(generation);
    } catch (err) {
      awaitingResultRef.current = false;
      setRequestError(err instanceof Error ? err.message : 'Could not generate a concept graph.');
    } finally {
      setSubmitting(false);
    }
  };

  const busy = submitting || status === 'pending';

  return (
    <Box sx={{ mt: 2 }}>
      <Button
        size="small"
        variant="outlined"
        onClick={run}
        disabled={busy}
        startIcon={busy ? <CircularProgress size={14} /> : <AutoAwesomeIcon />}
      >
        {busy
          ? container.topicId
            ? 'Reading the series…'
            : 'Reading the event…'
          : status === 'idle'
            ? container.topicId
              ? 'Generate series graph'
              : 'Generate concept graph'
            : 'Regenerate concept graph'}
      </Button>

      {requestError && (
        <Alert severity="error" sx={{ mt: 1 }}>
          {requestError}
        </Alert>
      )}

      {completion?.type === 'success' && (
        <Alert severity="success" sx={{ mt: 1 }}>
          {completion.message}
        </Alert>
      )}

      {completion?.type === 'failure' && (
        <Alert severity="info" sx={{ mt: 1 }}>
          {completion.message}
        </Alert>
      )}
    </Box>
  );
};
