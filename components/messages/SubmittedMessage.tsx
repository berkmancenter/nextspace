import { FC } from "react";
import { Box, Typography } from "@mui/material";
import { AccountCircle } from "@mui/icons-material";
import { BaseMessage, MessageContent } from "./BaseMessage";
import { MessageProps } from "../../types.internal";

export const SubmittedMessage: FC<MessageProps> = ({ message }) => {
  return (
    <BaseMessage className="bg-gray-100 border-l-4 border-gray-600 rounded-lg p-3">
      <Box display="flex" alignItems="center" gap="8px" marginBottom="8px">
        <AccountCircle
          sx={{
            color: "#6B7280",
            fontSize: "20px",
          }}
        />
        <Typography
          variant="caption"
          component="p"
          className="text-xs text-gray-600 font-bold uppercase"
        >
          You Asked
        </Typography>
      </Box>

      <MessageContent text={message.body as string} />
    </BaseMessage>
  );
};
