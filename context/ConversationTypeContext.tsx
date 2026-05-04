"use client";
import { createContext, useContext, useState } from "react";
import { components } from "../types";

export type ConversationType = components["schemas"]["ConversationType"];

const DEFAULT_BOT_NAME = "Berkie";

/**
 * Holds the resolved conversation type for the current event.
 * null means the type hasn't loaded yet — consumers should treat this as "unknown".
 */
const ConversationTypeContext = createContext<ConversationType | null>(null);
const ConversationTypeContextSetter = createContext<(type: ConversationType | null) => void>(() => {});

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
  initialValue?: ConversationType | null;
  initialBotName?: string;
}) {
  const [type, setType] = useState<ConversationType | null>(initialValue);
  const [botName, setBotName] = useState<string>(initialBotName);
  return (
    <ConversationTypeContextSetter.Provider value={setType}>
      <ConversationTypeContext.Provider value={type}>
        <BotNameSetterContext.Provider value={setBotName}>
          <BotNameValueContext.Provider value={botName}>
            {children}
          </BotNameValueContext.Provider>
        </BotNameSetterContext.Provider>
      </ConversationTypeContext.Provider>
    </ConversationTypeContextSetter.Provider>
  );
}

/**
 * Returns the current event's conversation type, or null if not yet loaded.
 * Use this to filter commands or features to what's available in the current event.
 */
export function useConversationType(): ConversationType | null {
  return useContext(ConversationTypeContext);
}

/**
 * Returns a setter for the current event's conversation type.
 * Page components call this once the conversation has been fetched, and
 * should reset to null when leaving the event so stale types don't leak.
 */
export function useSetConversationType(): (type: ConversationType | null) => void {
  return useContext(ConversationTypeContextSetter);
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
