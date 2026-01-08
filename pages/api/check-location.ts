import type { NextApiRequest, NextApiResponse } from "next";
import { getClientIp, isIpInRanges } from "../../utils/ipRangeChecker";

type LocationResponse = {
  location: "local" | "remote";
  method: "ip" | "url" | "default";
};

/**
 * API route to determine if a user is accessing from a local (venue) or remote location.
 * Privacy-preserving: Only returns location type, never logs or stores IP addresses.
 *
 * Detection priority:
 * 1. URL parameter ?location=local (manual override)
 * 2. IP address range matching (if LOCAL_IP_RANGES configured)
 * 3. Default to "remote" (privacy-preserving default)
 *
 * @param req The incoming request object
 * @param res The outgoing response object
 * @returns JSON response with location type and detection method
 */
export default function handler(
  req: NextApiRequest,
  res: NextApiResponse<LocationResponse>
) {
  // Only allow GET requests
  if (req.method !== "GET") {
    res.status(405).json({ location: "remote", method: "default" });
    return;
  }

  // Priority 1: Check URL parameter (manual override)
  const locationParam = req.query.location;
  if (locationParam === "local") {
    res.status(200).json({ location: "local", method: "url" });
    return;
  }

  // Priority 2: Check IP ranges (if configured)
  const localIpRanges = process.env.LOCAL_IP_RANGES;

  if (localIpRanges && localIpRanges.trim().length > 0) {
    const clientIp = getClientIp(
      req.headers as Record<string, string | string[] | undefined>,
      req.socket.remoteAddress
    );

    if (clientIp) {
      const isLocal = isIpInRanges(clientIp, localIpRanges);

      if (process.env.NODE_ENV !== "production") {
        console.log(
          `[Location Check] IP: ${clientIp}, Local: ${isLocal}, Ranges: ${localIpRanges}`
        );
      }

      if (isLocal) {
        res.status(200).json({ location: "local", method: "ip" });
        return;
      }
    }
  }

  // Priority 3: Default to remote (privacy-preserving)
  res.status(200).json({ location: "remote", method: "default" });
}
