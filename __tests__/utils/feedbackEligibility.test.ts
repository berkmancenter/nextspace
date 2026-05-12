import { PseudonymousMessage } from '../../types.internal';
import { getFeedbackEligibleMessages } from '../../utils/feedbackEligibility';

describe('getFeedbackEligibleMessages', () => {
  // Helper to create a mock message
  const createMessage = (id: string, fromAgent: boolean, bodyType?: string): PseudonymousMessage => ({
    id,
    fromAgent,
    body: bodyType ? { type: bodyType, text: 'Test message' } : 'Test message',
    createdAt: new Date().toISOString(),
    conversation: 'test-conv-1',
    pause: false,
    visible: true,
    pseudonym: 'Test Assistant',
    pseudonymId: 'test-assistant-1',
    upVotes: [],
    downVotes: [],
  });

  describe('basic filtering', () => {
    it('returns empty set when no messages provided', () => {
      const result = getFeedbackEligibleMessages([], 1);
      expect(result.size).toBe(0);
    });

    it('only considers messages from agents', () => {
      const messages = [
        createMessage('1', true),
        createMessage('2', false), // user message
        createMessage('3', true),
      ];

      const result = getFeedbackEligibleMessages(messages, 1);

      expect(result.has('1')).toBe(true);
      expect(result.has('2')).toBe(false);
      expect(result.has('3')).toBe(true);
      expect(result.size).toBe(2);
    });

    it('skips messages without IDs', () => {
      const messages = [{ ...createMessage('1', true), id: undefined }, createMessage('2', true)];

      const result = getFeedbackEligibleMessages(messages, 1);

      expect(result.has('2')).toBe(true);
      expect(result.size).toBe(1);
    });
  });

  describe('message type exclusion', () => {
    it('excludes intro messages', () => {
      const messages = [createMessage('1', true), createMessage('2', true, 'intro'), createMessage('3', true)];

      const result = getFeedbackEligibleMessages(messages, 1);

      expect(result.has('1')).toBe(true);
      expect(result.has('2')).toBe(false);
      expect(result.has('3')).toBe(true);
      expect(result.size).toBe(2);
    });

    it('excludes moderator_offered messages', () => {
      const messages = [createMessage('1', true), createMessage('2', true, 'moderator_offered'), createMessage('3', true)];

      const result = getFeedbackEligibleMessages(messages, 1);

      expect(result.has('1')).toBe(true);
      expect(result.has('2')).toBe(false);
      expect(result.has('3')).toBe(true);
      expect(result.size).toBe(2);
    });

    it('excludes moderator_submitted messages', () => {
      const messages = [createMessage('1', true), createMessage('2', true, 'moderator_submitted'), createMessage('3', true)];

      const result = getFeedbackEligibleMessages(messages, 1);

      expect(result.has('1')).toBe(true);
      expect(result.has('2')).toBe(false);
      expect(result.has('3')).toBe(true);
      expect(result.size).toBe(2);
    });

    it('excludes moderator_declined messages', () => {
      const messages = [createMessage('1', true), createMessage('2', true, 'moderator_declined'), createMessage('3', true)];

      const result = getFeedbackEligibleMessages(messages, 1);

      expect(result.has('1')).toBe(true);
      expect(result.has('2')).toBe(false);
      expect(result.has('3')).toBe(true);
      expect(result.size).toBe(2);
    });

    it('excludes all ineligible types in the same list', () => {
      const messages = [
        createMessage('1', true),
        createMessage('2', true, 'intro'),
        createMessage('4', true),
        createMessage('5', true, 'moderator_offered'),
        createMessage('6', true, 'moderator_submitted'),
        createMessage('7', true),
        createMessage('8', true, 'moderator_declined'),
      ];

      const result = getFeedbackEligibleMessages(messages, 1);

      // Only messages 1, 4, and 7 should be eligible
      expect(result.has('1')).toBe(true);
      expect(result.has('2')).toBe(false);
      expect(result.has('4')).toBe(true);
      expect(result.has('5')).toBe(false);
      expect(result.has('6')).toBe(false);
      expect(result.has('7')).toBe(true);
      expect(result.has('8')).toBe(false);
      expect(result.size).toBe(3);
    });
  });

  describe('feedback frequency', () => {
    it('shows feedback on all eligible messages when frequency is 1', () => {
      const messages = [
        createMessage('1', true),
        createMessage('2', true),
        createMessage('3', true),
        createMessage('4', true),
      ];

      const result = getFeedbackEligibleMessages(messages, 1);

      expect(result.size).toBe(4);
      expect(result.has('1')).toBe(true);
      expect(result.has('2')).toBe(true);
      expect(result.has('3')).toBe(true);
      expect(result.has('4')).toBe(true);
    });

    it('shows feedback on every 2nd eligible message when frequency is 2', () => {
      const messages = [
        createMessage('1', true),
        createMessage('2', true),
        createMessage('3', true),
        createMessage('4', true),
      ];

      const result = getFeedbackEligibleMessages(messages, 2);

      expect(result.size).toBe(2);
      expect(result.has('1')).toBe(false);
      expect(result.has('2')).toBe(true);
      expect(result.has('3')).toBe(false);
      expect(result.has('4')).toBe(true);
    });

    it('shows feedback on every 3rd eligible message when frequency is 3', () => {
      const messages = [
        createMessage('1', true),
        createMessage('2', true),
        createMessage('3', true),
        createMessage('4', true),
        createMessage('5', true),
        createMessage('6', true),
      ];

      const result = getFeedbackEligibleMessages(messages, 3);

      expect(result.size).toBe(2);
      expect(result.has('1')).toBe(false);
      expect(result.has('2')).toBe(false);
      expect(result.has('3')).toBe(true);
      expect(result.has('4')).toBe(false);
      expect(result.has('5')).toBe(false);
      expect(result.has('6')).toBe(true);
    });

    it('returns empty set when frequency is 0', () => {
      const messages = [createMessage('1', true), createMessage('2', true), createMessage('3', true)];

      const result = getFeedbackEligibleMessages(messages, 0);

      expect(result.size).toBe(0);
    });

    it('returns empty set when frequency is negative', () => {
      const messages = [createMessage('1', true), createMessage('2', true), createMessage('3', true)];

      const result = getFeedbackEligibleMessages(messages, -1);

      expect(result.size).toBe(0);
    });

    it('defaults to frequency of 1 when not provided', () => {
      const messages = [createMessage('1', true), createMessage('2', true), createMessage('3', true)];

      const result = getFeedbackEligibleMessages(messages);

      expect(result.size).toBe(3);
      expect(result.has('1')).toBe(true);
      expect(result.has('2')).toBe(true);
      expect(result.has('3')).toBe(true);
    });
  });

  describe('combined type exclusion and frequency', () => {
    it('only counts eligible messages for frequency calculation', () => {
      const messages = [
        createMessage('1', true), // 1st eligible
        createMessage('2', true, 'intro'), // excluded
        createMessage('3', true), // 2nd eligible - should show feedback
        createMessage('5', true), // 3rd eligible
        createMessage('6', true), // 4th eligible - should show feedback
      ];

      const result = getFeedbackEligibleMessages(messages, 2);

      expect(result.size).toBe(2);
      expect(result.has('1')).toBe(false);
      expect(result.has('2')).toBe(false);
      expect(result.has('3')).toBe(true); // 2nd eligible
      expect(result.has('5')).toBe(false);
      expect(result.has('6')).toBe(true); // 4th eligible
    });

    it('handles mixed user and agent messages with exclusions and frequency', () => {
      const messages = [
        createMessage('1', false), // user message - skip
        createMessage('2', true), // 1st eligible
        createMessage('3', true, 'intro'), // excluded
        createMessage('4', false), // user message - skip
        createMessage('5', true), // 2nd eligible
        createMessage('6', true, 'moderator_offered'), // excluded
        createMessage('7', true), // 3rd eligible - should show feedback
        createMessage('8', false), // user message - skip
        createMessage('9', true), // 4th eligible
        createMessage('10', true), // 5th eligible
        createMessage('11', true), // 6th eligible - should show feedback
      ];

      const result = getFeedbackEligibleMessages(messages, 3);

      expect(result.size).toBe(2);
      expect(result.has('7')).toBe(true); // 3rd eligible
      expect(result.has('11')).toBe(true); // 6th eligible
    });
  });

  describe('edge cases', () => {
    it('handles messages with string body (no type)', () => {
      const messages: PseudonymousMessage[] = [
        {
          id: '1',
          fromAgent: true,
          body: 'Simple string message',
          createdAt: new Date().toISOString(),
          conversation: 'test-conv-1',
          pause: false,
          visible: true,
          pseudonym: 'Test Assistant',
          pseudonymId: 'test-assistant-1',
          upVotes: [],
          downVotes: [],
        },
        {
          id: '2',
          fromAgent: true,
          body: 'Another string message',
          createdAt: new Date().toISOString(),
          conversation: 'test-conv-1',
          pause: false,
          visible: true,
          pseudonym: 'Test Assistant',
          pseudonymId: 'test-assistant-1',
          upVotes: [],
          downVotes: [],
        },
      ];

      const result = getFeedbackEligibleMessages(messages, 1);

      expect(result.size).toBe(2);
      expect(result.has('1')).toBe(true);
      expect(result.has('2')).toBe(true);
    });

    it('handles messages with other non-excluded types', () => {
      const messages = [
        createMessage('1', true, 'normal'),
        createMessage('2', true, 'response'),
        createMessage('3', true, 'custom_type'),
      ];

      const result = getFeedbackEligibleMessages(messages, 1);

      expect(result.size).toBe(3);
      expect(result.has('1')).toBe(true);
      expect(result.has('2')).toBe(true);
      expect(result.has('3')).toBe(true);
    });

    it('handles frequency larger than number of eligible messages', () => {
      const messages = [createMessage('1', true), createMessage('2', true)];

      const result = getFeedbackEligibleMessages(messages, 5);

      expect(result.size).toBe(0);
    });
  });
});
