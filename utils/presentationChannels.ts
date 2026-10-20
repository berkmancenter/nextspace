import { ParsedUrlQuery } from 'querystring';

/*
 * The presentation view moves its channel passcodes out of the address bar so they
 * aren't shown on the projector. sessionStorage keeps them for a reload in the same tab.
 * Every access is wrapped because some private-browsing modes throw on the accessor.
 */

const STORAGE_KEY_PREFIX = 'nextspace.presentation.channels.';

/**
 * Stores the presentation view's channels for this tab.
 * @param conversationId The event's conversation id.
 * @param channel The `channel` query values, each `name,passcode`.
 * @returns false if storage is unavailable, in which case the passcodes must stay in the URL.
 */
export function savePresentationChannels(conversationId: string, channel: string | string[]): boolean {
  try {
    const channels = Array.isArray(channel) ? channel : [channel];
    window.sessionStorage.setItem(`${STORAGE_KEY_PREFIX}${conversationId}`, JSON.stringify(channels));
    return true;
  } catch (error) {
    console.warn('Could not store presentation passcodes, leaving them in the URL:', error);
    return false;
  }
}

/**
 * Fills in the query's channels from storage when the URL has none. Channels in the URL
 * always win, so opening a full link replaces whatever an earlier link left behind.
 * @param query The page's query parameters.
 * @returns The query with stored channels added, or the same query if there is nothing to add.
 */
export function withStoredChannels(query: ParsedUrlQuery): ParsedUrlQuery {
  if (query.channel || typeof query.conversationId !== 'string') return query;
  try {
    const stored = window.sessionStorage.getItem(`${STORAGE_KEY_PREFIX}${query.conversationId}`);
    if (!stored) return query;
    return { ...query, channel: JSON.parse(stored) as string[] };
  } catch (error) {
    console.warn('Could not read stored presentation passcodes:', error);
    return query;
  }
}
