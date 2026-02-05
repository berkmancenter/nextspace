import { JWTDecryptResult } from "jose";

/**
 * Current cookie version - increment this when cookie structure changes
 */
export const CURRENT_COOKIE_VERSION = "1";

/**
 * Required fields that must be present in a valid cookie payload
 */
const REQUIRED_COOKIE_FIELDS = [
  "access",
  "refresh",
  "userId",
  "authType",
] as const;

/**
 * Valid authType values
 */
const VALID_AUTH_TYPES = ["guest", "user", "admin"] as const;

/**
 * Interface for cookie payload validation
 */
export interface CookiePayload {
  access: string;
  refresh: string;
  userId: string;
  authType: string;
  version?: string;
  sub?: string;
  exp?: number;
  iat?: number;
}

/**
 * Validates that a decrypted cookie has all required fields and proper format
 * @param cookie - The decrypted JWT cookie result
 * @returns Object with isValid boolean and optional error message
 */
export function validateCookie(
  cookie: JWTDecryptResult | null
): { isValid: boolean; error?: string } {
  // Cookie is null or undefined
  if (!cookie) {
    return { isValid: false, error: "Cookie is null or undefined" };
  }

  // Check if payload exists
  if (!cookie.payload) {
    return { isValid: false, error: "Cookie payload is missing" };
  }

  const payload = cookie.payload as CookiePayload;

  // Check cookie version
  const cookieVersion = payload.version || "0"; // Treat missing version as version 0 (legacy)
  if (cookieVersion !== CURRENT_COOKIE_VERSION) {
    return {
      isValid: false,
      error: `Cookie version mismatch: expected ${CURRENT_COOKIE_VERSION}, got ${cookieVersion}`,
    };
  }

  // Validate all required fields are present and non-empty
  for (const field of REQUIRED_COOKIE_FIELDS) {
    if (!payload[field]) {
      return {
        isValid: false,
        error: `Required field '${field}' is missing or empty`,
      };
    }

    // Additional type checking for string fields
    if (typeof payload[field] !== "string") {
      return {
        isValid: false,
        error: `Field '${field}' must be a string`,
      };
    }
  }

  // Validate authType is one of the allowed values
  if (!VALID_AUTH_TYPES.includes(payload.authType as any)) {
    return {
      isValid: false,
      error: `Invalid authType: '${payload.authType}'. Must be one of: ${VALID_AUTH_TYPES.join(", ")}`,
    };
  }

  // Validate token format (should be non-empty strings)
  if (payload.access.trim() === "" || payload.refresh.trim() === "") {
    return {
      isValid: false,
      error: "Access or refresh token is empty",
    };
  }

  // Validate userId format (should be non-empty string)
  if (payload.userId.trim() === "") {
    return {
      isValid: false,
      error: "UserId is empty",
    };
  }

  // Check expiration if present
  if (payload.exp) {
    const currentTime = Math.floor(Date.now() / 1000);
    if (payload.exp < currentTime) {
      return {
        isValid: false,
        error: "Cookie has expired",
      };
    }
  }

  // All validations passed
  return { isValid: true };
}

/**
 * Helper function to check if a cookie needs to be cleared due to validation failure
 * @param cookie - The decrypted JWT cookie result
 * @returns true if cookie is invalid and should be cleared
 */
export function shouldClearCookie(cookie: JWTDecryptResult | null): boolean {
  const validation = validateCookie(cookie);
  return !validation.isValid;
}
