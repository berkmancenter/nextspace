import {
  alsoCoversLine,
  countWords,
  isPassageTooLong,
  previewOpening,
  unpackErrorCopy,
  widenSelection,
  UNPACK_MAX_PASSAGE_CHARACTERS,
} from '../../utils/unpackPassage';

const chunks = [
  { id: 'c1', text: 'We built on the Caselaw Access Project. It has 6.7 million decisions.' },
  {
    id: 'c2',
    text: "The citation graph isn't scale-free. Precedential weight concentrates in a few circuits, then decays.",
  },
  { id: 'c3', text: 'and that has real consequences for lower courts' },
];

describe('widenSelection', () => {
  it('widens a selection inside one sentence to the whole sentence', () => {
    const text = chunks[1].text;
    const start = text.indexOf('weight');
    const end = text.indexOf('circuits') + 'circuits'.length;

    const widened = widenSelection(chunks, {
      startMessageId: 'c2',
      startOffset: start,
      endMessageId: 'c2',
      endOffset: end,
    });

    expect(widened).toEqual({
      quote: 'Precedential weight concentrates in a few circuits, then decays.',
      range: {
        startMessageId: 'c2',
        startOffset: text.indexOf('Precedential'),
        endMessageId: 'c2',
        endOffset: text.length,
      },
    });
  });

  it('widens to the whole chunk when the chunk has no sentence punctuation', () => {
    const widened = widenSelection(chunks, {
      startMessageId: 'c3',
      startOffset: 9,
      endMessageId: 'c3',
      endOffset: 13,
    });

    expect(widened?.quote).toBe('and that has real consequences for lower courts');
    expect(widened?.range).toEqual({
      startMessageId: 'c3',
      startOffset: 0,
      endMessageId: 'c3',
      endOffset: chunks[2].text.length,
    });
  });

  it('joins the pieces of a selection that runs across chunks with a space', () => {
    const widened = widenSelection(chunks, {
      startMessageId: 'c1',
      startOffset: chunks[0].text.indexOf('million'),
      endMessageId: 'c2',
      endOffset: 'The citation'.length,
    });

    expect(widened?.quote).toBe("It has 6.7 million decisions. The citation graph isn't scale-free.");
    expect(widened?.range.startMessageId).toBe('c1');
    expect(widened?.range.endMessageId).toBe('c2');
  });

  it('gives the same range for two overlapping selections in one sentence', () => {
    const text = chunks[1].text;
    const first = widenSelection(chunks, {
      startMessageId: 'c2',
      startOffset: text.indexOf('weight'),
      endMessageId: 'c2',
      endOffset: text.indexOf('few'),
    });
    const second = widenSelection(chunks, {
      startMessageId: 'c2',
      startOffset: text.indexOf('concentrates'),
      endMessageId: 'c2',
      endOffset: text.indexOf('decays'),
    });

    expect(first?.range).toEqual(second?.range);
  });

  it('returns null when a chunk is not on the page', () => {
    expect(
      widenSelection(chunks, { startMessageId: 'missing', startOffset: 0, endMessageId: 'c2', endOffset: 4 }),
    ).toBeNull();
  });

  it('returns null when the selection holds no words', () => {
    expect(widenSelection(chunks, { startMessageId: 'c2', startOffset: 5, endMessageId: 'c2', endOffset: 5 })).toBeNull();
  });
});

describe('countWords', () => {
  it('counts words separated by any whitespace', () => {
    expect(countWords('  the citation\ngraph  ')).toBe(3);
  });

  it('counts nothing in blank text', () => {
    expect(countWords('   ')).toBe(0);
  });
});

describe('isPassageTooLong', () => {
  it('allows a passage at the limit', () => {
    expect(isPassageTooLong('a'.repeat(UNPACK_MAX_PASSAGE_CHARACTERS))).toBe(false);
  });

  it('refuses a passage over the limit', () => {
    expect(isPassageTooLong('a'.repeat(UNPACK_MAX_PASSAGE_CHARACTERS + 1))).toBe(true);
  });
});

describe('previewOpening', () => {
  it('shows the first two sentences and marks that more follows', () => {
    expect(previewOpening('One thing happened. Then another. And a third.')).toBe('One thing happened. Then another.…');
  });

  it('shows the whole text with no mark when it is two sentences or fewer', () => {
    expect(previewOpening('One thing happened. Then another.')).toBe('One thing happened. Then another.');
  });

  it('shows only the first sentence when two would make the preview too long', () => {
    const long = `Word ${'word '.repeat(40).trim()}.`;

    expect(previewOpening(`${long} ${long} ${long}`)).toBe(`${long}…`);
  });
});

describe('alsoCoversLine', () => {
  it('names the terms when there are several', () => {
    expect(alsoCoversLine(3)).toBe('The full explanation also covers why it matters and 3 key terms.');
  });

  it('uses the singular for one term', () => {
    expect(alsoCoversLine(1)).toBe('The full explanation also covers why it matters and 1 key term.');
  });

  it('leaves out terms when there are none', () => {
    expect(alsoCoversLine(0)).toBe('The full explanation also covers why it matters.');
  });
});

describe('unpackErrorCopy', () => {
  it('asks for a shorter passage when the selection is too long, and blocks sending it', () => {
    expect(unpackErrorCopy('selectionTooLong')).toEqual({
      message: 'Select a shorter passage.',
      canRetry: false,
      canSend: false,
    });
  });

  it('offers to try again when the AI call failed, and still lets the participant send', () => {
    expect(unpackErrorCopy('unpackFailed')).toEqual({
      message: "Berkie couldn't unpack this just now.",
      canRetry: true,
      canSend: true,
    });
  });

  it.each(['chunkNotInTranscript', 'offsetPastEnd', 'selectionBackwards'] as const)(
    'asks the participant to select again when the server refuses the selection (%s)',
    (reason) => {
      expect(unpackErrorCopy(reason)).toEqual({
        message: "Berkie couldn't read that selection. Try selecting it again.",
        canRetry: false,
        canSend: false,
      });
    },
  );

  it('falls back to a general message when there is no reason', () => {
    expect(unpackErrorCopy(undefined)).toEqual({
      message: 'Something went wrong. Try again.',
      canRetry: true,
      canSend: true,
    });
  });

  it.each(['rateLimited', 'unpackerOff', 'noAssistant', 'noPrivateChat'] as const)('has a message for %s', (reason) => {
    expect(unpackErrorCopy(reason).message).not.toBe('Something went wrong. Try again.');
  });
});
