import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Pause,
  PlayArrow,
  Delete,
  ReportProblem,
  Download,
} from "@mui/icons-material";
import { Dialog, Button } from "@mui/material";
import { Socket } from "socket.io-client";
import { PseudonymousMessage } from "../types.internal";
import { RetrieveData, SendData } from "../utils";
import { trackFeatureUsage, trackConversationEvent } from "../utils/analytics";
import { useVisibilityAwareDuration } from "../hooks/useVisibilityAwareDuration";

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
  category?: string;
  showControls?: boolean;
}) {
  const [messages, setMessages] = useState<PseudonymousMessage[]>([]);
  const [isOpen, setIsOpen] = useState<boolean>(true);
  const [focusedMessageIds, setFocusedMessageIds] = useState<string[]>([]);
  const [isAtBottom, setIsAtBottom] = useState<boolean>(true);
  const [isInManualScrollMode, setIsInManualScrollMode] =
    useState<boolean>(false);
  const [transcriptActive, setTranscriptActive] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<boolean>(false);
  const [showPauseResumeConfirm, setShowPauseResumeConfirm] =
    useState<boolean>(false);
  const topRef = useRef<HTMLDivElement | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const preserveScrollRef = useRef<{
    scrollHeight: number;
    scrollTop: number;
  } | null>(null);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Use visibility-aware duration hooks
  const transcriptOpenDuration = useVisibilityAwareDuration();
  const manualScrollDuration = useVisibilityAwareDuration();
  const autoScrollDuration = useVisibilityAwareDuration();

  const handleToggle = () => {
    const newOpenState = !isOpen;
    if (newOpenState) {
      // Opening transcript - start tracking duration
      transcriptOpenDuration.start();
      trackFeatureUsage("transcript", "open");

      // Start autoscroll duration (transcript always opens at bottom)
      if (!isInManualScrollMode) {
        autoScrollDuration.start();
      }
    } else {
      // Closing transcript - stop tracking and get active duration
      const activeDuration = transcriptOpenDuration.stop();
      trackFeatureUsage("transcript", "close", activeDuration);

      // Stop any active scroll duration tracking
      if (isInManualScrollMode) {
        manualScrollDuration.stop();
      } else {
        autoScrollDuration.stop();
      }
    }
    setIsOpen(newOpenState);
  };

  const applyFocusAndScroll = (
    messagesToFilter: PseudonymousMessage[],
    shouldScroll: boolean = false,
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

  // Helper function to check if scrolled to bottom
  const checkIsAtBottom = (container: HTMLElement): boolean => {
    return Math.abs(container.scrollTop) < 5;
  };

  // Helper function to get category with fallback
  const getCategory = (): string => {
    return props.category || "transcript";
  };

  // Track manual scroll session start
  const trackManualScrollStart = useCallback(() => {
    if (!isInManualScrollMode) {
      // Stop autoscroll duration tracking
      const autoScrollTime = autoScrollDuration.stop();
      if (autoScrollTime > 0) {
        trackConversationEvent(
          props.conversationId,
          getCategory(),
          "scroll_auto_end",
          "user_initiated",
          autoScrollTime,
        );
      }

      setIsInManualScrollMode(true);
      manualScrollDuration.start();
      trackConversationEvent(
        props.conversationId,
        getCategory(),
        "scroll_manual",
        "user_initiated",
      );
    }
  }, [
    isInManualScrollMode,
    props.conversationId,
    manualScrollDuration,
    autoScrollDuration,
  ]);

  // Track return to autoscroll
  const trackReturnToAutoScroll = useCallback(() => {
    if (isInManualScrollMode) {
      const activeDuration = manualScrollDuration.stop();
      setIsInManualScrollMode(false);
      trackConversationEvent(
        props.conversationId,
        getCategory(),
        "scroll_return_auto",
        "user_initiated",
        activeDuration,
      );

      // Start autoscroll duration tracking
      autoScrollDuration.start();
    }
  }, [
    isInManualScrollMode,
    props.conversationId,
    manualScrollDuration,
    autoScrollDuration,
  ]);

  // Recording indicator component
  const RecordingIndicator = ({ size = "w-3 h-3" }: { size?: string }) => (
    <div
      className={`${size} rounded-full ${
        transcriptActive ? "bg-red-500" : "bg-gray-400"
      }`}
      aria-label="Recording status indicator"
    />
  );

  // Handler for pausing transcript
  const handlePause = async () => {
    setShowPauseResumeConfirm(false);
    setError(null);
    try {
      const response = await SendData(
        `transcript/${props.conversationId}/pause`,
        {},
        props.apiAccessToken,
      );
      if (response && response.error) {
        setError(response.message || "Failed to pause transcript");
      }
    } catch (error) {
      console.error("Error pausing transcript:", error);
      setError("Failed to pause transcript");
    }
  };

  // Handler for resuming transcript
  const handleResume = async () => {
    setShowPauseResumeConfirm(false);
    setError(null);
    try {
      const response = await SendData(
        `transcript/${props.conversationId}/resume`,
        {},
        props.apiAccessToken,
      );
      if (response && response.error) {
        setError(response.message || "Failed to resume transcript");
      }
    } catch (error) {
      console.error("Error resuming transcript:", error);
      setError("Failed to resume transcript");
    }
  };

  // Handler for deleting transcript
  const handleDelete = async () => {
    setShowDeleteConfirm(false);
    setError(null);
    try {
      const response = await SendData(
        `transcript/${props.conversationId}`,
        {},
        props.apiAccessToken,
        { method: "DELETE" },
      );
      if (response && response.error) {
        setError(response.message || "Failed to delete transcript");
      }
    } catch (error) {
      console.error("Error deleting transcript:", error);
      setError("Failed to delete transcript");
    }
  };

  // Handler for downloading transcript
  const handleDownload = async () => {
    setError(null);
    try {
      // Fetch the formatted transcript text
      const textContent = await RetrieveData(
        `transcript/${props.conversationId}`,
        props.apiAccessToken,
        "text",
      );

      if (!textContent || typeof textContent !== "string") {
        setError("Failed to fetch transcript for download");
        return;
      }

      // Create blob and download
      const blob = new Blob([textContent], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `transcript_${props.conversationId}_${new Date().toISOString().split("T")[0]}.txt`;

      // Trigger download
      document.body.appendChild(link);
      link.click();

      // Cleanup
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error downloading transcript:", error);
      setError("Failed to download transcript");
    }
  };

  // Throttled scroll handler
  const handleScroll = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container || !isOpen) return;

    const currentlyAtBottom = checkIsAtBottom(container);

    // Clear existing timeout
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }

    // Update state immediately
    setIsAtBottom(currentlyAtBottom);

    // Debounce the analytics tracking to avoid too many events
    scrollTimeoutRef.current = setTimeout(() => {
      if (currentlyAtBottom && isInManualScrollMode) {
        trackReturnToAutoScroll();
      } else if (!currentlyAtBottom && !isInManualScrollMode) {
        trackManualScrollStart();
      }
    }, 150); // 150ms debounce
  }, [
    isOpen,
    isInManualScrollMode,
    trackManualScrollStart,
    trackReturnToAutoScroll,
  ]);

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

  // Fetch initial conversation state and messages
  useEffect(() => {
    if (
      !props.conversationId ||
      !props.apiAccessToken ||
      !props.transcriptPasscode
    )
      return;

    const fetchInitialData = async () => {
      try {
        // Fetch conversation details to get initial transcript status
        const conversationResponse: any = await RetrieveData(
          `conversations/${props.conversationId}`,
          props.apiAccessToken,
        );

        if (conversationResponse && !("error" in conversationResponse)) {
          setTranscriptActive(
            conversationResponse.transcript?.status === "active",
          );
        }

        // Fetch messages
        const transcriptMessages = await RetrieveData(
          `messages/${props.conversationId}?channel=transcript,${props.transcriptPasscode}`,
          props.apiAccessToken,
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

          // Start tracking durations on initial load (transcript starts open at bottom)
          if (isOpen) {
            transcriptOpenDuration.start();
            if (!isInManualScrollMode) {
              autoScrollDuration.start();
            }
          }
        }
      } catch (error) {
        console.error("Error fetching initial data:", error);
      }
    };

    fetchInitialData();
  }, [props.conversationId, props.apiAccessToken, props.transcriptPasscode]);

  // Effect: Add scroll event listener
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container || !isOpen) return;

    container.addEventListener("scroll", handleScroll);

    // Cleanup
    return () => {
      container.removeEventListener("scroll", handleScroll);
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, [isOpen, handleScroll]);

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

    // Track focus scroll event
    if (messages.length > 0) {
      trackConversationEvent(
        props.conversationId,
        getCategory(),
        "scroll_to_focus",
        "focus_triggered",
      );
    }
  }, [props.focusTimeRange]);

  // Subscribe to transcript channel
  useEffect(() => {
    if (!props.socket || !props.conversationId || !props.apiAccessToken) return;

    const channel = {
      name: "transcript",
      passcode: props.transcriptPasscode || "",
    };

    const joinChannel = () => {
      try {
        props.socket!.emit("channel:join", {
          conversationId: props.conversationId,
          token: props.apiAccessToken,
          channel,
        });

        console.log("Joined transcript channel", {
          conversationId: props.conversationId,
          channel,
          socketId: props.socket!.id,
          connected: props.socket!.connected,
        });
      } catch (error) {
        console.error("Error joining transcript channel:", error);
      }
    };

    // Join immediately if already connected, or wait for connect event
    if (props.socket.connected) {
      joinChannel();
    } else {
      console.log("Socket not connected, waiting for connect event");
      props.socket.once("connect", joinChannel);
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

    const transcriptStatusHandler = (data: {
      status: "active" | "paused" | "stopped" | "deleted";
    }) => {
      console.log("Transcript status update:", data);

      // Always handle deleted status - clear all messages
      if (data.status === "deleted") {
        setMessages([]);
        return;
      }

      // Track active/paused status
      setTranscriptActive(data.status === "active");
    };

    console.log("Setting up transcript:status listener", {
      socketId: props.socket.id,
      conversationId: props.conversationId,
    });
    props.socket.on("transcript:status", transcriptStatusHandler);

    // Add catch-all listener to see all events
    const catchAllHandler = (eventName: string, ...args: any[]) => {
      console.log("Socket received event:", eventName, args);
    };
    props.socket.onAny(catchAllHandler);

    return () => {
      props.socket?.off("connect", joinChannel);
      props.socket?.off("message:new", messageHandler);
      props.socket?.off("transcript:status", transcriptStatusHandler);
      props.socket?.offAny(catchAllHandler);
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
      <div
        className={`border-b border-white/10 bg-[#200434] relative before:absolute before:inset-0 before:bg-white/20 before:pointer-events-none flex-shrink-0 ${
          isOpen && props.showControls ? "px-4 pt-2 pb-4" : "px-4 py-2"
        }`}
      >
        {isOpen ? (
          <>
            <div className="flex items-center justify-between py-2">
              <div className="flex items-center gap-3">
                <RecordingIndicator />
                <h2 className="text-xl font-semibold tracking-wide">
                  LIVE TRANSCRIPT
                </h2>
              </div>
              <button
                onClick={handleToggle}
                className="text-white hover:bg-white/10 rounded p-1 transition-colors"
                aria-label="Close transcript"
              >
                <ChevronRight className="transition-transform -rotate-270 lg:rotate-0" />
              </button>
            </div>
            {props.showControls && (
              <>
                <div className="w-full h-px bg-white/40 my-3" />
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowPauseResumeConfirm(true)}
                    className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 border-2 border-white rounded-lg text-white hover:bg-white/10 transition-colors"
                    aria-label={
                      transcriptActive ? "Pause recording" : "Resume recording"
                    }
                  >
                    {transcriptActive ? (
                      <>
                        <Pause className="w-4 h-4" />
                        <span className="text-sm font-medium">Pause</span>
                      </>
                    ) : (
                      <>
                        <PlayArrow className="w-4 h-4" />
                        <span className="text-sm font-medium">Resume</span>
                      </>
                    )}
                  </button>
                  <div className="flex-1 relative group">
                    <button
                      onClick={() => {
                        if (!transcriptActive) {
                          setShowDeleteConfirm(true);
                        }
                      }}
                      disabled={transcriptActive}
                      className={`w-full flex items-center justify-center gap-1.5 px-2 py-1.5 border-2 border-white rounded-lg text-white transition-colors ${
                        transcriptActive
                          ? "opacity-50 cursor-not-allowed"
                          : "hover:bg-white/10"
                      }`}
                      aria-label="Delete transcript"
                    >
                      <Delete className="w-4 h-4" />
                      <span className="text-sm font-medium">Delete</span>
                    </button>
                    {transcriptActive && (
                      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                        Pause transcript before deleting
                        <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-900"></div>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={handleDownload}
                    className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 border-2 border-white rounded-lg text-white hover:bg-white/10 transition-colors"
                    aria-label="Download transcript"
                  >
                    <Download className="w-4 h-4" />
                    <span className="text-sm font-medium">Download</span>
                  </button>
                </div>
                {error && (
                  <div className="mt-3 p-3 bg-red-500/20 border border-red-500/50 rounded-lg">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm text-red-200">{error}</p>
                      <button
                        onClick={() => setError(null)}
                        className="text-red-200 hover:text-white transition-colors flex-shrink-0"
                        aria-label="Dismiss error"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        ) : (
          <div className="flex items-center justify-between lg:justify-center w-full">
            <div className="flex-1 flex items-center justify-center gap-2 lg:hidden">
              <RecordingIndicator size="w-2 h-2" />
              <div className="text-xs font-semibold tracking-widest">
                LIVE TRANSCRIPT
              </div>
            </div>
            <button
              onClick={handleToggle}
              className="text-white hover:bg-white/10 rounded p-1 transition-colors lg:mx-auto"
              aria-label="Open transcript"
            >
              <ChevronLeft className="transition-transform rotate-270 lg:rotate-0" />
            </button>
          </div>
        )}
      </div>

      {/* Vertical text when collapsed (desktop only) */}
      {!isOpen && (
        <div className="hidden lg:flex flex-1 items-center justify-center">
          <div className="transform -rotate-90 whitespace-nowrap text-xs font-semibold tracking-widest flex items-center gap-2">
            <RecordingIndicator size="w-2 h-2" />
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

      {/* Delete Confirmation Modal */}
      <Dialog
        open={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        aria-labelledby="delete-dialog-title"
        aria-describedby="delete-dialog-description"
        slotProps={{
          paper: {
            sx: {
              borderRadius: "16px",
              padding: "32px 24px",
              maxWidth: "440px",
              textAlign: "center",
            },
          },
        }}
      >
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-full border-2 border-red-400 flex items-center justify-center">
            <ReportProblem sx={{ fontSize: 40, color: "#f87171" }} />
          </div>
          <h2 className="text-2xl font-bold text-gray-900">
            Delete transcription?
          </h2>
          <p className="text-gray-600 text-base leading-relaxed max-w-sm">
            This will permanently delete the transcription feed for all
            participants and cannot be undone.
          </p>
          <div className="flex flex-col gap-3 w-full mt-2">
            <Button
              onClick={handleDelete}
              variant="contained"
              sx={{
                backgroundColor: "#b91c1c",
                color: "white",
                padding: "12px 24px",
                borderRadius: "8px",
                textTransform: "none",
                fontSize: "16px",
                fontWeight: 600,
                "&:hover": {
                  backgroundColor: "#991b1b",
                },
              }}
              autoFocus
            >
              Yes, Delete
            </Button>
            <Button
              onClick={() => setShowDeleteConfirm(false)}
              sx={{
                color: "#4b5563",
                textTransform: "none",
                fontSize: "16px",
                fontWeight: 500,
                textDecoration: "underline",
                "&:hover": {
                  backgroundColor: "transparent",
                  textDecoration: "underline",
                },
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Pause/Resume Confirmation Modal */}
      <Dialog
        open={showPauseResumeConfirm}
        onClose={() => setShowPauseResumeConfirm(false)}
        aria-labelledby="pause-resume-dialog-title"
        aria-describedby="pause-resume-dialog-description"
        slotProps={{
          paper: {
            sx: {
              borderRadius: "16px",
              padding: "32px 24px",
              maxWidth: "440px",
              textAlign: "center",
            },
          },
        }}
      >
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-full border-2 border-red-400 flex items-center justify-center">
            <ReportProblem sx={{ fontSize: 40, color: "#f87171" }} />
          </div>
          <h2 className="text-2xl font-bold text-gray-900">
            {transcriptActive
              ? "Pause transcription?"
              : "Resume transcription?"}
          </h2>
          <p className="text-gray-600 text-base leading-relaxed max-w-sm">
            {transcriptActive
              ? "This will pause the transcription feed for all participants and will affect the bot's ability to engage."
              : "This will resume the transcription feed for all participants."}
          </p>
          <div className="flex flex-col gap-3 w-full mt-2">
            <Button
              onClick={transcriptActive ? handlePause : handleResume}
              variant="contained"
              sx={{
                backgroundColor: "#b91c1c",
                color: "white",
                padding: "12px 24px",
                borderRadius: "8px",
                textTransform: "none",
                fontSize: "16px",
                fontWeight: 600,
                "&:hover": {
                  backgroundColor: "#991b1b",
                },
              }}
              autoFocus
            >
              {transcriptActive ? "Yes, Pause" : "Yes, Resume"}
            </Button>
            <Button
              onClick={() => setShowPauseResumeConfirm(false)}
              sx={{
                color: "#4b5563",
                textTransform: "none",
                fontSize: "16px",
                fontWeight: 500,
                textDecoration: "underline",
                "&:hover": {
                  backgroundColor: "transparent",
                  textDecoration: "underline",
                },
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
