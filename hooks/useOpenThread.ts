import { useEffect, useState } from 'react';
import { PseudonymousMessage } from '../types.internal';

/**
 * Tracks which thread is open in the split view, and closes it when its parent message leaves
 * the list (an admin hid it and the reader is neither an admin nor its author), so the split
 * layout does not stay open around an empty pane. A message that returns does not reopen it.
 * @param parentMessages The top-level messages the reader can see.
 * @returns The open thread's id and parent (null when none), and a setter for the id.
 */
export function useOpenThread(parentMessages: PseudonymousMessage[]) {
  const [requestedId, setSelectedThreadId] = useState<string | null>(null);
  const selectedThread = requestedId ? (parentMessages.find((m) => m.id === requestedId) ?? null) : null;

  useEffect(() => {
    if (requestedId && !selectedThread) setSelectedThreadId(null);
  }, [requestedId, selectedThread]);

  return { selectedThreadId: selectedThread ? requestedId : null, selectedThread, setSelectedThreadId };
}
