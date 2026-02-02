import { FC } from "react";
import { Box, Typography } from "@mui/material";
import { CheckCircleOutline } from "@mui/icons-material";
import { BaseMessage, MessageContent } from "./BaseMessage";
import { MessageProps } from "../../types.internal";

export const ModeratorSubmittedMessage: FC<MessageProps> = ({ message }) => {
  return (
    <BaseMessage>
      <div className="ml-15 bg-blue-50 border-l-4 border-blue-500 rounded-lg p-3">
        <Box display="flex" alignItems="center" gap="8px" marginBottom="8px">
          <CheckCircleOutline
            sx={{
              color: "#3B82F6",
              fontSize: "20px",
            }}
          />
          <Typography
            variant="caption"
            component="p"
            className="text-xs text-blue-600 font-bold uppercase"
          >
            Submitted
          </Typography>
        </Box>

        <MessageContent text={message.body as string} />
      </div>
    </BaseMessage>
  );
};
