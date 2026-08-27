import { CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { IBM_Plex_Mono, IBM_Plex_Sans, Space_Grotesk } from 'next/font/google';
import { Box, CircularProgress, Typography } from '@mui/material';
import { Api, SendData, emitWithTokenRefresh } from '../../utils';
import { CheckAuthHeader } from '../../utils/Helpers';
import { AuthType, PendingRoomMessage, PseudonymousMessage } from '../../types.internal';
import { useConversationMessages, useRoomSetup, useSessionJoin, useTabNavigation } from '../../hooks';
import { CommunityNavigationBar, CommunityNavTab } from '../../components/room/CommunityNavigationBar';
import { CommunityGroupChatPanel } from '../../components/room/CommunityGroupChatPanel';
import { CommunityAssistantPanel } from '../../components/room/CommunityAssistantPanel';
import { BotIcon } from '../../components/BotIcon';
import { getRoomInitials } from '../../utils/roomAvatarUtils';
import styles from '../../components/room/communityRoom.module.css';

const displayFont = Space_Grotesk({ subsets: ['latin'], weight: ['600', '700'] });
const bodyFont = IBM_Plex_Sans({ subsets: ['latin'], weight: ['400', '500', '600'] });
const monoFont = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500', '600'] });

const roomFontVariables = {
  '--room-font-display': displayFont.style.fontFamily,
  '--room-font-body': bodyFont.style.fontFamily,
  '--room-font-mono': monoFont.style.fontFamily,
} as CSSProperties;

function RoomMarkIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 1.9 21 7.05v9.9L12 22.1 3 16.95v-9.9Z"
        stroke="var(--room-you-bg)"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M12 7.4 16.4 9.9v5L12 17.4 7.6 14.9v-5Z" fill="var(--room-you-bg)" />
    </svg>
  );
}

export const getServerSideProps = async (context: { req: any }) => {
  return CheckAuthHeader(context.req.headers);
};

export default function RoomPage({ authType: _authType }: { authType: AuthType }) {
  const router = useRouter();
  const conversationId = router.query.conversationId as string | undefined;

  const { loaded, notFound, generalError, setGeneralError, roomName, botName, agentId } = useRoomSetup({ router });

  const { socket, pseudonym: realName, userId, isConnected, lastReconnectTime } = useSessionJoin(true);

  const { activeTab, activeTabRef, unseenAssistantCount, setUnseenAssistantCount, handleTabChange } = useTabNavigation({
    router,
    onClearUnseenResources: () => {},
    onClearResourcesBadge: () => {},
  });

  const [initialJoinComplete, setInitialJoinComplete] = useState(false);
  const [hasJoined, setHasJoined] = useState(false);
  const [waitingForChatResponse, setWaitingForChatResponse] = useState(false);
  const [waitingForAssistantResponse, setWaitingForAssistantResponse] = useState(false);
  const [queuedMessages, setQueuedMessages] = useState<PendingRoomMessage[]>([]);
  const queuedIdRef = useRef(0);
  const deliveringRef = useRef(false);

  // useConversationMessages rebuilds its fetchers whenever these change, and re-fetches
  // whenever the fetchers change. A fresh array or object literal here would therefore
  // start a fetch on every render, which never settles.
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

  const mentionTargets = useMemo(
    () => Array.from(new Set(chatMessages.map((m) => m.pseudonym).filter((p): p is string => !!p && p !== realName))),
    [chatMessages, realName],
  );

  // Join the room's chat channel plus a direct channel with its assistant, once
  // the socket and agent are known. Unlike an event, the room's chat channel
  // has no passcode by design, so — unlike pages/assistant.tsx — the channel is
  // always pushed rather than gated on a passcode being present.
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

  // Only chat history is fetched here: useConversationMessages already auto-fetches
  // assistant messages, but it gates its chat fetch on a truthy chatPasscode, which a
  // room's channel never has by design.
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

        if (response && 'error' in response) {
          setGeneralError('Message could not be sent.');
          setWaitingForChatResponse(false);
          setWaitingForAssistantResponse(false);
          return;
        }

        setQueuedMessages((prev) => prev.filter((m) => m.id !== queued.id));
      } catch (error) {
        console.error('Error sending message:', error);
        setWaitingForChatResponse(false);
        setWaitingForAssistantResponse(false);
      }
    },
    [userId, agentId, botName, conversationId, setGeneralError],
  );

  // Every send goes through the queue rather than posting directly, so a message
  // typed while the socket is down waits here and leaves on the next connection
  // instead of being lost. A message that fails to post stays queued for the same
  // reason, and is retried the next time this runs.
  useEffect(() => {
    if (!isConnected || queuedMessages.length === 0 || deliveringRef.current) return;

    deliveringRef.current = true;
    (async () => {
      for (const queued of queuedMessages) {
        await deliverMessage(queued);
      }
      deliveringRef.current = false;
    })();
  }, [isConnected, queuedMessages, deliverMessage]);

  const sendMessage = async (tab: CommunityNavTab, message: string, parentMessageId?: string): Promise<boolean> => {
    if (!Api.get().GetTokens() || !message || !conversationId) return false;

    queuedIdRef.current += 1;
    setQueuedMessages((prev) => [...prev, { id: `queued-${queuedIdRef.current}`, tab, body: message, parentMessageId }]);
    return true;
  };

  // Queued replies are left out: the thread they belong to is rendered by the
  // shared ThreadPanel, which has no place to show an undelivered message.
  const queuedChatMessages = useMemo(
    () => queuedMessages.filter((m) => m.tab === 'chat' && !m.parentMessageId),
    [queuedMessages],
  );
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
            <h1 className={styles.headerTitle}>{activeTab === 'assistant' ? botName : roomName || 'BKC Community Room'}</h1>
            {activeTab === 'assistant' && <span className={styles.badge}>PRIVATE</span>}
          </div>
          {activeTab === 'assistant' && <div className={styles.headerSubtitle}>Private to you</div>}
        </div>
        {realName && (
          <button type="button" aria-label={`Your account, ${realName}`} className={styles.accountButton}>
            <span aria-hidden="true" className={styles.accountAvatar}>
              {getRoomInitials(realName)}
            </span>
          </button>
        )}
      </header>

      {!isConnected && (
        <div role="status" className={styles.reconnectBanner}>
          <span aria-hidden="true" className={styles.reconnectDot} />
          <span>Reconnecting… messages you send will be held and sent automatically.</span>
        </div>
      )}

      <div style={{ flex: 1, minHeight: 0 }}>
        {activeTab === 'assistant' ? (
          <CommunityAssistantPanel
            messages={assistantMessages}
            realName={realName || ''}
            botName={botName}
            pendingMessages={queuedAssistantMessages}
            waitingForResponse={waitingForAssistantResponse}
            onSendMessage={(message) => sendMessage('assistant', message)}
          />
        ) : (
          <CommunityGroupChatPanel
            messages={chatMessages}
            realName={realName || ''}
            botName={botName}
            mentionTargets={mentionTargets}
            pendingMessages={queuedChatMessages}
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

      {generalError && (
        <div role="alert" className={styles.errorBanner}>
          {generalError}
        </div>
      )}
    </div>
  );
}
