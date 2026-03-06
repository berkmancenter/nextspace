import { createMentionsEnhancer } from "../../components/enhancers/mentionsEnhancer";

describe("createMentionsEnhancer", () => {
  const contributors = [
    "Alice",
    "Bob Smith",
    "Charlie Brown Jr",
    "dave",
  ];

  const enhancer = createMentionsEnhancer(contributors);

  // ─── detectTrigger ────────────────────────────────────────────────────────

  describe("detectTrigger", () => {
    it("returns null when there is no @ symbol", () => {
      expect(enhancer.detectTrigger("hello world", 11)).toBeNull();
    });

    it("returns null when @ is mid-word (e.g. email address)", () => {
      const text = "user@example.com";
      expect(enhancer.detectTrigger(text, text.length)).toBeNull();
    });

    it("detects trigger with empty query immediately after @", () => {
      const text = "@";
      const result = enhancer.detectTrigger(text, text.length);
      expect(result).not.toBeNull();
      expect(result!.query).toBe("");
    });

    it("detects trigger for a single-word handle in progress", () => {
      const text = "@Ali";
      const result = enhancer.detectTrigger(text, text.length);
      expect(result).not.toBeNull();
      expect(result!.query).toBe("Ali");
      expect(result!.replaceStart).toBe(0);
      expect(result!.replaceEnd).toBe(text.length);
    });

    it("detects trigger for a multi-word handle in progress", () => {
      const text = "@Bob Sm";
      const result = enhancer.detectTrigger(text, text.length);
      expect(result).not.toBeNull();
      expect(result!.query).toBe("Bob Sm");
    });

    it("detects trigger for a three-word handle in progress", () => {
      const text = "@Charlie Brown";
      const result = enhancer.detectTrigger(text, text.length);
      expect(result).not.toBeNull();
      expect(result!.query).toBe("Charlie Brown");
    });

    it("detects trigger when @ mention appears after other text", () => {
      const text = "Hey @Bob";
      const result = enhancer.detectTrigger(text, text.length);
      expect(result).not.toBeNull();
      expect(result!.query).toBe("Bob");
      expect(result!.replaceStart).toBe(4); // position of @
    });

    it("detects trigger for multi-word mention after other text", () => {
      const text = "Hello @Bob Sm";
      const result = enhancer.detectTrigger(text, text.length);
      expect(result).not.toBeNull();
      expect(result!.query).toBe("Bob Sm");
    });

    it("returns null after a completed mention followed by a space", () => {
      // After selecting "Bob Smith " the cursor is past the trailing space,
      // and the next character typed would start a new token — there is no
      // active @-token at the cursor position.
      const text = "@Bob Smith ";
      expect(enhancer.detectTrigger(text, text.length)).toBeNull();
    });

    it("uses cursor position, not end of string", () => {
      const text = "@Ali more text";
      // Cursor is right after "@Ali" (position 4), so we should detect "Ali"
      const result = enhancer.detectTrigger(text, 4);
      expect(result).not.toBeNull();
      expect(result!.query).toBe("Ali");
    });
  });

  // ─── getItems ─────────────────────────────────────────────────────────────

  describe("getItems", () => {
    it("returns all contributors for an empty query", () => {
      expect(enhancer.getItems("")).toHaveLength(contributors.length);
    });

    it("filters by single-word prefix (case-insensitive)", () => {
      const items = enhancer.getItems("ali");
      expect(items).toHaveLength(1);
      expect(items[0].pseudonym).toBe("Alice");
    });

    it("filters by multi-word prefix", () => {
      const items = enhancer.getItems("Bob S");
      expect(items).toHaveLength(1);
      expect(items[0].pseudonym).toBe("Bob Smith");
    });

    it("filters by three-word prefix", () => {
      const items = enhancer.getItems("Charlie Brown");
      expect(items).toHaveLength(1);
      expect(items[0].pseudonym).toBe("Charlie Brown Jr");
    });

    it("returns empty array when no contributors match", () => {
      expect(enhancer.getItems("xyz")).toHaveLength(0);
    });
  });

  // ─── onSelect ─────────────────────────────────────────────────────────────

  describe("onSelect", () => {
    it("replaces a partial single-word mention with the full handle", () => {
      const value = "@Ali";
      const cursor = value.length;
      const result = enhancer.onSelect({ pseudonym: "Alice" }, value, cursor);
      expect(result.value).toBe("@Alice ");
      expect(result.cursorPos).toBe("@Alice ".length);
    });

    it("replaces a partial multi-word mention with the full handle", () => {
      const value = "@Bob Sm";
      const cursor = value.length;
      const result = enhancer.onSelect({ pseudonym: "Bob Smith" }, value, cursor);
      expect(result.value).toBe("@Bob Smith ");
      expect(result.cursorPos).toBe("@Bob Smith ".length);
    });

    it("replaces a mention that appears after other text", () => {
      const value = "Hey @Bob Sm";
      const cursor = value.length;
      const result = enhancer.onSelect({ pseudonym: "Bob Smith" }, value, cursor);
      expect(result.value).toBe("Hey @Bob Smith ");
      expect(result.cursorPos).toBe("Hey @Bob Smith ".length);
    });

    it("preserves text that comes after the cursor", () => {
      // Cursor is right after "@Ali", with " more" following
      const value = "@Ali more";
      const cursor = 4; // after "@Ali"
      const result = enhancer.onSelect({ pseudonym: "Alice" }, value, cursor);
      expect(result.value).toBe("@Alice  more");
    });

    it("handles single-word handles correctly", () => {
      const value = "@d";
      const cursor = value.length;
      const result = enhancer.onSelect({ pseudonym: "dave" }, value, cursor);
      expect(result.value).toBe("@dave ");
      expect(result.cursorPos).toBe("@dave ".length);
    });
  });

  // ─── button.onClick ───────────────────────────────────────────────────────

  describe("button.onClick", () => {
    it("inserts @ when there is no existing mention at cursor", () => {
      const value = "hello";
      const cursor = value.length;
      const result = enhancer.button.onClick(value, cursor);
      expect(result.value).toBe("hello@");
      expect(result.cursorPos).toBe(cursor + 1);
    });

    it("removes a bare @ token", () => {
      const value = "@";
      const result = enhancer.button.onClick(value, value.length);
      expect(result.value).toBe("");
    });

    it("removes a single-word mention token", () => {
      const value = "@Ali";
      const result = enhancer.button.onClick(value, value.length);
      expect(result.value).toBe("");
    });

    it("removes a multi-word mention token", () => {
      const value = "@Bob Smith";
      const result = enhancer.button.onClick(value, value.length);
      expect(result.value).toBe("");
    });

    it("removes only the mention token, preserving surrounding text", () => {
      const value = "Hey @Bob Sm";
      const cursor = value.length;
      const result = enhancer.button.onClick(value, cursor);
      expect(result.value).toBe("Hey ");
    });
  });
});
