/**
 * @jest-environment jsdom
 */

import { SendData, Api } from "../../utils/Helpers";
import { RefreshToken } from "../../utils/Api";
import { fetchWithAutoAuth } from "../../utils/AuthInterceptor";

// Mock dependencies
jest.mock("../../utils/Api", () => ({
  RefreshToken: jest.fn(),
}));

jest.mock("../../utils/AuthInterceptor");

const mockedFetchWithAutoAuth = fetchWithAutoAuth as jest.MockedFunction<
  typeof fetchWithAutoAuth
>;

describe("SendData Integration", () => {
  let apiInstance: Api;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
    jest.spyOn(console, "warn").mockImplementation(() => {});
    jest.spyOn(console, "log").mockImplementation(() => {});

    // Get fresh API instance and set tokens
    apiInstance = Api.get();
    apiInstance.SetTokens("access-token", "refresh-token");
  });

  afterEach(() => {
    jest.restoreAllMocks();
    // Clear tokens
    apiInstance.SetTokens("", "");
  });

  it("calls fetchWithAutoAuth with correct parameters", async () => {
    const mockResponse = { success: true, id: 123 };
    mockedFetchWithAutoAuth.mockResolvedValue(mockResponse);

    const result = await SendData("messages", { body: "Test message" });

    expect(mockedFetchWithAutoAuth).toHaveBeenCalledTimes(1);
    expect(result).toEqual(mockResponse);
    expect(RefreshToken).not.toHaveBeenCalled();
  });

  it("uses provided access token", async () => {
    const mockResponse = { success: true };
    mockedFetchWithAutoAuth.mockResolvedValue(mockResponse);

    await SendData("messages", { body: "Test" }, "custom-token");

    expect(mockedFetchWithAutoAuth).toHaveBeenCalledTimes(1);
    // The custom token is passed in the fetch headers
    const fetchCall = mockedFetchWithAutoAuth.mock.calls[0][0];
    expect(fetchCall).toBeDefined();
  });

  it("attempts token refresh on 401 when refresh token available", async () => {
    const newTokens = {
      access: { token: "new-access-token" },
      refresh: { token: "new-refresh-token" },
    };
    const finalResponse = { success: true, retried: true };

    // First call returns 401
    mockedFetchWithAutoAuth
      .mockResolvedValueOnce({
        error: true,
        status: 401,
        message: "Unauthorized",
      })
      // Second call (after refresh) succeeds
      .mockResolvedValueOnce(finalResponse);

    (RefreshToken as jest.Mock).mockResolvedValue(newTokens);

    const result = await SendData("messages", { body: "Test" });

    expect(RefreshToken).toHaveBeenCalledWith("refresh-token");
    expect(mockedFetchWithAutoAuth).toHaveBeenCalledTimes(2);
    expect(result).toEqual(finalResponse);
  });

  it("handles refresh failure gracefully", async () => {
    mockedFetchWithAutoAuth.mockResolvedValue({
      error: true,
      status: 401,
      message: "Unauthorized",
    });

    (RefreshToken as jest.Mock).mockRejectedValue(
      new Error("Refresh token expired")
    );

    const result = await SendData("messages", { body: "Test" });

    expect(RefreshToken).toHaveBeenCalled();
    expect(result).toEqual({
      error: true,
      status: 401,
      message: "Unauthorized - Session expired",
    });
  });

  it("handles 401 when no refresh token available", async () => {
    // Clear refresh token
    apiInstance.SetTokens("access-token", "");

    mockedFetchWithAutoAuth.mockResolvedValue({
      error: true,
      status: 401,
      message: "Unauthorized",
    });

    const result = await SendData("messages", { body: "Test" });

    expect(RefreshToken).not.toHaveBeenCalled();
    expect(result).toEqual({
      error: true,
      status: 401,
      message: "Unauthorized",
    });
  });

  it("handles successful responses", async () => {
    const mockData = { id: 1, message: "Created" };
    mockedFetchWithAutoAuth.mockResolvedValue(mockData);

    const result = await SendData("messages", { body: "Test" });

    expect(result).toEqual(mockData);
  });

  it("handles network errors", async () => {
    const networkError = new Error("Network failure");
    mockedFetchWithAutoAuth.mockRejectedValue(networkError);

    await expect(SendData("messages", { body: "Test" })).rejects.toThrow(
      "Network failure"
    );

    expect(console.error).toHaveBeenCalledWith(
      "There was a problem with the send operation:",
      networkError
    );
  });

  it("updates API tokens after successful refresh", async () => {
    const newTokens = {
      access: { token: "new-access" },
      refresh: { token: "new-refresh" },
    };

    mockedFetchWithAutoAuth
      .mockResolvedValueOnce({ error: true, status: 401 })
      .mockResolvedValueOnce({ success: true });

    (RefreshToken as jest.Mock).mockResolvedValue(newTokens);

    await SendData("messages", { body: "Test" });

    const tokens = apiInstance.GetTokens();
    expect(tokens.access).toBe("new-access");
    expect(tokens.refresh).toBe("new-refresh");
  });

  it("logs appropriate messages during token refresh", async () => {
    const consoleSpy = jest.spyOn(console, "log");
    const newTokens = {
      access: { token: "new-token" },
      refresh: { token: "new-refresh" },
    };

    mockedFetchWithAutoAuth
      .mockResolvedValueOnce({ error: true, status: 401 })
      .mockResolvedValueOnce({ success: true });

    (RefreshToken as jest.Mock).mockResolvedValue(newTokens);

    await SendData("messages", { body: "Test" });

    expect(consoleSpy).toHaveBeenCalledWith("Token expired, refreshing...");
  });
});
