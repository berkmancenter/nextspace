import { ParsedUrlQuery } from 'querystring';
import { GetChannelPasscode } from './Helpers';

type Page = 'moderator' | 'assistant';

/**
 * Checks if the query parameters are valid for a conversation and returns an error message if they are not.
 * @param query - The page's query parameters.
 * @param page - The current page type.
 */
export const QueryParamsError = (query: ParsedUrlQuery, page: Page): { header: string; params: string[] } | null => {
  const { conversationId, channel }: { conversationId?: string; channel?: string[] | string } = query;
  const missing: string[] = [];

  const checkTranscriptPasscode = () => {
    // Also check for transcript passcode, if specified as a channel
    if (
      (typeof channel === 'string' && channel.startsWith('transcript')) ||
      (Array.isArray(channel) && channel.find((ch) => ch.startsWith('transcript')))
    ) {
      if (!GetChannelPasscode('transcript', query)) missing.push('transcript passcode');
    }
  };

  if (!conversationId) missing.push('conversation ID');
  if (!/^[0-9a-fA-F]{24}$/.test(conversationId || '')) missing.push('invalid conversation ID');
  if (!channel)
    // If channel missing entirely...
    missing.push('channel');

  if (page === 'moderator') {
    // If only one channel specified, check if starts with 'moderator'
    if (typeof channel === 'string' && !channel.startsWith('moderator')) missing.push('moderator channel');
    else if (Array.isArray(channel) && !channel.find((ch) => ch.startsWith('moderator'))) missing.push('moderator channel');
    if (!GetChannelPasscode('moderator', query)) missing.push('moderator passcode');

    checkTranscriptPasscode();
  }

  if (page === 'assistant') {
    // If only one channel specified, check if starts with 'chat'
    if (typeof channel === 'string' && !channel.startsWith('chat')) missing.push('chat channel');
    else if (Array.isArray(channel) && !channel.find((ch) => ch.startsWith('chat'))) missing.push('chat channel');
    if (!GetChannelPasscode('chat', query)) missing.push('chat passcode');

    checkTranscriptPasscode();
  }

  if (missing.length > 0) {
    console.warn('Incomplete event link, missing:', missing);
    return { header: 'This link is incomplete. Ask the event organizer for the full link.', params: [] };
  }

  return null;
};
