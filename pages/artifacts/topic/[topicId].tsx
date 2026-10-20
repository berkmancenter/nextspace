import { useMemo, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { Box, CircularProgress } from '@mui/material';
import { ArtifactsBrowser } from '../../../components';
import { useSessionJoin } from '../../../hooks';
import { CheckAuthHeader } from '../../../utils';
import { ArtifactContainer, AuthType } from '../../../types.internal';

export const getServerSideProps = async (context: { req: any }) => {
  return CheckAuthHeader(context.req.headers);
};

/**
 * A series' artifacts: what a whole topic produced, its own concept graph included.
 *
 * A reader holding the topic's artifact passcode sees only topic-scoped artifacts: the topic
 * passcode never opens a conversation's own artifacts, so the listing leaves them out. The
 * topic owner and administrators see the conversations' artifacts here too. The series graph
 * is refined rather than rebuilt (each event that ends merges into what the series already
 * knows), so its version history is a record of how the group's understanding developed, and
 * a concept returned to across sessions is one node with a high degree rather than several.
 *
 * The series' own room gets `artifact:version` and `artifact:generationFailed` notices the
 * same way a conversation's room does, so a series graph regenerating updates live here too.
 */
export default function TopicArtifactsPage({ authType }: { authType: AuthType }) {
  const router = useRouter();
  const topicId = typeof router.query.topicId === 'string' ? router.query.topicId : undefined;
  const passcodeFromUrl = typeof router.query.artifactPasscode === 'string' ? router.query.artifactPasscode : undefined;
  const selectedFromUrl = typeof router.query.artifact === 'string' ? router.query.artifact : undefined;

  const [submittedPasscode, setSubmittedPasscode] = useState<string | undefined>();
  const artifactPasscode = passcodeFromUrl ?? submittedPasscode;

  const { socket } = useSessionJoin(true);

  const container = useMemo<ArtifactContainer | null>(() => (topicId ? { topicId } : null), [topicId]);

  const setQuery = (patch: Record<string, string>) =>
    router.replace({ query: { ...router.query, ...patch } }, undefined, { shallow: true });

  if (!router.isReady) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <>
      <Head>
        <title>Series artifacts · NextSpace</title>
      </Head>
      <ArtifactsBrowser
        container={container}
        artifactPasscode={artifactPasscode}
        authType={authType}
        socket={socket}
        selectedArtifactId={selectedFromUrl}
        onSelectArtifact={(artifactId) => setQuery({ artifact: artifactId })}
        onPasscodeSubmit={(passcode) => {
          setSubmittedPasscode(passcode);
          setQuery({ artifactPasscode: passcode });
        }}
        emptyMessage="Nothing has been published from this series yet. A concept graph is written here as its events end, folding each one into what the series already knows."
      />
    </>
  );
}
