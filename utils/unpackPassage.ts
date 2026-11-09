import { TranscriptChunkText, UnpackErrorReason, UnpackSelection, WidenedPassage } from '../types.internal';

/** Matches the server's limit (llm_engine UNPACK_PASSAGE_MAX_CHARACTERS) on the widened quote. */
export const UNPACK_MAX_PASSAGE_CHARACTERS = 2000;

/** Shorter selections are usually a stray double-click on one word, not a request. */
export const UNPACK_MIN_WORDS = 3;

const PREVIEW_MAX_CHARACTERS = 240;

const sentences = new Intl.Segmenter('en', { granularity: 'sentence' });
const isSpace = (character: string) => /\s/.test(character);

/*
 * sentenceStart, sentenceEnd and the space skipping copy llm_engine's buildPassage
 * (src/agents/eventAssistant/unpackPassage.ts) so the instant quote matches the one the server explains.
 */
function sentenceStart(text: string, offset: number): number {
  for (const { index, segment } of sentences.segment(text)) {
    if (offset < index + segment.length) return index;
  }
  return text.length;
}

function sentenceEnd(text: string, offset: number): number {
  if (offset === 0) return 0;
  for (const { index, segment } of sentences.segment(text)) {
    if (offset <= index + segment.length) return index + segment.length;
  }
  return text.length;
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

export const countWords = (text: string): number => text.split(/\s+/).filter(Boolean).length;

export const isPassageTooLong = (quote: string): boolean => quote.length > UNPACK_MAX_PASSAGE_CHARACTERS;

/** The opening one or two sentences of the explanation, cut from the real text so the preview is its true start. */
export function previewOpening(whatTheyreSaying: string): string {
  const all = [...sentences.segment(whatTheyreSaying)].map(({ segment }) => segment);
  const twoSentences = all.slice(0, 2).join('').trim();
  const opening = twoSentences.length > PREVIEW_MAX_CHARACTERS ? all[0].trim() : twoSentences;
  return opening.length < whatTheyreSaying.trim().length ? `${opening}…` : opening;
}

export function alsoCoversLine(termCount: number): string {
  if (termCount === 0) return 'The full explanation also covers why it matters.';
  const terms = termCount === 1 ? '1 key term' : `${termCount} key terms`;
  return `The full explanation also covers why it matters and ${terms}.`;
}

export interface UnpackErrorCopy {
  message: string;
  /** Asking again for the same passage can work. */
  canRetry: boolean;
  /** Sending this passage to Private Chat can still work. */
  canSend: boolean;
}

const UNREADABLE_SELECTION: UnpackErrorCopy = {
  message: "Berkie couldn't read that selection. Try selecting it again.",
  canRetry: false,
  canSend: false,
};

const ERROR_COPY: Record<UnpackErrorReason, UnpackErrorCopy> = {
  selectionTooLong: { message: 'Select a shorter passage.', canRetry: false, canSend: false },
  unpackFailed: { message: "Berkie couldn't unpack this just now.", canRetry: true, canSend: true },
  rateLimited: {
    message: "You've asked about a lot of passages this minute. Wait a moment, then try again.",
    canRetry: true,
    canSend: false,
  },
  unpackerOff: { message: 'Unpacking passages is turned off for this event.', canRetry: false, canSend: false },
  noAssistant: { message: 'This event has no assistant to unpack passages.', canRetry: false, canSend: false },
  noPrivateChat: {
    message: "Berkie couldn't find your Private Chat. Reload the page, then try again.",
    canRetry: false,
    canSend: false,
  },
  chunkNotInTranscript: UNREADABLE_SELECTION,
  offsetPastEnd: UNREADABLE_SELECTION,
  selectionBackwards: UNREADABLE_SELECTION,
};

const GENERAL_ERROR: UnpackErrorCopy = { message: 'Something went wrong. Try again.', canRetry: true, canSend: true };

export const unpackErrorCopy = (reason: UnpackErrorReason | undefined): UnpackErrorCopy =>
  (reason && ERROR_COPY[reason]) || GENERAL_ERROR;
