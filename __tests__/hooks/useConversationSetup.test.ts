import { renderHook, waitFor, act } from '@testing-library/react';
import type { NextRouter } from 'next/router';

// Mock the utils barrel (Api, RetrieveData, GetChannelPasscode, QueryParamsError)
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
  GetChannelPasscode: jest.fn(),
  QueryParamsError: jest.fn(),
}));

// Mock Helpers directly, since createConversationFromData/resolveConversationBotName
// are imported from '../utils/Helpers' rather than the barrel.
jest.mock('../../utils/Helpers', () => ({
  createConversationFromData: jest.fn(),
  resolveConversationBotName: jest.fn(),
}));

import { useConversationSetup } from '../../hooks/useConversationSetup';
import { RetrieveData, GetChannelPasscode, QueryParamsError } from '../../utils';
import { createConversationFromData, resolveConversationBotName } from '../../utils/Helpers';

const mockRetrieveData = RetrieveData as jest.Mock;
const mockGetChannelPasscode = GetChannelPasscode as jest.Mock;
const mockQueryParamsError = QueryParamsError as jest.Mock;
const mockCreateConversationFromData = createConversationFromData as jest.Mock;
const mockResolveConversationBotName = resolveConversationBotName as jest.Mock;

function makeRouter(overrides: Partial<NextRouter> = {}): NextRouter {
  return {
    query: { conversationId: 'test-conversation-id' },
    isReady: true,
    ...overrides,
  } as unknown as NextRouter;
}

function makeConversation(overrides: Record<string, any> = {}) {
  return {
    type: { name: 'eventAssistant' },
    features: [{ name: 'featureA', enabled: true }],
    name: 'My Event',
    properties: { feedbackFrequency: 3 },
    description: 'An event description',
    presenters: [{ name: 'Speaker One', bio: 'bio-one' }],
    moderators: [{ name: 'Mod One', bio: 'mod-bio' }],
    resources: [{ id: 'resource-1' }],
    agents: [
      { id: 'agent-1', agentType: 'eventAssistant' },
      { id: 'agent-2', agentType: 'other' },
    ],
    active: true,
    ...overrides,
  };
}

function renderSetup(routerOverrides: Partial<NextRouter> = {}) {
  const setConversationType = jest.fn();
  const setBotNameContext = jest.fn();
  const setResources = jest.fn();
  const router = makeRouter(routerOverrides);

  const view = renderHook(
    (props: { router: NextRouter }) =>
      useConversationSetup({
        socket: null,
        userId: 'user-1',
        router: props.router,
        setConversationType,
        setBotNameContext,
        setResources,
      }),
    { initialProps: { router } },
  );

  return { ...view, setConversationType, setBotNameContext, setResources, router };
}

describe('useConversationSetup', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockGetAccessToken.mockReturnValue('mock-access-token');
    mockGetConfig.mockResolvedValue({ conversationBotName: 'Berkie' });
    mockQueryParamsError.mockReturnValue(null);
    mockRetrieveData.mockResolvedValue({ id: 'raw-conversation-data' });
    mockCreateConversationFromData.mockResolvedValue(makeConversation());
    mockResolveConversationBotName.mockReturnValue('Berkie');
    mockGetChannelPasscode.mockReturnValue(null);
  });

  describe('initial / reset state', () => {
    it('returns default state before any fetch resolves', () => {
      const { result } = renderSetup();

      expect(result.current.eventName).toBe('');
      expect(result.current.botName).toBe('Berkie');
      expect(result.current.agentActive).toBe(true);
      expect(result.current.agentId).toBeNull();
      expect(result.current.eventStatus).toBe('active');
      expect(result.current.eventStatusLoaded).toBe(false);
      expect(result.current.showEventStatusDialog).toBe(false);
      expect(result.current.initialJoinComplete).toBe(false);
      expect(result.current.paramsError).toBeNull();
      expect(result.current.generalError).toBeNull();
    });

    it('exposes empty refs by default', () => {
      const { result } = renderSetup();

      expect(result.current.chatIntroRef.current).toEqual([]);
      expect(result.current.assistantIntroRef.current).toEqual([]);
      expect(result.current.hasJoinedConvRef.current).toBe(false);
    });

    it('clears conversation type and resets bot name context on mount', async () => {
      const { setConversationType, setBotNameContext } = renderSetup();

      await waitFor(() => {
        expect(setConversationType).toHaveBeenCalledWith(null);
        expect(setBotNameContext).toHaveBeenCalledWith('Berkie');
      });
    });

    it('re-clears conversation type when conversationId changes', async () => {
      const { result, setConversationType, rerender } = renderSetup();

      await waitFor(() => {
        expect(result.current.eventStatusLoaded).toBe(true);
      });

      setConversationType.mockClear();

      rerender({ router: makeRouter({ query: { conversationId: 'different-id' } }) });

      await waitFor(() => {
        expect(setConversationType).toHaveBeenCalledWith(null);
      });
    });
  });

  describe('fetch guard conditions', () => {
    it('does not fetch when there is no access token', async () => {
      mockGetAccessToken.mockReturnValue('');

      renderSetup();

      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockRetrieveData).not.toHaveBeenCalled();
    });

    it('does not fetch when the router is not ready', async () => {
      renderSetup({ isReady: false });

      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockRetrieveData).not.toHaveBeenCalled();
    });

    it('sets paramsError and skips fetching when QueryParamsError returns an error', async () => {
      mockQueryParamsError.mockReturnValue({ header: 'Missing required parameters', params: ['channel'] });

      const { result } = renderSetup();

      await waitFor(() => {
        expect(result.current.paramsError).toEqual({ header: 'Missing required parameters', params: ['channel'] });
      });

      expect(mockRetrieveData).not.toHaveBeenCalled();
    });
  });

  describe('conversation-not-found / error responses', () => {
    it('sets a Conversation Not Found paramsError when no data is returned', async () => {
      mockRetrieveData.mockResolvedValue(null);

      const { result } = renderSetup();

      await waitFor(() => {
        expect(result.current.paramsError).toEqual({ header: 'Conversation Not Found', params: [] });
      });

      expect(mockCreateConversationFromData).not.toHaveBeenCalled();
    });

    it('sets both paramsError and generalError when the error message indicates "not found"', async () => {
      mockRetrieveData.mockResolvedValue({ error: true, message: { message: 'Conversation not found' } });

      const { result } = renderSetup();

      await waitFor(() => {
        expect(result.current.paramsError).toEqual({ header: 'Conversation Not Found', params: [] });
        expect(result.current.generalError).toBe('Conversation not found');
      });
    });

    it('sets only generalError for a non-"not found" error message', async () => {
      mockRetrieveData.mockResolvedValue({ error: true, message: { message: 'Some other failure' } });

      const { result } = renderSetup();

      await waitFor(() => {
        expect(result.current.generalError).toBe('Some other failure');
      });

      expect(result.current.paramsError).toBeNull();
    });

    it('falls back to a default generalError message when none is provided', async () => {
      mockRetrieveData.mockResolvedValue({ error: true });

      const { result } = renderSetup();

      await waitFor(() => {
        expect(result.current.generalError).toBe('Error retrieving conversation.');
      });
    });
  });

  describe('successful fetch', () => {
    it('populates event details, features, and feedback frequency', async () => {
      const { result, setConversationType } = renderSetup();

      await waitFor(() => {
        expect(result.current.eventName).toBe('My Event');
      });

      expect(setConversationType).toHaveBeenCalledWith({ name: 'eventAssistant' });
      expect(result.current.conversationFeatures).toEqual([{ name: 'featureA', enabled: true }]);
      expect(result.current.feedbackFrequency).toBe(3);
      expect(result.current.eventDescription).toBe('An event description');
      expect(result.current.speakers).toEqual([{ name: 'Speaker One', bio: 'bio-one' }]);
      expect(result.current.moderators).toEqual([{ name: 'Mod One', bio: 'mod-bio' }]);
    });

    it('defaults feedbackFrequency to 1 when not provided', async () => {
      mockCreateConversationFromData.mockResolvedValue(makeConversation({ properties: {} }));

      const { result } = renderSetup();

      await waitFor(() => {
        expect(result.current.eventStatusLoaded).toBe(true);
      });

      expect(result.current.feedbackFrequency).toBe(1);
    });

    it('forwards array resources to setResources', async () => {
      const { setResources, result } = renderSetup();

      await waitFor(() => {
        expect(result.current.eventStatusLoaded).toBe(true);
      });

      expect(setResources).toHaveBeenCalledWith([{ id: 'resource-1' }]);
    });

    it('does not call setResources when resources is not an array', async () => {
      mockCreateConversationFromData.mockResolvedValue(makeConversation({ resources: undefined }));

      const { setResources, result } = renderSetup();

      await waitFor(() => {
        expect(result.current.eventStatusLoaded).toBe(true);
      });

      expect(setResources).not.toHaveBeenCalled();
    });

    it('resolves the bot name via resolveConversationBotName and applies it', async () => {
      mockResolveConversationBotName.mockReturnValue('CustomBot');

      const { result, setBotNameContext } = renderSetup();

      await waitFor(() => {
        expect(result.current.botName).toBe('CustomBot');
      });

      expect(setBotNameContext).toHaveBeenLastCalledWith('CustomBot');
    });

    it('marks eventStatusLoaded true once fetch completes', async () => {
      const { result } = renderSetup();

      await waitFor(() => {
        expect(result.current.eventStatusLoaded).toBe(true);
      });
    });
  });

  describe('agent resolution', () => {
    it('sets agentId and keeps agentActive true when an eventAssistant agent is present', async () => {
      const { result } = renderSetup();

      await waitFor(() => {
        expect(result.current.agentId).toBe('agent-1');
      });

      expect(result.current.agentActive).toBe(true);
      expect(result.current.agentIds).toEqual(['agent-1', 'agent-2']);
    });

    it('sets agentActive to false when no eventAssistant agent is present', async () => {
      mockCreateConversationFromData.mockResolvedValue(
        makeConversation({ agents: [{ id: 'agent-9', agentType: 'other' }] }),
      );

      const { result } = renderSetup();

      await waitFor(() => {
        expect(result.current.agentActive).toBe(false);
      });

      expect(result.current.agentId).toBeNull();
      expect(result.current.agentIds).toEqual(['agent-9']);
    });
  });

  describe('event status handling', () => {
    it('shows the ended dialog when the conversation is inactive and has an endTime', async () => {
      mockCreateConversationFromData.mockResolvedValue(makeConversation({ active: false, endTime: '2026-01-01' }));

      const { result } = renderSetup();

      await waitFor(() => {
        expect(result.current.eventStatus).toBe('ended');
      });

      expect(result.current.showEventStatusDialog).toBe(true);
    });

    it('shows the future dialog when the conversation is inactive and has no endTime', async () => {
      mockCreateConversationFromData.mockResolvedValue(makeConversation({ active: false }));

      const { result } = renderSetup();

      await waitFor(() => {
        expect(result.current.eventStatus).toBe('future');
      });

      expect(result.current.showEventStatusDialog).toBe(true);
    });

    it('leaves eventStatus as active when the conversation is active', async () => {
      const { result } = renderSetup();

      await waitFor(() => {
        expect(result.current.eventStatusLoaded).toBe(true);
      });

      expect(result.current.eventStatus).toBe('active');
      expect(result.current.showEventStatusDialog).toBe(false);
    });
  });

  describe('channel passcodes', () => {
    it('resolves transcript and chat passcodes when a channel query param is present', async () => {
      mockGetChannelPasscode.mockImplementation((channel: string) =>
        channel === 'transcript' ? 'transcript-pass' : 'chat-pass',
      );

      const { result } = renderSetup({ query: { conversationId: 'test-conversation-id', channel: 'transcript,chat' } });

      await waitFor(() => {
        expect(result.current.transcriptPasscode).toBe('transcript-pass');
      });

      expect(result.current.chatPasscode).toBe('chat-pass');
      expect(mockGetChannelPasscode).toHaveBeenCalledWith('transcript', expect.any(Object), expect.any(Function));
      expect(mockGetChannelPasscode).toHaveBeenCalledWith('chat', expect.any(Object), expect.any(Function));
    });

    it('does not look up passcodes when there is no channel query param', async () => {
      const { result } = renderSetup();

      await waitFor(() => {
        expect(result.current.eventStatusLoaded).toBe(true);
      });

      expect(mockGetChannelPasscode).not.toHaveBeenCalled();
      expect(result.current.transcriptPasscode).toBe('');
      expect(result.current.chatPasscode).toBe('');
    });
  });

  describe('error handling', () => {
    it('sets a generic generalError and logs when fetching throws', async () => {
      const consoleError = jest.spyOn(console, 'error').mockImplementation();
      mockRetrieveData.mockRejectedValue(new Error('network fail'));

      const { result } = renderSetup();

      await waitFor(() => {
        expect(result.current.generalError).toBe('Failed to fetch conversation data.');
      });

      expect(consoleError).toHaveBeenCalledWith('Error fetching conversation data:', expect.any(Error));

      consoleError.mockRestore();
    });
  });

  describe('exposed setters', () => {
    it('allows updating initialJoinComplete, showEventStatusDialog, and generalError', async () => {
      const { result } = renderSetup();

      await waitFor(() => {
        expect(result.current.eventStatusLoaded).toBe(true);
      });

      act(() => {
        result.current.setInitialJoinComplete(true);
      });
      expect(result.current.initialJoinComplete).toBe(true);

      act(() => {
        result.current.setShowEventStatusDialog(true);
      });
      expect(result.current.showEventStatusDialog).toBe(true);

      act(() => {
        result.current.setGeneralError('custom error');
      });
      expect(result.current.generalError).toBe('custom error');
    });
  });
});
