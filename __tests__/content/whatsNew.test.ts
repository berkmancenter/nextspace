import { getRecentEntries, whatsNewEntries } from "../../content/whatsNew";

describe("whatsNewEntries", () => {
  it("has no entries with invalid releasedAt dates", () => {
    whatsNewEntries.forEach((entry) => {
      expect(new Date(entry.releasedAt).getTime()).not.toBeNaN();
    });
  });
});

describe("getRecentEntries", () => {
  const realDateNow = Date.now;

  // Pin "now" to a fixed point so date arithmetic is deterministic
  const NOW = new Date("2026-04-06").getTime();

  beforeEach(() => {
    Date.now = jest.fn(() => NOW);
  });

  afterEach(() => {
    Date.now = realDateNow;
  });

  function makeEntry(daysAgo: number): WhatsNewEntry {
    // daysAgo days before the pinned NOW
    const ms = NOW - daysAgo * 24 * 60 * 60 * 1000;
    return {
      title: `Entry ${daysAgo}d ago`,
      body: "Some description",
      releasedAt: new Date(ms).toISOString().slice(0, 10),
    };
  }

  it("returns entries within the default 14-day window", () => {
    const entries = [makeEntry(7)]; // 7 days ago — inside the window
    expect(getRecentEntries(14, entries)).toHaveLength(1);
  });

  it("excludes entries older than the window", () => {
    const entries = [makeEntry(15)]; // 15 days ago — outside 14-day window
    expect(getRecentEntries(14, entries)).toHaveLength(0);
  });

  it("excludes future-dated entries", () => {
    const entries = [makeEntry(-5)]; // 5 days ahead of pinned NOW
    expect(getRecentEntries(14, entries)).toHaveLength(0);
  });

  it("sorts results newest-first", () => {
    const entries = [makeEntry(10), makeEntry(3), makeEntry(7)];
    const results = getRecentEntries(14, entries);
    expect(results[0].title).toBe("Entry 3d ago");
    expect(results[1].title).toBe("Entry 7d ago");
    expect(results[2].title).toBe("Entry 10d ago");
  });

  it("respects a custom windowDays argument", () => {
    const entries = [makeEntry(30)]; // 30 days ago
    expect(getRecentEntries(14, entries)).toHaveLength(0);
    expect(getRecentEntries(31, entries)).toHaveLength(1);
  });
});
