import { MenuItem, Typography } from "@mui/material";
import {
  InputEnhancer,
  TriggerMatch,
  InputChangeRequest,
} from "../../types/inputEnhancer";

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
 * Creates a slash command enhancer
 * Triggers when user types "/" at the start of input
 */
export const createSlashCommandEnhancer = (
  commands: SlashCommand[]
): InputEnhancer<SlashCommand> => ({
  id: "slash-commands",

  button: {
    icon: "/",
    getTitle: (isActive) =>
      isActive ? "Remove / command" : "Insert / to show commands",
    onClick: (value, cursor): InputChangeRequest => {
      if (value.startsWith("/")) {
        // Remove the /
        return { value: "", cursorPos: 0 };
      } else {
        // Add the /
        return { value: "/", cursorPos: 1 };
      }
    },
  },

  detectTrigger: (value, cursorPos): TriggerMatch | null => {
    // Only trigger at start of input, no spaces
    if (value.startsWith("/") && !value.includes(" ")) {
      return {
        query: value.slice(1),
        replaceStart: 0,
        replaceEnd: value.length,
      };
    }
    return null;
  },

  getItems: (query): SlashCommand[] => {
    return commands.filter((cmd) =>
      cmd.command.toLowerCase().startsWith(query.toLowerCase())
    );
  },

  onSelect: (command, value, cursor): InputChangeRequest => {
    const newValue = command.value || `/${command.command} `;
    return {
      value: newValue,
      cursorPos: newValue.length,
    };
  },

  renderItem: (command, isSelected) => (
    <MenuItem
      selected={isSelected}
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        gap: 0.5,
      }}
    >
      <Typography fontWeight={600}>/{command.command}</Typography>
      <Typography variant="caption" color="text.secondary">
        {command.description}
      </Typography>
    </MenuItem>
  ),
});
