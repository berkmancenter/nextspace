import React, { useEffect, useRef, useState } from "react";
import { CloseFullscreen } from "@mui/icons-material";
import { IconButton } from "@mui/material";
import { Socket } from "socket.io-client";
import { cubicBezier, motion } from "motion/react";
import { PseudonymousMessage } from "../types.internal";
import { RetrieveData } from "../utils";
import { trackFeatureUsage } from "../utils/analytics";

/**
 * Transcript component
 *
 * This component renders a live transcript of messages and handles its own socket subscription.
 * It manages its own open/close state and displays a toggle button.
 * It supports focusing on messages within a given time range.
 * @param {object} props
 * @property {{ start: Date; end: Date } | null} focusTimeRange - Optional time range to focus/highlight messages within.
 * @property {Socket | null} socket - The socket.io socket instance for receiving live updates.
 * @property {string} conversationId - The conversation ID to subscribe to.
 * @property {string} transcriptPasscode - The passcode for the transcript channel.
 * @property {string} apiAccessToken - The API access token for authentication.
 * @returns A React component for displaying the live transcript.
 */
export function Transcript(props: {
  focusTimeRange?: { start: Date; end: Date } | null;
  socket: Socket | null;
  conversationId: string;
  transcriptPasscode?: string;
  apiAccessToken: string;
}) {
  const [messages, setMessages] = useState<PseudonymousMessage[]>([]);
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [focusedMessageIds, setFocusedMessageIds] = useState<string[]>([]);
  const topRef = useRef<HTMLDivElement | null>(null);
  const transcriptOpenTimeRef = useRef<number>(0);

  const handleToggle = () => {
    const newOpenState = !isOpen;
    if (newOpenState) {
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
    setIsOpen(newOpenState);

    // Scroll to bottom when manually opening
    if (newOpenState) {
      // Closing transcript - calculate duration
      const duration = Math.floor(
        (Date.now() - transcriptOpenTimeRef.current) / 1000
      );
      trackFeatureUsage("transcript", "close", duration);
      scrollToBottom();
    }
  };

  const handleClose = () => {
    setIsOpen(false);
  };

  const applyFocusAndScroll = (
    messagesToFilter: PseudonymousMessage[],
    shouldScroll: boolean = false
  ) => {
    if (!props.focusTimeRange || messagesToFilter.length === 0) {
      setFocusedMessageIds([]);
      return;
    }

    const messagesInRange = messagesToFilter.filter((message) => {
      if (!message.createdAt) return false;
      const messageTime = new Date(message.createdAt).getTime();
      return (
        messageTime >= props.focusTimeRange!.start.getTime() &&
        messageTime <= props.focusTimeRange!.end.getTime()
      );
    });

    if (messagesInRange.length > 0) {
      const messageIds = messagesInRange.map((m) => m.id);
      setFocusedMessageIds(messageIds as string[]);

      if (shouldScroll) {
        const earliestMessage = messagesInRange[messagesInRange.length - 1];
        setTimeout(() => {
          document
            .getElementById(`transcript-message-${earliestMessage.id}`)
            ?.scrollIntoView({
              behavior: "smooth",
              block: "nearest",
              inline: "start",
            });
        }, 500);
      }
    } else {
      setFocusedMessageIds([]);
    }
  };

  const scrollToBottom = () => {
    topRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  // Fetch initial messages
  useEffect(() => {
    if (
      !props.conversationId ||
      !props.apiAccessToken ||
      !props.transcriptPasscode
    )
      return;

    const fetchInitialMessages = async () => {
      try {
        const transcriptMessages = await RetrieveData(
          `messages/${props.conversationId}?channel=transcript,${props.transcriptPasscode}`,
          props.apiAccessToken
        );

        if (Array.isArray(transcriptMessages)) {
          const reversedMessages = transcriptMessages.reverse();
          setMessages(reversedMessages);

          // If focusTimeRange exists, apply focus and scroll to focused messages
          if (props.focusTimeRange) {
            setTimeout(() => {
              applyFocusAndScroll(reversedMessages);
            }, 0);
          } else if (isOpen) {
            // If no focus and transcript is open, scroll to bottom
            scrollToBottom();
          }
        }
      } catch (error) {
        console.error("Error fetching initial transcript messages:", error);
      }
    };

    fetchInitialMessages();
  }, [props.conversationId, props.apiAccessToken, props.transcriptPasscode]);

  // Effect: When focusTimeRange changes → auto-open + highlight + scroll to focus
  useEffect(() => {
    if (!props.focusTimeRange) {
      setFocusedMessageIds([]);
      return;
    }

    if (!isOpen) {
      setIsOpen(true);
    }

    applyFocusAndScroll(messages, true);
  }, [props.focusTimeRange]);

  // Subscribe to transcript channel when component mounts
  useEffect(() => {
    if (!props.socket || !props.conversationId || !props.apiAccessToken) return;

    // Join the transcript channel
    const channel = {
      name: "transcript",
      passcode: props.transcriptPasscode || "",
    };

    try {
      props.socket.emit("conversation:join", {
        conversationId: props.conversationId,
        token: props.apiAccessToken,
        channel,
      });

      console.log("Joined transcript channel");
    } catch (error) {
      console.error("Error joining transcript channel:", error);
    }

    // Listen for new messages on the transcript channel
    const messageHandler = (data: PseudonymousMessage) => {
      console.log("New transcript message:", data);

      // Check if this message is on the transcript channel
      if (data.channels && data.channels.includes("transcript")) {
        // Add new message to the beginning (reverse chronological)
        setMessages((prev) => [data, ...prev]);
      }
    };

    props.socket.on("message:new", messageHandler);

    // Cleanup when component unmounts or deps change
    return () => {
      props.socket?.off("message:new", messageHandler);
    };
  }, [
    props.socket,
    props.conversationId,
    props.apiAccessToken,
    props.transcriptPasscode,
  ]);

  return (
    <>
      {/* Toggle Button */}
      <button
        className={`fixed bottom-4 left-4 w-20 h-20 z-50 cursor-pointer rounded-full shadow-2xl transition-all duration-300 ease-in-out hover:scale-110 hover:shadow-medium-slate-blue/50`}
        onClick={handleToggle}
        aria-label={`${isOpen ? "Close" : "Open"} transcript view`}
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

      {/* Transcript Panel */}
      <div
        className={`transition-all lg:duration-500 ${
          isOpen
            ? " lg:basis-2/3 opacity-100"
            : "lg:delay-500 basis-0 opacity-0"
        }`}
      >
        <motion.div
          variants={{
            closed: { opacity: 0, x: "-80%", width: "0%" },
            open: { opacity: 1, x: 0, y: 0, width: "90%" },
          }}
          animate={isOpen ? "open" : "closed"}
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
                {/* Outer div is to simulate border gradient */}
                <div className="relative z-50 bg-linear-to-b from-medium-slate-blue to-light-blue-100 h-full rounded-lg shadow-md">
                  <div className="bg-linear-to-b from-[#f1f4fe] to-10% to-white h-full relative top-0.5 rounded-lg m-0.5 p-3.5">
                    <div className="flex flex-row items-center justify-between">
                      <h2 className="text-2xl font-semibold">
                        Live Transcript
                      </h2>
                      <IconButton onClick={handleClose}>
                        <CloseFullscreen />
                      </IconButton>
                    </div>
                    <div className="mt-4 overflow-y-scroll overflow-x-hidden scroll-m-12 max-h-[60vh] flex flex-col-reverse">
                      <div ref={topRef} />
                      {messages.map((message, i) => (
                        <div
                          id={`transcript-message-${message.id}`}
                          key={`message-${i}`}
                          className={`msg my-4 ${
                            focusedMessageIds.includes(message.id!)
                              ? "bg-amber-100"
                              : ""
                          }`}
                        >
                          <div className="flex flex-row gap-x-3">
                            <span
                              className="time text-sm text-slate-400"
                              data-datetime={
                                message.createdAt
                                  ? new Date(message.createdAt).toISOString()
                                  : ""
                              }
                            >
                              {message.createdAt
                                ? new Date(
                                    message.createdAt
                                  ).toLocaleTimeString([], {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                    hour12: true,
                                  })
                                : ""}
                            </span>
                          </div>
                          <p>
                            {message.body.text
                              ? message.body.text
                              : message.body}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </>
  );
}
