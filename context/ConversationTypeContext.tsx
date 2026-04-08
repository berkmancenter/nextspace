"use client";
import { createContext, useContext, useState } from "react";

/**
 * Holds the conversation type for the current event (e.g. "eventAssistantPlus").
 * null means the type hasn't loaded yet — consumers should treat this as "unknown".
 */
const ValueContext = createContext<string | null>(null);
const SetterContext = createContext<(type: string | null) => void>(() => {});

/**
 * Provides the current event's conversation type to the entire app.
 * Mount this ABOVE any component that either reads or writes the type
 * (e.g. in _app.tsx, above Layout) so Header consumers and page-level
 * setters share one instance.
 *
 * `initialValue` is intended for tests — production code should leave it
 * undefined and let pages push values via useSetConversationType().
 */
export function ConversationTypeProvider({
  children,
  initialValue = null,
}: {
  children: React.ReactNode;
  initialValue?: string | null;
}) {
  const [type, setType] = useState<string | null>(initialValue);
  return (
    <SetterContext.Provider value={setType}>
      <ValueContext.Provider value={type}>{children}</ValueContext.Provider>
    </SetterContext.Provider>
  );
}

/**
 * Returns the current event's conversation type, or null if not yet loaded.
 * Use this to filter commands or features to what's available in the current event.
 */
export function useConversationType(): string | null {
  return useContext(ValueContext);
}

/**
 * Returns a setter for the current event's conversation type.
 * Page components call this once the conversation has been fetched, and
 * should reset to null when leaving the event so stale types don't leak.
 */
export function useSetConversationType(): (type: string | null) => void {
  return useContext(SetterContext);
}
