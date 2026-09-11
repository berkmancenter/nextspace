const mockUseArtifacts = jest.fn();

jest.mock('../../hooks/useArtifacts', () => ({
  useArtifacts: (params: unknown) => mockUseArtifacts(params),
}));

jest.mock('../../utils', () => ({
  generateConceptGraph: jest.fn(),
}));

/* The graph renderer is not what these tests are about, and it drags d3 and a running
   simulation in with it. */
jest.mock('../../components/artifacts/ArtifactView', () => ({
  ArtifactView: ({ artifact }: { artifact: { title: string } }) => <div>Viewing {artifact.title}</div>,
}));

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ArtifactsBrowser } from '../../components/artifacts/ArtifactsBrowser';
import { Artifact } from '../../types.internal';

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
] as Artifact[];

const state = (overrides: Record<string, unknown> = {}) => ({
  artifacts,
  loading: false,
  error: null,
  needsPasscode: false,
  liveArtifactIds: new Set<string>(),
  reload: jest.fn(),
  ...overrides,
});

const props = {
  authType: 'guest' as const,
  onSelectArtifact: jest.fn(),
  onPasscodeSubmit: jest.fn(),
  emptyMessage: 'Nothing published yet.',
};

beforeEach(() => {
  jest.clearAllMocks();
  mockUseArtifacts.mockReturnValue(state());
});

describe('reading a container', () => {
  it('passes the container and passcode through to the read', () => {
    render(<ArtifactsBrowser {...props} container={{ topicId: 'topic-1' }} artifactPasscode="Xk3fA9dQ" />);

    expect(mockUseArtifacts).toHaveBeenCalledWith(
      expect.objectContaining({ container: { topicId: 'topic-1' }, artifactPasscode: 'Xk3fA9dQ' }),
    );
  });

  it('opens the first artifact when the route names none', () => {
    render(<ArtifactsBrowser {...props} container={{ conversationId: 'conv-1' }} />);

    expect(screen.getByText('Viewing Concepts and contributions')).toBeInTheDocument();
  });

  it('asks for a passcode instead of the list when the read was refused', () => {
    mockUseArtifacts.mockReturnValue(state({ needsPasscode: true, artifacts: [] }));
    render(<ArtifactsBrowser {...props} container={{ conversationId: 'conv-1' }} />);

    expect(screen.getByRole('heading', { name: /needs a passcode/i })).toBeInTheDocument();
  });

  it('says so when the container has published nothing', () => {
    mockUseArtifacts.mockReturnValue(state({ artifacts: [] }));
    render(<ArtifactsBrowser {...props} container={{ topicId: 'topic-1' }} />);

    expect(screen.getByText('Nothing published yet.')).toBeInTheDocument();
  });
});

describe('a series versus one event', () => {
  it('offers a refresh on a topic, which has no socket room to hear from', async () => {
    const reload = jest.fn();
    mockUseArtifacts.mockReturnValue(state({ reload }));
    render(<ArtifactsBrowser {...props} container={{ topicId: 'topic-1' }} />);

    await userEvent.click(screen.getByRole('button', { name: /refresh/i }));

    expect(reload).toHaveBeenCalled();
  });

  it('offers no refresh on a conversation, whose revisions arrive on their own', () => {
    render(<ArtifactsBrowser {...props} container={{ conversationId: 'conv-1' }} />);

    expect(screen.queryByRole('button', { name: /refresh/i })).not.toBeInTheDocument();
  });
});

describe('the organizer action', () => {
  it('is offered to an admin', () => {
    render(<ArtifactsBrowser {...props} authType="admin" container={{ conversationId: 'conv-1' }} />);

    expect(screen.getByRole('button', { name: /regenerate concept graph/i })).toBeInTheDocument();
  });

  it('is not offered to a reader holding only a passcode', () => {
    render(<ArtifactsBrowser {...props} container={{ conversationId: 'conv-1' }} artifactPasscode="Xk3fA9dQ" />);

    expect(screen.queryByRole('button', { name: /concept graph/i })).not.toBeInTheDocument();
  });

  it('asks for a series graph when the container is a topic', () => {
    mockUseArtifacts.mockReturnValue(state({ artifacts: [] }));
    render(<ArtifactsBrowser {...props} authType="admin" container={{ topicId: 'topic-1' }} />);

    expect(screen.getByRole('button', { name: /generate series graph/i })).toBeInTheDocument();
  });
});
