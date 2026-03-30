import React, { FC, useEffect, useCallback, useRef } from "react";
import { Close, Send, ArrowBack } from "@mui/icons-material";
import { IconButton, useMediaQuery, useTheme } from "@mui/material";
import { PseudonymousMessage, FeedbackConfig } from "../types.internal";
import { InputEnhancer, ActiveEnhancerState } from "../types/inputEnhancer";
import { normalizeAssistantPseudonym } from "../utils/Helpers";
import { GenericEnhancerMenu } from "./GenericEnhancerMenu";
import { MessageFeedback } from "./MessageFeedback";
import { BotIcon } from "./BotIcon";

interface ThreadPanelProps {
  parentMessage: PseudonymousMessage;
  replies: PseudonymousMessage[];
  pseudonym: string | null;
  onClose: () => void;
  onSendReply: (text: string, parentId: string) => void;
  renderAvatar: (msg: PseudonymousMessage) => React.ReactNode;
  renderMessageContent: (
    msg: PseudonymousMessage,
    isHovered?: boolean,
  ) => React.ReactNode;
  enhancers: InputEnhancer<any>[];
  botName: string;
  feedbackConfig?: FeedbackConfig;
  waitingForResponse?: boolean;
}

export const ThreadPanel: FC<ThreadPanelProps> = ({
  parentMessage,
  replies,
  pseudonym,
  onClose,
  onSendReply,
  renderAvatar,
  renderMessageContent,
  enhancers,
  botName,
  feedbackConfig,
  waitingForResponse = false,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const [isReplying, setIsReplying] = React.useState(true); // Start with reply input open
  const [replyText, setReplyText] = React.useState("");
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const threadContentRef = useRef<HTMLDivElement>(null);
  const [activeEnhancer, setActiveEnhancer] =
    React.useState<ActiveEnhancerState<any> | null>(null);
  const enterUsedForCommandRef = React.useRef(false);

  // Focus textarea when reply box is opened
  React.useEffect(() => {
    if (isReplying && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isReplying]);

  // Auto-scroll to bottom when new replies come in
  useEffect(() => {
    if (threadContentRef.current) {
      requestAnimationFrame(() => {
        if (threadContentRef.current) {
          threadContentRef.current.scrollTop = threadContentRef.current.scrollHeight;
        }
      });
    }
  }, [replies.length, waitingForResponse]);

  /** Detect triggers for the current value */
  const detectTriggersForValue = useCallback(
    (value: string) => {
      const cursor = textareaRef.current?.selectionStart ?? value.length;

      // Check each enhancer for a trigger match
      for (const enhancer of enhancers) {
        const trigger = enhancer.detectTrigger(value, cursor);

        if (trigger) {
          const items = enhancer.getItems(trigger.query);

          if (items.length > 0) {
            setActiveEnhancer({
              enhancer,
              items,
              selectedIndex: 0,
              trigger,
            });
            return; // Stop at first match
          }
        }
      }

      // No triggers matched
      setActiveEnhancer(null);
    },
    [enhancers]
  );

  // Detect triggers whenever replyText changes
  useEffect(() => {
    if (replyText) {
      detectTriggersForValue(replyText);
    } else {
      setActiveEnhancer(null);
    }
  }, [replyText, detectTriggersForValue]);

  /** Handle item selection from menu */
  const handleEnhancerSelect = (item: any) => {
    if (!activeEnhancer) return;

    const cursor = textareaRef.current?.selectionStart ?? replyText.length;
    const result = activeEnhancer.enhancer.onSelect(item, replyText, cursor);

    setReplyText(result.value);
    setActiveEnhancer(null);

    // Set cursor position
    setTimeout(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(
        result.cursorPos,
        result.cursorPos
      );
    }, 0);
  };

  const handleSendReply = (text: string) => {
    onSendReply(text, parentMessage.id!);
    setReplyText("");
    // Keep reply box open after sending
  };

  const handleCancelReply = () => {
    setIsReplying(false);
    setReplyText("");
  };

  /** Keyboard navigation for enhancer menus */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setActiveEnhancer(null);
      }

      // Menu navigation
      if (activeEnhancer && activeEnhancer.items.length > 0) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setActiveEnhancer((prev) =>
            prev
              ? {
                  ...prev,
                  selectedIndex:
                    prev.selectedIndex < prev.items.length - 1
                      ? prev.selectedIndex + 1
                      : 0,
                }
              : null
          );
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          setActiveEnhancer((prev) =>
            prev
              ? {
                  ...prev,
                  selectedIndex:
                    prev.selectedIndex > 0
                      ? prev.selectedIndex - 1
                      : prev.items.length - 1,
                }
              : null
          );
        } else if (e.key === "Enter" || e.key === "Tab") {
          e.preventDefault();
          // Only suppress the subsequent Enter keyup when Enter itself was used
          // for selection. When Tab is used, no Enter keyup follows, so the flag
          // must stay false — otherwise the next Enter press to send the message
          // gets eaten.
          if (e.key === "Enter") {
            enterUsedForCommandRef.current = true;
          }
          handleEnhancerSelect(
            activeEnhancer.items[activeEnhancer.selectedIndex]
          );
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown as any);
    return () => window.removeEventListener("keydown", handleKeyDown as any);
  }, [activeEnhancer, handleEnhancerSelect]);

  return (
    <div className="flex flex-col h-full border-l-2 border-gray-300 bg-gray-50">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-300 bg-white">
        <div className="flex items-center gap-2">
          {isMobile && (
            <IconButton
              onClick={onClose}
              size="small"
              aria-label="Go back"
              sx={{
                "&:hover": {
                  backgroundColor: "#f3f4f6",
                },
              }}
            >
              <ArrowBack />
            </IconButton>
          )}
          <h3 className="text-lg font-semibold text-gray-900">Replies</h3>
        </div>
        {!isMobile && (
          <IconButton
            onClick={onClose}
            size="small"
            aria-label="Close thread"
            sx={{
              "&:hover": {
                backgroundColor: "#f3f4f6",
              },
            }}
          >
            <Close />
          </IconButton>
        )}
      </div>

      {/* Thread content - scrollable */}
      <div ref={threadContentRef} className="flex-1 overflow-y-auto px-4 py-4">
        {/* Parent message - always left-aligned in thread view */}
        <div className="mb-6">
          <div className="text-xs font-semibold text-gray-500 uppercase mb-2">
            Original Message
          </div>
          <div className="flex gap-1.5 flex-row">
            {/* Avatar */}
            {renderAvatar(parentMessage)}

            {/* Message content */}
            <div className="flex flex-col items-start flex-1">
              {/* Name and timestamp */}
              <div className="text-sm font-bold mb-1 text-left">
                {normalizeAssistantPseudonym(parentMessage, botName)}
                {parentMessage.pseudonym === pseudonym && (
                  <span className="text-gray-600 font-normal"> (You)</span>
                )}
                {parentMessage.createdAt && (
                  <span className="text-xs font-normal text-gray-400 ml-2">
                    {new Date(parentMessage.createdAt).toLocaleTimeString("en-US", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                )}
              </div>

              {/* Message bubble */}
              {renderMessageContent(parentMessage)}

              {/* Feedback - rendered below the bubble for Event Assistant messages */}
              {parentMessage.fromAgent &&
                parentMessage.id &&
                feedbackConfig &&
                feedbackConfig.eligibleMessageIds.has(parentMessage.id) && (
                  <div className="mt-0" style={{ width: "85%" }}>
                    <MessageFeedback
                      messageId={parentMessage.id}
                      initialRating={feedbackConfig.messageRatings.get(
                        parentMessage.id,
                      )}
                      onPopulateFeedbackText={feedbackConfig.onPopulateFeedbackText}
                      onSendFeedbackRating={feedbackConfig.onSendRating}
                    />
                  </div>
                )}
            </div>
          </div>
        </div>

        {/* Divider */}
        {replies.length > 0 && (
          <div className="border-t border-gray-300 mb-4">
            <div className="text-xs font-semibold text-gray-500 uppercase mt-4 mb-2">
              {replies.length} {replies.length === 1 ? "Reply" : "Replies"}
            </div>
          </div>
        )}

        {/* Replies - all left-aligned */}
        <div className="space-y-4">
          {replies.map((reply, idx) => (
            <div
              key={`reply-${reply.id}-${idx}`}
              className="flex gap-1.5 flex-row"
            >
              {/* Avatar */}
              {renderAvatar(reply)}

              {/* Message content */}
              <div className="flex flex-col items-start flex-1">
                {/* Name and timestamp */}
                <div className="text-sm font-bold mb-1 text-left">
                  {normalizeAssistantPseudonym(reply, botName)}
                  {reply.pseudonym === pseudonym && (
                    <span className="text-gray-600 font-normal"> (You)</span>
                  )}
                  {reply.createdAt && (
                    <span className="text-xs font-normal text-gray-400 ml-2">
                      {new Date(reply.createdAt).toLocaleTimeString("en-US", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  )}
                </div>

                {/* Message bubble */}
                {renderMessageContent(reply)}

                {/* Feedback - rendered below the bubble for Event Assistant messages */}
                {reply.fromAgent &&
                  reply.id &&
                  feedbackConfig &&
                  feedbackConfig.eligibleMessageIds.has(reply.id) && (
                    <div className="mt-0" style={{ width: "85%" }}>
                      <MessageFeedback
                        messageId={reply.id}
                        initialRating={feedbackConfig.messageRatings.get(reply.id)}
                        onPopulateFeedbackText={feedbackConfig.onPopulateFeedbackText}
                        onSendFeedbackRating={feedbackConfig.onSendRating}
                      />
                    </div>
                  )}
              </div>
            </div>
          ))}
        </div>

        {/* Bot loading indicator - appears when waiting for threaded reply */}
        {waitingForResponse && (
          <div className="flex items-center gap-1 mt-4">
            <BotIcon size={32} color="#4b5563" bouncing={true} />
            <span className="text-xs text-gray-500 italic">thinking...</span>
          </div>
        )}

        {/* Reply action area - directly below messages */}
        <div className="pt-4">
        {isReplying ? (
          <div className="border-[1px] border-[#A5B4FC] rounded-lg bg-white transition-all focus-within:border-[#6366f1] focus-within:shadow-md">
            <textarea
              ref={textareaRef}
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              onKeyDown={(e) => {
                // Don't handle Enter if menu is active (it's handled in the global listener)
                if (activeEnhancer && (e.key === "Enter" || e.key === "ArrowUp" || e.key === "ArrowDown" || e.key === "Tab")) {
                  return;
                }

                if (e.key === "Enter" && !e.shiftKey) {
                  // Check if this Enter press was used for command selection
                  if (enterUsedForCommandRef.current) {
                    enterUsedForCommandRef.current = false;
                    e.preventDefault();
                    return;
                  }

                  e.preventDefault();
                  if (replyText.trim()) {
                    handleSendReply(replyText);
                    setReplyText("");
                  }
                } else if (e.key === "Escape") {
                  handleCancelReply();
                }
              }}
              placeholder="Reply..."
              className="w-full resize-none focus:outline-none text-base px-3 pt-2 pb-0"
              rows={1}
            />
            <div className="flex items-center justify-between px-2 pb-1">
              {/* Enhancer buttons at bottom left */}
              <div className="flex gap-1">
                {enhancers.map((enhancer) => {
                  const isActive = activeEnhancer?.enhancer.id === enhancer.id;
                  return (
                    <IconButton
                      key={enhancer.id}
                      onClick={() => {
                        const cursor =
                          textareaRef.current?.selectionStart ?? replyText.length;
                        const result = enhancer.button.onClick(replyText, cursor);
                        setReplyText(result.value);
                        setTimeout(() => {
                          textareaRef.current?.focus();
                          textareaRef.current?.setSelectionRange(
                            result.cursorPos,
                            result.cursorPos
                          );
                        }, 0);
                      }}
                      size="small"
                      title={enhancer.button.getTitle(isActive)}
                      sx={{
                        padding: "6px",
                        fontSize: "0.875rem",
                        color: "#374151",
                        backgroundColor: "#e5e7eb",
                        borderRadius: "50%",
                        width: "32px",
                        height: "32px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        "&:hover": {
                          backgroundColor: "#d1d5db",
                        },
                      }}
                    >
                      {enhancer.button.icon}
                    </IconButton>
                  );
                })}
              </div>
              {/* Send button at bottom right */}
              <IconButton
                onClick={() => {
                  if (replyText.trim()) {
                    handleSendReply(replyText);
                    setReplyText("");
                  }
                }}
                disabled={!replyText.trim()}
                aria-label="Send reply"
                sx={{ padding: 0 }}
              >
                <Send
                  sx={{
                    opacity: replyText.trim() ? 1 : 0.5,
                    color: "white",
                    backgroundColor: "#2f69c4",
                    borderRadius: "50%",
                    padding: "4px",
                    transform: "rotate(-45deg)",
                    fontSize: 20,
                  }}
                />
              </IconButton>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setIsReplying(true)}
            className="w-full border border-gray-300 rounded-lg hover:bg-gray-50 px-4 py-3 text-sm text-gray-700 text-left transition-colors"
          >
            Reply to thread...
          </button>
        )}
        </div>
      </div>

      {/* Mention menu popup */}
      {activeEnhancer && (
        <GenericEnhancerMenu
          items={activeEnhancer.items}
          selectedIndex={activeEnhancer.selectedIndex}
          onSelect={handleEnhancerSelect}
          renderItem={activeEnhancer.enhancer.renderItem}
          getItemKey={(_item, index) =>
            `${activeEnhancer.enhancer.id}-${index}`
          }
          anchorEl={textareaRef.current}
          open={true}
        />
      )}
    </div>
  );
};
