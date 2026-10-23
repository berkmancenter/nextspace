import { act, renderHook } from '@testing-library/react';
import { usePresenterTheme } from '../../hooks/usePresenterTheme';
import { PRESENTER_THEME_ATTRIBUTE, PRESENTER_THEME_STORAGE_KEY } from '../../utils/presenterTheme';

const htmlTheme = () => document.documentElement.getAttribute(PRESENTER_THEME_ATTRIBUTE);

describe('usePresenterTheme', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.removeAttribute(PRESENTER_THEME_ATTRIBUTE);
  });

  it('is dark by default and applies it to the page', () => {
    const { result } = renderHook(() => usePresenterTheme());

    expect(result.current.theme).toBe('dark');
    expect(htmlTheme()).toBe('dark');
  });

  it('starts from the saved choice', () => {
    window.localStorage.setItem(PRESENTER_THEME_STORAGE_KEY, 'light');

    const { result } = renderHook(() => usePresenterTheme());

    expect(result.current.theme).toBe('light');
    expect(htmlTheme()).toBe('light');
  });

  it('shows the saved choice on the first committed render, before any later effect', () => {
    window.localStorage.setItem(PRESENTER_THEME_STORAGE_KEY, 'light');
    const seen: string[] = [];

    renderHook(() => {
      const value = usePresenterTheme();
      seen.push(value.theme);
      return value;
    });

    expect(seen[seen.length - 1]).toBe('light');
    expect(seen).toEqual(['dark', 'light']);
  });

  it('toggles between dark and light, applying and saving each choice', () => {
    const { result } = renderHook(() => usePresenterTheme());

    act(() => result.current.toggleTheme());
    expect(result.current.theme).toBe('light');
    expect(htmlTheme()).toBe('light');
    expect(window.localStorage.getItem(PRESENTER_THEME_STORAGE_KEY)).toBe('light');

    act(() => result.current.toggleTheme());
    expect(result.current.theme).toBe('dark');
    expect(htmlTheme()).toBe('dark');
    expect(window.localStorage.getItem(PRESENTER_THEME_STORAGE_KEY)).toBe('dark');
  });

  it('keeps the choice for the next visit', () => {
    const first = renderHook(() => usePresenterTheme());
    act(() => first.result.current.toggleTheme());
    first.unmount();

    const second = renderHook(() => usePresenterTheme());

    expect(second.result.current.theme).toBe('light');
    expect(htmlTheme()).toBe('light');
  });

  it('leaves the page unthemed once the presentation view closes', () => {
    const { unmount } = renderHook(() => usePresenterTheme());
    expect(htmlTheme()).toBe('dark');

    unmount();

    expect(document.documentElement.hasAttribute(PRESENTER_THEME_ATTRIBUTE)).toBe(false);
  });
});
