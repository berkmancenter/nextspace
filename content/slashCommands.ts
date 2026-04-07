import { SlashCommand } from "../components/enhancers/slashCommandEnhancer";

/**
 * All available slash commands.
 * This is the single source of truth — the chat input and the Help panel both read from here.
 * Commands can optionally restrict availability to specific conversation types via conversationTypes.
 */
export const allSlashCommands: SlashCommand[] = [
  {
    command: "mod",
    description: "Submit a question to the moderator",
    value: "/mod ",
    conversationTypes: ["eventAssistantPlus", "eventAssistantPlusProactive"],
  },
  {
    command: "mindmap",
    description:
      "Create a visual mind map of the key topics discussed in the event",
    value: "/mindmap ",
    conversationTypes: [
      "eventAssistant",
      "eventAssistantPlus",
      "eventAssistantPlusProactive",
    ],
  },
  {
    command: "visual",
    description: "Request a visual response (image) to a question",
    value: "/visual ",
    conversationTypes: [
      "eventAssistant",
      "eventAssistantPlus",
      "eventAssistantPlusProactive",
    ],
  },
];
