import { FC, useState, useEffect } from "react";
import { Box } from "@mui/material";
import { CheckCircle, CheckCircleOutline } from "@mui/icons-material";
import { MessageContent } from "./BaseMessage";
import { MessageProps } from "../../types.internal";

export const BackchannelMessage: FC<MessageProps> = ({ message }) => {
  const [isMessageSent, setIsMessageSent] = useState(false);

  const messageDate = message.createdAt
    ? new Date(message.createdAt)
    : new Date();

  // Simulate message sent state
  useEffect(() => {
    const timeout = setTimeout(() => {
      setIsMessageSent(true);
    }, Math.floor(Math.random() * 2200) + 500);

    return () => clearTimeout(timeout);
  }, []);

  return (
    <Box display="flex" flexDirection="column" rowGap=".5rem">
      <div className="block w-full my-1 px-4 bg-[#E0E7FF] rounded-lg">
        <MessageContent text={message.body as string} />
      </div>

      <p className="text-sm text-neutral-400 self-end">
        {messageDate.toLocaleTimeString()}
        <span className="ml-2">
          {isMessageSent ? (
            <CheckCircle fontSize="small" />
          ) : (
            <CheckCircleOutline fontSize="small" />
          )}
        </span>
      </p>
    </Box>
  );
};
