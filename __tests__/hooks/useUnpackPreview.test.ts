import { act, renderHook } from '@testing-library/react';
import { sendUnpackToPrivateChat, useUnpackPreview, UNPACK_PREVIEW_DELAY_MS } from '../../hooks/useUnpackPreview';
import { SendData } from '../../utils';
import { UnpackSelection } from '../../types.internal';

jest.mock('../../utils', () => ({
  SendData: jest.fn(),
  Api: { get: jest.fn(() => ({ getAccessToken: jest.fn(() => 'token') })) },
}));

const mockSendData = SendData as jest.Mock;

const range: UnpackSelection = { startMessageId: 'c1', startOffset: 0, endMessageId: 'c1', endOffset: 40 };
const otherRange: UnpackSelection = { startMessageId: 'c2', startOffset: 0, endMessageId: 'c2', endOffset: 30 };

const preview = {
  askId: 'ask-1',
  explanation: {
    range,
    chunkIds: ['c1'],
    passage: { start: '2025-10-17T10:43:00Z', end: '2025-10-17T10:43:10Z' },
    quote: 'Precedential weight concentrates in a few circuits.',
    whatTheyreSaying: "A ruling's influence comes from a few appeals courts.",
    whyItMatters: 'Lower courts lean on fewer precedents.',
    terms: [],
    headline: 'Doctrinal half-life',
    visual: null,
  },
};

const requestBody = (call: unknown[]) => JSON.parse((call[3] as RequestInit).body as string);

describe('useUnpackPreview', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockSendData.mockReset();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('waits until the selection has been still for the delay before asking for a preview', async () => {
    mockSendData.mockResolvedValue(preview);
    const { result } = renderHook(() => useUnpackPreview('conv-1', range));

    expect(result.current.state).toEqual({ status: 'loading' });
    act(() => jest.advanceTimersByTime(UNPACK_PREVIEW_DELAY_MS - 1));
    expect(mockSendData).not.toHaveBeenCalled();

    await act(async () => jest.advanceTimersByTime(1));

    expect(mockSendData).toHaveBeenCalledTimes(1);
    expect(mockSendData.mock.calls[0][0]).toBe('unpack/conv-1/preview');
    expect(requestBody(mockSendData.mock.calls[0])).toEqual(range);
    expect(result.current.state).toEqual({ status: 'ready', explanation: preview.explanation });
  });

  it('asks only about the newest selection when it changes before the delay ends', async () => {
    mockSendData.mockResolvedValue(preview);
    const { rerender } = renderHook(({ selected }) => useUnpackPreview('conv-1', selected), {
      initialProps: { selected: range },
    });

    act(() => jest.advanceTimersByTime(UNPACK_PREVIEW_DELAY_MS / 2));
    rerender({ selected: otherRange });
    await act(async () => jest.advanceTimersByTime(UNPACK_PREVIEW_DELAY_MS));

    expect(mockSendData).toHaveBeenCalledTimes(1);
    expect(requestBody(mockSendData.mock.calls[0])).toEqual(otherRange);
  });

  it('cancels a request that is still running when a newer selection replaces it', async () => {
    mockSendData.mockImplementation(() => new Promise(() => {}));
    const { rerender } = renderHook(({ selected }) => useUnpackPreview('conv-1', selected), {
      initialProps: { selected: range },
    });
    await act(async () => jest.advanceTimersByTime(UNPACK_PREVIEW_DELAY_MS));
    const firstSignal = (mockSendData.mock.calls[0][3] as RequestInit).signal!;

    rerender({ selected: otherRange });

    expect(firstSignal.aborted).toBe(true);
  });

  it('does not ask again when the same range comes back as a new object', async () => {
    mockSendData.mockResolvedValue(preview);
    const { rerender } = renderHook(({ selected }) => useUnpackPreview('conv-1', selected), {
      initialProps: { selected: range },
    });
    await act(async () => jest.advanceTimersByTime(UNPACK_PREVIEW_DELAY_MS));

    rerender({ selected: { ...range } });
    await act(async () => jest.advanceTimersByTime(UNPACK_PREVIEW_DELAY_MS));

    expect(mockSendData).toHaveBeenCalledTimes(1);
  });

  it('asks for nothing when there is no range', () => {
    const { result } = renderHook(() => useUnpackPreview('conv-1', null));
    act(() => jest.advanceTimersByTime(UNPACK_PREVIEW_DELAY_MS));

    expect(mockSendData).not.toHaveBeenCalled();
    expect(result.current.state).toEqual({ status: 'idle' });
  });

  it("reports the server's reason when the preview is refused", async () => {
    mockSendData.mockResolvedValue({ error: true, status: 503, message: 'Service Unavailable', reason: 'unpackFailed' });
    const { result } = renderHook(() => useUnpackPreview('conv-1', range));

    await act(async () => jest.advanceTimersByTime(UNPACK_PREVIEW_DELAY_MS));

    expect(result.current.state).toEqual({ status: 'error', reason: 'unpackFailed' });
  });

  it('reports an error with no reason when the request never got an answer', async () => {
    mockSendData.mockResolvedValue(undefined);
    const { result } = renderHook(() => useUnpackPreview('conv-1', range));

    await act(async () => jest.advanceTimersByTime(UNPACK_PREVIEW_DELAY_MS));

    expect(result.current.state).toEqual({ status: 'error', reason: undefined });
  });

  it('asks again right away when the participant retries', async () => {
    mockSendData.mockResolvedValueOnce({ error: true, status: 503, reason: 'unpackFailed' });
    mockSendData.mockResolvedValueOnce(preview);
    const { result } = renderHook(() => useUnpackPreview('conv-1', range));
    await act(async () => jest.advanceTimersByTime(UNPACK_PREVIEW_DELAY_MS));

    await act(async () => result.current.retry());

    expect(mockSendData).toHaveBeenCalledTimes(2);
    expect(result.current.state).toEqual({ status: 'ready', explanation: preview.explanation });
  });
});

describe('sendUnpackToPrivateChat', () => {
  beforeEach(() => mockSendData.mockReset());

  it('sends the passage with Private Chat as the destination', async () => {
    mockSendData.mockResolvedValue({ askId: 'ask-1', status: 'sent', messageId: 'msg-1' });

    const result = await sendUnpackToPrivateChat('conv-1', range);

    expect(mockSendData).toHaveBeenCalledWith('unpack/conv-1/send', { ...range, destination: 'privateChat' }, 'token');
    expect(result).toEqual({ ok: true, status: 'sent' });
  });

  it('says when the card will post once the explanation is written', async () => {
    mockSendData.mockResolvedValue({ askId: 'ask-1', status: 'pending' });

    expect(await sendUnpackToPrivateChat('conv-1', range)).toEqual({ ok: true, status: 'pending' });
  });

  it("returns the server's reason when sending is refused", async () => {
    mockSendData.mockResolvedValue({ error: true, status: 409, reason: 'noPrivateChat' });

    expect(await sendUnpackToPrivateChat('conv-1', range)).toEqual({ ok: false, reason: 'noPrivateChat' });
  });

  it('returns a failure with no reason when the request never got an answer', async () => {
    mockSendData.mockResolvedValue(undefined);

    expect(await sendUnpackToPrivateChat('conv-1', range)).toEqual({ ok: false, reason: undefined });
  });
});
