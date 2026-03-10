import {
  fetchWithTokenRefresh,
  RefreshToken,
  RetrieveData,
} from "../../utils/Api";
import { Api } from "../../utils/Helpers";

// Mock Api
const mockGetTokens = jest.fn(() => ({
  access: "mock-access",
  refresh: "mock-refresh",
}));

const mockApiInstance = {
  SetTokens: jest.fn(),
  GetTokens: mockGetTokens,
  getAccessToken: jest.fn((): string => mockGetTokens().access ?? ""),
  ClearTokens: jest.fn(),
  ClearAdminTokens: jest.fn(),
};

jest.mock("../../utils/Helpers", () => ({
  Api: {
    get: jest.fn(() => mockApiInstance),
  },
}));

// Mock fetch
global.fetch = jest.fn();

describe("Token Refresh Functionality", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockClear();
    mockApiInstance.SetTokens.mockClear();
    mockApiInstance.GetTokens.mockClear();
    mockApiInstance.ClearTokens.mockClear();
    mockApiInstance.ClearAdminTokens.mockClear();
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

    it("should refresh token and retry on 401 response", async () => {
      mockApiInstance.GetTokens.mockReturnValue({
        access: "old-token",
        refresh: "refresh-token",
      });

      // First request returns 401
      const mock401Response = { ok: false, status: 401 };
      // Second request after refresh succeeds
      const mockSuccessResponse = {
        ok: true,
        status: 200,
        json: async () => ({ data: "success" }),
      };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce(mock401Response) // Initial request
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            access: { token: "new-access-token" },
            refresh: { token: "new-refresh-token" },
          }),
        }) // RefreshToken call
        .mockResolvedValueOnce({ ok: true, status: 200 }) // PATCH /api/session
        .mockResolvedValueOnce(mockSuccessResponse); // Retry request

      const response = await fetchWithTokenRefresh(mockUrl, mockOptions, true);

      expect(global.fetch).toHaveBeenCalledTimes(4);
      expect(mockApiInstance.SetTokens).toHaveBeenCalledWith(
        "new-access-token",
        "new-refresh-token",
      );
      expect(response.ok).toBe(true);
    });

    it("should update session cookie after token refresh", async () => {
      mockApiInstance.GetTokens.mockReturnValue({
        access: "old-token",
        refresh: "refresh-token",
      });

      const mock401Response = { ok: false, status: 401 };
      const mockSuccessResponse = { ok: true, status: 200 };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce(mock401Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            access: { token: "new-access" },
            refresh: { token: "new-refresh" },
          }),
        })
        .mockResolvedValueOnce(mockSuccessResponse) // PATCH /api/session
        .mockResolvedValueOnce(mockSuccessResponse); // Retry

      await fetchWithTokenRefresh(mockUrl, mockOptions, true);

      // Check that PATCH /api/session was called
      const sessionUpdateCall = (global.fetch as jest.Mock).mock.calls.find(
        (call) => call[0] === "/api/session",
      );
      expect(sessionUpdateCall).toBeDefined();
      expect(sessionUpdateCall[1].method).toBe("PATCH");
      expect(JSON.parse(sessionUpdateCall[1].body)).toEqual({
        accessToken: "new-access",
        refreshToken: "new-refresh",
      });
    });

    it("should not attempt refresh if no refresh token available", async () => {
      mockApiInstance.GetTokens.mockReturnValue({
        access: "token",
        refresh: "",
      });

      const mock401Response = { ok: false, status: 401 };
      (global.fetch as jest.Mock).mockResolvedValueOnce(mock401Response);

      const response = await fetchWithTokenRefresh(mockUrl, mockOptions, true);

      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(response.status).toBe(401);
    });

    it("should handle failed token refresh gracefully", async () => {
      mockApiInstance.GetTokens.mockReturnValue({
        access: "old-token",
        refresh: "refresh-token",
      });

      const mock401Response = { ok: false, status: 401 };
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce(mock401Response)
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
        }); // RefreshToken fails

      const response = await fetchWithTokenRefresh(mockUrl, mockOptions, true);

      expect(response.status).toBe(401);
      expect(mockApiInstance.SetTokens).not.toHaveBeenCalled();
    });

    it("should deduplicate concurrent 401 refresh calls — only one refresh request sent", async () => {
      mockApiInstance.GetTokens.mockReturnValue({
        access: "old-token",
        refresh: "refresh-token",
      });

      // Track how many times the refresh-tokens endpoint is hit
      let refreshCallCount = 0;

      (global.fetch as jest.Mock).mockImplementation((url: string) => {
        if (
          typeof url === "string" &&
          url.includes("/auth/refresh-tokens")
        ) {
          refreshCallCount++;
          // Delay the refresh response so concurrent callers all reach the
          // deduplication gate before the promise settles.
          return new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  ok: true,
                  status: 200,
                  json: async () => ({
                    access: { token: "new-access-token" },
                    refresh: { token: "new-refresh-token" },
                  }),
                }),
              30,
            ),
          );
        }
        if (url === "/api/session") {
          return Promise.resolve({ ok: true, status: 200 });
        }
        // All other URLs (the actual API calls) return 401 on first round,
        // then 200 after the token is refreshed.
        return Promise.resolve({
          ok: false,
          status: 401,
        });
      });

      // After refresh, retries should succeed
      mockApiInstance.getAccessToken.mockReturnValue("new-access-token");

      // Patch fetch so the *retry* requests (with new token) return 200
      const originalImpl = (global.fetch as jest.Mock).getMockImplementation();
      (global.fetch as jest.Mock).mockImplementation(
        (url: string, options?: RequestInit) => {
          const authHeader =
            options?.headers instanceof Headers
              ? options.headers.get("Authorization")
              : (options?.headers as Record<string, string>)?.["Authorization"];

          // Retry requests carry the new token — return success
          if (authHeader === "Bearer new-access-token") {
            return Promise.resolve({ ok: true, status: 200 });
          }
          return originalImpl!(url, options);
        },
      );

      // Fire three concurrent fetchWithTokenRefresh calls
      const [r1, r2, r3] = await Promise.all([
        fetchWithTokenRefresh(mockUrl, mockOptions, true),
        fetchWithTokenRefresh(mockUrl, mockOptions, true),
        fetchWithTokenRefresh(mockUrl, mockOptions, true),
      ]);

      // All three calls should ultimately succeed
      expect(r1.status).toBe(200);
      expect(r2.status).toBe(200);
      expect(r3.status).toBe(200);

      // The critical assertion: only ONE refresh-tokens HTTP call was made
      expect(refreshCallCount).toBe(1);

      // Tokens should have been updated exactly once
      expect(mockApiInstance.SetTokens).toHaveBeenCalledTimes(1);
      expect(mockApiInstance.SetTokens).toHaveBeenCalledWith(
        "new-access-token",
        "new-refresh-token",
      );
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

    it("should return error object on failed request", async () => {
      const mockErrorData = { error: "Not found" };
      const mockResponse = {
        ok: false,
        status: 404,
        json: async () => mockErrorData,
      };
      (global.fetch as jest.Mock).mockResolvedValueOnce(mockResponse);

      const result = await RetrieveData("test/endpoint");

      expect(result).toEqual({
        error: true,
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
      expect(mockApiInstance.ClearAdminTokens).toHaveBeenCalled();
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
});
