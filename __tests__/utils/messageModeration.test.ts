import { applyModerationEvent, insertMessageInOrder } from '../../utils/messageModeration';
import { MessageHiddenEvent, PseudonymousMessage } from '../../types.internal';

const msg = (id: string, overrides: Record<string, unknown> = {}): PseudonymousMessage =>
  ({
    id,
    body: { text: `body ${id}` },
    owner: `owner-${id}`,
    createdAt: new Date(2024, 0, 1, 12, Number(id.replace(/\D/g, '') || 0)).toISOString(),
    channels: ['chat'],
    ...overrides,
  }) as PseudonymousMessage;

const event = (messageIds: string[], hidden: boolean, display: 'omit' | 'placeholder' = 'omit'): MessageHiddenEvent => ({
  messageIds,
  hidden,
  display,
});

describe('applyModerationEvent', () => {
  const list = [msg('m1'), msg('m2'), msg('m3', { parentMessage: 'm1' })];

  describe('admin', () => {
    it.each(['omit', 'placeholder'] as const)('flags listed messages and replies hidden (%s)', (display) => {
      const result = applyModerationEvent(list, event(['m1', 'm3'], true, display), { isAdmin: true });
      expect(result.map((m) => m.hidden)).toEqual([true, undefined, true]);
      expect(result[0].body).toEqual({ text: 'body m1' });
    });

    it('clears the flag on unhide', () => {
      const hidden = [msg('m1', { hidden: true }), msg('m2')];
      const result = applyModerationEvent(hidden, event(['m1'], false), { isAdmin: true });
      expect(result[0]).not.toHaveProperty('hidden');
    });

    it('returns the same array when nothing changes', () => {
      expect(applyModerationEvent(list, event(['m2'], false), { isAdmin: true })).toBe(list);
      expect(applyModerationEvent(list, event(['unknown'], true), { isAdmin: true })).toBe(list);
    });

    it('does not mutate its input', () => {
      applyModerationEvent(list, event(['m1'], true), { isAdmin: true });
      expect(list[0].hidden).toBeUndefined();
    });
  });

  describe('non-admin', () => {
    const viewer = { isAdmin: false, selfId: 'me' };

    it('drops hidden messages and replies on omit', () => {
      const result = applyModerationEvent(list, event(['m1', 'm3'], true, 'omit'), viewer);
      expect(result.map((m) => m.id)).toEqual(['m2']);
    });

    it('swaps hidden messages for body-less stubs on placeholder', () => {
      const result = applyModerationEvent(list, event(['m3'], true, 'placeholder'), viewer);
      expect(result).toHaveLength(3);
      expect(result[2]).toEqual({
        id: 'm3',
        createdAt: list[2].createdAt,
        parentMessage: 'm1',
        hidden: true,
        body: null,
      });
      expect(result[0]).toBe(list[0]);
    });

    it.each(['omit', 'placeholder'] as const)('leaves the list alone on unhide (%s)', (display) => {
      expect(applyModerationEvent(list, event(['m1'], false, display), viewer)).toBe(list);
    });

    it('returns the same array when no listed id is present', () => {
      expect(applyModerationEvent(list, event(['zzz'], true), viewer)).toBe(list);
    });
  });

  describe('messages without an owner', () => {
    const ownerless = [msg('m1', { owner: undefined }), msg('m2', { owner: undefined })];

    it.each(['omit', 'placeholder'] as const)('does not crash for a non-admin and hides them (%s)', (display) => {
      const result = applyModerationEvent(ownerless, event(['m1'], true, display), { isAdmin: false, selfId: 'me' });
      expect(result).toHaveLength(display === 'omit' ? 1 : 2);
    });

    it('does not crash with no selfId at all', () => {
      expect(() => applyModerationEvent(ownerless, event(['m1'], true), { isAdmin: false })).not.toThrow();
      expect(applyModerationEvent(ownerless, event(['m1'], true), { isAdmin: false, selfId: null })).toHaveLength(1);
    });
  });

  describe('author', () => {
    const viewer = { isAdmin: false, selfId: 'owner-m1' };

    it.each(['omit', 'placeholder'] as const)('never loses their own messages (%s)', (display) => {
      const result = applyModerationEvent(list, event(['m1'], true, display), viewer);
      expect(result).toBe(list);
    });

    it("still loses other people's messages in the same event", () => {
      const result = applyModerationEvent(list, event(['m1', 'm2'], true, 'omit'), viewer);
      expect(result.map((m) => m.id)).toEqual(['m1', 'm3']);
    });
  });
});

describe('insertMessageInOrder', () => {
  it('appends a newer message', () => {
    const result = insertMessageInOrder([msg('m1'), msg('m2')], msg('m3'));
    expect(result.map((m) => m.id)).toEqual(['m1', 'm2', 'm3']);
  });

  it('slots an older message in by createdAt', () => {
    const result = insertMessageInOrder([msg('m1'), msg('m3')], msg('m2'));
    expect(result.map((m) => m.id)).toEqual(['m1', 'm2', 'm3']);
  });

  it('puts an older message first when it predates everything', () => {
    const result = insertMessageInOrder([msg('m2'), msg('m3')], msg('m1'));
    expect(result.map((m) => m.id)).toEqual(['m1', 'm2', 'm3']);
  });

  it('replaces a message already present instead of repeating it', () => {
    const stub = { id: 'm2', hidden: true, body: null, createdAt: msg('m2').createdAt } as PseudonymousMessage;
    const result = insertMessageInOrder([msg('m1'), stub, msg('m3')], msg('m2'));
    expect(result.map((m) => m.id)).toEqual(['m1', 'm2', 'm3']);
    expect(result[1].body).toEqual({ text: 'body m2' });
  });

  it('never replaces a full message with a later stub, flagged or not', () => {
    const stub = { id: 'm2', hidden: true, body: null, createdAt: msg('m2').createdAt } as PseudonymousMessage;
    const full = [msg('m1'), msg('m2')];
    expect(insertMessageInOrder(full, stub)).toBe(full);
    const flagged = [msg('m1'), msg('m2', { hidden: true })];
    expect(insertMessageInOrder(flagged, stub)).toBe(flagged);
  });

  it('lets a full message clear the hidden flag an admin held', () => {
    const result = insertMessageInOrder([msg('m1', { hidden: true })], msg('m1'));
    expect(result[0].hidden).toBeUndefined();
  });

  it('appends a message with no timestamp', () => {
    const result = insertMessageInOrder([msg('m1')], msg('m2', { createdAt: undefined }));
    expect(result.map((m) => m.id)).toEqual(['m1', 'm2']);
  });
});
