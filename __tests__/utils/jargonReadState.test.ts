import { getJargonLastSeenAt, markJargonSeen } from '../../utils/jargonReadState';

describe('jargonReadState', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  describe('markJargonSeen', () => {
    it('stores the given timestamp for that event', () => {
      markJargonSeen('conv-1', '2026-10-13T09:41:00.000Z');

      expect(getJargonLastSeenAt('conv-1')).toBe('2026-10-13T09:41:00.000Z');
    });

    it('keeps each event separate', () => {
      markJargonSeen('conv-1', '2026-10-13T09:41:00.000Z');
      markJargonSeen('conv-2', '2026-10-12T09:41:00.000Z');

      expect(getJargonLastSeenAt('conv-1')).toBe('2026-10-13T09:41:00.000Z');
      expect(getJargonLastSeenAt('conv-2')).toBe('2026-10-12T09:41:00.000Z');
    });

    it('never moves an event backwards in time', () => {
      markJargonSeen('conv-1', '2026-10-13T09:41:00.000Z');
      markJargonSeen('conv-1', '2026-10-01T09:41:00.000Z');

      expect(getJargonLastSeenAt('conv-1')).toBe('2026-10-13T09:41:00.000Z');
    });

    it('does not throw when a write is refused', () => {
      const setItem = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('quota exceeded');
      });

      expect(() => markJargonSeen('conv-1', '2026-10-13T09:41:00.000Z')).not.toThrow();

      setItem.mockRestore();
    });
  });

  describe('getJargonLastSeenAt', () => {
    it('returns null for an event with nothing cleared yet', () => {
      expect(getJargonLastSeenAt('never-cleared')).toBeNull();
    });

    it('returns null instead of throwing when storage is unavailable', () => {
      const getItem = jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('storage disabled');
      });

      expect(getJargonLastSeenAt('conv-1')).toBeNull();

      getItem.mockRestore();
    });
  });
});
