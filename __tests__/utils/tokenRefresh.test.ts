/**
 * @jest-environment jsdom
 */

// ─── Mock TokenManager ───────────────────────────────────────────────────────
// tokenRefresh utilities are thin wrappers around TokenManager.
// jest.mock is hoisted above const declarations so we use jest.fn() inline
// and obtain typed references after import.
jest.mock("../../utils/TokenManager", () => ({
  __esModule: true,
  default: {
    getValidToken: jest.fn(),
    refresh: jest.fn(),
    getAccessToken: jest.fn(() => ""),
    getTokens: jest.fn(() => ({ access: null, refresh: null })),
    setTokens: jest.fn(),
    setTokensFromStrings: jest.fn(),
    clearTokens: jest.fn(),
    isAccessTokenFresh: jest.fn(() => false),
    onTokensChanged: jest.fn(() => jest.fn()),
  },
  TokenManager: { get: jest.fn() },
}));

// Obtain typed references after jest.mock hoisting.
import TokenManagerDefault from "../../utils/TokenManager";
const mockGetValidToken = TokenManagerDefault.getValidToken as jest.Mock;
const mockRefresh = TokenManagerDefault.refresh as jest.Mock;
const mockGetAccessToken = TokenManagerDefault.getAccessToken as jest.Mock;

// Also mock Helpers / Api just in case they are transitively imported
jest.mock("../../utils/Helpers", () => ({
  Api: {
    get: jest.fn(() => ({
      GetTokens: jest.fn(() => ({ access: null, refresh: null })),
      getAccessToken: jest.fn(() => ""),
      SetTokens: jest.fn(),
      ClearTokens: jest.fn(),
      ClearAdminTokens: jest.fn(),
    })),
  },
}));

jest.mock("../../utils/Api", () => ({
  RefreshToken: jest.fn(),
  fetchWithTokenRefresh: jest.fn(),
  RetrieveData: jest.fn(),
  Request: jest.fn(),
  SocketStateHandler: jest.fn(),
  Authenticate: jest.fn(),
  getUserTimezone: jest.fn(() => "UTC"),
}));

import {
  ensureFreshToken,
  refreshAccessToken,
  emitWithTokenRefresh,
} from "../../utils/tokenRefresh";

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("tokenRefresh utilities", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── ensureFreshToken ─────────────────────────────────────────────────────

  describe("ensureFreshToken", () => {
    it("delegates to TokenManager.getValidToken() and returns its result", async () => {
      mockGetValidToken.mockResolvedValueOnce("valid-token");

      const result = await ensureFreshToken();

      expect(mockGetValidToken).toHaveBeenCalledTimes(1);
      expect(result).toBe("valid-token");
    });

    it("returns null when TokenManager.getValidToken() returns null", async () => {
      mockGetValidToken.mockResolvedValueOnce(null);

      const result = await ensureFreshToken();

      expect(result).toBeNull();
    });
  });

  // ─── refreshAccessToken ───────────────────────────────────────────────────

  describe("refreshAccessToken", () => {
    it("delegates to TokenManager.refresh() and returns true on success", async () => {
      mockRefresh.mockResolvedValueOnce(true);

      const result = await refreshAccessToken();

      expect(mockRefresh).toHaveBeenCalledTimes(1);
      expect(result).toBe(true);
    });

    it("delegates to TokenManager.refresh() and returns false on failure", async () => {
      mockRefresh.mockResolvedValueOnce(false);

      const result = await refreshAccessToken();

      expect(mockRefresh).toHaveBeenCalledTimes(1);
      expect(result).toBe(false);
    });
  });

  // ─── emitWithTokenRefresh ─────────────────────────────────────────────────

  describe("emitWithTokenRefresh", () => {
    let mockSocket: any;
    let onSuccess: jest.Mock;
    let onError: jest.Mock;

    beforeEach(() => {
      mockSocket = { emit: jest.fn() };
      onSuccess = jest.fn();
      onError = jest.fn();
    });

    it("calls onError when getValidToken returns null (no valid token)", async () => {
      mockGetValidToken.mockResolvedValueOnce(null);

      await emitWithTokenRefresh(mockSocket, "test:event", {}, onSuccess, onError);

      expect(onError).toHaveBeenCalledWith(expect.any(Error));
      expect(onSuccess).not.toHaveBeenCalled();
      expect(mockSocket.emit).not.toHaveBeenCalled();
    });

    it("emits the event with the fresh access token in the data payload", async () => {
      mockGetValidToken.mockResolvedValueOnce("fresh-token");

      mockSocket.emit.mockImplementationOnce(
        (_event: string, _data: any, callback: (r: any) => void) => {
          callback({ success: true });
        }
      );

      const eventData = { conversationId: "conv-1", token: "old-token" };

      await emitWithTokenRefresh(
        mockSocket,
        "conversation:join",
        eventData,
        onSuccess,
        onError
      );

      expect(mockSocket.emit).toHaveBeenCalledWith(
        "conversation:join",
        expect.objectContaining({ token: "fresh-token", conversationId: "conv-1" }),
        expect.any(Function)
      );
      expect(onSuccess).toHaveBeenCalledTimes(1);
      expect(onError).not.toHaveBeenCalled();
    });

    it("retries with refreshed token when socket returns a 401 auth error", async () => {
      mockGetValidToken.mockResolvedValueOnce("old-token");
      mockRefresh.mockResolvedValueOnce(true);
      mockGetAccessToken.mockReturnValue("new-token");

      // First emit → 401 auth error
      mockSocket.emit.mockImplementationOnce(
        (_event: string, _data: any, callback: (r: any) => void) => {
          callback({ error: { message: "401 Unauthorized" } });
        }
      );
      // Second emit (retry) → success
      mockSocket.emit.mockImplementationOnce(
        (_event: string, _data: any, callback: (r: any) => void) => {
          callback({ success: true });
        }
      );

      await emitWithTokenRefresh(
        mockSocket,
        "conversation:join",
        { token: "old-token" },
        onSuccess,
        onError
      );

      // Allow async retry to complete
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockRefresh).toHaveBeenCalledTimes(1);
      expect(mockSocket.emit).toHaveBeenCalledTimes(2);
      expect(onSuccess).toHaveBeenCalledTimes(1);
      expect(onError).not.toHaveBeenCalled();
    });

    it("calls onError after retry when refresh fails on auth error", async () => {
      mockGetValidToken.mockResolvedValueOnce("old-token");
      mockRefresh.mockResolvedValueOnce(false); // refresh fails

      mockSocket.emit.mockImplementationOnce(
        (_event: string, _data: any, callback: (r: any) => void) => {
          callback({ error: { message: "401 Unauthorized" } });
        }
      );

      await emitWithTokenRefresh(
        mockSocket,
        "conversation:join",
        { token: "old-token" },
        onSuccess,
        onError
      );

      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockRefresh).toHaveBeenCalledTimes(1);
      expect(mockSocket.emit).toHaveBeenCalledTimes(1); // no retry
      expect(onError).toHaveBeenCalledWith(expect.any(Error));
      expect(onSuccess).not.toHaveBeenCalled();
    });

    it("passes non-auth errors directly to onError without retrying", async () => {
      mockGetValidToken.mockResolvedValueOnce("valid-token");

      mockSocket.emit.mockImplementationOnce(
        (_event: string, _data: any, callback: (r: any) => void) => {
          callback({ error: { message: "Room is full" } });
        }
      );

      await emitWithTokenRefresh(
        mockSocket,
        "conversation:join",
        { token: "valid-token" },
        onSuccess,
        onError
      );

      expect(mockRefresh).not.toHaveBeenCalled();
      expect(onError).toHaveBeenCalledWith({ message: "Room is full" });
      expect(onSuccess).not.toHaveBeenCalled();
    });

    it("does not set token in data if data has no token field", async () => {
      mockGetValidToken.mockResolvedValueOnce("fresh-token");

      mockSocket.emit.mockImplementationOnce(
        (_event: string, _data: any, callback: (r: any) => void) => {
          callback({ success: true });
        }
      );

      const eventData = { someOtherField: "value" };

      await emitWithTokenRefresh(mockSocket, "test:event", eventData, onSuccess, onError);

      expect(mockSocket.emit).toHaveBeenCalledWith(
        "test:event",
        expect.not.objectContaining({ token: expect.anything() }),
        expect.any(Function)
      );
      expect(onSuccess).toHaveBeenCalled();
    });
  });
});
