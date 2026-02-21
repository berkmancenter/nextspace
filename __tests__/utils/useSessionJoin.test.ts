import { renderHook, waitFor, act } from "@testing-library/react";
import { io } from "socket.io-client";

// Mock socket.io-client
jest.mock("socket.io-client");

// Mock SessionManager - Define mocks before jest.mock to avoid hoisting issues
const mockGetSessionInfo = jest.fn();
const mockSessionManagerInstance = {
  getSessionInfo: mockGetSessionInfo,
  restoreSession: jest.fn(),
  getState: jest.fn(),
  hasSession: jest.fn(),
};

jest.mock("../../utils/SessionManager", () => {
  return {
    __esModule: true,
    default: {
      get: jest.fn(() => mockSessionManagerInstance),
    },
  };
});

// Mock Helpers module
jest.mock("../../utils/Helpers", () => ({
  Api: {
    get: jest.fn(() => ({
      GetTokens: jest.fn(() => ({ access: "mock-token", refresh: "mock-refresh" })),
    })),
  },
}));

// Mock tokenRefresh module
const mockRefreshAccessToken = jest.fn();
jest.mock("../../utils/tokenRefresh", () => ({
  refreshAccessToken: (...args: any[]) => mockRefreshAccessToken(...args),
}));

// Import after mocking
import { useSessionJoin } from "../../utils/useSessionJoin";
import SessionManager from "../../utils/SessionManager";
import { Api } from "../../utils/Helpers";

describe("useSessionJoin", () => {
  const mockIo = io as jest.MockedFunction<typeof io>;
  const mockApi = Api as jest.Mocked<typeof Api>;
  let mockSocket: any;
  let mockGetTokens: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    // Reset the mocked instance functions
    mockGetSessionInfo.mockReturnValue({
      userId: "test-user",
      username: "test-pseudonym",
    });

    // Create mock socket
    mockSocket = {
      on: jest.fn(),
      off: jest.fn(),
      emit: jest.fn(),
      connected: false,
      connect: jest.fn(),
      auth: { token: "mock-token" },
    };

    mockIo.mockReturnValue(mockSocket as any);

    // Setup Api mock
    mockGetTokens = jest.fn(() => ({ access: "mock-token", refresh: "mock-refresh" }));
    mockApi.get.mockReturnValue({
      GetTokens: mockGetTokens,
    } as any);

    // Default: refreshAccessToken resolves to false (no-op)
    mockRefreshAccessToken.mockResolvedValue(false);

    // Mock document.addEventListener / removeEventListener
    jest.spyOn(document, "addEventListener");
    jest.spyOn(document, "removeEventListener");
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it("should initialize with correct default state", async () => {
    const { result } = renderHook(() => useSessionJoin(false));

    // Initially socket and user info should be set after mount
    await waitFor(() => {
      expect(result.current.socket).toBe(mockSocket);
      expect(result.current.pseudonym).toBe("test-pseudonym");
      expect(result.current.userId).toBe("test-user");
      expect(result.current.isConnected).toBe(false);
      expect(result.current.errorMessage).toBeNull();
    });
  });

  it("should get session info from SessionManager on mount", async () => {
    renderHook(() => useSessionJoin(false));

    await waitFor(() => {
      expect(mockGetSessionInfo).toHaveBeenCalledTimes(1);
    });
  });

  it("should only initialize once (prevents infinite loop)", async () => {
    const { rerender } = renderHook(() => useSessionJoin(false));

    await waitFor(() => {
      expect(mockGetSessionInfo).toHaveBeenCalledTimes(1);
    });

    // Rerender should not trigger another initialization
    rerender();

    await waitFor(() => {
      expect(mockGetSessionInfo).toHaveBeenCalledTimes(1);
    });
  });

  it("should set pseudonym and userId from session info", async () => {
    mockGetSessionInfo.mockReturnValue({
      userId: "test-user-123",
      username: "TestPseudonym",
    });

    const { result } = renderHook(() => useSessionJoin(false));

    await waitFor(() => {
      expect(result.current.pseudonym).toBe("TestPseudonym");
      expect(result.current.userId).toBe("test-user-123");
    });
  });

  it("should create socket with session info", async () => {
    const { result } = renderHook(() => useSessionJoin(false));

    await waitFor(() => {
      expect(mockIo).toHaveBeenCalledWith(
        process.env.NEXT_PUBLIC_SOCKET_URL,
        expect.objectContaining({
          auth: { token: "mock-token" },
        })
      );
      expect(result.current.socket).toBe(mockSocket);
    });
  });

  it("should set error message when no session info available", async () => {
    mockGetSessionInfo.mockReturnValue(null);

    const { result } = renderHook(() => useSessionJoin(false));

    await waitFor(() => {
      expect(result.current.errorMessage).toBe("No session available");
    });
  });

  it("should set error message when no access token available", async () => {
    mockGetTokens.mockReturnValue({ access: null, refresh: null });

    const { result } = renderHook(() => useSessionJoin(false));

    await waitFor(() => {
      expect(result.current.errorMessage).toBe("No access token available");
    });
  });

  it("should register socket event handlers including connect_error", async () => {
    renderHook(() => useSessionJoin(false));

    await waitFor(() => {
      expect(mockSocket.on).toHaveBeenCalledWith("error", expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith("connect", expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith("disconnect", expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith("connect_error", expect.any(Function));
    });
  });

  it("should update isConnected when socket connects", async () => {
    let connectHandler: Function;
    mockSocket.on.mockImplementation((event: string, handler: Function) => {
      if (event === "connect") {
        connectHandler = handler;
      }
    });

    const { result } = renderHook(() => useSessionJoin(false));

    await waitFor(() => {
      expect(mockSocket.on).toHaveBeenCalledWith("connect", expect.any(Function));
    });

    // Simulate connect event
    act(() => {
      connectHandler!();
    });

    await waitFor(() => {
      expect(result.current.isConnected).toBe(true);
    });
  });

  it("should update isConnected when socket disconnects", async () => {
    let disconnectHandler: Function;
    mockSocket.on.mockImplementation((event: string, handler: Function) => {
      if (event === "disconnect") {
        disconnectHandler = handler;
      }
    });

    const { result } = renderHook(() => useSessionJoin(false));

    await waitFor(() => {
      expect(mockSocket.on).toHaveBeenCalledWith("disconnect", expect.any(Function));
    });

    // Simulate disconnect event
    act(() => {
      disconnectHandler!();
    });

    await waitFor(() => {
      expect(result.current.isConnected).toBe(false);
    });
  });

  it("should call optional success callback", async () => {
    const onSuccess = jest.fn();

    renderHook(() => useSessionJoin(false, onSuccess));

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledWith({
        userId: "test-user",
        pseudonym: "test-pseudonym",
      });
    });
  });

  it("should call optional error callback when no session", async () => {
    const onError = jest.fn();
    mockGetSessionInfo.mockReturnValue(null);

    renderHook(() => useSessionJoin(false, undefined, onError));

    await waitFor(() => {
      expect(onError).toHaveBeenCalledWith("No session available");
    });
  });

  it("should cleanup socket event listeners on unmount", async () => {
    const { unmount } = renderHook(() => useSessionJoin(false));

    await waitFor(() => {
      expect(mockSocket.on).toHaveBeenCalled();
    });

    unmount();

    expect(mockSocket.off).toHaveBeenCalledWith("error", expect.any(Function));
    expect(mockSocket.off).toHaveBeenCalledWith("connect", expect.any(Function));
    expect(mockSocket.off).toHaveBeenCalledWith("disconnect", expect.any(Function));
    expect(mockSocket.off).toHaveBeenCalledWith("connect_error", expect.any(Function));
  });

  it("should handle socket error events", async () => {
    const consoleError = jest.spyOn(console, "error").mockImplementation();
    let errorHandler: Function;

    mockSocket.on.mockImplementation((event: string, handler: Function) => {
      if (event === "error") {
        errorHandler = handler;
      }
    });

    renderHook(() => useSessionJoin(false));

    await waitFor(() => {
      expect(mockSocket.on).toHaveBeenCalledWith("error", expect.any(Function));
    });

    // Simulate socket error
    const socketError = "Socket connection failed";
    act(() => {
      errorHandler!(socketError);
    });

    expect(consoleError).toHaveBeenCalledWith("Socket error:", socketError);

    consoleError.mockRestore();
  });

  it("accepts isAuthenticated parameter for backward compatibility", async () => {
    // The parameter is no longer used but should not cause errors
    const { result } = renderHook(() => useSessionJoin(true));

    await waitFor(() => {
      expect(result.current.socket).toBe(mockSocket);
    });
  });

  it("should expose lastReconnectTime, starting as null", async () => {
    const { result } = renderHook(() => useSessionJoin(false));

    await waitFor(() => {
      expect(result.current.socket).toBe(mockSocket);
    });

    expect(result.current.lastReconnectTime).toBeNull();
  });

  describe("gap-reconnect detection (lastReconnectTime)", () => {
    it("should set lastReconnectTime when reconnecting after a long gap (>= 10s)", async () => {
      let connectHandler: Function;
      let disconnectHandler: Function;

      mockSocket.on.mockImplementation((event: string, handler: Function) => {
        if (event === "connect") connectHandler = handler;
        if (event === "disconnect") disconnectHandler = handler;
      });

      const { result } = renderHook(() => useSessionJoin(false));

      await waitFor(() => {
        expect(mockSocket.on).toHaveBeenCalledWith("connect", expect.any(Function));
        expect(mockSocket.on).toHaveBeenCalledWith("disconnect", expect.any(Function));
      });

      // Simulate disconnect
      act(() => {
        disconnectHandler!();
      });

      // Advance time by 15 seconds (past the 10s threshold)
      jest.advanceTimersByTime(15_000);

      // Simulate reconnect
      act(() => {
        connectHandler!();
      });

      await waitFor(() => {
        expect(result.current.lastReconnectTime).not.toBeNull();
        expect(typeof result.current.lastReconnectTime).toBe("number");
      });
    });

    it("should NOT set lastReconnectTime when reconnecting after a short gap (< 10s)", async () => {
      let connectHandler: Function;
      let disconnectHandler: Function;

      mockSocket.on.mockImplementation((event: string, handler: Function) => {
        if (event === "connect") connectHandler = handler;
        if (event === "disconnect") disconnectHandler = handler;
      });

      const { result } = renderHook(() => useSessionJoin(false));

      await waitFor(() => {
        expect(mockSocket.on).toHaveBeenCalledWith("connect", expect.any(Function));
        expect(mockSocket.on).toHaveBeenCalledWith("disconnect", expect.any(Function));
      });

      // Simulate disconnect
      act(() => {
        disconnectHandler!();
      });

      // Advance time by only 3 seconds (below the 10s threshold)
      jest.advanceTimersByTime(3_000);

      // Simulate reconnect
      act(() => {
        connectHandler!();
      });

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
      });

      // lastReconnectTime should still be null since gap was short
      expect(result.current.lastReconnectTime).toBeNull();
    });

    it("should NOT set lastReconnectTime on the initial connection (no prior disconnect)", async () => {
      let connectHandler: Function;

      mockSocket.on.mockImplementation((event: string, handler: Function) => {
        if (event === "connect") connectHandler = handler;
      });

      const { result } = renderHook(() => useSessionJoin(false));

      await waitFor(() => {
        expect(mockSocket.on).toHaveBeenCalledWith("connect", expect.any(Function));
      });

      // Simulate initial connect with no prior disconnect
      act(() => {
        connectHandler!();
      });

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
      });

      // No disconnect happened before, so lastReconnectTime should remain null
      expect(result.current.lastReconnectTime).toBeNull();
    });

    it("should update lastReconnectTime on each new long-gap reconnect", async () => {
      let connectHandler: Function;
      let disconnectHandler: Function;

      mockSocket.on.mockImplementation((event: string, handler: Function) => {
        if (event === "connect") connectHandler = handler;
        if (event === "disconnect") disconnectHandler = handler;
      });

      const { result } = renderHook(() => useSessionJoin(false));

      await waitFor(() => {
        expect(mockSocket.on).toHaveBeenCalledWith("connect", expect.any(Function));
      });

      // First gap-reconnect
      act(() => { disconnectHandler!(); });
      jest.advanceTimersByTime(15_000);
      act(() => { connectHandler!(); });

      let firstReconnectTime: number | null = null;
      await waitFor(() => {
        expect(result.current.lastReconnectTime).not.toBeNull();
        firstReconnectTime = result.current.lastReconnectTime;
      });

      // Second gap-reconnect
      act(() => { disconnectHandler!(); });
      jest.advanceTimersByTime(15_000);
      act(() => { connectHandler!(); });

      await waitFor(() => {
        expect(result.current.lastReconnectTime).not.toEqual(firstReconnectTime);
      });
    });
  });

  describe("connect_error handling", () => {
    it("should refresh token on auth-related connect_error", async () => {
      mockRefreshAccessToken.mockResolvedValue(true);
      mockGetTokens.mockReturnValue({ access: "new-token", refresh: "new-refresh" });

      let connectErrorHandler: Function;
      mockSocket.on.mockImplementation((event: string, handler: Function) => {
        if (event === "connect_error") {
          connectErrorHandler = handler;
        }
      });

      renderHook(() => useSessionJoin(false));

      await waitFor(() => {
        expect(mockSocket.on).toHaveBeenCalledWith("connect_error", expect.any(Function));
      });

      // Simulate an auth connect_error
      await act(async () => {
        await connectErrorHandler!(new Error("401 Unauthorized"));
      });

      expect(mockRefreshAccessToken).toHaveBeenCalledTimes(1);
      // socket.auth should be updated with the new token
      expect(mockSocket.auth).toEqual({ token: "new-token" });
    });

    it("should refresh token when connect_error message contains 'authentication'", async () => {
      mockRefreshAccessToken.mockResolvedValue(true);
      mockGetTokens.mockReturnValue({ access: "fresh-token", refresh: "fresh-refresh" });

      let connectErrorHandler: Function;
      mockSocket.on.mockImplementation((event: string, handler: Function) => {
        if (event === "connect_error") {
          connectErrorHandler = handler;
        }
      });

      renderHook(() => useSessionJoin(false));

      await waitFor(() => {
        expect(mockSocket.on).toHaveBeenCalledWith("connect_error", expect.any(Function));
      });

      await act(async () => {
        await connectErrorHandler!(new Error("authentication failed"));
      });

      expect(mockRefreshAccessToken).toHaveBeenCalledTimes(1);
      expect(mockSocket.auth).toEqual({ token: "fresh-token" });
    });

    it("should not refresh token on non-auth connect_error", async () => {
      let connectErrorHandler: Function;
      mockSocket.on.mockImplementation((event: string, handler: Function) => {
        if (event === "connect_error") {
          connectErrorHandler = handler;
        }
      });

      renderHook(() => useSessionJoin(false));

      await waitFor(() => {
        expect(mockSocket.on).toHaveBeenCalledWith("connect_error", expect.any(Function));
      });

      await act(async () => {
        await connectErrorHandler!(new Error("Network timeout"));
      });

      expect(mockRefreshAccessToken).not.toHaveBeenCalled();
    });

    it("should not update socket.auth when token refresh fails", async () => {
      mockRefreshAccessToken.mockResolvedValue(false);
      const originalAuth = { token: "mock-token" };
      mockSocket.auth = { ...originalAuth };

      let connectErrorHandler: Function;
      mockSocket.on.mockImplementation((event: string, handler: Function) => {
        if (event === "connect_error") {
          connectErrorHandler = handler;
        }
      });

      renderHook(() => useSessionJoin(false));

      await waitFor(() => {
        expect(mockSocket.on).toHaveBeenCalledWith("connect_error", expect.any(Function));
      });

      await act(async () => {
        await connectErrorHandler!(new Error("401 Unauthorized"));
      });

      expect(mockRefreshAccessToken).toHaveBeenCalledTimes(1);
      // auth should remain unchanged since refresh failed
      expect(mockSocket.auth).toEqual(originalAuth);
    });
  });

  describe("visibility change handling", () => {
    it("should register visibilitychange event listener", async () => {
      renderHook(() => useSessionJoin(false));

      await waitFor(() => {
        expect(document.addEventListener).toHaveBeenCalledWith(
          "visibilitychange",
          expect.any(Function)
        );
      });
    });

    it("should refresh token when tab becomes visible", async () => {
      mockRefreshAccessToken.mockResolvedValue(true);
      mockGetTokens.mockReturnValue({ access: "visible-token", refresh: "visible-refresh" });
      mockSocket.connected = true;

      let visibilityHandler: Function;
      (document.addEventListener as jest.Mock).mockImplementation(
        (event: string, handler: Function) => {
          if (event === "visibilitychange") {
            visibilityHandler = handler;
          }
        }
      );

      renderHook(() => useSessionJoin(false));

      await waitFor(() => {
        expect(document.addEventListener).toHaveBeenCalledWith(
          "visibilitychange",
          expect.any(Function)
        );
      });

      // Simulate tab becoming visible
      Object.defineProperty(document, "visibilityState", {
        value: "visible",
        writable: true,
      });

      await act(async () => {
        await visibilityHandler!();
      });

      expect(mockRefreshAccessToken).toHaveBeenCalled();
      expect(mockSocket.auth).toEqual({ token: "visible-token" });
    });

    it("should reconnect disconnected socket when tab becomes visible and token refreshes", async () => {
      mockRefreshAccessToken.mockResolvedValue(true);
      mockGetTokens.mockReturnValue({ access: "reconnect-token", refresh: "reconnect-refresh" });
      mockSocket.connected = false; // Socket is disconnected

      let visibilityHandler: Function;
      (document.addEventListener as jest.Mock).mockImplementation(
        (event: string, handler: Function) => {
          if (event === "visibilitychange") {
            visibilityHandler = handler;
          }
        }
      );

      renderHook(() => useSessionJoin(false));

      await waitFor(() => {
        expect(document.addEventListener).toHaveBeenCalledWith(
          "visibilitychange",
          expect.any(Function)
        );
      });

      Object.defineProperty(document, "visibilityState", {
        value: "visible",
        writable: true,
      });

      await act(async () => {
        await visibilityHandler!();
      });

      // Should call socket.connect() to reconnect with fresh token
      expect(mockSocket.connect).toHaveBeenCalled();
    });

    it("should remove visibilitychange listener on unmount", async () => {
      const { unmount } = renderHook(() => useSessionJoin(false));

      await waitFor(() => {
        expect(document.addEventListener).toHaveBeenCalledWith(
          "visibilitychange",
          expect.any(Function)
        );
      });

      unmount();

      expect(document.removeEventListener).toHaveBeenCalledWith(
        "visibilitychange",
        expect.any(Function)
      );
    });
  });

  describe("periodic token refresh", () => {
    it("should set up a periodic token refresh interval", async () => {
      const setIntervalSpy = jest.spyOn(global, "setInterval");

      renderHook(() => useSessionJoin(false));

      await waitFor(() => {
        expect(mockSocket.on).toHaveBeenCalled();
      });

      // Should have set up an interval (25 minutes = 1,500,000 ms)
      expect(setIntervalSpy).toHaveBeenCalledWith(
        expect.any(Function),
        25 * 60 * 1000
      );
    });

    it("should refresh token on periodic interval tick", async () => {
      mockRefreshAccessToken.mockResolvedValue(true);
      mockGetTokens.mockReturnValue({ access: "periodic-token", refresh: "periodic-refresh" });
      mockSocket.connected = true;

      renderHook(() => useSessionJoin(false));

      await waitFor(() => {
        expect(mockSocket.on).toHaveBeenCalled();
      });

      // Advance timer by 25 minutes to trigger the periodic refresh
      await act(async () => {
        jest.advanceTimersByTime(25 * 60 * 1000);
        // Allow async operations to complete
        await Promise.resolve();
      });

      expect(mockRefreshAccessToken).toHaveBeenCalled();
    });

    it("should clear the interval on unmount", async () => {
      const clearIntervalSpy = jest.spyOn(global, "clearInterval");

      const { unmount } = renderHook(() => useSessionJoin(false));

      await waitFor(() => {
        expect(mockSocket.on).toHaveBeenCalled();
      });

      unmount();

      expect(clearIntervalSpy).toHaveBeenCalled();
    });
  });
});
