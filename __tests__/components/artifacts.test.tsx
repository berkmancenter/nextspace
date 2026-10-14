jest.mock('../../utils', () => ({
  generateConceptGraph: jest.fn(),
}));

jest.mock('../../utils/analytics', () => ({
  trackEvent: jest.fn(),
}));

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { generateConceptGraph } from '../../utils';
import { trackEvent } from '../../utils/analytics';
import { GenerateGraphButton } from '../../components/artifacts/GenerateGraphButton';
import { ArtifactList } from '../../components/artifacts/ArtifactList';
import { ArtifactPasscodePrompt } from '../../components/artifacts/ArtifactPasscodePrompt';
import { DocumentArtifactView } from '../../components/artifacts/DocumentArtifactView';
import { GraphFeedback } from '../../components/artifacts/GraphFeedback';
import { Artifact } from '../../types.internal';

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

describe('GraphFeedback', () => {
  beforeEach(() => jest.clearAllMocks());

  it('tracks a rating through the same analytics pipeline the canvas itself uses', async () => {
    render(<GraphFeedback />);

    await userEvent.click(screen.getByRole('radio', { name: 'OK' }));

    expect(trackEvent).toHaveBeenCalledWith('graph', 'feedback_rating', 'OK');
    expect(screen.getByText('Thanks!')).toBeInTheDocument();
  });

  it('accepts only one rating', async () => {
    render(<GraphFeedback />);

    await userEvent.click(screen.getByRole('radio', { name: 'OK' }));

    expect(screen.getByRole('radio', { name: 'WOW!' })).toBeDisabled();
    expect(trackEvent).toHaveBeenCalledTimes(1);
  });

  it('keeps the chosen rating visibly selected once the buttons are disabled', async () => {
    render(<GraphFeedback />);

    await userEvent.click(screen.getByRole('radio', { name: 'OK' }));

    expect(screen.getByRole('radio', { name: 'OK' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: 'OK' })).toHaveClass('MuiButton-contained');
    expect(screen.getByRole('radio', { name: 'Meh' })).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByRole('radio', { name: 'Meh' })).toHaveClass('MuiButton-outlined');
  });

  it('tracks optional free text as its own event, separate from the rating', async () => {
    render(<GraphFeedback />);

    await userEvent.click(screen.getByRole('radio', { name: 'Meh' }));
    await userEvent.type(screen.getByLabelText('Additional feedback'), 'The legend took a while to make sense of.');
    await userEvent.click(screen.getByRole('button', { name: 'Send' }));

    expect(trackEvent).toHaveBeenCalledWith('graph', 'feedback_rating', 'Meh');
    expect(trackEvent).toHaveBeenCalledWith('graph', 'feedback_text', 'The legend took a while to make sense of.');
    expect(screen.getByText('Noted.')).toBeInTheDocument();
  });

  it('has nothing to send before a rating is picked', () => {
    render(<GraphFeedback />);

    expect(screen.queryByLabelText('Additional feedback')).not.toBeInTheDocument();
  });
});
