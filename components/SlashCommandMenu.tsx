import { Box, Paper, MenuItem, Typography } from "@mui/material";
import { FC, useEffect, useRef } from "react";

/**
 * Slash command configuration
 * @property {string} command - The command text (without the slash)
 * @property {string} description - Description of what the command does
 * @property {string} [value] - Optional value to insert (defaults to `/${command} `)
 * @property {string[]} [conversationTypes] - Optional array of conversation types this command is available for
 */
export interface SlashCommand {
  command: string;
  description: string;
  value?: string;
  conversationTypes?: string[];
}

/**
 * Props for the SlashCommandMenu component
 * @property {SlashCommand[]} commands - Available slash commands
 * @property {number} selectedIndex - Currently selected command index
 * @property {(command: SlashCommand) => void} onSelect - Callback when command is selected
 * @property {HTMLElement | null} anchorEl - Element to position menu relative to
 * @property {boolean} open - Whether the menu is open
 */
interface SlashCommandMenuProps {
  commands: SlashCommand[];
  selectedIndex: number;
  onSelect: (command: SlashCommand) => void;
  anchorEl: HTMLElement | null;
  open: boolean;
}

/**
 * SlashCommandMenu component
 *
 * Displays a popup menu with available slash commands when user types "/"
 * Supports keyboard navigation (up/down arrows, enter, escape)
 */
export const SlashCommandMenu: FC<SlashCommandMenuProps> = ({
  commands,
  selectedIndex,
  onSelect,
  anchorEl,
  open,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  // Scroll selected item into view
  useEffect(() => {
    if (open && menuRef.current) {
      const selectedItem = menuRef.current.children[
        selectedIndex
      ] as HTMLElement;
      if (selectedItem) {
        selectedItem.scrollIntoView({
          block: "nearest",
          behavior: "smooth",
        });
      }
    }
  }, [selectedIndex, open]);

  if (!open || !anchorEl || commands.length === 0) {
    return null;
  }

  // Calculate position based on anchor element
  const rect = anchorEl.getBoundingClientRect();
  const menuHeight = Math.min(300, commands.length * 80); // Estimate menu height

  return (
    <Paper
      ref={menuRef}
      elevation={8}
      sx={{
        position: "fixed",
        bottom: `${window.innerHeight - rect.top + 8}px`, // 8px gap above input
        left: rect.left,
        zIndex: 1400,
        maxHeight: "300px",
        minWidth: "350px",
        overflow: "auto",
        borderRadius: "8px",
        border: "1px solid",
        borderColor: "grey.300",
      }}
    >
      <Box sx={{ py: 0.5 }}>
        {commands.map((cmd, index) => (
          <MenuItem
            key={cmd.command}
            selected={index === selectedIndex}
            onClick={() => onSelect(cmd)}
            sx={{
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              gap: 2,
              py: 1,
              px: 2,
              "&.Mui-selected": {
                backgroundColor: "action.selected",
                "&:hover": {
                  backgroundColor: "action.selected",
                },
              },
              "&:hover": {
                backgroundColor: "action.hover",
              },
            }}
          >
            <Typography
              variant="body1"
              sx={{
                fontWeight: 600,
                color: "primary.main",
                fontFamily: "monospace",
                minWidth: "60px",
                flexShrink: 0,
              }}
            >
              /{cmd.command}
            </Typography>
            <Typography
              variant="body2"
              sx={{
                color: "text.secondary",
              }}
            >
              {cmd.description}
            </Typography>
          </MenuItem>
        ))}
      </Box>
    </Paper>
  );
};
