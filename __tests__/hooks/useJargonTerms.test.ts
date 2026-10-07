import { renderHook, act } from '@testing-library/react';
import { useJargonTerms, summarizeJargonTerms, isStructuredJargonMessage } from '../../hooks/useJargonTerms';
import { PseudonymousMessage } from '../../types.internal';

function jargonMessage(id: string, createdAt: string, body: object): PseudonymousMessage {
  return {
    id,
    createdAt,
    body: { type: 'jargon_clarification', ...body },
    bodyType: 'json',
    fromAgent: true,
    channels: ['direct-user-1-jargon-agent'],
    pseudonym: 'Jargon Filter',
    pause: false,
    visible: true,
    upVotes: [],
    downVotes: [],
  } as unknown as PseudonymousMessage;
}

describe('useJargonTerms', () => {
  it('returns no terms and is inactive when there are no jargon_clarification messages', () => {
    const { result } = renderHook(() => useJargonTerms([]));

    expect(result.current.terms).toEqual([]);
    expect(result.current.batchTerms).toEqual([]);
    expect(result.current.active).toBe(false);
    expect(result.current.seen).toBe(true);
  });

  it('flattens a message using the proposed per-term-object shape into one JargonTerm each', () => {
    const messages = [
      jargonMessage('msg-1', '2024-01-01T00:00:00Z', {
        terms: [
          { term: 'fungible', text: 'Interchangeable.', sourceText: '...fungible...' },
          { term: 'verticals', text: 'Industry sectors.' },
        ],
      }),
    ];

    const { result } = renderHook(() => useJargonTerms(messages));

    expect(result.current.batchTerms).toEqual([
      {
        id: 'msg-1:0',
        term: 'fungible',
        definition: 'Interchangeable.',
        quote: '...fungible...',
        createdAt: '2024-01-01T00:00:00Z',
      },
      {
        id: 'msg-1:1',
        term: 'verticals',
        definition: 'Industry sectors.',
        quote: undefined,
        createdAt: '2024-01-01T00:00:00Z',
      },
    ]);
    expect(result.current.active).toBe(true);
  });

  it("ignores today's actual backend shape (flat term-name array + one shared text block) entirely", () => {
    const messages = [
      jargonMessage('msg-1', '2024-01-01T00:00:00Z', {
        terms: ['SLO', 'MTTR'],
        text: '- **SLO**: An SLO is a reliability target.\n- **MTTR**: Mean time to repair.',
        sourceText: '...we track our SLOs and MTTR closely...',
      }),
    ];

    const { result } = renderHook(() => useJargonTerms(messages));

    // Not combined into a degraded row — simply not recognized by this feature at all, so it
    // never reaches the banner/sheet/glossary. It's left for AssistantChatPanel to render as an
    // ordinary message instead (see isStructuredJargonMessage below and AssistantChatPanel.test.tsx).
    expect(result.current.terms).toEqual([]);
    expect(result.current.batchTerms).toEqual([]);
    expect(result.current.active).toBe(false);
  });

  it('ignores a message with no terms array at all', () => {
    const messages = [
      jargonMessage('msg-1', '2024-01-01T00:00:00Z', {
        text: 'An SLO is a reliability target.',
        sourceText: 'Our SLOs...',
      }),
    ];

    const { result } = renderHook(() => useJargonTerms(messages));

    expect(result.current.terms).toEqual([]);
    expect(result.current.active).toBe(false);
  });

  it('replaces batchTerms with the newest message rather than merging onto the previous one', () => {
    const first = [
      jargonMessage('msg-1', '2024-01-01T00:00:00Z', { terms: [{ term: 'fungible', text: 'Interchangeable.' }] }),
    ];
    const { result, rerender } = renderHook(({ messages }) => useJargonTerms(messages), {
      initialProps: { messages: first },
    });

    expect(result.current.batchTerms.map((t) => t.term)).toEqual(['fungible']);

    const second = [
      ...first,
      jargonMessage('msg-2', '2024-01-02T00:00:00Z', { terms: [{ term: 'verticals', text: 'Industry sectors.' }] }),
    ];
    rerender({ messages: second });

    // Only the newest message's terms — not fungible + verticals together.
    expect(result.current.batchTerms.map((t) => t.term)).toEqual(['verticals']);
    // Full history still has both, for a future glossary.
    expect(result.current.terms.map((t) => t.term)).toEqual(['fungible', 'verticals']);
  });

  it('marks the batch seen without clearing it', () => {
    const messages = [
      jargonMessage('msg-1', '2024-01-01T00:00:00Z', { terms: [{ term: 'fungible', text: 'Interchangeable.' }] }),
    ];
    const { result } = renderHook(() => useJargonTerms(messages));

    expect(result.current.seen).toBe(false);

    act(() => result.current.markSeen());

    expect(result.current.seen).toBe(true);
    expect(result.current.batchTerms.map((t) => t.term)).toEqual(['fungible']);
  });

  it('a newer message un-seens the batch again, even after markSeen', () => {
    const first = [
      jargonMessage('msg-1', '2024-01-01T00:00:00Z', { terms: [{ term: 'fungible', text: 'Interchangeable.' }] }),
    ];
    const { result, rerender } = renderHook(({ messages }) => useJargonTerms(messages), {
      initialProps: { messages: first },
    });

    act(() => result.current.markSeen());
    expect(result.current.seen).toBe(true);

    const second = [
      ...first,
      jargonMessage('msg-2', '2024-01-02T00:00:00Z', { terms: [{ term: 'verticals', text: 'Industry sectors.' }] }),
    ];
    rerender({ messages: second });

    expect(result.current.seen).toBe(false);
  });

  it('dismiss clears the current batch until a newer message arrives', () => {
    const first = [
      jargonMessage('msg-1', '2024-01-01T00:00:00Z', { terms: [{ term: 'fungible', text: 'Interchangeable.' }] }),
    ];
    const { result, rerender } = renderHook(({ messages }) => useJargonTerms(messages), {
      initialProps: { messages: first },
    });

    act(() => result.current.dismiss());

    expect(result.current.active).toBe(false);
    expect(result.current.batchTerms).toEqual([]);

    // Re-rendering with the same messages keeps it dismissed.
    rerender({ messages: first });
    expect(result.current.active).toBe(false);

    // A newer message reactivates it.
    const second = [
      ...first,
      jargonMessage('msg-2', '2024-01-02T00:00:00Z', { terms: [{ term: 'verticals', text: 'Industry sectors.' }] }),
    ];
    rerender({ messages: second });
    expect(result.current.active).toBe(true);
    expect(result.current.batchTerms.map((t) => t.term)).toEqual(['verticals']);
  });

  it('ignores non-jargon messages', () => {
    const messages = [
      {
        id: 'm1',
        createdAt: '2024-01-01T00:00:00Z',
        body: { type: 'assistant', text: 'hello' },
      } as unknown as PseudonymousMessage,
    ];

    const { result } = renderHook(() => useJargonTerms(messages));

    expect(result.current.terms).toEqual([]);
    expect(result.current.active).toBe(false);
  });
});

describe('summarizeJargonTerms', () => {
  it('returns an empty string for no terms', () => {
    expect(summarizeJargonTerms([])).toBe('');
  });

  it('singularizes "term" for exactly one', () => {
    expect(summarizeJargonTerms([{ id: '1', term: 'fungible', definition: '', createdAt: '' }])).toBe(
      '1 new term: fungible',
    );
  });

  it('lists up to three term names and pluralizes', () => {
    const terms = ['a', 'b', 'c'].map((term, i) => ({ id: String(i), term, definition: '', createdAt: '' }));
    expect(summarizeJargonTerms(terms)).toBe('3 new terms: a, b, c');
  });

  it('truncates with an ellipsis past three terms', () => {
    const terms = ['a', 'b', 'c', 'd'].map((term, i) => ({ id: String(i), term, definition: '', createdAt: '' }));
    expect(summarizeJargonTerms(terms)).toBe('4 new terms: a, b, c…');
  });
});

describe('isStructuredJargonMessage', () => {
  it('is true for the per-term-object shape', () => {
    const message = jargonMessage('msg-1', '2024-01-01T00:00:00Z', {
      terms: [{ term: 'fungible', text: 'Interchangeable.' }],
    });
    expect(isStructuredJargonMessage(message)).toBe(true);
  });

  it("is false for today's actual shape (flat term-name array)", () => {
    const message = jargonMessage('msg-1', '2024-01-01T00:00:00Z', {
      terms: ['SLO', 'MTTR'],
      text: '- **SLO**: ...\n- **MTTR**: ...',
    });
    expect(isStructuredJargonMessage(message)).toBe(false);
  });

  it('is false when there is no terms array at all', () => {
    const message = jargonMessage('msg-1', '2024-01-01T00:00:00Z', { text: 'An SLO is a reliability target.' });
    expect(isStructuredJargonMessage(message)).toBe(false);
  });

  it('is false for a non-jargon message', () => {
    const message = { id: 'm1', body: { type: 'assistant', text: 'hello' } } as unknown as PseudonymousMessage;
    expect(isStructuredJargonMessage(message)).toBe(false);
  });
});
