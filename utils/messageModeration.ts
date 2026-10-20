import { MessageHiddenEvent, PseudonymousMessage } from '../types.internal';

interface ModerationViewer {
  isAdmin: boolean;
  /** The reader's account id. A hidden author keeps seeing their own messages. */
  selfId?: string | null;
}

/**
 * Applies a `message:hidden` event to a flat message list (top-level messages and replies
 * together, as the room keeps them).
 *
 * Admins keep every message and see the `hidden` flag change. Everyone else loses a hidden
 * message (display 'omit') or keeps a body-less stub in its place ('placeholder'), except the
 * author, who is shadow-hidden and sees their own messages as before. An unhide changes nothing
 * for a non-admin: the server re-sends the full message through `message:new`.
 *
 * Returns the same array when nothing changed, so a state setter can skip a render.
 * @param messages The current messages.
 * @param event The moderation event from the server.
 * @param viewer Who is reading.
 * @returns The messages with the event applied.
 */
export const applyModerationEvent = (
  messages: PseudonymousMessage[],
  event: MessageHiddenEvent,
  { isAdmin, selfId }: ModerationViewer,
): PseudonymousMessage[] => {
  const ids = new Set(event.messageIds);
  if (ids.size === 0) return messages;

  if (isAdmin) {
    let changed = false;
    const next = messages.map((m) => {
      if (!m.id || !ids.has(m.id) || Boolean(m.hidden) === event.hidden) return m;
      changed = true;
      const { hidden: _previous, ...rest } = m;
      return event.hidden ? { ...rest, hidden: true } : rest;
    });
    return changed ? next : messages;
  }

  if (!event.hidden) return messages;

  const affected = (m: PseudonymousMessage) => Boolean(m.id && ids.has(m.id)) && !(selfId && m.owner && m.owner === selfId);
  if (!messages.some(affected)) return messages;

  if (event.display === 'omit') return messages.filter((m) => !affected(m));
  return messages.map((m) =>
    affected(m)
      ? ({
          id: m.id,
          createdAt: m.createdAt,
          parentMessage: m.parentMessage,
          hidden: true,
          body: null,
        } as PseudonymousMessage)
      : m,
  );
};

/**
 * Adds a message that arrived live. A message already present is replaced rather than repeated,
 * which is how an unhidden message takes the place of its stub or of an earlier copy, and clears the
 * `hidden` flag an admin held. A stub never replaces a full message. A message
 * that belongs before the newest ones (an unhidden older message) is slotted in by createdAt.
 * @param messages The current messages, oldest first.
 * @param incoming The message that arrived.
 * @returns The messages with the incoming one included once, in createdAt order.
 */
export const insertMessageInOrder = (
  messages: PseudonymousMessage[],
  incoming: PseudonymousMessage,
): PseudonymousMessage[] => {
  const existing = incoming.id ? messages.findIndex((m) => m.id === incoming.id) : -1;
  if (existing !== -1) {
    // A stub (placeholder policy) can arrive after the full message it stands for; the full one wins.
    if (incoming.body === null && messages[existing].body !== null) return messages;
    const next = [...messages];
    next[existing] = incoming;
    return next;
  }

  const stamp = incoming.createdAt ? new Date(incoming.createdAt).getTime() : NaN;
  if (Number.isNaN(stamp)) return [...messages, incoming];

  let at = messages.length;
  while (at > 0) {
    const previous = messages[at - 1].createdAt;
    if (!previous || new Date(previous).getTime() <= stamp) break;
    at -= 1;
  }
  return [...messages.slice(0, at), incoming, ...messages.slice(at)];
};
