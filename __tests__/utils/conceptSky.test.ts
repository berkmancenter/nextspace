import {
  buildSkyModel,
  conceptSessions,
  contributionShape,
  filterSky,
  focusSet,
  layoutOrbit,
  layoutSky,
  listEntries,
  ORBIT_RINGS,
  orbitEase,
  placeContributions,
  placePrompts,
  promptConceptLinks,
  promptContributionLinks,
  promptLedTo,
  sessionArcs,
  SKY_HEIGHT,
  SKY_WIDTH,
  starRadius,
  tweenPositions,
} from '../../utils/conceptSky';
import {
  conceptGraphFixture,
  emptyConceptGraphFixture,
  minimalConceptGraphFixture,
  seriesConceptGraphFixture,
} from '../../content/conceptGraphFixture';
import { ConceptGraphPayload } from '../../types.internal';

const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

describe('buildSkyModel', () => {
  it('counts distinct neighbour concepts, not contributions', () => {
    const m = buildSkyModel(conceptGraphFixture);
    // c-personalization: burnout (k3), habit (k20); one leaf adds nothing.
    expect(m.degree.get('c-personalization')).toBe(2);
    // c-trust: skepticism (k1, k18), workplace norms (k2), assistant (k18).
    expect(m.degree.get('c-trust')).toBe(3);
    // c-hallucination has only a leaf.
    expect(m.degree.get('c-hallucination')).toBe(0);
  });

  it('excludes origin prompts from degree', () => {
    const m = buildSkyModel(conceptGraphFixture);
    const bare = buildSkyModel({ ...conceptGraphFixture, originPrompts: [] });
    expect([...m.degree]).toEqual([...bare.degree]);
  });

  it('ignores unknown concept ids and picks the first most-connected concept as top', () => {
    const m = buildSkyModel({
      concepts: [
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B' },
      ],
      contributions: [{ id: 'k', kind: 'x', concepts: ['a', 'b', 'ghost', 'a'] }],
      originPrompts: [],
    });
    expect(m.degree.get('a')).toBe(1);
    expect(m.topConcept).toBe('a');
  });

  it('handles an empty payload', () => {
    const m = buildSkyModel(emptyConceptGraphFixture);
    expect(m.topConcept).toBeNull();
    expect(layoutSky(m).size).toBe(0);
    expect(layoutOrbit(m).center).toBeNull();
    expect(listEntries(m)).toEqual([]);
    expect(filterSky(m, 'all').isEmpty).toBe(true);
  });
});

describe('shapes and sizes', () => {
  it('draws two concepts as a line and anything else as a diamond', () => {
    expect([1, 2, 3, 4].map(contributionShape)).toEqual(['diamond', 'line', 'diamond', 'diamond']);
  });
  it('caps star radius', () => {
    expect(starRadius(0)).toBe(3);
    expect(starRadius(40)).toBe(14);
  });
});

describe('layoutSky', () => {
  const fixtures = {
    full: conceptGraphFixture,
    series: seriesConceptGraphFixture,
    minimal: minimalConceptGraphFixture,
  };

  it.each(Object.entries(fixtures))('is deterministic and independent of payload order (%s)', (_n, payload) => {
    const a = layoutSky(buildSkyModel(payload));
    const b = layoutSky(buildSkyModel(payload));
    expect([...a]).toEqual([...b]);
    const reversed = layoutSky(buildSkyModel({ ...payload, concepts: [...payload.concepts].reverse() }));
    for (const [id, p] of a) expect(reversed.get(id)).toEqual(p);
  });

  it.each(Object.entries(fixtures))('keeps every star inside the sky and apart (%s)', (_n, payload) => {
    const pos = layoutSky(buildSkyModel(payload));
    expect(pos.size).toBe(payload.concepts.length);
    for (const p of pos.values()) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(SKY_WIDTH);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThanOrEqual(SKY_HEIGHT);
    }
    const all = [...pos.values()];
    for (let i = 0; i < all.length; i++)
      for (let j = i + 1; j < all.length; j++) expect(dist(all[i], all[j])).toBeGreaterThan(30);
  });

  it('puts a lone concept in the middle', () => {
    expect(layoutSky(buildSkyModel(minimalConceptGraphFixture)).get('min-c-assistant')).toEqual({ x: 500, y: 340 });
  });

  it('separates a larger crowd without star overlap', () => {
    const concepts = Array.from({ length: 40 }, (_, i) => ({ id: `n${i}`, label: `Concept number ${i}` }));
    const contributions = concepts.slice(1).map((c, i) => ({ id: `k${i}`, kind: 'x', concepts: ['n0', c.id] }));
    const pos = [...layoutSky(buildSkyModel({ concepts, contributions, originPrompts: [] })).values()];
    for (let i = 0; i < pos.length; i++)
      for (let j = i + 1; j < pos.length; j++) expect(dist(pos[i], pos[j])).toBeGreaterThan(20);
  });
});

describe('layoutOrbit', () => {
  const model = buildSkyModel(conceptGraphFixture);

  it('centres the selected concept and puts neighbours on ring 1', () => {
    const o = layoutOrbit(model, 'c-trust');
    expect(o.positions.get('c-trust')).toEqual({ x: 500, y: 340 });
    for (const id of ['c-skepticism', 'c-workplace-norms', 'c-assistant']) {
      expect(o.ring.get(id)).toBe(1);
    }
  });

  it('places ring members at their ring radius from the centre (before nudging, within tolerance)', () => {
    const o = layoutOrbit(model, 'c-trust');
    for (const [id, p] of o.positions) {
      if (id === 'c-trust') continue;
      expect(dist(p, { x: 500, y: 340 })).toBeCloseTo(ORBIT_RINGS[o.ring.get(id)!], 0);
    }
  });

  it('assigns hop distance by BFS and puts disconnected concepts on the outermost ring', () => {
    const o = layoutOrbit(model, 'c-trust');
    // trust -> skepticism -> assistant? assistant is also 1 via k18; habit is trust-skepticism-... not connected to trust at 2? check chain
    expect(o.ring.get('c-hallucination')).toBe(4);
    expect(o.ring.get('c-habit')).toBe(4); // habit/personalization/burnout/boundary/attachment form a separate island
    expect(o.ring.get('c-boundary-setting')).toBe(4);
  });

  it('falls back to the most connected concept for a missing or non-concept selection', () => {
    expect(layoutOrbit(model).center).toBe(model.topConcept);
    expect(layoutOrbit(model, 'k18').center).toBe(model.topConcept);
    expect(layoutOrbit(model, 'nope').center).toBe(model.topConcept);
  });

  it('gives 2 and 3 hop rings on a chain', () => {
    const chain: ConceptGraphPayload = {
      originPrompts: [],
      concepts: ['a', 'b', 'c', 'd', 'e'].map((id) => ({ id, label: id })),
      contributions: [
        { id: 'k1', kind: 'x', concepts: ['a', 'b'] },
        { id: 'k2', kind: 'x', concepts: ['b', 'c'] },
        { id: 'k3', kind: 'x', concepts: ['c', 'd'] },
        { id: 'k4', kind: 'x', concepts: ['d', 'e'] },
      ],
    };
    const o = layoutOrbit(buildSkyModel(chain), 'a');
    expect(['b', 'c', 'd', 'e'].map((id) => o.ring.get(id))).toEqual([1, 2, 3, 4]);
  });

  it('keeps a child near its parent on an outer ring', () => {
    const payload: ConceptGraphPayload = {
      originPrompts: [],
      concepts: ['hub', 'p1', 'p2', 'p3', 'p4', 'k1', 'k4'].map((id) => ({ id, label: id })),
      contributions: [
        ...['p1', 'p2', 'p3', 'p4'].map((p, i) => ({ id: `h${i}`, kind: 'x', concepts: ['hub', p] })),
        { id: 'a', kind: 'x', concepts: ['p1', 'k1'] },
        { id: 'b', kind: 'x', concepts: ['p4', 'k4'] },
      ],
    };
    const o = layoutOrbit(buildSkyModel(payload), 'hub');
    const near = (a: string, b: string) => dist(o.positions.get(a)!, o.positions.get(b)!);
    expect(near('k1', 'p1')).toBeLessThan(near('k1', 'p3'));
    expect(near('k4', 'p4')).toBeLessThan(near('k4', 'p2'));
  });

  it('is deterministic', () => {
    expect([...layoutOrbit(model, 'c-assistant').positions]).toEqual([...layoutOrbit(model, 'c-assistant').positions]);
  });

  it('nudges colliding labels on a crowded outer ring apart', () => {
    const concepts = [
      { id: 'hub', label: 'Hub' },
      ...Array.from({ length: 14 }, (_, i) => ({ id: `d${i}`, label: `Disconnected idea ${i}` })),
    ];
    const o = layoutOrbit(buildSkyModel({ concepts, contributions: [], originPrompts: [] }), 'hub');
    const pts = [...o.positions].filter(([id]) => id !== 'hub').map(([, p]) => p);
    for (let i = 0; i < pts.length; i++)
      for (let j = i + 1; j < pts.length; j++) expect(dist(pts[i], pts[j])).toBeGreaterThan(40);
  });

  it('handles a single concept', () => {
    const o = layoutOrbit(buildSkyModel(minimalConceptGraphFixture));
    expect(o.positions.size).toBe(1);
  });
});

describe('tweenPositions / orbitEase', () => {
  it('eases from 0 to 1 monotonically, fast then slow', () => {
    expect(orbitEase(0)).toBeCloseTo(0, 3);
    expect(orbitEase(1)).toBeCloseTo(1, 3);
    expect(orbitEase(0.5)).toBeGreaterThan(0.5);
    let prev = -1;
    for (let t = 0; t <= 1; t += 0.05) {
      const v = orbitEase(t);
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
  });
  it('interpolates shared ids only', () => {
    const out = tweenPositions(
      new Map([
        ['a', { x: 0, y: 0 }],
        ['gone', { x: 1, y: 1 }],
      ]),
      new Map([
        ['a', { x: 100, y: 50 }],
        ['new', { x: 1, y: 1 }],
      ]),
      1,
    );
    expect([...out.keys()]).toEqual(['a']);
    expect(out.get('a')!.x).toBeCloseTo(100, 2);
  });
});

describe('placeContributions', () => {
  const model = buildSkyModel(conceptGraphFixture);
  const pos = layoutSky(model);
  const placed = placeContributions(model, pos);
  const byId = new Map(placed.map((p) => [p.id, p]));

  it('places every contribution with the right shape and weight', () => {
    expect(placed).toHaveLength(conceptGraphFixture.contributions.length);
    expect(byId.get('k1')).toMatchObject({ shape: 'line', dashed: true });
    expect(byId.get('k20')).toMatchObject({ shape: 'line', dashed: false });
    expect(byId.get('k18')).toMatchObject({ shape: 'diamond', dashed: false });
    expect(byId.get('k19')).toMatchObject({ shape: 'diamond', dashed: true });
  });

  it('puts a multi-concept diamond at the centroid', () => {
    const cs = ['c-assistant', 'c-trust', 'c-skepticism'].map((id) => pos.get(id)!);
    const p = byId.get('k18')!.position;
    expect(p.x).toBeCloseTo(cs.reduce((s, c) => s + c.x, 0) / 3, 5);
    expect(p.y).toBeCloseTo(cs.reduce((s, c) => s + c.y, 0) / 3, 5);
  });

  it('keeps single-concept leaves off their star and off each other', () => {
    const star = pos.get('c-assistant')!;
    const leaves = ['k7', 'k8', 'k9'].map((id) => byId.get(id)!.position);
    for (const l of leaves) expect(dist(l, star)).toBeGreaterThan(starRadius(model.degree.get('c-assistant')!) + 10);
    expect(dist(leaves[0], leaves[1])).toBeGreaterThan(10);
    expect(dist(leaves[1], leaves[2])).toBeGreaterThan(10);
  });
});

describe('origin prompts', () => {
  const model = buildSkyModel(conceptGraphFixture);

  it('links at rest only to concepts', () => {
    expect(promptConceptLinks(conceptGraphFixture)).toEqual([{ promptId: 'p1', targetId: 'c-trust' }]);
  });
  it('links to contributions only when asked, and ignores unknown prompts', () => {
    expect(promptContributionLinks(conceptGraphFixture, 'p1')).toEqual([{ promptId: 'p1', targetId: 'k18' }]);
    expect(promptContributionLinks(conceptGraphFixture, 'p2')).toEqual([{ promptId: 'p2', targetId: 'k16' }]);
    expect(promptContributionLinks(conceptGraphFixture, 'zzz')).toEqual([]);
    expect(promptConceptLinks({ ...conceptGraphFixture, originPrompts: [] })).toEqual([]);
  });
  it('counts what a prompt led to', () => {
    expect(promptLedTo(conceptGraphFixture, 'p1')).toEqual({ concepts: 1, contributions: 1 });
    expect(promptLedTo(conceptGraphFixture, 'p2')).toEqual({ concepts: 0, contributions: 1 });
    expect(promptLedTo(conceptGraphFixture, 'none')).toEqual({ concepts: 0, contributions: 0 });
  });

  it.each([['sky'], ['orbit']])('places pills near what they led to without overlapping stars (%s)', (view) => {
    const pos = view === 'sky' ? layoutSky(model) : layoutOrbit(model, 'c-trust').positions;
    const pills = placePrompts(model, pos);
    expect(pills.size).toBe(2);
    const trust = pos.get('c-trust')!;
    expect(dist(pills.get('p1')!, trust)).toBeLessThan(80);
    for (const pill of pills.values()) {
      for (const [id, p] of pos) {
        expect(dist(pill, p)).toBeGreaterThan(starRadius(model.degree.get(id)!) + 8);
      }
    }
    expect(dist(pills.get('p1')!, pills.get('p2')!)).toBeGreaterThan(20);
  });

  it('still places a prompt, clamped inside the sky, when no free spot exists near its concept', () => {
    // A wall of stars covering the whole top-left corner leaves no room for a pill beside the anchor.
    const concepts = [{ id: 'anchor', label: 'Anchor', origin: 'crowded' }];
    const positions = new Map<string, { x: number; y: number }>([['anchor', { x: 4, y: 3 }]]);
    for (let x = 0; x <= 260; x += 10) {
      for (let y = 0; y <= 220; y += 10) {
        const id = `wall-${x}-${y}`;
        concepts.push({ id, label: '', origin: '' });
        positions.set(id, { x, y });
      }
    }
    const crowded = buildSkyModel({
      originPrompts: [{ id: 'crowded', text: 'Crowded?' }],
      concepts,
      contributions: [],
    });
    const pill = placePrompts(crowded, positions).get('crowded')!;
    expect(pill.x).toBeGreaterThanOrEqual(13);
    expect(pill.y).toBeGreaterThanOrEqual(6);
    expect(pill).toEqual({ x: 13, y: 6 });
  });

  it('places a prompt that produced nothing at the middle, and is deterministic', () => {
    const p: ConceptGraphPayload = { ...minimalConceptGraphFixture, concepts: [], contributions: [] };
    const m = buildSkyModel(p);
    const a = placePrompts(m, new Map());
    expect(a.get('min-p1')).toEqual(placePrompts(m, new Map()).get('min-p1'));
    expect(dist(a.get('min-p1')!, { x: 500, y: 340 })).toBeLessThan(5);
  });
});

describe('sessions', () => {
  const model = buildSkyModel(seriesConceptGraphFixture);

  it('infers a concept session set from its own provenance and its contributions', () => {
    const s = conceptSessions(model);
    expect(s.get('s-c-assistant')).toEqual([0, 1]); // own S1; k4 from S2
    expect(s.get('s-c-trust')).toEqual([0, 1, 2]); // own S1; k5 S2; k7 S3
    expect(s.get('s-c-blame')).toEqual([2]);
  });
  it('gives no sessions for a single-session graph', () => {
    const s = conceptSessions(buildSkyModel(conceptGraphFixture));
    expect([...s.values()].every((v) => v.length === 0)).toBe(true);
  });

  describe('sessionArcs', () => {
    it('is a full ring for a single session', () => {
      expect(sessionArcs([2], 20)).toEqual([{ sessionIndex: 2, start: 0, end: Math.PI * 2 }]);
      expect(sessionArcs([], 20)).toHaveLength(1);
    });
    it('runs clockwise from 12 in session order with gaps', () => {
      const arcs = sessionArcs([2, 0, 1], 30);
      expect(arcs.map((a) => a.sessionIndex)).toEqual([0, 1, 2]);
      for (let i = 0; i < arcs.length; i++) {
        expect(arcs[i].end).toBeGreaterThan(arcs[i].start);
        if (i > 0) expect(arcs[i].start).toBeGreaterThan(arcs[i - 1].end);
      }
      expect(arcs[0].start).toBeGreaterThan(0);
      expect(arcs[2].end).toBeLessThan(Math.PI * 2);
    });
    it('keeps arcs at least the minimum length on a tiny ring, and still fits', () => {
      const r = 6;
      const arcs = sessionArcs([0, 1, 2, 3], r, { minArcLength: 5 });
      for (const a of arcs) expect((a.end - a.start) * r).toBeGreaterThanOrEqual(5 - 1e-9);
      expect(arcs[arcs.length - 1].end).toBeLessThanOrEqual(Math.PI * 2 + 1e-9);
    });
    it('shares the ring equally when the floor cannot fit', () => {
      const arcs = sessionArcs([0, 1, 2, 3, 4, 5, 6, 7], 3, { minArcLength: 5 });
      expect(arcs[7].end).toBeLessThanOrEqual(Math.PI * 2 + 1e-9);
      expect(arcs[0].end - arcs[0].start).toBeCloseTo(Math.PI / 4, 5);
    });
  });
});

describe('filterSky', () => {
  const model = buildSkyModel(seriesConceptGraphFixture);

  it('leaves everything at full strength for the whole series', () => {
    const f = filterSky(model, 'all');
    expect(f.isEmpty).toBe(false);
    expect([...f.concepts.values()].every((c) => c.opacity === 1)).toBe(true);
  });

  it('fades concepts outside a session to 12% and their lines to 5%', () => {
    const f = filterSky(model, 2);
    expect(f.concepts.get('s-c-blame')).toEqual({ inFilter: true, opacity: 1 });
    expect(f.concepts.get('s-c-habit')).toEqual({ inFilter: false, opacity: 0.12 });
    expect(f.contributions.get('s-k3')).toEqual({ inFilter: false, opacity: 0.12, lineOpacity: 0.05 });
    expect(f.contributions.get('s-k6')!.inFilter).toBe(true);
    expect(f.prompts.get('s-p1')!.inFilter).toBe(false);
    expect(f.prompts.get('s-p2')!.inFilter).toBe(true);
    expect(f.isEmpty).toBe(false);
  });

  it('flags an empty filter, and a session the graph does not have', () => {
    const f = filterSky(model, 7);
    expect(f.isEmpty).toBe(true);
    expect([...f.concepts.values()].every((c) => c.opacity === 0.12)).toBe(true);
  });

  it('falls back to concepts when a contribution has no provenance', () => {
    const payload: ConceptGraphPayload = {
      ...seriesConceptGraphFixture,
      contributions: [{ id: 'x', kind: 'k', concepts: ['s-c-blame', 's-c-disappointment'] }],
    };
    const f = filterSky(buildSkyModel(payload), 2);
    expect(f.contributions.get('x')!.inFilter).toBe(true);
    expect(filterSky(buildSkyModel(payload), 0).contributions.get('x')!.inFilter).toBe(false);
  });
});

describe('focusSet', () => {
  const model = buildSkyModel(conceptGraphFixture);

  it('returns null with nothing focused', () => {
    expect(focusSet(model, null)).toBeNull();
  });
  it('keeps a concept, its neighbours and the contributions touching it', () => {
    const f = focusSet(model, 'c-trust')!;
    expect([...f.concepts].sort()).toEqual(['c-assistant', 'c-skepticism', 'c-trust', 'c-workplace-norms']);
    expect([...f.contributions].sort()).toEqual(['k1', 'k10', 'k18', 'k2']);
  });
  it("keeps only the focused node's own origin prompt, not its neighbours'", () => {
    expect(focusSet(model, 'c-trust')!.ids.has('p1')).toBe(true);
    expect(focusSet(model, 'c-skepticism')!.ids.has('p1')).toBe(false); // neighbour of trust, not its origin
    expect(focusSet(model, 'k18')!.ids.has('p1')).toBe(true);
  });
  it('keeps a contribution and the concepts it joins', () => {
    const f = focusSet(model, 'k1')!;
    expect([...f.concepts].sort()).toEqual(['c-skepticism', 'c-trust']);
    expect([...f.contributions]).toEqual(['k1']);
  });
  it('keeps what a prompt led to', () => {
    const f = focusSet(model, 'p1')!;
    expect(f.concepts.has('c-trust')).toBe(true);
    expect(f.contributions.has('k18')).toBe(true);
  });
  it('tolerates an unknown id', () => {
    expect([...focusSet(model, 'zzz')!.ids]).toEqual(['zzz']);
  });
});

describe('listEntries', () => {
  it('sorts by degree then label and lists connections', () => {
    const list = listEntries(buildSkyModel(conceptGraphFixture));
    expect(list).toHaveLength(10);
    for (let i = 1; i < list.length; i++) expect(list[i - 1].degree).toBeGreaterThanOrEqual(list[i].degree);
    const trust = list.find((e) => e.id === 'c-trust')!;
    expect(trust.degree).toBe(3);
    expect(trust.contributionCount).toBe(4);
    expect(trust.connections.map((c) => c.label).sort()).toEqual(['Skepticism', 'The Assistant', 'Workplace Norms']);
    expect(list[list.length - 1].degree).toBe(0);
  });
  it('carries folded labels and honours the filter', () => {
    const model = buildSkyModel(seriesConceptGraphFixture);
    expect(listEntries(model).find((e) => e.id === 's-c-trust')!.foldedFrom).toEqual(['Reliability']);
    const s3 = listEntries(model, 2);
    expect(s3.map((e) => e.id).sort()).toEqual(
      ['s-c-assistant'.replace('assistant', 'blame'), 's-c-disappointment', 's-c-trust'].sort(),
    );
  });
});
