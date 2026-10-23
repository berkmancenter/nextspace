/**
 * Light/dark theme for the presentation view. The theme is the `data-presenter-theme` attribute on
 * <html>, which only exists while the presentation view is open, so every other page keeps its
 * current look. The colors it switches live in globals.css.
 */
export type PresenterTheme = 'dark' | 'light';

export const PRESENTER_THEME_ATTRIBUTE = 'data-presenter-theme';
export const PRESENTER_THEME_STORAGE_KEY = 'nextspace-presenter-theme';
export const DEFAULT_PRESENTER_THEME: PresenterTheme = 'dark';

/** Reads the saved choice. Falls back to the default when nothing is saved or storage is blocked. */
export const readStoredPresenterTheme = (): PresenterTheme => {
  try {
    const stored = window.localStorage.getItem(PRESENTER_THEME_STORAGE_KEY);
    return stored === 'light' || stored === 'dark' ? stored : DEFAULT_PRESENTER_THEME;
  } catch {
    return DEFAULT_PRESENTER_THEME;
  }
};

export const storePresenterTheme = (theme: PresenterTheme) => {
  try {
    window.localStorage.setItem(PRESENTER_THEME_STORAGE_KEY, theme);
  } catch {
    // The choice just won't survive a reload.
  }
};

export const applyPresenterTheme = (theme: PresenterTheme) => {
  document.documentElement.setAttribute(PRESENTER_THEME_ATTRIBUTE, theme);
};

export const clearPresenterTheme = () => {
  document.documentElement.removeAttribute(PRESENTER_THEME_ATTRIBUTE);
};

/**
 * Inline script for the document head. It sets the saved theme before the first paint, so a
 * presenter who chose light doesn't see a dark flash while the page loads.
 */
export const PRESENTER_THEME_INIT_SCRIPT = `(function(){var t='${DEFAULT_PRESENTER_THEME}';try{var s=window.localStorage.getItem('${PRESENTER_THEME_STORAGE_KEY}');if(s==='light'||s==='dark')t=s;}catch(e){}document.documentElement.setAttribute('${PRESENTER_THEME_ATTRIBUTE}',t);})();`;
