jest.mock('../../utils/analytics', () => ({
  trackEvent: jest.fn(),
}));
jest.mock('../../components/artifacts/ArtifactVersionHistory', () => ({
  ArtifactVersionHistory: () => <div>history list</div>,
  formatStamp: () => 'Oct 16, 11:49 AM',
}));

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { conceptGraphFixture } from '../../content/conceptGraphFixture';
import { ConceptGraphView } from '../../components/artifacts/ConceptGraphView';
import { ArtifactView } from '../../components/artifacts/ArtifactView';
import { Artifact } from '../../types.internal';

/* jsdom lays nothing out, so "fits on one screen" can't be measured here. What can be checked is the structure
   the one-screen layout depends on: with a wide, tall window the artifact's heading lives in the reading
   column beside the sky; without one it sits above the card, as it always did. */
function mockMedia({ fit }: { fit: boolean }) {
  window.matchMedia = jest.fn().mockImplementation((query: string) => ({
    matches: query.includes('min-width') ? fit : false,
    media: query,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    addListener: jest.fn(),
    removeListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })) as unknown as typeof window.matchMedia;
}

afterEach(() => {
  delete (window as { matchMedia?: unknown }).matchMedia;
});

const sky = (container: HTMLElement) => container.querySelector('.concept-sky') as HTMLElement;

describe('ConceptGraphView layout', () => {
  it('puts the heading and the key in the reading column when the window is wide and tall', () => {
    mockMedia({ fit: true });
    const { container } = render(<ConceptGraphView payload={conceptGraphFixture} header={<h1>Series map</h1>} />);
    expect(within(sky(container)).getByRole('heading', { name: 'Series map' })).toBeInTheDocument();
    expect(within(sky(container)).getByRole('list', { name: 'Legend' })).toBeInTheDocument();
  });

  it('keeps the heading above the card on a smaller window', () => {
    mockMedia({ fit: false });
    const { container } = render(<ConceptGraphView payload={conceptGraphFixture} header={<h1>Series map</h1>} />);
    expect(screen.getByRole('heading', { name: 'Series map' })).toBeInTheDocument();
    expect(within(sky(container)).queryByRole('heading', { name: 'Series map' })).not.toBeInTheDocument();
  });

  it('asks for feedback exactly once in either layout', () => {
    for (const fit of [true, false]) {
      mockMedia({ fit });
      const { unmount } = render(<ConceptGraphView payload={conceptGraphFixture} />);
      expect(screen.getAllByText('Is this graph interesting, useful and clear?')).toHaveLength(1);
      unmount();
    }
  });
});

describe('ArtifactView for a concept graph', () => {
  const artifact = {
    id: 'a1',
    type: 'ConceptGraphArtifact',
    title: 'Concept map',
    currentVersionNumber: 5,
    currentVersion: {
      versionNumber: 5,
      createdAt: '2026-10-16T18:49:00Z',
      note: 'Recomputed from scratch',
      payload: conceptGraphFixture,
    },
  } as unknown as Artifact;

  it('shows the title, version and note, and opens the history over the graph', async () => {
    mockMedia({ fit: true });
    render(<ArtifactView artifact={artifact} />);
    expect(await screen.findByRole('heading', { name: 'Concept map' })).toBeInTheDocument();
    expect(screen.getByText(/Version 5/)).toBeInTheDocument();
    expect(screen.getByText('Recomputed from scratch')).toBeInTheDocument();
    expect(screen.queryByText('history list')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /history/i }));
    expect(screen.getByRole('dialog', { name: 'Version history' })).toBeInTheDocument();
    expect(screen.getByText('history list')).toBeInTheDocument();
  });
});
