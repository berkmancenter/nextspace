import { useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { Alert, Box, CircularProgress, Divider, Typography } from '@mui/material';
import { ArtifactList, ArtifactPasscodePrompt, ArtifactView, GenerateGraphButton } from '../../components';
import { useArtifacts, useSessionJoin } from '../../hooks';
import { CheckAuthHeader } from '../../utils';
import { ArtifactContainer, AuthType } from '../../types.internal';

export const getServerSideProps = async (context: { req: any }) => {
  return CheckAuthHeader(context.req.headers);
};

/**
 * A conversation's artifacts: the shared objects that came out of it.
 *
 * The page is built to be reached by a link rather than by navigating the app — the
 * passcode rides in the URL as `artifactPasscode`, which is what lets someone who never
 * signed in deliberately open what an event produced. An owner or admin needs no passcode
 * at all, so the first read is attempted without one and the passcode prompt appears only
 * if that read is refused.
 *
 * Which artifact is open is in the URL too, so a link can point at one artifact rather than
 * at the set.
 *
 * A topic's artifacts use the same components and hook with a `topicId` container; only a
 * page to host them is missing. They are not broadcast — there is no topic-wide room — so
 * that page would be this one without the socket.
 */
export default function ArtifactsPage({ authType }: { authType: AuthType }) {
  const router = useRouter();
  const conversationId = typeof router.query.conversationId === 'string' ? router.query.conversationId : undefined;
  const passcodeFromUrl = typeof router.query.artifactPasscode === 'string' ? router.query.artifactPasscode : undefined;
  const selectedFromUrl = typeof router.query.artifact === 'string' ? router.query.artifact : undefined;

  // A passcode typed into the prompt is applied immediately and written to the URL, so the
  // reader can bookmark or re-share what they just opened.
  const [submittedPasscode, setSubmittedPasscode] = useState<string | undefined>();
  const artifactPasscode = passcodeFromUrl ?? submittedPasscode;

  const { socket } = useSessionJoin(true);

  const container = useMemo<ArtifactContainer | null>(() => (conversationId ? { conversationId } : null), [conversationId]);

  const { artifacts, loading, error, needsPasscode, liveArtifactIds, reload } = useArtifacts({
    container,
    artifactPasscode,
    socket,
  });

  const selected = artifacts.find((artifact) => artifact.id === selectedFromUrl) ?? artifacts[0];

  // Keep the URL pointing at whatever is open, so the address bar is always a link to this
  // exact view. Replace rather than push: picking through a list shouldn't fill the back
  // button with steps.
  useEffect(() => {
    if (!router.isReady || !selected || selectedFromUrl === selected.id) return;
    router.replace({ query: { ...router.query, artifact: selected.id } }, undefined, { shallow: true });
    // router is stable enough here; re-running on every router identity change would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady, selected?.id, selectedFromUrl]);

  const openArtifact = (artifactId: string) =>
    router.replace({ query: { ...router.query, artifact: artifactId } }, undefined, { shallow: true });

  const handlePasscodeSubmit = (passcode: string) => {
    setSubmittedPasscode(passcode);
    router.replace({ query: { ...router.query, artifactPasscode: passcode } }, undefined, { shallow: true });
  };

  if (!router.isReady || (loading && artifacts.length === 0 && !needsPasscode && !error)) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (needsPasscode) {
    return (
      <>
        <Head>
          <title>Artifacts · NextSpace</title>
        </Head>
        <ArtifactPasscodePrompt
          onSubmit={handlePasscodeSubmit}
          retrying={loading}
          rejected={!!artifactPasscode && !loading}
        />
      </>
    );
  }

  return (
    <>
      <Head>
        <title>{selected ? `${selected.title} · Artifacts` : 'Artifacts'} · NextSpace</title>
      </Head>

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
          <Box component="nav" aria-label="Artifacts in this conversation" sx={{ minWidth: 0 }}>
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
              onSelect={openArtifact}
            />

            {/* Generating reads the event's record and writes a graph, so it is the
                organizer's action rather than a reader's. The endpoint refuses anyone else;
                this only decides whether to offer it. */}
            {authType === 'admin' && conversationId && (
              <GenerateGraphButton
                conversationId={conversationId}
                hasExistingGraph={artifacts.some((a) => a.type === 'ConceptGraphArtifact')}
                onGenerated={(result) => {
                  reload();
                  if (result.artifact?.id) openArtifact(result.artifact.id);
                }}
              />
            )}
          </Box>

          {selected ? (
            <ArtifactView
              artifact={selected}
              artifactPasscode={artifactPasscode}
              isLive={liveArtifactIds.has(selected.id)}
            />
          ) : (
            <Typography variant="body2" color="text.secondary">
              Nothing has been published from this conversation yet. Artifacts appear here as they are created, and update as
              the conversation revises them.
            </Typography>
          )}
        </Box>
      </Box>
    </>
  );
}
