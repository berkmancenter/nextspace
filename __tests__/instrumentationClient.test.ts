import * as Sentry from '@sentry/nextjs';

jest.mock('@sentry/nextjs', () => ({
  init: jest.fn(),
  replayIntegration: jest.fn(() => ({ name: 'Replay' })),
  captureRouterTransitionStart: jest.fn(),
}));

const loadClientConfig = (path: string) => {
  window.history.replaceState({}, '', path);
  jest.isolateModules(() => {
    require('../instrumentation-client');
  });
  return (Sentry.init as jest.Mock).mock.calls.at(-1)[0];
};

describe('client Sentry config', () => {
  afterEach(() => {
    window.history.replaceState({}, '', '/');
  });

  it('redacts reset tokens from errors, transactions, and breadcrumbs', () => {
    const config = loadClientConfig('/');
    const url = 'https://app.example.com/reset-password?token=secret';

    expect(config.beforeSend({ request: { url } }).request.url).not.toContain('secret');
    expect(config.beforeSendTransaction({ request: { url } }).request.url).not.toContain('secret');
    expect(config.beforeBreadcrumb({ data: { from: url } }).data.from).not.toContain('secret');
  });

  it('records session replays on ordinary pages', () => {
    const config = loadClientConfig('/lounge');

    expect(config.integrations).toEqual([{ name: 'Replay' }]);
  });

  it('does not record session replays on the password reset page', () => {
    const config = loadClientConfig('/reset-password?token=secret');

    expect(config.integrations).toEqual([]);
  });
});
