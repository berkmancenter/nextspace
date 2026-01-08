/**
 * IP Range Checker Utility
 *
 * Provides functions to check if an IP address is within specified ranges.
 * Supports CIDR notation (e.g., 192.168.1.0/24)
 */

/**
 * Converts an IP address string to a 32-bit integer
 * @param ip - IP address string (e.g., "192.168.1.1")
 * @returns 32-bit integer representation
 */
function ipToInt(ip: string): number {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) {
    throw new Error(`Invalid IP address: ${ip}`);
  }
  return (
    ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0
  );
}

/**
 * Checks if an IP address is within a CIDR range
 * @param ip - IP address to check
 * @param cidr - CIDR notation (e.g., "192.168.1.0/24")
 * @returns true if IP is in range, false otherwise
 */
function isIpInCidr(ip: string, cidr: string): boolean {
  try {
    const [range, prefixLengthStr] = cidr.split("/");
    const prefixLength = parseInt(prefixLengthStr, 10);

    if (isNaN(prefixLength) || prefixLength < 0 || prefixLength > 32) {
      console.warn(`[IP Range] Invalid CIDR prefix length: ${cidr}`);
      return false;
    }

    const ipInt = ipToInt(ip);
    const rangeInt = ipToInt(range);
    const mask = (0xffffffff << (32 - prefixLength)) >>> 0;

    return (ipInt & mask) === (rangeInt & mask);
  } catch (error) {
    console.warn(`[IP Range] Error checking CIDR ${cidr}:`, error);
    return false;
  }
}

/**
 * Checks if an IP address matches any of the provided ranges
 * @param ip - IP address to check
 * @param ranges - Array of CIDR ranges or comma-separated string
 * @returns true if IP matches any range, false otherwise
 */
export function isIpInRanges(
  ip: string,
  ranges: string[] | string | undefined
): boolean {
  if (!ip || !ranges) {
    return false;
  }

  // Convert string to array if needed
  const rangeArray = Array.isArray(ranges)
    ? ranges
    : ranges.split(",").map((r) => r.trim());

  if (rangeArray.length === 0) {
    return false;
  }

  // Check if IP matches any range
  return rangeArray.some((range) => {
    if (!range) return false;

    // Support both CIDR notation and single IPs
    if (!range.includes("/")) {
      // Single IP - add /32 to make it a valid CIDR
      range = `${range}/32`;
    }

    return isIpInCidr(ip, range);
  });
}

/**
 * Extracts the client IP from various request headers
 * Handles common proxy headers while prioritizing most reliable sources
 * @param headers - Request headers object
 * @param remoteAddress - Socket remote address fallback
 * @returns Client IP address or null if not found
 */
export function getClientIp(
  headers: Record<string, string | string[] | undefined>,
  remoteAddress?: string
): string | null {
  // Priority order for IP extraction:
  // 1. x-real-ip (most reliable for single proxies)
  // 2. x-forwarded-for (first IP in the chain)
  // 3. socket remoteAddress (direct connection)

  const xRealIp = headers["x-real-ip"];
  if (xRealIp && typeof xRealIp === "string") {
    return xRealIp.trim();
  }

  const xForwardedFor = headers["x-forwarded-for"];
  if (xForwardedFor) {
    const forwardedIp =
      typeof xForwardedFor === "string" ? xForwardedFor : xForwardedFor[0];
    const firstIp = forwardedIp?.split(",")[0]?.trim();
    if (firstIp) {
      return firstIp;
    }
  }

  if (remoteAddress) {
    // Remove IPv6 prefix if present (::ffff:192.168.1.1 -> 192.168.1.1)
    return remoteAddress.replace("::ffff:", "");
  }

  return null;
}
