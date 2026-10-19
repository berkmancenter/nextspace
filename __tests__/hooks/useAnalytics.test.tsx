import { renderHook } from '@testing-library/react';
import { useAnalytics } from '../../hooks/useAnalytics';
import { tagEventVisit, trackPageView } from '../../utils/analytics';

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
