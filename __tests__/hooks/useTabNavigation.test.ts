import { renderHook, waitFor, act } from '@testing-library/react';
import type { NextRouter } from 'next/router';

jest.mock('../../utils/analytics', () => ({
  trackConversationEvent: jest.fn(),
}));

import { useTabNavigation } from '../../hooks/useTabNavigation';
import { trackConversationEvent } from '../../utils/analytics';

const mockTrackConversationEvent = trackConversationEvent as jest.Mock;

function makeRouter(overrides: Partial<NextRouter> = {}): NextRouter {
  return {
    query: { conversationId: 'conv-1' },
    pathname: '/assistant',
    replace: jest.fn(),
    ...overrides,
  } as unknown as NextRouter;
}

function renderTabNavigation(routerOverrides: Partial<NextRouter> = {}) {
  const onClearUnseenResources = jest.fn();
  const onClearResourcesBadge = jest.fn();
  const router = makeRouter(routerOverrides);

  const view = renderHook(() => useTabNavigation({ router, onClearUnseenResources, onClearResourcesBadge }));

  return { ...view, router, onClearUnseenResources, onClearResourcesBadge };
}

describe('useTabNavigation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('initial state', () => {
    it('defaults to the chat tab with zeroed unseen counts', () => {
      const { result } = renderTabNavigation();

      expect(result.current.activeTab).toBe('chat');
      expect(result.current.activeTabRef.current).toBe('chat');
      expect(result.current.unseenAssistantCount).toBe(0);
      expect(result.current.unseenChatCount).toBe(0);
    });
  });

  describe('handleTabChange', () => {
    it('updates the active tab', () => {
      const { result } = renderTabNavigation();

      act(() => {
        result.current.handleTabChange('transcript');
      });

      expect(result.current.activeTab).toBe('transcript');
    });

    it('syncs activeTabRef to the new tab', async () => {
      const { result } = renderTabNavigation();

      act(() => {
        result.current.handleTabChange('resources');
      });

      await waitFor(() => {
        expect(result.current.activeTabRef.current).toBe('resources');
      });
    });

    it('resets unseenAssistantCount when switching to the assistant tab', () => {
      const { result } = renderTabNavigation();

      act(() => {
        result.current.setUnseenAssistantCount(5);
      });
      expect(result.current.unseenAssistantCount).toBe(5);

      act(() => {
        result.current.handleTabChange('assistant');
      });

      expect(result.current.unseenAssistantCount).toBe(0);
    });

    it('resets unseenChatCount when switching to the chat tab', () => {
      const { result } = renderTabNavigation();

      act(() => {
        result.current.setUnseenChatCount(3);
      });
      expect(result.current.unseenChatCount).toBe(3);

      act(() => {
        result.current.handleTabChange('transcript');
      });
      act(() => {
        result.current.handleTabChange('chat');
      });

      expect(result.current.unseenChatCount).toBe(0);
    });

    it('does not reset unseenChatCount when switching to a non-chat tab', () => {
      const { result } = renderTabNavigation();

      act(() => {
        result.current.setUnseenChatCount(3);
      });

      act(() => {
        result.current.handleTabChange('transcript');
      });

      expect(result.current.unseenChatCount).toBe(3);
    });

    it('calls onClearResourcesBadge when switching to the resources tab', () => {
      const { result, onClearResourcesBadge } = renderTabNavigation();

      act(() => {
        result.current.handleTabChange('resources');
      });

      expect(onClearResourcesBadge).toHaveBeenCalledTimes(1);
    });

    it('does not call onClearResourcesBadge when switching to a non-resources tab', () => {
      const { result, onClearResourcesBadge } = renderTabNavigation();

      act(() => {
        result.current.handleTabChange('assistant');
      });

      expect(onClearResourcesBadge).not.toHaveBeenCalled();
    });

    it('calls onClearUnseenResources when leaving the resources tab', async () => {
      const { result, onClearUnseenResources } = renderTabNavigation();

      act(() => {
        result.current.handleTabChange('resources');
      });
      await waitFor(() => {
        expect(result.current.activeTabRef.current).toBe('resources');
      });

      act(() => {
        result.current.handleTabChange('chat');
      });

      expect(onClearUnseenResources).toHaveBeenCalledTimes(1);
    });

    it('does not call onClearUnseenResources when switching between non-resources tabs', () => {
      const { result, onClearUnseenResources } = renderTabNavigation();

      act(() => {
        result.current.handleTabChange('assistant');
      });
      act(() => {
        result.current.handleTabChange('transcript');
      });

      expect(onClearUnseenResources).not.toHaveBeenCalled();
    });

    it('does not call onClearUnseenResources when re-selecting the resources tab', async () => {
      const { result, onClearUnseenResources } = renderTabNavigation();

      act(() => {
        result.current.handleTabChange('resources');
      });
      await waitFor(() => {
        expect(result.current.activeTabRef.current).toBe('resources');
      });

      act(() => {
        result.current.handleTabChange('resources');
      });

      expect(onClearUnseenResources).not.toHaveBeenCalled();
    });

    it('strips the "view" query param and shallow-replaces the route when present', () => {
      const { result, router } = renderTabNavigation({
        query: { conversationId: 'conv-1', view: 'summary', channel: 'chat,pass' },
      });

      act(() => {
        result.current.handleTabChange('assistant');
      });

      expect(router.replace).toHaveBeenCalledWith(
        { pathname: '/assistant', query: { conversationId: 'conv-1', channel: 'chat,pass' } },
        undefined,
        { shallow: true },
      );
    });

    it('does not call router.replace when there is no "view" query param', () => {
      const { result, router } = renderTabNavigation();

      act(() => {
        result.current.handleTabChange('assistant');
      });

      expect(router.replace).not.toHaveBeenCalled();
    });

    it('tracks a tab_switched analytics event with the conversation id and target tab', () => {
      const { result } = renderTabNavigation({ query: { conversationId: 'conv-42' } });

      act(() => {
        result.current.handleTabChange('transcript');
      });

      expect(mockTrackConversationEvent).toHaveBeenCalledWith('conv-42', 'assistant', 'tab_switched', 'transcript');
    });
  });
});
