import {
  CATCH_UP_MAX_CHARACTERS,
  buildCatchUpRequest,
  describeCatchUpRequest,
  formatTime,
  formatTimeRange,
  pickCatchUpChunks,
} from '../../utils/catchUp';
import { PseudonymousMessage } from '../../types.internal';

const makeChunk = (id: string, createdAt?: Date, text = `Caption ${id}`): PseudonymousMessage =>
  ({
    id,
    body: text,
    channels: ['transcript'],
    createdAt: createdAt?.toISOString(),
  }) as PseudonymousMessage;

const at = (hours: number, minutes: number, seconds = 0) => new Date(2025, 9, 17, hours, minutes, seconds);

// Newer ICU versions put a narrow no-break space before AM and PM.
const plainSpaces = (text: string) => text.replace(/\u202f/g, ' ');

describe('pickCatchUpChunks', () => {
  it('picks the chunks that ended within 60 seconds of the newest one, oldest first', () => {
    const chunks = [
      makeChunk('newest', at(10, 45, 0)),
      makeChunk('too-old', at(10, 43, 59)),
      makeChunk('exactly-60s', at(10, 44, 0)),
      makeChunk('middle', at(10, 44, 30)),
    ];

    expect(pickCatchUpChunks(chunks).map((chunk) => chunk.id)).toEqual(['exactly-60s', 'middle', 'newest']);
  });

  it('still picks the latest minute of speech when nothing was said recently', () => {
    const chunks = [makeChunk('older', at(10, 41, 30)), makeChunk('newest', at(10, 42, 0))];

    expect(pickCatchUpChunks(chunks).map((chunk) => chunk.id)).toEqual(['older', 'newest']);
  });

  it('drops the oldest chunks until the passages fit the character limit', () => {
    const longText = 'a'.repeat(CATCH_UP_MAX_CHARACTERS - 600);
    const chunks = [
      makeChunk('long-oldest', at(10, 44, 10), longText),
      makeChunk('middle', at(10, 44, 40), 'b'.repeat(400)),
      makeChunk('newest', at(10, 45, 0), 'c'.repeat(400)),
    ];

    expect(pickCatchUpChunks(chunks).map((chunk) => chunk.id)).toEqual(['middle', 'newest']);
  });

  it('counts the spaces the server joins passages with toward the limit', () => {
    const half = 'a'.repeat(CATCH_UP_MAX_CHARACTERS / 2);
    const chunks = [makeChunk('first', at(10, 44, 30), half), makeChunk('second', at(10, 45, 0), half)];

    expect(pickCatchUpChunks(chunks).map((chunk) => chunk.id)).toEqual(['second']);
  });

  it('picks nothing when there is no transcript yet', () => {
    expect(pickCatchUpChunks([])).toEqual([]);
  });

  it('skips chunks with no time, an invalid time or no ID', () => {
    const invalidTime = { ...makeChunk('bad-time'), createdAt: 'not a date' } as PseudonymousMessage;
    const chunks = [makeChunk('no-time'), invalidTime, makeChunk('', at(10, 44, 50)), makeChunk('newest', at(10, 45))];

    expect(pickCatchUpChunks(chunks).map((chunk) => chunk.id)).toEqual(['newest']);
  });
});

describe('formatTime', () => {
  it('formats a time the way the transcript does', () => {
    expect(formatTime(at(9, 5), 'en-US')).toBe(
      at(9, 5).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
    );
  });

  it('returns an empty string for an invalid date', () => {
    expect(formatTime(new Date(Number.NaN), 'en-US')).toBe('');
  });
});

describe('formatTimeRange', () => {
  it('names AM or PM once when both times share it', () => {
    expect(plainSpaces(formatTimeRange(at(10, 43), at(10, 45), 'en-US'))).toBe('10:43 to 10:45 AM');
  });

  it('names AM and PM on both times when the range crosses noon', () => {
    expect(plainSpaces(formatTimeRange(at(11, 59), at(12, 0), 'en-US'))).toBe('11:59 AM to 12:00 PM');
  });

  it('shows one time when both fall in the same minute', () => {
    expect(plainSpaces(formatTimeRange(at(10, 43, 5), at(10, 43, 50), 'en-US'))).toBe('10:43 AM');
  });

  it('returns an empty string when either time is invalid', () => {
    expect(plainSpaces(formatTimeRange(new Date(Number.NaN), at(10, 45), 'en-US'))).toBe('');
  });
});

describe('describeCatchUpRequest', () => {
  const passages = [makeChunk('a', at(10, 43, 20)), makeChunk('b', at(10, 44, 0)), makeChunk('c', at(10, 45, 0))];

  it('describes the last 60 seconds with the passage count and time range', () => {
    expect(plainSpaces(describeCatchUpRequest({ passages, requestedCount: 3, earlierSpeech: false }, 'en-US'))).toBe(
      'The last 60 seconds · 3 passages, 10:43 to 10:45 AM',
    );
  });

  it('uses the singular for one passage', () => {
    expect(
      plainSpaces(describeCatchUpRequest({ passages: [passages[0]], requestedCount: 1, earlierSpeech: false }, 'en-US')),
    ).toBe('The last 60 seconds · 1 passage, 10:43 AM');
  });

  it('says nothing new was said when the server reports earlier speech', () => {
    expect(plainSpaces(describeCatchUpRequest({ passages, requestedCount: 3, earlierSpeech: true }, 'en-US'))).toBe(
      "Nothing new in the last 60 seconds · Here's what was said before, 10:43 to 10:45 AM",
    );
  });

  it('counts the requested passages when the page has not loaded them', () => {
    expect(plainSpaces(describeCatchUpRequest({ passages: [], requestedCount: 2, earlierSpeech: false }, 'en-US'))).toBe(
      'The last 60 seconds · 2 passages',
    );
  });

  it('describes nothing when the request listed no passages', () => {
    expect(plainSpaces(describeCatchUpRequest({ passages: [], requestedCount: 0, earlierSpeech: false }, 'en-US'))).toBe('');
  });
});

describe('buildCatchUpRequest', () => {
  it('lists the chunk IDs and a readable label for text-only clients', () => {
    const chunks = [makeChunk('a', at(10, 43, 20)), makeChunk('b', at(10, 45, 0))];

    const request = buildCatchUpRequest(chunks, 'en-US');

    expect({ ...request, text: plainSpaces(request.text) }).toEqual({
      type: 'unpack_request',
      mode: 'lastMinute',
      text: 'Catch me up: 2 passages, 10:43 to 10:45 AM',
      chunkIds: ['a', 'b'],
      destination: 'privateChat',
    });
  });

  it('sends an empty list when there is no transcript yet', () => {
    expect(buildCatchUpRequest([], 'en-US')).toEqual({
      type: 'unpack_request',
      mode: 'lastMinute',
      text: 'Catch me up',
      chunkIds: [],
      destination: 'privateChat',
    });
  });
});
