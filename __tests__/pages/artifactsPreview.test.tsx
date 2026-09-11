import { render, screen } from '@testing-library/react';
import ArtifactPreviewPage from '../../pages/artifacts/preview';
import { conceptGraphFixture, minimalConceptGraphFixture } from '../../content/conceptGraphFixture';

/* next/dynamic defers the graph past this render, so it is resolved eagerly here — the point
   of these tests is that the page hands the fixtures to the renderer. */
jest.mock('next/dynamic', () => (loader: () => Promise<any>, options: any) => {
  const { ConceptGraphView } = jest.requireActual('../../components/artifacts/ConceptGraphView');
  void loader;
  void options;
  return ConceptGraphView;
});

describe('the artifact preview page', () => {
  it('draws the full fixture, so the renderer can be looked at without a backend', () => {
    render(<ArtifactPreviewPage />);

    expect(screen.getByText('Verifiable Credential')).toBeInTheDocument();
    expect(screen.getByText('Trust Registry')).toBeInTheDocument();
    expect(screen.getByText('co-governs')).toBeInTheDocument();
  });

  it('draws the minimal fixture alongside it', () => {
    render(<ArtifactPreviewPage />);

    expect(screen.getByText(minimalConceptGraphFixture.contributions[0].kind)).toBeInTheDocument();
  });

  it('shows the empty state too, which is a valid graph', () => {
    render(<ArtifactPreviewPage />);

    expect(screen.getByText(/empty so far/i)).toBeInTheDocument();
  });

  it('says the data is local, so nobody mistakes it for an event', () => {
    render(<ArtifactPreviewPage />);

    expect(screen.getByText(/makes no requests/i)).toBeInTheDocument();
  });

  it('draws every concept the fixture holds', () => {
    render(<ArtifactPreviewPage />);

    for (const concept of conceptGraphFixture.concepts) {
      expect(screen.getAllByText(concept.label).length).toBeGreaterThan(0);
    }
  });
});
