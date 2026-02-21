import { useRouter } from "next/router";
import { useEffect, useRef, useState } from "react";

import {
  PseudonymousMessage,
  ModeratorInsightsMessage,
  ModeratorMetricsMessage,
  ErrorMessage,
} from "../types.internal";
import {
  Api,
  GetChannelPasscode,
  RetrieveData,
  QueryParamsError,
  emitWithTokenRefresh,
} from "../utils";

import { Transcript } from "../components/";
import { CheckAuthHeader } from "../utils/Helpers";
import { useSessionJoin } from "../utils/useSessionJoin";
import { AuthType } from "../types.internal";
import { useAnalytics } from "../hooks/useAnalytics";
import {
  trackConversationEvent,
} from "../utils/analytics";

export const getServerSideProps = async (context: { req: any }) => {
  return CheckAuthHeader(context.req.headers);
};

function ModeratorScreen({ authType }: { authType: AuthType }) {
  const router = useRouter();

  // Initialize page-level analytics
  useAnalytics({ pageType: "moderator" });

  const [localError, setLocalError] = useState<string | null>(null);
  const [messages, setMessages] = useState<PseudonymousMessage[]>([]);
  const [conversationName, setConversationName] = useState<string>("");

  const [transcriptPasscode, setTranscriptPasscode] = useState<string>("");
  const [modPasscode, setModPasscode] = useState<string>("");
  const [messageFocusTimeRange, setMessageFocusTimeRange] = useState<{
    start: Date;
    end: Date;
  } | null>(null);

  const scrollViewRef = useRef<HTMLDivElement>(null);

  // Use custom hook for session joining
  const {
    socket,
    isConnected,
    errorMessage: sessionError,
    lastReconnectTime,
  } = useSessionJoin();

  // Combine session and local errors
  const errorMessage = sessionError || localError;

  const apiAccessToken = Api.get().GetTokens().access;

  useEffect(() => {
    if (!router.isReady || !socket || !apiAccessToken) return;

    const messageHandler = (data: PseudonymousMessage) => {
      console.log("New message:", data);
      if (data.channels![0] === "moderator") {
        setMessages((prevMessages) => [...prevMessages, data]);
        scrollViewRef.current?.scrollTo({
          top: scrollViewRef.current.scrollHeight,
          behavior: "smooth",
        });
      }
    };

    // Attach listener immediately, before async fetch
    socket.on("message:new", messageHandler);

    async function fetchConversationData() {
      if (!router.isReady || !apiAccessToken) return;
      if (
        !router.query.conversationId ||
        !router.query.channel ||
        router.query.channel.length === 0
      ) {
        setLocalError(QueryParamsError(router));
        return;
      }

      const transcriptPasscodeParam = GetChannelPasscode(
        "transcript",
        router.query,
        setLocalError
      );

      const modPasscodeParam = GetChannelPasscode(
        "moderator",
        router.query,
        setLocalError
      );

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
        apiAccessToken,
      );

      if (conversationResponse && !("error" in conversationResponse)) {
        setConversationName(conversationResponse.name || "");
      }

      // Fetch messages
      const conversationMessagesResponse: PseudonymousMessage[] | ErrorMessage =
        await RetrieveData(
          `messages/${router.query.conversationId}${moderatorChannelsQuery}`,
          apiAccessToken,
        );

      if (
        conversationMessagesResponse &&
        "error" in conversationMessagesResponse
      ) {
        setLocalError(
          conversationMessagesResponse.message?.message ||
            "Failed to fetch conversation messages.",
        );
        return;
      } else if (Array.isArray(conversationMessagesResponse)) {
        setMessages(
          (conversationMessagesResponse as PseudonymousMessage[]).filter(
            (message) =>
              message.channels![0] === "moderator" &&
              (message.body.hasOwnProperty("insights") ||
                message.body.hasOwnProperty("metrics")),
          ),
        );
      }

      // Conversation join is handled by the dedicated useEffect below,
      // which also re-joins on every socket reconnection.
    }

    fetchConversationData();

    // Cleanup
    return () => {
      socket?.off("message:new", messageHandler);
    };
  }, [router, socket, apiAccessToken]);

  // Re-fetch moderator message history when the socket reconnects after a
  // significant gap (user was on another tab/app for a while).
  useEffect(() => {
    if (!lastReconnectTime || !router.query.conversationId || !modPasscode)
      return;

    console.log("Moderator re-fetching message history after gap-reconnect...");
    RetrieveData(
      `messages/${router.query.conversationId}?channel=moderator,${modPasscode}`,
      apiAccessToken!,
    )
      .then((msgs) => {
        if (Array.isArray(msgs)) {
          setMessages(
            (msgs as PseudonymousMessage[]).filter(
              (message) =>
                message.channels![0] === "moderator" &&
                (message.body.hasOwnProperty("insights") ||
                  message.body.hasOwnProperty("metrics")),
            ),
          );
        }
      })
      .catch((err) =>
        console.error("Error re-fetching moderator messages:", err),
      );
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
        "conversation:join",
        {
          conversationId: router.query.conversationId,
          token: Api.get().GetTokens().access,
          channel: { name: "moderator", passcode: modPasscode },
        },
        () => console.log("Successfully joined moderator conversation"),
        (error) =>
          console.error("Error sending conversation:join message:", error),
      );
    };

    // Initial join
    joinModerator();

    // Re-join on every subsequent reconnection (e.g. after token refresh)
    socket.on("connect", joinModerator);

    return () => {
      socket.off("connect", joinModerator);
    };
  }, [socket, router.query.conversationId, modPasscode]);

  const renderMessageBody = (message: PseudonymousMessage) => {
    if (message.pseudonym === "Back Channel Insights Agent") {
      return (
        <div>
          {(message as ModeratorInsightsMessage).body.insights.map(
            (insight: any, index: number) => (
              <div key={index} className="mt-2">
                {insight.value}
              </div>
            ),
          )}
        </div>
      );
    } else if (message.pseudonym === "Back Channel Metrics Agent") {
      const metrics = message.body.metrics;
      const messages = metrics.map((m: any, i: number) => {
        const lastInList = i === metrics.length - 1;
        // Create quoted name with proper formatting
        return (
          <span key={`metric-${i}`}>
            &ldquo;{m.name.toWellFormed()}&rdquo;
            {!lastInList ? ", " : ""}
          </span>
        );
      });

      return (
        <div className="text-medium-slate-blue font-bold">
          The audience is expressing&nbsp;
          {messages}.
        </div>
      );
    } else {
      message.body.hasOwnProperty("preset") &&
      message.body.hasOwnProperty("text")
        ? (
            message.body as {
              text: string;
              preset: boolean;
            }
          ).text
        : String(message.body);
    }
    return <p>Unknown message format</p>;
  };

  // Transcript is enabled if we have a passcode
  const transcriptEnabled = !!transcriptPasscode;

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-96px)] overflow-hidden">
      {errorMessage ? (
        <div className="text-medium-slate-blue text-lg font-bold mx-9">
          {errorMessage}
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
                apiAccessToken={apiAccessToken!}
                showControls={true}
                lastReconnectTime={lastReconnectTime}
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
                  <span className="text-medium-slate-blue">
                    {conversationName}
                  </span>
                  &nbsp; event.
                </h2>
                <div aria-live="polite">
                  {messages.length > 0 ? (
                    messages.map((message: ModeratorMetricsMessage, index) => (
                      <div
                        className={`flex flex-col lg:flex-row justify-start mb-4 p-3 ${
                          transcriptEnabled &&
                          "cursor-pointer hover:bg-yellow-50"
                        }`}
                        key={index}
                        onClick={() => {
                          // Track metrics click-through
                          const conversationId = router.query
                            .conversationId as string;
                          trackConversationEvent(
                            conversationId,
                            "moderator",
                            "metrics_clicked",
                            "jump_to_transcript",
                          );

                          // Set the time range for the transcript to focus on
                          setMessageFocusTimeRange({
                            start: new Date(message.body.timestamp.start),
                            end: new Date(message.body.timestamp.end),
                          });
                        }}
                      >
                        <span className="text-neutral-900 text-xs font-normal min-w-40">
                          {typeof message.body === "object" &&
                            "timestamp" in message.body && (
                              <>
                                {`${new Date(
                                  message.body.timestamp.start,
                                ).toLocaleTimeString()} -`}
                                <br />
                                {`${new Date(
                                  message.body.timestamp.end,
                                ).toLocaleTimeString()}`}
                              </>
                            )}
                        </span>
                        <div>{renderMessageBody(message)}</div>
                      </div>
                    ))
                  ) : (
                    <p>No messages yet.</p>
                  )}
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
