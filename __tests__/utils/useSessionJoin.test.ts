import { renderHook, waitFor } from "@testing-library/react";
import { io } from "socket.io-client";

// Mock socket.io-client
jest.mock("socket.io-client");

// Mock Helpers module
jest.mock("../../utils/Helpers", () => ({
  JoinSession: jest.fn(),
  Api: {
    get: jest.fn(() => ({
      GetTokens: jest.fn(() => ({ access: "mock-token", refresh: "mock-refresh" })),
    })),
  },
}));

// Import after mocking
import { useSessionJoin } from "../../utils/useSessionJoin";
import { JoinSession } from "../../utils/Helpers";

describe("useSessionJoin", () => {
  const mockIo = io as jest.MockedFunction<typeof io>;
  const mockJoinSession = JoinSession as jest.MockedFunction<typeof JoinSession>;
  let mockSocket: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create mock socket
    mockSocket = {
      on: jest.fn(),
      off: jest.fn(),
      emit: jest.fn(),
      auth: { token: "mock-token" },
    };
    
    mockIo.mockReturnValue(mockSocket as any);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should initialize with correct default state", () => {
    const { result } = renderHook(() => useSessionJoin(false));

    expect(result.current.socket).toBeNull();
    expect(result.current.pseudonym).toBeNull();
    expect(result.current.userId).toBeNull();
    expect(result.current.isConnected).toBe(false);
    expect(result.current.errorMessage).toBeNull();
  });

  it("should call JoinSession on mount", async () => {
    mockJoinSession.mockImplementation((success) => {
      success({ userId: "test-user", pseudonym: "test-pseudonym" });
    });

    renderHook(() => useSessionJoin(false));

    await waitFor(() => {
      expect(mockJoinSession).toHaveBeenCalledTimes(1);
    });
  });

  it("should only attempt join once (prevents infinite loop)", async () => {
    mockJoinSession.mockImplementation((success) => {
      success({ userId: "test-user", pseudonym: "test-pseudonym" });
    });

    const { rerender } = renderHook(() => useSessionJoin(false));

    await waitFor(() => {
      expect(mockJoinSession).toHaveBeenCalledTimes(1);
    });

    // Rerender should not trigger another join
    rerender();
    
    await waitFor(() => {
      expect(mockJoinSession).toHaveBeenCalledTimes(1);
    });
  });

  it("should set pseudonym and userId on successful join", async () => {
    mockJoinSession.mockImplementation((success) => {
      success({ userId: "test-user-123", pseudonym: "TestPseudonym" });
    });

    const { result } = renderHook(() => useSessionJoin(false));

    await waitFor(() => {
      expect(result.current.pseudonym).toBe("TestPseudonym");
      expect(result.current.userId).toBe("test-user-123");
    });
  });

  it("should create socket on successful join", async () => {
    mockJoinSession.mockImplementation((success) => {
      success({ userId: "test-user", pseudonym: "test-pseudonym" });
    });

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

  it("should set error message on join failure", async () => {
    const errorMsg = "Failed to join session";
    mockJoinSession.mockImplementation((_, error) => {
      error(errorMsg);
    });

    const { result } = renderHook(() => useSessionJoin(false));

    await waitFor(() => {
      expect(result.current.errorMessage).toBe(errorMsg);
    });
  });

  it("should register socket event handlers", async () => {
    mockJoinSession.mockImplementation((success) => {
      success({ userId: "test-user", pseudonym: "test-pseudonym" });
    });

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

    mockJoinSession.mockImplementation((success) => {
      success({ userId: "test-user", pseudonym: "test-pseudonym" });
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

    mockJoinSession.mockImplementation((success) => {
      success({ userId: "test-user", pseudonym: "test-pseudonym" });
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

  it("should pass isAuthenticated to JoinSession", async () => {
    mockJoinSession.mockImplementation((success) => {
      success({ userId: "test-user", pseudonym: "test-pseudonym" });
    });

    renderHook(() => useSessionJoin(true));

    await waitFor(() => {
      expect(mockJoinSession).toHaveBeenCalledWith(
        expect.any(Function),
        expect.any(Function),
        true
      );
    });
  });

  it("should call optional success callback", async () => {
    const onSuccess = jest.fn();
    
    mockJoinSession.mockImplementation((success) => {
      success({ userId: "test-user", pseudonym: "test-pseudonym" });
    });

    renderHook(() => useSessionJoin(false, onSuccess));

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledWith({
        userId: "test-user",
        pseudonym: "test-pseudonym",
      });
    });
  });

  it("should call optional error callback", async () => {
    const onError = jest.fn();
    const errorMsg = "Join failed";
    
    mockJoinSession.mockImplementation((_, error) => {
      error(errorMsg);
    });

    renderHook(() => useSessionJoin(false, undefined, onError));

    await waitFor(() => {
      expect(onError).toHaveBeenCalledWith(errorMsg);
    });
  });

  it("should cleanup socket event listeners on unmount", async () => {
    mockJoinSession.mockImplementation((success) => {
      success({ userId: "test-user", pseudonym: "test-pseudonym" });
    });

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

    mockJoinSession.mockImplementation((success) => {
      success({ userId: "test-user", pseudonym: "test-pseudonym" });
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
});
