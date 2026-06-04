import { NextRouter } from 'next/router';
import { GetChannelPasscode } from './Helpers';

type Page = 'moderator' | 'assistant';

/**
 * Checks if the router query parameters are valid for a conversation and returns an error message if they are not.
 * @param router - The Next.js router object.
 * @param page - The current page type.
 */
export const QueryParamsError = (router: NextRouter, page: Page): { header: string; params: string[] } | null => {
  const { conversationId, channel }: { conversationId?: string; channel?: string[] | string } = router.query;
  const missing: string[] = [];

  const checkTranscriptPasscode = () => {
    // Also check for transcript passcode, if specified as a channel
    if (
      (typeof channel === 'string' && channel.startsWith('transcript')) ||
      (Array.isArray(channel) && channel.find((ch) => ch.startsWith('transcript')))
    ) {
      if (!GetChannelPasscode('transcript', router.query)) missing.push('transcript passcode');
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
    if (!GetChannelPasscode('moderator', router.query)) missing.push('moderator passcode');

    checkTranscriptPasscode();
  }

  if (page === 'assistant') {
    // If only one channel specified, check if starts with 'chat'
    if (typeof channel === 'string' && !channel.startsWith('chat')) missing.push('chat channel');
    else if (Array.isArray(channel) && !channel.find((ch) => ch.startsWith('chat'))) missing.push('chat channel');
    if (!GetChannelPasscode('chat', router.query)) missing.push('chat passcode');

    checkTranscriptPasscode();
  }

  if (missing.length > 0) return { header: `Missing required parameter${missing.length > 1 ? 's' : ''}`, params: missing };

  return null;
};
