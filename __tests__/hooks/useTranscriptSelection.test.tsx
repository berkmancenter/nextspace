import React, { useRef } from 'react';
import { fireEvent, render } from '@testing-library/react';
import { readTranscriptSelection, useTranscriptSelection } from '../../hooks/useTranscriptSelection';
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

  it('ignores an empty selection', () => {
    const { getByTestId } = render(<Fixture onSelect={jest.fn()} />);
    const container = getByTestId('transcript');
    const text = chunkTextNode(container, 'c1');

    expect(readTranscriptSelection(container, select(text, 4, text, 4))).toBeNull();
  });
});

describe('useTranscriptSelection', () => {
  afterEach(() => window.getSelection()?.removeAllRanges());

  it('reports a selection once the mouse button is released', () => {
    const onSelect = jest.fn();
    const { getByTestId } = render(<Fixture onSelect={onSelect} />);
    const container = getByTestId('transcript');
    const text = chunkTextNode(container, 'c2');

    fireEvent.pointerDown(text.parentElement!);
    select(text, 0, text, SECOND.indexOf(' in a few'));
    fireEvent(document, new Event('selectionchange'));
    expect(onSelect).not.toHaveBeenCalled();

    fireEvent.pointerUp(document);

    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ text: 'Precedential weight concentrates' }));
  });

  it('reports a selection made with the keyboard as it changes', () => {
    const onSelect = jest.fn();
    const { getByTestId } = render(<Fixture onSelect={onSelect} />);
    const text = chunkTextNode(getByTestId('transcript'), 'c1');

    select(text, 0, text, 'We built on'.length);
    fireEvent(document, new Event('selectionchange'));

    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ text: 'We built on' }));
  });

  it('skips a selection of fewer than three words', () => {
    const onSelect = jest.fn();
    const { getByTestId } = render(<Fixture onSelect={onSelect} />);
    const text = chunkTextNode(getByTestId('transcript'), 'c1');

    select(text, 0, text, 'We built'.length);
    fireEvent(document, new Event('selectionchange'));

    expect(onSelect).not.toHaveBeenCalled();
  });

  it('reports nothing while turned off', () => {
    const onSelect = jest.fn();
    const { getByTestId } = render(<Fixture onSelect={onSelect} enabled={false} />);
    const text = chunkTextNode(getByTestId('transcript'), 'c1');

    select(text, 0, text, FIRST.length);
    fireEvent(document, new Event('selectionchange'));

    expect(onSelect).not.toHaveBeenCalled();
  });
});
