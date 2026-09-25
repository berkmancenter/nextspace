const mockUseArtifacts = jest.fn();

jest.mock('../../hooks/useArtifacts', () => ({
  useArtifacts: (params: unknown) => mockUseArtifacts(params),
}));

jest.mock('../../utils', () => ({
  generateConceptGraph: jest.fn(),
  fetchArtifactPasscode: jest.fn(),
}));

/* The graph renderer is not what these tests are about, and it drags d3 and a running
   simulation in with it. */
jest.mock('../../components/artifacts/ArtifactView', () => ({
  ArtifactView: ({ artifact }: { artifact: { title: string } }) => <div>Viewing {artifact.title}</div>,
}));

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ArtifactsBrowser } from '../../components/artifacts/ArtifactsBrowser';
import { fetchArtifactPasscode } from '../../utils';
import { Artifact } from '../../types.internal';

const mockFetchPasscode = fetchArtifactPasscode as jest.Mock;

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
  // A topic gets its own socket room now (see hooks/useArtifacts.ts's topic-room join
  // effect), the same as a conversation, so neither container offers a manual refresh
  // button — useArtifacts is what decides whether a socket is passed at all.
  it('offers no manual refresh, on a topic or a conversation alike', () => {
    const { rerender } = render(<ArtifactsBrowser {...props} container={{ topicId: 'topic-1' }} />);
    expect(screen.queryByRole('button', { name: /refresh/i })).not.toBeInTheDocument();

    rerender(<ArtifactsBrowser {...props} container={{ conversationId: 'conv-1' }} />);
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

  it('still offers to generate a series graph when the topic list holds only event graphs', () => {
    // An admin's topic listing includes the graphs of the topic's conversations. Those are
    // not the series graph, so their presence must not turn the action into a regenerate.
    const eventGraph = { ...artifacts[0], id: 'a-event', scope: 'conversation', conversation: 'conv-1' } as Artifact;
    mockUseArtifacts.mockReturnValue(state({ artifacts: [eventGraph] }));
    render(<ArtifactsBrowser {...props} authType="admin" container={{ topicId: 'topic-1' }} />);

    expect(screen.getByRole('button', { name: /generate series graph/i })).toBeInTheDocument();
  });
});

describe('the share link', () => {
  beforeEach(() => mockFetchPasscode.mockResolvedValue('Xk3fA9dQ'));

  it('lets an admin build a link that carries the artifact passcode', async () => {
    // Only an admin can read the passcode (GET /artifacts/passcode), so only an admin can
    // mint the link; the link is what a reader opens, and the passcode rides in it.
    render(<ArtifactsBrowser {...props} authType="admin" container={{ conversationId: 'conv-1' }} />);

    await userEvent.click(screen.getByRole('button', { name: /copy share link/i }));

    expect(mockFetchPasscode).toHaveBeenCalledWith({ conversationId: 'conv-1' });
    const link = (await screen.findByLabelText('Share link')) as HTMLInputElement;
    expect(link.value).toContain('artifactPasscode=Xk3fA9dQ');
    expect(link.value).toContain('artifact=a1');
  });

  it('is not offered to a reader holding only a passcode', () => {
    render(<ArtifactsBrowser {...props} container={{ conversationId: 'conv-1' }} artifactPasscode="Xk3fA9dQ" />);

    expect(screen.queryByRole('button', { name: /copy share link/i })).not.toBeInTheDocument();
  });

  it('leaves an event artifact out of a topic link, since a topic reader cannot see it', async () => {
    // An admin's topic list holds the conversations' artifacts too, but a reader on the
    // topic passcode is listed only the topic-scoped ones; a link naming one they cannot
    // see would silently open something else.
    const eventGraph = { ...artifacts[0], id: 'a-event', scope: 'conversation', conversation: 'conv-1' } as Artifact;
    mockUseArtifacts.mockReturnValue(state({ artifacts: [eventGraph] }));
    render(<ArtifactsBrowser {...props} authType="admin" container={{ topicId: 'topic-1' }} selectedArtifactId="a-event" />);

    await userEvent.click(screen.getByRole('button', { name: /copy share link/i }));

    const link = (await screen.findByLabelText('Share link')) as HTMLInputElement;
    expect(link.value).toContain('artifactPasscode=Xk3fA9dQ');
    expect(link.value).not.toContain('artifact=');
  });

  it('follows the selection once built, and drops the copied claim', async () => {
    const second = { ...artifacts[0], id: 'a2', title: 'Second' } as Artifact;
    mockUseArtifacts.mockReturnValue(state({ artifacts: [artifacts[0], second] }));
    const { rerender } = render(
      <ArtifactsBrowser {...props} authType="admin" container={{ conversationId: 'conv-1' }} selectedArtifactId="a1" />,
    );
    await userEvent.click(screen.getByRole('button', { name: /copy share link/i }));
    expect(((await screen.findByLabelText('Share link')) as HTMLInputElement).value).toContain('artifact=a1');

    rerender(
      <ArtifactsBrowser {...props} authType="admin" container={{ conversationId: 'conv-1' }} selectedArtifactId="a2" />,
    );

    expect((screen.getByLabelText('Share link') as HTMLInputElement).value).toContain('artifact=a2');
    expect(screen.queryByText(/^Copied/)).not.toBeInTheDocument();
  });

  it('says when the passcode could not be read', async () => {
    mockFetchPasscode.mockRejectedValue(new Error('Forbidden'));
    render(<ArtifactsBrowser {...props} authType="admin" container={{ topicId: 'topic-1' }} />);

    await userEvent.click(screen.getByRole('button', { name: /copy share link/i }));

    expect(await screen.findByText('Forbidden')).toBeInTheDocument();
    expect(screen.queryByLabelText('Share link')).not.toBeInTheDocument();
  });
});
