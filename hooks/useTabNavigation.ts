import { useState, useRef, useEffect } from 'react';
import type { NextRouter } from 'next/router';
import { NavTab } from '../components/NavigationBar';
import { trackConversationEvent } from '../utils/analytics';

interface UseTabNavigationParams {
  router: NextRouter;
  onClearUnseenResources: () => void;
  onClearResourcesBadge: () => void;
}

export interface UseTabNavigationReturn {
  activeTab: NavTab;
  activeTabRef: React.MutableRefObject<NavTab>;
  unseenAssistantCount: number;
  setUnseenAssistantCount: React.Dispatch<React.SetStateAction<number>>;
  unseenChatCount: number;
  setUnseenChatCount: React.Dispatch<React.SetStateAction<number>>;
  handleTabChange: (tab: NavTab) => void;
}

export function useTabNavigation({
  router,
  onClearUnseenResources,
  onClearResourcesBadge,
}: UseTabNavigationParams): UseTabNavigationReturn {
  const [activeTab, setActiveTab] = useState<NavTab>('chat');
  const [unseenAssistantCount, setUnseenAssistantCount] = useState<number>(0);
  const [unseenChatCount, setUnseenChatCount] = useState<number>(0);
  const activeTabRef = useRef<NavTab>('chat');

  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);

  const handleTabChange = (tab: NavTab) => {
    const leavingTab = activeTabRef.current;
    setActiveTab(tab);

    if (router.query.view) {
      const { view: _, ...rest } = router.query;
      router.replace({ pathname: router.pathname, query: rest }, undefined, { shallow: true });
    }

    if (tab === 'assistant') {
      setUnseenAssistantCount(0);
    } else if (tab === 'chat') {
      setUnseenChatCount(0);
    } else if (tab === 'resources') {
      onClearResourcesBadge();
    }

    if (leavingTab === 'resources' && tab !== 'resources') {
      onClearUnseenResources();
    }

    trackConversationEvent(router.query.conversationId as string, 'assistant', 'tab_switched', tab);
  };

  return {
    activeTab,
    activeTabRef,
    unseenAssistantCount,
    setUnseenAssistantCount,
    unseenChatCount,
    setUnseenChatCount,
    handleTabChange,
  };
}
