import React, { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "@mui/icons-material";
import { Socket } from "socket.io-client";
import { PseudonymousMessage } from "../types.internal";
import { RetrieveData } from "../utils";
import { trackFeatureUsage } from "../utils/analytics";

/**
 * Transcript component - Sidebar style
 *
 * This component renders a live transcript of messages as a sidebar that spans full height.
 * Opens/closes with a toggle button at the top, displays as a thin sliver when closed.
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
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const preserveScrollRef = useRef<{
    scrollHeight: number;
    scrollTop: number;
  } | null>(null);
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

  // Preserve scroll position when new messages arrive
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (container && preserveScrollRef.current) {
      const { scrollHeight: oldScrollHeight, scrollTop: oldScrollTop } =
        preserveScrollRef.current;
      const newScrollHeight = container.scrollHeight;
      const heightDifference = newScrollHeight - oldScrollHeight;

      // Adjust scroll to maintain visual position
      container.scrollTop = oldScrollTop - heightDifference;
      preserveScrollRef.current = null; // Reset
    }
  }, [messages]);

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

          if (props.focusTimeRange) {
            setTimeout(() => {
              applyFocusAndScroll(reversedMessages);
            }, 0);
          } else if (isOpen) {
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

  // Subscribe to transcript channel
  useEffect(() => {
    if (!props.socket || !props.conversationId || !props.apiAccessToken) return;

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

    const messageHandler = (data: PseudonymousMessage) => {
      if (data.channels && data.channels.includes("transcript")) {
        console.log("New transcript message:", data);
        // Capture scroll state before adding message
        const container = messagesContainerRef.current;
        if (container) {
          const wasAtBottom = Math.abs(container.scrollTop) < 5;
          if (!wasAtBottom) {
            // Save scroll state to restore after render
            preserveScrollRef.current = {
              scrollHeight: container.scrollHeight,
              scrollTop: container.scrollTop,
            };
          } else {
            preserveScrollRef.current = null;
          }
        }

        setMessages((prev) => [data, ...prev]);
      }
    };

    props.socket.on("message:new", messageHandler);

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
    <div
      className={`bg-[#200434] text-white transition-all duration-300 ease-in-out flex flex-col ${
        isOpen
          ? "h-[40vh] lg:h-full lg:w-[33vw]"
          : "flex-shrink-0 lg:h-full lg:w-16"
      }`}
    >
      {/* Header with toggle */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/10 bg-[#200434] relative before:absolute before:inset-0 before:bg-white/20 before:pointer-events-none flex-shrink-0">
        {isOpen ? (
          <>
            <h2 className="text-xl font-semibold tracking-wide">
              LIVE TRANSCRIPT
            </h2>
            <button
              onClick={handleToggle}
              className="text-white hover:bg-white/10 rounded p-1 transition-colors"
              aria-label="Close transcript"
            >
              <ChevronRight className="transition-transform -rotate-270 lg:rotate-0" />
            </button>
          </>
        ) : (
          <>
            <div className="flex-1 flex items-center justify-center lg:hidden">
              <div className="text-xs font-semibold tracking-widest">
                LIVE TRANSCRIPT
              </div>
            </div>
            <button
              onClick={handleToggle}
              className="text-white hover:bg-white/10 rounded p-1 transition-colors mx-auto"
              aria-label="Open transcript"
            >
              <ChevronLeft className="transition-transform rotate-270 lg:rotate-0" />
            </button>
          </>
        )}
      </div>

      {/* Vertical text when collapsed (desktop only) */}
      {!isOpen && (
        <div className="hidden lg:flex flex-1 items-center justify-center">
          <div className="transform -rotate-90 whitespace-nowrap text-xs font-semibold tracking-widest">
            LIVE TRANSCRIPT
          </div>
        </div>
      )}

      {/* Messages */}
      {isOpen && (
        <div
          ref={messagesContainerRef}
          className="flex-1 overflow-y-auto overflow-x-hidden p-4 flex flex-col-reverse min-h-0 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-[#2D0A4E] [&::-webkit-scrollbar-thumb]:bg-[#6B21A8] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:hover:bg-[#7C3AED]"
        >
          <div ref={topRef} />
          {messages.map((message, i) => (
            <div
              id={`transcript-message-${message.id}`}
              key={`message-${i}`}
              className={`mb-4 ${
                focusedMessageIds.includes(message.id!) ? "bg-[#4A0979]" : ""
              }`}
            >
              <div className="text-gray-300 text-sm mb-1">
                {message.createdAt
                  ? new Date(message.createdAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                      hour12: true,
                    })
                  : ""}
              </div>
              <p className="text-white text-base">
                {message.body.text ? message.body.text : message.body}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
