import { MenuItem, Typography } from "@mui/material";
import {
  InputEnhancer,
  TriggerMatch,
  InputChangeRequest,
} from "../../types/inputEnhancer";
import { MentionItem } from "../MentionMenu";

/**
 * Creates a mentions enhancer
 * Triggers when user types "@" followed by letters
 */
export const createMentionsEnhancer = (
  contributors: string[]
): InputEnhancer<MentionItem> => ({
  id: "mentions",

  button: {
    icon: "@",
    getTitle: (isActive) =>
      isActive ? "Remove @ mention" : "Insert @ to mention someone",
    onClick: (value, cursor): InputChangeRequest => {
      const before = value.slice(0, cursor);
      const after = value.slice(cursor);

      // Check if there's an @ at or before cursor position
      if (before.match(/@(\w*)$/)) {
        // Remove the @ token
        const newBefore = before.replace(/@(\w*)$/, "");
        return { value: newBefore + after, cursorPos: newBefore.length };
      } else {
        // Add @
        return { value: before + "@" + after, cursorPos: cursor + 1 };
      }
    },
  },

  detectTrigger: (value, cursorPos): TriggerMatch | null => {
    const textBefore = value.slice(0, cursorPos);
    const match = textBefore.match(/@(\w*)$/);

    if (match) {
      return {
        query: match[1],
        replaceStart: cursorPos - match[0].length,
        replaceEnd: cursorPos,
      };
    }
    return null;
  },

  getItems: (query): MentionItem[] => {
    return contributors
      .filter((p) => p.toLowerCase().startsWith(query.toLowerCase()))
      .map((p) => ({ pseudonym: p }));
  },

  onSelect: (item, value, cursor): InputChangeRequest => {
    const before = value.slice(0, cursor);
    const after = value.slice(cursor);
    const newBefore = before.replace(/@(\w*)$/, `@${item.pseudonym} `);

    return {
      value: newBefore + after,
      cursorPos: newBefore.length,
    };
  },

  renderItem: (item, isSelected) => (
    <MenuItem selected={isSelected}>
      <Typography fontWeight={600}>@{item.pseudonym}</Typography>
    </MenuItem>
  ),
});
