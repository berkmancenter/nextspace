import type { NextApiHandler, NextApiRequest, NextApiResponse } from "next";

/**
 * Higher-order function that validates required environment variables before executing an API route handler.
 * Returns a 500 error with clear messaging if any required variables are missing.
 *
 * @param handler - The Next.js API route handler function
 * @param requiredVars - Array of required environment variable names
 * @returns Wrapped API handler with environment validation
 *
 * @example
 * ```typescript
 * async function handler(req: NextApiRequest, res: NextApiResponse) {
 *   // Your API logic here
 * }
 *
 * export default withEnvValidation(handler, ['SESSION_SECRET', 'API_KEY']);
 * ```
 */
export function withEnvValidation(
  handler: NextApiHandler,
  requiredVars: string[]
): NextApiHandler {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    const missing = requiredVars.filter((v) => !process.env[v]);

    if (missing.length > 0) {
      return res.status(500).json({
        error: `Missing required environment variables: ${missing.join(", ")}`,
      });
    }

    return handler(req, res);
  };
}
