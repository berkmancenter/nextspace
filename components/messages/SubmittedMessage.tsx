import { FC } from "react";
import { Box, Typography } from "@mui/material";
import { BaseMessage, MessageContent } from "./BaseMessage";
import { MessageProps } from "../../types.internal";
import { getAvatarStyle } from "../../utils/avatarUtils";

// Helper function to darken a hex color
const darkenColor = (hex: string, percent: number): string => {
  const num = parseInt(hex.replace("#", ""), 16);
  const r = Math.max(0, Math.floor((num >> 16) * (1 - percent)));
  const g = Math.max(0, Math.floor(((num >> 8) & 0x00FF) * (1 - percent)));
  const b = Math.max(0, Math.floor((num & 0x0000FF) * (1 - percent)));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
};

export const SubmittedMessage: FC<MessageProps> = ({ message }) => {
  const style = getAvatarStyle(message.pseudonym, true);
  const AvatarIcon = style.icon;
  const borderColor = darkenColor(style.avatarBg, 0.2);

  return (
    <BaseMessage>
      <div
        className="ml-15 border-l-4 rounded-lg p-3"
        style={{
          backgroundColor: style.avatarBg,
          borderLeftColor: borderColor,
        }}
      >
        <Box display="flex" alignItems="center" gap="8px" marginBottom="8px">
          <AvatarIcon
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
      </div>
    </BaseMessage>
  );
};
