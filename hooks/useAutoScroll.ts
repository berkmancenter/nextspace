import { useRef, useEffect } from "react";

/**
 * Custom hook to handle automatic scrolling to bottom of messages
 * Used by chat components to keep the latest message visible
 */
export function useAutoScroll<T extends any[]>(messages: T) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const prevLengthRef = useRef(0);

  const scrollToBottom = () => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop =
        messagesContainerRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    const currentLength = messages.length;

    // Only scroll if the length actually increased
    if (currentLength > prevLengthRef.current && currentLength > 0) {
      scrollToBottom();
    }

    prevLengthRef.current = currentLength;
  }, [messages.length]);

  return { messagesEndRef, messagesContainerRef, scrollToBottom };
}
