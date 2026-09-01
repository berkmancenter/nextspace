import { renderHook, waitFor } from '@testing-library/react';
import type { NextRouter } from 'next/router';

const mockGetAccessToken = jest.fn();
const mockGetConfig = jest.fn();

jest.mock('../../utils', () => ({
  Api: {
    get: jest.fn(() => ({
      getAccessToken: mockGetAccessToken,
      GetConfig: mockGetConfig,
    })),
  },
  RetrieveData: jest.fn(),
}));

jest.mock('../../utils/Helpers', () => ({
  createConversationFromData: jest.fn(),
  resolveConversationBotName: jest.fn(),
}));

import { useRoomSetup } from '../../hooks/useRoomSetup';
import { RetrieveData } from '../../utils';
import { createConversationFromData, resolveConversationBotName } from '../../utils/Helpers';

const mockRetrieveData = RetrieveData as jest.Mock;
const mockCreateConversationFromData = createConversationFromData as jest.Mock;
const mockResolveConversationBotName = resolveConversationBotName as jest.Mock;

function makeRouter(overrides: Partial<NextRouter> = {}): NextRouter {
  return {
    query: { conversationId: 'test-room-id' },
    isReady: true,
    ...overrides,
  } as unknown as NextRouter;
}

function makeConversation(overrides: Record<string, any> = {}) {
  return {
    type: { name: 'communityRoom' },
    features: [{ name: 'featureA', enabled: true }],
    name: 'BKC Community Room',
    agents: [{ id: 'agent-1', agentType: 'communityAssistant' }],
    ...overrides,
  };
}

function renderSetup(routerOverrides: Partial<NextRouter> = {}) {
  const router = makeRouter(routerOverrides);
  const view = renderHook((props: { router: NextRouter }) => useRoomSetup({ router: props.router }), {
    initialProps: { router },
  });
  return { ...view, router };
}

describe('useRoomSetup', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockGetAccessToken.mockReturnValue('mock-access-token');
    mockGetConfig.mockResolvedValue({ conversationBotName: 'Berkie' });
    mockRetrieveData.mockResolvedValue({ id: 'raw-room-data' });
    mockCreateConversationFromData.mockResolvedValue(makeConversation());
    mockResolveConversationBotName.mockReturnValue('Berkie');
  });

  it('returns default state before any fetch resolves', () => {
    const { result } = renderSetup();

    expect(result.current.loaded).toBe(false);
    expect(result.current.notFound).toBe(false);
    expect(result.current.generalError).toBeNull();
    expect(result.current.roomName).toBe('');
    expect(result.current.botName).toBe('Berkie');
    expect(result.current.agentId).toBeNull();
    expect(result.current.conversationFeatures).toEqual([]);
  });

  it('does not fetch until the router is ready', () => {
    renderSetup({ isReady: false });
    expect(mockRetrieveData).not.toHaveBeenCalled();
  });

  it('does not fetch without an access token', () => {
    mockGetAccessToken.mockReturnValue(null);
    renderSetup();
    expect(mockRetrieveData).not.toHaveBeenCalled();
  });

  it('fetches the conversation for the routed conversationId', async () => {
    renderSetup();
    await waitFor(() => expect(mockRetrieveData).toHaveBeenCalledWith('conversations/test-room-id', 'mock-access-token'));
  });

  it('resolves room name, bot name, agent id, and features from the conversation', async () => {
    const { result } = renderSetup();

    await waitFor(() => expect(result.current.loaded).toBe(true));

    expect(result.current.roomName).toBe('BKC Community Room');
    expect(result.current.botName).toBe('Berkie');
    expect(result.current.agentId).toBe('agent-1');
    expect(result.current.conversationFeatures).toEqual([{ name: 'featureA', enabled: true }]);
  });

  it('resolves the agent from conversation.agents without assuming a hardcoded agentType', async () => {
    mockCreateConversationFromData.mockResolvedValue(
      makeConversation({ agents: [{ id: 'agent-9', agentType: 'someOtherAgentTypeName' }] }),
    );
    const { result } = renderSetup();

    await waitFor(() => expect(result.current.loaded).toBe(true));

    expect(result.current.agentId).toBe('agent-9');
  });

  it('sets notFound when the conversation does not exist', async () => {
    mockRetrieveData.mockResolvedValue({
      error: true,
      status: 404,
      message: { message: 'Conversation not found' },
    });
    const { result } = renderSetup();

    await waitFor(() => expect(result.current.notFound).toBe(true));
    expect(result.current.loaded).toBe(false);
  });

  it('sets a general error for a non-404 fetch error', async () => {
    mockRetrieveData.mockResolvedValue({
      error: true,
      status: 500,
      message: { message: 'Server exploded' },
    });
    const { result } = renderSetup();

    await waitFor(() => expect(result.current.generalError).toBe('Server exploded'));
    expect(result.current.notFound).toBe(false);
  });

  it('sets notFound when RetrieveData returns nothing', async () => {
    mockRetrieveData.mockResolvedValue(undefined);
    const { result } = renderSetup();

    await waitFor(() => expect(result.current.notFound).toBe(true));
  });

  it('refetches when conversationId changes', async () => {
    const { result, rerender, router } = renderSetup();

    await waitFor(() => expect(result.current.loaded).toBe(true));

    mockRetrieveData.mockClear();
    mockCreateConversationFromData.mockResolvedValue(makeConversation({ name: 'Other Room', agents: [{ id: 'agent-2' }] }));

    rerender({ router: makeRouter({ query: { conversationId: 'other-room-id' } }) });

    await waitFor(() => expect(mockRetrieveData).toHaveBeenCalledWith('conversations/other-room-id', 'mock-access-token'));
    await waitFor(() => expect(result.current.roomName).toBe('Other Room'));
  });
});
