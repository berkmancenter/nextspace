/**
 * @jest-environment jsdom
 */
import { Api } from "../../utils/Helpers";
import { RefreshToken } from "../../utils/Api";
import {
  ensureFreshToken,
  refreshAccessToken,
  emitWithTokenRefresh,
} from "../../utils/tokenRefresh";

// Mock the dependencies
jest.mock("../../utils/Helpers");
jest.mock("../../utils/Api");

// Mock global fetch
global.fetch = jest.fn();

describe("tokenRefresh utilities", () => {
  let mockApi: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup mock Api instance
    mockApi = {
      GetTokens: jest.fn(),
      SetTokens: jest.fn(),
    };
    (Api.get as jest.Mock).mockReturnValue(mockApi);

    // Reset fetch mock
    (global.fetch as jest.Mock).mockReset();
  });

  describe("ensureFreshToken", () => {
    it("should return current access token if no tokens available", async () => {
      mockApi.GetTokens.mockReturnValue({
        access: null,
        refresh: null,
      });

      const result = await ensureFreshToken();

      expect(result).toBeNull();
      expect(mockApi.GetTokens).toHaveBeenCalled();
    });

    it("should sync tokens from cookie if available", async () => {
      const currentTokens = {
        access: "old-access-token",
        refresh: "old-refresh-token",
      };
      const newTokens = {
        access: "new-access-token",
        refresh: "new-refresh-token",
      };

      // First call returns old tokens, second call (after SetTokens) returns new tokens
      mockApi.GetTokens
        .mockReturnValueOnce(currentTokens)
        .mockReturnValueOnce(newTokens);

      // Mock successful cookie fetch
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          tokens: newTokens,
        }),
      });

      const result = await ensureFreshToken();

      expect(result).toBe(newTokens.access);
      expect(mockApi.SetTokens).toHaveBeenCalledWith(
        newTokens.access,
        newTokens.refresh
      );
    });

    it("should return current token if cookie fetch fails", async () => {
      const currentTokens = {
        access: "current-access-token",
        refresh: "current-refresh-token",
      };

      mockApi.GetTokens.mockReturnValue(currentTokens);

      // Mock failed cookie fetch
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error("Network error"));

      const result = await ensureFreshToken();

      expect(result).toBe(currentTokens.access);
      expect(mockApi.SetTokens).not.toHaveBeenCalled();
    });
  });

  describe("refreshAccessToken", () => {
    it("should return false if no refresh token available", async () => {
      mockApi.GetTokens.mockReturnValue({
        access: "some-access-token",
        refresh: null,
      });

      const result = await refreshAccessToken();

      expect(result).toBe(false);
      expect(RefreshToken).not.toHaveBeenCalled();
    });

    it("should refresh tokens successfully", async () => {
      const currentTokens = {
        access: "old-access-token",
        refresh: "old-refresh-token",
      };
      const newTokens = {
        access: { token: "new-access-token" },
        refresh: { token: "new-refresh-token" },
      };

      mockApi.GetTokens.mockReturnValue(currentTokens);
      (RefreshToken as jest.Mock).mockResolvedValueOnce(newTokens);

      // Mock session update
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: "Success" }),
      });

      const result = await refreshAccessToken();

      expect(result).toBe(true);
      expect(RefreshToken).toHaveBeenCalledWith(currentTokens.refresh);
      expect(mockApi.SetTokens).toHaveBeenCalledWith(
        newTokens.access.token,
        newTokens.refresh.token
      );
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/session",
        expect.objectContaining({
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            accessToken: newTokens.access.token,
            refreshToken: newTokens.refresh.token,
          }),
        })
      );
    });

    it("should return false if refresh token API fails", async () => {
      const currentTokens = {
        access: "old-access-token",
        refresh: "old-refresh-token",
      };

      mockApi.GetTokens.mockReturnValue(currentTokens);
      (RefreshToken as jest.Mock).mockResolvedValueOnce({
        access: null,
        refresh: null,
      });

      const result = await refreshAccessToken();

      expect(result).toBe(false);
      expect(mockApi.SetTokens).not.toHaveBeenCalled();
    });

    it("should handle errors during refresh", async () => {
      const currentTokens = {
        access: "old-access-token",
        refresh: "old-refresh-token",
      };

      mockApi.GetTokens.mockReturnValue(currentTokens);
      (RefreshToken as jest.Mock).mockRejectedValueOnce(new Error("Network error"));

      const result = await refreshAccessToken();

      expect(result).toBe(false);
    });
  });

  describe("emitWithTokenRefresh", () => {
    let mockSocket: any;
    let onSuccess: jest.Mock;
    let onError: jest.Mock;

    beforeEach(() => {
      mockSocket = {
        emit: jest.fn(),
      };
      onSuccess = jest.fn();
      onError = jest.fn();

      mockApi.GetTokens.mockReturnValue({
        access: "fresh-access-token",
        refresh: "fresh-refresh-token",
      });

      // Mock ensureFreshToken to return a token
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          tokens: {
            access: "fresh-access-token",
            refresh: "fresh-refresh-token",
          },
        }),
      });
    });

    it("should emit with fresh token successfully", async () => {
      const eventData = {
        conversationId: "test-conv-id",
        token: "old-token",
        channels: [],
      };

      // Mock successful emit
      mockSocket.emit.mockImplementationOnce((event: string, data: any, callback: any) => {
        callback({ success: true });
      });

      await emitWithTokenRefresh(
        mockSocket,
        "conversation:join",
        eventData,
        onSuccess,
        onError
      );

      expect(mockSocket.emit).toHaveBeenCalledWith(
        "conversation:join",
        expect.objectContaining({
          conversationId: "test-conv-id",
          token: "fresh-access-token",
          channels: [],
        }),
        expect.any(Function)
      );
      expect(onSuccess).toHaveBeenCalled();
      expect(onError).not.toHaveBeenCalled();
    });

    it("should retry with refreshed token on auth error", async () => {
      const eventData = {
        conversationId: "test-conv-id",
        token: "old-token",
      };

      const newTokens = {
        access: { token: "refreshed-access-token" },
        refresh: { token: "refreshed-refresh-token" },
      };

      // First emit fails with auth error
      mockSocket.emit.mockImplementationOnce((event: string, data: any, callback: any) => {
        callback({ error: { message: "401 Unauthorized" } });
      });

      // Mock successful refresh
      (RefreshToken as jest.Mock).mockResolvedValueOnce(newTokens);
      mockApi.GetTokens
        .mockReturnValueOnce({
          access: "old-access-token",
          refresh: "old-refresh-token",
        })
        .mockReturnValueOnce({
          access: newTokens.access.token,
          refresh: newTokens.refresh.token,
        });

      // Second emit succeeds
      mockSocket.emit.mockImplementationOnce((event: string, data: any, callback: any) => {
        callback({ success: true });
      });

      await emitWithTokenRefresh(
        mockSocket,
        "conversation:join",
        eventData,
        onSuccess,
        onError
      );

      // Wait for async operations
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(mockSocket.emit).toHaveBeenCalledTimes(2);
      expect(RefreshToken).toHaveBeenCalled();
    });

    it("should call onError if no valid token available", async () => {
      mockApi.GetTokens.mockReturnValue({
        access: null,
        refresh: null,
      });

      // Mock ensureFreshToken to return null
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
      });

      await emitWithTokenRefresh(
        mockSocket,
        "conversation:join",
        {},
        onSuccess,
        onError
      );

      expect(onError).toHaveBeenCalledWith(expect.any(Error));
      expect(onSuccess).not.toHaveBeenCalled();
      expect(mockSocket.emit).not.toHaveBeenCalled();
    });

    it("should call onError on non-auth errors", async () => {
      const eventData = {
        conversationId: "test-conv-id",
        token: "valid-token",
      };

      // Emit fails with non-auth error
      mockSocket.emit.mockImplementationOnce((event: string, data: any, callback: any) => {
        callback({ error: { message: "Network error" } });
      });

      await emitWithTokenRefresh(
        mockSocket,
        "conversation:join",
        eventData,
        onSuccess,
        onError
      );

      expect(onError).toHaveBeenCalledWith({ message: "Network error" });
      expect(RefreshToken).not.toHaveBeenCalled();
    });
  });
});
