import { FC, useState, useEffect } from 'react';
import { Box, Button } from '@mui/material';
import { Check } from '@mui/icons-material';
import { MessageContent } from './MessageContent';
import { MessageProps, MediaItem } from '../../types.internal';

export interface AssistantMessageProps extends MessageProps {
  onPromptSelect?: (value: string, promptMessageId?: string) => void;
  media?: MediaItem[];
  onImageClick?: (src: string, mimeType: string) => void;
  onMarkmapClick?: (markdown: string) => void;
  initialSelectedPrompt?: string;
  /** The parsed message body's `type` field. The answerable prompt UI itself applies to any
   * message with a `prompt` shape, but the "Starting point" label is specific to warm-up
   * questions, so this scopes just that label to messages actually meant to carry it. */
  messageType?: string;
}

export const AssistantMessage: FC<AssistantMessageProps> = ({
  message,
  onPromptSelect,
  media,
  onImageClick,
  onMarkmapClick,
  initialSelectedPrompt,
  messageType,
}) => {
  const [selectedPrompt, setSelectedPrompt] = useState<string | null>(initialSelectedPrompt || null);
  const [textValue, setTextValue] = useState('');

  // Sync with initialSelectedPrompt when it changes (e.g., on page load/refresh)
  useEffect(() => {
    if (initialSelectedPrompt !== undefined) {
      setSelectedPrompt(initialSelectedPrompt);
    }
  }, [initialSelectedPrompt]);

  const handlePromptClick = (value: string) => {
    if (selectedPrompt !== null) return;
    setSelectedPrompt(value);
    onPromptSelect?.(value, message.id);
  };

  const handleTextSubmit = () => {
    const trimmed = textValue.trim();
    if (!trimmed) return;
    handlePromptClick(trimmed);
  };

  // Single choice renders as buttons; text renders as a textarea + Submit — for any message
  // with this shape, regardless of why it has one.
  const hasChoiceOptions =
    message.prompt?.options && message.prompt.options.length > 0 && message.prompt.type === 'singleChoice';
  const isTextPrompt = message.prompt?.type === 'text';
  // The "Starting point" label is specific to warm-up questions, though — scoped separately so a
  // future prompt added for a different reason doesn't inherit framing that wouldn't fit it.
  const isWarmUpQuestion = messageType === 'warmUpQuestion';
  const hasPromptOptions = hasChoiceOptions || isTextPrompt;

  const mediaBlock = media && media.length > 0 && (
    <Box marginTop="1rem" display="flex" flexDirection="column" gap="0.5rem">
      {media.map((item, index) => {
        if (item.type === 'image') {
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
                maxWidth: '100%',
                height: 'auto',
                borderRadius: '8px',
                border: '1px solid rgba(0, 0, 0, 0.1)',
                cursor: 'pointer',
                transition: 'transform 0.2s ease-in-out',
              }}
              onClick={() => onImageClick?.(imgSrc, item.mimeType)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
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
  );

  if (!hasPromptOptions) {
    return (
      <Box display="flex" flexDirection="column" rowGap=".5rem">
        <div className="block w-full my-1">
          <MessageContent text={message.body as string} onMarkmapClick={onMarkmapClick} />
          {mediaBlock}
        </div>
      </Box>
    );
  }

  // A prompted message (single choice or free text) gets its own card, styled like PollMessage's
  // (same --nx-poll-* tokens, header/divider/body layout) rather than a block of warning color —
  // "needs a response" should read as an invitation, not an alert.
  return (
    <Box display="flex" flexDirection="column" rowGap=".5rem">
      <div
        className="w-full my-1"
        style={{
          borderRadius: '10px',
          overflow: 'hidden',
          backgroundColor: 'var(--nx-poll-bg)',
          border: '1px solid var(--nx-poll-border)',
        }}
      >
        <div style={{ padding: '0.625rem 0.875rem 0.5rem', borderBottom: '1px solid var(--nx-poll-divider)' }}>
          <div className="flex flex-col items-start gap-1.5">
            {isWarmUpQuestion && (
              <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-nx-pill px-2.5 py-1 text-[11px] font-medium text-nx-pill-text">
                Starting point
              </span>
            )}
            <MessageContent text={message.body as string} onMarkmapClick={onMarkmapClick} />
          </div>
          {mediaBlock}
        </div>

        <div style={{ padding: '0.625rem 0.875rem 0.75rem' }}>
          {hasChoiceOptions && (
            // Styled like PollMessage's own choice rows (radio dot, row divider, selected-row
            // tint) rather than as discrete buttons — keeps a real <button> underneath for
            // keyboard/AT support, just with the button chrome stripped off.
            <Box display="flex" flexDirection="column">
              {message.prompt!.options!.map((option, index) => {
                const isSelected = selectedPrompt === option.value;
                return (
                  <Button
                    key={`prompt-${message.id}-${index}`}
                    disableRipple
                    onClick={() => handlePromptClick(option.value)}
                    disabled={selectedPrompt !== null}
                    sx={{
                      justifyContent: 'flex-start',
                      alignItems: 'center',
                      gap: '0.5rem',
                      width: '100%',
                      borderRadius: 0,
                      borderTop: index > 0 ? '1px solid var(--nx-poll-row-divider)' : 'none',
                      padding: '0.5rem 0',
                      textTransform: 'none',
                      textAlign: 'left',
                      fontSize: '0.9375rem',
                      fontWeight: isSelected ? 600 : 400,
                      color: isSelected ? 'var(--nx-poll-text)' : 'var(--nx-poll-choice)',
                      backgroundColor: isSelected ? 'var(--nx-poll-selected-bg)' : 'transparent',
                      '&:hover': {
                        backgroundColor: isSelected ? 'var(--nx-poll-selected-bg)' : 'action.hover',
                      },
                      '&:focus-visible': {
                        outline: '2px solid',
                        outlineColor: 'primary.main',
                        outlineOffset: '-2px',
                      },
                      '&.Mui-disabled': {
                        color: isSelected ? 'var(--nx-poll-text)' : 'var(--nx-poll-choice)',
                        opacity: isSelected ? 1 : 0.65,
                      },
                    }}
                  >
                    <Box
                      component="span"
                      sx={{
                        flexShrink: 0,
                        width: 16,
                        height: 16,
                        borderRadius: '50%',
                        border: `2px solid ${isSelected ? 'var(--nx-poll-check-bg)' : 'var(--nx-poll-check-border)'}`,
                        backgroundColor: isSelected ? 'var(--nx-poll-check-bg)' : 'transparent',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {isSelected && (
                        <Check
                          fontSize="small"
                          aria-hidden="true"
                          sx={{ fontSize: '0.65rem', color: 'var(--nx-poll-check-fg)' }}
                        />
                      )}
                    </Box>
                    <Box component="span" sx={{ flex: 1 }}>
                      {option.label}
                    </Box>
                  </Button>
                );
              })}
            </Box>
          )}

          {isTextPrompt && (
            <Box>
              <textarea
                aria-label="Your answer"
                value={selectedPrompt !== null ? selectedPrompt : textValue}
                onChange={(e) => setTextValue(e.target.value)}
                readOnly={selectedPrompt !== null}
                disabled={selectedPrompt !== null}
                placeholder={message.prompt?.placeholder || 'Type your answer…'}
                rows={3}
                className="w-full rounded-md border border-nx-input-border p-2 text-sm transition-colors focus:border-nx-input-focus focus:shadow-md focus:outline-none disabled:bg-gray-100 disabled:text-gray-600"
              />
              {selectedPrompt === null && (
                <Box display="flex" justifyContent="flex-end" marginTop="0.5rem">
                  <Button
                    variant="contained"
                    size="small"
                    onClick={handleTextSubmit}
                    disabled={textValue.trim() === ''}
                    sx={{ textTransform: 'none', borderRadius: '6px' }}
                  >
                    Submit
                  </Button>
                </Box>
              )}
            </Box>
          )}
        </div>
      </div>
    </Box>
  );
};
