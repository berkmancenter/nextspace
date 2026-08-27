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
 * The one-time introduction Berkie posts on a member's first appearance in the
 * room. Rendered by the group feed for any message whose body type is
 * `memberIntro`; the fields come from that body's `content` payload.
 */
export function MemberIntroCard({ name, role, joinedLabel, bio }: MemberIntroCardProps) {
  const firstName = name.trim().split(/\s+/)[0];
  const roleLine = role && joinedLabel ? `${role} · ${joinedLabel}` : role || joinedLabel;

  return (
    <div role="group" aria-label="Introduction posted by Berkie" className={styles.introCardWrap}>
      <div className={styles.introCardAuthor}>
        <div className={styles.avatar} style={{ width: 32, height: 32, background: 'var(--room-berkie-avatar-bg)' }}>
          <BotIcon size={22} color="var(--room-berkie-accent)" />
        </div>
        <span className={styles.introCardAuthorName}>Berkie</span>
        <span className={styles.agentBadge}>AI Bot</span>
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
