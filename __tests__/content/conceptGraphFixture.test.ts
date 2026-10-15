import {
  conceptGraphFixture,
  denseConceptGraphFixture,
  emptyConceptGraphFixture,
  longSeriesConceptGraphFixture,
  minimalConceptGraphFixture,
  seriesConceptGraphFixture,
} from '../../content/conceptGraphFixture';
import { buildGraph, sessionIndexById } from '../../utils/conceptGraph';
import { ConceptGraphPayload } from '../../types.internal';

const fixtures: [string, ConceptGraphPayload][] = [
  ['conceptGraphFixture', conceptGraphFixture],
  ['minimalConceptGraphFixture', minimalConceptGraphFixture],
  ['emptyConceptGraphFixture', emptyConceptGraphFixture],
  ['seriesConceptGraphFixture', seriesConceptGraphFixture],
  ['longSeriesConceptGraphFixture', longSeriesConceptGraphFixture],
  ['denseConceptGraphFixture', denseConceptGraphFixture],
];

/* The backend guarantees these properties of every payload it serves, and the renderer is
   written to rely on them — it looks ids up without null-guarding each one. A fixture that
   broke them would let the preview page and these tests pass on data the real API can never
   produce, which is the one way a fixture can actively mislead. */
describe.each(fixtures)('%s holds to the guarantees the API makes', (_name, fixture) => {
  const { concepts, contributions, originPrompts } = fixture;

  it('uses ids that are unique across all three arrays, not merely within each', () => {
    const ids = [...concepts, ...contributions, ...originPrompts].map((node) => node.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('joins only concepts that exist in the same payload', () => {
    const conceptIds = new Set(concepts.map((c) => c.id));
    for (const contribution of contributions) {
      expect(contribution.concepts.length).toBeGreaterThan(0);
      for (const id of contribution.concepts) {
        expect(conceptIds).toContain(id);
      }
    }
  });

  it('points every origin at a prompt in the same payload', () => {
    const promptIds = new Set(originPrompts.map((p) => p.id));
    for (const node of [...concepts, ...contributions]) {
      if (node.origin) expect(promptIds).toContain(node.origin);
    }
  });

  it('gives every concept a label to draw and every contribution a kind', () => {
    for (const concept of concepts) expect(concept.label.trim()).not.toBe('');
    for (const contribution of contributions) expect(contribution.kind.trim()).not.toBe('');
  });

  it('builds without losing or inventing a node', () => {
    const { simNodes } = buildGraph(fixture);
    // A contribution joining exactly two concepts becomes a link rather than a node of its
    // own — see buildGraph — so it isn't counted here; every other contribution still is.
    const nodedContributions = contributions.filter((k) => k.concepts.length !== 2).length;
    expect(simNodes).toHaveLength(concepts.length + nodedContributions + originPrompts.length);
  });
});

describe('conceptGraphFixture exercises the cases worth looking at', () => {
  it('includes a contribution joining three concepts, which an edge could not express', () => {
    expect(conceptGraphFixture.contributions.some((k) => k.concepts.length > 2)).toBe(true);
  });

  it('spreads degree widely enough for the size scales to do something', () => {
    const { degree } = buildGraph(conceptGraphFixture);
    const conceptDegrees = conceptGraphFixture.concepts.map((c) => degree.get(c.id) ?? 0);

    expect(Math.min(...conceptDegrees)).toBeLessThan(2);
    expect(Math.max(...conceptDegrees)).toBeGreaterThan(4);
  });

  it('attaches an origin prompt to a concept and to a contribution, so both dashed links draw', () => {
    expect(conceptGraphFixture.concepts.some((c) => c.origin)).toBe(true);
    expect(conceptGraphFixture.contributions.some((k) => k.origin)).toBe(true);
  });

  it('leaves some contributions without a statement, since the field is optional', () => {
    expect(conceptGraphFixture.contributions.some((k) => k.statement)).toBe(true);
    expect(conceptGraphFixture.contributions.some((k) => !k.statement)).toBe(true);
  });

  it('exercises all four combinations of shape (diamond or line) and weight (quoted or not)', () => {
    // Concept count decides the shape (see buildGraph); statement presence is independent of
    // it. Without cases like k19 and k20, some combination always goes undrawn on the preview
    // page and untested here — most commonly a quoted diamond with no statement-less
    // counterpart, or a quoted two-concept line, since real data skews heavily toward a
    // statement on a diamond and none on a line (see the doc comment above).
    const diamonds = conceptGraphFixture.contributions.filter((k) => k.concepts.length !== 2);
    const lines = conceptGraphFixture.contributions.filter((k) => k.concepts.length === 2);
    expect(diamonds.some((k) => k.statement)).toBe(true);
    expect(diamonds.some((k) => !k.statement)).toBe(true);
    expect(lines.some((k) => k.statement)).toBe(true);
    expect(lines.some((k) => !k.statement)).toBe(true);
  });

  it('attributes nothing, as a graph from a Chatham House Rule event must not', () => {
    const nodes = [
      ...conceptGraphFixture.concepts,
      ...conceptGraphFixture.contributions,
      ...conceptGraphFixture.originPrompts,
    ];
    expect(nodes.every((node) => !node.provenance)).toBe(true);
  });
});

describe('seriesConceptGraphFixture models what a topic graph is', () => {
  it('draws on several sessions, which is what makes it a series', () => {
    expect(sessionIndexById(seriesConceptGraphFixture).size).toBeGreaterThan(1);
  });

  it('keeps a concept returned to across sessions as one node, not one per session', () => {
    const trust = seriesConceptGraphFixture.concepts.filter((c) => c.label === 'Trust');
    const { degree } = buildGraph(seriesConceptGraphFixture);

    // A topic graph is refined rather than rebuilt, so recurrence shows up as degree.
    expect(trust).toHaveLength(1);
    expect(degree.get(trust[0].id)).toBeGreaterThan(1);
  });

  it('carries the session a node came from, and nothing that identifies a person', () => {
    const nodes = [
      ...seriesConceptGraphFixture.concepts,
      ...seriesConceptGraphFixture.contributions,
      ...seriesConceptGraphFixture.originPrompts,
    ];

    expect(nodes.every((node) => node.provenance?.conversationId)).toBe(true);
    expect(nodes.every((node) => !node.provenance?.pseudonym && !node.provenance?.messageId)).toBe(true);
  });
});

describe('the series fixtures exercise the session rings and marks', () => {
  const sessionsOf = (id: string) =>
    new Set(
      [...seriesConceptGraphFixture.concepts, ...seriesConceptGraphFixture.contributions]
        .filter((n) => ('concepts' in n ? n.concepts.includes(id) : n.id === id))
        .map((n) => n.provenance?.conversationId),
    );

  it('has concepts that appear in two and in three sessions, so rings carry several arcs', () => {
    expect(sessionsOf('s-c-assistant').size).toBe(2);
    expect(sessionsOf('s-c-trust').size).toBe(3);
  });

  it('has a quoted line, a summary-only line, a quoted three-concept diamond and a summary-only leaf', () => {
    const ks = seriesConceptGraphFixture.contributions;
    expect(ks.some((k) => k.concepts.length === 2 && k.statement)).toBe(true);
    expect(ks.some((k) => k.concepts.length === 2 && !k.statement)).toBe(true);
    expect(ks.some((k) => k.concepts.length === 3 && k.statement)).toBe(true);
  });

  it('attaches an origin prompt to a concept and to a contribution', () => {
    expect(seriesConceptGraphFixture.concepts.some((c) => c.origin)).toBe(true);
    expect(seriesConceptGraphFixture.contributions.some((k) => k.origin)).toBe(true);
  });

  it('spans more sessions than there are session colours in the long series', () => {
    expect(sessionIndexById(longSeriesConceptGraphFixture).size).toBeGreaterThan(8);
  });
});

describe('denseConceptGraphFixture models a real series graph', () => {
  const { concepts, contributions, originPrompts } = denseConceptGraphFixture;

  it('is about fifty concepts and eighty-five contributions with no provenance and no prompts', () => {
    expect(concepts).toHaveLength(47);
    expect(contributions).toHaveLength(85);
    expect(originPrompts).toEqual([]);
    expect([...concepts, ...contributions].every((n) => !n.provenance)).toBe(true);
    expect(sessionIndexById(denseConceptGraphFixture).size).toBe(0);
  });

  it('is about two thirds lines and the rest diamonds of three to five concepts', () => {
    const lines = contributions.filter((k) => k.concepts.length === 2).length;
    expect(lines).toBeGreaterThan(50);
    expect(lines).toBeLessThan(65);
    expect(Math.max(...contributions.map((k) => k.concepts.length))).toBe(5);
    expect(contributions.every((k) => new Set(k.concepts).size === k.concepts.length)).toBe(true);
  });

  it('has a few summary-only contributions, statements up to about 300 characters, glosses on some, and folded concepts', () => {
    expect(contributions.filter((k) => !k.statement)).toHaveLength(3);
    expect(Math.max(...contributions.map((k) => k.statement?.length ?? 0))).toBeLessThanOrEqual(300);
    expect(concepts.filter((c) => c.gloss).length).toBeGreaterThan(15);
    expect(concepts.filter((c) => c.foldedFrom?.length).length).toBeGreaterThan(2);
  });
});
