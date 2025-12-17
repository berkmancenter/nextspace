import {
  CheckCircle,
  CheckCircleOutline,
  ThumbDown,
  AddComment,
  Check,
  Add,
} from "@mui/icons-material";
import { Box, IconButton, Button } from "@mui/material";
import { FC, useEffect, useState } from "react";
import Linkify from "linkify-react";
/**
 * Configuration for controlled input mode
 * @property {string} prefix - The message prefix to prepend to user input
 * @property {React.ReactNode} icon - The icon to display in the mode indicator
 * @property {string} label - The label to display in the mode indicator
 */
export interface ControlledInputConfig {
  prefix: string;
  icon: React.ReactNode;
  label: string;
}

/**
 * Props for the DirectMessage component
 * @property {string} text - The text of the message.
 * @property {Date} date - The date the message was sent.
 * @property {"none" | "assistant" | "backchannel"} [theme] - The theme of the message, "assistant" or "backchannel", defaults to "none".
 * @property {string} [messageId] - The ID of the message (for feedback).
 * @property {(config: ControlledInputConfig) => void} [onPopulateFeedbackText] - Callback to enter controlled input mode.
 * @property {(messageId: string, rating: number) => void} [onSendFeedbackRating] - Callback to send rating feedback.
 */
interface DirectMessageProps {
  text: string;
  date: Date;
  theme?: "none" | "assistant" | "backchannel";
  messageId?: string;
  onPopulateFeedbackText?: (config: ControlledInputConfig) => void;
  onSendFeedbackRating?: (messageId: string, rating: number) => void;
}

/**
 * DirectMessage component
 *
 * This component renders a message for the assistant or backchannel view.
 */
export const DirectMessage: FC<DirectMessageProps> = ({
  text,
  date,
  theme = "none",
  messageId,
  onPopulateFeedbackText,
  onSendFeedbackRating,
}) => {
  const [isMessageSent, setIsMessageSent] = useState(false);
  const [selectedRating, setSelectedRating] = useState<number | null>(null);
  let themeClass = "w-full my-1";
  if (theme === "assistant")
    themeClass = `${themeClass} bg-light-gray rounded-2xl p-3`;
  else if (theme === "backchannel")
    themeClass = `${themeClass} bg-[#E0E7FF] rounded-lg p-4`;

  useEffect(() => {
    setTimeout(() => {
      // Simulate message sent state change
      setIsMessageSent(true);
    }, Math.floor(Math.random() * (2700 - 500 + 1)) + 500);
  }, [isMessageSent]);

  const handleRatingClick = (rating: number) => {
    if (selectedRating !== null || !messageId || !onSendFeedbackRating) return;
    setSelectedRating(rating);
    onSendFeedbackRating(messageId, rating);
  };

  const handleSayMoreClick = () => {
    if (!messageId || !onPopulateFeedbackText) return;
    onPopulateFeedbackText({
      prefix: `/ShareFeedback|Text|${messageId}|`,
      icon: <AddComment fontSize="small" />,
      label: "Feedback",
    });
  };

  // Replace feedback messages with a user-friendly display
  const isFeedbackMessage = text.startsWith("/ShareFeedback");
  const displayText = isFeedbackMessage ? "User feedback received." : text;

  return (
    <Box display="flex" flexDirection="column" rowGap=".5rem">
      <div className={`block ${themeClass}`}>
        {theme === "assistant" && (
          <p className="py-3 text-xs text-dark-blue font-bold uppercase">
            Event Assistant
          </p>
        )}
        {isFeedbackMessage ? (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-gray-700 italic">
            {displayText}
          </div>
        ) : (
          <Linkify
            options={{
              attributes: {
                class: "text-medium-slate-blue",
                target: "_blank",
                rel: "noopener noreferrer",
              },
            }}
          >
            {displayText}
          </Linkify>
        )}
      </div>
      {theme === "backchannel" && (
        <p className="text-sm text-neutral-400 self-end">
          {new Date(date).toLocaleTimeString()}
          <span className="ml-2">
            {isMessageSent ? (
              <CheckCircle fontSize="small" />
            ) : (
              <CheckCircleOutline fontSize="small" />
            )}
          </span>
        </p>
      )}
      {theme === "assistant" &&
        messageId &&
        onPopulateFeedbackText &&
        onSendFeedbackRating && (
          <Box
            display="flex"
            flexDirection="column"
            gap="0.5rem"
            marginTop="0.25rem"
          >
            {/* Header Row */}
            <Box
              display="flex"
              justifyContent="space-between"
              alignItems="center"
            >
              <span className="text-sm text-gray-600">How did the bot do?</span>
              <Button
                size="small"
                startIcon={<AddComment fontSize="small" />}
                onClick={handleSayMoreClick}
                sx={{
                  textTransform: "none",
                  color: "#2f69c4",
                  fontSize: "0.875rem",
                  "&:hover": {
                    backgroundColor: "rgba(47, 105, 196, 0.04)",
                  },
                }}
              >
                Say more
              </Button>
            </Box>
            {/* Rating Row */}
            <Box display="flex" alignItems="center" gap="0.5rem">
              <ThumbDown sx={{ color: "#6b7280", fontSize: "1.25rem" }} />
              {[1, 2, 3, 4, 5].map((rating) => (
                <Button
                  key={rating}
                  variant="outlined"
                  size="small"
                  onClick={() => handleRatingClick(rating)}
                  disabled={selectedRating !== null}
                  sx={{
                    minWidth: "36px",
                    height: "36px",
                    borderColor:
                      selectedRating === rating ? "#10b981" : "#d1d5db",
                    color: selectedRating === rating ? "#10b981" : "#374151",
                    backgroundColor:
                      selectedRating === rating ? "#f0fdf4" : "white",
                    "&:hover": {
                      borderColor:
                        selectedRating === rating ? "#10b981" : "#9ca3af",
                      backgroundColor:
                        selectedRating === rating ? "#f0fdf4" : "#f9fafb",
                    },
                    "&.Mui-disabled": {
                      borderColor: "#e5e7eb",
                      color: "#9ca3af",
                    },
                  }}
                >
                  {selectedRating === rating ? (
                    <Check fontSize="small" />
                  ) : (
                    rating
                  )}
                </Button>
              ))}
              <Add sx={{ color: "#9ca3af", fontSize: "1.25rem" }} />
            </Box>
          </Box>
        )}
    </Box>
  );
};
