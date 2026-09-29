import { renderHook } from '@testing-library/react';
import { useQueryToken } from '../../hooks/useQueryToken';

const mockReplace = jest.fn();
let mockRouter: { isReady: boolean; pathname: string; query: Record<string, string | string[]> };

jest.mock('next/router', () => ({
  useRouter: () => ({ ...mockRouter, replace: mockReplace }),
}));

describe('useQueryToken', () => {
  beforeEach(() => {
    mockReplace.mockReset();
    mockRouter = { isReady: true, pathname: '/reset-password', query: {} };
  });

  it('reports loading until the router has parsed the query string', () => {
    mockRouter.isReady = false;

    const { result } = renderHook(() => useQueryToken());

    expect(result.current).toEqual({ status: 'loading' });
  });

  it('returns the token from the query string', () => {
    mockRouter.query = { token: 'abc123' };

    const { result } = renderHook(() => useQueryToken());

    expect(result.current).toEqual({ status: 'present', token: 'abc123' });
  });

  it('removes the token from the address bar and keeps other parameters', () => {
    mockRouter.query = { token: 'abc123', utm_source: 'email' };

    renderHook(() => useQueryToken());

    expect(mockReplace).toHaveBeenCalledWith({ pathname: '/reset-password', query: { utm_source: 'email' } }, undefined, {
      shallow: true,
    });
  });

  it('keeps the token after the address bar no longer has it', () => {
    mockRouter.query = { token: 'abc123' };
    const { result, rerender } = renderHook(() => useQueryToken());

    mockRouter.query = {};
    rerender();

    expect(result.current).toEqual({ status: 'present', token: 'abc123' });
  });

  it('reports a missing token when the link has none', () => {
    const { result } = renderHook(() => useQueryToken());

    expect(result.current).toEqual({ status: 'missing' });
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('treats a repeated token parameter as missing', () => {
    mockRouter.query = { token: ['one', 'two'] };

    const { result } = renderHook(() => useQueryToken());

    expect(result.current).toEqual({ status: 'missing' });
  });
});
