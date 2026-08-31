import { CSSProperties, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { IBM_Plex_Mono, IBM_Plex_Sans, Space_Grotesk } from 'next/font/google';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import HomeIcon from '@mui/icons-material/Home';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import SearchIcon from '@mui/icons-material/Search';
import { Api, RetrieveData } from '../utils';
import { CheckAuthHeader } from '../utils/Helpers';
import { UserPseudonym } from '../types.internal';
import { useLoungeRooms, useSessionJoin } from '../hooks';
import { LoungeRoomRow } from '../components/room/LoungeRoomRow';
import { getRoomInitials } from '../utils/roomAvatarUtils';
import styles from '../components/room/communityRoom.module.css';

const displayFont = Space_Grotesk({ subsets: ['latin'], weight: ['600', '700'] });
const bodyFont = IBM_Plex_Sans({ subsets: ['latin'], weight: ['400', '500', '600'] });
const monoFont = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500', '600'] });

const roomFontVariables = {
  '--room-font-display': displayFont.style.fontFamily,
  '--room-font-body': bodyFont.style.fontFamily,
  '--room-font-mono': monoFont.style.fontFamily,
} as CSSProperties;

export const getServerSideProps = async (context: { req: any }) => {
  return CheckAuthHeader(context.req.headers);
};

/**
 * The member's home after signing in: every community room they can open, with the
 * latest line from each. Rooms are only ever added by invite code, so there is no
 * directory to browse from here.
 */
export default function LoungePage() {
  const router = useRouter();
  const { pseudonym: sessionPseudonym, userId } = useSessionJoin(false);
  const { rooms, loaded, error } = useLoungeRooms(userId);
  const [accountName, setAccountName] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!userId || !Api.get().GetTokens()) return undefined;
    let cancelled = false;

    (async () => {
      const account = await RetrieveData(`users/user/${userId}`, Api.get().getAccessToken());
      if (cancelled) return;
      if (!account || account.error) {
        console.warn('Could not read this account, so the lounge falls back to the session name:', account?.status);
        return;
      }
      // Every room registers the same real name for a member, so any entry names them.
      const pseudonyms: UserPseudonym[] = account.pseudonyms ?? [];
      const realName = pseudonyms.find((pseudonym) => pseudonym.isRealName);
      if (realName) setAccountName(realName.pseudonym);
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const displayName = accountName ?? sessionPseudonym;

  const visibleRooms = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return rooms;
    return rooms.filter((room) => room.name.toLowerCase().includes(trimmed));
  }, [rooms, query]);

  return (
    <div className={styles.root} style={{ display: 'flex', flexDirection: 'column', height: '100vh', ...roomFontVariables }}>
      <header className={styles.header}>
        <h1 className={`${styles.headerTitle} ${styles.loungeTitle}`}>Your rooms</h1>
        {displayName && (
          <button type="button" aria-label={`Your account, ${displayName}`} className={styles.accountButton}>
            <span aria-hidden="true" className={styles.accountAvatar}>
              {getRoomInitials(displayName)}
            </span>
          </button>
        )}
      </header>

      <div className={styles.loungeBody}>
        <div className={styles.loungeSearch}>
          <SearchIcon aria-hidden="true" sx={{ fontSize: 18 }} style={{ color: 'var(--room-text-muted)' }} />
          <input
            type="search"
            aria-label="Search your rooms"
            placeholder="Search your rooms"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className={styles.loungeSearchInput}
          />
        </div>

        {error && (
          <p role="alert" className={styles.loungeNotice}>
            {error}
          </p>
        )}

        <div className={styles.loungeList}>
          {visibleRooms.map((room) => (
            <LoungeRoomRow key={room.id} room={room} onOpen={(roomId) => router.push(`/room/${roomId}`)} />
          ))}
        </div>

        {loaded && !error && !rooms.length && (
          <p className={styles.loungeNotice}>You are not in any rooms yet. An invite code will add your first one.</p>
        )}
        {loaded && !!rooms.length && !visibleRooms.length && (
          <p className={styles.loungeNotice}>No rooms match &ldquo;{query.trim()}&rdquo;.</p>
        )}

        <Link href="/join" className={styles.loungeJoin}>
          <AddCircleOutlineIcon aria-hidden="true" sx={{ fontSize: 18 }} />
          Join a room with an invite code
        </Link>
      </div>

      <nav aria-label="Main sections" className={styles.nav}>
        <Link href="/lounge" aria-current="page" className={`${styles.navButton} ${styles.navButtonActive}`}>
          <HomeIcon sx={{ fontSize: 24 }} style={{ color: 'var(--room-text-primary)' }} />
          <span className={styles.navLabelActive}>Lounge</span>
        </Link>
        <Link href="/profile" className={styles.navButton}>
          <PersonOutlineIcon sx={{ fontSize: 24 }} style={{ color: 'var(--room-text-muted)' }} />
          <span className={styles.navLabelIdle}>Profile</span>
        </Link>
      </nav>
    </div>
  );
}
