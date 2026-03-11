import { FC, useState } from "react";
import { Box, Button, alpha } from "@mui/material";
import { Check } from "@mui/icons-material";
import { BaseMessage, MessageContent } from "./BaseMessage";
import { MessageProps, MediaItem } from "../../types.internal";

export interface AssistantMessageProps extends MessageProps {
  onPromptSelect?: (value: string, parentMessageId?: string) => void;
  media?: MediaItem[];
  onImageClick?: (src: string, mimeType: string) => void;
  onMarkmapClick?: (markdown: string) => void;
}

export const AssistantMessage: FC<AssistantMessageProps> = ({
  message,
  onPromptSelect,
  media,
  onImageClick,
  onMarkmapClick,
}) => {
  const [selectedPrompt, setSelectedPrompt] = useState<string | null>(null);

  const handlePromptClick = (value: string) => {
    if (selectedPrompt !== null) return;
    setSelectedPrompt(value);
    onPromptSelect?.(value, message.id);
  };

  // Determine styling based on whether message has prompt options
  // Right now, only single choice options are supported as buttons
  const hasPromptOptions =
    message.prompt?.options &&
    message.prompt.options.length > 0 &&
    message.prompt.type === "singleChoice";

  const className = hasPromptOptions
    ? "bg-purple-100 border-l-4 border-purple-500 rounded-lg p-3"
    : "";

  return (
    <BaseMessage className={className}>
      <MessageContent text={message.body as string} onMarkmapClick={onMarkmapClick} />

      {/* Render media items */}
      {media && media.length > 0 && (
        <Box
          marginTop="1rem"
          display="flex"
          flexDirection="column"
          gap="0.5rem"
        >
          {media.map((item, index) => {
            if (item.type === "image") {
              const imgSrc = `data:${item.mimeType};base64,${item.data}`;
              return (
                <img
                  key={`media-${index}`}
                  src={imgSrc}
                  alt="Visual response"
                  role="button"
                  tabIndex={0}
                  className="hover:scale-105"
                  style={{
                    maxWidth: "100%",
                    height: "auto",
                    borderRadius: "8px",
                    border: "1px solid rgba(0, 0, 0, 0.1)",
                    cursor: "pointer",
                    transition: "transform 0.2s ease-in-out",
                  }}
                  onClick={() => onImageClick?.(imgSrc, item.mimeType)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onImageClick?.(imgSrc, item.mimeType);
                    }
                  }}
                />
              );
            }
            // Future: handle audio, video types here
            return null;
          })}
        </Box>
      )}

      {hasPromptOptions && (
        <Box display="flex" flexWrap="wrap" gap="0.5rem" marginTop="1rem">
          {message.prompt!.options!.map((option, index) => (
            <Button
              key={`prompt-${message.id}-${index}`}
              variant="outlined"
              size="small"
              onClick={() => handlePromptClick(option.value)}
              disabled={selectedPrompt !== null}
              className={
                selectedPrompt === option.value
                  ? "border-2 border-primary text-primary"
                  : "border-2 border-gray-300 text-gray-700"
              }
              sx={{
                minWidth: "64px",
                height: "40px",
                paddingX: "16px",
                borderRadius: "6px",
                backgroundColor: (theme) =>
                  selectedPrompt === option.value
                    ? alpha(theme.palette.primary.main, 0.08)
                    : "white",
                textTransform: "none",
                fontSize: "0.875rem",
                fontWeight: 500,
                "&:hover": {
                  borderWidth: "2px",
                  backgroundColor: (theme) =>
                    selectedPrompt === option.value
                      ? alpha(theme.palette.primary.main, 0.12)
                      : theme.palette.action.hover,
                },
                "&:focus-visible": {
                  outline: "2px solid",
                  outlineColor: "primary.main",
                  outlineOffset: "2px",
                },
                "&.Mui-disabled": {
                  borderWidth: "2px",
                  borderColor: (theme) => theme.palette.action.disabled,
                  color: (theme) => theme.palette.text.disabled,
                  backgroundColor: "transparent",
                },
              }}
            >
              {selectedPrompt === option.value ? (
                <>
                  <Check fontSize="small" aria-hidden="true" sx={{ mr: 0.5 }} />
                  {option.label}
                </>
              ) : (
                option.label
              )}
            </Button>
          ))}
        </Box>
      )}
    </BaseMessage>
  );
};
