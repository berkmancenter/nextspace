"use client";
import { createContext, useContext, useState } from "react";

const DEFAULT_BOT_NAME = "Berkie";

/**
 * Holds the conversation type for the current event (e.g. "eventAssistantPlus").
 * null means the type hasn't loaded yet — consumers should treat this as "unknown".
 */
const TypeValueContext = createContext<string | null>(null);
const TypeSetterContext = createContext<(type: string | null) => void>(() => {});

/**
 * Holds the display name of the AI assistant bot for the current event.
 * Defaults to "Berkie" until a page sets the resolved value from the API.
 */
const BotNameValueContext = createContext<string>(DEFAULT_BOT_NAME);
const BotNameSetterContext = createContext<(name: string) => void>(() => {});

/**
 * Provides the current event's conversation type and bot name to the entire app.
 * Mount this ABOVE any component that either reads or writes these values
 * (e.g. in _app.tsx, above Layout) so Header consumers and page-level
 * setters share one instance.
 *
 * `initialValue` and `initialBotName` are intended for tests — production
 * code should leave them undefined and let pages push values via the setter hooks.
 */
export function ConversationTypeProvider({
  children,
  initialValue = null,
  initialBotName = DEFAULT_BOT_NAME,
}: {
  children: React.ReactNode;
  initialValue?: string | null;
  initialBotName?: string;
}) {
  const [type, setType] = useState<string | null>(initialValue);
  const [botName, setBotName] = useState<string>(initialBotName);
  return (
    <TypeSetterContext.Provider value={setType}>
      <TypeValueContext.Provider value={type}>
        <BotNameSetterContext.Provider value={setBotName}>
          <BotNameValueContext.Provider value={botName}>
            {children}
          </BotNameValueContext.Provider>
        </BotNameSetterContext.Provider>
      </TypeValueContext.Provider>
    </TypeSetterContext.Provider>
  );
}

/**
 * Returns the current event's conversation type, or null if not yet loaded.
 * Use this to filter commands or features to what's available in the current event.
 */
export function useConversationType(): string | null {
  return useContext(TypeValueContext);
}

/**
 * Returns a setter for the current event's conversation type.
 * Page components call this once the conversation has been fetched, and
 * should reset to null when leaving the event so stale types don't leak.
 */
export function useSetConversationType(): (type: string | null) => void {
  return useContext(TypeSetterContext);
}

/**
 * Returns the display name of the AI assistant bot for the current event.
 * Defaults to "Berkie" if the page hasn't resolved the name yet.
 */
export function useBotName(): string {
  return useContext(BotNameValueContext);
}

/**
 * Returns a setter for the current event's bot name.
 * Page components call this once the bot name has been resolved from the API,
 * and should reset to the default when leaving the event.
 */
export function useSetBotName(): (name: string) => void {
  return useContext(BotNameSetterContext);
}
