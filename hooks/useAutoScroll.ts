import { useRef, useEffect } from "react";

/**
 * Custom hook to handle automatic scrolling to bottom of messages
 * Used by chat components to keep the latest message visible
 */
export function useAutoScroll<T extends any[]>(messages: T) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop =
        messagesContainerRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom();
    }
  }, [messages]);

  return { messagesEndRef, messagesContainerRef, scrollToBottom };
}
