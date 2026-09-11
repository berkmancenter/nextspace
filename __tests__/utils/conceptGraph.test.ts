import { buildGraph, computeFitTransform, connectedIds, describeGraph, linkEndpointId } from '../../utils/conceptGraph';

const payload = {
  originPrompts: [{ id: 'p1', text: 'What has to be trustworthy here?' }],
  concepts: [
    { id: 'c-issuer', label: 'Issuer', origin: 'p1' },
    { id: 'c-verifier', label: 'Verifier' },
    { id: 'c-registry', label: 'Trust Registry' },
    { id: 'c-lonely', label: 'Key Rotation' },
  ],
  contributions: [
    { id: 'k8', kind: 'listed in', concepts: ['c-issuer', 'c-registry'] },
    { id: 'k15', kind: 'co-governs', concepts: ['c-issuer', 'c-verifier', 'c-registry'], origin: 'p1' },
  ],
};

describe('buildGraph', () => {
  it('makes a node of every concept, contribution and origin prompt', () => {
    const { simNodes } = buildGraph(payload);

    expect(simNodes).toHaveLength(7);
    expect(simNodes.filter((n) => n.type === 'concept')).toHaveLength(4);
    expect(simNodes.filter((n) => n.type === 'contribution')).toHaveLength(2);
    expect(simNodes.filter((n) => n.type === 'origin')).toHaveLength(1);
  });

  it('draws a concept by its label, not its id', () => {
    const { simNodes } = buildGraph(payload);
    expect(simNodes.find((n) => n.id === 'c-issuer')?.label).toBe('Issuer');
  });

  it('links a contribution to every concept it joins, three included', () => {
    const { links } = buildGraph(payload);
    const fromK15 = links.filter((l) => linkEndpointId(l.source) === 'k15').map((l) => linkEndpointId(l.target));

    expect(fromK15).toEqual(['c-issuer', 'c-verifier', 'c-registry']);
  });

  it('counts degree from contribution links', () => {
    const { degree } = buildGraph(payload);

    expect(degree.get('c-issuer')).toBe(2); // in both contributions
    expect(degree.get('c-verifier')).toBe(1);
    expect(degree.get('c-lonely')).toBe(0);
    expect(degree.get('k15')).toBe(3); // a contribution's degree is how many concepts it joins
  });

  it('keeps origin attachments out of the degree count', () => {
    // c-issuer and k15 both carry origin: 'p1'. Attribution is not connectedness, so
    // neither their degree nor the prompt's may move because of it.
    const { degree, originLinks } = buildGraph(payload);

    expect(originLinks).toHaveLength(2);
    expect(degree.get('p1')).toBe(0);
    expect(degree.get('c-issuer')).toBe(2);
    expect(degree.get('k15')).toBe(3);
  });

  it('keeps origin links out of the contribution links the graph means', () => {
    const { links, originLinks } = buildGraph(payload);

    expect(links.every((l) => linkEndpointId(l.source) !== 'p1')).toBe(true);
    expect(originLinks.map((l) => linkEndpointId(l.source))).toEqual(['p1', 'p1']);
    expect(originLinks.map((l) => linkEndpointId(l.target))).toEqual(['c-issuer', 'k15']);
  });

  it('handles an empty payload, which is a valid artifact', () => {
    expect(buildGraph({})).toEqual({ simNodes: [], links: [], originLinks: [], degree: new Map() });
  });

  it('carries a contribution statement onto its node for the detail panel', () => {
    const { simNodes } = buildGraph({
      concepts: [{ id: 'c1', label: 'One' }],
      contributions: [{ id: 'k1', kind: 'anchors', statement: 'The group said so.', concepts: ['c1'] }],
      originPrompts: [],
    });

    expect(simNodes.find((n) => n.id === 'k1')?.statement).toBe('The group said so.');
  });
});

describe('linkEndpointId', () => {
  it('reads an id whether or not the simulation has resolved the endpoint to a node', () => {
    expect(linkEndpointId('c-issuer')).toBe('c-issuer');
    expect(linkEndpointId({ id: 'c-issuer', type: 'concept', label: 'Issuer' })).toBe('c-issuer');
  });
});

describe('connectedIds', () => {
  const { links, originLinks } = buildGraph(payload);

  it('returns null when nothing is hovered', () => {
    expect(connectedIds(null, links, originLinks)).toBeNull();
  });

  it('lights a concept and everything reached through a contribution', () => {
    expect(connectedIds('c-verifier', links, originLinks)).toEqual(new Set(['c-verifier', 'k15']));
  });

  it('lights a contribution and every concept it joins', () => {
    expect(connectedIds('k8', links, originLinks)).toEqual(new Set(['k8', 'c-issuer', 'c-registry']));
  });

  it('lights what came out of an origin prompt', () => {
    expect(connectedIds('p1', links, originLinks)).toEqual(new Set(['p1', 'c-issuer', 'k15']));
  });
});

describe('describeGraph', () => {
  it('says an empty graph is empty rather than describing nothing', () => {
    expect(describeGraph({})).toMatch(/empty/i);
  });

  it('reads each contribution as the concepts it joins', () => {
    const description = describeGraph(payload);

    expect(description).toContain('4 concepts joined by 2 contributions');
    expect(description).toContain('Issuer, Verifier, Trust Registry — co-governs');
  });

  it('names concepts nothing has joined yet', () => {
    expect(describeGraph(payload)).toContain('Not yet joined to anything: Key Rotation');
  });
});

describe('computeFitTransform', () => {
  /* A force layout knows nothing about the size of the box it is drawn in, so a graph that
     is not framed simply runs off the edges of the canvas — which is what the first render
     of the fixture did. */
  const canvas = { width: 1000, height: 500 };

  const box = (x: number, y: number, half = 10) => ({ x, y, halfWidth: half, halfHeight: half });

  it('has nothing to frame when nothing is placed', () => {
    expect(computeFitTransform([], canvas.width, canvas.height)).toBeNull();
  });

  it('scales a graph wider than the canvas down until it fits', () => {
    const fit = computeFitTransform([box(0, 250), box(2000, 250)], canvas.width, canvas.height)!;

    expect(fit.k).toBeLessThan(1);
    // The spread, plus each node's own half-width, has to end up inside the canvas.
    expect((2000 + 20) * fit.k).toBeLessThanOrEqual(canvas.width);
  });

  it('centres what it frames', () => {
    const fit = computeFitTransform([box(100, 100), box(300, 300)], canvas.width, canvas.height)!;
    const centreX = fit.x + fit.k * 200;
    const centreY = fit.y + fit.k * 200;

    expect(centreX).toBeCloseTo(canvas.width / 2, 6);
    // The centre sits a little high, since the fit leaves room for labels below each node.
    expect(centreY).toBeLessThanOrEqual(canvas.height / 2);
  });

  it('does not magnify a tiny graph past the zoom limit', () => {
    const fit = computeFitTransform([box(10, 10, 1), box(12, 12, 1)], canvas.width, canvas.height, { maxScale: 6 })!;

    expect(fit.k).toBe(6);
  });

  it('does not shrink a huge graph past the zoom limit', () => {
    const fit = computeFitTransform([box(0, 0), box(100000, 100000)], canvas.width, canvas.height, { minScale: 0.35 })!;

    expect(fit.k).toBe(0.35);
  });

  it('frames a single node without dividing by a zero span', () => {
    const fit = computeFitTransform([box(42, 42)], canvas.width, canvas.height)!;

    expect(Number.isFinite(fit.k)).toBe(true);
    expect(Number.isFinite(fit.x)).toBe(true);
    expect(Number.isFinite(fit.y)).toBe(true);
  });

  it('allows for the label hanging below a node, so the bottom row is not clipped', () => {
    // Tall rather than wide, so it is the height the fit is working against.
    const withoutLabels = computeFitTransform([box(0, 0), box(100, 800)], canvas.width, canvas.height)!;
    const withLabels = computeFitTransform(
      [
        { ...box(0, 0), labelDrop: 18 },
        { ...box(100, 800), labelDrop: 18 },
      ],
      canvas.width,
      canvas.height,
    )!;

    expect(withLabels.k).toBeLessThan(withoutLabels.k);
  });

  it('stops shrinking at the zoom floor, leaving a vast graph to be panned rather than dust', () => {
    const fit = computeFitTransform([box(0, 250), box(40000, 250)], canvas.width, canvas.height, { minScale: 0.35 })!;

    expect(fit.k).toBe(0.35);
    expect(40000 * fit.k).toBeGreaterThan(canvas.width);
  });

  it('accounts for a wide node being wider than it is tall, as an origin pill is', () => {
    const narrow = computeFitTransform([box(0, 250), box(400, 250)], canvas.width, canvas.height)!;
    const wide = computeFitTransform(
      [
        { x: 0, y: 250, halfWidth: 120, halfHeight: 11 },
        { x: 400, y: 250, halfWidth: 120, halfHeight: 11 },
      ],
      canvas.width,
      canvas.height,
    )!;

    expect(wide.k).toBeLessThan(narrow.k);
  });
});
