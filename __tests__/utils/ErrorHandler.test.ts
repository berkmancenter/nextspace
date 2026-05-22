import { NextRouter } from 'next/router';
import { QueryParamsError } from '../../utils/ErrorHandler';
import { GetChannelPasscode } from '../../utils/Helpers';

jest.mock('../../utils/Helpers', () => ({
  GetChannelPasscode: jest.fn(),
}));

const mockGetChannelPasscode = GetChannelPasscode as jest.MockedFunction<typeof GetChannelPasscode>;

const createMockRouter = (query: Record<string, string | string[]>): NextRouter => ({ query }) as unknown as NextRouter;

describe('QueryParamsError', () => {
  beforeEach(() => {
    mockGetChannelPasscode.mockReturnValue('passcode');
  });

  afterEach(() => {
    jest.clearAllMocks();
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

    it('should return error when conversationId is missing', () => {
      const router = createMockRouter({
        channel: ['moderator-main', 'transcript-main'],
      });

      const result = QueryParamsError(router, 'moderator');
      expect(result).not.toBeNull();
      expect(result?.params).toContain('conversation ID');
    });

    it('should return error when conversationId is invalid format', () => {
      const router = createMockRouter({
        conversationId: 'invalid-id',
        channel: ['moderator-main', 'transcript-main'],
      });

      const result = QueryParamsError(router, 'moderator');
      expect(result).not.toBeNull();
      expect(result?.params).toContain('invalid conversation ID');
    });

    it('should return error when channel is missing', () => {
      const router = createMockRouter({
        conversationId: 'a1b2c3d4e5f6a1b2c3d4e5f6',
      });

      const result = QueryParamsError(router, 'moderator');
      expect(result).not.toBeNull();
      expect(result?.params).toContain('channel');
    });

    it('should use singular header when only one param is missing', () => {
      mockGetChannelPasscode.mockReturnValue(null);
      const router = createMockRouter({
        conversationId: 'a1b2c3d4e5f6a1b2c3d4e5f6',
        channel: ['moderator-main', 'transcript-main'],
      });

      const result = QueryParamsError(router, 'moderator');
      expect(result?.header).toBe('Missing required parameters');
    });
  });

  describe('moderator page', () => {
    it('should return error when moderator channel is missing (string channel)', () => {
      const router = createMockRouter({
        conversationId: 'a1b2c3d4e5f6a1b2c3d4e5f6',
        channel: 'transcript-main',
      });

      const result = QueryParamsError(router, 'moderator');
      expect(result?.params).toContain('moderator channel');
    });

    it('should return error when moderator channel is missing (array channel)', () => {
      const router = createMockRouter({
        conversationId: 'a1b2c3d4e5f6a1b2c3d4e5f6',
        channel: ['transcript-main'],
      });

      const result = QueryParamsError(router, 'moderator');
      expect(result?.params).toContain('moderator channel');
    });

    it('should return error when moderator passcode is missing', () => {
      mockGetChannelPasscode.mockImplementation((type) => (type === 'moderator' ? null : 'passcode'));

      const router = createMockRouter({
        conversationId: 'a1b2c3d4e5f6a1b2c3d4e5f6',
        channel: ['moderator-main', 'transcript-main'],
      });

      const result = QueryParamsError(router, 'moderator');
      expect(result?.params).toContain('moderator passcode');
    });

    it('should return error when transcript channel is missing (string)', () => {
      const router = createMockRouter({
        conversationId: 'a1b2c3d4e5f6a1b2c3d4e5f6',
        channel: 'moderator-main',
      });

      const result = QueryParamsError(router, 'moderator');
      expect(result?.params).toContain('transcript channel');
    });

    it('should return error when transcript channel is missing (array)', () => {
      const router = createMockRouter({
        conversationId: 'a1b2c3d4e5f6a1b2c3d4e5f6',
        channel: ['moderator-main'],
      });

      const result = QueryParamsError(router, 'moderator');
      expect(result?.params).toContain('transcript channel');
    });

    it('should return error when transcript passcode is missing', () => {
      mockGetChannelPasscode.mockImplementation((type) => (type === 'transcript' ? null : 'passcode'));

      const router = createMockRouter({
        conversationId: 'a1b2c3d4e5f6a1b2c3d4e5f6',
        channel: ['moderator-main', 'transcript-main'],
      });

      const result = QueryParamsError(router, 'moderator');
      expect(result?.params).toContain('transcript passcode');
    });
  });

  describe('assistant page', () => {
    it('should return error when chat channel is missing (string channel)', () => {
      const router = createMockRouter({
        conversationId: 'a1b2c3d4e5f6a1b2c3d4e5f6',
        channel: 'transcript-main',
      });

      const result = QueryParamsError(router, 'assistant');
      expect(result?.params).toContain('chat channel');
    });

    it('should return error when chat channel is missing (array channel)', () => {
      const router = createMockRouter({
        conversationId: 'a1b2c3d4e5f6a1b2c3d4e5f6',
        channel: ['transcript-main'],
      });

      const result = QueryParamsError(router, 'assistant');
      expect(result?.params).toContain('chat channel');
    });

    it('should return error when chat passcode is missing', () => {
      mockGetChannelPasscode.mockImplementation((type) => (type === 'chat' ? null : 'passcode'));

      const router = createMockRouter({
        conversationId: 'a1b2c3d4e5f6a1b2c3d4e5f6',
        channel: ['chat-main', 'transcript-main'],
      });

      const result = QueryParamsError(router, 'assistant');
      expect(result?.params).toContain('chat passcode');
    });

    it('should return error when transcript channel is missing for assistant', () => {
      const router = createMockRouter({
        conversationId: 'a1b2c3d4e5f6a1b2c3d4e5f6',
        channel: ['chat-main'],
      });

      const result = QueryParamsError(router, 'assistant');
      expect(result?.params).toContain('transcript channel');
    });

    it('should return error when transcript passcode is missing for assistant', () => {
      mockGetChannelPasscode.mockImplementation((type) => (type === 'transcript' ? null : 'passcode'));

      const router = createMockRouter({
        conversationId: 'a1b2c3d4e5f6a1b2c3d4e5f6',
        channel: ['chat-main', 'transcript-main'],
      });

      const result = QueryParamsError(router, 'assistant');
      expect(result?.params).toContain('transcript passcode');
    });
  });

  describe('multiple errors', () => {
    it('should return multiple missing params at once', () => {
      mockGetChannelPasscode.mockReturnValue(null);
      const router = createMockRouter({});

      const result = QueryParamsError(router, 'moderator');
      expect(result?.params.length).toBeGreaterThan(1);
      expect(result?.header).toBe('Missing required parameters');
    });
  });
});
