jest.mock('../../utils', () => ({
  generateConceptGraph: jest.fn(),
}));

import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  conceptGraphFixture,
  minimalConceptGraphFixture,
  seriesConceptGraphFixture,
} from '../../content/conceptGraphFixture';
import { generateConceptGraph } from '../../utils';
import { GenerateGraphButton } from '../../components/artifacts/GenerateGraphButton';
import { ArtifactList } from '../../components/artifacts/ArtifactList';
import { ArtifactPasscodePrompt } from '../../components/artifacts/ArtifactPasscodePrompt';
import { ConceptGraphView } from '../../components/artifacts/ConceptGraphView';
import { DocumentArtifactView } from '../../components/artifacts/DocumentArtifactView';
import { Artifact } from '../../types.internal';

const graph = {
  originPrompts: [{ id: 'p1', text: 'What has to be trustworthy here?' }],
  concepts: [
    { id: 'c-issuer', label: 'Issuer', origin: 'p1' },
    { id: 'c-verifier', label: 'Verifier' },
  ],
  contributions: [{ id: 'k15', kind: 'co-governs', concepts: ['c-issuer', 'c-verifier'] }],
};

/* jsdom never lays out real content, so a container's `clientWidth` is always 0 — which would
   pin every ConceptGraphView render here to the 320px mobile floor it falls back to, rather
   than a width anything like a real desktop viewport. d3-force's own ticks are scheduled by
   rAF and nothing here awaits them, so a render also never gets a real fit-to-view pass; the
   nodes below sit exactly where the initial seed spiral placed them, seeded against the
   component's own initial `width` state (720) before that measurement ever lands — so this
   has to differ from 720, or React sees no change and never re-renders the seeded positions
   in at all. A realistic, different width keeps that seed placement safely on screen without
   leaning on any one label's incidental size to make the margin work out. */
beforeEach(() => {
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, value: 900 });
});

describe('ConceptGraphView', () => {
  it('draws a node per concept and per contribution, keyed by id', () => {
    const { container } = render(<ConceptGraphView payload={graph} />);

    // Keyed on id rather than label: ids are stable across versions, so a concept that
    // survives a revision is the same node and keeps its place.
    expect(container.querySelector('[data-node-id="c-issuer"]')).toBeInTheDocument();
    expect(container.querySelector('[data-node-id="c-verifier"]')).toBeInTheDocument();
    expect(container.querySelector('[data-node-id="k15"]')).toBeInTheDocument();

    // Origin prompts are hidden until asked for — see the 'origin prompts' describe block
    // below — so this one only appears once the toggle is switched on.
    expect(container.querySelector('[data-node-id="p1"]')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Show origin prompts' }));
    expect(container.querySelector('[data-node-id="p1"]')).toBeInTheDocument();
  });

  it('names concepts by label and contributions by kind', () => {
    render(<ConceptGraphView payload={graph} />);
    const description = screen.getByText(/concepts joined by/);

    expect(description).toHaveTextContent('Issuer');
    expect(description).toHaveTextContent('Verifier');
    expect(description).toHaveTextContent('co-governs');
  });

  it('reads the graph out in sentences for anyone not looking at the picture', () => {
    render(<ConceptGraphView payload={graph} />);

    expect(screen.getByText(/2 concepts joined by 1 contribution/)).toBeInTheDocument();
    expect(screen.getByText(/Issuer, Verifier — co-governs/)).toBeInTheDocument();
  });

  it('renders an empty state rather than an empty canvas', () => {
    render(<ConceptGraphView payload={{ concepts: [], contributions: [], originPrompts: [] }} />);

    expect(screen.getByText(/empty so far/i)).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('offers zoom controls', () => {
    render(<ConceptGraphView payload={graph} />);

    expect(screen.getByRole('button', { name: 'Zoom in' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Fit graph to view' })).toBeInTheDocument();
  });
});

describe('ConceptGraphView, against the fixture the preview page draws', () => {
  /** The node group itself, which is what carries the hover and click handlers. */
  const nodeHandle = (container: HTMLElement, id: string) => container.querySelector(`[data-node-id="${id}"]`);

  it('draws the contribution that joins three concepts as one node', () => {
    const { container } = render(<ConceptGraphView payload={conceptGraphFixture} />);

    // One diamond, not three edges: that is the whole point of a contribution being a node.
    expect(container.querySelectorAll('[data-node-id="k18"]')).toHaveLength(1);
  });

  it('names the best-connected concepts on the canvas', () => {
    const { container } = render(<ConceptGraphView payload={conceptGraphFixture} />);
    const drawn = Array.from(container.querySelectorAll('text')).map((t) => t.textContent);

    // Labels that would print over each other are dropped, so not every concept is named —
    // but the hub of the graph always is, because degree wins the space.
    expect(drawn).toContain('The Assistant');
    expect(drawn.length).toBeGreaterThan(1);
  });

  it('leaves no concept out of the reading, whatever the canvas had room to label', () => {
    render(<ConceptGraphView payload={conceptGraphFixture} />);
    const description = screen.getByText(/concepts joined by/);

    // Dropping a label is a drawing decision, never a loss of content: everything the graph
    // holds stays in the description a screen reader gets.
    for (const concept of conceptGraphFixture.concepts) {
      expect(description).toHaveTextContent(concept.label);
    }
  });

  it('keeps an origin prompt hidden until the reader asks for it, then draws it in full', () => {
    render(<ConceptGraphView payload={minimalConceptGraphFixture} />);

    // Hidden by default: most nodes carry no origin at all, and drawing every prompt
    // unconditionally would spend canvas space on something most readers are not looking for.
    expect(screen.queryByText('What does it feel like when it actually helps?')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Show origin prompts' }));

    // Shown in full, never elided — a pill wide enough for the whole prompt rather than an
    // ellipsis cutting it short.
    expect(screen.getByText('What does it feel like when it actually helps?')).toBeInTheDocument();
  });

  it('offers no origin toggle on a graph that has none to show', () => {
    render(<ConceptGraphView payload={{ concepts: [{ id: 'c1', label: 'One' }], contributions: [], originPrompts: [] }} />);

    expect(screen.queryByRole('button', { name: /origin prompts/i })).not.toBeInTheDocument();
  });

  it('names the toggle for whichever state it would switch to', () => {
    render(<ConceptGraphView payload={minimalConceptGraphFixture} />);

    const button = screen.getByRole('button', { name: 'Show origin prompts' });
    fireEvent.click(button);
    expect(screen.getByRole('button', { name: 'Hide origin prompts' })).toBeInTheDocument();
  });

  it('reads a contribution’s statement out when the node is selected', () => {
    const { container } = render(<ConceptGraphView payload={conceptGraphFixture} />);

    fireEvent.click(nodeHandle(container, 'k18')!);

    // Scoped to the card: the statement is also in the graph's screen-reader description.
    const detail = within(screen.getByTestId('graph-node-detail'));
    expect(detail.getByText(/doesn't come from believing it's always right/)).toBeInTheDocument();
    expect(detail.getByText(/joins 3/)).toBeInTheDocument();
  });

  it('labels whatever the reader points at, even where the canvas is crowded', () => {
    const { container } = render(<ConceptGraphView payload={conceptGraphFixture} />);

    fireEvent.mouseEnter(nodeHandle(container, 'c-habit')!);
    const drawn = Array.from(container.querySelectorAll('text')).map((t) => t.textContent);

    // A label may lose its place to a better-connected neighbour, but never while it is the
    // thing being asked about.
    expect(drawn).toContain('Habit');
  });

  it('shows nothing about who contributed a node, under the Chatham House Rule', () => {
    const { container } = render(<ConceptGraphView payload={conceptGraphFixture} />);

    fireEvent.click(nodeHandle(container, 'k18')!);

    const detail = within(screen.getByTestId('graph-node-detail'));
    expect(detail.queryByText(/pseudonym|contributed by|said by/i)).not.toBeInTheDocument();
  });
});

describe('ConceptGraphView on a series graph', () => {
  it('colours concepts by the session that raised them, and says which in the legend', () => {
    render(<ConceptGraphView payload={seriesConceptGraphFixture} />);

    // Sessions are numbered by first appearance: a conversation id means nothing to a reader.
    expect(screen.getByText('session 1')).toBeInTheDocument();
    expect(screen.getByText('session 2')).toBeInTheDocument();
    expect(screen.getByText('session 3')).toBeInTheDocument();
    expect(screen.queryByText('concept')).not.toBeInTheDocument();
  });

  it('draws concepts from different sessions in different colours', () => {
    const { container } = render(<ConceptGraphView payload={seriesConceptGraphFixture} />);
    const fillOf = (id: string) => container.querySelector(`[data-node-id="${id}"] circle`)?.getAttribute('fill');

    // s-c-assistant is from the first session, s-c-skepticism from the second.
    expect(fillOf('s-c-assistant')).not.toBe(fillOf('s-c-skepticism'));
  });

  it('names the session in the detail card, since that is what the colour means', () => {
    const { container } = render(<ConceptGraphView payload={seriesConceptGraphFixture} />);

    fireEvent.click(container.querySelector('[data-node-id="s-c-skepticism"]')!);

    expect(within(screen.getByTestId('graph-node-detail')).getByText(/session 2/)).toBeInTheDocument();
  });

  it('leaves a single event’s graph in one colour, with no session legend', () => {
    render(<ConceptGraphView payload={conceptGraphFixture} />);

    // One session is not a series; a legend saying so would be noise.
    expect(screen.getByText('concept')).toBeInTheDocument();
    expect(screen.queryByText('session 1')).not.toBeInTheDocument();
  });

  it('still shows nothing that identifies a person', () => {
    const { container } = render(<ConceptGraphView payload={seriesConceptGraphFixture} />);

    fireEvent.click(container.querySelector('[data-node-id="s-c-skepticism"]')!);

    // A session is not a person: conversationId may be drawn, pseudonym and messageId may not.
    const detail = within(screen.getByTestId('graph-node-detail'));
    expect(detail.queryByText(/pseudonym|contributed by|said by/i)).not.toBeInTheDocument();
  });
});

describe('DocumentArtifactView', () => {
  it('puts the body through the markdown pipeline', () => {
    // react-markdown is stubbed in jest.setup.ts, so this asserts the body reaches it inside
    // the markdown-styled container rather than asserting on parsed markup.
    const { container } = render(<DocumentArtifactView payload={{ body: '# Shared priorities' }} />);

    expect(container.querySelector('.markdown-content')).toHaveTextContent('# Shared priorities');
  });

  it('says so when the document has no body yet', () => {
    render(<DocumentArtifactView payload={{ body: '   ' }} />);

    expect(screen.getByText(/empty so far/i)).toBeInTheDocument();
  });
});

describe('ArtifactList', () => {
  const artifacts = [
    {
      id: 'a1',
      type: 'ConceptGraphArtifact',
      scope: 'conversation',
      topic: 't1',
      title: 'Concepts and contributions',
      currentVersionNumber: 3,
      locked: false,
    },
    {
      id: 'a2',
      type: 'DocumentArtifact',
      scope: 'conversation',
      topic: 't1',
      title: 'Shared priorities',
      currentVersionNumber: 1,
      locked: false,
    },
  ] as Artifact[];

  it('lists each artifact with its current version', () => {
    render(<ArtifactList artifacts={artifacts} selectedId="a1" onSelect={jest.fn()} />);

    expect(screen.getByText('Concepts and contributions')).toBeInTheDocument();
    expect(screen.getByText('v3')).toBeInTheDocument();
    expect(screen.getByText('v1')).toBeInTheDocument();
  });

  it('reports which artifact was chosen', async () => {
    const onSelect = jest.fn();
    render(<ArtifactList artifacts={artifacts} selectedId="a1" onSelect={onSelect} />);

    await userEvent.click(screen.getByText('Shared priorities'));

    expect(onSelect).toHaveBeenCalledWith('a2');
  });

  it('marks an artifact that changed during this visit', () => {
    render(<ArtifactList artifacts={artifacts} selectedId="a1" liveArtifactIds={new Set(['a2'])} onSelect={jest.fn()} />);

    expect(screen.getByLabelText('updated during this visit')).toBeInTheDocument();
  });

  it('says when a conversation has published nothing', () => {
    render(<ArtifactList artifacts={[]} onSelect={jest.fn()} />);

    expect(screen.getByText('No artifacts yet.')).toBeInTheDocument();
  });
});

describe('ArtifactPasscodePrompt', () => {
  it('asks for a passcode without claiming anything about whether the artifact exists', () => {
    render(<ArtifactPasscodePrompt onSubmit={jest.fn()} />);

    expect(screen.getByRole('heading', { name: /needs a passcode/i })).toBeInTheDocument();
    expect(screen.queryByText(/not found|does not exist|no such/i)).not.toBeInTheDocument();
  });

  it('submits the passcode it was given, trimmed', async () => {
    const onSubmit = jest.fn();
    render(<ArtifactPasscodePrompt onSubmit={onSubmit} />);

    await userEvent.type(screen.getByLabelText('Artifact passcode'), '  Xk3fA9dQ  ');
    await userEvent.click(screen.getByRole('button', { name: 'Open' }));

    expect(onSubmit).toHaveBeenCalledWith('Xk3fA9dQ');
  });

  it('says so when a passcode came back refused', () => {
    render(<ArtifactPasscodePrompt onSubmit={jest.fn()} rejected />);

    expect(screen.getByText('That passcode was not accepted.')).toBeInTheDocument();
  });
});

describe('GenerateGraphButton', () => {
  const mockGenerate = generateConceptGraph as jest.Mock;

  beforeEach(() => jest.clearAllMocks());

  it('names the action for a conversation that has no graph yet', () => {
    render(<GenerateGraphButton container={{ conversationId: 'conv-1' }} onGenerated={jest.fn()} />);

    expect(screen.getByRole('button', { name: /generate concept graph/i })).toBeInTheDocument();
  });

  it('calls the action a series graph when pointed at a topic', () => {
    render(<GenerateGraphButton container={{ topicId: 'topic-1' }} onGenerated={jest.fn()} />);

    expect(screen.getByRole('button', { name: /generate series graph/i })).toBeInTheDocument();
  });

  it('offers a re-run once a graph exists, since re-running appends rather than overwrites', () => {
    render(<GenerateGraphButton container={{ conversationId: 'conv-1' }} hasExistingGraph onGenerated={jest.fn()} />);

    expect(screen.getByRole('button', { name: /regenerate concept graph/i })).toBeInTheDocument();
  });

  it('reports the version it wrote and what the safety passes removed', async () => {
    mockGenerate.mockResolvedValue({
      generated: true,
      artifact: { id: 'a1' },
      version: { versionNumber: 4 },
      report: { droppedStatements: 2, mergedConcepts: 1 },
    });
    const onGenerated = jest.fn();
    render(<GenerateGraphButton container={{ conversationId: 'conv-1' }} onGenerated={onGenerated} />);

    await userEvent.click(screen.getByRole('button', { name: /generate concept graph/i }));

    expect(await screen.findByText(/Wrote version 4/)).toBeInTheDocument();
    expect(screen.getByText(/1 concept\(s\) merged, 2 statement\(s\) removed/)).toBeInTheDocument();
    expect(onGenerated).toHaveBeenCalled();
  });

  it('shows a run that mapped nothing as a result, not a failure', async () => {
    mockGenerate.mockResolvedValue({ generated: false, reason: 'Not enough of the event record to map' });
    const onGenerated = jest.fn();
    render(<GenerateGraphButton container={{ conversationId: 'conv-1' }} onGenerated={onGenerated} />);

    await userEvent.click(screen.getByRole('button', { name: /generate concept graph/i }));

    expect(await screen.findByText(/Not enough of the event record to map/)).toBeInTheDocument();
    expect(onGenerated).not.toHaveBeenCalled();
  });

  it('surfaces a refusal', async () => {
    mockGenerate.mockRejectedValue(new Error('Forbidden'));
    render(<GenerateGraphButton container={{ conversationId: 'conv-1' }} onGenerated={jest.fn()} />);

    await userEvent.click(screen.getByRole('button', { name: /generate concept graph/i }));

    expect(await screen.findByText('Forbidden')).toBeInTheDocument();
  });
});
