import { respondToPoll, getPollResponseCounts, inspectPoll } from '../../utils/pollHelpers';

jest.mock('../../utils/', () => ({
  RetrieveData: jest.fn(),
  SendData: jest.fn(),
}));

import { RetrieveData, SendData } from '../../utils/';

const mockRetrieveData = RetrieveData as jest.Mock;
const mockSendData = SendData as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('respondToPoll', () => {
  it('calls SendData with the correct endpoint and payload', async () => {
    mockSendData.mockResolvedValue({ ok: true });
    await respondToPoll('poll-123', 'Choice A');
    expect(mockSendData).toHaveBeenCalledWith('polls/poll-123/respond', { choice: { text: 'Choice A' } });
  });

  it('returns the SendData result', async () => {
    const mockResult = { id: 'response-1' };
    mockSendData.mockResolvedValue(mockResult);
    const result = await respondToPoll('poll-123', 'Choice A');
    expect(result).toBe(mockResult);
  });
});

describe('getPollResponseCounts', () => {
  it('returns count map on success', async () => {
    mockRetrieveData.mockResolvedValue({ 'Choice A': 3, 'Choice B': 7 });
    const result = await getPollResponseCounts('poll-123');
    expect(result).toEqual({ 'Choice A': 3, 'Choice B': 7 });
    expect(mockRetrieveData).toHaveBeenCalledWith('polls/poll-123/responseCounts');
  });

  it('returns empty object when result has error', async () => {
    mockRetrieveData.mockResolvedValue({ error: true, message: 'Not found' });
    const result = await getPollResponseCounts('poll-123');
    expect(result).toEqual({});
  });

  it('returns empty object when result is null', async () => {
    mockRetrieveData.mockResolvedValue(null);
    const result = await getPollResponseCounts('poll-123');
    expect(result).toEqual({});
  });

  it('returns empty object when result is not an object', async () => {
    mockRetrieveData.mockResolvedValue('unexpected string');
    const result = await getPollResponseCounts('poll-123');
    expect(result).toEqual({});
  });
});

describe('inspectPoll', () => {
  it('returns poll data with choices on success', async () => {
    const pollData = {
      id: 'poll-123',
      title: 'Favourite colour?',
      choices: [
        { text: 'Red', isSelected: false },
        { text: 'Blue', isSelected: true },
      ],
    };
    mockRetrieveData.mockResolvedValue(pollData);
    const result = await inspectPoll('poll-123');
    expect(result).toBe(pollData);
    expect(mockRetrieveData).toHaveBeenCalledWith('polls/poll-123');
  });

  it('returns null when result has error', async () => {
    mockRetrieveData.mockResolvedValue({ error: true });
    const result = await inspectPoll('poll-123');
    expect(result).toBeNull();
  });

  it('returns null when result is null', async () => {
    mockRetrieveData.mockResolvedValue(null);
    const result = await inspectPoll('poll-123');
    expect(result).toBeNull();
  });
});
