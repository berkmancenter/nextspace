import { getRoomLastReadAt, markRoomRead } from '../../utils/roomReadState';

describe('roomReadState', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  describe('markRoomRead', () => {
    it('stores the given timestamp for that room', () => {
      markRoomRead('room-1', '2026-08-28T09:41:00.000Z');

      expect(getRoomLastReadAt('room-1')).toBe('2026-08-28T09:41:00.000Z');
    });

    it('keeps each room separate', () => {
      markRoomRead('room-1', '2026-08-28T09:41:00.000Z');
      markRoomRead('room-2', '2026-08-27T09:41:00.000Z');

      expect(getRoomLastReadAt('room-1')).toBe('2026-08-28T09:41:00.000Z');
      expect(getRoomLastReadAt('room-2')).toBe('2026-08-27T09:41:00.000Z');
    });

    it('never moves a room backwards in time', () => {
      markRoomRead('room-1', '2026-08-28T09:41:00.000Z');
      markRoomRead('room-1', '2026-08-01T09:41:00.000Z');

      expect(getRoomLastReadAt('room-1')).toBe('2026-08-28T09:41:00.000Z');
    });
  });

  describe('getRoomLastReadAt', () => {
    it('returns null for a room that has never been opened', () => {
      expect(getRoomLastReadAt('never-opened')).toBeNull();
    });

    it('returns null instead of throwing when storage is unavailable', () => {
      const getItem = jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('storage disabled');
      });

      expect(getRoomLastReadAt('room-1')).toBeNull();

      getItem.mockRestore();
    });

    it('does not throw when a write is refused', () => {
      const setItem = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('quota exceeded');
      });

      expect(() => markRoomRead('room-1', '2026-08-28T09:41:00.000Z')).not.toThrow();

      setItem.mockRestore();
    });
  });
});
