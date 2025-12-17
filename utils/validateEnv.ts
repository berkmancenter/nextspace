/**
 * Validates that all required environment variables are set.
 * Throws an error with clear messages if any are missing.
 */
export function validateEnv(): void {
  const errors: string[] = [];

  // Required client-side environment variables
  const requiredClientVars = [
    "NEXT_PUBLIC_API_URL",
    "NEXT_PUBLIC_SOCKET_URL",
    "NEXT_PUBLIC_DEFAULT_TOPIC_ID",
    "NEXT_PUBLIC_ABOUT_URL",
  ];

  // Required server-side environment variables
  const requiredServerVars = ["SESSION_SECRET"];

  // Check client-side variables (NEXT_PUBLIC_*)
  for (const key of requiredClientVars) {
    if (!process.env[key]) {
      errors.push(key);
    }
  }

  // Check server-side variables (only on server)
  if (typeof window === "undefined") {
    for (const key of requiredServerVars) {
      if (!process.env[key]) {
        errors.push(key);
      }
    }
  }

  if (errors.length > 0) {
    throw new Error(
      `Missing required environment variables: ${errors.join(", ")}`
    );
  }
}
