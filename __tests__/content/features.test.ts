import { allFeatures, SlashCommandFeature, AssistantFeature } from "../../content/features";

describe("allFeatures", () => {
  it("has no entries with an invalid type", () => {
    allFeatures.forEach((feature) => {
      expect(["slashCommand", "assistant"]).toContain(feature.type);
    });
  });

  it("has no entries with an empty description", () => {
    allFeatures.forEach((feature) => {
      expect(feature.description.trim()).not.toBe("");
    });
  });

  it("has no slash command entries with an empty command", () => {
    allFeatures
      .filter((f): f is SlashCommandFeature => f.type === "slashCommand")
      .forEach((feature) => {
        expect(feature.command.trim()).not.toBe("");
      });
  });

  it("has no assistant feature entries with an empty name", () => {
    allFeatures
      .filter((f): f is AssistantFeature => f.type === "assistant")
      .forEach((feature) => {
        expect(feature.name.trim()).not.toBe("");
      });
  });

  it("has no entries with an empty note (notes must be non-empty if present)", () => {
    allFeatures.forEach((feature) => {
      if (feature.note !== undefined) {
        expect(feature.note.trim()).not.toBe("");
      }
    });
  });

  it("has no slash command entries with duplicate commands", () => {
    const commands = allFeatures
      .filter((f): f is SlashCommandFeature => f.type === "slashCommand")
      .map((f) => f.command);
    const unique = new Set(commands);
    expect(unique.size).toBe(commands.length);
  });
});
