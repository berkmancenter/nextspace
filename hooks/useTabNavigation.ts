import { useState, useRef, useEffect } from 'react';
import type { NextRouter } from 'next/router';
import { NavTab } from '../components/NavigationBar';
import { trackConversationEvent } from '../utils/analytics';

/**
 * Parameters required for the useTabNavigation hook, including the router and functions to clear unseen resources and resource badges.
 * @interface UseTabNavigationParams - Defines the structure of the parameters required for the useTabNavigation hook.
 * @property router - The Next.js router instance used for navigation and query management.
 * @property onClearUnseenResources - Function to clear unseen resources when navigating away from the resources tab.
 * @property onClearResourcesBadge - Function to clear the resources badge when the resources tab is accessed.
 */
export interface UseTabNavigationParams {
  router: NextRouter;
  onClearUnseenResources: () => void;
  onClearResourcesBadge: () => void;
}

/**
 * Interface for the return type of the useTabNavigation hook, defining the state and functions it provides.
 * @property activeTab - The currently active navigation tab.
 * @property activeTabRef - A mutable reference to the currently active navigation tab.
 * @property unseenAssistantCount - The count of unseen items in the assistant tab.
 * @property setUnseenAssistantCount - Function to update the unseen assistant count.
 * @property unseenChatCount - The count of unseen items in the chat tab.
 * @property setUnseenChatCount - Function to update the unseen chat count.
 * @property handleTabChange - Function to handle changes in the active tab.
 */
export interface UseTabNavigationReturn {
  activeTab: NavTab;
  activeTabRef: React.MutableRefObject<NavTab>;
  unseenAssistantCount: number;
  setUnseenAssistantCount: React.Dispatch<React.SetStateAction<number>>;
  unseenChatCount: number;
  setUnseenChatCount: React.Dispatch<React.SetStateAction<number>>;
  handleTabChange: (tab: NavTab) => void;
}

/**
 * Custom hook to manage tab navigation within the application.
 * It provides state and functions to track the active tab, unseen counts for assistant and chat tabs,
 * and handles tab changes including clearing unseen resources and resource badges.
 * See {@link UseTabNavigationParams} for parameter details.
 * @returns An object containing the state and functions for managing tab navigation.
 */
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
