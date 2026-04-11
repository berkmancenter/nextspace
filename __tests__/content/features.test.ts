import {
  allFeatures,
  isFeatureAvailableFor,
  SlashCommandFeature,
  AssistantFeature,
  AnyFeature,
} from "../../content/features";

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

  it("has no entries without an explicit, non-empty conversationTypes array", () => {
    allFeatures.forEach((feature) => {
      expect(feature.conversationTypes).toBeDefined();
      expect(feature.conversationTypes.length).toBeGreaterThan(0);
    });
  });
});

describe("isFeatureAvailableFor", () => {
  const base = {
    type: "slashCommand" as const,
    command: "test",
    description: "Test command",
  };

  it("returns true when the conversation type is in the list", () => {
    const feature: AnyFeature = {
      ...base,
      conversationTypes: ["eventAssistant", "eventAssistantPlus"],
    };
    expect(isFeatureAvailableFor(feature, "eventAssistant")).toBe(true);
  });

  it("returns false when the conversation type is not in the list", () => {
    const feature: AnyFeature = {
      ...base,
      conversationTypes: ["eventAssistantPlus"],
    };
    expect(isFeatureAvailableFor(feature, "eventAssistant")).toBe(false);
  });

  it("returns false when conversationTypes is an empty array", () => {
    /* Empty array is treated as unscoped — hidden rather than shown everywhere. */
    const feature: AnyFeature = { ...base, conversationTypes: [] };
    expect(isFeatureAvailableFor(feature, "eventAssistant")).toBe(false);
  });

  it("returns false when conversationTypes is omitted entirely", () => {
    /* Runtime guard for JS callers that bypass the required field. */
    const feature = { ...base } as unknown as AnyFeature;
    expect(isFeatureAvailableFor(feature, "eventAssistant")).toBe(false);
  });
});
