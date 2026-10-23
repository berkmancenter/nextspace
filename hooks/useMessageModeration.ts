import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type { Socket } from 'socket.io-client';
import { SendData } from '../utils';
import { applyModerationEvent } from '../utils/messageModeration';
import type { MessageModeration } from '../components/ModerationControls';
import type {
  HideResult,
  MessageHiddenEvent,
  MessageHiddenNoticeEvent,
  ModerationReason,
  PseudonymousMessage,
} from '../types.internal';

/** A short-lived notice about a moderation outcome that is not a failure of the page itself. */
export interface ModerationToast {
  severity: 'info' | 'error';
  text: string;
}

/**
 * Parameters required for the useMessageModeration hook.
 */
export interface UseMessageModerationParams {
  /** The live socket, or null before it connects. */
  socket: Socket | null;
  /** The reader's account id. A hidden author keeps seeing their own messages. */
  userId: string | null;
  /** The conversation whose group chat is being moderated. */
  conversationId: string | undefined;
  /** Whether the reader holds the admin role. False for guests and when the account could not be read. */
  isAdmin: boolean;
  /** The group chat messages, used to find everything one author posted. */
  chatMessages: PseudonymousMessage[];
  setChatMessages: Dispatch<SetStateAction<PseudonymousMessage[]>>;
  /** Private assistant messages also receive `message:hidden`, since the event carries ids only. */
  setAssistantMessages: Dispatch<SetStateAction<PseudonymousMessage[]>>;
  /**
   * Optimistic verdicts still waiting on the server, by message id. The same ref goes to
   * useConversationMessages so a fetch that lands in the meantime keeps them; it has to be created
   * by the caller because that hook supplies the setters this one needs.
   */
  pendingHiddenRef: MutableRefObject<Map<string, boolean>>;
}

/**
 * Return value of the useMessageModeration hook.
 */
export interface UseMessageModerationReturn {
  /** Hide controls for the group chat panel; undefined unless the reader is an admin. */
  moderation: MessageModeration | undefined;
  /** The notice to show, if any: an author's message was limited, or an admin action failed. */
  toast: ModerationToast | null;
  /** Dismisses the notice. */
  clearToast: () => void;
}

/**
 * Admin hide/unhide for a group chat, shared by every page that renders one.
 *
 * Applies `message:hidden` events to both message lists, tells an author when a moderator limited
 * their messages (`message:hidden-notice`), and builds the controls an admin acts through. An
 * action shows at once and the server's event then confirms it; a refusal puts it back and says so.
 * @param params See UseMessageModerationParams.
 * @returns The controls and notice state; see UseMessageModerationReturn.
 */
export function useMessageModeration({
  socket,
  userId,
  conversationId,
  isAdmin,
  chatMessages,
  setChatMessages,
  setAssistantMessages,
  pendingHiddenRef,
}: UseMessageModerationParams): UseMessageModerationReturn {
  const [toast, setToast] = useState<ModerationToast | null>(null);
  const clearToast = useCallback(() => setToast(null), []);

  useEffect(() => {
    if (!socket) return undefined;

    // The event carries ids only; ids that are not in a list are skipped, so both lists get it.
    const onHidden = (event: MessageHiddenEvent) => {
      const viewer = { isAdmin, selfId: userId };
      setChatMessages((prev) => applyModerationEvent(prev, event, viewer));
      setAssistantMessages((prev) => applyModerationEvent(prev, event, viewer));
    };

    // Also arrives on the per-user room, so it is only this conversation's when the id matches.
    const onHiddenNotice = (notice?: MessageHiddenNoticeEvent) => {
      if (!conversationId || notice?.conversationId !== conversationId) return;
      setToast({ severity: 'info', text: 'A moderator has limited the visibility of your message(s).' });
    };

    socket.on('message:hidden', onHidden);
    socket.on('message:hidden-notice', onHiddenNotice);
    return () => {
      socket.off('message:hidden', onHidden);
      socket.off('message:hidden-notice', onHiddenNotice);
    };
  }, [socket, isAdmin, userId, conversationId, setChatMessages, setAssistantMessages]);

  const applyAsAdmin = useCallback(
    (ids: string[], hidden: boolean) => {
      const event: MessageHiddenEvent = { messageIds: ids, hidden, display: 'omit' };
      setChatMessages((prev) => applyModerationEvent(prev, event, { isAdmin: true }));
    },
    [setChatMessages],
  );

  // The newest moderation action per message id. A response only settles ids no later action has
  // claimed, so a slow request cannot undo what the admin did after it.
  const moderationSeqRef = useRef(0);
  const latestActionRef = useRef(new Map<string, number>());

  const sendModeration = useCallback(
    async (path: string, hide: boolean, ids: string[], reason?: ModerationReason) => {
      moderationSeqRef.current += 1;
      const seq = moderationSeqRef.current;
      const latest = latestActionRef.current;
      const pending = pendingHiddenRef.current;
      ids.forEach((id) => {
        latest.set(id, seq);
        pending.set(id, hide);
      });
      const isLatest = (id: string) => (latest.get(id) ?? 0) <= seq;

      applyAsAdmin(ids, hide);
      try {
        // A skipped reason sends no body at all, as before; a chosen one goes in the JSON body.
        const body = hide && reason ? { reason } : undefined;
        const response = await SendData(path, body, undefined, undefined, hide ? 'POST' : 'DELETE');
        if (!response || 'error' in response) {
          applyAsAdmin(ids.filter(isLatest), !hide);
          setToast({ severity: 'error', text: `Could not ${hide ? 'hide' : 'unhide'} the message(s). Try again.` });
          return;
        }
        // The server lists the ids that really changed, cascaded replies included. Settle on those:
        // anything guessed that did not change (still hidden for another reason) goes back.
        const changed = (response as HideResult).messageIds;
        if (!Array.isArray(changed)) return;
        applyAsAdmin(
          ids.filter((id) => !changed.includes(id) && isLatest(id)),
          !hide,
        );
        applyAsAdmin(changed.filter(isLatest), hide);
      } finally {
        ids.forEach((id) => {
          if (latest.get(id) === seq) pending.delete(id);
        });
      }
    },
    [applyAsAdmin, pendingHiddenRef],
  );

  const moderation: MessageModeration | undefined = useMemo(() => {
    if (!isAdmin || !conversationId) return undefined;
    return {
      onToggleHidden: (message, reason) => {
        if (!message.id) return;
        sendModeration(`messages/${message.id}/hide`, !message.hidden, [message.id], reason);
      },
      onToggleHideAuthor: (message, unhide, reason) => {
        if (!message.owner) return;
        const ids = chatMessages
          .filter((m) => m.owner === message.owner && m.id && Boolean(m.hidden) === unhide)
          .map((m) => m.id as string);
        sendModeration(`conversations/${conversationId}/users/${message.owner}/hide-messages`, !unhide, ids, reason);
      },
      isAuthorHidden: (message) => {
        const theirs = chatMessages.filter((m) => m.owner && m.owner === message.owner);
        return theirs.length > 0 && theirs.every((m) => m.hidden);
      },
    };
  }, [isAdmin, conversationId, chatMessages, sendModeration]);

  return { moderation, toast, clearToast };
}
