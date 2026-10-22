import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import {
  PresenterTheme,
  DEFAULT_PRESENTER_THEME,
  applyPresenterTheme,
  clearPresenterTheme,
  readStoredPresenterTheme,
  storePresenterTheme,
} from '../utils/presenterTheme';

// useLayoutEffect warns when rendered on the server, where there is nothing to lay out.
const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

/**
 * Owns the presentation view's light/dark theme: applies the saved choice (dark by default) to the
 * page while the view is mounted, and removes it on the way out so other pages are unaffected.
 */
export const usePresenterTheme = () => {
  const [theme, setTheme] = useState<PresenterTheme>(DEFAULT_PRESENTER_THEME);

  // The server can't know the saved choice, so the first render must use the default to match its HTML.
  // A layout effect then swaps in the saved choice before the browser paints the hydrated page.
  useIsomorphicLayoutEffect(() => {
    const stored = readStoredPresenterTheme();
    setTheme(stored);
    applyPresenterTheme(stored);
    return clearPresenterTheme;
  }, []);

  const toggleTheme = useCallback(() => {
    const next: PresenterTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    applyPresenterTheme(next);
    storePresenterTheme(next);
  }, [theme]);

  return { theme, toggleTheme };
};
