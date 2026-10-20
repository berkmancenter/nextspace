jest.mock('../../utils/analytics', () => ({
  trackEvent: jest.fn(),
  trackConversationEvent: jest.fn(),
  deleteCustomDimension: jest.fn(),
}));
jest.mock('../../components/artifacts/ArtifactVersionHistory', () => ({
  ArtifactVersionHistory: ({ onSelectVersion }: { onSelectVersion: (v: unknown) => void }) => (
    <div>
      <button onClick={() => onSelectVersion({ versionNumber: 2, payload: { body: 'old' } })}>pick v2</button>
      <button onClick={() => onSelectVersion({ versionNumber: 5, payload: { body: 'new' } })}>pick v5</button>
    </div>
  ),
  formatStamp: () => 'Oct 16, 11:49 AM',
}));

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { conceptGraphFixture } from '../../content/conceptGraphFixture';
import { ArtifactView } from '../../components/artifacts/ArtifactView';
import { trackConversationEvent, trackEvent } from '../../utils/analytics';
import { Artifact } from '../../types.internal';

const documentArtifact = {
  id: 'd1',
  type: 'DocumentArtifact',
  title: 'Notes',
  currentVersionNumber: 5,
  currentVersion: { versionNumber: 5, payload: { body: 'new' } },
} as unknown as Artifact;

const graphArtifact = {
  id: 'g1',
  type: 'ConceptGraphArtifact',
  title: 'Concept map',
  currentVersionNumber: 5,
  currentVersion: { versionNumber: 5, payload: conceptGraphFixture },
} as unknown as Artifact;

beforeEach(() => {
  jest.clearAllMocks();
  window.matchMedia = jest.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    addListener: jest.fn(),
    removeListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })) as unknown as typeof window.matchMedia;
});

afterEach(() => {
  delete (window as { matchMedia?: unknown }).matchMedia;
});

describe('ArtifactView analytics', () => {
  it('tracks opening and closing the history, attributed to the conversation', async () => {
    render(<ArtifactView artifact={documentArtifact} conversationId="conv-1" />);

    await userEvent.click(screen.getByRole('button', { name: 'History' }));
    expect(trackConversationEvent).toHaveBeenCalledWith('conv-1', 'artifact', 'history_open', 'DocumentArtifact', undefined);

    await userEvent.click(screen.getByRole('button', { name: 'Hide history' }));
    expect(trackConversationEvent).toHaveBeenCalledWith(
      'conv-1',
      'artifact',
      'history_close',
      'DocumentArtifact',
      undefined,
    );
  });

  it('tracks stepping back to an earlier version and returning to the latest, with the version number', async () => {
    render(<ArtifactView artifact={documentArtifact} conversationId="conv-1" />);
    await userEvent.click(screen.getByRole('button', { name: 'History' }));

    await userEvent.click(screen.getByRole('button', { name: 'pick v2' }));
    expect(trackConversationEvent).toHaveBeenCalledWith('conv-1', 'artifact', 'version_select', 'earlier', 2);

    await userEvent.click(screen.getByRole('button', { name: 'Latest' }));
    expect(trackConversationEvent).toHaveBeenCalledWith('conv-1', 'artifact', 'version_select', 'latest', 5);

    await userEvent.click(screen.getByRole('button', { name: 'pick v5' }));
    expect(trackConversationEvent).toHaveBeenCalledWith('conv-1', 'artifact', 'version_select', 'latest', 5);
  });

  it('tracks without attribution when there is no conversation (a series)', async () => {
    render(<ArtifactView artifact={documentArtifact} />);

    await userEvent.click(screen.getByRole('button', { name: 'History' }));

    expect(trackEvent).toHaveBeenCalledWith('artifact', 'history_open', 'DocumentArtifact', undefined);
    expect(trackConversationEvent).not.toHaveBeenCalled();
  });

  it('tracks the history dialog of a concept graph, and hands the conversation to the graph', async () => {
    render(<ArtifactView artifact={graphArtifact} conversationId="conv-1" />);

    await userEvent.click(await screen.findByRole('button', { name: /history/i }));
    expect(trackConversationEvent).toHaveBeenCalledWith(
      'conv-1',
      'artifact',
      'history_open',
      'ConceptGraphArtifact',
      undefined,
    );

    await userEvent.keyboard('{Escape}');
    expect(trackConversationEvent).toHaveBeenCalledWith(
      'conv-1',
      'artifact',
      'history_close',
      'ConceptGraphArtifact',
      undefined,
    );

    await userEvent.click((await screen.findAllByRole('button', { name: /, concept/ }, { timeout: 3000 }))[0]);
    expect(trackConversationEvent).toHaveBeenCalledWith('conv-1', 'graph', 'select', 'concept', undefined);
  });
});
