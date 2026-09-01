import { useEffect, useState } from 'react';
import { LoungeRoom, PseudonymousMessage } from '../types.internal';
import { Api, RetrieveData } from '../utils';
import { parseMessageBody } from '../utils/Helpers';
import { getRoomLastReadAt } from '../utils/roomReadState';

export interface UseLoungeRoomsReturn {
  rooms: LoungeRoom[];
  loaded: boolean;
  error: string | null;
}

/** Cuts a preview down to roughly one line before the row's own ellipsis takes over. */
const PREVIEW_MAX_LENGTH = 120;

function newestVisibleMessage(messages: PseudonymousMessage[]): PseudonymousMessage | null {
  // Replies belong to a thread rather than the feed, so a busy thread would
  // otherwise keep overwriting the preview with text nobody sees on arrival.
  const inFeed = messages.filter((message) => message.visible !== false && !message.parentMessage);
  if (!inFeed.length) return null;
  return inFeed.reduce((newest, message) =>
    new Date(message.createdAt ?? 0) > new Date(newest.createdAt ?? 0) ? message : newest,
  );
}

function buildPreview(message: PseudonymousMessage, userId: string): string {
  const sender = message.owner === userId ? 'You' : message.pseudonym;
  const text = parseMessageBody(message.body).text.replace(/\s+/g, ' ').trim();
  const line = `${sender}: ${text}`;
  return line.length > PREVIEW_MAX_LENGTH ? `${line.slice(0, PREVIEW_MAX_LENGTH)}…` : line;
}

/**
 * The room list comes from the conversations the member owns or follows, which is
 * the only listing endpoint that exists today: a member who was added by roster
 * import but has never followed a room will not see it here until the backend
 * grows a membership-backed listing.
 * @param userId The signed-in member's id, or null while the session is still resolving.
 * @returns The rooms plus load and error state.
 */
export function useLoungeRooms(userId: string | null): UseLoungeRoomsReturn {
  const [rooms, setRooms] = useState<LoungeRoom[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return undefined;
    let cancelled = false;

    async function fetchRooms() {
      const token = Api.get().getAccessToken();
      const conversations = await RetrieveData('conversations/userConversations', token);

      if (cancelled) return;
      if (!conversations || 'error' in conversations) {
        console.error("Could not list the member's rooms:", conversations?.status, conversations?.message);
        setError('Could not load your rooms.');
        setLoaded(true);
        return;
      }

      const communityRooms = (conversations as { id: string; name: string; conversationType?: string }[]).filter(
        (conversation) => conversation.conversationType === 'communityRoom',
      );

      const withPreviews = await Promise.all(
        communityRooms.map(async (conversation) => {
          // A room's chat channel carries no passcode, so the trailing comma is the
          // whole of it: the same shape the room page itself fetches with.
          const messages = await RetrieveData(`messages/${conversation.id}?channel=chat,`, token);
          const newest = Array.isArray(messages) ? newestVisibleMessage(messages) : null;
          const lastReadAt = getRoomLastReadAt(conversation.id);

          return {
            id: conversation.id,
            name: conversation.name,
            preview: newest ? buildPreview(newest, userId!) : '',
            lastMessageAt: newest?.createdAt ?? null,
            hasUnread:
              !!newest && newest.owner !== userId && (!lastReadAt || new Date(newest.createdAt ?? 0) > new Date(lastReadAt)),
          };
        }),
      );

      if (cancelled) return;
      withPreviews.sort((a, b) => new Date(b.lastMessageAt ?? 0).getTime() - new Date(a.lastMessageAt ?? 0).getTime());
      setRooms(withPreviews);
      setLoaded(true);
    }

    fetchRooms().catch((thrown) => {
      if (cancelled) return;
      console.error('Could not load the lounge:', thrown);
      setError('Could not load your rooms.');
      setLoaded(true);
    });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  return { rooms, loaded, error };
}
