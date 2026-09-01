import React from 'react';
import GroupIcon from '@mui/icons-material/Group';
import GroupOutlinedIcon from '@mui/icons-material/GroupOutlined';
import { BotIcon } from '../BotIcon';
import type { NavTab } from '../NavigationBar';
import styles from './communityRoom.module.css';

export type CommunityNavTab = Extract<NavTab, 'chat' | 'assistant'>;

interface CommunityNavigationBarProps {
  activeTab: CommunityNavTab;
  onTabChange: (tab: CommunityNavTab) => void;
  unreadAssistantCount: number;
  botName: string;
}

/**
 * The community room's two-tab bottom nav (Group Chat / Bot). Unlike the
 * shared NavigationBar, this stays a bottom bar at every viewport width per
 * the Solar Signal design, and marks unread bot messages with three
 * non-color cues: a dot, a bold/mono label swap, and an aria-label count.
 */
export function CommunityNavigationBar({
  activeTab,
  onTabChange,
  unreadAssistantCount,
  botName,
}: CommunityNavigationBarProps) {
  const assistantHasUnread = unreadAssistantCount > 0 && activeTab !== 'assistant';

  const assistantLabel = assistantHasUnread
    ? `${botName}, ${unreadAssistantCount} unread message${unreadAssistantCount === 1 ? '' : 's'}`
    : botName;

  return (
    <nav aria-label="Room sections" className={styles.nav}>
      <button
        type="button"
        aria-current={activeTab === 'chat' ? 'page' : undefined}
        onClick={() => onTabChange('chat')}
        className={`${styles.navButton} ${activeTab === 'chat' ? styles.navButtonActive : ''}`}
        aria-label="Group Chat"
      >
        {activeTab === 'chat' ? (
          <GroupIcon sx={{ fontSize: 24 }} style={{ color: 'var(--room-text-primary)' }} />
        ) : (
          <GroupOutlinedIcon sx={{ fontSize: 24 }} style={{ color: 'var(--room-text-muted)' }} />
        )}
        <span className={activeTab === 'chat' ? styles.navLabelActive : styles.navLabelIdle}>Group Chat</span>
      </button>

      <button
        type="button"
        aria-current={activeTab === 'assistant' ? 'page' : undefined}
        onClick={() => onTabChange('assistant')}
        className={`${styles.navButton} ${activeTab === 'assistant' ? styles.navButtonActive : ''} ${
          assistantHasUnread ? styles.navButtonUnread : ''
        }`}
        aria-label={assistantLabel}
      >
        <span className={styles.navIconWithDot}>
          <BotIcon size={24} color={activeTab === 'assistant' ? 'var(--room-text-primary)' : 'var(--room-text-muted)'} />
          {assistantHasUnread && <span aria-hidden="true" className={styles.unreadDot} />}
        </span>
        <span className={activeTab === 'assistant' || assistantHasUnread ? styles.navLabelActive : styles.navLabelIdle}>
          {botName}
        </span>
      </button>
    </nav>
  );
}
