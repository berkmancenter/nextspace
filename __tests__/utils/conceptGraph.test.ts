import {
  buildGraph,
  computeFitTransform,
  connectedIds,
  describeGraph,
  estimateTextWidth,
  linkEndpointId,
  selectVisibleLabels,
  sessionIndexById,
  wrapLabel,
} from '../../utils/conceptGraph';

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

  it('draws a contribution by its statement, not its kind, when it has one', () => {
    // A leaf's whole content is the statement it carries — the kind is only what it falls
    // back to when there is no one account to draw instead.
    const { simNodes } = buildGraph({
      concepts: [{ id: 'c1', label: 'One' }],
      contributions: [{ id: 'k1', kind: 'anchors', statement: 'The group said so.', concepts: ['c1'] }],
      originPrompts: [],
    });

    expect(simNodes.find((n) => n.id === 'k1')?.label).toBe('The group said so.');
    expect(simNodes.find((n) => n.id === 'k1')?.kind).toBe('anchors');
  });

  it('falls back to a contribution’s kind when it carries no statement', () => {
    const { simNodes } = buildGraph({
      concepts: [{ id: 'c1', label: 'One' }],
      contributions: [{ id: 'k1', kind: 'anchors', concepts: ['c1'] }],
      originPrompts: [],
    });

    expect(simNodes.find((n) => n.id === 'k1')?.label).toBe('anchors');
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

describe('selectVisibleLabels', () => {
  /* A force layout leaves nodes wherever the forces put them, which in a dense graph is close
     enough that labels print over each other. Several words overlapping are worth less than
     one word readable, so a label that will not fit is dropped rather than drawn. */
  const label = (id: string, x: number, y: number, priority = 0, extra: Record<string, unknown> = {}) => ({
    id,
    x,
    y,
    width: 60,
    height: 12,
    priority,
    ...extra,
  });

  it('draws everything when nothing collides', () => {
    const visible = selectVisibleLabels([label('a', 0, 0), label('b', 500, 500)]);

    expect(visible).toEqual(new Set(['a', 'b']));
  });

  it('drops the label that loses a collision rather than printing both', () => {
    const visible = selectVisibleLabels([label('low', 100, 100, 1), label('high', 105, 100, 9)]);

    expect(visible).toEqual(new Set(['high']));
  });

  it('gives the space to the better-connected node, whatever order they arrive in', () => {
    const candidates = [label('weak', 100, 100, 1), label('strong', 104, 102, 12)];

    expect(selectVisibleLabels(candidates)).toEqual(new Set(['strong']));
    expect(selectVisibleLabels([...candidates].reverse())).toEqual(new Set(['strong']));
  });

  it('never drops a required label, which is what the reader is pointing at', () => {
    const visible = selectVisibleLabels([label('hub', 100, 100, 99), label('hovered', 102, 100, 0, { required: true })]);

    expect(visible).toContain('hovered');
  });

  it('keeps labels that only just clear each other', () => {
    // 60 wide, so centres 62 apart do not overlap; 12 tall, so rows 14 apart do not either.
    expect(selectVisibleLabels([label('a', 0, 0), label('b', 66, 0)])).toEqual(new Set(['a', 'b']));
    expect(selectVisibleLabels([label('a', 0, 0), label('b', 0, 18)])).toEqual(new Set(['a', 'b']));
  });

  it('treats a near-miss on one axis as no collision at all', () => {
    // Overlapping horizontally but on different rows is perfectly readable.
    expect(selectVisibleLabels([label('a', 0, 0), label('b', 10, 40)])).toEqual(new Set(['a', 'b']));
  });

  it('has nothing to draw when given nothing', () => {
    expect(selectVisibleLabels([])).toEqual(new Set());
  });
});

describe('estimateTextWidth', () => {
  it('grows with the text and with the type size', () => {
    expect(estimateTextWidth('hello', 10)).toBeLessThan(estimateTextWidth('hello there', 10));
    expect(estimateTextWidth('hello', 10)).toBeLessThan(estimateTextWidth('hello', 20));
  });

  it('measures an empty string as taking no room', () => {
    expect(estimateTextWidth('', 12)).toBe(0);
  });
});

describe('wrapLabel', () => {
  it('leaves a short label on one line', () => {
    expect(wrapLabel('The Assistant', 130, 11.5, 0.55)).toEqual(['The Assistant']);
  });

  it('breaks a long label into more than one line', () => {
    const lines = wrapLabel(
      "It told me something completely wrong with so much confidence that I almost didn't check.",
      130,
      9.5,
      0.62,
    );

    expect(lines.length).toBeGreaterThan(1);
    // Every line still has to fit — wrapping that leaves a line over width defeats the point.
    for (const line of lines) {
      expect(estimateTextWidth(line, 9.5, 0.62)).toBeLessThanOrEqual(130);
    }
  });

  it('rejoins wrapped lines back into the original words, in order', () => {
    const text = 'Every few months it changes enough that I feel like I am learning it all over again.';
    const lines = wrapLabel(text, 100, 9.5, 0.62);

    expect(lines.join(' ')).toBe(text);
  });

  it('never splits a single word wider than the limit, even if the line runs over', () => {
    const lines = wrapLabel('Supercalifragilisticexpialidocious', 20, 11.5, 0.55);

    expect(lines).toEqual(['Supercalifragilisticexpialidocious']);
  });

  it('wraps an empty label to a single empty line, so there is always one to draw', () => {
    expect(wrapLabel('', 130, 11.5, 0.55)).toEqual(['']);
  });

  it('collapses runs of whitespace between words rather than preserving them', () => {
    expect(wrapLabel('one   two', 130, 11.5, 0.55)).toEqual(['one two']);
  });
});

describe('sessionIndexById', () => {
  const node = (id: string, conversationId?: string) => ({
    id,
    label: id,
    ...(conversationId ? { provenance: { conversationId } } : {}),
  });

  it('numbers the sessions of a series by when they first appear', () => {
    const sessions = sessionIndexById({
      concepts: [node('a', 'conv-1'), node('b', 'conv-2'), node('c', 'conv-1'), node('d', 'conv-3')],
      contributions: [],
      originPrompts: [],
    });

    expect(sessions.get('conv-1')).toBe(0);
    expect(sessions.get('conv-2')).toBe(1);
    expect(sessions.get('conv-3')).toBe(2);
  });

  it('has nothing to distinguish on a single event’s graph', () => {
    // One session is not a series: colouring every node identically says the same thing as
    // colouring them by session, and a legend would be noise.
    const sessions = sessionIndexById({
      concepts: [node('a', 'conv-1'), node('b', 'conv-1')],
      contributions: [],
      originPrompts: [],
    });

    expect(sessions.size).toBe(0);
  });

  it('ignores nodes with no provenance at all', () => {
    const sessions = sessionIndexById({
      concepts: [node('a'), node('b', 'conv-1'), node('c', 'conv-2')],
      contributions: [],
      originPrompts: [],
    });

    expect(sessions.size).toBe(2);
    expect(sessions.has('conv-1')).toBe(true);
  });

  it('counts sessions across all three node kinds', () => {
    const sessions = sessionIndexById({
      concepts: [node('a', 'conv-1')],
      contributions: [{ id: 'k1', kind: 'joins', concepts: ['a'], provenance: { conversationId: 'conv-2' } }],
      originPrompts: [{ id: 'p1', text: 'why?', provenance: { conversationId: 'conv-3' } }],
    });

    expect(sessions.size).toBe(3);
  });

  it('has nothing to say about an empty graph', () => {
    expect(sessionIndexById({})).toEqual(new Map());
  });
});
