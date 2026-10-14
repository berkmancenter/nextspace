import { ConceptGraphPayload } from '../../types.internal';
import { buildSkyModel, conceptSessions, sessionIndex, sessionLabel } from '../../utils/conceptSky';

const base = (over: Partial<ConceptGraphPayload> = {}): ConceptGraphPayload => ({
  originPrompts: [],
  concepts: [],
  contributions: [],
  ...over,
});

describe('sessionIndex', () => {
  it('numbers sessions by first appearance when the payload lists none', () => {
    const payload = base({
      concepts: [
        { id: 'a', label: 'A', provenance: { conversationId: 'conv-b' } },
        { id: 'b', label: 'B', provenance: { conversationId: 'conv-a' } },
      ],
    });
    expect([...sessionIndex(payload)]).toEqual([
      ['conv-b', 0],
      ['conv-a', 1],
    ]);
  });

  it('counts the conversations a concept lists, not only its own provenance', () => {
    const payload = base({
      concepts: [{ id: 'a', label: 'A', provenance: { conversationId: 'c1' }, conversationIds: ['c1', 'c2'] }],
    });
    expect(sessionIndex(payload).get('c2')).toBe(1);
  });

  it('follows the payload’s own session order over first appearance', () => {
    const payload = base({
      concepts: [{ id: 'a', label: 'A', provenance: { conversationId: 'late' } }],
      contributions: [{ id: 'k', kind: 'x', concepts: ['a'], provenance: { conversationId: 'early' } }],
      sessions: [
        { conversationId: 'late', order: 2 },
        { conversationId: 'early', order: 1 },
      ],
    });
    expect([...sessionIndex(payload)]).toEqual([
      ['early', 0],
      ['late', 1],
    ]);
  });

  it('reports no sessions for a graph from one', () => {
    expect(sessionIndex(base({ sessions: [{ conversationId: 'only', order: 1 }] })).size).toBe(0);
    expect(sessionIndex(base()).size).toBe(0);
  });
});

describe('sessionLabel', () => {
  const sessions = [
    { conversationId: 'a', order: 1, title: 'Kickoff night' },
    { conversationId: 'b', order: 2, date: '2025-10-02T18:00:00Z' },
    { conversationId: 'c', order: 3 },
  ];

  it('prefers the title, then adds the date to Session N, then plain Session N', () => {
    const payload = base({ sessions });
    expect(sessionLabel(payload, 0)).toBe('Kickoff night');
    expect(sessionLabel(payload, 1)).toBe('Session 2 · Oct 2');
    expect(sessionLabel(payload, 2)).toBe('Session 3');
  });

  it('is plain Session N with no session list', () => {
    expect(sessionLabel(base(), 3)).toBe('Session 4');
  });
});

describe('conceptSessions falls back from the backend’s list to inference to nothing', () => {
  const sessions = [
    { conversationId: 's1', order: 1 },
    { conversationId: 's2', order: 2 },
    { conversationId: 's3', order: 3 },
  ];

  it('uses conversationIds when present, ignoring what contributions would imply', () => {
    const payload = base({
      sessions,
      concepts: [{ id: 'a', label: 'A', provenance: { conversationId: 's1' }, conversationIds: ['s1', 's3'] }],
      contributions: [{ id: 'k', kind: 'x', concepts: ['a'], provenance: { conversationId: 's2' } }],
    });
    expect(conceptSessions(buildSkyModel(payload)).get('a')).toEqual([0, 2]);
  });

  it('infers from provenance and touching contributions when the list is absent', () => {
    const payload = base({
      sessions,
      concepts: [{ id: 'a', label: 'A', provenance: { conversationId: 's1' } }],
      contributions: [{ id: 'k', kind: 'x', concepts: ['a'], provenance: { conversationId: 's2' } }],
    });
    expect(conceptSessions(buildSkyModel(payload)).get('a')).toEqual([0, 1]);
  });

  it('infers when the list names only conversations the graph does not know', () => {
    const payload = base({
      sessions,
      concepts: [{ id: 'a', label: 'A', provenance: { conversationId: 's2' }, conversationIds: ['gone'] }],
    });
    expect(conceptSessions(buildSkyModel(payload)).get('a')).toEqual([1]);
  });

  it('gives a concept with no session data none, and a single-session graph none at all', () => {
    const plain = base({
      sessions,
      concepts: [{ id: 'a', label: 'A' }],
    });
    expect(conceptSessions(buildSkyModel(plain)).get('a')).toEqual([]);
    const single = base({ concepts: [{ id: 'a', label: 'A', provenance: { conversationId: 'only' } }] });
    expect(conceptSessions(buildSkyModel(single)).get('a')).toEqual([]);
  });
});
