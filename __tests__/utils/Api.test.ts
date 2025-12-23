/**
 * @jest-environment jsdom
 */

import { RetrieveData, Request } from "../../utils/Api";
import { authenticatedFetch } from "../../utils/AuthInterceptor";

// Mock authenticatedFetch
jest.mock("../../utils/AuthInterceptor");

const mockedAuthenticatedFetch = authenticatedFetch as jest.MockedFunction<
  typeof authenticatedFetch
>;

describe("Api Functions Integration", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("RetrieveData", () => {
    const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://api.test";

    it("calls authenticatedFetch with correct parameters", async () => {
      const mockData = { id: 1, name: "Test" };
      mockedAuthenticatedFetch.mockResolvedValue(mockData);

      const result = await RetrieveData("test/endpoint", "test-token");

      expect(mockedAuthenticatedFetch).toHaveBeenCalledTimes(1);
      expect(mockedAuthenticatedFetch).toHaveBeenCalledWith(
        `${API_URL}/test/endpoint`,
        {
          method: "GET",
          headers: { Authorization: "Bearer test-token" },
        },
        { parseAs: undefined }
      );
      expect(result).toEqual(mockData);
    });

    it("works without token", async () => {
      const mockData = { public: true };
      mockedAuthenticatedFetch.mockResolvedValue(mockData);

      const result = await RetrieveData("public/endpoint");

      expect(mockedAuthenticatedFetch).toHaveBeenCalledTimes(1);
      expect(mockedAuthenticatedFetch).toHaveBeenCalledWith(
        expect.stringContaining("public/endpoint"),
        {
          method: "GET",
          headers: {},
        },
        { parseAs: undefined }
      );
      expect(result).toEqual(mockData);
    });

    it("supports text data type", async () => {
      const mockText = "Plain text response";
      mockedAuthenticatedFetch.mockResolvedValue(mockText);

      const result = await RetrieveData("test/endpoint", "test-token", "text");

      expect(result).toBe(mockText);
      expect(mockedAuthenticatedFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        { parseAs: "text" }
      );
    });

    it("handles errors from authenticatedFetch", async () => {
      const error = new Error("Network error");
      mockedAuthenticatedFetch.mockRejectedValue(error);

      await expect(RetrieveData("test/endpoint", "test-token")).rejects.toThrow(
        "Network error"
      );
    });
  });

  describe("Request", () => {
    it("calls authenticatedFetch for GET requests", async () => {
      const mockData = { success: true };
      mockedAuthenticatedFetch.mockResolvedValue(mockData);

      const result = await Request("test/endpoint");

      expect(mockedAuthenticatedFetch).toHaveBeenCalledTimes(1);
      expect(mockedAuthenticatedFetch).toHaveBeenCalledWith(
        "/api/request?apiEndpoint=test%2Fendpoint",
        { method: "GET" }
      );
      expect(result).toEqual(mockData);
    });

    it("calls authenticatedFetch for POST requests", async () => {
      const mockData = { success: true };
      const payload = { data: "test" };
      mockedAuthenticatedFetch.mockResolvedValue(mockData);

      const result = await Request("test/endpoint", payload);

      expect(mockedAuthenticatedFetch).toHaveBeenCalledTimes(1);
      expect(mockedAuthenticatedFetch).toHaveBeenCalledWith("/api/request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          apiEndpoint: "test/endpoint",
          payload,
        }),
      });
      expect(result).toEqual(mockData);
    });

    it("handles null/undefined responses", async () => {
      mockedAuthenticatedFetch.mockResolvedValue(null);

      const result = await Request("test/endpoint");

      expect(result).toEqual({
        error: true,
        message: "No response received",
      });
    });

    it("handles error responses", async () => {
      const errorResponse = {
        error: true,
        status: 500,
        message: "Server error",
      };
      mockedAuthenticatedFetch.mockResolvedValue(errorResponse);

      const result = await Request("test/endpoint");

      expect(result).toEqual(errorResponse);
    });
  });
});
