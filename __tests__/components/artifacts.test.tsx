jest.mock('../../utils', () => ({
  generateConceptGraph: jest.fn(),
}));

jest.mock('../../utils/analytics', () => ({
  trackEvent: jest.fn(),
  trackConversationEvent: jest.fn(),
  deleteCustomDimension: jest.fn(),
}));

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { generateConceptGraph } from '../../utils';
import { trackConversationEvent, trackEvent } from '../../utils/analytics';
import { ArtifactView } from '../../components/artifacts/ArtifactView';
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
    render(
      <GenerateGraphButton
        container={{ conversationId: 'conv-1' }}
        artifact={{ id: 'a1', generationStatus: 'ready', currentVersionNumber: 3 } as Artifact}
        onGenerated={jest.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: /regenerate concept graph/i })).toBeInTheDocument();
  });

  it('disables the button and shows a pending state whenever the artifact is generating, whoever triggered it', () => {
    render(
      <GenerateGraphButton
        container={{ conversationId: 'conv-1' }}
        artifact={{ id: 'a1', generationStatus: 'pending', currentVersionNumber: 0 } as Artifact}
        onGenerated={jest.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: /reading the event/i })).toBeDisabled();
  });

  it('reports the version once the claimed artifact turns ready', async () => {
    mockGenerate.mockResolvedValue({
      generated: true,
      artifact: { id: 'a1', generationStatus: 'pending', currentVersionNumber: 0 },
      status: 'pending',
    });
    const onGenerated = jest.fn();
    const { rerender } = render(<GenerateGraphButton container={{ conversationId: 'conv-1' }} onGenerated={onGenerated} />);

    await userEvent.click(screen.getByRole('button', { name: /generate concept graph/i }));
    expect(onGenerated).toHaveBeenCalled();

    // The parent re-renders with the live, socket-updated artifact once the claim lands...
    rerender(
      <GenerateGraphButton
        container={{ conversationId: 'conv-1' }}
        artifact={{ id: 'a1', generationStatus: 'pending', currentVersionNumber: 0 } as Artifact}
        onGenerated={onGenerated}
      />,
    );
    expect(screen.getByRole('button', { name: /reading the event/i })).toBeDisabled();

    // ...and again once the background job actually finishes.
    rerender(
      <GenerateGraphButton
        container={{ conversationId: 'conv-1' }}
        artifact={{ id: 'a1', generationStatus: 'ready', currentVersionNumber: 4 } as Artifact}
        onGenerated={onGenerated}
      />,
    );

    expect(await screen.findByText(/Wrote version 4/)).toBeInTheDocument();
  });

  it('reports a run that mapped nothing, once the claimed artifact turns failed', async () => {
    mockGenerate.mockResolvedValue({
      generated: true,
      artifact: { id: 'a1', generationStatus: 'pending', currentVersionNumber: 0 },
      status: 'pending',
    });
    const onGenerated = jest.fn();
    const { rerender } = render(<GenerateGraphButton container={{ conversationId: 'conv-1' }} onGenerated={onGenerated} />);

    await userEvent.click(screen.getByRole('button', { name: /generate concept graph/i }));

    rerender(
      <GenerateGraphButton
        container={{ conversationId: 'conv-1' }}
        artifact={{ id: 'a1', generationStatus: 'pending', currentVersionNumber: 0 } as Artifact}
        onGenerated={onGenerated}
      />,
    );

    rerender(
      <GenerateGraphButton
        container={{ conversationId: 'conv-1' }}
        artifact={
          {
            id: 'a1',
            generationStatus: 'failed',
            generationError: 'Not enough of the event record to map',
            currentVersionNumber: 0,
          } as Artifact
        }
        onGenerated={onGenerated}
      />,
    );

    expect(await screen.findByText(/Not enough of the event record to map/)).toBeInTheDocument();
  });

  it('reports a failure when the prop jumps ready to failed without ever showing pending', async () => {
    mockGenerate.mockResolvedValue({
      generated: true,
      artifact: { id: 'a1', generationStatus: 'pending', currentVersionNumber: 2 },
      status: 'pending',
    });
    const onGenerated = jest.fn();
    const ready = { id: 'a1', generationStatus: 'ready', currentVersionNumber: 2 } as Artifact;
    const { rerender } = render(
      <GenerateGraphButton container={{ conversationId: 'conv-1' }} artifact={ready} onGenerated={onGenerated} />,
    );

    await userEvent.click(screen.getByRole('button', { name: /regenerate concept graph/i }));

    rerender(
      <GenerateGraphButton
        container={{ conversationId: 'conv-1' }}
        artifact={{ ...ready, generationStatus: 'failed', generationError: 'Too short' } as Artifact}
        onGenerated={onGenerated}
      />,
    );

    expect(await screen.findByText(/Too short/)).toBeInTheDocument();
  });

  it('does not show a completion banner to a visitor who did not trigger this run', () => {
    render(
      <GenerateGraphButton
        container={{ conversationId: 'conv-1' }}
        artifact={{ id: 'a1', generationStatus: 'ready', currentVersionNumber: 4 } as Artifact}
        onGenerated={jest.fn()}
      />,
    );

    expect(screen.queryByText(/Wrote version/)).not.toBeInTheDocument();
  });

  it('tracks the click and the outcome, attributed to the conversation', async () => {
    mockGenerate.mockResolvedValue({ generated: true, version: { versionNumber: 2 } });
    render(<GenerateGraphButton container={{ conversationId: 'conv-1' }} hasExistingGraph onGenerated={jest.fn()} />);

    await userEvent.click(screen.getByRole('button', { name: /regenerate concept graph/i }));

    await screen.findByText(/Wrote version 2/);
    expect(trackConversationEvent).toHaveBeenCalledWith('conv-1', 'artifact', 'generate_graph', 'regenerate', undefined);
    expect(trackConversationEvent).toHaveBeenCalledWith(
      'conv-1',
      'artifact',
      'generate_graph_result',
      'generated',
      undefined,
    );
  });

  it('tracks a run that wrote nothing, and a refusal, as different outcomes', async () => {
    mockGenerate.mockResolvedValueOnce({ generated: false });
    render(<GenerateGraphButton container={{ conversationId: 'conv-1' }} onGenerated={jest.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: /generate concept graph/i }));
    await screen.findByText(/Nothing was written/);
    expect(trackConversationEvent).toHaveBeenCalledWith('conv-1', 'artifact', 'generate_graph', 'generate', undefined);
    expect(trackConversationEvent).toHaveBeenCalledWith(
      'conv-1',
      'artifact',
      'generate_graph_result',
      'nothing_written',
      undefined,
    );

    mockGenerate.mockRejectedValueOnce(new Error('Forbidden'));
    await userEvent.click(screen.getByRole('button', { name: /generate concept graph/i }));
    await screen.findByText('Forbidden');
    expect(trackConversationEvent).toHaveBeenCalledWith('conv-1', 'artifact', 'generate_graph_result', 'error', undefined);
  });

  it('tracks without attribution for a series, which has no single conversation', async () => {
    mockGenerate.mockResolvedValue({ generated: false });
    render(<GenerateGraphButton container={{ topicId: 'topic-1' }} onGenerated={jest.fn()} />);

    await userEvent.click(screen.getByRole('button', { name: /generate series graph/i }));

    await screen.findByText(/Nothing was written/);
    expect(trackEvent).toHaveBeenCalledWith('artifact', 'generate_graph', 'generate', undefined);
    expect(trackConversationEvent).not.toHaveBeenCalled();
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

    expect(trackEvent).toHaveBeenCalledWith('graph', 'feedback_rating', 'OK', undefined);
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

    expect(trackEvent).toHaveBeenCalledWith('graph', 'feedback_rating', 'Meh', undefined);
    expect(trackEvent).toHaveBeenCalledWith(
      'graph',
      'feedback_text',
      'submitted',
      'The legend took a while to make sense of.'.length,
    );
    expect(screen.getByText('Noted.')).toBeInTheDocument();
  });

  it('never sends what the reader typed, only that text was submitted and how long it was', async () => {
    render(<GraphFeedback conversationId="conv-1" />);
    const typed = 'Call me on 555-0100 about this';

    await userEvent.click(screen.getByRole('radio', { name: 'Meh' }));
    await userEvent.type(screen.getByLabelText('Additional feedback'), `  ${typed}  `);
    await userEvent.click(screen.getByRole('button', { name: 'Send' }));

    expect(
      JSON.stringify([(trackConversationEvent as jest.Mock).mock.calls, (trackEvent as jest.Mock).mock.calls]),
    ).not.toContain('555');
    expect(trackConversationEvent).toHaveBeenCalledWith('conv-1', 'graph', 'feedback_text', 'submitted', typed.length);
  });

  it('attributes the rating to the conversation when there is one', async () => {
    render(<GraphFeedback conversationId="conv-1" />);

    await userEvent.click(screen.getByRole('radio', { name: 'WOW!' }));

    expect(trackConversationEvent).toHaveBeenCalledWith('conv-1', 'graph', 'feedback_rating', 'WOW!', undefined);
    expect(trackEvent).not.toHaveBeenCalled();
  });

  it('has nothing to send before a rating is picked', () => {
    render(<GraphFeedback />);

    expect(screen.queryByLabelText('Additional feedback')).not.toBeInTheDocument();
  });
});

describe('ArtifactView failed generation', () => {
  const failed = {
    id: 'a1',
    type: 'ConceptGraphArtifact',
    title: 'Graph',
    generationStatus: 'failed',
    generationError: 'ECONNRESET at llm.internal:443',
    currentVersionNumber: 0,
  } as unknown as Artifact;

  it('shows the raw error detail to an admin', () => {
    render(<ArtifactView artifact={failed} authType="admin" />);
    expect(screen.getByText(/ECONNRESET/)).toBeInTheDocument();
  });

  it('shows only a fixed message to a passcode reader', () => {
    render(<ArtifactView artifact={failed} authType="guest" />);
    expect(screen.queryByText(/ECONNRESET/)).not.toBeInTheDocument();
    expect(screen.getByText('Generation failed to produce a version.')).toBeInTheDocument();
  });
});
