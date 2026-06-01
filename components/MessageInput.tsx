import { FC, useState, useRef, KeyboardEvent, ChangeEvent, useEffect, useCallback } from 'react';
import { Box, IconButton, InputAdornment, TextField, Popover, Typography } from '@mui/material';
import { Send, Close, InfoOutlined } from '@mui/icons-material';
import { ControlledInputConfig } from '../types.internal';
import { ActiveEnhancerState, InputEnhancer } from '../types/inputEnhancer';
import { GenericEnhancerMenu } from './GenericEnhancerMenu';
import { getAvatarStyle } from '../utils/avatarUtils';

interface MessageInputProps {
  /** The pseudonym of the user */
  pseudonym: string | null;
  pseudonymFunFact?: string;
  /** List of input enhancers */
  enhancers: InputEnhancer<any>[];
  /** Whether the input is waiting for a response */
  waitingForResponse: boolean;
  /** Configuration for controlled input mode */
  controlledMode: ControlledInputConfig | null;
  /** The current value of the input in controlled mode */
  inputValue?: string;
  /** Whether to disable the input while waiting for a response */
  disableWhileWaiting?: boolean;
  /** Callback when a message is sent */
  onSendMessage: (message: string) => void;
  /** Callback when exiting controlled input mode */
  onExitControlledMode: () => void;
  /** Callback when the input value changes in controlled mode */
  onInputChange?: (value: string) => void;
}

export const MessageInput: FC<MessageInputProps> = ({
  pseudonym,
  pseudonymFunFact,
  enhancers,
  waitingForResponse,
  controlledMode,
  inputValue,
  disableWhileWaiting = true,
  onExitControlledMode,
  onInputChange,
  onSendMessage,
}) => {
  const [internalValue, setInternalValue] = useState('');
  const isControlled = inputValue !== undefined && onInputChange !== undefined;
  const currentMessage = isControlled ? inputValue : internalValue;
  const setCurrentMessage = isControlled ? onInputChange : setInternalValue;

  const [activeEnhancer, setActiveEnhancer] = useState<ActiveEnhancerState<any> | null>(null);
  const [pseudonymInfoAnchor, setPseudonymInfoAnchor] = useState<HTMLButtonElement | null>(null);

  const messageInputRef = useRef<HTMLInputElement>(null);
  const enterUsedForCommandRef = useRef(false);

  // Close menu when enhancers change
  useEffect(() => {
    setActiveEnhancer(null);
  }, [enhancers]);

  /** Detect triggers for the current value */
  const detectTriggersForValue = useCallback(
    (value: string) => {
      const cursor = messageInputRef.current?.selectionStart ?? value.length;

      // Check each enhancer for a trigger match
      for (const enhancer of enhancers) {
        const trigger = enhancer.detectTrigger(value, cursor);

        if (trigger) {
          const items = enhancer.getItems(trigger.query);

          if (items.length > 0) {
            setActiveEnhancer({
              enhancer,
              items,
              selectedIndex: 0,
              trigger,
            });
            return; // Stop at first match
          }
        }
      }

      // No triggers matched
      setActiveEnhancer(null);
    },
    [enhancers],
  );

  /** Handle input changes */
  const handleMessageChange = (value: string) => {
    setCurrentMessage(value);
  };

  // Detect triggers whenever currentMessage changes
  useEffect(() => {
    if (currentMessage) {
      detectTriggersForValue(currentMessage);
    } else {
      setActiveEnhancer(null);
    }
  }, [currentMessage, detectTriggersForValue]);

  /** Handle item selection from menu */
  const handleEnhancerSelect = (item: any) => {
    if (!activeEnhancer) return;

    const cursor = messageInputRef.current?.selectionStart ?? currentMessage.length;
    const result = activeEnhancer.enhancer.onSelect(item, currentMessage, cursor);

    setCurrentMessage(result.value);
    setActiveEnhancer(null);

    // Set cursor position
    setTimeout(() => {
      messageInputRef.current?.focus();
      messageInputRef.current?.setSelectionRange(result.cursorPos, result.cursorPos);
    }, 0);
  };

  /** Send message */
  const handleSend = () => {
    const canSend = disableWhileWaiting ? !waitingForResponse : true;
    if (currentMessage && currentMessage.length > 0 && canSend) {
      onSendMessage(currentMessage);
      setCurrentMessage('');
    }
  };

  /** Handle Enter key */
  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' && enterUsedForCommandRef.current) {
      e.preventDefault();
      enterUsedForCommandRef.current = false;
      return;
    }
    const canSend = disableWhileWaiting ? !waitingForResponse : true;
    if (e.key === 'Enter' && currentMessage.length > 0 && canSend && !activeEnhancer) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    handleMessageChange(newValue);
  };

  /** Keyboard navigation for enhancer menus */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && controlledMode) onExitControlledMode();
      if (e.key === 'Escape') {
        setActiveEnhancer(null);
      }

      // Menu navigation
      if (activeEnhancer && activeEnhancer.items.length > 0) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setActiveEnhancer((prev) =>
            prev
              ? {
                  ...prev,
                  selectedIndex: prev.selectedIndex < prev.items.length - 1 ? prev.selectedIndex + 1 : 0,
                }
              : null,
          );
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          setActiveEnhancer((prev) =>
            prev
              ? {
                  ...prev,
                  selectedIndex: prev.selectedIndex > 0 ? prev.selectedIndex - 1 : prev.items.length - 1,
                }
              : null,
          );
        } else if (e.key === 'Enter' || e.key === 'Tab') {
          e.preventDefault();
          // Only suppress the subsequent Enter keyup when Enter itself was used
          // for selection. When Tab is used, no Enter keyup follows, so the flag
          // must stay false — otherwise the next Enter press to send the message
          // gets eaten.
          if (e.key === 'Enter') {
            enterUsedForCommandRef.current = true;
          }
          handleEnhancerSelect(activeEnhancer.items[activeEnhancer.selectedIndex]);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown as any);
    return () => window.removeEventListener('keydown', handleKeyDown as any);
  }, [controlledMode, activeEnhancer, onExitControlledMode, currentMessage]);

  // Clear input and focus when entering controlled mode
  useEffect(() => {
    if (controlledMode) {
      setCurrentMessage('');
      setTimeout(() => messageInputRef.current?.focus(), 0);
    }
  }, [controlledMode]);

  if (!pseudonym) return null;

  return (
    <div className="flex bg-white pl-2 pr-2 md:px-8">
      <div className="w-full max-w-4xl">
        <Box display="flex" alignItems="center" padding="8px">
          <div className="flex flex-col w-full">
            {/* Header */}
            <div
              className="border-[1px] border-b-0 border-[#A5B4FC] rounded-t-lg p-2 font-bold text-sm flex justify-between items-center"
              style={{
                backgroundColor: getAvatarStyle(pseudonym, true).avatarBg,
              }}
            >
              <span className="uppercase flex items-center gap-1">
                Writing as {pseudonym}
                <IconButton
                  size="small"
                  onClick={(e) => setPseudonymInfoAnchor(e.currentTarget)}
                  sx={{ padding: '2px', verticalAlign: 'middle' }}
                  aria-label="Pseudonym info"
                >
                  <InfoOutlined sx={{ fontSize: 16 }} />
                </IconButton>
                {controlledMode && (
                  <span className="normal-case">
                    {' • '}
                    {controlledMode.icon} {controlledMode.label}
                  </span>
                )}
              </span>
              <Popover
                open={Boolean(pseudonymInfoAnchor)}
                anchorEl={pseudonymInfoAnchor}
                onClose={() => setPseudonymInfoAnchor(null)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
                transformOrigin={{ vertical: 'top', horizontal: 'left' }}
                slotProps={{ paper: { sx: { maxWidth: 300, p: 2 } } }}
              >
                <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                  Who are you today?
                </Typography>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  To protect your privacy, your identity is hidden behind this pseudonym. Not even the AI knows your real
                  name.
                </Typography>
                {pseudonymFunFact && (
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: 'block', mt: 1, pt: 1, borderTop: '1px solid', borderColor: 'divider' }}
                  >
                    <strong>Fun fact:</strong> {pseudonymFunFact}
                  </Typography>
                )}
              </Popover>
              {controlledMode && (
                <IconButton size="small" onClick={onExitControlledMode} sx={{ padding: '4px' }}>
                  <Close fontSize="small" />
                </IconButton>
              )}
            </div>

            {/* Input field with buttons at bottom */}
            <div className="border-[1px] border-[#A5B4FC] border-t-0 rounded-b-lg bg-white transition-all focus-within:border-[#6366f1] focus-within:shadow-md">
              <textarea
                id="message-input"
                ref={messageInputRef as any}
                placeholder="Enter your message here"
                value={currentMessage}
                onChange={handleChange as any}
                onKeyDown={handleKeyDown as any}
                className="w-full px-4 pt-3 pb-1 focus:outline-none text-base resize-none"
                rows={1}
              />
              <div className="flex items-center justify-between px-2 pb-1">
                {/* Enhancer buttons at bottom left */}
                <div className="flex gap-1">
                  {enhancers.map((enhancer) => {
                    const isActive = activeEnhancer?.enhancer.id === enhancer.id;
                    return (
                      <IconButton
                        key={enhancer.id}
                        onClick={() => {
                          const cursor = messageInputRef.current?.selectionStart ?? currentMessage.length;
                          const result = enhancer.button.onClick(currentMessage, cursor);
                          setCurrentMessage(result.value);
                          setTimeout(() => {
                            messageInputRef.current?.focus();
                            messageInputRef.current?.setSelectionRange(result.cursorPos, result.cursorPos);
                            // Re-trigger detection after cursor is positioned
                            handleMessageChange(result.value);
                          }, 0);
                        }}
                        size="small"
                        title={enhancer.button.getTitle(isActive)}
                        sx={{
                          padding: '6px',
                          fontSize: '0.875rem',
                          color: '#374151',
                          backgroundColor: '#e5e7eb',
                          borderRadius: '50%',
                          width: '32px',
                          height: '32px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          '&:hover': {
                            backgroundColor: '#d1d5db',
                          },
                        }}
                      >
                        {enhancer.button.icon}
                      </IconButton>
                    );
                  })}
                </div>
                {/* Send button at bottom right */}
                <IconButton
                  onClick={handleSend}
                  aria-label="send message"
                  disabled={!currentMessage || (disableWhileWaiting && waitingForResponse)}
                  sx={{ padding: 0 }}
                >
                  <Send
                    sx={{
                      opacity: !currentMessage ? 0.5 : 1,
                      color: 'white',
                      backgroundColor: '#2f69c4',
                      borderRadius: '50%',
                      padding: '4px',
                      transform: 'rotate(-45deg)',
                    }}
                  />
                </IconButton>
              </div>
            </div>

            {/* Single generic popup menu */}
            {activeEnhancer && (
              <GenericEnhancerMenu
                items={activeEnhancer.items}
                selectedIndex={activeEnhancer.selectedIndex}
                onSelect={handleEnhancerSelect}
                renderItem={activeEnhancer.enhancer.renderItem}
                getItemKey={(_item, index) => `${activeEnhancer.enhancer.id}-${index}`}
                anchorEl={messageInputRef.current}
                open={true}
              />
            )}
          </div>
        </Box>
      </div>
    </div>
  );
};
