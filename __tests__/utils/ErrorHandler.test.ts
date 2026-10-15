import { NextRouter } from 'next/router';
import { QueryParamsError } from '../../utils/ErrorHandler';
import { GetChannelPasscode } from '../../utils/Helpers';

jest.mock('../../utils/Helpers', () => ({
  GetChannelPasscode: jest.fn(),
}));

const mockGetChannelPasscode = GetChannelPasscode as jest.MockedFunction<typeof GetChannelPasscode>;

const createMockRouter = (query: Record<string, string | string[]>): NextRouter => ({ query }) as unknown as NextRouter;

const INCOMPLETE_LINK_MESSAGE = 'This link is incomplete. Ask the event organizer for the full link.';

describe('QueryParamsError', () => {
  let warnSpy: jest.SpyInstance;

  const expectMissing = (param: string) =>
    expect(warnSpy).toHaveBeenCalledWith(expect.any(String), expect.arrayContaining([param]));

  beforeEach(() => {
    mockGetChannelPasscode.mockReturnValue('passcode');
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.clearAllMocks();
    warnSpy.mockRestore();
  });

  describe('incomplete link message', () => {
    it('shows a plain message without a list of parameter names', () => {
      const router = createMockRouter({});

      const result = QueryParamsError(router, 'assistant');

      expect(result).toEqual({ header: INCOMPLETE_LINK_MESSAGE, params: [] });
    });

    it('shows the same message on the moderator page', () => {
      const router = createMockRouter({});

      const result = QueryParamsError(router, 'moderator');

      expect(result).toEqual({ header: INCOMPLETE_LINK_MESSAGE, params: [] });
    });

    it('does not log anything when the link is complete', () => {
      const router = createMockRouter({
        conversationId: 'a1b2c3d4e5f6a1b2c3d4e5f6',
        channel: ['chat-main', 'transcript-main'],
      });

      QueryParamsError(router, 'assistant');

      expect(warnSpy).not.toHaveBeenCalled();
    });
  });

  describe('common validation', () => {
    it('should return null when all params are valid for moderator page', () => {
      const router = createMockRouter({
        conversationId: 'a1b2c3d4e5f6a1b2c3d4e5f6',
        channel: ['moderator-main', 'transcript-main'],
      });

      const result = QueryParamsError(router, 'moderator');
      expect(result).toBeNull();
    });

    it('should return null when all params are valid for assistant page', () => {
      const router = createMockRouter({
        conversationId: 'a1b2c3d4e5f6a1b2c3d4e5f6',
        channel: ['chat-main', 'transcript-main'],
      });

      const result = QueryParamsError(router, 'assistant');
      expect(result).toBeNull();
    });

    it('logs the problem when conversationId is missing', () => {
      const router = createMockRouter({
        channel: ['moderator-main', 'transcript-main'],
      });

      QueryParamsError(router, 'moderator');
      expectMissing('conversation ID');
    });

    it('logs the problem when conversationId is invalid format', () => {
      const router = createMockRouter({
        conversationId: 'invalid-id',
        channel: ['moderator-main', 'transcript-main'],
      });

      QueryParamsError(router, 'moderator');
      expectMissing('invalid conversation ID');
    });

    it('logs the problem when channel is missing', () => {
      const router = createMockRouter({
        conversationId: 'a1b2c3d4e5f6a1b2c3d4e5f6',
      });

      QueryParamsError(router, 'moderator');
      expectMissing('channel');
    });
  });

  describe('moderator page', () => {
    it('logs the problem when moderator channel is missing (string channel)', () => {
      const router = createMockRouter({
        conversationId: 'a1b2c3d4e5f6a1b2c3d4e5f6',
        channel: 'transcript-main',
      });

      QueryParamsError(router, 'moderator');
      expectMissing('moderator channel');
    });

    it('logs the problem when moderator channel is missing (array channel)', () => {
      const router = createMockRouter({
        conversationId: 'a1b2c3d4e5f6a1b2c3d4e5f6',
        channel: ['transcript-main'],
      });

      QueryParamsError(router, 'moderator');
      expectMissing('moderator channel');
    });

    it('logs the problem when moderator passcode is missing', () => {
      mockGetChannelPasscode.mockImplementation((type) => (type === 'moderator' ? null : 'passcode'));

      const router = createMockRouter({
        conversationId: 'a1b2c3d4e5f6a1b2c3d4e5f6',
        channel: ['moderator-main', 'transcript-main'],
      });

      QueryParamsError(router, 'moderator');
      expectMissing('moderator passcode');
    });

    it('logs the problem when transcript passcode is missing', () => {
      mockGetChannelPasscode.mockImplementation((type) => (type === 'transcript' ? null : 'passcode'));

      const router = createMockRouter({
        conversationId: 'a1b2c3d4e5f6a1b2c3d4e5f6',
        channel: ['moderator-main', 'transcript-main'],
      });

      QueryParamsError(router, 'moderator');
      expectMissing('transcript passcode');
    });
  });

  describe('assistant page', () => {
    it('logs the problem when chat channel is missing (string channel)', () => {
      const router = createMockRouter({
        conversationId: 'a1b2c3d4e5f6a1b2c3d4e5f6',
        channel: 'transcript-main',
      });

      QueryParamsError(router, 'assistant');
      expectMissing('chat channel');
    });

    it('logs the problem when chat channel is missing (array channel)', () => {
      const router = createMockRouter({
        conversationId: 'a1b2c3d4e5f6a1b2c3d4e5f6',
        channel: ['transcript-main'],
      });

      QueryParamsError(router, 'assistant');
      expectMissing('chat channel');
    });

    it('logs the problem when chat passcode is missing', () => {
      mockGetChannelPasscode.mockImplementation((type) => (type === 'chat' ? null : 'passcode'));

      const router = createMockRouter({
        conversationId: 'a1b2c3d4e5f6a1b2c3d4e5f6',
        channel: ['chat-main', 'transcript-main'],
      });

      QueryParamsError(router, 'assistant');
      expectMissing('chat passcode');
    });
  });

  describe('multiple errors', () => {
    it('logs every missing param at once', () => {
      mockGetChannelPasscode.mockReturnValue(null);
      const router = createMockRouter({});

      QueryParamsError(router, 'moderator');
      expect(warnSpy.mock.calls[0][1].length).toBeGreaterThan(1);
    });
  });
});
