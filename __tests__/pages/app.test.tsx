import React from 'react';
import { render, screen } from '@testing-library/react';
import type { AppProps } from 'next/app';
import App from '../../pages/_app';
import SessionManager from '../../utils/SessionManager';

let mockPathname = '/';
jest.mock('next/router', () => ({
  useRouter: () => ({ pathname: mockPathname, asPath: mockPathname, isReady: true }),
}));

jest.mock('../../utils/SessionManager', () => ({
  __esModule: true,
  default: { get: jest.fn() },
}));

jest.mock('../../hooks/useAnalytics', () => ({ useSessionTracking: jest.fn() }));

jest.mock('../../components', () => ({
  Layout: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const restoreSession = jest.fn().mockResolvedValue(null);

const renderApp = async (pathname: string) => {
  mockPathname = pathname;
  const Page = () => <p>page body</p>;
  render(<App {...({ Component: Page, pageProps: {} } as unknown as AppProps)} />);
  await screen.findByText('page body');
};

describe('App session setup', () => {
  beforeEach(() => {
    restoreSession.mockClear();
    (SessionManager.get as jest.Mock).mockReturnValue({ restoreSession });
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('creates a guest session on an ordinary page', async () => {
    await renderApp('/hallway');

    expect(restoreSession).toHaveBeenCalledWith({ skipCreation: false });
  });

  it('never creates a guest session on the forgot password page', async () => {
    await renderApp('/forgot-password');

    expect(restoreSession).toHaveBeenCalledWith({ skipCreation: true });
  });

  it.each(['/invite', '/reset-password'])(
    'never creates a guest session on %s, which mail scanners open before the person does',
    async (pathname) => {
      await renderApp(pathname);

      expect(restoreSession).toHaveBeenCalledWith({ skipCreation: true });
    },
  );
});
