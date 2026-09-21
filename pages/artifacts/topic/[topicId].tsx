import { useMemo, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { Box, CircularProgress } from '@mui/material';
import { ArtifactsBrowser } from '../../../components';
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
 * There is no socket here, deliberately: topic-scoped artifacts are broadcast nowhere,
 * because there is no topic-wide room to broadcast into. The browser offers a refresh instead
 * of pretending something will arrive on its own.
 */
export default function TopicArtifactsPage({ authType }: { authType: AuthType }) {
  const router = useRouter();
  const topicId = typeof router.query.topicId === 'string' ? router.query.topicId : undefined;
  const passcodeFromUrl = typeof router.query.artifactPasscode === 'string' ? router.query.artifactPasscode : undefined;
  const selectedFromUrl = typeof router.query.artifact === 'string' ? router.query.artifact : undefined;

  const [submittedPasscode, setSubmittedPasscode] = useState<string | undefined>();
  const artifactPasscode = passcodeFromUrl ?? submittedPasscode;

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
