import { SlashCommand } from "../components/enhancers/slashCommandEnhancer";
import { allFeatures, SlashCommandFeature } from "./features";

/**
 * All available slash commands, used by the chat input autocomplete.
 * Derived automatically from `content/features.ts` — do not edit this array directly.
 *
 * ## Adding a new slash command
 * 1. Add a `SlashCommandFeature` entry in `content/features.ts`.
 *    This array updates itself; no changes needed here.
 * 2. Add a `WhatsNewEntry` in `content/whatsNew.ts` so users learn about it.
 *
 * `value` defaults to `/<command> ` (with a trailing space so the cursor lands
 * after the command, ready to type). This covers all current commands.
 */
export const allSlashCommands: SlashCommand[] = allFeatures
  .filter((f): f is SlashCommandFeature => f.type === "slashCommand")
  .map((f) => ({
    command: f.command,
    description: f.description,
    value: `/${f.command} `,
    conversationTypes: f.conversationTypes,
  }));
