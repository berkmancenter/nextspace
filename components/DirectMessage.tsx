import { CheckCircle, CheckCircleOutline } from "@mui/icons-material";
import { Box } from "@mui/material";
import { FC, useEffect, useState } from "react";
import Linkify from "linkify-react";
/**
 * Props for the DirectMessage component
 * @property {string} text - The text of the message.
 * @property {Date} date - The date the message was sent.
 * @property {"none" | "assistant" | "backchannel"} [theme] - The theme of the message, "assistant" or "backchannel", defaults to "none".
 */
interface DirectMessageProps {
  text: string;
  date: Date;
  theme?: "none" | "assistant" | "backchannel";
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
}) => {
  const [isMessageSent, setIsMessageSent] = useState(false);
  let themeClass = "w-full my-1 px-4";
  if (theme === "assistant")
    themeClass = `${themeClass} bg-light-gray rounded-2xl`;
  else if (theme === "backchannel")
    themeClass = `${themeClass} bg-[#E0E7FF] rounded-lg`;

  useEffect(() => {
    setTimeout(() => {
      // Simulate message sent state change
      setIsMessageSent(true);
    }, Math.floor(Math.random() * (2700 - 500 + 1)) + 500);
  }, [isMessageSent]);

  return (
    <Box display="flex" flexDirection="column" rowGap=".5rem">
      <div className={`block ${themeClass}`}>
        {theme === "assistant" && (
          <p className="pt-2 pb-3 text-xs text-dark-blue font-bold uppercase">
            Event Assistant
          </p>
        )}
        <Linkify
          options={{
            attributes: {
              class: "text-medium-slate-blue",
              target: "_blank",
              rel: "noopener noreferrer",
            },
          }}
        >
          {text}
        </Linkify>
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
    </Box>
  );
};
