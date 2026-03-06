import { MenuItem, Typography } from "@mui/material";
import {
  InputEnhancer,
  TriggerMatch,
  InputChangeRequest,
} from "../../types/inputEnhancer";
import { MentionItem } from "../MentionMenu";
import { MENTION_TRIGGER_REGEX } from "../../utils/mentionRegex";

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
      if (before.match(MENTION_TRIGGER_REGEX)) {
        // Remove the @ token
        const newBefore = before.replace(MENTION_TRIGGER_REGEX, "");
        return { value: newBefore + after, cursorPos: newBefore.length };
      } else {
        // Add @
        return { value: before + "@" + after, cursorPos: cursor + 1 };
      }
    },
  },

  detectTrigger: (value, cursorPos): TriggerMatch | null => {
    const textBefore = value.slice(0, cursorPos);
    // Match @ followed by optional word chars and spaces (to support multi-word handles),
    // but do not allow a trailing space (that would indicate the mention is complete)
    const match = textBefore.match(MENTION_TRIGGER_REGEX);

    if (match) {
      return {
        query: match[1] ?? "",
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
    const newBefore = before.replace(MENTION_TRIGGER_REGEX, `@${item.pseudonym} `);

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
