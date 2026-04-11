/**
 * Base fields shared by all Quick Guide panel features.
 * @property {string} description - One or two sentence description shown in the panel.
 * @property {string} [note] - Optional caveat (e.g. a required user preference). Shown beneath the description.
 * @property {string[]} conversationTypes - Event types this feature is available for. Must be set explicitly — omitting it hides the feature from all event types.
 */
interface BaseFeature {
  description: string;
  note?: string;
  conversationTypes: string[];
}

/**
 * A slash command — triggered by typing /<command> in the chat input.
 * @property {string} command - The command text without the leading slash (e.g. "visual").
 */
export interface SlashCommandFeature extends BaseFeature {
  type: "slashCommand";
  command: string;
}

/**
 * A passive event assistant feature — always-on or preference-gated; no command required.
 * @property {string} name - Display name shown in the panel.
 */
export interface AssistantFeature extends BaseFeature {
  type: "assistant";
  name: string;
}

/** Union of all feature types shown in the Quick Guide panel. */
export type AnyFeature = SlashCommandFeature | AssistantFeature;

/**
 * Returns true if a feature should be shown for the given conversation type.
 * Features with an empty or missing `conversationTypes` array are never shown.
 */
export function isFeatureAvailableFor(
  feature: AnyFeature,
  conversationType: string
): boolean {
  if (!feature.conversationTypes || feature.conversationTypes.length === 0)
    return false;
  return feature.conversationTypes.includes(conversationType);
}

/**
 * All features shown in the Quick Guide panel's "Features" section. It shows slash commands first, then assistant features.
 *
 * ## Adding a new slash command
 * 1. Add a `SlashCommandFeature` entry here.
 *    The chat input autocomplete (`content/slashCommands.ts`) is derived from this array
 *    automatically — no changes needed there.
 * 2. If the command requires a user preference or has a caveat, add a `note`.
 * 3. If the slash command is related to a new feature, add a `WhatsNewEntry` in `content/whatsNew.ts` so users learn about it.
 *
 * ## Adding a new event assistant feature (no slash command)
 * 1. Add an `AssistantFeature` entry here with `type: "assistant"`.
 * 2. Add a `WhatsNewEntry` in `content/whatsNew.ts` so users learn about it.
 *
 * ## Scoping to event types
 * Set `conversationTypes` to the relevant type names (e.g. `["eventAssistantPlus", "eventAssistantPlusProactive"]`).
 * This field is required — omitting it hides the feature from all event types.
 */
export const allFeatures: AnyFeature[] = [
  {
    type: "slashCommand",
    command: "mod",
    description: "Submit a question to the moderator",
    conversationTypes: ["eventAssistantPlus", "eventAssistantPlusProactive"],
  },
  {
    type: "slashCommand",
    command: "mindmap",
    description:
      "Create a visual mind map of the key topics discussed in the event",
    conversationTypes: [
      "eventAssistant",
      "eventAssistantPlus",
      "eventAssistantPlusProactive",
    ],
  },
  {
    type: "slashCommand",
    command: "visual",
    description: "Request a visual response (image) to a question",
    conversationTypes: [
      "eventAssistant",
      "eventAssistantPlus",
      "eventAssistantPlusProactive",
    ],
    note: 'Requires the "Visuals" preference to be enabled in your settings.',
  },
  {
    type: "assistant",
    name: "Jargon Filter",
    description:
      'Automatically explains jargon and technical terms used by speakers. Enable it by turning on "Jargon Clarification" in your event settings.',
    conversationTypes: [
      "eventAssistant",
      "eventAssistantPlus",
      "eventAssistantPlusProactive",
    ],
  },
];
