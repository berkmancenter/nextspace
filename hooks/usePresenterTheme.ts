import { useCallback, useEffect, useState } from 'react';
import {
  PresenterTheme,
  DEFAULT_PRESENTER_THEME,
  applyPresenterTheme,
  clearPresenterTheme,
  readStoredPresenterTheme,
  storePresenterTheme,
} from '../utils/presenterTheme';

/**
 * Owns the presentation view's light/dark theme: applies the saved choice (dark by default) to the
 * page while the view is mounted, and removes it on the way out so other pages are unaffected.
 */
export const usePresenterTheme = () => {
  const [theme, setTheme] = useState<PresenterTheme>(DEFAULT_PRESENTER_THEME);

  useEffect(() => {
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
