import { allSlashCommands } from "../../content/slashCommands";
import { allFeatures, SlashCommandFeature } from "../../content/features";

const slashCommandFeatures = allFeatures.filter(
  (f): f is SlashCommandFeature => f.type === "slashCommand"
);

describe("allSlashCommands", () => {
  it("has one entry for every slash command in allFeatures", () => {
    expect(allSlashCommands).toHaveLength(slashCommandFeatures.length);
  });

  it("has no entries for commands not in allFeatures", () => {
    const featureCommands = new Set(slashCommandFeatures.map((f) => f.command));
    allSlashCommands.forEach((cmd) => {
      expect(featureCommands.has(cmd.command)).toBe(true);
    });
  });

  it("passes through command, description, and conversationTypes from allFeatures", () => {
    slashCommandFeatures.forEach((feature) => {
      const match = allSlashCommands.find((cmd) => cmd.command === feature.command);
      expect(match).toBeDefined();
      expect(match!.description).toBe(feature.description);
      expect(match!.conversationTypes).toEqual(feature.conversationTypes);
    });
  });

  it("sets value to /<command> with a trailing space for each entry", () => {
    allSlashCommands.forEach((cmd) => {
      expect(cmd.value).toBe(`/${cmd.command} `);
    });
  });
});
