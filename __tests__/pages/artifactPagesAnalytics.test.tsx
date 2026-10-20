const mockUseAnalytics = jest.fn();
jest.mock('../../hooks/useAnalytics', () => ({
  useAnalytics: (options: unknown) => mockUseAnalytics(options),
}));

jest.mock('next/router', () => ({
  useRouter: () => ({ isReady: true, query: {}, replace: jest.fn() }),
}));

jest.mock('next/head', () => ({ __esModule: true, default: () => null }));

jest.mock('../../hooks', () => ({
  useSessionJoin: () => ({ socket: null }),
}));

jest.mock('../../utils', () => ({
  CheckAuthHeader: jest.fn(),
}));

jest.mock('../../components', () => ({
  ArtifactsBrowser: () => <div>browser</div>,
}));

jest.mock('next/dynamic', () => () => () => null);

import { render } from '@testing-library/react';
import ConversationArtifactsPage from '../../pages/artifacts/[conversationId]';
import TopicArtifactsPage from '../../pages/artifacts/topic/[topicId]';
import ArtifactPreviewPage from '../../pages/artifacts/preview';

beforeEach(() => jest.clearAllMocks());

describe('artifact pages analytics', () => {
  it('tracks the conversation artifacts page as a participant-tagged page type', () => {
    render(<ConversationArtifactsPage authType={'guest' as never} />);

    expect(mockUseAnalytics).toHaveBeenCalledWith({ pageType: 'artifacts' });
  });

  it('tracks the series page as its own page type, which is never visit-tagged', () => {
    render(<TopicArtifactsPage authType={'guest' as never} />);

    expect(mockUseAnalytics).toHaveBeenCalledWith({ pageType: 'artifacts_topic' });
  });

  it('tracks the fixture preview page as a page view only', () => {
    render(<ArtifactPreviewPage />);

    expect(mockUseAnalytics).toHaveBeenCalledWith({ pageType: 'artifacts_preview' });
  });
});
