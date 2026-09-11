jest.mock('../../utils', () => ({
  generateConceptGraph: jest.fn(),
}));

import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { conceptGraphFixture, minimalConceptGraphFixture } from '../../content/conceptGraphFixture';
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

describe('ConceptGraphView', () => {
  it('draws concepts by label and contributions by kind', () => {
    render(<ConceptGraphView payload={graph} />);

    expect(screen.getByText('Issuer')).toBeInTheDocument();
    expect(screen.getByText('Verifier')).toBeInTheDocument();
    expect(screen.getByText('co-governs')).toBeInTheDocument();
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
  it('draws every concept in the fixture', () => {
    render(<ConceptGraphView payload={conceptGraphFixture} />);

    for (const concept of conceptGraphFixture.concepts) {
      expect(screen.getByText(concept.label)).toBeInTheDocument();
    }
  });

  it('draws the contribution that joins three concepts as one node', () => {
    render(<ConceptGraphView payload={conceptGraphFixture} />);

    // One diamond labelled co-governs, not three edges.
    expect(screen.getAllByText('co-governs')).toHaveLength(1);
  });

  it('draws an origin prompt, eliding text too long for its pill', () => {
    render(<ConceptGraphView payload={minimalConceptGraphFixture} />);

    // 'What is actually being trusted here?' is longer than a pill holds, so it elides.
    expect(screen.getByText('What is actually being trusted…')).toBeInTheDocument();
  });

  it('reads a contribution’s statement out when the node is selected', () => {
    render(<ConceptGraphView payload={conceptGraphFixture} />);
    const node = screen.getByText('co-governs').closest('g');

    fireEvent.click(node!);

    // Scoped to the card: the statement is also in the graph's screen-reader description.
    const detail = within(screen.getByTestId('graph-node-detail'));
    expect(detail.getByText(/Governance was argued to sit across all three/)).toBeInTheDocument();
    expect(detail.getByText(/joins 3/)).toBeInTheDocument();
  });

  it('shows nothing about who contributed a node, under the Chatham House Rule', () => {
    render(<ConceptGraphView payload={conceptGraphFixture} />);
    const node = screen.getByText('co-governs').closest('g');

    fireEvent.click(node!);

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
    render(<GenerateGraphButton conversationId="conv-1" onGenerated={jest.fn()} />);

    expect(screen.getByRole('button', { name: /generate concept graph/i })).toBeInTheDocument();
  });

  it('offers a re-run once a graph exists, since re-running appends rather than overwrites', () => {
    render(<GenerateGraphButton conversationId="conv-1" hasExistingGraph onGenerated={jest.fn()} />);

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
    render(<GenerateGraphButton conversationId="conv-1" onGenerated={onGenerated} />);

    await userEvent.click(screen.getByRole('button', { name: /generate concept graph/i }));

    expect(await screen.findByText(/Wrote version 4/)).toBeInTheDocument();
    expect(screen.getByText(/1 concept\(s\) merged, 2 statement\(s\) removed/)).toBeInTheDocument();
    expect(onGenerated).toHaveBeenCalled();
  });

  it('shows a run that mapped nothing as a result, not a failure', async () => {
    mockGenerate.mockResolvedValue({ generated: false, reason: 'Not enough of the event record to map' });
    const onGenerated = jest.fn();
    render(<GenerateGraphButton conversationId="conv-1" onGenerated={onGenerated} />);

    await userEvent.click(screen.getByRole('button', { name: /generate concept graph/i }));

    expect(await screen.findByText(/Not enough of the event record to map/)).toBeInTheDocument();
    expect(onGenerated).not.toHaveBeenCalled();
  });

  it('surfaces a refusal', async () => {
    mockGenerate.mockRejectedValue(new Error('Forbidden'));
    render(<GenerateGraphButton conversationId="conv-1" onGenerated={jest.fn()} />);

    await userEvent.click(screen.getByRole('button', { name: /generate concept graph/i }));

    expect(await screen.findByText('Forbidden')).toBeInTheDocument();
  });
});
