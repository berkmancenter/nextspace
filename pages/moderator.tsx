import { useRouter } from 'next/router';
import { useEffect, useRef, useState } from 'react';

import { PseudonymousMessage, ModeratorInsightsMessage, ModeratorMetricsMessage, ErrorMessage } from '../types.internal';
import { Api, GetChannelPasscode, RetrieveData, QueryParamsError, emitWithTokenRefresh } from '../utils';

import { Transcript } from '../components/';
import { CheckAuthHeader, createConversationFromData } from '../utils/Helpers';
import { useSessionJoin } from '../utils/useSessionJoin';
import { AuthType } from '../types.internal';
import { useAnalytics } from '../hooks/useAnalytics';
import { useSetConversationType } from '../context/ConversationTypeContext';
import { trackConversationEvent } from '../utils/analytics';
import { Alert, Paper, Snackbar } from '@mui/material';
import { ErrorOutline } from '@mui/icons-material';

export const getServerSideProps = async (context: { req: any }) => {
  return CheckAuthHeader(context.req.headers);
};

function ModeratorScreen({ authType }: { authType: AuthType }) {
  const router = useRouter();

  // Initialize page-level analytics
  useAnalytics({ pageType: 'moderator' });

  const setConversationType = useSetConversationType();

  /* Clear the shared conversation type when the event changes so the Quick
     Guide doesn't show stale commands while the new conversation loads.
     The cleanup also handles navigating from moderator → participant view:
     both pages share the same conversationId, so the dep-change effect won't
     fire on the new page — unmount cleanup is the only thing that clears it. */
  useEffect(() => {
    setConversationType(null);
    return () => setConversationType(null);
  }, [router.query.conversationId]);

  const [generalError, setGeneralError] = useState<string | null>(null);
  const [paramsError, setParamsError] = useState<{ header: string; params: string[] } | null>(null);
  const [messages, setMessages] = useState<PseudonymousMessage[]>([]);
  const [conversationName, setConversationName] = useState<string>('');

  const [conversationActive, setConversationActive] = useState<boolean>(true);
  const [moderatorSupportEnabled, setModeratorSupportEnabled] = useState<boolean>(true);

  const [transcriptPasscode, setTranscriptPasscode] = useState<string>('');
  const [modPasscode, setModPasscode] = useState<string>('');
  const [messageFocusTimeRange, setMessageFocusTimeRange] = useState<{
    start: Date;
    end: Date;
  } | null>(null);

  const scrollViewRef = useRef<HTMLDivElement>(null);

  // Use custom hook for session joining
  const { socket, isConnected, errorMessage: sessionError, lastReconnectTime } = useSessionJoin();

  const sessionErrorMessage = sessionError;
  const paramsErrorMessage = paramsError;

  useEffect(() => {
    if (!router.isReady || !socket || !Api.get().getAccessToken()) return;
    const queryError = QueryParamsError(router, 'moderator');
    if (queryError) {
      setParamsError(queryError);
      return;
    }

    const messageHandler = (data: PseudonymousMessage) => {
      console.log('New message:', data);
      if (data.channels![0] === 'moderator') {
        setMessages((prevMessages) => [...prevMessages, data]);
        scrollViewRef.current?.scrollTo({
          top: scrollViewRef.current.scrollHeight,
          behavior: 'smooth',
        });
      }
    };

    // Attach listener immediately, before async fetch
    socket.on('message:new', messageHandler);

    async function fetchConversationData() {
      if (!router.isReady || !Api.get().getAccessToken()) return;

      const transcriptPasscodeParam = GetChannelPasscode('transcript', router.query, setGeneralError);
      const modPasscodeParam = GetChannelPasscode('moderator', router.query, setGeneralError);

      // Store transcript passcode for Transcript component
      if (transcriptPasscodeParam) {
        setTranscriptPasscode(transcriptPasscodeParam);
      }

      // Store mod passcode so the join effect can use it (and re-use it on reconnect)
      if (modPasscodeParam) {
        setModPasscode(modPasscodeParam);
      }

      let moderatorChannelsQuery = `?channel=moderator,${modPasscodeParam}`;

      // Fetch conversation details
      const conversationResponse: any = await RetrieveData(
        `conversations/${router.query.conversationId}`,
        Api.get().getAccessToken(),
      );

      if (conversationResponse && !('error' in conversationResponse)) {
        setConversationName(conversationResponse.name || '');
        setConversationActive(conversationResponse.active ?? true);
        const hasModeratorSupport = (conversationResponse.features ?? []).some(
          (f: { name: string; enabled: boolean }) => f.name === 'moderatorSupport' && f.enabled === true,
        );
        setModeratorSupportEnabled(hasModeratorSupport);
        // Needed so the Quick Guide can filter commands by type name —
        // the raw API response only carries a type ID, not the resolved object.
        const conversation = await createConversationFromData(conversationResponse);
        setConversationType(conversation.type);
      }

      // Fetch messages
      const conversationMessagesResponse: PseudonymousMessage[] | ErrorMessage = await RetrieveData(
        `messages/${router.query.conversationId}${moderatorChannelsQuery}`,
        Api.get().getAccessToken(),
      );

      if (conversationMessagesResponse && 'error' in conversationMessagesResponse) {
        // catch conversation not found
        if (conversationMessagesResponse.message?.message.includes('not found'))
          setParamsError({ header: 'Conversation Not Found', params: [] });
        // Catch incorrect passcode
        else if (conversationMessagesResponse.message?.message.toLocaleLowerCase().includes('incorrect passcode'))
          setParamsError({ header: 'Incorrect Passcode', params: ['moderator'] });
        else setGeneralError(conversationMessagesResponse.message?.message || 'Failed to fetch conversation messages.');
        return;
      } else if (Array.isArray(conversationMessagesResponse)) {
        setMessages(
          (conversationMessagesResponse as PseudonymousMessage[]).filter(
            (message) =>
              message.channels![0] === 'moderator' &&
              (message.body.hasOwnProperty('insights') || message.body.hasOwnProperty('metrics')),
          ),
        );
      }

      // Conversation join is handled by the dedicated useEffect below,
      // which also re-joins on every socket reconnection.
    }

    fetchConversationData();

    // Cleanup
    return () => {
      socket?.off('message:new', messageHandler);
    };
  }, [router, socket]);

  // Re-fetch moderator message history when the socket reconnects after a
  // significant gap (user was on another tab/app for a while).
  useEffect(() => {
    if (!lastReconnectTime || !router.query.conversationId || !modPasscode) return;

    console.log('Moderator re-fetching message history after gap-reconnect...');
    RetrieveData(`messages/${router.query.conversationId}?channel=moderator,${modPasscode}`, Api.get().getAccessToken())
      .then((msgs) => {
        if (Array.isArray(msgs)) {
          setMessages(
            (msgs as PseudonymousMessage[]).filter(
              (message) =>
                message.channels![0] === 'moderator' &&
                (message.body.hasOwnProperty('insights') || message.body.hasOwnProperty('metrics')),
            ),
          );
        }
      })
      .catch((err) => console.error('Error re-fetching moderator messages:', err));
  }, [lastReconnectTime]);

  // Join the moderator channel once the passcode is known, and re-join on
  // every socket reconnection (e.g. after a token refresh or network drop).
  useEffect(() => {
    if (!socket || !router.query.conversationId || !modPasscode) return;

    const joinModerator = () => {
      // Always read the current token so re-joins after a refresh use the
      // new token rather than the one captured at socket-creation time.
      emitWithTokenRefresh(
        socket,
        'conversation:join',
        {
          conversationId: router.query.conversationId,
          token: Api.get().getAccessToken(),
          channel: { name: 'moderator', passcode: modPasscode },
        },
        () => console.log('Successfully joined moderator conversation'),
        (error) => console.error('Error sending conversation:join message:', error),
      );
    };

    // Initial join
    joinModerator();

    // Re-join on every subsequent reconnection (e.g. after token refresh)
    socket.on('connect', joinModerator);

    return () => {
      socket.off('connect', joinModerator);
    };
  }, [socket, router.query.conversationId, modPasscode]);

  const renderMessageBody = (message: PseudonymousMessage) => {
    // Check for insights array in body (handles multiple pseudonyms)
    if (message.body.hasOwnProperty('insights') && Array.isArray(message.body.insights)) {
      return (
        <div>
          {(message as ModeratorInsightsMessage).body.insights.map((insight: any, index: number) => (
            <div key={index} className="mt-2">
              {insight.value}
            </div>
          ))}
        </div>
      );
    } else if (message.body.hasOwnProperty('metrics') && Array.isArray(message.body.metrics)) {
      const metrics = message.body.metrics;
      const messages = metrics.map((m: any, i: number) => {
        const lastInList = i === metrics.length - 1;
        // Create quoted name with proper formatting
        return (
          <span key={`metric-${i}`}>
            &ldquo;{m.name.toWellFormed()}&rdquo;
            {!lastInList ? ', ' : ''}
          </span>
        );
      });

      return (
        <div className="text-medium-slate-blue font-bold">
          The audience is expressing&nbsp;
          {messages}.
        </div>
      );
    } else if (message.body.hasOwnProperty('preset') && message.body.hasOwnProperty('text')) {
      return <div>{(message.body as { text: string; preset: boolean }).text}</div>;
    } else {
      // Log unknown message formats to console instead of displaying
      console.log('Unknown message format:', message);
      return null;
    }
  };

  // Transcript is enabled if we have a passcode
  const transcriptEnabled = !!transcriptPasscode;

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-96px)] overflow-hidden">
      {/* Display general error if present */}
      {generalError && (
        <Snackbar
          open={!!generalError}
          autoHideDuration={6000}
          onClose={() => setGeneralError(null)}
          // message={generalError}
        >
          <Alert severity="error" color="warning">
            {generalError}
          </Alert>
        </Snackbar>
      )}
      {/* Display parameter error if present */}
      {paramsError ? (
        <div className="flex items-center justify-center w-full h-full">
          <div className="min-w-3xs border-2 border-red-400">
            <h3 className="text-xl font-bold px-2 py-2 bg-red-400 text-white w-full">
              <ErrorOutline />
              &nbsp; Error
            </h3>
            <p className="text-xl font-bold mx-9 my-3">{paramsError.header}</p>
            <ul className="text-xl mx-9 my-3 list-disc list-inside">
              {paramsError.params.map((param, index) => (
                <li key={index}>{<code>{param}</code>}</li>
              ))}
            </ul>
          </div>
        </div>
      ) : (
        <>
          {/* Transcript view on top for mobile, right side for desktop - only render if enabled */}
          {transcriptEnabled && (
            <div className="lg:order-2">
              <Transcript
                category="moderator"
                focusTimeRange={messageFocusTimeRange}
                socket={socket}
                conversationId={router.query.conversationId as string}
                transcriptPasscode={transcriptPasscode}
                showControls={true}
                lastReconnectTime={lastReconnectTime}
                setErrorMessage={setGeneralError}
              />
            </div>
          )}

          {/* Main moderator content below transcript on mobile, left side on desktop */}
          <div className="flex-1 flex flex-col relative overflow-hidden lg:order-1">
            {/*  Insights/analytics view */}
            <div className="h-full overflow-y-auto px-8 pt-4" id="scroll-view">
              <div ref={scrollViewRef} className="mt-2 max-w-full">
                <h2 className="text-2xl font-bold mb-4">
                  Hi Mod! Welcome to your&nbsp;
                  <span className="text-medium-slate-blue">{conversationName}</span>
                  &nbsp; event.
                </h2>
                {conversationActive && !moderatorSupportEnabled && (
                  <p className="font-medium mb-4">
                    Moderator question submission is not enabled for this conversation. No audience questions will be
                    received here.
                  </p>
                )}
                <div aria-live="polite">
                  {messages.length > 0
                    ? messages.map((message: ModeratorMetricsMessage, index) => (
                        <div
                          className={`flex flex-col lg:flex-row justify-start mb-4 p-3 ${
                            transcriptEnabled && 'cursor-pointer hover:bg-yellow-50'
                          }`}
                          key={index}
                          onClick={() => {
                            // Track metrics click-through
                            const conversationId = router.query.conversationId as string;
                            trackConversationEvent(conversationId, 'moderator', 'metrics_clicked', 'jump_to_transcript');

                            // Set the time range for the transcript to focus on
                            setMessageFocusTimeRange({
                              start: new Date(message.body.timestamp.start),
                              end: new Date(message.body.timestamp.end),
                            });
                          }}
                        >
                          <span className="text-neutral-900 text-xs font-normal min-w-40">
                            {typeof message.body === 'object' && 'timestamp' in message.body && (
                              <>
                                {`${new Date(message.body.timestamp.start).toLocaleTimeString()} -`}
                                <br />
                                {`${new Date(message.body.timestamp.end).toLocaleTimeString()}`}
                              </>
                            )}
                          </span>
                          <div>{renderMessageBody(message)}</div>
                        </div>
                      ))
                    : moderatorSupportEnabled && <p>No messages yet.</p>}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default ModeratorScreen;
