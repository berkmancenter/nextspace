/**
 * @jest-environment jsdom
 */

import { SendData, Api } from "../../utils/Helpers";
import { authenticatedFetch } from "../../utils/AuthInterceptor";

// Mock dependencies
jest.mock("../../utils/AuthInterceptor");

const mockedAuthenticatedFetch = authenticatedFetch as jest.MockedFunction<
  typeof authenticatedFetch
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

  it("calls authenticatedFetch with correct parameters", async () => {
    const mockResponse = { success: true, id: 123 };
    mockedAuthenticatedFetch.mockResolvedValue(mockResponse);

    const result = await SendData("messages", { body: "Test message" });

    expect(mockedAuthenticatedFetch).toHaveBeenCalledTimes(1);
    expect(mockedAuthenticatedFetch).toHaveBeenCalledWith(
      `${process.env.NEXT_PUBLIC_API_URL}/messages`,
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          Authorization: "Bearer access-token",
        }),
        body: JSON.stringify({ body: "Test message" }),
      })
    );
    expect(result).toEqual(mockResponse);
  });

  it("uses provided access token", async () => {
    const mockResponse = { success: true };
    mockedAuthenticatedFetch.mockResolvedValue(mockResponse);

    await SendData("messages", { body: "Test" }, "custom-token");

    expect(mockedAuthenticatedFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer custom-token",
        }),
      })
    );
  });

  it("handles successful responses", async () => {
    const mockData = { id: 1, message: "Created" };
    mockedAuthenticatedFetch.mockResolvedValue(mockData);

    const result = await SendData("messages", { body: "Test" });

    expect(result).toEqual(mockData);
  });

  it("handles network errors", async () => {
    const networkError = new Error("Network failure");
    mockedAuthenticatedFetch.mockRejectedValue(networkError);

    await expect(SendData("messages", { body: "Test" })).rejects.toThrow(
      "Network failure"
    );

    expect(console.error).toHaveBeenCalledWith(
      "There was a problem with the send operation:",
      networkError
    );
  });

  it("uses default API tokens when no custom token provided", async () => {
    const mockResponse = { success: true };
    mockedAuthenticatedFetch.mockResolvedValue(mockResponse);

    await SendData("messages", { body: "Test" });

    expect(mockedAuthenticatedFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer access-token",
        }),
      })
    );
  });

  it("includes request body in POST request", async () => {
    const mockResponse = { success: true };
    const payload = { message: "Hello", user: "John" };
    mockedAuthenticatedFetch.mockResolvedValue(mockResponse);

    await SendData("messages", payload);

    expect(mockedAuthenticatedFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify(payload),
      })
    );
  });

  it("respects custom fetch options when provided", async () => {
    const mockResponse = { success: true };
    const customOptions = {
      method: "PUT",
      headers: {
        "X-Custom-Header": "value",
      },
      body: JSON.stringify({ test: "data" }),
    };
    mockedAuthenticatedFetch.mockResolvedValue(mockResponse);

    await SendData("messages", { body: "Test" }, undefined, customOptions);

    expect(mockedAuthenticatedFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        method: "PUT",
        headers: expect.objectContaining({
          "X-Custom-Header": "value",
          Authorization: "Bearer access-token",
        }),
      })
    );
  });

  it("handles error responses from authenticatedFetch", async () => {
    const errorResponse = {
      error: true,
      status: 500,
      message: "Server error",
    };
    mockedAuthenticatedFetch.mockResolvedValue(errorResponse);

    const result = await SendData("messages", { body: "Test" });

    expect(result).toEqual(errorResponse);
  });
});
