import nextConfig from '../next.config.mjs';

describe('next.config redirects', () => {
  it('sends the old lounge address to the hallway, so saved links keep working', async () => {
    const redirects = await nextConfig.redirects?.();

    expect(redirects).toContainEqual({ source: '/lounge', destination: '/hallway', permanent: true });
  });
});

describe('next.config headers', () => {
  it('sends no referrer from the presentation view, whose address carries the participant passcodes', async () => {
    const headers = await nextConfig.headers?.();

    expect(headers).toContainEqual({
      source: '/present',
      headers: [{ key: 'Referrer-Policy', value: 'no-referrer' }],
    });
  });
});
