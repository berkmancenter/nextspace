jest.mock('../../utils', () => {
  /* A stand-in for the real error class. The hook tests `instanceof` against the symbol it
     imports from this module, which is this one. */
  class ArtifactRequestError extends Error {
    status?: number;
    constructor(message: string, status?: number) {
      super(message);
      this.status = status;
    }
    get needsPasscode() {
      return this.status === 403;
    }
  }

  return {
    ArtifactRequestError,
    listArtifacts: jest.fn(),
    emitWithTokenRefresh: jest.fn(),
    Api: { get: () => ({ getAccessToken: () => 'test-token' }) },
  };
});

import { renderHook, act, waitFor } from '@testing-library/react';
import { useArtifacts } from '../../hooks/useArtifacts';
import { ArtifactRequestError, emitWithTokenRefresh, listArtifacts } from '../../utils';

const mockListArtifacts = listArtifacts as jest.Mock;
const mockEmit = emitWithTokenRefresh as jest.Mock;

/** A socket that records its handlers so a test can fire a broadcast at the hook. */
function makeSocket() {
  const handlers = new Map<string, ((payload: any) => void)[]>();
  return {
    connected: true,
    on: jest.fn((event: string, handler: (payload: any) => void) => {
      handlers.set(event, [...(handlers.get(event) ?? []), handler]);
    }),
    off: jest.fn((event: string, handler: (payload: any) => void) => {
      handlers.set(
        event,
        (handlers.get(event) ?? []).filter((h) => h !== handler),
      );
    }),
    emit: (event: string, payload: any) => (handlers.get(event) ?? []).forEach((h) => h(payload)),
  };
}

const artifact = {
  id: 'a1',
  type: 'ConceptGraphArtifact',
  scope: 'conversation',
  topic: 't1',
  conversation: 'conv-1',
  title: 'Concepts and contributions',
  currentVersionNumber: 2,
  currentVersion: { id: 'v2', artifact: 'a1', versionNumber: 2, payload: { concepts: [] } },
  locked: false,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockListArtifacts.mockResolvedValue([artifact]);
});

describe('reading a container', () => {
  it('lists a conversation’s artifacts with the passcode', async () => {
    const { result } = renderHook(() =>
      useArtifacts({ container: { conversationId: 'conv-1' }, artifactPasscode: 'Xk3fA9dQ' }),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mockListArtifacts).toHaveBeenCalledWith({ conversationId: 'conv-1' }, 'Xk3fA9dQ');
    expect(result.current.artifacts).toEqual([artifact]);
    expect(result.current.error).toBeNull();
  });

  it('reads nothing until the container is known', async () => {
    renderHook(() => useArtifacts({ container: null }));
    expect(mockListArtifacts).not.toHaveBeenCalled();
  });

  it('asks for a passcode on a 403 rather than reporting an error', async () => {
    // A wrong passcode, a missing one and an unknown id are one indistinguishable 403, so
    // "you need a passcode" is the only claim the hook is entitled to make.
    mockListArtifacts.mockRejectedValue(new ArtifactRequestError('Forbidden', 403));

    const { result } = renderHook(() => useArtifacts({ container: { conversationId: 'conv-1' } }));

    await waitFor(() => expect(result.current.needsPasscode).toBe(true));
    expect(result.current.error).toBeNull();
    expect(result.current.artifacts).toEqual([]);
  });

  it('surfaces any other failure as an error', async () => {
    mockListArtifacts.mockRejectedValue(new ArtifactRequestError('Boom', 500));

    const { result } = renderHook(() => useArtifacts({ container: { conversationId: 'conv-1' } }));

    await waitFor(() => expect(result.current.error).toBe('Boom'));
    expect(result.current.needsPasscode).toBe(false);
  });

  it('re-reads on reload', async () => {
    const { result } = renderHook(() => useArtifacts({ container: { conversationId: 'conv-1' } }));
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.reload());

    await waitFor(() => expect(mockListArtifacts).toHaveBeenCalledTimes(2));
  });
});

describe('live updates', () => {
  it('joins the bare conversation room, with no channels to present', async () => {
    const socket = makeSocket();
    renderHook(() => useArtifacts({ container: { conversationId: 'conv-1' }, socket: socket as any }));

    await waitFor(() => expect(mockEmit).toHaveBeenCalled());
    expect(mockEmit.mock.calls[0][1]).toBe('conversation:join');
    expect(mockEmit.mock.calls[0][2]).toEqual({ conversationId: 'conv-1', token: 'test-token', channels: [] });
  });

  it('applies a broadcast version in place instead of refetching', async () => {
    const socket = makeSocket();
    const { result } = renderHook(() => useArtifacts({ container: { conversationId: 'conv-1' }, socket: socket as any }));
    await waitFor(() => expect(result.current.artifacts).toHaveLength(1));

    const version = { id: 'v3', artifact: 'a1', versionNumber: 3, payload: { concepts: [{ id: 'c1', label: 'New' }] } };
    act(() => {
      socket.emit('artifact:version', { artifactId: 'a1', type: 'ConceptGraphArtifact', title: 'x', version });
    });

    expect(result.current.artifacts[0].currentVersion).toBe(version);
    expect(result.current.artifacts[0].currentVersionNumber).toBe(3);
    expect(result.current.liveArtifactIds.has('a1')).toBe(true);
    expect(mockListArtifacts).toHaveBeenCalledTimes(1);
  });

  it('ignores a version older than the one in hand', async () => {
    const socket = makeSocket();
    const { result } = renderHook(() => useArtifacts({ container: { conversationId: 'conv-1' }, socket: socket as any }));
    await waitFor(() => expect(result.current.artifacts).toHaveLength(1));

    act(() => {
      socket.emit('artifact:version', {
        artifactId: 'a1',
        type: 'ConceptGraphArtifact',
        title: 'x',
        version: { id: 'v1', artifact: 'a1', versionNumber: 1, payload: {} },
      });
    });

    expect(result.current.artifacts[0].currentVersionNumber).toBe(2);
  });

  it('re-reads the list when the version belongs to an artifact it has never seen', async () => {
    const socket = makeSocket();
    const { result } = renderHook(() => useArtifacts({ container: { conversationId: 'conv-1' }, socket: socket as any }));
    await waitFor(() => expect(result.current.artifacts).toHaveLength(1));

    act(() => {
      socket.emit('artifact:version', {
        artifactId: 'a2',
        type: 'DocumentArtifact',
        title: 'Brand new',
        version: { id: 'v1', artifact: 'a2', versionNumber: 1, payload: { body: 'hello' } },
      });
    });

    await waitFor(() => expect(mockListArtifacts).toHaveBeenCalledTimes(2));
  });

  it('stops listening when unmounted', async () => {
    const socket = makeSocket();
    const { unmount, result } = renderHook(() =>
      useArtifacts({ container: { conversationId: 'conv-1' }, socket: socket as any }),
    );
    await waitFor(() => expect(result.current.artifacts).toHaveLength(1));

    unmount();

    expect(socket.off).toHaveBeenCalledWith('artifact:version', expect.any(Function));
  });
});
