import { RefObject, useEffect, useRef } from 'react';
import { TranscriptSelection } from '../types.internal';
import { countWords, UNPACK_MIN_WORDS } from '../utils/unpackPassage';

const CHUNK_TEXT_SELECTOR = '[data-chunk-text]';

function offsetWithin(element: Element, node: Node, offset: number): number {
  const before = document.createRange();
  before.selectNodeContents(element);
  before.setEnd(node, offset);
  return before.toString().length;
}

/**
 * Reads the browser's selection as transcript chunk IDs and character positions.
 * Only text inside `[data-chunk-text]` elements counts, so a selection that starts on a timestamp
 * starts at the beginning of that chunk's text.
 * @param container - the element holding the transcript chunks, each inside a `[data-message-id]` element
 * @returns the selection, or null when it is empty or outside every chunk
 */
export function readTranscriptSelection(container: HTMLElement, selection: Selection | null): TranscriptSelection | null {
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return null;
  const range = selection.getRangeAt(0);

  const pieces = Array.from(container.querySelectorAll(CHUNK_TEXT_SELECTOR)).flatMap((element) => {
    if (!range.intersectsNode(element)) return [];
    const length = element.textContent?.length ?? 0;
    const from = element.contains(range.startContainer) ? offsetWithin(element, range.startContainer, range.startOffset) : 0;
    const to = element.contains(range.endContainer) ? offsetWithin(element, range.endContainer, range.endOffset) : length;
    const id = element.closest('[data-message-id]')?.getAttribute('data-message-id');
    if (!id || from >= to) return [];
    return [{ id, from, to, text: (element.textContent ?? '').slice(from, to) }];
  });
  if (pieces.length === 0) return null;

  const first = pieces[0];
  const last = pieces[pieces.length - 1];
  return {
    selection: { startMessageId: first.id, startOffset: first.from, endMessageId: last.id, endOffset: last.to },
    text: pieces.map(({ text }) => text).join(' '),
    range: range.cloneRange(),
  };
}

/**
 * Calls onSelect when the participant highlights at least UNPACK_MIN_WORDS words of the transcript.
 * A mouse selection is reported when the button is released, so the popover doesn't chase the pointer
 * mid-drag; a keyboard selection is reported as it changes. An emptied selection reports nothing, since
 * clicking a popover button clears the selection and must not close the popover.
 */
export function useTranscriptSelection(
  containerRef: RefObject<HTMLElement | null>,
  enabled: boolean,
  onSelect: (selection: TranscriptSelection) => void,
) {
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  useEffect(() => {
    const container = containerRef.current;
    if (!enabled || !container) return;
    let pointerIsDown = false;

    const report = () => {
      const result = readTranscriptSelection(container, window.getSelection());
      if (result && countWords(result.text) >= UNPACK_MIN_WORDS) onSelectRef.current(result);
    };
    const handlePointerDown = () => {
      pointerIsDown = true;
    };
    const handlePointerUp = () => {
      if (!pointerIsDown) return;
      pointerIsDown = false;
      report();
    };
    const handleSelectionChange = () => {
      if (!pointerIsDown) report();
    };

    container.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('pointerup', handlePointerUp);
    document.addEventListener('selectionchange', handleSelectionChange);
    return () => {
      container.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('pointerup', handlePointerUp);
      document.removeEventListener('selectionchange', handleSelectionChange);
    };
  }, [containerRef, enabled]);
}
