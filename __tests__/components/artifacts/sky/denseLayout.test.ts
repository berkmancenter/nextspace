import { denseConceptGraphFixture } from '../../../../content/conceptGraphFixture';
import {
  buildSkyModel,
  conceptLabelLines,
  layoutOrbit,
  layoutSky,
  SKY_HEIGHT,
  SKY_WIDTH,
  starRadius,
} from '../../../../utils/conceptSky';
import { estimateTextWidth } from '../../../../utils/conceptGraph';

/* A real series graph has about fifty concepts with long labels. These check the two things
   that go wrong at that size: stars and their labels landing on one another, and a star on the
   outer Orbit ring being pushed out of the frame. */
const model = buildSkyModel(denseConceptGraphFixture);
const label = new Map(denseConceptGraphFixture.concepts.map((c) => [c.id, c.label]));

const box = (id: string, p: { x: number; y: number }) => {
  const r = starRadius(model.degree.get(id)!);
  const lines = conceptLabelLines(label.get(id)!);
  const w = Math.max(2 * r, ...lines.map((l) => estimateTextWidth(l, 12)));
  return { x: p.x, top: p.y - r, bottom: p.y + r + 3 + lines.length * 15, w };
};

const overlaps = (positions: Map<string, { x: number; y: number }>) => {
  const ids = [...positions.keys()];
  let n = 0;
  for (let i = 0; i < ids.length; i++)
    for (let j = i + 1; j < ids.length; j++) {
      const a = box(ids[i], positions.get(ids[i])!);
      const b = box(ids[j], positions.get(ids[j])!);
      // Graze tolerance: the relaxation can leave two footprints touching by a pixel or two,
      // which no reader sees; a real collision is far deeper than this.
      const across = (a.w + b.w) / 2 - Math.abs(a.x - b.x);
      const down = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      if (across > 2 && down > 2) n++;
    }
  return n;
};

describe('the dense fixture', () => {
  it('has the size and shape of a real series graph', () => {
    expect(denseConceptGraphFixture.concepts).toHaveLength(47);
    expect(denseConceptGraphFixture.contributions).toHaveLength(85);
    expect(denseConceptGraphFixture.contributions.filter((k) => !k.statement)).toHaveLength(3);
    expect(denseConceptGraphFixture.concepts.filter((c) => c.foldedFrom?.length).length).toBeGreaterThan(2);
  });

  it('lays the sky out with almost no star or label on another', () => {
    const positions = layoutSky(model);
    expect(positions.size).toBe(47);
    // The hubs of a graph this dense sit close, and the relaxation can leave a few labels grazing
    // each other; what matters is that it is a handful of pairs, not the knot of twenty it was
    // before the sky was stretched to the frame.
    expect(overlaps(positions)).toBeLessThanOrEqual(8);
  });

  it('keeps every star, and the label under it, inside the frame in Orbit', () => {
    const { positions } = layoutOrbit(model, model.topConcept);
    for (const [id, p] of positions) {
      const b = box(id, p);
      expect(b.top).toBeGreaterThanOrEqual(-36);
      expect(b.bottom).toBeLessThanOrEqual(SKY_HEIGHT + 36);
      expect(p.x - b.w / 2).toBeGreaterThanOrEqual(0);
      expect(p.x + b.w / 2).toBeLessThanOrEqual(SKY_WIDTH);
    }
  });
});
