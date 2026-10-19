import { savePresentationChannels, withStoredChannels } from '../../utils/presentationChannels';

const CONVERSATION_ID = 'a1b2c3d4e5f6a1b2c3d4e5f6';
const OTHER_CONVERSATION_ID = 'f6e5d4c3b2a1f6e5d4c3b2a1';

describe('presentationChannels', () => {
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    window.sessionStorage.clear();
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('savePresentationChannels', () => {
    it('stores the channels so a stripped query can get them back', () => {
      const saved = savePresentationChannels(CONVERSATION_ID, ['transcript,abc', 'chat,def']);

      expect(saved).toBe(true);
      expect(withStoredChannels({ conversationId: CONVERSATION_ID })).toEqual({
        conversationId: CONVERSATION_ID,
        channel: ['transcript,abc', 'chat,def'],
      });
    });

    it('stores a single channel as a list', () => {
      savePresentationChannels(CONVERSATION_ID, 'chat,def');

      expect(withStoredChannels({ conversationId: CONVERSATION_ID }).channel).toEqual(['chat,def']);
    });

    it('replaces channels saved earlier for the same conversation', () => {
      savePresentationChannels(CONVERSATION_ID, ['chat,old']);
      savePresentationChannels(CONVERSATION_ID, ['chat,new']);

      expect(withStoredChannels({ conversationId: CONVERSATION_ID }).channel).toEqual(['chat,new']);
    });

    it('reports failure and logs a warning when storage is unavailable', () => {
      jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('SecurityError');
      });

      const saved = savePresentationChannels(CONVERSATION_ID, ['chat,def']);

      expect(saved).toBe(false);
      expect(warnSpy).toHaveBeenCalled();
    });
  });

  describe('withStoredChannels', () => {
    it('returns the query unchanged when it already has channels, even if others are stored', () => {
      savePresentationChannels(CONVERSATION_ID, ['chat,stored']);
      const query = { conversationId: CONVERSATION_ID, channel: ['chat,from-url'] };

      expect(withStoredChannels(query)).toBe(query);
    });

    it('returns the query unchanged when nothing is stored', () => {
      const query = { conversationId: CONVERSATION_ID };

      expect(withStoredChannels(query)).toBe(query);
    });

    it("does not apply another conversation's channels", () => {
      savePresentationChannels(OTHER_CONVERSATION_ID, ['chat,other-event']);
      const query = { conversationId: CONVERSATION_ID };

      expect(withStoredChannels(query)).toBe(query);
    });

    it('returns the query unchanged and logs a warning when storage is unavailable', () => {
      jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('SecurityError');
      });
      const query = { conversationId: CONVERSATION_ID };

      expect(withStoredChannels(query)).toBe(query);
      expect(warnSpy).toHaveBeenCalled();
    });
  });
});
