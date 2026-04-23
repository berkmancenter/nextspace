import React, { FC, useState, useRef, useEffect } from "react";
import { Reply, ChatBubbleOutline, ChevronRight } from "@mui/icons-material";
import { IconButton } from "@mui/material";
import { PseudonymousMessage, FeedbackConfig } from "../types.internal";
import { normalizeAssistantPseudonym } from "../utils/Helpers";
import { MessageFeedback } from "./MessageFeedback";

interface ThreadedMessageProps {
  message: PseudonymousMessage;
  replies: PseudonymousMessage[];
  pseudonym: string | null;
  onOpenThread?: (messageId: string) => void;
  onMarkAsRead?: (messageId: string) => void;
  botName: string;
  renderAvatar: (msg: PseudonymousMessage) => React.ReactNode;
  renderMessageContent: (
    msg: PseudonymousMessage,
    isHovered?: boolean,
  ) => React.ReactNode;
  feedbackConfig?: FeedbackConfig;
  showTimestamp: boolean;
  isThreadOpen?: boolean;
  hasUnreadReplies?: boolean;
}

export const ThreadedMessage: FC<ThreadedMessageProps> = ({
  message,
  replies,
  pseudonym,
  onOpenThread,
  onMarkAsRead,
  botName,
  renderAvatar,
  renderMessageContent,
  feedbackConfig,
  showTimestamp,
  isThreadOpen = false,
  hasUnreadReplies = false,
}) => {
  const [showReplyButton, setShowReplyButton] = useState(false);
  const [isReplyIndicatorPressed, setIsReplyIndicatorPressed] = useState(false);
  const [showExpandButton, setShowExpandButton] = useState(false);
  const touchTimerRef = useRef<NodeJS.Timeout | null>(null);
  const messageRef = useRef<HTMLDivElement>(null);
  const visibilityTimerRef = useRef<NodeJS.Timeout | null>(null);
  const hasBeenScrolledOutRef = useRef<boolean>(false);
  const isCurrentlyVisibleRef = useRef<boolean>(false);

  const isCurrentUser = message.pseudonym === pseudonym;
  const isAssistant = message.fromAgent;
  const displayName = normalizeAssistantPseudonym(message, botName);
  const replyCount = replies.length || message.replyCount || 0;

  // Handle tap and hold for mobile
  const handleTouchStart = () => {
    touchTimerRef.current = setTimeout(() => {
      setShowReplyButton(true);
    }, 500); // 500ms hold to show reply button
  };

  const handleTouchEnd = () => {
    if (touchTimerRef.current) {
      clearTimeout(touchTimerRef.current);
      touchTimerRef.current = null;
    }
  };

  const handleTouchMove = () => {
    if (touchTimerRef.current) {
      clearTimeout(touchTimerRef.current);
      touchTimerRef.current = null;
    }
  };

  const handleReplyClick = () => {
    // Open split pane to reply
    onOpenThread?.(message.id!);
    setShowReplyButton(false);
  };

  // IntersectionObserver to detect when message with unread replies is visible
  useEffect(() => {
    if (!message.id || !onMarkAsRead) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          isCurrentlyVisibleRef.current = entry.isIntersecting;

          if (entry.isIntersecting && hasUnreadReplies) {
            // Only start the timer if this message has been scrolled out of view at least once
            if (hasBeenScrolledOutRef.current) {
              visibilityTimerRef.current = setTimeout(() => {
                onMarkAsRead(message.id!);
              }, 1000);
            }
          } else {
            // Mark that this message has been scrolled out of view
            if (!entry.isIntersecting && hasUnreadReplies) {
              hasBeenScrolledOutRef.current = true;
            }

            // Clear timer if message becomes invisible before 1 second
            if (visibilityTimerRef.current) {
              clearTimeout(visibilityTimerRef.current);
              visibilityTimerRef.current = null;
            }
          }
        });
      },
      {
        threshold: 0.5, // Trigger when at least 50% of the message is visible
      },
    );

    if (messageRef.current) {
      observer.observe(messageRef.current);
    }

    return () => {
      if (visibilityTimerRef.current) {
        clearTimeout(visibilityTimerRef.current);
      }
      observer.disconnect();
    };
  }, [hasUnreadReplies, message.id, onMarkAsRead]);

  // When hasUnreadReplies changes to true, check if message is already visible
  useEffect(() => {
    if (hasUnreadReplies && message.id && onMarkAsRead) {
      // Reset the scrolled-out tracking
      hasBeenScrolledOutRef.current = false;

      // If the message is currently visible, start the timer immediately
      if (isCurrentlyVisibleRef.current) {
        visibilityTimerRef.current = setTimeout(() => {
          onMarkAsRead(message.id!);
        }, 1000);
      }
    }

    return () => {
      if (visibilityTimerRef.current) {
        clearTimeout(visibilityTimerRef.current);
        visibilityTimerRef.current = null;
      }
    };
  }, [hasUnreadReplies, message.id, onMarkAsRead]);

  return (
    <div ref={messageRef} className="w-full">
      {/* Timestamp */}
      {showTimestamp && (
        <div className="flex justify-center my-1">
          <span className="text-sm text-gray-400">
            {new Date(message.createdAt!).toLocaleTimeString("en-US", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </div>
      )}

      {/* Message with avatar - always left-aligned */}
      <div
        className={`flex flex-row gap-1.5 p-2 rounded-[.5rem] transition-all ${isThreadOpen ? "bg-blue-50 border-l-4 border-blue-400 pl-2 py-2 -ml-2 rounded-r-lg" : `${showReplyButton && "bg-white"}`}`}
      >
        {/* Avatar */}
        {renderAvatar(message)}

        {/* Message content column */}
        <div className="flex flex-col items-start flex-1">
          {/* Name */}
          <div className="text-sm font-bold mb-1 text-left">
            {displayName}
            {isCurrentUser && (
              <span className="text-gray-600 font-normal"> (You)</span>
            )}
          </div>

          {/* Message bubble wrapper with hover state - extended to include button area */}
          <div
            className="relative w-full lg:w-[calc(85% + 24px)]"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            onTouchMove={handleTouchMove}
            onMouseEnter={() => setShowReplyButton(true)}
            onMouseLeave={() => setShowReplyButton(false)}
          >
            {/* Message bubble - renderMessageContent provides the complete styled bubble */}
            <div className="relative flex flex-row gap-1 lg:gap-4">
              {renderMessageContent(message)}

              {/* Reply button pill - reply icon in top right */}
              {showReplyButton && (
                <IconButton
                  onClick={handleReplyClick}
                  onMouseEnter={() => setShowReplyButton(true)}
                  size="small"
                  aria-label={`Reply to ${displayName}`}
                  sx={{
                    width: 32,
                    height: 32,
                    backgroundColor: "white",
                    border: "1.5px solid #d1d5db",
                    boxShadow: "0 4px 6px rgba(0,0,0,0.15)",
                    transition: "all 0.2s ease",
                    "&:hover": {
                      backgroundColor: "#4A0979",
                      borderColor: "#4A0979",
                      boxShadow: "0 6px 12px rgba(74,9,121,0.3)",
                      "& svg": {
                        color: "white",
                      },
                    },
                  }}
                >
                  <Reply sx={{ fontSize: 18, color: "#6b7280" }} />
                </IconButton>
              )}
            </div>
          </div>

          {/* First reply preview - always left-aligned */}
          {replies.length > 0 && replies[0] && (
            <div className="border-l-2 border-gray-300 pl-3 mt-2 w-full relative">
              {/* Unread indicator - dot */}
              {hasUnreadReplies && !isThreadOpen && (
                <div
                  className="absolute -left-[5px] top-2"
                  style={{
                    width: "10px",
                    height: "10px",
                    borderRadius: "50%",
                    backgroundColor: "#7C3AED",
                  }}
                />
              )}
              <div className="flex gap-1.5 flex-row">
                {/* Avatar */}
                {renderAvatar(replies[0])}

                {/* Message content */}
                <div className="flex flex-col items-start flex-1">
                  {/* Name */}
                  <div className="text-sm font-bold mb-1 text-left">
                    {normalizeAssistantPseudonym(replies[0], botName)}
                    {replies[0].pseudonym === pseudonym && (
                      <span className="text-gray-600 font-normal"> (You)</span>
                    )}
                  </div>

                  {/* Message bubble */}
                  {renderMessageContent(replies[0])}

                  {/* Feedback - rendered below the bubble for Event Assistant messages */}
                  {replies[0].fromAgent &&
                    replies[0].id &&
                    feedbackConfig &&
                    feedbackConfig.eligibleMessageIds.has(replies[0].id) && (
                      <div className="mt-0" style={{ width: "85%" }}>
                        <MessageFeedback
                          messageId={replies[0].id}
                          initialRating={feedbackConfig.messageRatings.get(
                            replies[0].id,
                          )}
                          onPopulateFeedbackText={
                            feedbackConfig.onPopulateFeedbackText
                          }
                          onSendFeedbackRating={feedbackConfig.onSendRating}
                        />
                      </div>
                    )}
                </div>
              </div>

              {/* Clickable indicator for additional replies */}
              {replyCount > 1 && (
                <button
                  onClick={() => {
                    if (showExpandButton) {
                      // Second tap/click - open the thread
                      onOpenThread?.(message.id!);
                      setShowExpandButton(false);
                    } else {
                      // First tap/click - show the expand button
                      setShowExpandButton(true);
                    }
                  }}
                  onMouseEnter={() => {
                    setIsReplyIndicatorPressed(true);
                    setShowExpandButton(true);
                  }}
                  onMouseLeave={() => {
                    setIsReplyIndicatorPressed(false);
                    setShowExpandButton(false);
                  }}
                  onTouchStart={() => setIsReplyIndicatorPressed(true)}
                  onTouchEnd={() => setIsReplyIndicatorPressed(false)}
                  className={`mt-2 -ml-3 px-3 py-2 text-xs text-gray-600 hover:bg-white active:bg-white transition-colors cursor-pointer flex items-center justify-between w-[calc(100%+0.75rem)] group ${isReplyIndicatorPressed ? "bg-white" : ""} ${hasUnreadReplies && !isThreadOpen ? "font-bold" : "font-medium"}`}
                  aria-label={`View ${replyCount - 1} more ${replyCount - 1 === 1 ? "reply" : "replies"}`}
                >
                  <div className="flex items-center gap-1">
                    <ChatBubbleOutline sx={{ fontSize: 14 }} />
                    <span>
                      + {replyCount - 1} more{" "}
                      {replyCount - 1 === 1 ? "reply" : "replies"}
                    </span>
                  </div>
                  <ChevronRight
                    sx={{ fontSize: 16 }}
                    className={`transition-opacity ${showExpandButton ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
                  />
                </button>
              )}
            </div>
          )}

          {/* Feedback - rendered below the bubble for Event Assistant messages */}
          {isAssistant &&
            message.id &&
            feedbackConfig &&
            feedbackConfig.eligibleMessageIds.has(message.id) && (
              <div className="mt-0" style={{ width: "85%" }}>
                <MessageFeedback
                  messageId={message.id}
                  initialRating={feedbackConfig.messageRatings.get(message.id)}
                  onPopulateFeedbackText={feedbackConfig.onPopulateFeedbackText}
                  onSendFeedbackRating={feedbackConfig.onSendRating}
                />
              </div>
            )}
        </div>
      </div>
    </div>
  );
};
