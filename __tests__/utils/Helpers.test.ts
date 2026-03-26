import {
  resolveConversationBotName,
  normalizeAssistantPseudonym,
  buildDirectChannels,
  parseMessageBody,
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

describe("buildDirectChannels", () => {
  const userId = "user-123";

  it("includes a direct channel for each agent with no preferenceKey", () => {
    const agents = [
      { agentId: "agent-abc" },
      { agentId: "agent-def" },
    ];
    const channels = buildDirectChannels(userId, agents, {});
    expect(channels).toHaveLength(2);
    expect(channels.map((c) => c.name)).toContain("direct-user-123-agent-abc");
    expect(channels.map((c) => c.name)).toContain("direct-user-123-agent-def");
  });

  it("includes a preference-gated agent channel when the preference is true", () => {
    const agents = [
      { agentId: "agent-abc" },
      { agentId: "agent-jargon", preferenceKey: "jargonClarification" },
    ];
    const channels = buildDirectChannels(userId, agents, { jargonClarification: true });
    expect(channels).toHaveLength(2);
    expect(channels.map((c) => c.name)).toContain("direct-user-123-agent-jargon");
  });

  it("excludes a preference-gated agent channel when the preference is false", () => {
    const agents = [
      { agentId: "agent-abc" },
      { agentId: "agent-jargon", preferenceKey: "jargonClarification" },
    ];
    const channels = buildDirectChannels(userId, agents, { jargonClarification: false });
    expect(channels).toHaveLength(1);
    expect(channels.map((c) => c.name)).not.toContain("direct-user-123-agent-jargon");
  });

  it("excludes a preference-gated agent channel when the preference is absent", () => {
    const agents = [
      { agentId: "agent-abc" },
      { agentId: "agent-jargon", preferenceKey: "jargonClarification" },
    ];
    const channels = buildDirectChannels(userId, agents, {});
    expect(channels).toHaveLength(1);
    expect(channels.map((c) => c.name)).not.toContain("direct-user-123-agent-jargon");
  });

  it("marks all channels as direct with null passcode — access is controlled by channel name, not passcode", () => {
    const agents = [{ agentId: "agent-abc" }];
    const [channel] = buildDirectChannels(userId, agents, {});
    expect(channel.direct).toBe(true);
    expect(channel.passcode).toBeNull();
  });
});

describe("parseMessageBody", () => {
  it("parses string body into text field", () => {
    const result = parseMessageBody("Simple text message");
    expect(result.text).toBe("Simple text message");
    expect(result.type).toBeUndefined();
    expect(result.message).toBeUndefined();
    expect(result.media).toBeUndefined();
    expect(result.sourceMessage).toBeUndefined();
  });

  it("parses object body with text field", () => {
    const result = parseMessageBody({ text: "Object text" });
    expect(result.text).toBe("Object text");
  });

  it("parses object body with type field", () => {
    const result = parseMessageBody({ text: "Message", type: "moderator_submitted" });
    expect(result.text).toBe("Message");
    expect(result.type).toBe("moderator_submitted");
  });

  it("parses object body with message field", () => {
    const result = parseMessageBody({ text: "Response", message: "msg-123" });
    expect(result.text).toBe("Response");
    expect(result.message).toBe("msg-123");
  });

  it("parses object body with media array", () => {
    const media = [
      { type: "image", data: "base64data", mimeType: "image/png" },
    ];
    const result = parseMessageBody({ text: "Image message", media });
    expect(result.text).toBe("Image message");
    expect(result.media).toEqual(media);
  });

  it("parses object body with sourceMessage field", () => {
    const result = parseMessageBody({
      text: "Visual response",
      sourceMessage: "msg-456",
      media: [{ type: "image", data: "data", mimeType: "image/png" }],
    });
    expect(result.text).toBe("Visual response");
    expect(result.sourceMessage).toBe("msg-456");
  });

  it("returns undefined for sourceMessage when not present", () => {
    const result = parseMessageBody({ text: "Regular message" });
    expect(result.sourceMessage).toBeUndefined();
  });

  it("returns empty string for text when text field is missing in object", () => {
    const result = parseMessageBody({ type: "moderator_submitted" });
    expect(result.text).toBe("");
  });

  it("handles non-array media value gracefully", () => {
    const result = parseMessageBody({ text: "Message", media: "not-an-array" });
    expect(result.text).toBe("Message");
    expect(result.media).toBeUndefined();
  });

  it("parses all fields together", () => {
    const media = [{ type: "image", data: "data", mimeType: "image/png" }];
    const result = parseMessageBody({
      text: "Complete message",
      type: "multimodal",
      message: "msg-123",
      media,
      sourceMessage: "msg-456",
    });
    expect(result.text).toBe("Complete message");
    expect(result.type).toBe("multimodal");
    expect(result.message).toBe("msg-123");
    expect(result.media).toEqual(media);
    expect(result.sourceMessage).toBe("msg-456");
  });

  it("converts non-string values to string for text field", () => {
    const result = parseMessageBody({ text: 123 });
    expect(result.text).toBe("123");
  });

  it("converts non-string values to string for type field", () => {
    const result = parseMessageBody({ text: "Message", type: 456 });
    expect(result.type).toBe("456");
  });

  it("converts non-string values to string for message field", () => {
    const result = parseMessageBody({ text: "Message", message: 789 });
    expect(result.message).toBe("789");
  });

  it("converts non-string values to string for sourceMessage field", () => {
    const result = parseMessageBody({ text: "Message", sourceMessage: 999 });
    expect(result.sourceMessage).toBe("999");
  });
});
