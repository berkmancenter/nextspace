import { useCallback, useEffect, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { Api, ArtifactRequestError, emitWithTokenRefresh, fetchArtifact, listArtifacts } from '../utils';
import { Artifact, ArtifactContainer, ArtifactVersionEvent } from '../types.internal';

/**
 * Parameters for the useArtifacts hook.
 * @property container - Exactly one of `conversationId` or `topicId`. Null until the router is ready.
 * @property artifactPasscode - The container's read passcode. Omit it for an owner or admin, who read without one.
 * @property socket - A connected socket, for live version updates. Omit it and the list is simply static.
 */
export interface UseArtifactsParams {
  container: ArtifactContainer | null;
  artifactPasscode?: string;
  socket?: Socket | null;
}

/**
 * State and controls the useArtifacts hook provides.
 * @property artifacts - The container's artifacts, newest first, each at its latest version.
 * @property loading - True while the first (or a re-issued) list request is in flight.
 * @property error - Why the list could not be read, or null.
 * @property needsPasscode - True when the read was refused for want of a passcode, which is the only actionable reading of the endpoint's 403.
 * @property liveArtifactIds - Ids whose current version arrived over the socket since load, so the UI can mark what just changed.
 * @property reload - Re-fetches the list.
 */
export interface UseArtifactsReturn {
  artifacts: Artifact[];
  loading: boolean;
  error: string | null;
  needsPasscode: boolean;
  liveArtifactIds: Set<string>;
  reload: () => void;
}

/**
 * Loads a conversation's or topic's artifacts and keeps them current.
 *
 * Conversation-scoped artifacts are revised while the event runs, and every appended
 * version is announced to the conversation room as `artifact:version`. The notice carries
 * only `{ artifactId, versionNumber }`: the room is joined with no passcode at all, so
 * nothing that arrives in it is proof of anything, and the content is re-read through the
 * REST route, which checks the artifact passcode. The room join presents no channels
 * because the bare room needs none, and a reader holding only the artifact passcode has
 * no chat credentials to offer.
 *
 * Topic-scoped artifacts are not broadcast (there is no topic-wide room), so a topic
 * container is read once and refreshed only by {@link UseArtifactsReturn.reload}.
 *
 * See {@link UseArtifactsParams} for parameter details.
 */
export function useArtifacts({ container, artifactPasscode, socket }: UseArtifactsParams): UseArtifactsReturn {
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [needsPasscode, setNeedsPasscode] = useState<boolean>(false);
  const [liveArtifactIds, setLiveArtifactIds] = useState<Set<string>>(new Set());
  const [reloadCount, setReloadCount] = useState(0);
  // Which conversation the last successful read was for. The room join keys on it, so a
  // container change cannot ride on the previous container's authorization.
  const [authorizedConversationId, setAuthorizedConversationId] = useState<string | null>(null);

  /* The handler below has to know whether a broadcast names an artifact already in hand,
     and a state updater's work is not done by the time it returns — so the current list is
     mirrored here, where the handler can read it synchronously. */
  const artifactsRef = useRef<Artifact[]>([]);
  useEffect(() => {
    artifactsRef.current = artifacts;
  }, [artifacts]);

  const conversationId = container?.conversationId ?? null;
  const topicId = container?.topicId ?? null;

  const reload = useCallback(() => setReloadCount((n) => n + 1), []);

  useEffect(() => {
    if (!conversationId && !topicId) return;

    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const containerArg = (conversationId ? { conversationId } : { topicId }) as ArtifactContainer;
        const result = await listArtifacts(containerArg, artifactPasscode);
        if (cancelled) return;
        setArtifacts(result);
        setError(null);
        setNeedsPasscode(false);
        setAuthorizedConversationId(conversationId);
      } catch (err) {
        if (cancelled) return;
        setArtifacts([]);
        if (err instanceof ArtifactRequestError && err.needsPasscode) {
          // A wrong passcode, a missing one, and an unknown id are one indistinguishable
          // 403, so the only thing worth telling the visitor is that a passcode is what's
          // missing, never that the artifact doesn't exist.
          setNeedsPasscode(true);
          setAuthorizedConversationId(null);
          setError(null);
        } else {
          setNeedsPasscode(false);
          setError(err instanceof Error ? err.message : 'Could not load artifacts.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [conversationId, topicId, artifactPasscode, reloadCount]);

  // Join the bare conversation room for `artifact:version` notices, with no channels: the
  // room needs none, and a passcode reader has no channel passcode to offer. The join waits
  // for this container's read to succeed, since the server records it as a visit to the
  // conversation and a notice is of no use to a reader the route has turned away.
  const hasJoinedRef = useRef(false);
  useEffect(() => {
    if (!socket || !conversationId || authorizedConversationId !== conversationId) return;
    hasJoinedRef.current = false;

    const join = () => {
      if (hasJoinedRef.current) return;
      hasJoinedRef.current = true;
      emitWithTokenRefresh(
        socket,
        'conversation:join',
        { conversationId, token: Api.get().getAccessToken(), channels: [] },
        () => console.log('Joined conversation room for artifact updates'),
        (err) => {
          console.error('Failed to join conversation room for artifact updates:', err);
          hasJoinedRef.current = false;
        },
      );
    };

    const onConnect = () => {
      hasJoinedRef.current = false;
      join();
    };

    socket.on('connect', onConnect);
    if (socket.connected) join();

    return () => {
      socket.off('connect', onConnect);
    };
  }, [socket, conversationId, authorizedConversationId]);

  useEffect(() => {
    if (!socket) return;
    let active = true;

    const onArtifactVersion = async (notice: ArtifactVersionEvent) => {
      if (!notice?.artifactId || typeof notice.versionNumber !== 'number') return;

      const known = artifactsRef.current.find((artifact) => artifact.id === notice.artifactId);
      if (!known) {
        // An artifact created after this list was read. The notice is all we hold about
        // it, so re-read the list.
        reload();
        return;
      }
      // versionNumber only ever moves forward, but a notice that crosses a reload can
      // arrive stale.
      if (notice.versionNumber <= known.currentVersionNumber) return;

      try {
        const fresh = await fetchArtifact(notice.artifactId, artifactPasscode);
        if (!active) return;
        // Two notices in quick succession fetch twice; whichever answer lands second must
        // not roll the list back, nor claim a change it did not make.
        const held = artifactsRef.current.find((artifact) => artifact.id === fresh.id);
        if (held && fresh.currentVersionNumber < held.currentVersionNumber) return;
        setArtifacts((prev) => prev.map((artifact) => (artifact.id === fresh.id ? fresh : artifact)));
        setLiveArtifactIds((prev) => new Set(prev).add(fresh.id));
      } catch (err) {
        if (!active) return;
        console.error('Failed to re-read artifact after a version notice:', err);
        setError(err instanceof Error ? err.message : 'Could not load this artifact.');
      }
    };

    socket.on('artifact:version', onArtifactVersion);
    return () => {
      active = false;
      socket.off('artifact:version', onArtifactVersion);
    };
  }, [socket, reload, artifactPasscode]);

  return { artifacts, loading, error, needsPasscode, liveArtifactIds, reload };
}
