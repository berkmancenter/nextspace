import { useEffect, useRef, useState } from 'react';
import { ORBIT_DURATION_MS, Point, tweenPositions } from '../../../utils/conceptSky';

/**
 * Glides from wherever the stars are drawn now to `target`, so Sky and Orbit read as one sky
 * rearranging rather than two pictures swapped.
 *
 * With reduced motion the stars jump straight there. A target that changes mid-glide starts
 * the next one from the current frame, not from the old start, so a quick second selection
 * never snaps backwards first. Ids new to the target (a revised payload) have no start and
 * appear in place.
 */
export function useTweenedPositions(target: Map<string, Point>, reduceMotion: boolean): Map<string, Point> {
  const [frame, setFrame] = useState(target);
  const shown = useRef(target);

  useEffect(() => {
    if (reduceMotion || target === shown.current) {
      shown.current = target;
      setFrame(target);
      return;
    }
    const from = shown.current;
    const startedAt = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - startedAt) / ORBIT_DURATION_MS);
      const next = t >= 1 ? target : new Map([...target, ...tweenPositions(from, target, t)]);
      shown.current = next;
      setFrame(next);
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, reduceMotion]);

  return frame;
}
