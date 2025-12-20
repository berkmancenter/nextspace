/**
 * @jest-environment jsdom
 */

import { RetrieveData, Request } from "../../utils/Api";
import { fetchWithAutoAuth } from "../../utils/AuthInterceptor";

// Mock fetchWithAutoAuth
jest.mock("../../utils/AuthInterceptor");

const mockedFetchWithAutoAuth = fetchWithAutoAuth as jest.MockedFunction<
  typeof fetchWithAutoAuth
>;

describe("Api Functions Integration", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("RetrieveData", () => {
    const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://api.test";

    it("calls fetchWithAutoAuth with correct parameters", async () => {
      const mockData = { id: 1, name: "Test" };
      mockedFetchWithAutoAuth.mockResolvedValue(mockData);

      const result = await RetrieveData("test/endpoint", "test-token");

      expect(mockedFetchWithAutoAuth).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockData);

      // Verify the fetch call was configured correctly
      const fetchCall = mockedFetchWithAutoAuth.mock.calls[0][0];
      expect(fetchCall).toBeDefined();
    });

    it("works without token", async () => {
      const mockData = { public: true };
      mockedFetchWithAutoAuth.mockResolvedValue(mockData);

      const result = await RetrieveData("public/endpoint");

      expect(mockedFetchWithAutoAuth).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockData);
    });

    it("supports text data type", async () => {
      const mockText = "Plain text response";
      mockedFetchWithAutoAuth.mockResolvedValue(mockText);

      const result = await RetrieveData("test/endpoint", "test-token", "text");

      expect(result).toBe(mockText);
      expect(mockedFetchWithAutoAuth).toHaveBeenCalledWith(
        expect.any(Function),
        { parseAs: "text" }
      );
    });

    it("handles errors from fetchWithAutoAuth", async () => {
      const error = new Error("Network error");
      mockedFetchWithAutoAuth.mockRejectedValue(error);

      await expect(RetrieveData("test/endpoint", "test-token")).rejects.toThrow(
        "Network error"
      );
    });
  });

  describe("Request", () => {
    it("calls fetchWithAutoAuth for GET requests", async () => {
      const mockData = { success: true };
      mockedFetchWithAutoAuth.mockResolvedValue(mockData);

      const result = await Request("test/endpoint");

      expect(mockedFetchWithAutoAuth).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockData);
    });

    it("calls fetchWithAutoAuth for POST requests", async () => {
      const mockData = { success: true };
      const payload = { data: "test" };
      mockedFetchWithAutoAuth.mockResolvedValue(mockData);

      const result = await Request("test/endpoint", payload);

      expect(mockedFetchWithAutoAuth).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockData);
    });

    it("handles null/undefined responses", async () => {
      mockedFetchWithAutoAuth.mockResolvedValue(null);

      const result = await Request("test/endpoint");

      expect(result).toEqual({
        error: true,
        message: "No response received",
      });
    });
  });
});
