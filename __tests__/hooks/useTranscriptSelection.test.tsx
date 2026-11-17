import React, { useRef } from 'react';
import { act, fireEvent, render } from '@testing-library/react';
import {
  KEYBOARD_SELECTION_SETTLE_MS,
  readTranscriptSelection,
  useTranscriptSelection,
} from '../../hooks/useTranscriptSelection';
import { TranscriptSelection } from '../../types.internal';

const FIRST = 'We built on the Caselaw Access Project.';
const SECOND = 'Precedential weight concentrates in a few circuits.';

const chunkTextNode = (container: HTMLElement, id: string) =>
  container.querySelector(`[data-message-id="${id}"] [data-chunk-text]`)!.firstChild as Text;

function Fixture({ onSelect, enabled = true }: { onSelect: (selection: TranscriptSelection) => void; enabled?: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null);
  useTranscriptSelection(containerRef, enabled, onSelect);
  return (
    <div>
      <p data-testid="outside">Outside the transcript, with plenty of words.</p>
      <div ref={containerRef} data-testid="transcript">
        <div data-message-id="c1">
          <span>10:43 AM</span>
          <p data-chunk-text>{FIRST}</p>
        </div>
        <div data-message-id="c2">
          <span>10:44 AM</span>
          <p data-chunk-text>{SECOND}</p>
        </div>
      </div>
    </div>
  );
}

const select = (startNode: Node, startOffset: number, endNode: Node, endOffset: number) => {
  const range = document.createRange();
  range.setStart(startNode, startOffset);
  range.setEnd(endNode, endOffset);
  const selection = window.getSelection()!;
  selection.removeAllRanges();
  selection.addRange(range);
  return selection;
};

describe('readTranscriptSelection', () => {
  afterEach(() => window.getSelection()?.removeAllRanges());

  it('turns a selection inside one chunk into its chunk ID and character positions', () => {
    const { getByTestId } = render(<Fixture onSelect={jest.fn()} />);
    const container = getByTestId('transcript');
    const text = chunkTextNode(container, 'c2');
    const start = SECOND.indexOf('weight');
    const end = SECOND.indexOf(' in a few');

    const result = readTranscriptSelection(container, select(text, start, text, end));

    expect(result?.selection).toEqual({ startMessageId: 'c2', startOffset: start, endMessageId: 'c2', endOffset: end });
    expect(result?.text).toBe('weight concentrates');
  });

  it('spans chunks, leaving out the timestamps between them', () => {
    const { getByTestId } = render(<Fixture onSelect={jest.fn()} />);
    const container = getByTestId('transcript');
    const start = FIRST.indexOf('Access');

    const result = readTranscriptSelection(
      container,
      select(chunkTextNode(container, 'c1'), start, chunkTextNode(container, 'c2'), 'Precedential'.length),
    );

    expect(result?.selection).toEqual({
      startMessageId: 'c1',
      startOffset: start,
      endMessageId: 'c2',
      endOffset: 'Precedential'.length,
    });
    expect(result?.text).toBe('Access Project. Precedential');
  });

  it('starts at the beginning of a chunk when the selection begins on its timestamp', () => {
    const { getByTestId } = render(<Fixture onSelect={jest.fn()} />);
    const container = getByTestId('transcript');
    const timestamp = container.querySelector('[data-message-id="c2"] span')!.firstChild!;
    const text = chunkTextNode(container, 'c2');

    const result = readTranscriptSelection(container, select(timestamp, 0, text, 'Precedential weight'.length));

    expect(result?.selection.startOffset).toBe(0);
    expect(result?.selection.startMessageId).toBe('c2');
  });

  it('ignores a selection outside the transcript', () => {
    const { getByTestId } = render(<Fixture onSelect={jest.fn()} />);
    const outside = getByTestId('outside').firstChild!;

    expect(readTranscriptSelection(getByTestId('transcript'), select(outside, 0, outside, 20))).toBeNull();
  });

  it('ignores a selection that starts outside the transcript, such as Select All', () => {
    const { getByTestId } = render(<Fixture onSelect={jest.fn()} />);
    const container = getByTestId('transcript');
    const outside = getByTestId('outside').firstChild!;

    expect(readTranscriptSelection(container, select(outside, 0, chunkTextNode(container, 'c2'), 12))).toBeNull();
  });

  it('ignores an empty selection', () => {
    const { getByTestId } = render(<Fixture onSelect={jest.fn()} />);
    const container = getByTestId('transcript');
    const text = chunkTextNode(container, 'c1');

    expect(readTranscriptSelection(container, select(text, 4, text, 4))).toBeNull();
  });
});

// jsdom has no PointerEvent, and a plain Event carries no button or position.
const press = (target: Element, init: MouseEventInit = {}) =>
  fireEvent(target, new MouseEvent('pointerdown', { bubbles: true, button: 0, ...init }));

const giveScrollBar = (container: HTMLElement) => {
  Object.defineProperties(container, {
    clientWidth: { value: 300 },
    clientHeight: { value: 200 },
    scrollWidth: { value: 300 },
    scrollHeight: { value: 1000 },
  });
  container.getBoundingClientRect = () => ({ left: 0, top: 0, right: 315, bottom: 200, width: 315, height: 200 }) as DOMRect;
};

const changeSelection = () => fireEvent(document, new Event('selectionchange'));
const holdStill = (ms = KEYBOARD_SELECTION_SETTLE_MS) => act(() => jest.advanceTimersByTime(ms));

describe('useTranscriptSelection', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    jest.useRealTimers();
    window.getSelection()?.removeAllRanges();
  });

  it('reports a selection once the mouse button is released', () => {
    const onSelect = jest.fn();
    const { getByTestId } = render(<Fixture onSelect={onSelect} />);
    const container = getByTestId('transcript');
    const text = chunkTextNode(container, 'c2');

    press(text.parentElement!);
    select(text, 0, text, SECOND.indexOf(' in a few'));
    changeSelection();
    holdStill();
    expect(onSelect).not.toHaveBeenCalled();

    fireEvent.pointerUp(document);

    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ text: 'Precedential weight concentrates' }));
  });

  it('reports a keyboard selection once it has held still', () => {
    const onSelect = jest.fn();
    const { getByTestId } = render(<Fixture onSelect={onSelect} />);
    const text = chunkTextNode(getByTestId('transcript'), 'c1');

    select(text, 0, text, 'We built on'.length);
    changeSelection();
    holdStill(KEYBOARD_SELECTION_SETTLE_MS - 1);
    expect(onSelect).not.toHaveBeenCalled();
    holdStill(1);

    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ text: 'We built on' }));
  });

  it('reports only where a keyboard selection ends up while it keeps growing', () => {
    const onSelect = jest.fn();
    const { getByTestId } = render(<Fixture onSelect={onSelect} />);
    const text = chunkTextNode(getByTestId('transcript'), 'c1');

    select(text, 0, text, 'We built on'.length);
    changeSelection();
    holdStill(KEYBOARD_SELECTION_SETTLE_MS / 2);
    select(text, 0, text, 'We built on the'.length);
    changeSelection();
    holdStill();

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ text: 'We built on the' }));
  });

  it('drops a keyboard selection still settling when the transcript goes away', () => {
    const onSelect = jest.fn();
    const { getByTestId, unmount } = render(<Fixture onSelect={onSelect} />);
    const text = chunkTextNode(getByTestId('transcript'), 'c1');

    select(text, 0, text, 'We built on'.length);
    changeSelection();
    unmount();
    holdStill();

    expect(onSelect).not.toHaveBeenCalled();
  });

  it('waits for the release when a mouse drag starts while a keyboard selection settles', () => {
    const onSelect = jest.fn();
    const { getByTestId } = render(<Fixture onSelect={onSelect} />);
    const text = chunkTextNode(getByTestId('transcript'), 'c1');

    select(text, 0, text, 'We built on'.length);
    changeSelection();
    press(text.parentElement!);
    select(text, 0, text, 'We built on the'.length);
    holdStill();
    expect(onSelect).not.toHaveBeenCalled();

    fireEvent.pointerUp(document);

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ text: 'We built on the' }));
  });

  it('skips a selection of fewer than three words', () => {
    const onSelect = jest.fn();
    const { getByTestId } = render(<Fixture onSelect={onSelect} />);
    const text = chunkTextNode(getByTestId('transcript'), 'c1');

    select(text, 0, text, 'We built'.length);
    changeSelection();
    holdStill();

    expect(onSelect).not.toHaveBeenCalled();
  });

  it('still reports keyboard selections after a touch scroll is cancelled', () => {
    const onSelect = jest.fn();
    const { getByTestId } = render(<Fixture onSelect={onSelect} />);
    const text = chunkTextNode(getByTestId('transcript'), 'c1');

    press(text.parentElement!);
    fireEvent.pointerCancel(document);
    select(text, 0, text, 'We built on'.length);
    changeSelection();
    holdStill();

    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ text: 'We built on' }));
  });

  it('does not report the same highlight again when it is clicked', () => {
    const onSelect = jest.fn();
    const { getByTestId } = render(<Fixture onSelect={onSelect} />);
    const text = chunkTextNode(getByTestId('transcript'), 'c2');
    press(text.parentElement!);
    select(text, 0, text, SECOND.indexOf(' in a few'));
    fireEvent.pointerUp(document);
    onSelect.mockClear();

    press(text.parentElement!);
    fireEvent.pointerUp(document);

    expect(onSelect).not.toHaveBeenCalled();
  });

  it('ignores a press on the transcript scroll bar', () => {
    const onSelect = jest.fn();
    const { getByTestId } = render(<Fixture onSelect={onSelect} />);
    const container = getByTestId('transcript');
    const text = chunkTextNode(container, 'c2');
    giveScrollBar(container);
    select(text, 0, text, SECOND.indexOf(' in a few'));
    onSelect.mockClear();

    press(container, { clientX: 305, clientY: 50 });
    select(text, 0, text, SECOND.indexOf(' a few'));
    fireEvent.pointerUp(document);

    expect(onSelect).not.toHaveBeenCalled();
  });

  it('waits for the release when a drag starts in the transcript padding', () => {
    const onSelect = jest.fn();
    const { getByTestId } = render(<Fixture onSelect={onSelect} />);
    const container = getByTestId('transcript');
    const text = chunkTextNode(container, 'c2');
    giveScrollBar(container);

    press(container, { clientX: 5, clientY: 50 });
    select(text, 0, text, SECOND.indexOf(' in a few'));
    changeSelection();
    holdStill();
    expect(onSelect).not.toHaveBeenCalled();

    fireEvent.pointerUp(document);

    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ text: 'Precedential weight concentrates' }));
  });

  it('still reports keyboard selections after a right-click on the transcript', () => {
    const onSelect = jest.fn();
    const { getByTestId } = render(<Fixture onSelect={onSelect} />);
    const text = chunkTextNode(getByTestId('transcript'), 'c1');

    press(text.parentElement!, { button: 2 });
    select(text, 0, text, 'We built on'.length);
    changeSelection();
    holdStill();

    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ text: 'We built on' }));
  });

  it('ignores a drag that starts outside the transcript', () => {
    const onSelect = jest.fn();
    const { getByTestId } = render(<Fixture onSelect={onSelect} />);
    const outside = getByTestId('outside');
    const text = chunkTextNode(getByTestId('transcript'), 'c1');

    press(outside);
    select(outside.firstChild!, 0, text, FIRST.length);
    changeSelection();
    holdStill();
    fireEvent.pointerUp(document);

    expect(onSelect).not.toHaveBeenCalled();
  });

  it('waits for the release when a press outside the transcript is followed by a selection inside it', () => {
    const onSelect = jest.fn();
    const { getByTestId } = render(<Fixture onSelect={onSelect} />);
    const text = chunkTextNode(getByTestId('transcript'), 'c1');

    press(getByTestId('outside'));
    select(text, 0, text, 'We built on'.length);
    changeSelection();
    holdStill();

    expect(onSelect).not.toHaveBeenCalled();
  });

  it('reports nothing while turned off', () => {
    const onSelect = jest.fn();
    const { getByTestId } = render(<Fixture onSelect={onSelect} enabled={false} />);
    const text = chunkTextNode(getByTestId('transcript'), 'c1');

    select(text, 0, text, FIRST.length);
    changeSelection();
    holdStill();

    expect(onSelect).not.toHaveBeenCalled();
  });
});
