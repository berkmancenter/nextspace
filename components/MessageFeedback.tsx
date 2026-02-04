import { FC, useState, useRef, useEffect, KeyboardEvent } from "react";
import { Box, Button, Typography, Link, alpha } from "@mui/material";
import { Check, AddCommentOutlined } from "@mui/icons-material";
import { ControlledInputConfig } from "../types.internal";

/**
 * Rating button labels - modify these to change the button text
 */
const RATING_LABELS = {
  NEGATIVE: "No",
  NEUTRAL_LOW: "Meh",
  NEUTRAL_HIGH: "OK",
  POSITIVE: "WOW!",
} as const;

/**
 * VisuallyHidden component for screen reader only content
 */
const VisuallyHidden: FC<{ children: React.ReactNode }> = ({ children }) => (
  <span
    style={{
      position: "absolute",
      width: "1px",
      height: "1px",
      padding: "0",
      margin: "-1px",
      overflow: "hidden",
      clip: "rect(0, 0, 0, 0)",
      whiteSpace: "nowrap",
      border: "0",
    }}
  >
    {children}
  </span>
);

/**
 * Props for the MessageFeedback component
 */
interface MessageFeedbackProps {
  messageId?: string;
  onPopulateFeedbackText?: (config: ControlledInputConfig) => void;
  onSendFeedbackRating?: (messageId: string, rating: string) => void;
}

/**
 * MessageFeedback component
 *
 * This component renders the feedback UI for assistant messages, including
 * three feedback buttons: negative, neutral and positive
 */
export const MessageFeedback: FC<MessageFeedbackProps> = ({
  messageId,
  onPopulateFeedbackText,
  onSendFeedbackRating,
}) => {
  const [selectedFeedback, setSelectedFeedback] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState<string>("");
  const [focusedButton, setFocusedButton] = useState<number>(0);
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const feedbackOptions = [
    { text: RATING_LABELS.NEGATIVE, label: RATING_LABELS.NEGATIVE },
    { text: RATING_LABELS.NEUTRAL_LOW, label: RATING_LABELS.NEUTRAL_LOW },
    { text: RATING_LABELS.NEUTRAL_HIGH, label: RATING_LABELS.NEUTRAL_HIGH },
    { text: RATING_LABELS.POSITIVE, label: RATING_LABELS.POSITIVE },
  ];

  const handleFeedbackClick = (feedbackText: string) => {
    if (selectedFeedback !== null || !messageId || !onSendFeedbackRating)
      return;
    setSelectedFeedback(feedbackText);
    setAnnouncement(`${feedbackText} selected`);
    onSendFeedbackRating(messageId, feedbackText);
  };

  const handleKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    index: number
  ) => {
    if (selectedFeedback !== null) return;

    let nextIndex: number | null = null;

    switch (event.key) {
      case "ArrowLeft":
      case "ArrowUp":
        event.preventDefault();
        nextIndex = index > 0 ? index - 1 : feedbackOptions.length - 1;
        break;
      case "ArrowRight":
      case "ArrowDown":
        event.preventDefault();
        nextIndex = index < feedbackOptions.length - 1 ? index + 1 : 0;
        break;
      case " ":
      case "Enter":
        event.preventDefault();
        handleFeedbackClick(feedbackOptions[index].text);
        return;
    }

    if (nextIndex !== null) {
      setFocusedButton(nextIndex);
      buttonRefs.current[nextIndex]?.focus();
    }
  };

  useEffect(() => {
    // Clear announcement after it's been read
    if (announcement) {
      const timer = setTimeout(() => setAnnouncement(""), 1000);
      return () => clearTimeout(timer);
    }
  }, [announcement]);

  const handleSayMoreClick = () => {
    if (!messageId || !onPopulateFeedbackText) return;
    onPopulateFeedbackText({
      prefix: `/feedback|Text|${messageId}|`,
      icon: <AddCommentOutlined fontSize="small" />,
      label: "Feedback Mode",
    });
  };

  if (!messageId || !onPopulateFeedbackText || !onSendFeedbackRating) {
    return null;
  }

  return (
    <Box display="flex" flexDirection="column" gap="0.5rem" marginTop="0.25rem">
      {/* Live region for announcements */}
      <div aria-live="polite" aria-atomic="true">
        <VisuallyHidden>{announcement}</VisuallyHidden>
      </div>

      {/* Header Row */}
      <Typography
        variant="caption"
        id="rating-group-label"
        className="text-gray-600"
      >
        How did the bot do?
      </Typography>
      {/* Feedback Buttons Row */}
      <Box
        display="flex"
        alignItems="center"
        gap="0.5rem"
        role="radiogroup"
        aria-labelledby="rating-group-label"
      >
        {feedbackOptions.map((option, index) => (
          <Button
            key={option.text}
            ref={(el) => {
              buttonRefs.current[index] = el;
            }}
            variant="outlined"
            size="small"
            onClick={() => handleFeedbackClick(option.text)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            disabled={selectedFeedback !== null}
            role="radio"
            aria-checked={selectedFeedback === option.text}
            aria-label={option.label}
            tabIndex={
              selectedFeedback !== null ? -1 : focusedButton === index ? 0 : -1
            }
            className={
              selectedFeedback === option.text
                ? "border border-primary text-primary"
                : "border text-primary"
            }
            sx={{
              minWidth: "44px",
              height: "30px",
              paddingX: "10px",
              borderRadius: "5px",
              borderWidth: "1px",
              borderColor:
                selectedFeedback === option.text ? undefined : "#666666",
              backgroundColor: (theme) =>
                selectedFeedback === option.text
                  ? alpha(theme.palette.primary.main, 0.08)
                  : "white",
              textTransform: "none",
              fontSize: "0.6875rem",
              fontWeight: 700,
              "&:hover": {
                borderWidth: "1px",
                borderColor: "#4A0979",
                backgroundColor: "#4A0979",
                color: "white",
              },
              "&:focus-visible": {
                outline: "2px solid",
                outlineColor: "primary.main",
                outlineOffset: "2px",
              },
              "&.Mui-disabled": {
                borderWidth: "1px",
                borderColor: (theme) => theme.palette.action.disabled,
                color: (theme) => theme.palette.text.disabled,
                backgroundColor: "transparent",
              },
            }}
          >
            {selectedFeedback === option.text ? (
              <>
                <Check fontSize="small" aria-hidden="true" sx={{ mr: 0.25 }} />
                {option.text}
              </>
            ) : (
              option.text
            )}
          </Button>
        ))}
      </Box>

      {/* Conditional "Say More" Message - shown after rating selection */}
      {selectedFeedback !== null && (
        <Box className="bg-light-gray rounded-2xl p-3" marginTop="0.5rem">
          <Typography variant="body2">
            Thank you for your input!{" "}
            <Link
              component="button"
              onClick={handleSayMoreClick}
              className="text-medium-slate-blue"
              sx={{
                cursor: "pointer",
                textDecoration: "underline",
                "&:hover": {
                  textDecoration: "none",
                },
              }}
            >
              Would you like to share more?
            </Link>
          </Typography>
        </Box>
      )}
    </Box>
  );
};
