import {
  resolveConversationBotName,
  normalizeAssistantPseudonym,
} from "../../utils/Helpers";

describe("resolveConversationBotName", () => {
  const fallback = "Berkie";

  it("returns configBotName when agents array is empty", () => {
    expect(resolveConversationBotName({ agents: [] as any }, fallback)).toBe("Berkie");
  });

  it("returns configBotName when first agent has no agentConfig", () => {
    const agents = [{ id: "a1", agentType: "eventAssistant" }] as any;
    expect(resolveConversationBotName({ agents }, fallback)).toBe("Berkie");
  });

  it("returns configBotName when agentConfig exists but has no botName key", () => {
    const agents = [{ id: "a1", agentType: "eventAssistant", agentConfig: { llmModel: "gpt-4" } }] as any;
    expect(resolveConversationBotName({ agents }, fallback)).toBe("Berkie");
  });

  it("returns agentConfig.botName when it is a non-empty string", () => {
    const agents = [
      { id: "a1", agentType: "eventAssistant", agentConfig: { botName: "EventBot" } },
    ] as any;
    expect(resolveConversationBotName({ agents }, fallback)).toBe("EventBot");
  });

  it("returns configBotName when agentConfig.botName is an empty string", () => {
    const agents = [
      { id: "a1", agentType: "eventAssistant", agentConfig: { botName: "" } },
    ] as any;
    expect(resolveConversationBotName({ agents }, fallback)).toBe("Berkie");
  });

  it("returns configBotName when agentConfig.botName is a number", () => {
    const agents = [
      { id: "a1", agentType: "eventAssistant", agentConfig: { botName: 42 } },
    ] as any;
    expect(resolveConversationBotName({ agents }, fallback)).toBe("Berkie");
  });

  it("returns configBotName when agentConfig.botName is null", () => {
    const agents = [
      { id: "a1", agentType: "eventAssistant", agentConfig: { botName: null } },
    ] as any;
    expect(resolveConversationBotName({ agents }, fallback)).toBe("Berkie");
  });

  it("returns configBotName when agentConfig.botName is boolean", () => {
    const agents = [
      { id: "a1", agentType: "eventAssistant", agentConfig: { botName: true } },
    ] as any;
    expect(resolveConversationBotName({ agents }, fallback)).toBe("Berkie");
  });

  it("uses the first agent only, ignoring subsequent agents", () => {
    const agents = [
      { id: "a1", agentType: "eventAssistant", agentConfig: {} },
      { id: "a2", agentType: "eventAssistant", agentConfig: { botName: "SecondBot" } },
    ] as any;
    // First agent has no botName → falls back to config
    expect(resolveConversationBotName({ agents }, fallback)).toBe("Berkie");
  });

  it("uses the first agent's botName when both agents have botName", () => {
    const agents = [
      { id: "a1", agentType: "eventAssistant", agentConfig: { botName: "FirstBot" } },
      { id: "a2", agentType: "eventAssistant", agentConfig: { botName: "SecondBot" } },
    ] as any;
    expect(resolveConversationBotName({ agents }, fallback)).toBe("FirstBot");
  });
});

describe("normalizeAssistantPseudonym", () => {
  const botName = "Berkie";

  const makeMessage = (overrides: Record<string, unknown>) => ({
    id: "1",
    pseudonym: "User",
    fromAgent: false,
    body: "hello",
    channels: ["direct"],
    conversation: "conv-1",
    pseudonymId: "p-1",
    pause: false,
    visible: true,
    upVotes: [],
    downVotes: [],
    ...overrides,
  });

  it("returns botName when message is from an agent", () => {
    const msg = makeMessage({ fromAgent: true, pseudonym: "Event Assistant" });
    expect(normalizeAssistantPseudonym(msg as any, botName)).toBe("Berkie");
  });

  it("returns original pseudonym when message is not from an agent", () => {
    const msg = makeMessage({ fromAgent: false, pseudonym: "Alice" });
    expect(normalizeAssistantPseudonym(msg as any, botName)).toBe("Alice");
  });

  it("returns empty string when message is null", () => {
    expect(normalizeAssistantPseudonym(null as any, botName)).toBe("");
  });

  it("returns empty string when pseudonym is missing", () => {
    const msg = makeMessage({ pseudonym: undefined });
    expect(normalizeAssistantPseudonym(msg as any, botName)).toBe("");
  });
});
