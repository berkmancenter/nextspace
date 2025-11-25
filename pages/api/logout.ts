import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  // Clear the session cookie by setting it with an expired date
  res.setHeader(
    "Set-Cookie",
    `nextspace-session=; HttpOnly; ${
      process.env.NODE_ENV === "production" ? "Secure; " : ""
    }SameSite=Strict; Max-Age=0; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT`
  );

  res.status(200).json({ message: "Successfully logged out!" });
}
