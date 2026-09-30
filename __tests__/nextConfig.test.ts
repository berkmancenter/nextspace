import nextConfig from '../next.config.mjs';

describe('next.config redirects', () => {
  it('sends the old lounge address to the hallway, so saved links keep working', async () => {
    const redirects = await nextConfig.redirects?.();

    expect(redirects).toContainEqual({ source: '/lounge', destination: '/hallway', permanent: true });
  });
});
