import {
  fetchWithTokenRefresh,
  RefreshToken,
  RetrieveData,
  Request,
} from "../../utils/Api";
import { Api } from "../../utils/Helpers";

// ─── Mock TokenManager ──────────────────────────────────────────────────────
// fetchWithTokenRefresh delegates 401 handling to TokenManager.refresh().
// jest.mock is hoisted before const declarations so we use jest.fn() inline
// and obtain references after import.
jest.mock("../../utils/TokenManager", () => ({
  __esModule: true,
  default: {
    refresh: jest.fn(),
    getAccessToken: jest.fn(() => "mock-access"),
    getTokens: jest.fn(() => ({ access: "mock-access", refresh: "mock-refresh" })),
    getFullTokens: jest.fn(() => null),
    isAccessTokenFresh: jest.fn(() => true),
    setTokens: jest.fn(),
    setTokensFromStrings: jest.fn(),
    clearTokens: jest.fn(),
    onTokensChanged: jest.fn(() => jest.fn()),
  },
  TokenManager: { get: jest.fn() },
}));

// Obtain references after jest.mock hoisting
import TokenManagerDefault from "../../utils/TokenManager";
const mockTokenManagerRefresh = TokenManagerDefault.refresh as jest.Mock;
const mockTokenManagerGetAccessToken = TokenManagerDefault.getAccessToken as jest.Mock;

// ─── Mock Api (Helpers) ─────────────────────────────────────────────────────
const mockGetTokens = jest.fn(() => ({
  access: "mock-access",
  refresh: "mock-refresh",
}));

const mockApiInstance = {
  SetTokens: jest.fn(),
  GetTokens: mockGetTokens,
  getAccessToken: jest.fn((): string => mockGetTokens().access ?? ""),
  ClearTokens: jest.fn(),
};

jest.mock("../../utils/Helpers", () => ({
  Api: {
    get: jest.fn(() => mockApiInstance),
  },
}));

// ─── Mock fetch ─────────────────────────────────────────────────────────────
global.fetch = jest.fn();

describe("Token Refresh Functionality", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockClear();
    mockApiInstance.SetTokens.mockClear();
    mockApiInstance.GetTokens.mockClear();
    mockApiInstance.ClearTokens.mockClear();
    mockTokenManagerRefresh.mockClear();
    mockTokenManagerGetAccessToken.mockClear();
    mockTokenManagerGetAccessToken.mockReturnValue("mock-access");
  });

  describe("fetchWithTokenRefresh", () => {
    const mockUrl = "https://api.example.com/test";
    const mockOptions: RequestInit = {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    };

    it("should make successful request without token refresh", async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: async () => ({ data: "test" }),
      };
      (global.fetch as jest.Mock).mockResolvedValueOnce(mockResponse);

      const response = await fetchWithTokenRefresh(mockUrl, mockOptions);

      expect(response.ok).toBe(true);
      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(global.fetch).toHaveBeenCalledWith(mockUrl, mockOptions);
    });

    it("should add Authorization header when useStoredTokens is true", async () => {
      mockApiInstance.GetTokens.mockReturnValue({
        access: "stored-token",
        refresh: "refresh-token",
      });
      const mockResponse = {
        ok: true,
        status: 200,
        json: async () => ({ data: "test" }),
      };
      (global.fetch as jest.Mock).mockResolvedValueOnce(mockResponse);

      await fetchWithTokenRefresh(
        mockUrl,
        { method: "GET", headers: {} },
        true,
      );

      expect(global.fetch).toHaveBeenCalledWith(
        mockUrl,
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer stored-token",
          }),
        }),
      );
    });

    it("should not override existing Authorization header", async () => {
      mockApiInstance.GetTokens.mockReturnValue({
        access: "stored-token",
        refresh: "refresh-token",
      });
      const mockResponse = {
        ok: true,
        status: 200,
        json: async () => ({ data: "test" }),
      };
      (global.fetch as jest.Mock).mockResolvedValueOnce(mockResponse);

      const optionsWithAuth = {
        method: "GET",
        headers: { Authorization: "Bearer custom-token" },
      };

      await fetchWithTokenRefresh(mockUrl, optionsWithAuth, true);

      expect(global.fetch).toHaveBeenCalledWith(
        mockUrl,
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer custom-token",
          }),
        }),
      );
    });

    it("should call TokenManager.refresh() on 401 and retry with new token", async () => {
      mockApiInstance.GetTokens.mockReturnValue({
        access: "old-token",
        refresh: "refresh-token",
      });
      mockTokenManagerGetAccessToken.mockReturnValue("new-access-token");

      const mock401Response = { ok: false, status: 401, headers: { get: () => null } };
      const mockSuccessResponse = {
        ok: true,
        status: 200,
        headers: { get: () => null },
        json: async () => ({ data: "success" }),
      };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce(mock401Response) // Initial request
        .mockResolvedValueOnce(mockSuccessResponse); // Retry request

      // TokenManager.refresh() succeeds and the new token is returned
      mockTokenManagerRefresh.mockResolvedValueOnce(true);

      const response = await fetchWithTokenRefresh(mockUrl, mockOptions, true);

      expect(mockTokenManagerRefresh).toHaveBeenCalledTimes(1);
      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect(response.ok).toBe(true);
    });

    it("should not attempt refresh if no refresh token available", async () => {
      mockApiInstance.GetTokens.mockReturnValue({
        access: "token",
        refresh: "", // no refresh token
      });

      const mock401Response = { ok: false, status: 401 };
      (global.fetch as jest.Mock).mockResolvedValueOnce(mock401Response);

      const response = await fetchWithTokenRefresh(mockUrl, mockOptions, true);

      // TokenManager.refresh() should NOT be called when there is no refresh token
      expect(mockTokenManagerRefresh).not.toHaveBeenCalled();
      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(response.status).toBe(401);
    });

    it("does NOT call TokenManager.refresh() a second time on the retry response — X-Tokens-Refreshed is only for /api/request", async () => {
      // The retry branch in fetchWithTokenRefresh hits the BACKEND directly.
      // The backend never sets X-Tokens-Refreshed — that header only comes from
      // the /api/request Next.js proxy. This test guards against re-introducing
      // the dead refresh() call that was removed during the code-quality audit.
      mockApiInstance.GetTokens.mockReturnValue({
        access: "old-token",
        refresh: "refresh-token",
      });
      mockTokenManagerRefresh.mockResolvedValueOnce(true);
      mockTokenManagerGetAccessToken.mockReturnValue("new-token");

      const mock401 = { ok: false, status: 401, headers: { get: () => null } };
      // Retry response simulates a backend that would theoretically echo the header
      // (it won't, but we want to prove it doesn't trigger another refresh).
      const mockRetry = {
        ok: true,
        status: 200,
        headers: { get: (h: string) => (h === "X-Tokens-Refreshed" ? "true" : null) },
        json: async () => ({ data: "ok" }),
      };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce(mock401)
        .mockResolvedValueOnce(mockRetry);

      await fetchWithTokenRefresh(
        "https://api.example.com/test",
        { method: "GET" },
        true
      );

      // refresh() is called exactly once (for the 401), not a second time.
      expect(mockTokenManagerRefresh).toHaveBeenCalledTimes(1);
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it("should return 401 response when TokenManager.refresh() fails", async () => {
      mockApiInstance.GetTokens.mockReturnValue({
        access: "old-token",
        refresh: "refresh-token",
      });

      const mock401Response = { ok: false, status: 401 };
      (global.fetch as jest.Mock).mockResolvedValueOnce(mock401Response);

      // TokenManager.refresh() fails
      mockTokenManagerRefresh.mockResolvedValueOnce(false);

      const response = await fetchWithTokenRefresh(mockUrl, mockOptions, true);

      expect(response.status).toBe(401);
    });
  });

  describe("RetrieveData with Token Refresh", () => {
    beforeEach(() => {
      process.env.NEXT_PUBLIC_API_URL = "https://api.example.com";
    });

    it("should successfully retrieve data without token refresh", async () => {
      const mockData = { result: "success" };
      const mockResponse = {
        ok: true,
        status: 200,
        json: async () => mockData,
      };
      (global.fetch as jest.Mock).mockResolvedValueOnce(mockResponse);

      const result = await RetrieveData("test/endpoint");

      expect(result).toEqual(mockData);
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it("should use stored tokens when no explicit token provided", async () => {
      mockApiInstance.GetTokens.mockReturnValue({
        access: "stored-token",
        refresh: "refresh-token",
      });
      const mockResponse = {
        ok: true,
        status: 200,
        json: async () => ({ data: "test" }),
      };
      (global.fetch as jest.Mock).mockResolvedValueOnce(mockResponse);

      await RetrieveData("test/endpoint");

      expect(global.fetch).toHaveBeenCalledWith(
        "https://api.example.com/test/endpoint",
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer stored-token",
          }),
        }),
      );
    });

    it("should use explicit token when provided", async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: async () => ({ data: "test" }),
      };
      (global.fetch as jest.Mock).mockResolvedValueOnce(mockResponse);

      await RetrieveData("test/endpoint", "explicit-token");

      expect(global.fetch).toHaveBeenCalledWith(
        "https://api.example.com/test/endpoint",
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer explicit-token",
          }),
        }),
      );
    });

    it("should return error with status: 401 enabling server-side re-try in request.ts", async () => {
      // Regression guard: request.ts checks `apiResponse?.status === 401` to
      // trigger its own server-side refresh. RetrieveData must include `status`
      // in its error return, otherwise GET requests would never be retried.
      const mockErrorData = { error: "Unauthorized" };
      const mock401 = {
        ok: false,
        status: 401,
        json: async () => mockErrorData,
      };
      (global.fetch as jest.Mock).mockResolvedValueOnce(mock401);

      const result = await RetrieveData("protected/endpoint");

      expect(result).toEqual({
        error: true,
        status: 401,
        message: mockErrorData,
      });
      // Verify the status field is present so the request.ts condition fires
      expect(result.status).toBe(401);
    });

    it("should return error object on failed request (includes status for server-side 401 detection)", async () => {
      const mockErrorData = { error: "Not found" };
      const mockResponse = {
        ok: false,
        status: 404,
        json: async () => mockErrorData,
      };
      (global.fetch as jest.Mock).mockResolvedValueOnce(mockResponse);

      const result = await RetrieveData("test/endpoint");

      // status is included so request.ts can detect 401 on the server side
      // (matches the shape that SendData also returns)
      expect(result).toEqual({
        error: true,
        status: 404,
        message: mockErrorData,
      });
    });
  });

  describe("RefreshToken", () => {
    beforeEach(() => {
      process.env.NEXT_PUBLIC_API_URL = "https://api.example.com";
    });

    it("should successfully refresh tokens", async () => {
      const mockTokenResponse = {
        access: { token: "new-access" },
        refresh: { token: "new-refresh" },
      };
      const mockResponse = {
        ok: true,
        status: 200,
        json: async () => mockTokenResponse,
      };
      (global.fetch as jest.Mock).mockResolvedValueOnce(mockResponse);

      const result = await RefreshToken("old-refresh-token");

      expect(result).toEqual(mockTokenResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        "https://api.example.com/auth/refresh-tokens",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ refreshToken: "old-refresh-token" }),
        }),
      );
    });

    it("should logout and clear tokens on 401 response", async () => {
      const mockResponse = {
        ok: false,
        status: 401,
      };
      const mockLogoutResponse = {
        ok: true,
        status: 200,
      };
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce(mockResponse)
        .mockResolvedValueOnce(mockLogoutResponse);

      const result = await RefreshToken("expired-refresh-token");

      expect(result).toBeUndefined();
      expect(mockApiInstance.ClearTokens).toHaveBeenCalled();
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/logout",
        expect.objectContaining({ method: "POST" }),
      );
    });

    it("should handle network errors gracefully", async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(
        new Error("Network error"),
      );

      const result = await RefreshToken("refresh-token");

      expect(result).toBeUndefined();
    });
  });

  describe("Request — server-side token sync (X-Tokens-Refreshed)", () => {
    beforeEach(() => {
      process.env.NEXT_PUBLIC_API_URL = "https://api.example.com";
    });

    it("calls TokenManager.refresh() when X-Tokens-Refreshed header is present", async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        headers: {
          get: (h: string) => (h === "X-Tokens-Refreshed" ? "true" : null),
        },
        json: async () => ({ data: "test" }),
      };
      (global.fetch as jest.Mock).mockResolvedValueOnce(mockResponse);
      mockTokenManagerRefresh.mockResolvedValue(true);

      await Request("some/endpoint");

      expect(mockTokenManagerRefresh).toHaveBeenCalled();
    });

    it("does NOT call TokenManager.refresh() when X-Tokens-Refreshed header is absent", async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        headers: { get: () => null },
        json: async () => ({ data: "test" }),
      };
      (global.fetch as jest.Mock).mockResolvedValueOnce(mockResponse);

      await Request("some/endpoint");

      expect(mockTokenManagerRefresh).not.toHaveBeenCalled();
    });

    it("still returns data when X-Tokens-Refreshed header is present", async () => {
      const mockData = { result: "success" };
      const mockResponse = {
        ok: true,
        status: 200,
        headers: {
          get: (h: string) => (h === "X-Tokens-Refreshed" ? "true" : null),
        },
        json: async () => mockData,
      };
      (global.fetch as jest.Mock).mockResolvedValueOnce(mockResponse);
      mockTokenManagerRefresh.mockResolvedValue(true);

      const result = await Request("some/endpoint");

      expect(result).toEqual(mockData);
    });
  });
});
