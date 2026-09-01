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
 * Rendered for any message whose body type is `memberIntro`; the props come from
 * that body's `content` payload rather than from the message itself.
 */
export function MemberIntroCard({ name, role, joinedLabel, bio }: MemberIntroCardProps) {
  const firstName = name.trim().split(/\s+/)[0];
  const roleLine = role && joinedLabel ? `${role} · ${joinedLabel}` : role || joinedLabel;

  return (
    <div role="group" aria-label="Introduction posted by Berkie" className={styles.introCardWrap}>
      <div className={styles.introCardHeader}>
        <BotIcon size={18} color="var(--room-berkie-accent)" />
        <span className={styles.introCardLabel}>Introduced by Berkie</span>
        <span className={styles.agentBadge}>AI Bot</span>
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
          {`From the bio ${firstName} wrote when they joined. Posted once. Berkie won't mention it again.`}
        </p>
      </div>
    </div>
  );
}
