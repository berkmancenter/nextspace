import { deriveEventState, EDIT_LOCKOUT_MS, isInPreEventWindow, isValidZoomUrl } from '../../utils/eventState';

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

  it('returns past once the conversation has ended (endTime set), not scheduled', () => {
    // Before endTime existed, a confirmed, inactive event derived to `scheduled` even after it was over.
    const now = new Date('2026-08-02T00:00:00Z');
    const endTime = new Date('2026-08-01T17:30:00Z').toISOString();
    expect(deriveEventState({ active: false, draft: false, scheduledTime: scheduledTime.toISOString(), endTime }, now)).toBe(
      'past',
    );
  });

  it('still returns live for an active conversation even if an endTime is present', () => {
    const now = new Date('2026-08-01T16:05:00Z');
    const endTime = new Date('2026-08-01T17:30:00Z').toISOString();
    expect(deriveEventState({ active: true, draft: false, scheduledTime: scheduledTime.toISOString(), endTime }, now)).toBe(
      'live',
    );
  });
});

describe('isInPreEventWindow', () => {
  const scheduledTime = new Date('2026-08-01T16:00:00Z');

  it('returns true inside the window opened by preEventMinutes', () => {
    const now = new Date('2026-08-01T15:50:00Z'); // 10 minutes before
    expect(isInPreEventWindow({ active: false, scheduledTime: scheduledTime.toISOString(), preEventMinutes: 15 }, now)).toBe(
      true,
    );
  });

  it('returns false before the window opens', () => {
    const now = new Date('2026-08-01T15:44:59Z'); // just over 15 minutes before
    expect(isInPreEventWindow({ active: false, scheduledTime: scheduledTime.toISOString(), preEventMinutes: 15 }, now)).toBe(
      false,
    );
  });

  it('returns true at the exact instant the window opens', () => {
    const now = new Date('2026-08-01T15:45:00Z'); // exactly 15 minutes before
    expect(isInPreEventWindow({ active: false, scheduledTime: scheduledTime.toISOString(), preEventMinutes: 15 }, now)).toBe(
      true,
    );
  });

  it('returns false once scheduledTime has arrived, even if still inactive', () => {
    const now = scheduledTime;
    expect(isInPreEventWindow({ active: false, scheduledTime: scheduledTime.toISOString(), preEventMinutes: 15 }, now)).toBe(
      false,
    );
  });

  it('returns false once the conversation is active, even inside the window', () => {
    const now = new Date('2026-08-01T15:50:00Z');
    expect(isInPreEventWindow({ active: true, scheduledTime: scheduledTime.toISOString(), preEventMinutes: 15 }, now)).toBe(
      false,
    );
  });

  it('returns false with no scheduledTime', () => {
    const now = new Date('2026-08-01T15:50:00Z');
    expect(isInPreEventWindow({ active: false, scheduledTime: undefined, preEventMinutes: 15 }, now)).toBe(false);
  });

  it('returns false with no preEventMinutes configured', () => {
    const now = new Date('2026-08-01T15:50:00Z');
    expect(isInPreEventWindow({ active: false, scheduledTime: scheduledTime.toISOString() }, now)).toBe(false);
  });
});

describe('isValidZoomUrl', () => {
  it('accepts a zoom.us URL and its vanity subdomains', () => {
    expect(isValidZoomUrl('https://zoom.us/j/123456789')).toBe(true);
    expect(isValidZoomUrl('https://harvard.zoom.us/j/81244556677')).toBe(true);
  });

  it('rejects a well-formed URL on a non-Zoom host', () => {
    expect(isValidZoomUrl('https://example.com')).toBe(false);
  });

  it('rejects a host that only ends in the literal "zoom.us" without a dot boundary', () => {
    expect(isValidZoomUrl('https://notzoom.us/j/1')).toBe(false);
  });

  it('rejects an unparseable string, an empty string, and non-strings', () => {
    expect(isValidZoomUrl('zoom.us/j/123')).toBe(false); // no scheme, new URL throws
    expect(isValidZoomUrl('')).toBe(false);
    expect(isValidZoomUrl(undefined)).toBe(false);
    expect(isValidZoomUrl(null)).toBe(false);
  });
});
