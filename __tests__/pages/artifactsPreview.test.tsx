jest.mock('../../hooks/useAnalytics', () => ({ useAnalytics: jest.fn() }));

import { fireEvent, render, screen } from '@testing-library/react';
import ArtifactPreviewPage from '../../pages/artifacts/preview';
import {
  conceptGraphFixture,
  denseConceptGraphFixture,
  minimalConceptGraphFixture,
  seriesConceptGraphFixture,
} from '../../content/conceptGraphFixture';

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

    for (const concept of conceptGraphFixture.concepts) {
      expect(container.querySelector(`[data-concept-id="${concept.id}"]`)).toBeInTheDocument();
    }
    // k18 joins three concepts, so it is a diamond.
    expect(
      screen.getByRole('button', { name: /^Co-shapes, quote, joins The Assistant, Trust and Skepticism$/ }),
    ).toBeInTheDocument();
  });

  it('draws the minimal fixture alongside it', () => {
    const { container } = render(<ArtifactPreviewPage />);

    expect(container.querySelectorAll(`[data-concept-id="${minimalConceptGraphFixture.concepts[0].id}"]`)).toHaveLength(1);
  });

  it('draws the series, long-series and dense fixtures too', () => {
    const { container } = render(<ArtifactPreviewPage />);

    expect(container.querySelector('[data-concept-id="s-c-trust"]')).toBeInTheDocument();
    expect(container.querySelector('[data-concept-id="l-c8"]')).toBeInTheDocument();
    expect(container.querySelector(`[data-concept-id="${denseConceptGraphFixture.concepts[46].id}"]`)).toBeInTheDocument();
  });

  it('shows the empty state too, which is a valid graph', () => {
    render(<ArtifactPreviewPage />);

    expect(screen.getByText(/this graph is empty so far/i)).toBeInTheDocument();
  });

  it('says the data is local, so nobody mistakes it for an event', () => {
    render(<ArtifactPreviewPage />);

    expect(screen.getByText(/makes no requests/i)).toBeInTheDocument();
  });

  it('names what the series fixture’s folded concept encompasses, on demand', () => {
    // `s-c-trust` carries a `foldedFrom` the same as a real fold would leave behind, so a
    // reviewer can see the panel's "Also encompasses" line without a series long enough to fold.
    const folded = seriesConceptGraphFixture.concepts.find((c) => c.foldedFrom?.length);
    expect(folded).toBeDefined();
    const text = `Also encompasses ${folded!.foldedFrom![0]}`;

    const { container } = render(<ArtifactPreviewPage />);

    // No permanent mark on the sky: it only shows once the concept is selected.
    expect(screen.queryByText(text)).not.toBeInTheDocument();
    fireEvent.click(container.querySelector(`[data-concept-id="${folded!.id}"]`)!);
    expect(screen.getAllByText(text)).toHaveLength(1);
  });
});
