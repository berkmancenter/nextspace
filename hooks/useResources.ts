import { useState, useRef, useEffect, useCallback } from 'react';
import { components } from '../types';

type Resource = components['schemas']['Resource'];

// Interface for the return type of the useResources hook, defining the state and functions it provides
export interface UseResourcesReturn {
  resources: Resource[];
  setResources: React.Dispatch<React.SetStateAction<Resource[]>>;
  newResourceIds: Set<string>;
  unseenResourcesCount: number;
  resourcesNavBadgeDismissed: boolean;
  setResourcesNavBadgeDismissed: React.Dispatch<React.SetStateAction<boolean>>;
  resourcesReminderActive: boolean;
  setResourcesReminderActive: React.Dispatch<React.SetStateAction<boolean>>;
  handleMarkReadingsAsSeen: () => void;
  handleResourcesUpdated: (payload: { resources: Resource[] }, isResourcesTabActive: boolean) => void;
  handleConversationEnding: () => void;
  onClearResources: () => void;
}

/**
 * Custom hook to manage resources within the application.
 * It provides state and functions to track resources, new resource IDs, unseen resources count,
 * navigation badge dismissal, and reminder activation. It also handles updates to resources,
 * marking readings as seen, conversation ending, and clearing resources.
 * @returns An object containing the state and functions for managing resources.
 */
export function useResources(): UseResourcesReturn {
  const [resources, setResources] = useState<Resource[]>([]);
  const [newResourceIds, setNewResourceIds] = useState<Set<string>>(new Set());
  const [unseenResourcesCount, setUnseenResourcesCount] = useState<number>(0);
  const [resourcesNavBadgeDismissed, setResourcesNavBadgeDismissed] = useState(false);
  const [resourcesReminderActive, setResourcesReminderActive] = useState<boolean>(false);
  const resourcesRef = useRef<Resource[]>(resources);

  useEffect(() => {
    resourcesRef.current = resources;
  }, [resources]);

  const handleMarkReadingsAsSeen = useCallback(() => {
    setUnseenResourcesCount(0);
    setNewResourceIds(new Set());
  }, []);

  const handleResourcesUpdated = useCallback(
    ({ resources: updatedResources }: { resources: Resource[] }, isResourcesTabActive: boolean) => {
      console.log('resources:updated received', updatedResources);
      setResources((prev) => {
        const prevIds = new Set(prev.map((r) => r.id).filter(Boolean));
        const suggested = updatedResources.filter((r) => r.category === 'suggested');
        const addedIds = suggested.map((r) => r.id).filter((id): id is string => Boolean(id) && !prevIds.has(id));
        if (addedIds.length > 0) {
          setNewResourceIds((existing) => new Set([...existing, ...addedIds]));
          setUnseenResourcesCount((count) => count + addedIds.length);
          if (!isResourcesTabActive) {
            setResourcesNavBadgeDismissed(false);
          }
        }
        return updatedResources;
      });
    },
    [],
  );

  const handleConversationEnding = useCallback(() => {
    console.log('conversation:ending received');
    if (resourcesRef.current.length === 0) return;
    setResourcesReminderActive(true);
  }, []);

  const onClearResources = useCallback(() => {
    setNewResourceIds(new Set());
    setUnseenResourcesCount(0);
  }, []);

  return {
    resources,
    setResources,
    newResourceIds,
    unseenResourcesCount,
    resourcesNavBadgeDismissed,
    setResourcesNavBadgeDismissed,
    resourcesReminderActive,
    setResourcesReminderActive,
    handleMarkReadingsAsSeen,
    handleResourcesUpdated,
    handleConversationEnding,
    onClearResources,
  };
}
