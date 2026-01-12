import { useRouter } from "next/router";
import { useEffect, useRef, useState } from "react";
import { IconButton, Tooltip } from "@mui/material";
import { io } from "socket.io-client";
import {
  ArrowUpwardOutlined,
  CloudOffOutlined,
  CloudOutlined,
} from "@mui/icons-material";
import { animateScroll as scroll } from "react-scroll";
import { cubicBezier, motion } from "motion/react";
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
import { CheckAuthHeader, DefaultEase } from "../utils/Helpers";
import { useAnalytics } from "../hooks/useAnalytics";
import {
  trackEvent,
  trackConversationEvent,
  trackConnectionStatus,
  trackFeatureUsage,
} from "../utils/analytics";

export const getServerSideProps = async (context: { req: any }) => {
  return CheckAuthHeader(context.req.headers);
};

function ModeratorScreen({ isAuthenticated }: { isAuthenticated: boolean }) {
  const router = useRouter();

  // Initialize page-level analytics
  useAnalytics({ pageType: "moderator" });

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [joining, setJoining] = useState(false);

  const [socket, setSocket] = useState<ReturnType<typeof io> | null>(null);
  const [messages, setMessages] = useState<PseudonymousMessage[]>([]);

  const [transcript, setTranscript] = useState<PseudonymousMessage[]>([]);
  const [isTranscriptOpen, setIsTranscriptOpen] = useState<boolean>(false);
  const [focusedTranscriptElement, setFocusedTranscriptElement] =
    useState<HTMLDivElement | null>(null);

  const scrollViewRef = useRef<HTMLDivElement>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const transcriptOpenTimeRef = useRef<number>(0);

  /**
   * Filters transcript elements based on a given timespan
   * @param start Start date of the timespan
   * @param end End date of the timespan
   * @returns HTMLDivElement[] that matches the timespan
   */
  function filterElementsByTimespan(start: Date, end: Date): HTMLDivElement[] {
    const timespanSelector = ".msg .time";
    if (!transcriptRef.current) return [];
    const elements = Array.from(
      transcriptRef.current.querySelectorAll<HTMLElement>(timespanSelector)
    );

    const filteredElements = elements.filter((element) => {
      if (!element.dataset.datetime) return false;

      const elementDate = new Date(element.dataset.datetime);
      return (
        elementDate.getTime() >= start.getTime() &&
        elementDate.getTime() <= end.getTime()
      );
    });

    return filteredElements.map(
      (el) => el.parentElement?.parentElement! as HTMLDivElement
    );
  }

  /**
   * Authenticates the user and retrieves an API token.
   * @returns The API token as a string.
   */
  const join = async () => {
    setJoining(true);
    JoinSession(
      () => {
        const token = Api.get().GetTokens().access;
        let socketLocal;
        try {
          // Initialize the socket connection
          socketLocal = io(process.env.NEXT_PUBLIC_SOCKET_URL, {
            auth: { token },
          });
          socketLocal.on("connect_error", (err: any) => {
            console.error("Socket connection error:", err);
            setErrorMessage("Failed to connect to the socket server.");
          });
        } catch (error) {
          console.error("Error initializing socket:", error);
          setErrorMessage("Failed to connect to the socket server.");
          return;
        }
        // Set the socket instance in state
        setSocket(socketLocal);
        setJoining(false);
      },
      (error) => {
        setErrorMessage(error);
      }
    );
  };

  // Handle shortcut key is pressed (debugging purposes)
  useEffect(() => {
    function keyDownHandler(e: globalThis.KeyboardEvent) {
      if (e.altKey && e.key === "å") {
        setTranscript((prev) => [
          {
            id: crypto.randomUUID(),
            pseudonym: "Back Channel Insights Agent",
            body: {
              preset: false,
              text: `This is a test message ${Math.random() * 0.001}`,
            },
          } as PseudonymousMessage,
          ...prev,
        ]);
      }
    }
    document.addEventListener("keydown", keyDownHandler);

    return () => {
      document.removeEventListener("keydown", keyDownHandler);
    };
  });

  useEffect(() => {
    if (socket || joining) return;
    join();
  });

  useEffect(() => {
    if (!socket) return;
    socket.on("error", (error: string) => {
      console.error("Socket error:", error);
      trackConnectionStatus("error");
    });
    socket.on("connect", () => {
      setIsConnected(true);
      trackConnectionStatus("connected");
    });
    socket.on("disconnect", () => {
      setIsConnected(false);
      trackConnectionStatus("disconnected");
    });

    return () => {
      socket.off("connect", () => setIsConnected(true));
      socket.off("disconnect", () => setIsConnected(false));
    };
  }, [socket]);

  const apiAccessToken = Api.get().GetTokens().access;

  useEffect(() => {
    async function fetchConversationData() {
      if (!router.isReady || !apiAccessToken) return;
      if (
        !router.query.conversationId ||
        !router.query.channel ||
        router.query.channel.length === 0
      ) {
        setErrorMessage(QueryParamsError(router));
        return;
      }
      const transcriptPasscodeParam = GetChannelPasscode(
        "transcript",
        router.query,
        setErrorMessage
      );

      const modPasscodeParam = GetChannelPasscode(
        "moderator",
        router.query,
        setErrorMessage
      );
      let moderatorChannelsQuery = `?channel=moderator,${modPasscodeParam}`;
      // Add transcript channel and passcode passed 1in query
      if (transcriptPasscodeParam)
        moderatorChannelsQuery += `&channel=transcript,${transcriptPasscodeParam}`;

      // Fetch messages
      const conversationMessagesResponse: PseudonymousMessage[] | ErrorMessage =
        await RetrieveData(
          `messages/${router.query.conversationId}${moderatorChannelsQuery}`,
          apiAccessToken
        );

      if (
        conversationMessagesResponse &&
        "error" in conversationMessagesResponse
      ) {
        setErrorMessage(
          conversationMessagesResponse.message?.message ||
            "Failed to fetch conversation messages."
        );
        return;
      } else if (Array.isArray(conversationMessagesResponse)) {
        setMessages(
          (conversationMessagesResponse as PseudonymousMessage[]).filter(
            (message) =>
              message.channels[0] === "moderator" &&
              (message.body.hasOwnProperty("insights") ||
                message.body.hasOwnProperty("metrics"))
          )
        );
        setTranscript(
          (conversationMessagesResponse as PseudonymousMessage[])
            .filter((message) => message.channels.includes("transcript"))
            .reverse()
        );
      }

      if (!socket) return;

      let channels = [{ name: "moderator", passcode: modPasscodeParam }];
      // Check if transcript channel should be included
      if (transcriptPasscodeParam)
        channels.push({
          name: "transcript",
          passcode: transcriptPasscodeParam,
        });

      try {
        for (const channel of channels) {
          socket.emit("conversation:join", {
            conversationId: router.query.conversationId,
            token: apiAccessToken,
            channel,
          });
        }
      } catch (error) {
        console.error("Error sending conversation:join message:", error);
      }

      // Listen for new messages
      if (!socket.hasListeners("message:new"))
        socket.on("message:new", (data) => {
          console.log("New message:", data);
          if (data.channels[0] === "moderator") {
            setMessages((prevMessages) => [...prevMessages, data]);
            scrollViewRef.current?.scrollTo({
              top: scrollViewRef.current.scrollHeight,
              behavior: "smooth",
            });
          } else setTranscript((prevMessages) => [data, ...prevMessages]);
        });
    }
    fetchConversationData();
  }, [apiAccessToken, router, socket, socket?.connected]);

  const renderMessageBody = (message: PseudonymousMessage) => {
    if (message.pseudonym === "Back Channel Insights Agent") {
      return (
        <div>
          {(message as ModeratorInsightsMessage).body.insights.map(
            (insight: any, index: number) => (
              <div key={index} className="mt-2">
                {insight.value}
              </div>
            )
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

  const transcriptEnabled = transcript && transcript.length > 0;

  return (
    <div className="flex items-start justify-center mt-12">
      {errorMessage ? (
        <div className="text-medium-slate-blue text-lg font-bold">
          {errorMessage}
        </div>
      ) : (
        <>
          {transcriptEnabled && (
            <button
              className={`fixed bottom-4 left-4 w-20 h-20 z-50 cursor-pointer rounded-full shadow-2xl transition-all duration-300 ease-in-out hover:scale-110 hover:shadow-medium-slate-blue/50 ${DefaultEase}`}
              onClick={() => {
                const newState = !isTranscriptOpen;
                if (newState) {
                  // Opening transcript
                  transcriptOpenTimeRef.current = Date.now();
                  trackFeatureUsage("transcript", "open");
                } else {
                  // Closing transcript - calculate duration
                  const duration = Math.floor(
                    (Date.now() - transcriptOpenTimeRef.current) / 1000
                  );
                  trackFeatureUsage("transcript", "close", duration);
                }
                setIsTranscriptOpen(newState);
              }}
              aria-label={`${
                isTranscriptOpen ? "Close" : "Open"
              } transcript view`}
            >
              <div className="relative flex items-center justify-center ">
                <div className="absolute w-20 h-20 rounded-full animate-[rotate-bg_15s_linear_infinite] bg-radial-[209.40%_89.55%_at_94.76%_6.29%] from-medium-slate-blue to-[#FBFCFE]"></div>
                <svg
                  className="absolute"
                  width="67"
                  height="40"
                  viewBox="0 0 67 40"
                  fill="none"
                >
                  <path
                    d="M0 20C0 8.9543 9.05567 0 20.2264 0H46.7736C57.9444 0 67 8.9543 67 20V40H20.2264C9.05567 40 0 31.0457 0 20Z"
                    fill="#4845D2"
                  />
                  <path
                    d="M46.7736 7.5H20.2264C13.2447 7.5 7.58491 13.0964 7.58491 20C7.58491 26.9036 13.2447 32.5 20.2264 32.5H46.7736C53.7553 32.5 59.4151 26.9036 59.4151 20C59.4151 13.0964 53.7553 7.5 46.7736 7.5Z"
                    fill="#A5B4FC"
                  />
                  <path
                    d="M20.2264 26.25C23.7173 26.25 26.5472 23.4518 26.5472 20C26.5472 16.5482 23.7173 13.75 20.2264 13.75C16.7356 13.75 13.9057 16.5482 13.9057 20C13.9057 23.4518 16.7356 26.25 20.2264 26.25Z"
                    fill="black"
                  />
                  <path
                    d="M17.6981 18.75C18.3963 18.75 18.9623 18.1904 18.9623 17.5C18.9623 16.8096 18.3963 16.25 17.6981 16.25C16.9999 16.25 16.434 16.8096 16.434 17.5C16.434 18.1904 16.9999 18.75 17.6981 18.75Z"
                    fill="white"
                  />
                  <path
                    d="M48.0377 26.25C51.5286 26.25 54.3585 23.4518 54.3585 20C54.3585 16.5482 51.5286 13.75 48.0377 13.75C44.5469 13.75 41.717 16.5482 41.717 20C41.717 23.4518 44.5469 26.25 48.0377 26.25Z"
                    fill="black"
                  />
                  <path
                    d="M45.5094 18.75C46.2076 18.75 46.7736 18.1904 46.7736 17.5C46.7736 16.8096 46.2076 16.25 45.5094 16.25C44.8113 16.25 44.2453 16.8096 44.2453 17.5C44.2453 18.1904 44.8113 18.75 45.5094 18.75Z"
                    fill="white"
                  />
                </svg>
              </div>
            </button>
          )}
          {/*  Transcript view */}
          <div
            className={`transition-all lg:duration-500 ${
              isTranscriptOpen
                ? " lg:basis-2/3 opacity-100"
                : "lg:delay-500 basis-0 opacity-0"
            }`}
          >
            <motion.div
              variants={{
                closed: { opacity: 0, x: "-80%", width: "0%" },
                open: { opacity: 1, x: 0, y: 0, width: "90%" },
              }}
              animate={isTranscriptOpen ? "open" : "closed"}
              initial="closed"
              exit="closed"
              transition={{
                duration: 0.4,
                delay: 0.2,
                ease: cubicBezier(0.075, 0.82, 0.165, 1.0),
              }}
              key="transcript"
              className="fixed lg:relative flex justify-center h-8/12 origin-bottom-right"
            >
              <div className="lg:w-3/4">
                <div className="flex flex-row items-center justify-between">
                  <div className="h-full w-full">
                    <Transcript
                      content={transcript}
                      onClose={() => setIsTranscriptOpen(false)}
                      focusElement={focusedTranscriptElement}
                      ref={transcriptRef}
                    />
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
          {/*  Insights/analytics view */}
          <div className="w-11/12 lg:w-2/3" id="scroll-view">
            <div
              className="max-w-2.5"
              aria-label={`Connection status is ${
                isConnected ? "connected" : "disconnected"
              }`}
            >
              {isConnected ? (
                <Tooltip
                  title={`Conversation ID: ${process.env.NEXT_PUBLIC_LLM_FCLTR_CONVERSATION_ID}`}
                >
                  <CloudOutlined sx={{ color: "green" }} />
                </Tooltip>
              ) : (
                <Tooltip
                  title={`Conversation ID: ${process.env.NEXT_PUBLIC_LLM_FCLTR_CONVERSATION_ID}`}
                >
                  <CloudOffOutlined sx={{ color: "red" }} />
                </Tooltip>
              )}
            </div>
            <div ref={scrollViewRef} className="mt-4 p-2.5 max-w-full">
              <h2 className="text-2xl font-bold mb-4 ml-2">
                Hi Mod! This is the very beginning of the&nbsp;
                <span className="text-medium-slate-blue">#ASML</span>&nbsp;
                event.
              </h2>
              <div aria-live="polite">
                {messages.length > 0 ? (
                  messages.map((message: ModeratorMetricsMessage, index) => (
                    <div
                      className={`flex flex-col lg:flex-row justify-start mb-4 p-3 ${
                        transcriptEnabled && "cursor-pointer hover:bg-yellow-50"
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
                          "jump_to_transcript"
                        );

                        // Scroll to the message first appearing in the transcript matching the timespan
                        const matchingMsgs = filterElementsByTimespan(
                          new Date(message.body.timestamp.start),
                          new Date(message.body.timestamp.end)
                        );
                        if (matchingMsgs.length > 0) {
                          // Wait for transcript DOM to render
                          setTimeout(
                            () => {
                              setFocusedTranscriptElement(matchingMsgs[0]);
                            },
                            isTranscriptOpen ? 0 : 500
                          );
                          // Open the transcript if it is not already open
                          if (!isTranscriptOpen) setIsTranscriptOpen(true);
                        }
                      }}
                    >
                      <span className="text-neutral-900 text-xs font-normal min-w-40">
                        {typeof message.body === "object" &&
                          "timestamp" in message.body && (
                            <>
                              {`${new Date(
                                message.body.timestamp.start
                              ).toLocaleTimeString()} -`}
                              <br />
                              {`${new Date(
                                message.body.timestamp.end
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
            <div className="fixed bottom-4 right-10">
              <IconButton
                aria-label="go to top"
                sx={{
                  " &:hover": {
                    backgroundColor: "#0B6BCB",
                    color: "#fff",
                    scale: 1.1,
                  },
                  backgroundColor: "#fff",
                  color: "#0B6BCB",
                  borderRadius: "6px",
                  border: "2px solid #97C3F0",
                  boxShadow: "0px 4px 4px 0px #00000040",
                }}
                onClick={() => {
                  scroll.scrollToTop();
                }}
              >
                <ArrowUpwardOutlined fontSize="large" />
              </IconButton>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default ModeratorScreen;
