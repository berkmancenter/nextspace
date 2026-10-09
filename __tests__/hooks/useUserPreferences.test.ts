import { renderHook, waitFor, act } from '@testing-library/react';

const mockGetAccessToken = jest.fn(() => 'token');

jest.mock('../../utils', () => ({
  Api: { get: jest.fn(() => ({ getAccessToken: mockGetAccessToken })) },
  RetrieveData: jest.fn(),
  SendData: jest.fn(),
  emitWithTokenRefresh: jest.fn(),
}));

import { useUserPreferences } from '../../hooks/useUserPreferences';
import { RetrieveData, SendData, emitWithTokenRefresh } from '../../utils';

const mockRetrieveData = RetrieveData as jest.Mock;
const mockSendData = SendData as jest.Mock;
const mockEmitWithTokenRefresh = emitWithTokenRefresh as jest.Mock;

function makeSocket({ connected = true }: { connected?: boolean } = {}) {
  const handlers: Record<string, Function> = {};
  return {
    connected,
    on: jest.fn((event: string, handler: Function) => {
      handlers[event] = handler;
    }),
    off: jest.fn(),
    emit(event: string, payload?: unknown) {
      handlers[event]?.(payload);
    },
  } as any;
}

describe('useUserPreferences', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSendData.mockResolvedValue({});
  });

  it('defaults both preferences to false before the fetch resolves', () => {
    mockRetrieveData.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useUserPreferences('user-1', null));

    expect(result.current.preferences).toEqual({ jargonClarification: false, visualResponse: false });
    expect(result.current.loading).toBe(true);
  });

  it('loads preferences from the API', async () => {
    mockRetrieveData.mockResolvedValue({ jargonClarification: true, visualResponse: false });
    const { result } = renderHook(() => useUserPreferences('user-1', null));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.preferences).toEqual({ jargonClarification: true, visualResponse: false });
  });

  it('does not fetch when there is no userId', () => {
    renderHook(() => useUserPreferences(null, null));
    expect(mockRetrieveData).not.toHaveBeenCalled();
  });

  it('optimistically updates and PUTs the toggled preference', async () => {
    mockRetrieveData.mockResolvedValue({ jargonClarification: false, visualResponse: false });
    const { result } = renderHook(() => useUserPreferences('user-1', null));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.updatePreference('jargonClarification');
    });

    expect(result.current.preferences.jargonClarification).toBe(true);
    expect(mockSendData).toHaveBeenCalledWith(
      'users/user/user-1/preferences',
      { jargonClarification: true, visualResponse: false },
      undefined,
      undefined,
      'PUT',
    );
  });

  it('applies a preferences:updated broadcast for this user, e.g. from another tab/device', async () => {
    mockRetrieveData.mockResolvedValue({ jargonClarification: false, visualResponse: false });
    const socket = makeSocket();
    const { result } = renderHook(() => useUserPreferences('user-1', socket));
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      socket.emit('preferences:updated', {
        userId: 'user-1',
        preferences: { jargonClarification: true, visualResponse: true },
      });
    });

    expect(result.current.preferences).toEqual({ jargonClarification: true, visualResponse: true });
  });

  it('ignores a preferences:updated broadcast for a different user', async () => {
    mockRetrieveData.mockResolvedValue({ jargonClarification: false, visualResponse: false });
    const socket = makeSocket();
    const { result } = renderHook(() => useUserPreferences('user-1', socket));
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      socket.emit('preferences:updated', {
        userId: 'some-other-user',
        preferences: { jargonClarification: true, visualResponse: true },
      });
    });

    expect(result.current.preferences).toEqual({ jargonClarification: false, visualResponse: false });
  });

  it('unsubscribes from preferences:updated and connect on unmount', async () => {
    mockRetrieveData.mockResolvedValue({ jargonClarification: false, visualResponse: false });
    const socket = makeSocket();
    const { unmount } = renderHook(() => useUserPreferences('user-1', socket));

    unmount();

    expect(socket.off).toHaveBeenCalledWith('preferences:updated', expect.any(Function));
    expect(socket.off).toHaveBeenCalledWith('connect', expect.any(Function));
  });

  describe('joining the user room (where preferences:updated is broadcast)', () => {
    it('joins immediately when the socket is already connected', () => {
      mockRetrieveData.mockResolvedValue({ jargonClarification: false, visualResponse: false });
      const socket = makeSocket({ connected: true });

      renderHook(() => useUserPreferences('user-1', socket));

      expect(mockEmitWithTokenRefresh).toHaveBeenCalledWith(socket, 'user:join', { userId: 'user-1' });
    });

    it('does not join immediately when the socket is not yet connected', () => {
      mockRetrieveData.mockResolvedValue({ jargonClarification: false, visualResponse: false });
      const socket = makeSocket({ connected: false });

      renderHook(() => useUserPreferences('user-1', socket));

      expect(mockEmitWithTokenRefresh).not.toHaveBeenCalled();
    });

    it('(re)joins the room every time the socket connects, e.g. after a reconnect', () => {
      mockRetrieveData.mockResolvedValue({ jargonClarification: false, visualResponse: false });
      const socket = makeSocket({ connected: false });
      renderHook(() => useUserPreferences('user-1', socket));
      expect(mockEmitWithTokenRefresh).not.toHaveBeenCalled();

      act(() => socket.emit('connect'));
      expect(mockEmitWithTokenRefresh).toHaveBeenCalledTimes(1);

      act(() => socket.emit('connect'));
      expect(mockEmitWithTokenRefresh).toHaveBeenCalledTimes(2);
    });

    it('does not attempt to join when there is no socket', () => {
      mockRetrieveData.mockResolvedValue({ jargonClarification: false, visualResponse: false });

      renderHook(() => useUserPreferences('user-1', null));

      expect(mockEmitWithTokenRefresh).not.toHaveBeenCalled();
    });
  });
});
