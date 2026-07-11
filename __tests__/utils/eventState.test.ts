import { deriveEventState, EDIT_LOCKOUT_MS } from '../../utils/eventState';

describe('deriveEventState', () => {
  const scheduledTime = new Date('2026-08-01T16:00:00Z');

  it('returns live when the conversation is active, regardless of draft status', () => {
    const now = new Date('2026-08-01T16:05:00Z');
    expect(deriveEventState({ active: true, draft: true, scheduledTime: scheduledTime.toISOString() }, now)).toBe('live');
  });

  it('returns scheduled when confirmed (not draft) and not active', () => {
    const now = new Date('2026-08-01T15:00:00Z');
    expect(deriveEventState({ active: false, draft: false, scheduledTime: scheduledTime.toISOString() }, now)).toBe(
      'scheduled',
    );
  });

  it('returns pending when draft and more than 6 minutes before scheduledTime', () => {
    const now = new Date(scheduledTime.getTime() - EDIT_LOCKOUT_MS - 1000);
    expect(deriveEventState({ active: false, draft: true, scheduledTime: scheduledTime.toISOString() }, now)).toBe(
      'pending',
    );
  });

  it('returns missed at the exact instant the edit lockout begins (6 minutes before scheduledTime)', () => {
    const now = new Date(scheduledTime.getTime() - EDIT_LOCKOUT_MS);
    expect(deriveEventState({ active: false, draft: true, scheduledTime: scheduledTime.toISOString() }, now)).toBe('missed');
  });

  it('returns missed once scheduledTime has passed while still draft', () => {
    const now = new Date(scheduledTime.getTime() + 1000);
    expect(deriveEventState({ active: false, draft: true, scheduledTime: scheduledTime.toISOString() }, now)).toBe('missed');
  });

  it('returns missed for a conversation days past its scheduledTime while still draft', () => {
    const now = new Date(scheduledTime.getTime() + 3 * 24 * 60 * 60 * 1000);
    expect(deriveEventState({ active: false, draft: true, scheduledTime: scheduledTime.toISOString() }, now)).toBe('missed');
  });

  it('falls back to pending for a draft conversation with no scheduledTime', () => {
    const now = new Date('2026-08-01T15:00:00Z');
    expect(deriveEventState({ active: false, draft: true, scheduledTime: undefined }, now)).toBe('pending');
  });
});
