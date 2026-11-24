import { PseudonymousMessage } from '../types.internal';
import { components } from '../types';
import { parseMessageBody } from './Helpers';

type UnpackRequestBody = components['schemas']['UnpackRequestBody'];

const CATCH_UP_WINDOW_MS = 60 * 1000;

/**
 * The backend summarizes at most this many characters of passages, joined with spaces, and drops the
 * oldest beyond it. Trimming here too keeps the request's passage count true to what gets summarized.
 */
export const CATCH_UP_MAX_CHARACTERS = 3000;

/** The backend refuses a catch-up that names more chunks than this. */
const CATCH_UP_MAX_CHUNKS = 50;

const endTime = (chunk: PseudonymousMessage) => new Date(chunk.createdAt!).getTime();

const joinedLength = (chunks: PseudonymousMessage[]) =>
  chunks.reduce((total, chunk) => total + parseMessageBody(chunk.body).text.length, 0) + chunks.length - 1;

/**
 * Picks the transcript chunks a catch-up covers: those that ended within 60 seconds of the newest
 * chunk, even when that chunk is older than a minute. Drops the oldest until they fit the backend's
 * chunk and character limits.
 * @param transcriptChunks - The transcript chunks the page has loaded, in any order.
 * @returns The picked chunks, oldest first. Empty when there is no transcript.
 */
export const pickCatchUpChunks = (transcriptChunks: PseudonymousMessage[]): PseudonymousMessage[] => {
  const timedChunks = transcriptChunks
    .filter((chunk) => chunk.id && chunk.createdAt && !Number.isNaN(endTime(chunk)))
    .sort((first, second) => endTime(first) - endTime(second));
  if (timedChunks.length === 0) return [];

  const newestEnd = endTime(timedChunks[timedChunks.length - 1]);
  const picked = timedChunks.filter((chunk) => endTime(chunk) >= newestEnd - CATCH_UP_WINDOW_MS).slice(-CATCH_UP_MAX_CHUNKS);
  while (picked.length > 1 && joinedLength(picked) > CATCH_UP_MAX_CHARACTERS) picked.shift();
  return picked;
};

// The transcript shows times this way, so the passages listed in Private Chat match it.
const timeOptions: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit', hour12: true };

const isValidDate = (date: Date) => !Number.isNaN(date.getTime());

/**
 * @param date - The time to format.
 * @param locale - Defaults to the browser's locale.
 * @returns The time as the transcript shows it, or an empty string for an invalid date.
 */
export const formatTime = (date: Date, locale?: string): string =>
  isValidDate(date) ? new Intl.DateTimeFormat(locale, timeOptions).format(date) : '';

/**
 * @param start - The earlier time.
 * @param end - The later time.
 * @param locale - Defaults to the browser's locale.
 * @returns For example "10:43 to 10:45 AM", one time when both fall in the same minute, or an
 *   empty string when either time is invalid.
 */
export const formatTimeRange = (start: Date, end: Date, locale?: string): string => {
  if (!isValidDate(start) || !isValidDate(end)) return '';

  const parts = new Intl.DateTimeFormat(locale, timeOptions).formatRangeToParts(start, end);
  const firstEndPart = parts.findIndex((part) => part.source === 'endRange');
  const joinParts = (rangeParts: Intl.DateTimeRangeFormatPart[]) => rangeParts.map((part) => part.value).join('');
  if (firstEndPart === -1) return joinParts(parts);

  const lastStartPart = parts.map((part) => part.source).lastIndexOf('startRange');
  return `${joinParts(parts.slice(0, lastStartPart + 1))} to ${joinParts(parts.slice(firstEndPart))}`;
};

const countPassages = (count: number) => `${count} ${count === 1 ? 'passage' : 'passages'}`;

const describePassages = (passages: PseudonymousMessage[], locale?: string) => {
  const range = formatTimeRange(
    new Date(passages[0].createdAt!),
    new Date(passages[passages.length - 1].createdAt!),
    locale,
  );
  return range ? `${countPassages(passages.length)}, ${range}` : countPassages(passages.length);
};

/**
 * The line under a catch-up request bubble's "Catch me up" header.
 * @param request.passages - The requested chunks the page has loaded, oldest first.
 * @param request.requestedCount - How many chunks the request listed, loaded or not.
 * @param request.earlierSpeech - The server's answer to whether nothing was said in the last 60
 *   seconds. Pass false until the summary arrives: the browser's clock can't be trusted for it.
 * @param locale - Defaults to the browser's locale.
 * @returns The line, or an empty string when the request listed no passages.
 */
export const describeCatchUpRequest = (
  {
    passages,
    requestedCount,
    earlierSpeech,
  }: { passages: PseudonymousMessage[]; requestedCount: number; earlierSpeech: boolean },
  locale?: string,
): string => {
  if (requestedCount === 0) return '';

  if (earlierSpeech) {
    const range =
      passages.length > 0
        ? formatTimeRange(new Date(passages[0].createdAt!), new Date(passages[passages.length - 1].createdAt!), locale)
        : '';
    return range
      ? `Nothing new in the last 60 seconds · Here's what was said before, ${range}`
      : 'Nothing new in the last 60 seconds';
  }

  const description = passages.length > 0 ? describePassages(passages, locale) : countPassages(requestedCount);
  return `The last 60 seconds · ${description}`;
};

/**
 * @param chunks - The chunks from pickCatchUpChunks.
 * @param locale - Defaults to the browser's locale.
 * @returns The request body, with a readable label for chat history and text-only clients.
 */
export const buildCatchUpRequest = (chunks: PseudonymousMessage[], locale?: string): UnpackRequestBody => ({
  type: 'unpack_request',
  mode: 'lastMinute',
  text: chunks.length > 0 ? `Catch me up: ${describePassages(chunks, locale)}` : 'Catch me up',
  chunkIds: chunks.map((chunk) => chunk.id!),
  destination: 'privateChat',
});
