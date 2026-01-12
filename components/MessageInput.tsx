import {
  FC,
  useState,
  useRef,
  KeyboardEvent,
  ChangeEvent,
  useEffect,
} from "react";
import { Box, IconButton, InputAdornment, TextField } from "@mui/material";
import { Send, Close } from "@mui/icons-material";
import { ControlledInputConfig } from "../types.internal";
import { SlashCommandMenu, SlashCommand } from "./SlashCommandMenu";

interface MessageInputProps {
  pseudonym: string | null;
  onSendMessage: (message: string) => void;
  waitingForResponse: boolean;
  controlledMode: ControlledInputConfig | null;
  onExitControlledMode: () => void;
  slashCommands: SlashCommand[];
}

export const MessageInput: FC<MessageInputProps> = ({
  pseudonym,
  onSendMessage,
  waitingForResponse,
  controlledMode,
  onExitControlledMode,
  slashCommands,
}) => {
  const [currentMessage, setCurrentMessage] = useState("");
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [slashCommandIndex, setSlashCommandIndex] = useState(0);
  const [filteredCommands, setFilteredCommands] = useState<SlashCommand[]>([]);

  const messageInputRef = useRef<HTMLInputElement>(null);
  const enterUsedForCommandRef = useRef(false);

  const handleMessageChange = (value: string) => {
    setCurrentMessage(value);

    // Show slash menu if message starts with "/" and has no space yet
    if (value.startsWith("/") && !value.includes(" ")) {
      // Extract the command part (without the leading slash)
      const commandQuery = value.slice(1).toLowerCase();

      // Filter commands that start with the typed query
      const filtered = slashCommands.filter((cmd) =>
        cmd.command.toLowerCase().startsWith(commandQuery)
      );

      setFilteredCommands(filtered);

      // Only show menu if there are matching commands
      if (filtered.length > 0) {
        setShowSlashMenu(true);
        // Reset selected index, but make sure it's within bounds
        setSlashCommandIndex(0);
      } else {
        setShowSlashMenu(false);
      }
    } else {
      setShowSlashMenu(false);
      setFilteredCommands([]);
    }
  };

  const handleSlashCommandSelect = (command: SlashCommand) => {
    const value = command.value || `/${command.command} `;
    setCurrentMessage(value);
    setShowSlashMenu(false);
    setSlashCommandIndex(0);
    // Focus back on input and set cursor to end
    setTimeout(() => {
      if (messageInputRef.current) {
        messageInputRef.current.focus();
        // Set cursor position to the end of the text
        messageInputRef.current.setSelectionRange(value.length, value.length);
      }
    }, 0);
  };

  const handleSend = () => {
    if (currentMessage && currentMessage.length > 0 && !waitingForResponse) {
      onSendMessage(currentMessage);
      setCurrentMessage("");
    }
  };

  const handleKeyUp = (e: KeyboardEvent<HTMLDivElement>) => {
    // Check if Enter was used to select a command
    if (e.key === "Enter" && enterUsedForCommandRef.current) {
      enterUsedForCommandRef.current = false;
      return; // Don't send message
    }

    if (
      e.key === "Enter" &&
      !!currentMessage &&
      currentMessage.length > 0 &&
      !waitingForResponse &&
      !showSlashMenu
    ) {
      handleSend();
    }
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    handleMessageChange(e.target.value);
  };

  // Handle keyboard navigation for slash commands and ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && controlledMode) {
        onExitControlledMode();
      }
      if (e.key === "Escape" && showSlashMenu) {
        setShowSlashMenu(false);
        setSlashCommandIndex(0);
      }
      // Handle arrow keys for slash menu navigation
      if (showSlashMenu && filteredCommands.length > 0) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setSlashCommandIndex((prev) =>
            prev < filteredCommands.length - 1 ? prev + 1 : 0
          );
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          setSlashCommandIndex((prev) =>
            prev > 0 ? prev - 1 : filteredCommands.length - 1
          );
        } else if (e.key === "Enter" && showSlashMenu) {
          e.preventDefault();
          enterUsedForCommandRef.current = true;
          handleSlashCommandSelect(filteredCommands[slashCommandIndex]);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown as any);
    return () => window.removeEventListener("keydown", handleKeyDown as any);
  }, [
    controlledMode,
    showSlashMenu,
    slashCommandIndex,
    filteredCommands,
    onExitControlledMode,
  ]);

  // Clear input and focus when controlled mode is entered
  useEffect(() => {
    if (controlledMode) {
      setCurrentMessage("");
      // Focus the input field
      setTimeout(() => {
        if (messageInputRef.current) {
          messageInputRef.current.focus();
        }
      }, 0);
    }
  }, [controlledMode]);

  if (!pseudonym) {
    return null;
  }

  return (
    <div className="flex bg-white pl-8">
      <div className="w-full max-w-4xl">
        <Box display="flex" alignItems="center" padding="8px">
          <div className="flex flex-col w-full">
            <div className="border-[1px] border-b-0 border-[#A5B4FC] rounded-t-lg p-2 font-bold text-sm flex justify-between items-center">
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
            <TextField
              id="message-input"
              inputRef={messageInputRef}
              type="text"
              placeholder="Write a Comment"
              value={currentMessage}
              onChange={handleChange}
              onKeyUp={handleKeyUp}
              style={{
                flex: 1,
              }}
              sx={{
                // Root class for the input field
                "& .MuiOutlinedInput-root": {
                  // Class for the border around the input field
                  "& .MuiOutlinedInput-notchedOutline": {
                    borderColor: "#A5B4FC",
                    borderWidth: "1px",
                    borderBottomLeftRadius: "8px",
                    borderBottomRightRadius: "8px",
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
                        disabled={
                          !currentMessage ||
                          currentMessage.length < 1 ||
                          waitingForResponse
                        }
                      >
                        <Send
                          sx={{
                            opacity:
                              !currentMessage || currentMessage.length < 1
                                ? 0.5
                                : 1,
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
            {/* Slash Command Menu */}
            <SlashCommandMenu
              commands={filteredCommands}
              selectedIndex={slashCommandIndex}
              onSelect={handleSlashCommandSelect}
              anchorEl={messageInputRef.current}
              open={showSlashMenu}
            />
          </div>
        </Box>
      </div>
    </div>
  );
};
