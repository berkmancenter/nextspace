import { createMocks } from "node-mocks-http";
import type { NextApiRequest, NextApiResponse } from "next";
import handler from "../../pages/api/check-location";

// Mock the ipRangeChecker module
jest.mock("../../utils/ipRangeChecker", () => ({
  getClientIp: jest.fn(),
  isIpInRanges: jest.fn(),
}));

import { getClientIp, isIpInRanges } from "../../utils/ipRangeChecker";

describe("/api/check-location", () => {
  const mockGetClientIp = getClientIp as jest.MockedFunction<
    typeof getClientIp
  >;
  const mockIsIpInRanges = isIpInRanges as jest.MockedFunction<
    typeof isIpInRanges
  >;

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset environment variable
    delete process.env.LOCAL_IP_RANGES;
  });

  describe("HTTP method validation", () => {
    it("accepts GET requests", () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: "GET",
      });

      handler(req, res);

      expect(res._getStatusCode()).toBe(200);
    });

    it("rejects POST requests with 405", () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: "POST",
      });

      handler(req, res);

      expect(res._getStatusCode()).toBe(405);
      expect(res._getJSONData()).toEqual({
        location: "remote",
        method: "default",
      });
    });

    it("rejects PUT requests with 405", () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: "PUT",
      });

      handler(req, res);

      expect(res._getStatusCode()).toBe(405);
    });

    it("rejects DELETE requests with 405", () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: "DELETE",
      });

      handler(req, res);

      expect(res._getStatusCode()).toBe(405);
    });
  });

  describe("URL parameter detection (highest priority)", () => {
    it("returns local when ?location=local", () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: "GET",
        query: { location: "local" },
      });

      handler(req, res);

      expect(res._getStatusCode()).toBe(200);
      expect(res._getJSONData()).toEqual({
        location: "local",
        method: "url",
      });
      // Should not check IP when URL param is present
      expect(mockGetClientIp).not.toHaveBeenCalled();
    });

    it("ignores other location parameter values", () => {
      process.env.LOCAL_IP_RANGES = "192.168.1.0/24";
      mockGetClientIp.mockReturnValue("192.168.1.100");
      mockIsIpInRanges.mockReturnValue(true);

      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: "GET",
        query: { location: "remote" },
      });

      handler(req, res);

      // Should fall through to IP detection
      expect(mockGetClientIp).toHaveBeenCalled();
    });
  });

  describe("IP range detection (second priority)", () => {
    it("returns local when IP matches configured range", () => {
      process.env.LOCAL_IP_RANGES = "192.168.1.0/24";
      mockGetClientIp.mockReturnValue("192.168.1.100");
      mockIsIpInRanges.mockReturnValue(true);

      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: "GET",
      });

      handler(req, res);

      expect(res._getStatusCode()).toBe(200);
      expect(res._getJSONData()).toEqual({
        location: "local",
        method: "ip",
      });
      expect(mockGetClientIp).toHaveBeenCalled();
      expect(mockIsIpInRanges).toHaveBeenCalledWith(
        "192.168.1.100",
        "192.168.1.0/24"
      );
    });

    it("returns remote when IP does not match range", () => {
      process.env.LOCAL_IP_RANGES = "192.168.1.0/24";
      mockGetClientIp.mockReturnValue("10.0.0.1");
      mockIsIpInRanges.mockReturnValue(false);

      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: "GET",
      });

      handler(req, res);

      expect(res._getStatusCode()).toBe(200);
      expect(res._getJSONData()).toEqual({
        location: "remote",
        method: "default",
      });
    });

    it("passes headers and remoteAddress to getClientIp", () => {
      process.env.LOCAL_IP_RANGES = "192.168.1.0/24";
      mockGetClientIp.mockReturnValue("192.168.1.100");
      mockIsIpInRanges.mockReturnValue(true);

      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: "GET",
        headers: {
          "x-real-ip": "192.168.1.100",
        },
      });
      req.socket.remoteAddress = "192.168.1.100";

      handler(req, res);

      expect(mockGetClientIp).toHaveBeenCalledWith(
        expect.objectContaining({
          "x-real-ip": "192.168.1.100",
        }),
        "192.168.1.100"
      );
    });

    it("handles multiple IP ranges", () => {
      process.env.LOCAL_IP_RANGES = "192.168.1.0/24,10.0.0.0/8";
      mockGetClientIp.mockReturnValue("10.50.100.200");
      mockIsIpInRanges.mockReturnValue(true);

      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: "GET",
      });

      handler(req, res);

      expect(res._getJSONData()).toEqual({
        location: "local",
        method: "ip",
      });
      expect(mockIsIpInRanges).toHaveBeenCalledWith(
        "10.50.100.200",
        "192.168.1.0/24,10.0.0.0/8"
      );
    });
  });

  describe("default behavior (lowest priority)", () => {
    it("returns remote when no LOCAL_IP_RANGES configured", () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: "GET",
      });

      handler(req, res);

      expect(res._getStatusCode()).toBe(200);
      expect(res._getJSONData()).toEqual({
        location: "remote",
        method: "default",
      });
      expect(mockGetClientIp).not.toHaveBeenCalled();
    });

    it("returns remote when LOCAL_IP_RANGES is empty string", () => {
      process.env.LOCAL_IP_RANGES = "";

      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: "GET",
      });

      handler(req, res);

      expect(res._getJSONData()).toEqual({
        location: "remote",
        method: "default",
      });
    });

    it("returns remote when LOCAL_IP_RANGES is whitespace only", () => {
      process.env.LOCAL_IP_RANGES = "   ";

      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: "GET",
      });

      handler(req, res);

      expect(res._getJSONData()).toEqual({
        location: "remote",
        method: "default",
      });
    });

    it("returns remote when getClientIp returns null", () => {
      process.env.LOCAL_IP_RANGES = "192.168.1.0/24";
      mockGetClientIp.mockReturnValue(null);

      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: "GET",
      });

      handler(req, res);

      expect(res._getJSONData()).toEqual({
        location: "remote",
        method: "default",
      });
    });
  });

  describe("response format", () => {
    it("returns correct JSON structure", () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: "GET",
      });

      handler(req, res);

      const data = res._getJSONData();
      expect(data).toHaveProperty("location");
      expect(data).toHaveProperty("method");
      expect(["local", "remote"]).toContain(data.location);
      expect(["ip", "url", "default"]).toContain(data.method);
    });
  });

  describe("detection priority order", () => {
    it("URL parameter overrides IP detection", () => {
      // Even if IP would match, URL param takes priority
      process.env.LOCAL_IP_RANGES = "192.168.1.0/24";
      mockGetClientIp.mockReturnValue("192.168.1.100");
      mockIsIpInRanges.mockReturnValue(true);

      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: "GET",
        query: { location: "local" },
      });

      handler(req, res);

      expect(res._getJSONData()).toEqual({
        location: "local",
        method: "url",
      });
      // Should not even check IP
      expect(mockGetClientIp).not.toHaveBeenCalled();
    });

    it("IP detection used when no URL parameter", () => {
      process.env.LOCAL_IP_RANGES = "192.168.1.0/24";
      mockGetClientIp.mockReturnValue("192.168.1.100");
      mockIsIpInRanges.mockReturnValue(true);

      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: "GET",
        query: {},
      });

      handler(req, res);

      expect(res._getJSONData()).toEqual({
        location: "local",
        method: "ip",
      });
      expect(mockGetClientIp).toHaveBeenCalled();
    });

    it("defaults to remote when no URL param and no IP ranges", () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: "GET",
        query: {},
      });

      handler(req, res);

      expect(res._getJSONData()).toEqual({
        location: "remote",
        method: "default",
      });
    });
  });
});
