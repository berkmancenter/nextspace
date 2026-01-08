import { isIpInRanges, getClientIp } from "../../utils/ipRangeChecker";

describe("ipRangeChecker", () => {
  describe("IPv6 normalization", () => {
    it("normalizes IPv6 localhost (::1) to IPv4", () => {
      // Using getClientIp to test the normalization indirectly
      const result = getClientIp({}, "::1");
      expect(result).toBe("127.0.0.1");
    });

    it("normalizes IPv6-mapped IPv4 localhost", () => {
      const result = getClientIp({}, "::ffff:127.0.0.1");
      expect(result).toBe("127.0.0.1");
    });

    it("normalizes IPv6-mapped IPv4 addresses", () => {
      const result = getClientIp({}, "::ffff:192.168.1.100");
      expect(result).toBe("192.168.1.100");
    });

    it("handles regular IPv4 addresses unchanged", () => {
      const result = getClientIp({}, "192.168.1.50");
      expect(result).toBe("192.168.1.50");
    });

    it("works with IPv6 localhost in CIDR matching", () => {
      // ::1 should be normalized to 127.0.0.1 and match localhost range
      const result = isIpInRanges("::1", "127.0.0.0/8");
      expect(result).toBe(true);
    });

    it("works with IPv6-mapped addresses in CIDR matching", () => {
      const result = isIpInRanges("::ffff:192.168.1.100", "192.168.1.0/24");
      expect(result).toBe(true);
    });
  });

  describe("isIpInRanges", () => {
    describe("CIDR notation matching", () => {
      it("matches IP within /24 range", () => {
        expect(isIpInRanges("192.168.1.100", "192.168.1.0/24")).toBe(true);
      });

      it("matches IP at start of /24 range", () => {
        expect(isIpInRanges("192.168.1.0", "192.168.1.0/24")).toBe(true);
      });

      it("matches IP at end of /24 range", () => {
        expect(isIpInRanges("192.168.1.255", "192.168.1.0/24")).toBe(true);
      });

      it("rejects IP outside /24 range", () => {
        expect(isIpInRanges("192.168.2.100", "192.168.1.0/24")).toBe(false);
      });

      it("matches IP within /16 range", () => {
        expect(isIpInRanges("10.20.30.40", "10.20.0.0/16")).toBe(true);
      });

      it("rejects IP outside /16 range", () => {
        expect(isIpInRanges("10.21.30.40", "10.20.0.0/16")).toBe(false);
      });

      it("matches IP within /8 range", () => {
        expect(isIpInRanges("10.255.255.255", "10.0.0.0/8")).toBe(true);
      });

      it("rejects IP outside /8 range", () => {
        expect(isIpInRanges("11.0.0.1", "10.0.0.0/8")).toBe(false);
      });

      it("matches single IP with /32", () => {
        expect(isIpInRanges("192.168.1.100", "192.168.1.100/32")).toBe(true);
      });

      it("rejects different IP with /32", () => {
        expect(isIpInRanges("192.168.1.101", "192.168.1.100/32")).toBe(false);
      });
    });

    describe("single IP matching (without CIDR)", () => {
      it("matches exact IP", () => {
        expect(isIpInRanges("192.168.1.100", "192.168.1.100")).toBe(true);
      });

      it("rejects different IP", () => {
        expect(isIpInRanges("192.168.1.101", "192.168.1.100")).toBe(false);
      });
    });

    describe("multiple ranges", () => {
      it("matches IP in first range", () => {
        expect(
          isIpInRanges(
            "192.168.1.100",
            "192.168.1.0/24,10.0.0.0/8,172.16.0.0/12"
          )
        ).toBe(true);
      });

      it("matches IP in middle range", () => {
        expect(
          isIpInRanges(
            "10.50.100.200",
            "192.168.1.0/24,10.0.0.0/8,172.16.0.0/12"
          )
        ).toBe(true);
      });

      it("matches IP in last range", () => {
        expect(
          isIpInRanges(
            "172.16.50.100",
            "192.168.1.0/24,10.0.0.0/8,172.16.0.0/12"
          )
        ).toBe(true);
      });

      it("rejects IP not in any range", () => {
        expect(
          isIpInRanges("8.8.8.8", "192.168.1.0/24,10.0.0.0/8,172.16.0.0/12")
        ).toBe(false);
      });

      it("handles ranges with spaces", () => {
        expect(
          isIpInRanges("192.168.1.100", "192.168.1.0/24, 10.0.0.0/8")
        ).toBe(true);
      });

      it("accepts array of ranges", () => {
        expect(
          isIpInRanges("192.168.1.100", ["192.168.1.0/24", "10.0.0.0/8"])
        ).toBe(true);
      });
    });

    describe("edge cases and error handling", () => {
      it("returns false for null IP", () => {
        expect(isIpInRanges(null as any, "192.168.1.0/24")).toBe(false);
      });

      it("returns false for undefined IP", () => {
        expect(isIpInRanges(undefined as any, "192.168.1.0/24")).toBe(false);
      });

      it("returns false for empty IP", () => {
        expect(isIpInRanges("", "192.168.1.0/24")).toBe(false);
      });

      it("returns false for null ranges", () => {
        expect(isIpInRanges("192.168.1.100", null as any)).toBe(false);
      });

      it("returns false for undefined ranges", () => {
        expect(isIpInRanges("192.168.1.100", undefined)).toBe(false);
      });

      it("returns false for empty ranges", () => {
        expect(isIpInRanges("192.168.1.100", "")).toBe(false);
      });

      it("returns false for empty range array", () => {
        expect(isIpInRanges("192.168.1.100", [])).toBe(false);
      });

      it("handles invalid CIDR notation gracefully", () => {
        expect(isIpInRanges("192.168.1.100", "192.168.1.0/abc")).toBe(false);
      });

      it("handles invalid IP address gracefully", () => {
        expect(isIpInRanges("not.an.ip.address", "192.168.1.0/24")).toBe(false);
      });

      it("handles invalid prefix length gracefully", () => {
        expect(isIpInRanges("192.168.1.100", "192.168.1.0/33")).toBe(false);
      });

      it("handles negative prefix length gracefully", () => {
        expect(isIpInRanges("192.168.1.100", "192.168.1.0/-1")).toBe(false);
      });
    });
  });

  describe("getClientIp", () => {
    describe("header priority", () => {
      it("prioritizes x-real-ip over others", () => {
        const headers = {
          "x-real-ip": "1.1.1.1",
          "x-forwarded-for": "2.2.2.2, 3.3.3.3",
        };
        expect(getClientIp(headers, "4.4.4.4")).toBe("1.1.1.1");
      });

      it("uses x-forwarded-for if x-real-ip not present", () => {
        const headers = {
          "x-forwarded-for": "2.2.2.2, 3.3.3.3",
        };
        expect(getClientIp(headers, "4.4.4.4")).toBe("2.2.2.2");
      });

      it("uses first IP from x-forwarded-for chain", () => {
        const headers = {
          "x-forwarded-for": "2.2.2.2, 3.3.3.3, 4.4.4.4",
        };
        expect(getClientIp(headers)).toBe("2.2.2.2");
      });

      it("uses remoteAddress as fallback", () => {
        const headers = {};
        expect(getClientIp(headers, "4.4.4.4")).toBe("4.4.4.4");
      });

      it("returns null if no IP available", () => {
        const headers = {};
        expect(getClientIp(headers)).toBe(null);
      });
    });

    describe("IPv6 handling", () => {
      it("strips IPv6 prefix from remoteAddress", () => {
        const headers = {};
        expect(getClientIp(headers, "::ffff:192.168.1.1")).toBe("192.168.1.1");
      });

      it("handles IPv6 in x-real-ip", () => {
        const headers = {
          "x-real-ip": "2001:0db8:85a3:0000:0000:8a2e:0370:7334",
        };
        expect(getClientIp(headers)).toBe(
          "2001:0db8:85a3:0000:0000:8a2e:0370:7334"
        );
      });
    });

    describe("header formats", () => {
      it("handles x-forwarded-for as array", () => {
        const headers = {
          "x-forwarded-for": ["2.2.2.2", "3.3.3.3"],
        };
        expect(getClientIp(headers)).toBe("2.2.2.2");
      });

      it("trims whitespace from IPs", () => {
        const headers = {
          "x-forwarded-for": " 2.2.2.2 , 3.3.3.3 ",
        };
        expect(getClientIp(headers)).toBe("2.2.2.2");
      });

      it("handles x-real-ip with whitespace", () => {
        const headers = {
          "x-real-ip": "  1.1.1.1  ",
        };
        expect(getClientIp(headers)).toBe("1.1.1.1");
      });
    });

    describe("edge cases", () => {
      it("returns null for empty headers", () => {
        expect(getClientIp({})).toBe(null);
      });

      it("handles undefined x-forwarded-for", () => {
        const headers = {
          "x-forwarded-for": undefined,
        };
        expect(getClientIp(headers)).toBe(null);
      });

      it("handles empty x-forwarded-for", () => {
        const headers = {
          "x-forwarded-for": "",
        };
        expect(getClientIp(headers)).toBe(null);
      });
    });
  });
});
