import { useRef, useEffect, useState } from 'react';

/**
 * Custom hook to handle automatic scrolling to bottom of messages
 * Used by chat components to keep the latest message visible
 * @param messages The array of messages to monitor for changes
 * @returns An object containing refs and functions for managing auto-scroll behavior
 */
export function useAutoScroll<T extends any[]>(messages: T) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const prevLengthRef = useRef(0);
  const isAtBottomRef = useRef(true);
  const [isAtBottom, setIsAtBottom] = useState(true);

  const scrollToBottom = () => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    const currentLength = messages.length;

    // Only scroll if the length increased and the user is already at the bottom
    if (currentLength > prevLengthRef.current && currentLength > 0 && isAtBottomRef.current) {
      scrollToBottom();
    }

    prevLengthRef.current = currentLength;
  }, [messages.length]);

  useEffect(() => {
    const msgContainer = messagesContainerRef.current;
    if (!msgContainer) return;

    const handleScroll = () => {
      // if scroll position is within 50px from the bottom, we consider the view to be at the bottom
      const isScrolledToBottom =
        msgContainer.scrollHeight - // the total container height
          msgContainer.scrollTop - // the current position from the top
          msgContainer.clientHeight < // the height of the visible window
        50; // 50px within range of the bottom

      isAtBottomRef.current = isScrolledToBottom;
      setIsAtBottom(isScrolledToBottom);
    };

    msgContainer.addEventListener('scroll', handleScroll, { passive: true });

    return () => msgContainer.removeEventListener('scroll', handleScroll);
  }, []);

  return { messagesEndRef, messagesContainerRef, scrollToBottom, isAtBottom };
}
