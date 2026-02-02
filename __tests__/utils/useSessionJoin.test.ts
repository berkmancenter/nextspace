import { renderHook, waitFor } from "@testing-library/react";
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
      auth: { token: "mock-token" },
    };
    
    mockIo.mockReturnValue(mockSocket as any);

    // Setup Api mock
    mockGetTokens = jest.fn(() => ({ access: "mock-token", refresh: "mock-refresh" }));
    mockApi.get.mockReturnValue({
      GetTokens: mockGetTokens,
    } as any);
  });

  afterEach(() => {
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

  it("should register socket event handlers", async () => {
    renderHook(() => useSessionJoin(false));

    await waitFor(() => {
      expect(mockSocket.on).toHaveBeenCalledWith("error", expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith("connect", expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith("disconnect", expect.any(Function));
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
    connectHandler!();

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
    disconnectHandler!();

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
    errorHandler!(socketError);

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
});
