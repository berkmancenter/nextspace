import { fireEvent, render, screen, within } from '@testing-library/react';
import ArtifactPreviewPage from '../../pages/artifacts/preview';
import { conceptGraphFixture, minimalConceptGraphFixture, seriesConceptGraphFixture } from '../../content/conceptGraphFixture';

const nodeHandle = (container: HTMLElement, id: string) => container.querySelector(`[data-node-id="${id}"]`);

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

  it('names what the series fixture’s folded concept encompasses, on demand', () => {
    // The series fixture stands in for a graph that outgrew its size cap: `s-c-trust` carries
    // a `foldedFrom` the same as a real fold would leave behind, so a reviewer can see the
    // detail card's "Also encompasses" line without a real series long enough to trigger one.
    const folded = seriesConceptGraphFixture.concepts.find((c) => c.foldedFrom?.length);
    expect(folded).toBeDefined();

    const { container } = render(<ArtifactPreviewPage />);

    // No permanent mark on the canvas — same rule as a statement or an origin prompt. Scoped
    // to the detail cards themselves (there are none until something is hovered or clicked),
    // since the section's own descriptive prose names the folded label deliberately, to tell a
    // reviewer what to click for.
    for (const detail of screen.queryAllByTestId('graph-node-detail')) {
      expect(within(detail).queryByText(new RegExp(folded!.foldedFrom![0]))).not.toBeInTheDocument();
    }

    fireEvent.click(nodeHandle(container, folded!.id)!);

    const details = screen.getAllByTestId('graph-node-detail');
    const withFold = details.find((detail) => within(detail).queryByText(new RegExp(folded!.foldedFrom![0])));
    expect(withFold).toBeDefined();
  });
});
