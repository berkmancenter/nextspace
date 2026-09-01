import { CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { IBM_Plex_Mono, IBM_Plex_Sans, Space_Grotesk } from 'next/font/google';
import { Box, CircularProgress, Drawer, Typography } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import MenuIcon from '@mui/icons-material/Menu';
import { Api, RetrieveData, SendData, emitWithTokenRefresh } from '../../utils';
import { CheckAuthHeader } from '../../utils/Helpers';
import { GIVE_FEEDBACK_URL } from '../../components/Header';
import { AuthType, PendingRoomMessage, PseudonymousMessage, UserPseudonym } from '../../types.internal';
import { useConversationMessages, useRoomSetup, useSessionJoin, useTabNavigation } from '../../hooks';
import { CommunityNavigationBar, CommunityNavTab } from '../../components/room/CommunityNavigationBar';
import { CommunityGroupChatPanel } from '../../components/room/CommunityGroupChatPanel';
import { CommunityAssistantPanel } from '../../components/room/CommunityAssistantPanel';
import { BotIcon } from '../../components/BotIcon';
import { RoomMarkIcon } from '../../components/room/RoomMarkIcon';
import { getRoomInitials } from '../../utils/roomAvatarUtils';
import { markRoomRead } from '../../utils/roomReadState';
import styles from '../../components/room/communityRoom.module.css';

const displayFont = Space_Grotesk({ subsets: ['latin'], weight: ['600', '700'] });
const bodyFont = IBM_Plex_Sans({ subsets: ['latin'], weight: ['400', '500', '600'] });
const monoFont = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500', '600'] });

const roomFontVariables = {
  '--room-font-display': displayFont.style.fontFamily,
  '--room-font-body': bodyFont.style.fontFamily,
  '--room-font-mono': monoFont.style.fontFamily,
} as CSSProperties;

export const getServerSideProps = async (context: { req: any }) => {
  return CheckAuthHeader(context.req.headers);
};

/**
 * Turns a refused send into a line the member can act on. SendData only passes the
 * server's own text through on a 400, so the rest are written here rather than
 * shown as a bare status.
 */
function describeRefusal(response: { status?: number; message?: unknown }): string {
  if (response.status === 403) return 'You are not registered for this room.';
  if (response.status === 401) return 'Your session has expired. Sign in again to post.';
  if (response.status === 400 && typeof response.message === 'string') return response.message;
  return 'Message could not be sent.';
}

export default function RoomPage({ authType }: { authType: AuthType }) {
  const router = useRouter();
  const conversationId = router.query.conversationId as string | undefined;

  const { loaded, notFound, generalError, setGeneralError, roomName, botName, communityName, agentId } = useRoomSetup({
    router,
  });

  const { socket, pseudonym: sessionPseudonym, userId, isConnected, lastReconnectTime } = useSessionJoin(true);

  const [registeredName, setRegisteredName] = useState<string | null>(null);
  // Kept apart from useRoomSetup's generalError, which doubles as the fatal "room would not load" screen.
  const [sendError, setSendError] = useState<string | null>(null);

  /**
   * A room posts under the real-name entry registered for that room, not the account's
   * active pseudonym, and that is what the server stamps on the message (llm_engine
   * resolveMessageName). Reading it here keeps the composer agreeing with what everyone else sees.
   */
  useEffect(() => {
    if (!conversationId || !userId || !Api.get().GetTokens()) return undefined;
    let cancelled = false;

    (async () => {
      // The account's own record: the pseudonyms endpoint needs admin rights, which a room member never has.
      const account = await RetrieveData(`users/user/${userId}`, Api.get().getAccessToken());
      if (cancelled) return;
      if (!account || account.error) {
        console.warn('Could not read this account, so the room falls back to the session pseudonym:', account?.status);
        return;
      }
      const pseudonyms: UserPseudonym[] = account.pseudonyms ?? [];
      const registered = pseudonyms.find((p) => p.isRealName && p.conversations?.includes(conversationId));
      if (registered) setRegisteredName(registered.pseudonym);
    })();

    return () => {
      cancelled = true;
    };
  }, [conversationId, userId]);

  const realName = registeredName ?? sessionPseudonym;

  const { activeTab, activeTabRef, unseenAssistantCount, setUnseenAssistantCount, handleTabChange } = useTabNavigation({
    router,
    onClearUnseenResources: () => {},
    onClearResourcesBadge: () => {},
  });

  const [initialJoinComplete, setInitialJoinComplete] = useState(false);
  const [hasJoined, setHasJoined] = useState(false);
  const [waitingForChatResponse, setWaitingForChatResponse] = useState(false);
  const [waitingForAssistantResponse, setWaitingForAssistantResponse] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [offlineTooLong, setOfflineTooLong] = useState(false);
  const [browserOnline, setBrowserOnline] = useState(true);
  const [queuedMessages, setQueuedMessages] = useState<PendingRoomMessage[]>([]);
  const queuedIdRef = useRef(0);
  const deliveringRef = useRef(false);

  /**
   * useConversationMessages rebuilds its fetchers whenever these change and re-fetches whenever
   * the fetchers change, so a fresh array or object literal here would fetch on every render.
   */
  const agentIds = useMemo(() => (agentId ? [agentId] : []), [agentId]);
  const chatIntroRef = useMemo(() => ({ current: [] as PseudonymousMessage[] }), []);
  const assistantIntroRef = useMemo(() => ({ current: [] as PseudonymousMessage[] }), []);

  const {
    assistantMessages,
    setAssistantMessages,
    chatMessages,
    setChatMessages,
    messagesWithUnreadReplies,
    setMessagesWithUnreadReplies,
    fetchAllAssistantMessages,
    fetchChatMessages,
  } = useConversationMessages({
    userId,
    pseudonym: realName,
    agentId,
    agentIds,
    chatPasscode: '',
    initialJoinComplete,
    chatIntroRef,
    assistantIntroRef,
    conversationId,
  });

  // Nothing on the server records what anyone has read, so being in the room is what marks it read.
  useEffect(() => {
    if (!conversationId || !chatMessages.length) return;
    const newest = chatMessages.reduce((latest, message) =>
      new Date(message.createdAt ?? 0) > new Date(latest.createdAt ?? 0) ? message : latest,
    );
    if (newest.createdAt) markRoomRead(conversationId, newest.createdAt);
  }, [chatMessages, conversationId]);

  const mentionTargets = useMemo(
    () => Array.from(new Set(chatMessages.map((m) => m.pseudonym).filter((p): p is string => !!p && p !== realName))),
    [chatMessages, realName],
  );

  /**
   * Unlike an event, the room's chat channel has no passcode by design, so unlike
   * pages/assistant.tsx the channel is always pushed rather than gated on one being present.
   */
  useEffect(() => {
    if (!socket || !userId || !conversationId || !agentId) return;

    const channels = [
      { name: 'chat', direct: false },
      { name: `direct-${userId}-${agentId}`, direct: true },
    ];

    const joinRoom = () => {
      if (hasJoined) return;
      setHasJoined(true);
      emitWithTokenRefresh(
        socket,
        'conversation:join',
        { conversationId, token: Api.get().getAccessToken(), channels },
        () => setInitialJoinComplete(true),
        (error: unknown) => {
          console.error('Failed to join room:', error);
          setInitialJoinComplete(true);
        },
      );
    };

    const onConnect = () => {
      setHasJoined(false);
      joinRoom();
    };
    socket.on('connect', onConnect);
    if (socket.connected) joinRoom();

    return () => {
      socket.off('connect', onConnect);
    };
    // hasJoined is read/set only inside this effect's own closures.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, userId, conversationId, agentId]);

  /**
   * useConversationMessages auto-fetches assistant messages, but gates its chat fetch on a
   * truthy chatPasscode, which a room's channel never has, so only chat is fetched here.
   */
  useEffect(() => {
    if (!initialJoinComplete) return;
    fetchChatMessages().catch((err) => console.error('Error fetching chat messages:', err));
  }, [initialJoinComplete, fetchChatMessages]);

  // Re-fetch history after a reconnect gap, same rationale as the initial fetch above.
  useEffect(() => {
    if (!lastReconnectTime || lastReconnectTime < Date.now() - 10000) return;
    if (!conversationId || !initialJoinComplete) return;
    fetchChatMessages().catch((err) => console.error('Error re-fetching chat messages:', err));
    fetchAllAssistantMessages();
  }, [lastReconnectTime, conversationId, initialJoinComplete, fetchChatMessages, fetchAllAssistantMessages]);

  useEffect(() => {
    if (!socket) return;

    const onMessage = (data: PseudonymousMessage) => {
      if (data.channels?.includes('chat')) {
        setChatMessages((prev) => [...prev, data]);
        if (data.fromAgent) setWaitingForChatResponse(false);
      } else {
        setAssistantMessages((prev) => [...prev, data]);
        if (data.fromAgent) {
          setWaitingForAssistantResponse(false);
          if (activeTabRef.current !== 'assistant') setUnseenAssistantCount((prev) => prev + 1);
        }
      }
    };

    socket.on('message:new', onMessage);
    return () => {
      socket.off('message:new', onMessage);
    };
  }, [socket, setChatMessages, setAssistantMessages, activeTabRef, setUnseenAssistantCount]);

  const deliverMessage = useCallback(
    async (queued: PendingRoomMessage) => {
      const channels = queued.tab === 'chat' ? [{ name: 'chat' }] : [{ name: `direct-${userId}-${agentId}` }];

      if (queued.tab === 'chat') setWaitingForChatResponse(queued.body.includes(`@${botName}`));
      else setWaitingForAssistantResponse(true);

      try {
        const response = await SendData('messages', {
          body: queued.body,
          bodyType: 'text',
          conversation: conversationId,
          channels,
          ...(queued.parentMessageId !== undefined && { parentMessage: queued.parentMessageId }),
        });

        /**
         * Marked on the message rather than raised page-level: the member needs to know which
         * message was refused, and a refusal is final, so it is never retried on reconnect.
         */
        if (response && 'error' in response) {
          const failureReason = describeRefusal(response);
          setQueuedMessages((prev) => prev.map((m) => (m.id === queued.id ? { ...m, failed: true, failureReason } : m)));
          setWaitingForChatResponse(false);
          setWaitingForAssistantResponse(false);
          return;
        }

        setQueuedMessages((prev) => prev.filter((m) => m.id !== queued.id));
      } catch (error) {
        console.warn('Message send failed, holding it in the queue until the connection returns:', error);
        setWaitingForChatResponse(false);
        setWaitingForAssistantResponse(false);
      }
    },
    [userId, agentId, botName, conversationId],
  );

  /**
   * navigator.onLine flips the moment the machine loses its network, while the socket only
   * notices after its ping timeout. Reading both stops sends into an already-dead connection.
   */
  useEffect(() => {
    const sync = () => setBrowserOnline(window.navigator.onLine);
    sync();
    window.addEventListener('online', sync);
    window.addEventListener('offline', sync);
    return () => {
      window.removeEventListener('online', sync);
      window.removeEventListener('offline', sync);
    };
  }, []);

  const isOffline = !isConnected || !browserOnline;

  // After this long the strip stops promising a reconnect and says the message is saved locally.
  useEffect(() => {
    if (!isOffline) {
      setOfflineTooLong(false);
      return undefined;
    }

    const timer = setTimeout(() => setOfflineTooLong(true), 30_000); // 30 seconds
    return () => clearTimeout(timer);
  }, [isOffline]);

  /**
   * Every send goes through the queue rather than posting directly, so a message typed while
   * the socket is down waits here and leaves on the next connection instead of being lost.
   */
  useEffect(() => {
    if (isOffline || deliveringRef.current) return;
    if (queuedMessages.every((m) => m.failed)) return;

    deliveringRef.current = true;
    (async () => {
      try {
        for (const queued of queuedMessages) {
          if (!queued.failed) await deliverMessage(queued);
        }
      } finally {
        // Without this, anything thrown above leaves the guard latched and every later send queues forever.
        deliveringRef.current = false;
      }
    })();
  }, [isOffline, queuedMessages, deliverMessage]);

  const sendMessage = async (tab: CommunityNavTab, message: string, parentMessageId?: string): Promise<boolean> => {
    if (!message) return false;
    // Without this the text just stays in the composer, which on its own reads as a stuck button.
    if (!Api.get().GetTokens() || !conversationId) {
      console.warn('Room send skipped: no access token or conversation id available.');
      setSendError('That message was not sent. Reload the page and sign in again.');
      return false;
    }

    setSendError(null);
    queuedIdRef.current += 1;
    setQueuedMessages((prev) => [...prev, { id: `queued-${queuedIdRef.current}`, tab, body: message, parentMessageId }]);
    return true;
  };

  // Clearing the failed flag puts the message back in front of the delivery effect, which resends it.
  const retryQueuedMessage = useCallback((id: string) => {
    setQueuedMessages((prev) => prev.map((m) => (m.id === id ? { ...m, failed: false } : m)));
  }, []);

  const queuedChatMessages = useMemo(() => queuedMessages.filter((m) => m.tab === 'chat'), [queuedMessages]);
  const queuedAssistantMessages = useMemo(() => queuedMessages.filter((m) => m.tab === 'assistant'), [queuedMessages]);

  if (notFound) {
    return (
      <Box sx={{ p: 4 }}>
        <Typography color="error">Room not found.</Typography>
      </Box>
    );
  }

  if (generalError && !loaded) {
    return (
      <Box sx={{ p: 4 }}>
        <Typography color="error">{generalError}</Typography>
      </Box>
    );
  }

  if (!loaded) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', pt: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <div className={styles.root} style={{ display: 'flex', flexDirection: 'column', height: '100vh', ...roomFontVariables }}>
      <header className={styles.header}>
        <div className={styles.headerLead}>
          <div className={styles.headerTitleGroup}>
            <span aria-hidden="true" className={styles.headerIcon}>
              {activeTab === 'assistant' ? <BotIcon size={18} color="var(--room-berkie-accent)" /> : <RoomMarkIcon />}
            </span>
            <h1 className={styles.headerTitle}>{activeTab === 'assistant' ? botName : roomName || 'Community Room'}</h1>
            {activeTab === 'assistant' && <span className={styles.badge}>PRIVATE</span>}
          </div>
          {activeTab === 'assistant' && <div className={styles.headerSubtitle}>Private to you</div>}
        </div>
        <div className={styles.headerActions}>
          {realName && (
            <button
              type="button"
              aria-label={`Your account, ${realName}`}
              aria-expanded={menuOpen}
              className={styles.accountButton}
              onClick={() => setMenuOpen(true)}
            >
              <span aria-hidden="true" className={styles.accountAvatar}>
                {getRoomInitials(realName)}
              </span>
            </button>
          )}
          <button
            type="button"
            aria-label="Menu"
            aria-expanded={menuOpen}
            className={styles.menuButton}
            onClick={() => setMenuOpen(true)}
          >
            <MenuIcon />
          </button>
        </div>
      </header>

      <Drawer
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        anchor="right"
        slotProps={{ paper: { 'aria-label': 'Room menu' } }}
      >
        <nav aria-label="Room menu" className={styles.menuPanel}>
          <button type="button" aria-label="Close menu" className={styles.menuClose} onClick={() => setMenuOpen(false)}>
            <CloseIcon />
          </button>
          <Link href="/lounge" className={styles.menuItem}>
            Return to the lounge
          </Link>
          <Link href={GIVE_FEEDBACK_URL} target="_blank" rel="noopener noreferrer" className={styles.menuItem}>
            Give Feedback
          </Link>
          {(authType === 'admin' || authType === 'user') && (
            <Link href="/logout" className={styles.menuItem}>
              Log Out
            </Link>
          )}
        </nav>
      </Drawer>

      {isOffline && (
        <div role="status" className={styles.reconnectBanner}>
          <span aria-hidden="true" className={styles.reconnectDot} />
          <span>
            {offlineTooLong
              ? 'Still offline. Your message is saved on this device.'
              : 'Reconnecting… messages you send will be held and sent automatically.'}
          </span>
        </div>
      )}

      <div style={{ flex: 1, minHeight: 0 }}>
        {activeTab === 'assistant' ? (
          <CommunityAssistantPanel
            messages={assistantMessages}
            realName={realName || ''}
            botName={botName}
            pendingMessages={queuedAssistantMessages}
            onRetryPendingMessage={retryQueuedMessage}
            offline={isOffline}
            waitingForResponse={waitingForAssistantResponse}
            onSendMessage={(message) => sendMessage('assistant', message)}
          />
        ) : (
          <CommunityGroupChatPanel
            messages={chatMessages}
            realName={realName || ''}
            currentUserId={userId}
            botName={botName}
            communityName={communityName}
            mentionTargets={mentionTargets}
            pendingMessages={queuedChatMessages}
            onRetryPendingMessage={retryQueuedMessage}
            offline={isOffline}
            waitingForResponse={waitingForChatResponse}
            messagesWithUnreadReplies={messagesWithUnreadReplies}
            onSendMessage={(message, parentMessageId) => sendMessage('chat', message, parentMessageId)}
            onMarkAsRead={(messageId) => {
              setMessagesWithUnreadReplies((prev) => {
                const next = new Set(prev);
                next.delete(messageId);
                return next;
              });
            }}
          />
        )}
      </div>

      <CommunityNavigationBar
        activeTab={activeTab as CommunityNavTab}
        onTabChange={handleTabChange}
        unreadAssistantCount={unseenAssistantCount}
      />

      {(generalError || sendError) && (
        <div role="alert" className={styles.errorBanner}>
          {generalError ?? sendError}
        </div>
      )}
    </div>
  );
}
