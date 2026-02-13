/**
 * Proxy API route for Matomo requests
 */

import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { params } = req.body;

  if (!params) {
    return res.status(400).json({ error: "Missing params" });
  }

  // Get Matomo configuration from environment variables (server-side only)
  const matomoUrl = process.env.MATOMO_API_URL;
  const matomoAuthToken = process.env.MATOMO_AUTH_TOKEN;

  if (!matomoUrl || !matomoAuthToken) {
    return res.status(500).json({
      error: "Matomo configuration not found",
      message: "MATOMO_API_URL and MATOMO_AUTH_TOKEN must be set",
    });
  }

  // Add auth token to params
  const urlParams = new URLSearchParams(params);
  urlParams.set("token_auth", matomoAuthToken);

  try {
    const response = await fetch(`${matomoUrl}/index.php`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: urlParams.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `Matomo proxy request failed with status ${response.status}: ${errorText}`,
      );
      return res.status(response.status).json({
        error: "Matomo request failed",
        status: response.status,
        message: errorText,
      });
    }

    const data = await response.json();
    return res.status(200).json(data);
  } catch (error: any) {
    console.error("Matomo proxy error:", error);
    return res.status(500).json({
      error: "Internal server error",
      message: error.message,
    });
  }
}
