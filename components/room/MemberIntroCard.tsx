import { BotIcon } from '../BotIcon';
import { getRoomInitials } from '../../utils/roomAvatarUtils';
import styles from './communityRoom.module.css';

interface MemberIntroCardProps {
  name: string;
  role?: string;
  joinedLabel?: string;
  bio: string;
}

/**
 * The one-time "Introduced by Berkie" card shown on a member's first
 * appearance in the room. Client-side heuristic pending ticket 18 — see
 * the room plan for why there's no backend signal yet to key this off.
 */
export function MemberIntroCard({ name, role, joinedLabel, bio }: MemberIntroCardProps) {
  const firstName = name.trim().split(/\s+/)[0];
  const roleLine = role && joinedLabel ? `${role} · ${joinedLabel}` : role || joinedLabel;

  return (
    <div role="group" aria-label="Introduction posted by Berkie" className={styles.introCardWrap}>
      <div className={styles.introCardHeader}>
        <BotIcon size={18} color="var(--room-berkie-accent)" />
        <span className={styles.introCardLabel}>Introduced by Berkie</span>
        <span className={styles.introCardRule} />
      </div>
      <div className={styles.introCardBody}>
        <div className={styles.introCardTopRow}>
          <div
            className={styles.avatar}
            style={{
              width: 40,
              height: 40,
              fontSize: 14,
              background: 'var(--room-other-avatar-bg)',
              color: 'var(--room-other-avatar-text)',
            }}
          >
            {getRoomInitials(name)}
          </div>
          <div>
            <div className={styles.introCardName}>{name}</div>
            {roleLine && <div className={styles.introCardRole}>{roleLine}</div>}
          </div>
        </div>
        <p className={styles.introCardBio}>{bio}</p>
        <p className={styles.introCardProvenance}>
          {`From the bio ${firstName} wrote when they joined. Posted once — Berkie won't mention it again.`}
        </p>
      </div>
    </div>
  );
}
