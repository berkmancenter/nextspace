import { render, screen, act } from "@testing-library/react";
import { useAutoScroll } from "../../hooks/useAutoScroll";

/**
 * Renders the hook inside a real component so the container ref attaches to
 * an actual DOM element and the scroll event listener registers correctly.
 * JSDOM doesn't support real layout (scrollHeight/clientHeight are always 0),
 * so we use setScrollGeometry() to fake the scroll position we want.
 */
function TestComponent({ messages }: { messages: unknown[] }) {
  const { messagesContainerRef } = useAutoScroll(messages);
  return <div ref={messagesContainerRef} data-testid="container" />;
}

function setScrollPosition(
  el: Element,
  {
    currentPosition,
    totalContentHeight,
    visibleHeight,
  }: { currentPosition: number; totalContentHeight: number; visibleHeight: number },
) {
  Object.defineProperty(el, "scrollTop", {
    configurable: true,
    writable: true,
    value: currentPosition,
  });
  Object.defineProperty(el, "scrollHeight", {
    configurable: true,
    get: () => totalContentHeight,
  });
  Object.defineProperty(el, "clientHeight", {
    configurable: true,
    get: () => visibleHeight,
  });
}

describe("useAutoScroll", () => {
  it("scrolls to bottom by default when new messages arrive", () => {
    // No scroll event fired — the hook should treat the user as "at the bottom"
    // by default and show every new message that comes in
    const { rerender } = render(<TestComponent messages={[]} />);
    const container = screen.getByTestId("container");

    setScrollPosition(container, {
      currentPosition: 0,
      totalContentHeight: 600,
      visibleHeight: 500,
    });

    act(() => {
      rerender(<TestComponent messages={["msg1"]} />);
    });

    expect(container.scrollTop).toBe(600);
  });

  it("does not scroll when the user has scrolled up and a new message arrives", () => {
    // User has scrolled up (100px gap from bottom — above the 50px threshold).
    // A new message arriving should not yank them back down.
    const { rerender } = render(<TestComponent messages={[]} />);
    const container = screen.getByTestId("container");

    setScrollPosition(container, {
      currentPosition: 0,
      totalContentHeight: 600,
      visibleHeight: 500,
    });

    act(() => {
      container.dispatchEvent(new Event("scroll"));
    });

    act(() => {
      rerender(<TestComponent messages={["msg1"]} />);
    });

    expect(container.scrollTop).toBe(0);
  });

  it("resumes scrolling once the user returns to the bottom", () => {
    // First a message arrives while the user is scrolled up — no scroll.
    // Then the user scrolls back to the bottom.
    // The next new message should scroll again.
    const { rerender } = render(<TestComponent messages={[]} />);
    const container = screen.getByTestId("container");

    // Scroll up
    setScrollPosition(container, {
      currentPosition: 0,
      totalContentHeight: 600,
      visibleHeight: 500,
    });
    act(() => {
      container.dispatchEvent(new Event("scroll"));
    });

    // New message while scrolled up — should stay put
    act(() => {
      rerender(<TestComponent messages={["msg1"]} />);
    });
    expect(container.scrollTop).toBe(0);

    // User scrolls back to the bottom (gap = 45px < 50px threshold)
    setScrollPosition(container, {
      currentPosition: 555,
      totalContentHeight: 600,
      visibleHeight: 500,
    });
    act(() => {
      container.dispatchEvent(new Event("scroll"));
    });

    // New message — should scroll now
    act(() => {
      rerender(<TestComponent messages={["msg1", "msg2"]} />);
    });
    expect(container.scrollTop).toBe(600);
  });
});
