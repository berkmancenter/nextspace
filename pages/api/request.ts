import type { NextApiRequest, NextApiResponse } from "next";
import decryptCookie from "../../utils/Decrypt";
import { RetrieveData, SendData } from "../../utils";

/**
 * API Route to handle requests with authentication
 * @param req - NextApiRequest object
 * @param res - NextApiResponse object
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  let apiResponse;
  const token = req.cookies["nextspace-session"] || null;

  if (!token) {
    return res.status(401).json({ error: "No token found" });
  }
  const cookie = await decryptCookie(token);

  if (!cookie) {
    return res.status(401).json({ error: "Invalid token" });
  }

  // Ensure the decrypted cookie has access token
  if (!cookie.payload?.access) {
    return res.status(401).json({ error: "Not logged in" });
  }

  // Determine if GET or POST request
  if (req.method !== "POST")
    apiResponse = await RetrieveData(
      req.query.apiEndpoint as string,
      cookie.payload.access
    );
  else {
    apiResponse = await SendData(
      req.body.apiEndpoint,
      req.body.payload,
      cookie.payload.access
    );
  }

  // If 401, return unauthorized
  if (apiResponse?.status === 401) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (!apiResponse)
    return res
      .status(500)
      .json({ error: `Failed to retrieve data from API: ${apiResponse}` });

  return res.status(200).json(apiResponse);
}
