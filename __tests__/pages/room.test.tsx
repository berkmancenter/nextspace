import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import RoomPage from '../../pages/room/[conversationId]';

const mockRouter = {
  query: { conversationId: 'test-room-id' },
  isReady: true,
  pathname: '/room/[conversationId]',
  replace: jest.fn(),
};

jest.mock('next/router', () => ({
  useRouter: () => mockRouter,
}));

const mockSocket = {
  on: jest.fn(),
  off: jest.fn(),
  emit: jest.fn(),
  connected: true,
};

const mockUseSessionJoin = jest.fn();
jest.mock('../../hooks/useSessionJoin', () => ({
  useSessionJoin: (...args: any[]) => mockUseSessionJoin(...args),
}));

const mockUseRoomSetup = jest.fn();
jest.mock('../../hooks/useRoomSetup', () => ({
  useRoomSetup: (...args: any[]) => mockUseRoomSetup(...args),
}));

const mockSendData = jest.fn();
const mockEmitWithTokenRefresh = jest.fn((...args: any[]) => {
  const onSuccess = args[3];
  onSuccess?.();
});

const mockRetrieveData = jest.fn();

jest.mock('../../utils', () => ({
  Api: {
    get: jest.fn(() => ({
      GetTokens: jest.fn(() => ({ access: 'mock-access-token' })),
      getAccessToken: jest.fn(() => 'mock-access-token'),
    })),
  },
  RetrieveData: (...args: any[]) => mockRetrieveData(...args),
  SendData: (...args: any[]) => mockSendData(...args),
  emitWithTokenRefresh: (...args: any[]) => mockEmitWithTokenRefresh(...args),
  getPollResponseCounts: jest.fn(),
  inspectPoll: jest.fn(),
}));

jest.mock('../../components/room/CommunityGroupChatPanel', () => ({
  CommunityGroupChatPanel: ({ messages, realName, onSendMessage, onRetryPendingMessage, pendingMessages = [] }: any) => (
    <div
      data-testid="group-chat-panel"
      data-real-name={realName}
      data-pending={pendingMessages.map((m: any) => m.body).join('|')}
      data-pending-failed={pendingMessages
        .filter((m: any) => m.failed)
        .map((m: any) => m.body)
        .join('|')}
    >
      {messages.map((m: any) => (
        <div key={m.id}>{typeof m.body === 'string' ? m.body : m.body?.text}</div>
      ))}
      <button onClick={() => onSendMessage('hello room')}>Send group message</button>
      <button onClick={() => onRetryPendingMessage?.(pendingMessages.find((m: any) => m.failed)?.id)}>
        Retry group message
      </button>
    </div>
  ),
}));

jest.mock('../../components/room/CommunityAssistantPanel', () => ({
  CommunityAssistantPanel: ({ messages, onSendMessage, pendingMessages = [] }: any) => (
    <div data-testid="assistant-panel" data-pending={pendingMessages.map((m: any) => m.body).join('|')}>
      {messages.map((m: any) => (
        <div key={m.id}>{typeof m.body === 'string' ? m.body : m.body?.text}</div>
      ))}
      <button onClick={() => onSendMessage('hello Berkie')}>Send assistant message</button>
    </div>
  ),
}));

function setDefaultMocks() {
  mockUseRoomSetup.mockReturnValue({
    loaded: true,
    notFound: false,
    generalError: null,
    setGeneralError: jest.fn(),
    roomName: 'BKC Community Room',
    botName: 'Berkie',
    agentId: 'agent-1',
    conversationFeatures: [],
  });

  mockUseSessionJoin.mockReturnValue({
    socket: mockSocket,
    pseudonym: 'Priya Raghunathan',
    userId: 'user-1',
    isConnected: true,
    errorMessage: null,
    lastReconnectTime: null,
  });
}

describe('RoomPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSocket.on.mockClear();
    mockSocket.off.mockClear();
    setDefaultMocks();
    mockSendData.mockResolvedValue({ id: 'sent-message-1' });
    mockRetrieveData.mockResolvedValue([]);
  });

  it('shows a loading spinner while the room is loading', () => {
    mockUseRoomSetup.mockReturnValue({
      loaded: false,
      notFound: false,
      generalError: null,
      setGeneralError: jest.fn(),
      roomName: '',
      botName: 'Berkie',
      agentId: null,
      conversationFeatures: [],
    });
    render(<RoomPage authType="guest" />);
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('shows a not-found message for a missing room', () => {
    mockUseRoomSetup.mockReturnValue({
      loaded: false,
      notFound: true,
      generalError: null,
      setGeneralError: jest.fn(),
      roomName: '',
      botName: 'Berkie',
      agentId: null,
      conversationFeatures: [],
    });
    render(<RoomPage authType="guest" />);
    expect(screen.getByText('Room not found.')).toBeInTheDocument();
  });

  it('renders the group chat panel by default', () => {
    render(<RoomPage authType="guest" />);
    expect(screen.getByTestId('group-chat-panel')).toBeInTheDocument();
    expect(screen.queryByTestId('assistant-panel')).not.toBeInTheDocument();
  });

  it('shows the room name with no status badge in the header on the group tab', () => {
    render(<RoomPage authType="guest" />);
    expect(screen.getByText('BKC Community Room')).toBeInTheDocument();
    expect(screen.queryByText('LIVE')).not.toBeInTheDocument();
  });

  it('shows an account control carrying the signed-in member initials', () => {
    render(<RoomPage authType="guest" />);
    const account = screen.getByRole('button', { name: 'Your account, Priya Raghunathan' });
    expect(account).toBeInTheDocument();
    expect(account).toHaveTextContent('PR');
  });

  it('switches to the assistant panel when the Berkie tab is clicked', async () => {
    const user = userEvent.setup();
    render(<RoomPage authType="guest" />);
    await user.click(screen.getByRole('button', { name: 'Berkie' }));
    expect(screen.getByTestId('assistant-panel')).toBeInTheDocument();
    expect(screen.queryByTestId('group-chat-panel')).not.toBeInTheDocument();
  });

  it('shows a PRIVATE badge and the bot name in the header on the Berkie tab', async () => {
    const user = userEvent.setup();
    render(<RoomPage authType="guest" />);
    await user.click(screen.getByRole('button', { name: 'Berkie' }));
    expect(screen.getByText('PRIVATE')).toBeInTheDocument();
    expect(screen.getByText('Private to you')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Berkie' })).toBeInTheDocument();
  });

  it('passes the real name from the session down to the group chat panel', () => {
    render(<RoomPage authType="guest" />);
    expect(screen.getByTestId('group-chat-panel')).toHaveAttribute('data-real-name', 'Priya Raghunathan');
  });

  it('joins the chat channel unconditionally, with no passcode, once the socket and agent are ready', async () => {
    render(<RoomPage authType="guest" />);
    await waitFor(() => expect(mockEmitWithTokenRefresh).toHaveBeenCalled());
    const [, event, payload] = mockEmitWithTokenRefresh.mock.calls[0];
    expect(event).toBe('conversation:join');
    expect(payload.channels).toContainEqual({ name: 'chat', direct: false });
  });

  it('sends a group chat message through SendData on the chat channel', async () => {
    const user = userEvent.setup();
    render(<RoomPage authType="guest" />);
    await user.click(screen.getByText('Send group message'));
    await waitFor(() =>
      expect(mockSendData).toHaveBeenCalledWith(
        'messages',
        expect.objectContaining({ body: 'hello room', channels: [{ name: 'chat' }] }),
      ),
    );
  });

  it("sends an assistant message through SendData on the user's direct channel with the agent", async () => {
    const user = userEvent.setup();
    render(<RoomPage authType="guest" />);
    await user.click(screen.getByRole('button', { name: 'Berkie' }));
    await user.click(screen.getByText('Send assistant message'));
    await waitFor(() =>
      expect(mockSendData).toHaveBeenCalledWith(
        'messages',
        expect.objectContaining({ body: 'hello Berkie', channels: [{ name: 'direct-user-1-agent-1' }] }),
      ),
    );
  });

  it('applies the room webfont families to the page root', () => {
    const { container } = render(<RoomPage authType="guest" />);
    const root = container.firstElementChild as HTMLElement;

    expect(root.style.getPropertyValue('--room-font-display')).not.toBe('');
    expect(root.style.getPropertyValue('--room-font-body')).not.toBe('');
    expect(root.style.getPropertyValue('--room-font-mono')).not.toBe('');
  });

  it('stops fetching once history has loaded instead of refetching in a loop', async () => {
    mockRetrieveData.mockResolvedValue([
      { id: 'm1', body: 'hello room', createdAt: '2026-08-26T00:00:00.000Z', channels: ['chat'] },
    ]);

    render(<RoomPage authType="guest" />);

    await waitFor(() => expect(mockRetrieveData).toHaveBeenCalled());
    await new Promise((resolve) => setTimeout(resolve, 150));
    const callsAfterSettling = mockRetrieveData.mock.calls.length;
    await new Promise((resolve) => setTimeout(resolve, 150));

    expect(mockRetrieveData.mock.calls.length).toBe(callsAfterSettling);
  });

  describe('the app menu', () => {
    it('sits to the right of the account control', () => {
      render(<RoomPage authType="user" />);

      const account = screen.getByRole('button', { name: 'Your account, Priya Raghunathan' });
      const menu = screen.getByRole('button', { name: 'Menu' });

      expect(account.compareDocumentPosition(menu) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it('offers feedback and log out to a signed-in member', async () => {
      const user = userEvent.setup();
      render(<RoomPage authType="user" />);

      await user.click(screen.getByRole('button', { name: 'Menu' }));

      expect(screen.getByRole('link', { name: 'Give Feedback' })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Log Out' })).toBeInTheDocument();
    });

    it('names the menu panel and closes it from a labelled control', async () => {
      const user = userEvent.setup();
      render(<RoomPage authType="user" />);

      await user.click(screen.getByRole('button', { name: 'Menu' }));
      expect(screen.getByRole('dialog', { name: 'Room menu' })).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Close menu' }));

      await waitFor(() => expect(screen.queryByRole('link', { name: 'Give Feedback' })).not.toBeInTheDocument());
    });

    it('has no accessibility violations with the menu open', async () => {
      const user = userEvent.setup();
      const { container } = render(<RoomPage authType="user" />);

      await user.click(screen.getByRole('button', { name: 'Menu' }));

      expect(await axe(container)).toHaveNoViolations();
    });

    it('offers no log out to a guest', async () => {
      const user = userEvent.setup();
      render(<RoomPage authType="guest" />);

      await user.click(screen.getByRole('button', { name: 'Menu' }));

      expect(screen.getByRole('link', { name: 'Give Feedback' })).toBeInTheDocument();
      expect(screen.queryByRole('link', { name: 'Log Out' })).not.toBeInTheDocument();
    });
  });

  describe('when the server refuses a message', () => {
    beforeEach(() => {
      mockSendData.mockResolvedValue({ error: 'rejected' });
    });

    it('marks that message rather than raising a separate error banner', async () => {
      const user = userEvent.setup();
      render(<RoomPage authType="guest" />);

      await user.click(screen.getByText('Send group message'));

      await waitFor(() =>
        expect(screen.getByTestId('group-chat-panel')).toHaveAttribute('data-pending-failed', 'hello room'),
      );
      expect(screen.queryByText('Message could not be sent.')).not.toBeInTheDocument();
    });

    it('sends a refused message again when the member retries it', async () => {
      const user = userEvent.setup();
      render(<RoomPage authType="guest" />);

      await user.click(screen.getByText('Send group message'));
      await waitFor(() =>
        expect(screen.getByTestId('group-chat-panel')).toHaveAttribute('data-pending-failed', 'hello room'),
      );

      mockSendData.mockResolvedValue({ id: 'sent-message-1' });
      await user.click(screen.getByText('Retry group message'));

      await waitFor(() => expect(mockSendData).toHaveBeenCalledTimes(2));
      await waitFor(() => expect(screen.getByTestId('group-chat-panel')).toHaveAttribute('data-pending', ''));
    });

    it('does not keep retrying a message the server already refused', async () => {
      const user = userEvent.setup();
      render(<RoomPage authType="guest" />);

      await user.click(screen.getByText('Send group message'));
      await waitFor(() => expect(mockSendData).toHaveBeenCalledTimes(1));

      await user.click(screen.getByText('Send group message'));

      await waitFor(() => expect(mockSendData).toHaveBeenCalledTimes(2));
      expect(mockSendData).toHaveBeenCalledTimes(2);
    });
  });

  describe('while the browser reports no network', () => {
    const setBrowserOnline = (online: boolean) => {
      Object.defineProperty(window.navigator, 'onLine', { value: online, configurable: true });
      window.dispatchEvent(new Event(online ? 'online' : 'offline'));
    };

    afterEach(() => {
      Object.defineProperty(window.navigator, 'onLine', { value: true, configurable: true });
    });

    it('holds a message rather than posting it, even while the socket still reports connected', async () => {
      const user = userEvent.setup();
      render(<RoomPage authType="guest" />);

      act(() => setBrowserOnline(false));
      await user.click(screen.getByText('Send group message'));

      expect(mockSendData).not.toHaveBeenCalled();
      expect(screen.getByRole('status')).toBeInTheDocument();
      await waitFor(() => expect(screen.getByTestId('group-chat-panel')).toHaveAttribute('data-pending', 'hello room'));
    });

    it('posts the held message once the network returns', async () => {
      const user = userEvent.setup();
      render(<RoomPage authType="guest" />);

      act(() => setBrowserOnline(false));
      await user.click(screen.getByText('Send group message'));
      expect(mockSendData).not.toHaveBeenCalled();

      act(() => setBrowserOnline(true));

      await waitFor(() =>
        expect(mockSendData).toHaveBeenCalledWith('messages', expect.objectContaining({ body: 'hello room' })),
      );
    });
  });

  describe('while the socket connection is down', () => {
    const disconnectedSession = {
      socket: mockSocket,
      pseudonym: 'Priya Raghunathan',
      userId: 'user-1',
      isConnected: false,
      errorMessage: null,
      lastReconnectTime: null,
    };

    it('explains that messages will be held until the connection returns', () => {
      mockUseSessionJoin.mockReturnValue(disconnectedSession);
      render(<RoomPage authType="guest" />);

      expect(screen.getByRole('status')).toHaveTextContent(
        'Reconnecting… messages you send will be held and sent automatically.',
      );
    });

    it('shows no reconnecting notice while the socket is connected', () => {
      render(<RoomPage authType="guest" />);
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    it('holds a message rather than posting it', async () => {
      const user = userEvent.setup();
      mockUseSessionJoin.mockReturnValue(disconnectedSession);
      render(<RoomPage authType="guest" />);

      await user.click(screen.getByText('Send group message'));

      expect(mockSendData).not.toHaveBeenCalled();
      await waitFor(() => expect(screen.getByTestId('group-chat-panel')).toHaveAttribute('data-pending', 'hello room'));
    });

    it('posts the held message once the socket reconnects', async () => {
      const user = userEvent.setup();
      mockUseSessionJoin.mockReturnValue(disconnectedSession);
      const { rerender } = render(<RoomPage authType="guest" />);

      await user.click(screen.getByText('Send group message'));
      expect(mockSendData).not.toHaveBeenCalled();

      mockUseSessionJoin.mockReturnValue({ ...disconnectedSession, isConnected: true });
      rerender(<RoomPage authType="guest" />);

      await waitFor(() =>
        expect(mockSendData).toHaveBeenCalledWith(
          'messages',
          expect.objectContaining({ body: 'hello room', channels: [{ name: 'chat' }] }),
        ),
      );
      await waitFor(() => expect(screen.getByTestId('group-chat-panel')).toHaveAttribute('data-pending', ''));
    });

    it('holds a Berkie message on the assistant tab too', async () => {
      const user = userEvent.setup();
      mockUseSessionJoin.mockReturnValue(disconnectedSession);
      render(<RoomPage authType="guest" />);

      await user.click(screen.getByRole('button', { name: 'Berkie' }));
      await user.click(screen.getByText('Send assistant message'));

      expect(mockSendData).not.toHaveBeenCalled();
      await waitFor(() => expect(screen.getByTestId('assistant-panel')).toHaveAttribute('data-pending', 'hello Berkie'));
    });

    it('escalates the notice once the connection has stayed down', () => {
      jest.useFakeTimers();
      try {
        mockUseSessionJoin.mockReturnValue(disconnectedSession);
        render(<RoomPage authType="guest" />);

        expect(screen.getByRole('status')).toHaveTextContent('Reconnecting…');

        act(() => {
          jest.advanceTimersByTime(30_000);
        });

        expect(screen.getByRole('status')).toHaveTextContent('Still offline. Your message is saved on this device.');
      } finally {
        jest.useRealTimers();
      }
    });

    it('keeps a message queued when the send itself fails', async () => {
      const user = userEvent.setup();
      mockSendData.mockRejectedValue(new TypeError('Failed to fetch'));
      render(<RoomPage authType="guest" />);

      await user.click(screen.getByText('Send group message'));

      await waitFor(() => expect(mockSendData).toHaveBeenCalled());
      expect(screen.getByTestId('group-chat-panel')).toHaveAttribute('data-pending', 'hello room');
    });

    it('has no accessibility violations with the reconnecting notice showing', async () => {
      mockUseSessionJoin.mockReturnValue(disconnectedSession);
      const { container } = render(<RoomPage authType="guest" />);
      expect(await axe(container)).toHaveNoViolations();
    });
  });

  it('has no accessibility violations once loaded', async () => {
    const { container } = render(<RoomPage authType="guest" />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
