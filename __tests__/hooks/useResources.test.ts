import { renderHook, act } from '@testing-library/react';
import { useResources } from '../../hooks/useResources';

function makeResource(overrides: Record<string, any> = {}) {
  return {
    id: 'resource-1',
    category: 'suggested',
    ...overrides,
  };
}

describe('useResources', () => {
  it('returns empty defaults', () => {
    const { result } = renderHook(() => useResources());

    expect(result.current.resources).toEqual([]);
    expect(result.current.newResourceIds).toEqual(new Set());
    expect(result.current.unseenResourcesCount).toBe(0);
    expect(result.current.resourcesNavBadgeDismissed).toBe(false);
    expect(result.current.resourcesReminderActive).toBe(false);
  });

  describe('handleResourcesUpdated', () => {
    it('replaces resources unconditionally', () => {
      const { result } = renderHook(() => useResources());
      const updated = [makeResource({ id: 'r1', category: 'other' })];

      act(() => {
        result.current.handleResourcesUpdated({ resources: updated as any }, true);
      });

      expect(result.current.resources).toEqual(updated);
    });

    it('tracks newly suggested resources and bumps the unseen count', () => {
      const { result } = renderHook(() => useResources());

      act(() => {
        result.current.handleResourcesUpdated(
          { resources: [makeResource({ id: 'r1' }), makeResource({ id: 'r2' })] as any },
          true,
        );
      });

      expect(result.current.newResourceIds).toEqual(new Set(['r1', 'r2']));
      expect(result.current.unseenResourcesCount).toBe(2);
    });

    it('ignores resources that are not category "suggested"', () => {
      const { result } = renderHook(() => useResources());

      act(() => {
        result.current.handleResourcesUpdated(
          { resources: [makeResource({ id: 'r1', category: 'reference' })] as any },
          true,
        );
      });

      expect(result.current.newResourceIds).toEqual(new Set());
      expect(result.current.unseenResourcesCount).toBe(0);
    });

    it('does not re-count a suggested resource that was already present', () => {
      const { result } = renderHook(() => useResources());

      act(() => {
        result.current.handleResourcesUpdated({ resources: [makeResource({ id: 'r1' })] as any }, true);
      });

      act(() => {
        result.current.handleResourcesUpdated(
          { resources: [makeResource({ id: 'r1' }), makeResource({ id: 'r2' })] as any },
          true,
        );
      });

      // Only r2 is new on the second call; r1 was already known.
      expect(result.current.newResourceIds).toEqual(new Set(['r1', 'r2']));
      expect(result.current.unseenResourcesCount).toBe(2);
    });

    it('ignores suggested resources with no id', () => {
      const { result } = renderHook(() => useResources());

      act(() => {
        result.current.handleResourcesUpdated({ resources: [makeResource({ id: undefined })] as any }, true);
      });

      expect(result.current.newResourceIds).toEqual(new Set());
      expect(result.current.unseenResourcesCount).toBe(0);
    });

    it('un-dismisses the nav badge when new resources arrive and the resources tab is not active', () => {
      const { result } = renderHook(() => useResources());

      act(() => {
        result.current.setResourcesNavBadgeDismissed(true);
      });
      expect(result.current.resourcesNavBadgeDismissed).toBe(true);

      act(() => {
        result.current.handleResourcesUpdated({ resources: [makeResource({ id: 'r1' })] as any }, false);
      });

      expect(result.current.resourcesNavBadgeDismissed).toBe(false);
    });

    it('leaves the nav badge dismissal untouched when the resources tab is already active', () => {
      const { result } = renderHook(() => useResources());

      act(() => {
        result.current.setResourcesNavBadgeDismissed(true);
      });

      act(() => {
        result.current.handleResourcesUpdated({ resources: [makeResource({ id: 'r1' })] as any }, true);
      });

      expect(result.current.resourcesNavBadgeDismissed).toBe(true);
    });

    it('does not touch the nav badge when no resources were added', () => {
      const { result } = renderHook(() => useResources());

      act(() => {
        result.current.handleResourcesUpdated({ resources: [makeResource({ id: 'r1', category: 'reference' })] as any }, false);
      });

      expect(result.current.resourcesNavBadgeDismissed).toBe(false);
    });
  });

  describe('handleMarkReadingsAsSeen', () => {
    it('resets unseenResourcesCount and newResourceIds', () => {
      const { result } = renderHook(() => useResources());

      act(() => {
        result.current.handleResourcesUpdated(
          { resources: [makeResource({ id: 'r1' }), makeResource({ id: 'r2' })] as any },
          true,
        );
      });
      expect(result.current.unseenResourcesCount).toBe(2);

      act(() => {
        result.current.handleMarkReadingsAsSeen();
      });

      expect(result.current.unseenResourcesCount).toBe(0);
      expect(result.current.newResourceIds).toEqual(new Set());
    });

    it('does not affect the resources list itself', () => {
      const { result } = renderHook(() => useResources());
      const updated = [makeResource({ id: 'r1' })];

      act(() => {
        result.current.handleResourcesUpdated({ resources: updated as any }, true);
      });

      act(() => {
        result.current.handleMarkReadingsAsSeen();
      });

      expect(result.current.resources).toEqual(updated);
    });
  });

  describe('onClearResources', () => {
    it('resets unseenResourcesCount and newResourceIds without touching resources or the nav badge', () => {
      const { result } = renderHook(() => useResources());
      const updated = [makeResource({ id: 'r1' })];

      act(() => {
        result.current.handleResourcesUpdated({ resources: updated as any }, false);
      });
      act(() => {
        result.current.setResourcesNavBadgeDismissed(true);
      });

      act(() => {
        result.current.onClearResources();
      });

      expect(result.current.unseenResourcesCount).toBe(0);
      expect(result.current.newResourceIds).toEqual(new Set());
      expect(result.current.resources).toEqual(updated);
      expect(result.current.resourcesNavBadgeDismissed).toBe(true);
    });
  });

  describe('handleConversationEnding', () => {
    it('does not activate the reminder when there are no resources', () => {
      const { result } = renderHook(() => useResources());

      act(() => {
        result.current.handleConversationEnding();
      });

      expect(result.current.resourcesReminderActive).toBe(false);
    });

    it('activates the reminder once resources are present', () => {
      const { result } = renderHook(() => useResources());

      act(() => {
        result.current.setResources([makeResource({ id: 'r1' })] as any);
      });

      act(() => {
        result.current.handleConversationEnding();
      });

      expect(result.current.resourcesReminderActive).toBe(true);
    });
  });

  describe('setResourcesReminderActive', () => {
    it('allows manually toggling the reminder flag', () => {
      const { result } = renderHook(() => useResources());

      act(() => {
        result.current.setResourcesReminderActive(true);
      });
      expect(result.current.resourcesReminderActive).toBe(true);

      act(() => {
        result.current.setResourcesReminderActive(false);
      });
      expect(result.current.resourcesReminderActive).toBe(false);
    });
  });
});
