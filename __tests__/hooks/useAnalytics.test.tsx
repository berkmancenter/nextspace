import { renderHook } from '@testing-library/react';
import { useAnalytics } from '../../hooks/useAnalytics';
import { setTrackedUrl, tagEventVisit, trackPageView } from '../../utils/analytics';

// Mock the router so we can control the conversation id in scope on mount.
const mockRouter = {
  pathname: '/assistant',
  asPath: '/assistant?conversationId=conv-123',
  query: {} as Record<string, string>,
};
jest.mock('next/router', () => ({
  useRouter: () => mockRouter,
}));

// Stub the analytics utilities so we only assert on the calls, not Matomo wiring.
jest.mock('../../utils/analytics', () => ({
  trackPageView: jest.fn(),
  trackVisibilityChange: jest.fn(),
  trackSessionStart: jest.fn(),
  trackSessionEnd: jest.fn(),
  setCustomDimension: jest.fn(),
  trackUserLocation: jest.fn(),
  tagEventVisit: jest.fn(),
  setTrackedUrl: jest.fn(),
}));

// The duration hook touches timers/visibility we don't care about here.
jest.mock('../../hooks/useVisibilityAwareDuration', () => ({
  useVisibilityAwareDuration: () => ({ start: jest.fn(), stop: jest.fn(() => 0) }),
}));

describe('useAnalytics visit tagging', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRouter.query = {};
  });

  it('tags the visit on a participant event page (assistant)', () => {
    mockRouter.query = { conversationId: 'conv-123' };

    renderHook(() => useAnalytics({ pageType: 'assistant' }));

    expect(tagEventVisit).toHaveBeenCalledWith('conv-123');
  });

  it('tags the visit on the backchannel participant page', () => {
    mockRouter.query = { conversationId: 'conv-123' };

    renderHook(() => useAnalytics({ pageType: 'backchannel' }));

    expect(tagEventVisit).toHaveBeenCalledWith('conv-123');
  });

  it('does NOT tag the visit on the moderator page', () => {
    mockRouter.query = { conversationId: 'conv-123' };

    renderHook(() => useAnalytics({ pageType: 'moderator' }));

    // Moderators are staff, not audience; counting them would muddy the
    // "big audience, few talkers" signal the tracked-session segment exists to show.
    expect(tagEventVisit).not.toHaveBeenCalled();
  });

  it('does NOT tag the visit on the presentation page', () => {
    mockRouter.query = { conversationId: 'conv-123' };

    renderHook(() => useAnalytics({ pageType: 'presentation' }));

    expect(tagEventVisit).not.toHaveBeenCalled();
  });

  it('does NOT tag a visit when there is no conversation id (e.g. home)', () => {
    mockRouter.query = {};

    renderHook(() => useAnalytics({ pageType: 'home' }));

    expect(tagEventVisit).not.toHaveBeenCalled();
  });

  it('tags the visit on the conversation artifacts page, which audience members read', () => {
    mockRouter.query = { conversationId: 'conv-123' };

    renderHook(() => useAnalytics({ pageType: 'artifacts' }));

    expect(tagEventVisit).toHaveBeenCalledWith('conv-123');
    expect(trackPageView).toHaveBeenCalledWith('/assistant', expect.objectContaining({ conversationId: 'conv-123' }));
  });

  it('does NOT tag the series or preview artifact pages, but still records the page view', () => {
    mockRouter.query = { topicId: 'topic-1' };

    renderHook(() => useAnalytics({ pageType: 'artifacts_topic' }));
    renderHook(() => useAnalytics({ pageType: 'artifacts_preview' }));

    expect(tagEventVisit).not.toHaveBeenCalled();
    expect(trackPageView).toHaveBeenCalledTimes(2);
  });
});

describe('useAnalytics passcode privacy', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRouter.query = {};
  });

  const pathSent = () => (trackPageView as jest.Mock).mock.calls[0][1].path;

  it('strips a lone artifactPasscode from the page view path and the Matomo URL', () => {
    mockRouter.pathname = '/artifacts/[conversationId]';
    mockRouter.asPath = '/artifacts/c1?artifactPasscode=secret';
    renderHook(() => useAnalytics({ pageType: 'artifacts' }));
    expect(pathSent()).toBe('/artifacts/c1');
    expect(setTrackedUrl).toHaveBeenCalledWith(expect.stringMatching(/\/artifacts\/c1$/));
  });

  it('keeps other parameters when stripping the passcode', () => {
    mockRouter.asPath = '/artifacts/c1?artifactPasscode=secret&view=orbit';
    renderHook(() => useAnalytics({ pageType: 'artifacts' }));
    expect(pathSent()).toBe('/artifacts/c1?view=orbit');
    expect(setTrackedUrl).toHaveBeenCalledWith(expect.stringMatching(/\/artifacts\/c1\?view=orbit$/));
  });

  it('leaves a path with no query alone and does not override the Matomo URL', () => {
    mockRouter.asPath = '/artifacts/c1';
    renderHook(() => useAnalytics({ pageType: 'artifacts' }));
    expect(pathSent()).toBe('/artifacts/c1');
    expect(setTrackedUrl).not.toHaveBeenCalled();
  });

  it('tolerates a router with no asPath and does not override the Matomo URL', () => {
    const original = mockRouter.asPath;
    (mockRouter as { asPath?: string }).asPath = undefined;
    try {
      expect(() => renderHook(() => useAnalytics({ pageType: 'artifacts' }))).not.toThrow();
      expect(pathSent()).toBe('');
      expect(setTrackedUrl).not.toHaveBeenCalled();
    } finally {
      mockRouter.asPath = original;
    }
  });
});
