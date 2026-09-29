import { isTokenPage, scrubSentryEvent, scrubTokenFromUrl } from '../../utils/tokenPrivacy';

describe('scrubTokenFromUrl', () => {
  it('redacts the token from an absolute URL', () => {
    expect(scrubTokenFromUrl('https://app.example.com/reset-password?token=abc.def.ghi')).toBe(
      'https://app.example.com/reset-password?token=REDACTED',
    );
  });

  it('redacts the token when it is not the first query parameter', () => {
    expect(scrubTokenFromUrl('/reset-password?utm=email&token=abc&x=1#top')).toBe(
      '/reset-password?utm=email&token=REDACTED&x=1#top',
    );
  });

  it('leaves URLs without a token alone', () => {
    expect(scrubTokenFromUrl('/login?redirectTo=/lounge')).toBe('/login?redirectTo=/lounge');
  });

  it('does not touch parameters that only end in "token"', () => {
    expect(scrubTokenFromUrl('/x?csrftoken=keep')).toBe('/x?csrftoken=keep');
  });
});

describe('scrubSentryEvent', () => {
  it('redacts the token from the request URL, query string, breadcrumbs, and spans', () => {
    const event = {
      transaction: '/reset-password?token=secret',
      request: {
        url: 'https://app.example.com/reset-password?token=secret',
        query_string: 'token=secret',
      },
      breadcrumbs: [{ category: 'navigation', data: { from: '/reset-password?token=secret', to: '/login' } }],
      spans: [{ description: 'GET /reset-password?token=secret', data: { url: '/reset-password?token=secret' } }],
    };

    const serialized = JSON.stringify(scrubSentryEvent(event));

    expect(serialized).not.toContain('secret');
    expect(serialized).toContain('token=REDACTED');
  });

  it('handles objects that refer back to themselves without recursing forever', () => {
    const replay: Record<string, unknown> = { url: '/reset-password?token=secret' };
    replay.self = replay;
    const event = { extra: { replay } };

    const scrubbed = scrubSentryEvent(event) as { extra: { replay: Record<string, unknown> } };

    expect(scrubbed.extra.replay.url).toBe('/reset-password?token=REDACTED');
  });

  it("leaves Sentry's internal processing metadata and class instances untouched", () => {
    class Scope {
      client = { scope: this as Scope };
    }
    const scope = new Scope();
    const event = { sdkProcessingMetadata: { capturedSpanScope: scope }, extra: { scope } };

    const scrubbed = scrubSentryEvent(event);

    expect(scrubbed.sdkProcessingMetadata).toBe(event.sdkProcessingMetadata);
    expect(scrubbed.extra.scope).toBe(scope);
  });

  it('redacts a query string that Sentry has parsed into an object', () => {
    const event = { request: { query_string: { token: 'secret', other: 'keep' } } };

    expect(scrubSentryEvent(event).request.query_string).toEqual({ token: 'REDACTED', other: 'keep' });
  });
});

describe('isTokenPage', () => {
  it('matches the password reset page', () => {
    expect(isTokenPage('/reset-password')).toBe(true);
  });

  it('does not match other pages', () => {
    expect(isTokenPage('/login')).toBe(false);
  });
});
