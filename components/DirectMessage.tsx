import { CheckCircle, CheckCircleOutline } from "@mui/icons-material";
import { Box, Typography } from "@mui/material";
import { FC, useEffect, useState } from "react";
import Linkify from "linkify-react";
import { MessageFeedback } from "./MessageFeedback";
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
 * Returns an object with 'message' and 'feedback' components for flexible layout.
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

  // Replace feedback messages with a user-friendly display
  const isFeedbackMessage = text.startsWith("/ShareFeedback");
  const displayText = isFeedbackMessage ? "User feedback received." : text;

  const messageContent = (
    <div className={`block ${themeClass}`}>
      {theme === "assistant" && (
        <p className="py-3 text-xs text-dark-blue font-bold uppercase">
          Event Assistant
        </p>
      )}
      {isFeedbackMessage ? (
        <Box className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <Typography variant="body2" className="text-gray-700 italic">
            {displayText}
          </Typography>
        </Box>
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
  );

  return (
    <Box display="flex" flexDirection="column" rowGap=".5rem">
      {messageContent}
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
      {theme === "assistant" && messageId && (
        <MessageFeedback
          messageId={messageId}
          onPopulateFeedbackText={onPopulateFeedbackText}
          onSendFeedbackRating={onSendFeedbackRating}
        />
      )}
    </Box>
  );
};
