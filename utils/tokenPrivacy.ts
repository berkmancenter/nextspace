/** Pages whose URL carries a one-time token in the `token` query parameter. */
const TOKEN_PAGES = ['/reset-password'];

const REDACTED = 'REDACTED';
const TOKEN_PARAM_PATTERN = /((?:^|[?&])token=)[^&#\s"']*/g;

export const isTokenPage = (pathname: string): boolean => TOKEN_PAGES.includes(pathname);

export const scrubTokenFromUrl = (url: string): string => url.replace(TOKEN_PARAM_PATTERN, `$1${REDACTED}`);

/** Sentry keeps live SDK objects here that link back to each other; it is never sent, so it is skipped. */
const SKIPPED_KEYS = ['sdkProcessingMetadata'];

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (!value || typeof value !== 'object') return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

const scrubValue = (value: unknown, key: string | undefined, seen: WeakSet<object>): unknown => {
  if (typeof value === 'string') return key === 'token' ? REDACTED : scrubTokenFromUrl(value);
  if (!Array.isArray(value) && !isPlainObject(value)) return value;
  if (seen.has(value)) return value;
  seen.add(value);

  if (Array.isArray(value)) return value.map((item) => scrubValue(item, undefined, seen));
  return Object.fromEntries(
    Object.entries(value).map(([childKey, child]) => [
      childKey,
      SKIPPED_KEYS.includes(childKey) ? child : scrubValue(child, childKey, seen),
    ]),
  );
};

/**
 * Redacts one-time tokens from every string in a Sentry event before it is sent. Covers request URLs, breadcrumbs,
 * and spans, and a `token` key in a query string Sentry has already parsed into an object. Only plain objects and
 * arrays are walked, so class instances such as Sentry scopes pass through unchanged.
 */
export const scrubSentryEvent = <T>(event: T): T => scrubValue(event, undefined, new WeakSet()) as T;
