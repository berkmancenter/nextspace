import { ReactNode } from "react";

/**
 * Represents where a trigger was detected and what text to replace
 */
export interface TriggerMatch {
  query: string; // The search query extracted from the trigger (e.g., "hel" from "/hel")
  replaceStart: number; // Character index where replacement should start
  replaceEnd: number; // Character index where replacement should end
}

/**
 * Request to change the input value and cursor position
 */
export interface InputChangeRequest {
  value: string; // The new input value
  cursorPos: number; // Where to position the cursor
}

/**
 * Configuration for the toolbar button associated with this enhancer
 */
export interface EnhancerButton {
  icon: string; // Display text for the button (e.g., "/" or "@")
  getTitle: (isActive: boolean) => string; // Tooltip text
  onClick: (currentValue: string, cursorPos: number) => InputChangeRequest;
}

/**
 * Generic interface for input enhancement features (slash commands, mentions, etc.)
 */
export interface InputEnhancer<T> {
  id: string; // Unique identifier for this enhancer

  // Button configuration for the toolbar
  button: EnhancerButton;

  // Detect if this enhancer should activate based on current input
  detectTrigger: (value: string, cursorPos: number) => TriggerMatch | null;

  // Get filtered items to display in the menu
  getItems: (query: string) => T[];

  // Handle selection of an item from the menu
  onSelect: (item: T, currentValue: string, cursorPos: number) => InputChangeRequest;

  // Render a single menu item
  renderItem: (item: T, isSelected: boolean) => ReactNode;
}

/**
 * Active enhancer state
 */
export interface ActiveEnhancerState<T> {
  enhancer: InputEnhancer<T>;
  items: T[];
  selectedIndex: number;
  trigger: TriggerMatch;
}
