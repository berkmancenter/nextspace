import { useMemo, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { Box, CircularProgress } from '@mui/material';
import { ArtifactsBrowser } from '../../components';
import { useSessionJoin } from '../../hooks';
import { CheckAuthHeader } from '../../utils';
import { ArtifactContainer, AuthType } from '../../types.internal';

export const getServerSideProps = async (context: { req: any }) => {
  return CheckAuthHeader(context.req.headers);
};

/**
 * A conversation's artifacts: the shared objects that came out of one event.
 *
 * The page is built to be reached by a link rather than by navigating the app — the passcode
 * rides in the URL as `artifactPasscode`, which is what lets someone who never signed in
 * deliberately open what an event produced. An owner or admin needs no passcode at all, so
 * the first read is attempted without one and the passcode prompt appears only if that read
 * is refused. Which artifact is open is in the URL too, so a link can point at one artifact
 * rather than at the set.
 *
 * A series is at `/artifacts/topic/[topicId]`, the same page shape joined to the topic's own
 * room instead of a conversation's.
 */
export default function ConversationArtifactsPage({ authType }: { authType: AuthType }) {
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

  /* Keep the URL pointing at whatever is open, so the address bar is always a link to this
     exact view. Replace rather than push: picking through a list shouldn't fill the back
     button with steps. */
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
        <title>Artifacts · NextSpace</title>
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
        emptyMessage="Nothing has been published from this conversation yet. Artifacts appear here as they are created, and update as the conversation revises them."
      />
    </>
  );
}
