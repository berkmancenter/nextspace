import { TranscriptChunkText, UnpackErrorCopy, UnpackErrorReason, UnpackSelection, WidenedPassage } from '../types.internal';

/** Matches the server's limit (llm_engine UNPACK_PASSAGE_MAX_CHARACTERS) on the widened quote. */
export const UNPACK_MAX_PASSAGE_CHARACTERS = 2000;

/** Shorter selections are usually a stray double-click on one word, not a request. */
export const UNPACK_MIN_WORDS = 3;

const PREVIEW_MAX_CHARACTERS = 240;

// Firefox before 125 and Safari before 14.1 lack Intl.Segmenter; creating it at import would break every page.
let segmenter: Intl.Segmenter | null | undefined;
const getSegmenter = () => {
  if (segmenter === undefined) {
    segmenter = typeof Intl.Segmenter === 'function' ? new Intl.Segmenter('en', { granularity: 'sentence' }) : null;
  }
  return segmenter;
};

// Intl.Segmenter ends a sentence at any period before a capital letter, so "Dr. Patel" would split in two.
// "etc." and "No." are left out because speakers often end a sentence with them.
const ENDS_WITH_ABBREVIATION =
  /(?:\b(?:Dr|Mr|Mrs|Ms|Prof|St|Jr|Sr|Gen|Sen|Rep|Gov|vs|cf)\.|\b(?:e\.g|i\.e)\.|\b(?:[A-Z]\.){2,})\s*$/;
const isSpace = (character: string) => /\s/.test(character);

/*
 * sentenceSpans, sentenceStart, sentenceEnd and the space skipping copy llm_engine's buildPassage
 * (src/agents/eventAssistant/unpackPassage.ts) so the instant quote matches the one the server explains.
 */
function sentenceSpans(text: string): { start: number; end: number }[] {
  const sentences = getSegmenter();
  if (!sentences) return [{ start: 0, end: text.length }];
  const spans: { start: number; end: number }[] = [];
  for (const { index, segment } of sentences.segment(text)) {
    const previous = spans[spans.length - 1];
    if (previous && ENDS_WITH_ABBREVIATION.test(text.slice(previous.start, previous.end))) {
      previous.end = index + segment.length;
    } else {
      spans.push({ start: index, end: index + segment.length });
    }
  }
  return spans;
}

function sentenceStart(text: string, offset: number): number {
  return sentenceSpans(text).find(({ end }) => offset < end)?.start ?? text.length;
}

function sentenceEnd(text: string, offset: number): number {
  if (offset === 0) return 0;
  return sentenceSpans(text).find(({ end }) => offset <= end)?.end ?? text.length;
}

function skipSpacesForward(text: string, from: number, to: number): number {
  let offset = from;
  while (offset < to && isSpace(text[offset])) offset += 1;
  return offset;
}

function skipSpacesBack(text: string, from: number, to: number): number {
  let offset = to;
  while (offset > from && isSpace(text[offset - 1])) offset -= 1;
  return offset;
}

/**
 * Widens a selection to whole sentences, each end inside its own chunk.
 * @param chunks - the transcript chunks on the page, in spoken order
 * @param selection - what the participant selected
 * @returns the widened range and its quote, or null when a chunk is missing or nothing with words is selected
 */
export function widenSelection(chunks: TranscriptChunkText[], selection: UnpackSelection): WidenedPassage | null {
  const startIndex = chunks.findIndex((chunk) => chunk.id === selection.startMessageId);
  const endIndex = chunks.findIndex((chunk) => chunk.id === selection.endMessageId);
  if (startIndex === -1 || endIndex === -1 || startIndex > endIndex) return null;
  if (startIndex === endIndex && selection.startOffset >= selection.endOffset) return null;

  const selected = chunks.slice(startIndex, endIndex + 1);
  const pieces = selected.flatMap((chunk, i) => {
    const { text } = chunk;
    let from = 0;
    let to = text.length;
    if (i === 0) from = sentenceStart(text, skipSpacesForward(text, selection.startOffset, text.length));
    if (i === selected.length - 1) to = sentenceEnd(text, skipSpacesBack(text, 0, selection.endOffset));
    from = skipSpacesForward(text, from, to);
    to = skipSpacesBack(text, from, to);
    return from < to ? [{ id: chunk.id, from, to, text: text.slice(from, to) }] : [];
  });
  if (pieces.length === 0) return null;

  const first = pieces[0];
  const last = pieces[pieces.length - 1];
  return {
    quote: pieces.map(({ text }) => text).join(' '),
    range: { startMessageId: first.id, startOffset: first.from, endMessageId: last.id, endOffset: last.to },
  };
}

export const passageKey = ({ startMessageId, startOffset, endMessageId, endOffset }: UnpackSelection): string =>
  `${startMessageId}:${startOffset}-${endMessageId}:${endOffset}`;

export const countWords = (text: string): number => text.split(/\s+/).filter(Boolean).length;

export const isPassageTooLong = (quote: string): boolean => quote.length > UNPACK_MAX_PASSAGE_CHARACTERS;

/** The opening one or two sentences of the explanation, cut from the real text so the preview is its true start. */
export function previewOpening(whatTheyreSaying: string): string {
  const all = sentenceSpans(whatTheyreSaying).map(({ start, end }) => whatTheyreSaying.slice(start, end));
  const twoSentences = all.slice(0, 2).join('').trim();
  const opening = twoSentences.length > PREVIEW_MAX_CHARACTERS ? all[0].trim() : twoSentences;
  return opening.length < whatTheyreSaying.trim().length ? `${opening}…` : opening;
}

export function alsoCoversLine(termCount: number): string {
  if (termCount === 0) return 'The full explanation also covers why it matters.';
  const terms = termCount === 1 ? '1 key term' : `${termCount} key terms`;
  return `The full explanation also covers why it matters and ${terms}.`;
}

const errorCopy = (botName: string): Record<UnpackErrorReason, UnpackErrorCopy> => {
  const unreadableSelection = {
    message: `${botName} couldn't read that selection. Try selecting it again.`,
    canRetry: false,
    canSend: false,
  };
  return {
    selectionTooLong: { message: 'Select a shorter passage.', canRetry: false, canSend: false },
    unpackFailed: { message: `${botName} couldn't unpack this just now.`, canRetry: true, canSend: true },
    rateLimited: {
      message: "You've asked about a lot of passages this minute. Wait a moment, then try again.",
      canRetry: true,
      canSend: true,
    },
    unpackerOff: { message: 'Unpacking passages is turned off for this event.', canRetry: false, canSend: false },
    noAssistant: { message: 'This event has no assistant to unpack passages.', canRetry: false, canSend: false },
    noPrivateChat: {
      message: `${botName} couldn't find your Private Chat. Reload the page, then try again.`,
      canRetry: false,
      canSend: false,
    },
    wrongPasscode: {
      message: "This page's transcript link has changed. Reload the page, then try again.",
      canRetry: false,
      canSend: false,
    },
    chunkNotInTranscript: unreadableSelection,
    offsetPastEnd: unreadableSelection,
    selectionBackwards: unreadableSelection,
  };
};

const GENERAL_ERROR: UnpackErrorCopy = { message: 'Something went wrong. Try again.', canRetry: true, canSend: true };

export const unpackErrorCopy = (reason: UnpackErrorReason | undefined, botName: string): UnpackErrorCopy =>
  (reason && errorCopy(botName)[reason]) || GENERAL_ERROR;
