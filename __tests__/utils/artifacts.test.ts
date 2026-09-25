jest.mock('../../utils/Api', () => ({
  RetrieveData: jest.fn(),
}));

jest.mock('../../utils/Helpers', () => ({
  Api: { get: () => ({ getAccessToken: () => 'test-token' }) },
  SendData: jest.fn(),
}));

import { RetrieveData } from '../../utils/Api';
import { SendData } from '../../utils/Helpers';
import {
  ArtifactRequestError,
  fetchArtifact,
  fetchArtifactPasscode,
  fetchArtifactVersion,
  generateConceptGraph,
  listArtifactVersions,
  listArtifacts,
} from '../../utils/artifacts';

const mockRetrieveData = RetrieveData as jest.Mock;
const mockSendData = SendData as jest.Mock;

/** The url each function was called with, which is where the passcode has to end up. */
const calledUrl = () => mockRetrieveData.mock.calls[0][0] as string;

beforeEach(() => {
  jest.clearAllMocks();
  mockRetrieveData.mockResolvedValue([]);
});

describe('listArtifacts', () => {
  it('asks for one container and passes the bearer token through', async () => {
    await listArtifacts({ conversationId: 'conv-1' });

    expect(calledUrl()).toBe('artifacts?conversationId=conv-1');
    expect(mockRetrieveData.mock.calls[0][1]).toBe('test-token');
  });

  it('sends the passcode as artifactPasscode, url-encoded', async () => {
    await listArtifacts({ conversationId: 'conv-1' }, 'a b+c/d');

    expect(calledUrl()).toBe('artifacts?conversationId=conv-1&artifactPasscode=a+b%2Bc%2Fd');
  });

  it('reads a topic container', async () => {
    await listArtifacts({ topicId: 'topic-1' }, 'Xk3fA9dQ');

    expect(calledUrl()).toBe('artifacts?topicId=topic-1&artifactPasscode=Xk3fA9dQ');
  });

  it('returns the artifacts', async () => {
    const artifacts = [{ id: 'a1', title: 'Shared priorities' }];
    mockRetrieveData.mockResolvedValue(artifacts);

    await expect(listArtifacts({ conversationId: 'conv-1' })).resolves.toBe(artifacts);
  });
});

describe('error handling', () => {
  it('marks a 403 as needing a passcode', async () => {
    mockRetrieveData.mockResolvedValue({ error: true, status: 403, message: { code: 403, message: 'Forbidden' } });

    await expect(listArtifacts({ conversationId: 'conv-1' })).rejects.toMatchObject({
      status: 403,
      needsPasscode: true,
      message: 'Forbidden',
    });
  });

  it('does not treat other failures as a passcode problem', async () => {
    mockRetrieveData.mockResolvedValue({ error: true, status: 500, message: { code: 500, message: 'Boom' } });

    await expect(listArtifacts({ conversationId: 'conv-1' })).rejects.toMatchObject({
      status: 500,
      needsPasscode: false,
    });
  });

  it('throws an ArtifactRequestError when the request never returned', async () => {
    // RetrieveData swallows network errors and resolves undefined.
    mockRetrieveData.mockResolvedValue(undefined);

    await expect(listArtifacts({ conversationId: 'conv-1' })).rejects.toBeInstanceOf(ArtifactRequestError);
  });
});

describe('fetchArtifact', () => {
  it('reads one artifact at its latest version', async () => {
    mockRetrieveData.mockResolvedValue({ id: 'a1' });
    await fetchArtifact('a1', 'Xk3fA9dQ');

    expect(calledUrl()).toBe('artifacts/a1?artifactPasscode=Xk3fA9dQ');
  });

  it('sends no query at all when there is no passcode', async () => {
    mockRetrieveData.mockResolvedValue({ id: 'a1' });
    await fetchArtifact('a1');

    expect(calledUrl()).toBe('artifacts/a1');
  });
});

describe('version reads', () => {
  it('paginates the history', async () => {
    mockRetrieveData.mockResolvedValue({ results: [], page: 2, limit: 5, totalPages: 3, totalResults: 12 });
    await listArtifactVersions('a1', 'Xk3fA9dQ', { page: 2, limit: 5 });

    expect(calledUrl()).toBe('artifacts/a1/versions?page=2&limit=5&artifactPasscode=Xk3fA9dQ');
  });

  it('fetches one numbered version', async () => {
    mockRetrieveData.mockResolvedValue({ versionNumber: 2 });
    await fetchArtifactVersion('a1', 2, 'Xk3fA9dQ');

    expect(calledUrl()).toBe('artifacts/a1/versions/2?artifactPasscode=Xk3fA9dQ');
  });
});

describe('fetchArtifactPasscode', () => {
  it('unwraps the passcode, and never sends one', async () => {
    mockRetrieveData.mockResolvedValue({ artifactPasscode: 'Xk3fA9dQ' });

    await expect(fetchArtifactPasscode({ conversationId: 'conv-1' })).resolves.toBe('Xk3fA9dQ');
    expect(calledUrl()).toBe('artifacts/passcode?conversationId=conv-1');
  });
});

describe('generateConceptGraph', () => {
  it('asks for a series graph when given a topic', async () => {
    mockSendData.mockResolvedValue({
      generated: true,
      artifact: { id: 'a1', generationStatus: 'pending' },
      status: 'pending',
    });

    await generateConceptGraph({ topicId: 'topic-1' });

    // One key, not both: the endpoint takes exactly one container.
    expect(mockSendData).toHaveBeenCalledWith('artifacts/generate', { topicId: 'topic-1' }, 'test-token');
  });

  it('posts the conversation to the generate endpoint', async () => {
    mockSendData.mockResolvedValue({
      generated: true,
      artifact: { id: 'a1', generationStatus: 'pending' },
      status: 'pending',
    });

    await generateConceptGraph({ conversationId: 'conv-1' });

    expect(mockSendData).toHaveBeenCalledWith('artifacts/generate', { conversationId: 'conv-1' }, 'test-token');
  });

  it('resolves with the claimed, still-pending artifact — the real result arrives later, via poll or socket', async () => {
    mockSendData.mockResolvedValue({
      generated: true,
      artifact: { id: 'a1', generationStatus: 'pending' },
      status: 'pending',
    });

    await expect(generateConceptGraph({ conversationId: 'conv-1' })).resolves.toEqual({
      generated: true,
      artifact: { id: 'a1', generationStatus: 'pending' },
      status: 'pending',
    });
  });

  it('throws when the endpoint refuses the caller', async () => {
    mockSendData.mockResolvedValue({ error: true, status: 403, message: 'Forbidden' });

    await expect(generateConceptGraph({ conversationId: 'conv-1' })).rejects.toBeInstanceOf(ArtifactRequestError);
  });
});
