import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import CloseIcon from '@mui/icons-material/Close';

import { AssistantChatPanel } from '../components/AssistantChatPanel';
import { GroupChatPanel } from '../components/GroupChatPanel';
import { ResourcesPanel } from '../components/ResourcesPanel';
import { SlashCommand } from '../components/enhancers/slashCommandEnhancer';
import { Api, RetrieveData, SendData, emitWithTokenRefresh, buildDirectChannels } from '../utils';
import { components } from '../types';
import { ControlledInputConfig, PseudonymousMessage, FeedbackConfig } from '../types.internal';
import { useConversationType, useSetBotName, useSetConversationType } from '../context/ConversationTypeContext';
import { AuthType } from '../types.internal';
import { trackConversationEvent, setUserId } from '../utils/analytics';
import { Errors, ParamErrors, Transcript } from '../components/';
import { NavigationBar } from '../components/NavigationBar';
import { PreferencesPanel } from '../components/PreferencesPanel';
import { getFeedbackEligibleMessages } from '../utils/feedbackEligibility';
import { CheckAuthHeader } from '../utils/Helpers';
import { Button, Dialog } from '@mui/material';
import { Info } from '@mui/icons-material';
import {
  useResources,
  useAnalytics,
  useConversationMessages,
  useConversationSetup,
  useSessionJoin,
  useTabNavigation,
} from '../hooks';

type Resource = components['schemas']['Resource'];

export const getServerSideProps = async (context: { req: any }) => {
  return CheckAuthHeader(context.req.headers);
};

function EventAssistantRoom({ authType: _authType }: { authType: AuthType }) {
  const router = useRouter();

  useAnalytics({ pageType: 'assistant' });

  const {
    resources,
    setResources,
    newResourceIds,
    unseenResourcesCount,
    resourcesNavBadgeDismissed,
    setResourcesNavBadgeDismissed,
    resourcesReminderActive,
    setResourcesReminderActive,
    handleMarkReadingsAsSeen,
    handleResourcesUpdated,
    handleConversationEnding,
    onClearResources,
  } = useResources();

  const conversationType = useConversationType();
  const setConversationType = useSetConversationType();
  const setBotNameContext = useSetBotName();

  const {
    activeTab,
    activeTabRef,
    unseenAssistantCount,
    setUnseenAssistantCount,
    unseenChatCount,
    setUnseenChatCount,
    handleTabChange,
  } = useTabNavigation({
    router,
    onClearUnseenResources: onClearResources,
    onClearResourcesBadge: () => setResourcesNavBadgeDismissed(true),
  });

  // useSessionJoin's socket connection is gated on the event being active, which
  // useConversationSetup only knows after its own data fetch resolves. Neither hook
  // can take the other's return value directly, so
  // the gate is threaded through local state and synced once eventStatus is known.
  const [enableSocket, setEnableSocket] = useState(false);

  const {
    socket,
    pseudonym,
    userId,
    isConnected,
    errorMessage: sessionError,
    lastReconnectTime,
  } = useSessionJoin(enableSocket);

  const {
    generalError,
    setGeneralError,
    paramsError,
    eventName,
    eventDescription,
    speakers,
    moderators,
    botName,
    agentId,
    agentActive,
    agentIds,
    conversationFeatures,
    feedbackFrequency,
    transcriptPasscode,
    chatPasscode,
    initialJoinComplete,
    setInitialJoinComplete,
    chatIntroRef,
    assistantIntroRef,
    hasJoinedConvRef,
    eventStatus,
    eventStatusLoaded,
    showEventStatusDialog,
    setShowEventStatusDialog,
  } = useConversationSetup({ socket, userId, router, setConversationType, setBotNameContext, setResources });

  // Enable socket connection only when the event status is loaded and active
  useEffect(() => {
    setEnableSocket(eventStatusLoaded && eventStatus === 'active');
  }, [eventStatusLoaded, eventStatus]);

  const {
    assistantMessages,
    setAssistantMessages,
    chatMessages,
    setChatMessages,
    pollCounts,
    setPollCounts,
    unreadChatReplyCount,
    unreadAssistantReplyCount,
    messagesWithUnreadReplies,
    setMessagesWithUnreadReplies,
    assistantMessagesWithUnreadReplies,
    setAssistantMessagesWithUnreadReplies,
    fetchAllAssistantMessages,
    fetchChatMessages,
  } = useConversationMessages({
    userId,
    pseudonym,
    agentId,
    agentIds,
    chatPasscode,
    initialJoinComplete,
    chatIntroRef,
    assistantIntroRef,
    conversationId: router.query.conversationId as string | undefined,
  });

  const [waitingForResponse, setWaitingForResponse] = useState(false);
  const [waitingForChatResponse, setWaitingForChatResponse] = useState(false);
  const [messageRatings, setMessageRatings] = useState<Map<string, string>>(new Map());
  const [controlledMode, setControlledMode] = useState<ControlledInputConfig | null>(null);
  const [assistantInputValue, setAssistantInputValue] = useState<string>('');
  const [chatInputValue, setChatInputValue] = useState<string>('');
  const [pseudonymFunFact, setPseudonymFunFact] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!userId) return;
    RetrieveData(`users/user/${userId}`, Api.get().getAccessToken()).then((user) => {
      if (user && !('error' in user)) {
        const activePseudonym = user.pseudonyms?.find((p: any) => p.active);
        if (activePseudonym?.funFact) setPseudonymFunFact(activePseudonym.funFact);
      }
    });
  }, [userId]);

  // Derive slash commands from the loaded conversation type's features.
  const slashCommands: SlashCommand[] = (conversationType?.features ?? [])
    .filter((f) => {
      if (f.slashCommand == null) return false;
      const override = conversationFeatures.find((cf) => cf.name === f.name);
      return override?.enabled !== false;
    })
    .map((f) => ({
      command: f.slashCommand!,
      description: f.description ?? '',
      value: `/${f.slashCommand} `,
    }));

  // Socket event listeners — cross-cutting: messages + tab badges + loading state + resources
  useEffect(() => {
    const messageHandler = (data: PseudonymousMessage) => {
      if (process.env.NODE_ENV !== 'production') console.log('New message:', data);

      if (data.fromAgent && data.bodyType === 'json') {
        const body = typeof data.body === 'string' ? JSON.parse(data.body as string) : (data.body as any);
        if (body?.type === 'poll' && body.whenResultsVisible === 'always') {
          const zeroCounts = Object.fromEntries((body.choices as string[]).map((c) => [c, 0]));
          setPollCounts((prev) => ({ ...prev, [body.pollId]: zeroCounts }));
        }
      }

      if (data.channels && data.channels.includes('chat')) {
        setChatMessages((prev) => [...prev, data]);
        if (activeTabRef.current !== 'chat') {
          setUnseenChatCount((prev) => prev + 1);
        }
      } else if (!data.channels || !data.channels.includes('transcript')) {
        setAssistantMessages((prev) => [...prev, data]);
        if (activeTabRef.current !== 'assistant') {
          setUnseenAssistantCount((prev) => prev + 1);
        }
      }

      if (data.fromAgent) {
        if (data.channels && data.channels.includes('chat')) {
          setWaitingForChatResponse(false);
        } else {
          setWaitingForResponse(false);
        }
      }
    };

    const resourcesUpdatedHandler = (payload: { resources: Resource[] }) =>
      handleResourcesUpdated(payload, activeTabRef.current === 'resources');

    const pollChoiceHandler = (data: { pollId: string; counts: Record<string, number> }) => {
      if (!data?.pollId || !data?.counts) return;
      setPollCounts((prev) => ({ ...prev, [data.pollId]: data.counts }));
    };

    if (!socket || !socket.connected) return;

    socket.on('message:new', messageHandler);
    socket.on('resources:updated', resourcesUpdatedHandler);
    socket.on('conversation:ending', handleConversationEnding);
    socket.on('choice:new', pollChoiceHandler);

    console.log('Socket event listeners registered');

    return () => {
      socket.off('message:new', messageHandler);
      socket.off('resources:updated', resourcesUpdatedHandler);
      socket.off('conversation:ending', handleConversationEnding);
      socket.off('choice:new', pollChoiceHandler);
    };
    // activeTabRef is a ref; the remaining omitted values are stable state setters from hooks.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, socket?.connected, handleResourcesUpdated, handleConversationEnding]);

  // Track user ID in analytics when pseudonym is available
  useEffect(() => {
    if (pseudonym) {
      setUserId(pseudonym);
    }
  }, [pseudonym]);

  // Join conversation when socket, agentId, and userId are all available.
  // Also re-joins automatically on every socket reconnection.
  // Cross-cutting: uses setup state (agentId, chatPasscode, refs) + messages state (setChatMessages)
  useEffect(() => {
    if (!socket || !userId || !router.query.conversationId) {
      return;
    }

    if (agentActive && !agentId) {
      return;
    }

    const agentChannels =
      agentIds.length > 0
        ? buildDirectChannels(
            userId,
            agentIds.map((id) => ({ agentId: id })),
          )
        : [];

    const channels: components['schemas']['Channel'][] = [...agentChannels];
    if (chatPasscode) {
      channels.push({
        name: 'chat',
        passcode: chatPasscode,
        direct: false,
      });
    }
    if (channels.length === 0) {
      return;
    }

    const joinConversation = () => {
      if (hasJoinedConvRef.current) return;
      hasJoinedConvRef.current = true;
      console.log('Joining conversation');
      emitWithTokenRefresh(
        socket,
        'conversation:join',
        {
          conversationId: router.query.conversationId,
          token: Api.get().getAccessToken(),
          channels,
        },
        (response) => {
          console.log('Successfully joined conversation');

          const intros: PseudonymousMessage[] = response?.intros ?? [];

          chatIntroRef.current = intros.filter((m) => Array.isArray(m.channels) && m.channels.includes('chat'));
          assistantIntroRef.current = intros.filter(
            (m) => Array.isArray(m.channels) && m.channels.some((c) => c.includes(`-${agentId}`)),
          );

          setInitialJoinComplete((already) => {
            if (!already) {
              if (chatIntroRef.current.length > 0) setChatMessages(chatIntroRef.current);
              if (assistantIntroRef.current.length > 0) setAssistantMessages(assistantIntroRef.current);
            }
            return true;
          });
        },
        (error) => {
          console.error('Failed to join conversation:', error);
          setInitialJoinComplete(true);
        },
      );
    };

    const onConnect = () => {
      hasJoinedConvRef.current = false;
      joinConversation();
    };
    socket.on('connect', onConnect);

    if (socket.connected) {
      joinConversation();
    }

    return () => {
      socket.off('connect', onConnect);
    };
    // chatIntroRef, assistantIntroRef, hasJoinedConvRef are refs; the remaining omitted values
    // are stable setters from hooks. This matches the original join effect behavior.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, agentId, agentActive, agentIds, userId, chatPasscode, router.query.conversationId]);

  // Re-fetch all message history when the socket reconnects after a significant gap.
  // Cross-cutting: uses messages (fetchChatMessages, fetchAllAssistantMessages) + resources (setResources)
  useEffect(() => {
    if (!lastReconnectTime || !router.query.conversationId) return;

    console.log('Assistant re-fetching message history after gap-reconnect...');

    if (chatPasscode) {
      fetchChatMessages().catch((err) => console.error('Error re-fetching chat messages:', err));
    }

    RetrieveData(`conversations/${router.query.conversationId}`, Api.get().getAccessToken())
      .then((data) => {
        if (Array.isArray(data?.resources)) setResources(data.resources);
      })
      .catch((err) => console.error('Error re-fetching resources after reconnect:', err));

    fetchAllAssistantMessages();
    fetchChatMessages();
    // fetchAllAssistantMessages, fetchChatMessages, setResources are stable (useCallback / setState).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastReconnectTime, router.query.conversationId, chatPasscode]);

  // Handle ESC key to exit controlled mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && controlledMode) {
        setControlledMode(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [controlledMode]);

  async function sendMessage(
    message: string,
    shouldWaitForResponse: boolean = true,
    parentMessageId?: string,
    skipTracking: boolean = false,
    messageSource: 'message' | 'promptResponse' = 'message',
    promptQuestionId?: string,
  ) {
    if (!Api.get().GetTokens() || !message || !initialJoinComplete) return false;

    const effectiveTab = activeTab === 'transcript' ? 'assistant' : activeTab;

    let channels =
      effectiveTab === 'chat' ? [{ name: 'chat', passcode: chatPasscode }] : [{ name: `direct-${userId}-${agentId}` }];

    if (effectiveTab !== 'chat' && parentMessageId) {
      const parentMessage = assistantMessages.find((m) => m.id === parentMessageId);
      const parentDirectChannel = parentMessage?.channels?.find((c) => c.startsWith('direct-') && !c.includes(agentId!));
      if (parentDirectChannel) {
        channels = [{ name: parentDirectChannel }];
      }
    }

    const finalMessage = controlledMode ? controlledMode.prefix + message : message;

    if (!skipTracking) {
      const conversationId = router.query.conversationId as string;

      if (message.startsWith('/')) {
        const commandName = message.split(' ')[0].substring(1).split('|')[0];
        trackConversationEvent(conversationId, 'assistant', 'command_sent', commandName);
      } else if (controlledMode) {
        trackConversationEvent(conversationId, 'assistant', 'feedback_sent', controlledMode.label);
      } else {
        trackConversationEvent(conversationId, effectiveTab, 'message_sent', messageSource);
      }
    }

    const isModeratorCommand = finalMessage.trimStart().startsWith('/escalate ') || finalMessage.trim() === '/mod';
    if (shouldWaitForResponse && !controlledMode && !isModeratorCommand) {
      if (effectiveTab === 'assistant') {
        setWaitingForResponse(true);
      } else if (effectiveTab === 'chat') {
        setWaitingForChatResponse(true);
      }
    }

    try {
      const response = await SendData('messages', {
        body: finalMessage,
        bodyType: 'text',
        conversation: router.query.conversationId,
        channels,
        ...(parentMessageId !== undefined && { parentMessage: parentMessageId }),
        ...(messageSource === 'promptResponse' && promptQuestionId && { answersPrompt: promptQuestionId }),
      });

      if (response && response.error && response.message.toLocaleLowerCase().includes('incorrect passcode')) {
        setGeneralError('Incorrect chat passcode. Message could not be sent.');
        setWaitingForResponse(false);
        return false;
      }

      if (controlledMode) setControlledMode(null);

      return true;
    } catch (error) {
      console.error('Error sending message:', error);
      return false;
    }
  }

  const enterControlledMode = (config: ControlledInputConfig) => {
    setControlledMode(config);
  };

  const exitControlledMode = () => {
    setControlledMode(null);
  };

  const sendFeedbackRating = async (messageId: string, rating: string) => {
    const conversationId = router.query.conversationId as string;
    trackConversationEvent(conversationId, 'assistant', 'rating_submitted', rating);
    const feedbackText = `/feedback|Rating|${messageId}|${rating}`;
    await sendMessage(feedbackText, false, undefined, true);

    setMessageRatings((prev) => new Map(prev).set(messageId, rating));
  };

  const handlePromptSelect = async (value: string, promptMessageId?: string) => {
    const promptMessage = assistantMessages.find((msg) => msg.id === promptMessageId);
    const threadParentId = promptMessage?.parentMessage;
    await sendMessage(value, true, threadParentId, false, 'promptResponse', promptMessageId);
  };

  const assistantFeedbackConfig: FeedbackConfig = {
    eligibleMessageIds: getFeedbackEligibleMessages(assistantMessages, feedbackFrequency),
    messageRatings,
    onPopulateFeedbackText: enterControlledMode,
    onSendRating: sendFeedbackRating,
  };

  const chatFeedbackConfig: FeedbackConfig = {
    eligibleMessageIds: getFeedbackEligibleMessages(chatMessages, feedbackFrequency),
    messageRatings,
    onPopulateFeedbackText: enterControlledMode,
    onSendRating: sendFeedbackRating,
  };

  return (
    <>
      {/* On mobile we add bottom padding so the fixed nav bar doesn't cover content */}
      <div className="flex flex-row h-[calc(100vh-96px)] overflow-hidden pb-[60px] lg:pb-0">
        {/* Error messages */}
        {(generalError || sessionError) && !paramsError && (
          <Errors generalError={generalError} sessionError={sessionError} setGeneralError={setGeneralError} />
        )}

        {/* Dialog for when the event has ended or has not started yet; if in future, this is non-dismissable */}
        <Dialog
          open={showEventStatusDialog}
          onClose={eventStatus === 'ended' ? () => setShowEventStatusDialog(false) : () => {}}
          aria-labelledby="event-status-dialog-title"
          aria-describedby="event-status-dialog-description"
          slotProps={{
            paper: {
              sx: {
                borderRadius: '16px',
                padding: '32px 24px',
                maxWidth: '440px',
                textAlign: 'center',
              },
            },
          }}
        >
          <div className="flex flex-col items-center gap-4">
            <h2 id="event-status-dialog-title" className="text-2xl font-bold text-gray-900 flex items-center justify-center">
              <Info className="inline-block mr-2" />
              {eventStatus === 'ended' ? 'Event Has Ended' : 'Event Not Started'}
            </h2>
            <p id="event-status-dialog-description" className="text-gray-600 text-base leading-relaxed">
              {eventStatus === 'ended' ? (
                <span>
                  This event has ended and the assistant is no longer available. You can still view the transcript and
                  resources, but you will not be able to send new messages.
                </span>
              ) : (
                <span>
                  This event has not started yet. You will be able to interact with the assistant once the event begins.
                </span>
              )}
            </p>
            {eventStatus === 'ended' && (
              <div className="flex flex-col gap-3 w-full mt-2">
                <Button
                  aria-label={`Close event ${eventStatus === 'ended' ? 'has ended' : 'not started'} dialog`}
                  onClick={() => setShowEventStatusDialog(false)}
                >
                  Ok
                </Button>
              </div>
            )}
          </div>
        </Dialog>

        {/* Display parameter errors if present */}
        {paramsError ? (
          <ParamErrors paramsError={paramsError} />
        ) : (
          <>
            {/* ── Navigation Bar (left sidebar on desktop, bottom bar on mobile) ── */}
            <NavigationBar
              activeTab={router.query.view === 'preferences' ? null : activeTab}
              onTabChange={handleTabChange}
              unseenAssistantCount={unseenAssistantCount}
              unseenChatCount={unseenChatCount}
              unseenResourcesCount={resourcesNavBadgeDismissed ? 0 : unseenResourcesCount}
              unreadAssistantReplyCount={unreadAssistantReplyCount}
              unreadChatReplyCount={unreadChatReplyCount}
              showChat={!!chatPasscode}
              showTranscript={!!transcriptPasscode}
              showResources={true}
              botName={botName}
            />

            {/* ── Main content area ── */}
            <div className="flex-1 flex flex-row overflow-hidden">
              {/* Transcript full-screen view when transcript tab is active */}
              {router.query.view !== 'preferences' && activeTab === 'transcript' && transcriptPasscode ? (
                <div className="flex-1 overflow-hidden">
                  <Transcript
                    category="assistant"
                    socket={socket}
                    conversationId={router.query.conversationId as string}
                    transcriptPasscode={transcriptPasscode}
                    lastReconnectTime={lastReconnectTime}
                    hideToggle={true}
                  />
                </div>
              ) : (
                <>
                  {/* Chat / Assistant / Resources / Preferences panel */}
                  <div className="flex-1 flex flex-col relative overflow-hidden">
                    {/* Show dismissable resources reminder if active  */}
                    {resourcesReminderActive && (
                      <div className="absolute top-0 w-full z-10 bg-yellow-100 p-4 rounded shadow-2xl animate-slide-in">
                        <div className="flex justify-between font-bold">
                          <p>
                            {resourcesNavBadgeDismissed
                              ? "This event ends soon. Don't forget to review Resources and bookmark or save them for your reference."
                              : "This event ends soon. Don't forget to check the Resources tab for follow-up readings worth bookmarking."}
                          </p>
                          <Button
                            aria-label="Dismiss resources reminder"
                            className="ml-4 px-2 py-2"
                            onClick={() => setResourcesReminderActive(false)}
                            color="error"
                          >
                            <CloseIcon />
                          </Button>
                        </div>
                        <button
                          className="mt-2 px-3 py-1 bg-yellow-200 hover:bg-yellow-300 rounded"
                          onClick={() => {
                            handleTabChange('resources');
                            setResourcesReminderActive(false);
                          }}
                        >
                          View Resources
                        </button>
                      </div>
                    )}
                    {router.query.view === 'preferences' ? (
                      <PreferencesPanel botName={botName} />
                    ) : isConnected || eventStatus == 'active' ? (
                      activeTab === 'chat' ? (
                        <GroupChatPanel
                          messages={chatMessages}
                          pseudonym={pseudonym}
                          pseudonymFunFact={pseudonymFunFact}
                          eventName={eventName}
                          botName={botName}
                          inputValue={chatInputValue}
                          onInputChange={setChatInputValue}
                          onSendMessage={async (msg, parentMessageId) => {
                            const mentionsBot = msg.includes(`@${botName}`);
                            const success = await sendMessage(msg, mentionsBot, parentMessageId);
                            return success;
                          }}
                          controlledMode={controlledMode}
                          onExitControlledMode={exitControlledMode}
                          feedbackConfig={chatFeedbackConfig}
                          messagesWithUnreadReplies={messagesWithUnreadReplies}
                          waitingForResponse={waitingForChatResponse}
                          onMarkAsRead={(messageId) => {
                            setMessagesWithUnreadReplies((prev) => {
                              const newSet = new Set(prev);
                              newSet.delete(messageId);
                              return newSet;
                            });
                          }}
                          pollCounts={pollCounts}
                          inactive={eventStatus !== 'active'}
                        />
                      ) : activeTab === 'resources' ? (
                        <ResourcesPanel
                          resources={resources}
                          eventDescription={eventDescription}
                          speakers={speakers}
                          moderators={moderators}
                          eventName={eventName}
                          unseenReadingsCount={unseenResourcesCount}
                          onMarkReadingsAsSeen={handleMarkReadingsAsSeen}
                          newResourceIds={newResourceIds}
                        />
                      ) : (
                        <AssistantChatPanel
                          messages={assistantMessages}
                          pseudonym={pseudonym}
                          pseudonymFunFact={pseudonymFunFact}
                          waitingForResponse={waitingForResponse}
                          controlledMode={controlledMode}
                          slashCommands={slashCommands}
                          eventName={eventName}
                          botName={botName}
                          inputValue={assistantInputValue}
                          onInputChange={setAssistantInputValue}
                          onSendMessage={async (msg, parentMessageId) => {
                            const success = await sendMessage(msg, true, parentMessageId);
                            return success;
                          }}
                          onExitControlledMode={exitControlledMode}
                          onPromptSelect={handlePromptSelect}
                          userId={userId}
                          feedbackConfig={assistantFeedbackConfig}
                          inactive={!agentActive || eventStatus !== 'active'}
                          messagesWithUnreadReplies={assistantMessagesWithUnreadReplies}
                          onMarkAsRead={(messageId) => {
                            setAssistantMessagesWithUnreadReplies((prev) => {
                              const newSet = new Set(prev);
                              newSet.delete(messageId);
                              return newSet;
                            });
                          }}
                        />
                      )
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        <svg className="mx-auto w-12 h-5" viewBox="0 0 40 10" fill="currentColor">
                          <circle className="animate-bounce fill-sky-400" cx="5" cy="5" r="4" />
                          <circle
                            className="animate-bounce [animation-delay:-0.2s] fill-medium-slate-blue"
                            cx="20"
                            cy="5"
                            r="4"
                          />
                          <circle className="animate-bounce [animation-delay:-0.4s] fill-purple-500" cx="35" cy="5" r="4" />
                        </svg>
                      </div>
                    )}
                  </div>

                  {/* Transcript sidebar — still accessible on Chat and Event Bot views */}
                  {transcriptPasscode && (
                    <div className="lg:order-2 hidden lg:block">
                      <Transcript
                        category="assistant"
                        socket={socket}
                        conversationId={router.query.conversationId as string}
                        transcriptPasscode={transcriptPasscode}
                        lastReconnectTime={lastReconnectTime}
                      />
                    </div>
                  )}
                </>
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}

export default EventAssistantRoom;
