import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { Box, CircularProgress, Typography } from '@mui/material';
import { Api, SendData, emitWithTokenRefresh } from '../../utils';
import { CheckAuthHeader } from '../../utils/Helpers';
import { AuthType, PseudonymousMessage } from '../../types.internal';
import { useConversationMessages, useRoomSetup, useSessionJoin, useTabNavigation } from '../../hooks';
import { CommunityNavigationBar, CommunityNavTab } from '../../components/room/CommunityNavigationBar';
import { CommunityGroupChatPanel } from '../../components/room/CommunityGroupChatPanel';
import { CommunityAssistantPanel } from '../../components/room/CommunityAssistantPanel';
import styles from '../../components/room/communityRoom.module.css';

export const getServerSideProps = async (context: { req: any }) => {
  return CheckAuthHeader(context.req.headers);
};

export default function RoomPage({ authType: _authType }: { authType: AuthType }) {
  const router = useRouter();
  const conversationId = router.query.conversationId as string | undefined;

  const { loaded, notFound, generalError, setGeneralError, roomName, botName, agentId } = useRoomSetup({ router });

  const { socket, pseudonym: realName, userId, lastReconnectTime } = useSessionJoin(true);

  const { activeTab, activeTabRef, unseenAssistantCount, setUnseenAssistantCount, handleTabChange } = useTabNavigation({
    router,
    onClearUnseenResources: () => {},
    onClearResourcesBadge: () => {},
  });

  const [initialJoinComplete, setInitialJoinComplete] = useState(false);
  const [hasJoined, setHasJoined] = useState(false);
  const [waitingForChatResponse, setWaitingForChatResponse] = useState(false);
  const [waitingForAssistantResponse, setWaitingForAssistantResponse] = useState(false);

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
    agentIds: agentId ? [agentId] : [],
    chatPasscode: '',
    initialJoinComplete,
    chatIntroRef: useMemo(() => ({ current: [] as PseudonymousMessage[] }), []),
    assistantIntroRef: useMemo(() => ({ current: [] as PseudonymousMessage[] }), []),
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

  // Fetch chat history once joined. useConversationMessages' own auto-fetch effect
  // gates on chatPasscode being truthy, which a room's channel never is by design,
  // so history is fetched here instead.
  useEffect(() => {
    if (!initialJoinComplete) return;
    fetchChatMessages().catch((err) => console.error('Error fetching chat messages:', err));
    fetchAllAssistantMessages();
  }, [initialJoinComplete, fetchChatMessages, fetchAllAssistantMessages]);

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

  const sendMessage = async (tab: CommunityNavTab, message: string, parentMessageId?: string): Promise<boolean> => {
    if (!Api.get().GetTokens() || !message || !conversationId) return false;

    const channels = tab === 'chat' ? [{ name: 'chat' }] : [{ name: `direct-${userId}-${agentId}` }];

    if (tab === 'chat') setWaitingForChatResponse(message.includes(`@${botName}`));
    else setWaitingForAssistantResponse(true);

    try {
      const response = await SendData('messages', {
        body: message,
        bodyType: 'text',
        conversation: conversationId,
        channels,
        ...(parentMessageId !== undefined && { parentMessage: parentMessageId }),
      });

      if (response && 'error' in response) {
        setGeneralError('Message could not be sent.');
        setWaitingForChatResponse(false);
        setWaitingForAssistantResponse(false);
        return false;
      }
      return true;
    } catch (error) {
      console.error('Error sending message:', error);
      return false;
    }
  };

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
    <div className={styles.root} style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <header className={styles.header}>
        <div className={styles.headerTitleGroup}>
          <h1 className={styles.headerTitle}>{activeTab === 'assistant' ? botName : roomName || 'BKC Community Room'}</h1>
          <span className={styles.badge}>{activeTab === 'assistant' ? 'PRIVATE' : 'LIVE'}</span>
        </div>
      </header>

      <div style={{ flex: 1, minHeight: 0 }}>
        {activeTab === 'assistant' ? (
          <CommunityAssistantPanel
            messages={assistantMessages}
            realName={realName || ''}
            botName={botName}
            waitingForResponse={waitingForAssistantResponse}
            onSendMessage={(message) => sendMessage('assistant', message)}
          />
        ) : (
          <CommunityGroupChatPanel
            messages={chatMessages}
            realName={realName || ''}
            botName={botName}
            mentionTargets={mentionTargets}
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
