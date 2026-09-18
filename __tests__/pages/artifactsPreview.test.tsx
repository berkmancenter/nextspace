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
    const { container } = render(<ArtifactPreviewPage />);

    expect(container.querySelector('[data-node-id="c-assistant"]')).toBeInTheDocument();
    expect(container.querySelector('[data-node-id="c-trust"]')).toBeInTheDocument();
    expect(container.querySelector('[data-node-id="k18"]')).toBeInTheDocument();
  });

  it('draws the minimal fixture alongside it', () => {
    const { container } = render(<ArtifactPreviewPage />);

    expect(container.querySelectorAll(`[data-node-id="${minimalConceptGraphFixture.contributions[0].id}"]`)).toHaveLength(1);
  });

  it('shows the empty state too, which is a valid graph', () => {
    render(<ArtifactPreviewPage />);

    expect(screen.getByText(/empty so far/i)).toBeInTheDocument();
  });

  it('says the data is local, so nobody mistakes it for an event', () => {
    render(<ArtifactPreviewPage />);

    expect(screen.getByText(/makes no requests/i)).toBeInTheDocument();
  });

  it('draws a node for every concept the fixture holds', () => {
    // Every concept gets a node. Whether it gets a *label* depends on whether one fits
    // without printing over a better-connected neighbour, which is the renderer's call.
    const { container } = render(<ArtifactPreviewPage />);

    for (const concept of conceptGraphFixture.concepts) {
      expect(container.querySelector(`[data-node-id="${concept.id}"]`)).toBeInTheDocument();
    }
  });
});
