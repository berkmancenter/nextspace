import {
  FC,
  useState,
  useRef,
  KeyboardEvent,
  ChangeEvent,
  useEffect,
  useCallback,
} from "react";
import { Box, IconButton, InputAdornment, TextField } from "@mui/material";
import { Send, Close } from "@mui/icons-material";
import { ControlledInputConfig } from "../types.internal";
import { ActiveEnhancerState, InputEnhancer } from "../types/inputEnhancer";
import { GenericEnhancerMenu } from "./GenericEnhancerMenu";
import { getAvatarStyle } from "../utils/avatarUtils";

interface MessageInputProps {
  pseudonym: string | null;
  enhancers: InputEnhancer<any>[];
  onSendMessage: (message: string) => void;
  waitingForResponse: boolean;
  controlledMode: ControlledInputConfig | null;
  onExitControlledMode: () => void;
  inputValue?: string;
  onInputChange?: (value: string) => void;
}

export const MessageInput: FC<MessageInputProps> = ({
  pseudonym,
  enhancers,
  onSendMessage,
  waitingForResponse,
  controlledMode,
  onExitControlledMode,
  inputValue,
  onInputChange,
}) => {
  const [internalValue, setInternalValue] = useState("");
  const isControlled = inputValue !== undefined && onInputChange !== undefined;
  const currentMessage = isControlled ? inputValue : internalValue;
  const setCurrentMessage = isControlled ? onInputChange : setInternalValue;

  const [activeEnhancer, setActiveEnhancer] =
    useState<ActiveEnhancerState<any> | null>(null);

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
    [enhancers]
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

    const cursor =
      messageInputRef.current?.selectionStart ?? currentMessage.length;
    const result = activeEnhancer.enhancer.onSelect(
      item,
      currentMessage,
      cursor
    );

    setCurrentMessage(result.value);
    setActiveEnhancer(null);

    // Set cursor position
    setTimeout(() => {
      messageInputRef.current?.focus();
      messageInputRef.current?.setSelectionRange(
        result.cursorPos,
        result.cursorPos
      );
    }, 0);
  };

  /** Send message */
  const handleSend = () => {
    if (currentMessage && currentMessage.length > 0 && !waitingForResponse) {
      onSendMessage(currentMessage);
      setCurrentMessage("");
    }
  };

  /** Handle Enter key */
  const handleKeyUp = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" && enterUsedForCommandRef.current) {
      enterUsedForCommandRef.current = false;
      return;
    }
    if (
      e.key === "Enter" &&
      currentMessage.length > 0 &&
      !waitingForResponse &&
      !activeEnhancer
    ) {
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
      if (e.key === "Escape" && controlledMode) onExitControlledMode();
      if (e.key === "Escape") {
        setActiveEnhancer(null);
      }

      // Menu navigation
      if (activeEnhancer && activeEnhancer.items.length > 0) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setActiveEnhancer((prev) =>
            prev
              ? {
                  ...prev,
                  selectedIndex:
                    prev.selectedIndex < prev.items.length - 1
                      ? prev.selectedIndex + 1
                      : 0,
                }
              : null
          );
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          setActiveEnhancer((prev) =>
            prev
              ? {
                  ...prev,
                  selectedIndex:
                    prev.selectedIndex > 0
                      ? prev.selectedIndex - 1
                      : prev.items.length - 1,
                }
              : null
          );
        } else if (e.key === "Enter") {
          e.preventDefault();
          enterUsedForCommandRef.current = true;
          handleEnhancerSelect(
            activeEnhancer.items[activeEnhancer.selectedIndex]
          );
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown as any);
    return () => window.removeEventListener("keydown", handleKeyDown as any);
  }, [controlledMode, activeEnhancer, onExitControlledMode, currentMessage]);

  // Clear input and focus when entering controlled mode
  useEffect(() => {
    if (controlledMode) {
      setCurrentMessage("");
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
              <span className="uppercase">
                Writing as {pseudonym}
                {controlledMode && (
                  <span className="normal-case">
                    {" • "}
                    {controlledMode.icon} {controlledMode.label}
                  </span>
                )}
              </span>
              {controlledMode && (
                <IconButton
                  size="small"
                  onClick={onExitControlledMode}
                  sx={{ padding: "4px" }}
                >
                  <Close fontSize="small" />
                </IconButton>
              )}
            </div>

            {/* Input field */}
            <TextField
              id="message-input"
              inputRef={messageInputRef}
              type="text"
              placeholder="Enter your message here"
              value={currentMessage}
              onChange={handleChange}
              onKeyUp={handleKeyUp}
              style={{ flex: 1 }}
              sx={{
                "& .MuiOutlinedInput-root": {
                  "& .MuiOutlinedInput-notchedOutline": {
                    borderColor: "#A5B4FC",
                    borderWidth: "1px",
                    borderBottomLeftRadius: enhancers.length > 0 ? 0 : "8px",
                    borderBottomRightRadius: enhancers.length > 0 ? 0 : "8px",
                    borderTopLeftRadius: 0,
                    borderTopRightRadius: 0,
                  },
                },
              }}
              slotProps={{
                input: {
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={handleSend}
                        aria-label="send message"
                        disabled={!currentMessage || waitingForResponse}
                      >
                        <Send
                          sx={{
                            opacity: !currentMessage ? 0.5 : 1,
                            color: "white",
                            backgroundColor: "#2f69c4",
                            borderRadius: "50%",
                            padding: "4px",
                            transform: "rotate(-45deg)",
                          }}
                        />
                      </IconButton>
                    </InputAdornment>
                  ),
                },
              }}
            />

            {/* Dynamic toolbar buttons */}
            {enhancers.length > 0 && (
              <div
                className="flex gap-2 p-2 border-[1px] border-t-0 border-[#A5B4FC] rounded-b-lg"
                style={{ backgroundColor: "#f9fafb" }}
              >
                {enhancers.map((enhancer) => {
                  const isActive = activeEnhancer?.enhancer.id === enhancer.id;
                  return (
                    <button
                      key={enhancer.id}
                      onClick={() => {
                        const cursor =
                          messageInputRef.current?.selectionStart ??
                          currentMessage.length;
                        const result = enhancer.button.onClick(
                          currentMessage,
                          cursor
                        );
                        setCurrentMessage(result.value);
                        setTimeout(() => {
                          messageInputRef.current?.focus();
                          messageInputRef.current?.setSelectionRange(
                            result.cursorPos,
                            result.cursorPos
                          );
                          // Re-trigger detection after cursor is positioned
                          handleMessageChange(result.value);
                        }, 0);
                      }}
                      className="flex items-center justify-center w-6 h-6 border border-gray-300 rounded bg-white hover:bg-gray-100 text-gray-700 font-mono text-sm transition-colors"
                      title={enhancer.button.getTitle(isActive)}
                    >
                      {enhancer.button.icon}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Single generic popup menu */}
            {activeEnhancer && (
              <GenericEnhancerMenu
                items={activeEnhancer.items}
                selectedIndex={activeEnhancer.selectedIndex}
                onSelect={handleEnhancerSelect}
                renderItem={activeEnhancer.enhancer.renderItem}
                getItemKey={(_item, index) =>
                  `${activeEnhancer.enhancer.id}-${index}`
                }
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
