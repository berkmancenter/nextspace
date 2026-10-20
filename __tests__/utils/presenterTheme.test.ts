import {
  PRESENTER_THEME_ATTRIBUTE,
  PRESENTER_THEME_INIT_SCRIPT,
  PRESENTER_THEME_STORAGE_KEY,
  applyPresenterTheme,
  clearPresenterTheme,
  readStoredPresenterTheme,
  storePresenterTheme,
} from '../../utils/presenterTheme';

describe('presenterTheme', () => {
  beforeEach(() => {
    window.localStorage.clear();
    clearPresenterTheme();
  });

  describe('readStoredPresenterTheme', () => {
    it('is dark when nothing has been saved', () => {
      expect(readStoredPresenterTheme()).toBe('dark');
    });

    it('returns a saved choice', () => {
      storePresenterTheme('light');
      expect(readStoredPresenterTheme()).toBe('light');
      storePresenterTheme('dark');
      expect(readStoredPresenterTheme()).toBe('dark');
    });

    it('ignores a saved value that is not a theme', () => {
      window.localStorage.setItem(PRESENTER_THEME_STORAGE_KEY, 'sepia');
      expect(readStoredPresenterTheme()).toBe('dark');
    });

    it('falls back to dark, and does not throw, when storage is blocked', () => {
      const getItem = jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('blocked');
      });
      const setItem = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('blocked');
      });

      expect(readStoredPresenterTheme()).toBe('dark');
      expect(() => storePresenterTheme('light')).not.toThrow();

      getItem.mockRestore();
      setItem.mockRestore();
    });
  });

  describe('applyPresenterTheme and clearPresenterTheme', () => {
    it('sets and removes the attribute on <html>', () => {
      applyPresenterTheme('light');
      expect(document.documentElement.getAttribute(PRESENTER_THEME_ATTRIBUTE)).toBe('light');
      applyPresenterTheme('dark');
      expect(document.documentElement.getAttribute(PRESENTER_THEME_ATTRIBUTE)).toBe('dark');
      clearPresenterTheme();
      expect(document.documentElement.hasAttribute(PRESENTER_THEME_ATTRIBUTE)).toBe(false);
    });
  });

  describe('PRESENTER_THEME_INIT_SCRIPT', () => {
    const runScript = () => new Function(PRESENTER_THEME_INIT_SCRIPT)();

    it('applies dark before first paint when nothing is saved', () => {
      runScript();
      expect(document.documentElement.getAttribute(PRESENTER_THEME_ATTRIBUTE)).toBe('dark');
    });

    it('applies a saved light choice', () => {
      storePresenterTheme('light');
      runScript();
      expect(document.documentElement.getAttribute(PRESENTER_THEME_ATTRIBUTE)).toBe('light');
    });

    it('applies dark when storage is blocked', () => {
      const getItem = jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('blocked');
      });
      runScript();
      expect(document.documentElement.getAttribute(PRESENTER_THEME_ATTRIBUTE)).toBe('dark');
      getItem.mockRestore();
    });
  });
});
