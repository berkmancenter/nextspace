import { useRouter } from "next/router";
import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";

import {
  PseudonymousMessage,
  ModeratorInsightsMessage,
  ModeratorMetricsMessage,
  ErrorMessage,
} from "../types.internal";
import {
  Api,
  JoinSession,
  GetChannelPasscode,
  RetrieveData,
  QueryParamsError,
} from "../utils";

import { Transcript } from "../components/";
import { CheckAuthHeader } from "../utils/Helpers";
import { useAnalytics } from "../hooks/useAnalytics";
import {
  trackConversationEvent,
  trackConnectionStatus,
} from "../utils/analytics";

export const getServerSideProps = async (context: { req: any }) => {
  return CheckAuthHeader(context.req.headers);
};

function ModeratorScreen({ isAuthenticated }: { isAuthenticated: boolean }) {
  const router = useRouter();

  // Initialize page-level analytics
  useAnalytics({ pageType: "moderator" });

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);

  const [socket, setSocket] = useState<ReturnType<typeof io> | null>(null);
  const [messages, setMessages] = useState<PseudonymousMessage[]>([]);
  const [conversationName, setConversationName] = useState<string>("");

  const [transcriptPasscode, setTranscriptPasscode] = useState<string>("");
  const [messageFocusTimeRange, setMessageFocusTimeRange] = useState<{
    start: Date;
    end: Date;
  } | null>(null);

  const scrollViewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (socket || joining) return;

    let socketLocal: ReturnType<typeof io> | null = null;

    setJoining(true);
    JoinSession(
      () => {
        const token = Api.get().GetTokens().access;
        try {
          // Initialize the socket connection
          socketLocal = io(process.env.NEXT_PUBLIC_SOCKET_URL, {
            auth: { token },
          });

          // Attach all listeners immediately
          socketLocal.on("connect_error", (err: any) => {
            console.error("Socket connection error:", err);
            setErrorMessage("Failed to connect to the socket server.");
          });

          socketLocal.on("error", (error: string) => {
            console.error("Socket error:", error);
            trackConnectionStatus("error");
          });

          socketLocal.on("connect", () => {
            trackConnectionStatus("connected");
          });

          socketLocal.on("disconnect", () => {
            trackConnectionStatus("disconnected");
          });
        } catch (error) {
          console.error("Error initializing socket:", error);
          setErrorMessage("Failed to connect to the socket server.");
          setJoining(false);
          return;
        }

        setSocket(socketLocal);
        setJoining(false);
      },
      (error) => {
        setErrorMessage(error);
        setJoining(false);
      },
    );

    // Cleanup
    return () => {
      if (socketLocal) {
        socketLocal.off("connect");
        socketLocal.off("disconnect");
        socketLocal.off("error");
        socketLocal.off("connect_error");
      }
    };
  }, [socket, joining]);

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
      if (!router.query.conversationId || !router.query.channel) {
        setErrorMessage(QueryParamsError(router));
        return;
      }

      const transcriptPasscodeParam = GetChannelPasscode(
        "transcript",
        router.query,
        setErrorMessage,
      );

      const modPasscodeParam = GetChannelPasscode(
        "moderator",
        router.query,
        setErrorMessage,
      );

      // Store transcript passcode for Transcript component
      if (transcriptPasscodeParam) {
        setTranscriptPasscode(transcriptPasscodeParam);
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
        setErrorMessage(
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

      if (!socket) return;

      try {
        socket.emit("conversation:join", {
          conversationId: router.query.conversationId,
          token: apiAccessToken,
          channel: { name: "moderator", passcode: modPasscodeParam },
        });
      } catch (error) {
        console.error("Error sending conversation:join message:", error);
      }
    }

    fetchConversationData();

    // Cleanup
    return () => {
      socket?.off("message:new", messageHandler);
    };
  }, [router, socket, apiAccessToken]);

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
