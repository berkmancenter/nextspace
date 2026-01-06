import { FC, useState } from "react";
import { Box, Button, alpha } from "@mui/material";
import { Check } from "@mui/icons-material";
import { BaseMessage, MessageContent } from "./BaseMessage";
import { MessageFeedback } from "../MessageFeedback";
import { ControlledInputConfig, MessageProps } from "../../types.internal";

export interface AssistantMessageProps extends MessageProps {
  onPromptSelect?: (value: string, parentMessageId?: string) => void;
  onPopulateFeedbackText?: (config: ControlledInputConfig) => void;
  onSendFeedbackRating?: (messageId: string, rating: string) => void;
  messageType?: string;
}

export const AssistantMessage: FC<AssistantMessageProps> = ({
  message,
  onPromptSelect,
  onPopulateFeedbackText,
  onSendFeedbackRating,
  messageType,
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
    : "bg-light-gray rounded-2xl p-3";

  return (
    <BaseMessage className={className}>
      {!hasPromptOptions && (
        <p className="py-3 text-xs text-dark-blue font-bold uppercase">
          Event Assistant
        </p>
      )}

      <MessageContent text={message.body as string} />

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

      {message.id && !messageType && (
        <MessageFeedback
          messageId={message.id}
          onPopulateFeedbackText={onPopulateFeedbackText}
          onSendFeedbackRating={onSendFeedbackRating}
        />
      )}
    </BaseMessage>
  );
};
