import { RefObject, useEffect, useRef } from 'react';
import { SelectionEnds, TranscriptSelection } from '../types.internal';
import { isScrollbarPress } from '../utils/Helpers';
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
 * @returns the selection, or null when it is empty, starts outside the container, or misses every chunk
 */
export function readTranscriptSelection(container: HTMLElement, selection: Selection | null): TranscriptSelection | null {
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return null;
  // Select All, or a drag from elsewhere on the page, starts outside and isn't a request about the transcript.
  if (!selection.anchorNode || !container.contains(selection.anchorNode)) return null;
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

const selectionEnds = (selection: Selection | null): SelectionEnds | null =>
  selection && {
    anchorNode: selection.anchorNode,
    anchorOffset: selection.anchorOffset,
    focusNode: selection.focusNode,
    focusOffset: selection.focusOffset,
  };

const sameEnds = (a: SelectionEnds | null, b: SelectionEnds | null) =>
  !!a &&
  !!b &&
  a.anchorNode === b.anchorNode &&
  a.anchorOffset === b.anchorOffset &&
  a.focusNode === b.focusNode &&
  a.focusOffset === b.focusOffset;

export const KEYBOARD_SELECTION_SETTLE_MS = 1000;

/**
 * Calls onSelect when the participant highlights at least UNPACK_MIN_WORDS words of the transcript.
 * Mouse selections report on release, so the popover doesn't chase the pointer. Keyboard ones report once they
 * hold still for KEYBOARD_SELECTION_SETTLE_MS, so each Shift+Arrow press doesn't ask for its own preview.
 * A press that leaves the selection unchanged reports nothing, so clicking the highlight doesn't reopen the popover.
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
    let endsAtPress: SelectionEnds | null = null;
    let settleTimer: ReturnType<typeof setTimeout> | undefined;

    const report = () => {
      const result = readTranscriptSelection(container, window.getSelection());
      if (result && countWords(result.text) >= UNPACK_MIN_WORDS) onSelectRef.current(result);
    };
    const handlePointerDown = (event: PointerEvent) => {
      // A right-click's release can go to the context menu instead, which would leave pointerIsDown stuck on.
      if (event.button !== 0 || isScrollbarPress(event)) return;
      clearTimeout(settleTimer);
      pointerIsDown = true;
      endsAtPress = selectionEnds(window.getSelection());
    };
    const handlePointerUp = () => {
      if (!pointerIsDown) return;
      pointerIsDown = false;
      if (!sameEnds(endsAtPress, selectionEnds(window.getSelection()))) report();
    };
    const handlePointerCancel = () => {
      pointerIsDown = false;
    };
    const handleSelectionChange = () => {
      if (pointerIsDown) return;
      clearTimeout(settleTimer);
      settleTimer = setTimeout(report, KEYBOARD_SELECTION_SETTLE_MS);
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('pointerup', handlePointerUp);
    document.addEventListener('pointercancel', handlePointerCancel);
    document.addEventListener('selectionchange', handleSelectionChange);
    return () => {
      clearTimeout(settleTimer);
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('pointerup', handlePointerUp);
      document.removeEventListener('pointercancel', handlePointerCancel);
      document.removeEventListener('selectionchange', handleSelectionChange);
    };
  }, [containerRef, enabled]);
}
