import { renderHook, act } from "@testing-library/react";
import { useVisibilityAwareDuration } from "../../hooks/useVisibilityAwareDuration";

describe("useVisibilityAwareDuration", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    // Set initial visibility state
    Object.defineProperty(document, "visibilityState", {
      writable: true,
      configurable: true,
      value: "visible",
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it("should initialize with duration of 0", () => {
    const { result } = renderHook(() => useVisibilityAwareDuration());

    expect(result.current.isRunning()).toBe(false);
    expect(result.current.getActiveDuration()).toBe(0);
  });

  it("should start tracking duration", () => {
    const { result } = renderHook(() => useVisibilityAwareDuration());

    act(() => {
      result.current.start();
    });

    expect(result.current.isRunning()).toBe(true);
  });

  it("should calculate duration when stopped", () => {
    const { result } = renderHook(() => useVisibilityAwareDuration());

    act(() => {
      result.current.start();
    });

    // Advance time by 5 seconds
    act(() => {
      jest.advanceTimersByTime(5000);
    });

    let duration = 0;
    act(() => {
      duration = result.current.stop();
    });

    expect(duration).toBe(5);
    expect(result.current.isRunning()).toBe(false);
  });

  it("should return current duration without stopping", () => {
    const { result } = renderHook(() => useVisibilityAwareDuration());

    act(() => {
      result.current.start();
    });

    act(() => {
      jest.advanceTimersByTime(3000);
    });

    const currentDuration = result.current.getActiveDuration();
    expect(currentDuration).toBe(3);
    expect(result.current.isRunning()).toBe(true);
  });

  it("should pause duration tracking when page becomes hidden", () => {
    const { result } = renderHook(() => useVisibilityAwareDuration());

    act(() => {
      result.current.start();
    });

    // Track for 2 seconds while visible
    act(() => {
      jest.advanceTimersByTime(2000);
    });

    // Simulate page becoming hidden
    act(() => {
      Object.defineProperty(document, "visibilityState", {
        writable: true,
        configurable: true,
        value: "hidden",
      });
      document.dispatchEvent(new Event("visibilitychange"));
    });

    // Advance time while hidden (should not count)
    act(() => {
      jest.advanceTimersByTime(5000);
    });

    const duration = result.current.getActiveDuration();
    expect(duration).toBe(2); // Only the 2 seconds before hiding
  });

  it("should resume duration tracking when page becomes visible again", () => {
    const { result } = renderHook(() => useVisibilityAwareDuration());

    act(() => {
      result.current.start();
    });

    // Track for 2 seconds while visible
    act(() => {
      jest.advanceTimersByTime(2000);
    });

    // Simulate page becoming hidden
    act(() => {
      Object.defineProperty(document, "visibilityState", {
        writable: true,
        configurable: true,
        value: "hidden",
      });
      document.dispatchEvent(new Event("visibilitychange"));
    });

    // Time passes while hidden (should not count)
    act(() => {
      jest.advanceTimersByTime(10000);
    });

    // Simulate page becoming visible again
    act(() => {
      Object.defineProperty(document, "visibilityState", {
        writable: true,
        configurable: true,
        value: "visible",
      });
      document.dispatchEvent(new Event("visibilitychange"));
    });

    // Track for 3 more seconds while visible
    act(() => {
      jest.advanceTimersByTime(3000);
    });

    let duration = 0;
    act(() => {
      duration = result.current.stop();
    });

    expect(duration).toBe(5); // 2 seconds before + 3 seconds after = 5 total active seconds
  });

  it("should handle multiple pause/resume cycles", () => {
    const { result } = renderHook(() => useVisibilityAwareDuration());

    act(() => {
      result.current.start();
    });

    // First active period: 2 seconds
    act(() => {
      jest.advanceTimersByTime(2000);
    });

    // First hidden period: 5 seconds (should not count)
    act(() => {
      Object.defineProperty(document, "visibilityState", {
        value: "hidden",
      });
      document.dispatchEvent(new Event("visibilitychange"));
      jest.advanceTimersByTime(5000);
    });

    // Second active period: 3 seconds
    act(() => {
      Object.defineProperty(document, "visibilityState", {
        value: "visible",
      });
      document.dispatchEvent(new Event("visibilitychange"));
      jest.advanceTimersByTime(3000);
    });

    // Second hidden period: 10 seconds (should not count)
    act(() => {
      Object.defineProperty(document, "visibilityState", {
        value: "hidden",
      });
      document.dispatchEvent(new Event("visibilitychange"));
      jest.advanceTimersByTime(10000);
    });

    // Third active period: 1 second
    act(() => {
      Object.defineProperty(document, "visibilityState", {
        value: "visible",
      });
      document.dispatchEvent(new Event("visibilitychange"));
      jest.advanceTimersByTime(1000);
    });

    let duration = 0;
    act(() => {
      duration = result.current.stop();
    });

    expect(duration).toBe(6); // 2 + 3 + 1 = 6 seconds total active time
  });

  it("should not track duration when not started", () => {
    const { result } = renderHook(() => useVisibilityAwareDuration());

    // Try to get duration without starting
    const duration = result.current.getActiveDuration();
    expect(duration).toBe(0);

    // Try to stop without starting
    act(() => {
      const stoppedDuration = result.current.stop();
      expect(stoppedDuration).toBe(0);
    });
  });

  it("should reset duration after stopping", () => {
    const { result } = renderHook(() => useVisibilityAwareDuration());

    act(() => {
      result.current.start();
      jest.advanceTimersByTime(5000);
      result.current.stop();
    });

    // After stopping, duration should be reset
    expect(result.current.getActiveDuration()).toBe(0);
    expect(result.current.isRunning()).toBe(false);
  });

  it("should be able to start again after stopping", () => {
    const { result } = renderHook(() => useVisibilityAwareDuration());

    // First session
    act(() => {
      result.current.start();
      jest.advanceTimersByTime(3000);
      result.current.stop();
    });

    // Second session
    act(() => {
      result.current.start();
      jest.advanceTimersByTime(2000);
    });

    let duration = 0;
    act(() => {
      duration = result.current.stop();
    });

    expect(duration).toBe(2); // Only the second session
  });

  it("should not start multiple times", () => {
    const { result } = renderHook(() => useVisibilityAwareDuration());

    act(() => {
      result.current.start();
      jest.advanceTimersByTime(2000);
      result.current.start(); // Try to start again
      jest.advanceTimersByTime(3000);
    });

    let duration = 0;
    act(() => {
      duration = result.current.stop();
    });

    expect(duration).toBe(5); // Should count all time, not restart
  });

  it("should not accumulate duration when visibility changes without being started", () => {
    const { result } = renderHook(() => useVisibilityAwareDuration());

    // Simulate visibility changes without starting
    act(() => {
      Object.defineProperty(document, "visibilityState", {
        value: "hidden",
      });
      document.dispatchEvent(new Event("visibilitychange"));
      jest.advanceTimersByTime(5000);
    });

    act(() => {
      Object.defineProperty(document, "visibilityState", {
        value: "visible",
      });
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(result.current.getActiveDuration()).toBe(0);
  });

  it("should return a stable object reference across re-renders", () => {
    const { result, rerender } = renderHook(() => useVisibilityAwareDuration());

    const firstReference = result.current;

    // Force a re-render
    rerender();

    const secondReference = result.current;

    // The returned object should be the same reference
    expect(firstReference).toBe(secondReference);
    expect(firstReference.start).toBe(secondReference.start);
    expect(firstReference.stop).toBe(secondReference.stop);
    expect(firstReference.getActiveDuration).toBe(
      secondReference.getActiveDuration,
    );
    expect(firstReference.isRunning).toBe(secondReference.isRunning);
  });
});
