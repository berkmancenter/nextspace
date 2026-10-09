import { useCallback, useEffect, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { Api, RetrieveData, SendData, emitWithTokenRefresh } from '../utils';

export interface UserPreferences {
  jargonClarification: boolean;
  visualResponse: boolean;
}

export interface UseUserPreferencesReturn {
  preferences: UserPreferences;
  loading: boolean;
  updatePreference: (key: keyof UserPreferences) => Promise<void>;
}

const DEFAULT_PREFERENCES: UserPreferences = { jargonClarification: false, visualResponse: false };

/**
 * Single source of truth for this user's preferences, shared between PreferencesPanel (which
 * reads and writes them) and anything elsewhere on the page that needs to react to them live
 * (e.g. gating the jargon notification banner) — without either needing to know about the other.
 *
 * Cross-tab/cross-device sync comes from the server's `preferences:updated` broadcast (same
 * pattern as `resources:updated` elsewhere in this app), not from this hook's own local state:
 * a toggle made in another tab or on another device reaches every open session the same way a
 * toggle made right here does. The local optimistic update on `updatePreference` just makes the
 * toggle that triggered the change feel instant; the broadcast is what everyone else sees.
 */
export function useUserPreferences(userId: string | null, socket: Socket | null): UseUserPreferencesReturn {
  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_PREFERENCES);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    const fetchPreferences = async () => {
      const result = await RetrieveData(`users/user/${userId}/preferences`, Api.get().getAccessToken());
      if (result && typeof result === 'object' && !('error' in result) && Object.keys(result).length > 0) {
        const { jargonClarification, visualResponse } = result as Record<string, boolean>;
        setPreferences((prev) => ({
          ...prev,
          ...(jargonClarification !== undefined && { jargonClarification }),
          ...(visualResponse !== undefined && { visualResponse }),
        }));
      }
      setLoading(false);
    };
    fetchPreferences();
  }, [userId]);

  useEffect(() => {
    if (!socket || !userId) return;

    const handlePreferencesUpdated = (payload: { userId: string; preferences: UserPreferences }) => {
      if (payload.userId !== userId) return;
      setPreferences(payload.preferences);
    };
    socket.on('preferences:updated', handlePreferencesUpdated);

    // Subscribes this socket to the room the server broadcasts preferences:updated on (named
    // after the user's own id, via a `user:join` emit). Room membership doesn't survive a
    // reconnect, so this re-joins on every 'connect' event too — same pattern as
    // conversation:join in pages/assistant.tsx.
    const joinUserRoom = () => emitWithTokenRefresh(socket, 'user:join', { userId });
    socket.on('connect', joinUserRoom);
    if (socket.connected) {
      joinUserRoom();
    }

    return () => {
      socket.off('preferences:updated', handlePreferencesUpdated);
      socket.off('connect', joinUserRoom);
    };
  }, [socket, userId]);

  const updatePreference = useCallback(
    async (key: keyof UserPreferences) => {
      if (!userId) return;
      const updated = { ...preferences, [key]: !preferences[key] };
      setPreferences(updated);
      await SendData(`users/user/${userId}/preferences`, updated, undefined, undefined, 'PUT');
    },
    [userId, preferences],
  );

  return { preferences, loading, updatePreference };
}
