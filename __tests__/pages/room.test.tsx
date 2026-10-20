import React from 'react';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
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
const mockGetTokens = jest.fn();

jest.mock('../../utils', () => ({
  Api: {
    get: jest.fn(() => ({
      GetTokens: (...args: any[]) => mockGetTokens(...args),
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
  CommunityGroupChatPanel: ({
    messages,
    realName,
    isAdmin,
    mustSetRealName,
    onRequestRealName,
    onSendMessage,
    onRetryPendingMessage,
    moderation,
    pendingMessages = [],
  }: any) => (
    <div
      data-testid="group-chat-panel"
      data-real-name={realName}
      data-is-admin={isAdmin ? 'true' : 'false'}
      data-must-set-real-name={mustSetRealName ? 'true' : 'false'}
      data-pending={pendingMessages.map((m: any) => m.body).join('|')}
      data-pending-failed={pendingMessages
        .filter((m: any) => m.failed)
        .map((m: any) => m.body)
        .join('|')}
      data-pending-reason={pendingMessages
        .filter((m: any) => m.failureReason)
        .map((m: any) => m.failureReason)
        .join('|')}
    >
      {messages.map((m: any) => (
        <div key={m.id} data-hidden={m.hidden ? 'true' : 'false'}>
          {typeof m.body === 'string' ? m.body : m.body?.text}
          {moderation && <button onClick={() => moderation.onToggleHidden(m)}>Toggle hide {m.id}</button>}
          {moderation && <button onClick={() => moderation.onToggleHideAuthor(m, false)}>Hide author of {m.id}</button>}
          {moderation && <button onClick={() => moderation.onToggleHidden(m, 'pii')}>Hide for pii {m.id}</button>}
          {moderation && (
            <button onClick={() => moderation.onToggleHideAuthor(m, false, 'harassment')}>
              Hide author for harassment {m.id}
            </button>
          )}
          {moderation && (
            <button onClick={() => moderation.onToggleHideAuthor(m, moderation.isAuthorHidden(m))}>
              Toggle author of {m.id}
            </button>
          )}
        </div>
      ))}
      <button onClick={() => onSendMessage('hello room')}>Send group message</button>
      <button onClick={onRequestRealName}>Request real name</button>
      <button onClick={() => onRetryPendingMessage?.(pendingMessages.find((m: any) => m.failed)?.id)}>
        Retry group message
      </button>
    </div>
  ),
}));

jest.mock('../../components/room/SetRealNameDialog', () => ({
  SetRealNameDialog: function MockSetRealNameDialog({ open, onSave, onDismiss }: any) {
    const [result, setResult] = jest.requireActual('react').useState(null);
    return open ? (
      <div data-testid="set-real-name-dialog" data-save-result={result ? JSON.stringify(result) : ''}>
        <button onClick={async () => setResult(await onSave('Alex Admin'))}>Confirm name</button>
        <button onClick={onDismiss}>Just reading</button>
      </div>
    ) : null;
  },
}));

jest.mock('../../components/room/CommunityAssistantPanel', () => ({
  CommunityAssistantPanel: ({ messages, mustSetRealName, onSendMessage, pendingMessages = [] }: any) => (
    <div
      data-testid="assistant-panel"
      data-must-set-real-name={mustSetRealName ? 'true' : 'false'}
      data-pending={pendingMessages.map((m: any) => m.body).join('|')}
    >
      {messages.map((m: any) => (
        <div key={m.id}>{typeof m.body === 'string' ? m.body : m.body?.text}</div>
      ))}
      <button onClick={() => onSendMessage('hello Berkie')}>Send assistant message</button>
    </div>
  ),
}));

function setDefaultMocks() {
  mockGetTokens.mockReturnValue({ access: 'mock-access-token' });
  mockUseRoomSetup.mockReturnValue({
    loaded: true,
    notFound: false,
    generalError: null,
    setGeneralError: jest.fn(),
    roomName: 'BKC Community Room',
    botName: 'Berkie',
    communityName: null,
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
      communityName: null,
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
      communityName: null,
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

  it('switches to the assistant panel when the Private Chat tab is clicked', async () => {
    const user = userEvent.setup();
    render(<RoomPage authType="guest" />);
    await user.click(screen.getByRole('button', { name: 'Private Chat' }));
    expect(screen.getByTestId('assistant-panel')).toBeInTheDocument();
    expect(screen.queryByTestId('group-chat-panel')).not.toBeInTheDocument();
  });

  it('shows a PRIVATE badge and the bot name in the header on the Private Chat tab', async () => {
    const user = userEvent.setup();
    render(<RoomPage authType="guest" />);
    await user.click(screen.getByRole('button', { name: 'Private Chat' }));
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
    await user.click(screen.getByRole('button', { name: 'Private Chat' }));
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

  describe('sending while another message is in flight', () => {
    it('delivers the second message too', async () => {
      const user = userEvent.setup();
      let releaseFirstSend: (value: unknown) => void = () => {};
      mockSendData
        .mockImplementationOnce(
          () =>
            new Promise((resolve) => {
              releaseFirstSend = resolve;
            }),
        )
        .mockResolvedValue({ id: 'sent-message-2' });

      render(<RoomPage authType="user" />);

      await user.click(screen.getByRole('button', { name: 'Send group message' }));
      await waitFor(() => expect(mockSendData).toHaveBeenCalledTimes(1));

      await user.click(screen.getByRole('button', { name: 'Send group message' }));
      await act(async () => {
        releaseFirstSend({ id: 'sent-message-1' });
      });

      await waitFor(() => expect(mockSendData).toHaveBeenCalledTimes(2));
    });
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

    it('opens from the account control too', async () => {
      const user = userEvent.setup();
      render(<RoomPage authType="user" />);

      await user.click(screen.getByRole('button', { name: 'Your account, Priya Raghunathan' }));

      expect(screen.getByRole('dialog', { name: 'Room menu' })).toBeInTheDocument();
    });

    it('offers a way back to the hallway', async () => {
      const user = userEvent.setup();
      render(<RoomPage authType="user" />);

      await user.click(screen.getByRole('button', { name: 'Menu' }));

      expect(screen.getByRole('link', { name: 'Return to the hallway' })).toHaveAttribute('href', '/hallway');
    });
  });

  describe('when the session has no token', () => {
    it('says the message was not sent instead of dropping it silently', async () => {
      const user = userEvent.setup();
      mockGetTokens.mockReturnValue(null);
      render(<RoomPage authType="guest" />);

      await user.click(screen.getByText('Send group message'));

      expect(await screen.findByRole('alert')).toHaveTextContent(/not sent/i);
      expect(mockSendData).not.toHaveBeenCalled();
      expect(screen.getByTestId('group-chat-panel')).toHaveAttribute('data-pending', '');
    });
  });

  describe("the poster's name", () => {
    const accountWith = (conversations: string[]) => ({
      id: 'user-1',
      pseudonyms: [
        { pseudonym: 'Trendy Impala', active: true, isRealName: false, conversations: [] },
        { pseudonym: 'Chelsea Johnson', active: false, isRealName: true, conversations },
      ],
    });

    it('uses the real name registered for this room rather than the active pseudonym', async () => {
      mockRetrieveData.mockImplementation((url: string) =>
        Promise.resolve(url.startsWith('users/user/') ? accountWith(['test-room-id']) : []),
      );

      render(<RoomPage authType="guest" />);

      await waitFor(() =>
        expect(screen.getByTestId('group-chat-panel')).toHaveAttribute('data-real-name', 'Chelsea Johnson'),
      );
    });

    // The session cookie calls every signed-in account an admin, so the account decides instead.
    it('marks the poster as an admin from their account, not their session', async () => {
      mockRetrieveData.mockImplementation((url: string) =>
        Promise.resolve(url.startsWith('users/user/') ? { ...accountWith(['test-room-id']), role: 'admin' } : []),
      );

      render(<RoomPage authType="guest" />);

      await waitFor(() => expect(screen.getByTestId('group-chat-panel')).toHaveAttribute('data-is-admin', 'true'));
    });

    it('leaves a participant unmarked even when their session says admin', async () => {
      mockRetrieveData.mockImplementation((url: string) =>
        Promise.resolve(url.startsWith('users/user/') ? { ...accountWith(['test-room-id']), role: 'participant' } : []),
      );

      render(<RoomPage authType="admin" />);

      await waitFor(() =>
        expect(screen.getByTestId('group-chat-panel')).toHaveAttribute('data-real-name', 'Chelsea Johnson'),
      );
      expect(screen.getByTestId('group-chat-panel')).toHaveAttribute('data-is-admin', 'false');
    });

    describe('asking an admin for a name', () => {
      const adminAccount = (conversations: string[]) => ({ ...accountWith(conversations), role: 'admin' });

      const renderWithAccount = (account: any) => {
        mockRetrieveData.mockImplementation((url: string) => Promise.resolve(url.startsWith('users/user/') ? account : []));
        return render(<RoomPage authType="admin" />);
      };

      it('asks an admin with no name for this room', async () => {
        renderWithAccount(adminAccount(['some-other-room']));

        await waitFor(() => expect(screen.getByTestId('set-real-name-dialog')).toBeInTheDocument());
      });

      // The backend carries an existing name into each room the admin joins, so an admin who
      // already has one here is not asked again.
      it('leaves an admin who already has a name for this room alone', async () => {
        renderWithAccount(adminAccount(['test-room-id']));

        await waitFor(() => expect(screen.getByTestId('group-chat-panel')).toHaveAttribute('data-is-admin', 'true'));
        expect(screen.queryByTestId('set-real-name-dialog')).not.toBeInTheDocument();
      });

      it('never asks a member, whatever their session says', async () => {
        renderWithAccount({ ...accountWith(['some-other-room']), role: 'participant' });

        await waitFor(() => expect(screen.getByTestId('group-chat-panel')).toBeInTheDocument());
        expect(screen.queryByTestId('set-real-name-dialog')).not.toBeInTheDocument();
      });

      it('claims the name against this room and uses it without a reload', async () => {
        const user = userEvent.setup();
        mockSendData.mockResolvedValue([
          { pseudonym: 'Trendy Impala', active: true, isRealName: false, conversations: [] },
          { pseudonym: 'Alex Admin', active: false, isRealName: true, conversations: ['test-room-id'] },
        ]);
        renderWithAccount(adminAccount(['some-other-room']));

        await waitFor(() => expect(screen.getByTestId('set-real-name-dialog')).toBeInTheDocument());
        await user.click(screen.getByText('Confirm name'));

        await waitFor(() => expect(screen.getByTestId('group-chat-panel')).toHaveAttribute('data-real-name', 'Alex Admin'));
        expect(mockSendData).toHaveBeenCalledWith(
          'users/pseudonyms/real-name',
          { conversationId: 'test-room-id', realName: 'Alex Admin' },
          'mock-access-token',
        );
        expect(screen.queryByTestId('set-real-name-dialog')).not.toBeInTheDocument();
      });

      /* A tab opened before the name was claimed in another tab doesn't know about that claim,
         and only the account record holds the name itself. */
      it('picks up the name the account already has here instead of calling it taken', async () => {
        const user = userEvent.setup();
        let accountReads = 0;
        mockRetrieveData.mockImplementation((url: string) => {
          if (!url.startsWith('users/user/')) return Promise.resolve([]);
          accountReads += 1;
          return Promise.resolve(
            adminAccount(accountReads === 1 ? ['some-other-room'] : ['some-other-room', 'test-room-id']),
          );
        });
        mockSendData.mockResolvedValue({
          error: true,
          status: 409,
          message: 'Conflict',
          reason: 'real_name_already_set',
        });
        render(<RoomPage authType="admin" />);

        await waitFor(() => expect(screen.getByTestId('set-real-name-dialog')).toBeInTheDocument());
        await user.click(screen.getByText('Confirm name'));

        await waitFor(() =>
          expect(screen.getByTestId('group-chat-panel')).toHaveAttribute('data-real-name', 'Chelsea Johnson'),
        );
        expect(screen.queryByTestId('set-real-name-dialog')).not.toBeInTheDocument();
        expect(screen.getByTestId('group-chat-panel')).toHaveAttribute('data-must-set-real-name', 'false');
      });

      it('keeps the dialog open when the name is already taken here', async () => {
        const user = userEvent.setup();
        mockSendData.mockResolvedValue({ error: true, status: 409, message: 'Conflict', reason: 'real_name_taken' });
        renderWithAccount(adminAccount(['some-other-room']));

        await waitFor(() => expect(screen.getByTestId('set-real-name-dialog')).toBeInTheDocument());
        await user.click(screen.getByText('Confirm name'));

        await waitFor(() =>
          expect(screen.getByTestId('set-real-name-dialog')).toHaveAttribute(
            'data-save-result',
            '{"ok":false,"taken":true}',
          ),
        );
        const accountReads = mockRetrieveData.mock.calls.filter(([url]) => String(url).startsWith('users/user/'));
        expect(accountReads).toHaveLength(1);
      });

      it('reports a failed save when the server refuses a name without saying why', async () => {
        const user = userEvent.setup();
        mockSendData.mockResolvedValue({ error: true, status: 409, message: 'Conflict' });
        renderWithAccount(adminAccount(['some-other-room']));

        await waitFor(() => expect(screen.getByTestId('set-real-name-dialog')).toBeInTheDocument());
        await user.click(screen.getByText('Confirm name'));

        await waitFor(() =>
          expect(screen.getByTestId('set-real-name-dialog')).toHaveAttribute('data-save-result', '{"ok":false}'),
        );
      });

      it('reports a failed save rather than a taken name when the account cannot be re-read', async () => {
        const user = userEvent.setup();
        let accountReads = 0;
        mockRetrieveData.mockImplementation((url: string) => {
          if (!url.startsWith('users/user/')) return Promise.resolve([]);
          accountReads += 1;
          return Promise.resolve(
            accountReads === 1 ? adminAccount(['some-other-room']) : { error: true, status: 500, message: 'Server error' },
          );
        });
        mockSendData.mockResolvedValue({
          error: true,
          status: 409,
          message: 'Conflict',
          reason: 'real_name_already_set',
        });
        render(<RoomPage authType="admin" />);

        await waitFor(() => expect(screen.getByTestId('set-real-name-dialog')).toBeInTheDocument());
        await user.click(screen.getByText('Confirm name'));

        await waitFor(() =>
          expect(screen.getByTestId('set-real-name-dialog')).toHaveAttribute('data-save-result', '{"ok":false}'),
        );
      });

      /* A post can leave before the account loads and locks the composer, so a refusal for want
         of a name still brings the prompt back. */
      it('asks again when a dismissed admin tries to post', async () => {
        const user = userEvent.setup();
        renderWithAccount(adminAccount(['some-other-room']));

        await waitFor(() => expect(screen.getByTestId('set-real-name-dialog')).toBeInTheDocument());
        await user.click(screen.getByText('Just reading'));
        expect(screen.queryByTestId('set-real-name-dialog')).not.toBeInTheDocument();

        mockSendData.mockResolvedValue({
          error: true,
          status: 400,
          message: 'Set your real name for this conversation before posting.',
          reason: 'real_name_required',
        });
        await user.click(screen.getByText('Send group message'));

        await waitFor(() => expect(screen.getByTestId('set-real-name-dialog')).toBeInTheDocument());
      });

      it('stays shut when a dismissed admin gets a 400 for some other reason', async () => {
        const user = userEvent.setup();
        renderWithAccount(adminAccount(['some-other-room']));

        await waitFor(() => expect(screen.getByTestId('set-real-name-dialog')).toBeInTheDocument());
        await user.click(screen.getByText('Just reading'));

        mockSendData.mockResolvedValue({ error: true, status: 400, message: 'That message is too long.' });
        await user.click(screen.getByText('Send group message'));

        await waitFor(() => expect(mockSendData).toHaveBeenCalled());
        expect(screen.queryByTestId('set-real-name-dialog')).not.toBeInTheDocument();
      });

      /* Only a refusal the prompt can fix may reopen it. A moderation refusal answers 422, and
         reopening on it would trap a reading admin behind a dialog that cannot help. */
      it('stays shut when a dismissed admin is refused by moderation', async () => {
        const user = userEvent.setup();
        renderWithAccount(adminAccount(['some-other-room']));

        await waitFor(() => expect(screen.getByTestId('set-real-name-dialog')).toBeInTheDocument());
        await user.click(screen.getByText('Just reading'));

        mockSendData.mockResolvedValue({ error: true, status: 422, message: 'Rephrase that before posting.' });
        await user.click(screen.getByText('Send group message'));

        await waitFor(() => expect(mockSendData).toHaveBeenCalled());
        expect(screen.queryByTestId('set-real-name-dialog')).not.toBeInTheDocument();
      });

      it('leaves a member alone when their own message is refused', async () => {
        const user = userEvent.setup();
        renderWithAccount({ ...accountWith(['test-room-id']), role: 'participant' });
        mockSendData.mockResolvedValue({ error: true, status: 400, message: 'That message is too long.' });

        await user.click(screen.getByText('Send group message'));

        await waitFor(() => expect(mockSendData).toHaveBeenCalled());
        expect(screen.queryByTestId('set-real-name-dialog')).not.toBeInTheDocument();
      });

      it('locks both composers for an admin with no name for this room', async () => {
        const user = userEvent.setup();
        renderWithAccount(adminAccount(['some-other-room']));

        await waitFor(() =>
          expect(screen.getByTestId('group-chat-panel')).toHaveAttribute('data-must-set-real-name', 'true'),
        );

        await user.click(screen.getByText('Just reading'));
        await user.click(screen.getByRole('button', { name: 'Private Chat' }));

        expect(screen.getByTestId('assistant-panel')).toHaveAttribute('data-must-set-real-name', 'true');
      });

      it('leaves the composer open for an admin who already has a name for this room', async () => {
        renderWithAccount(adminAccount(['test-room-id']));

        await waitFor(() => expect(screen.getByTestId('group-chat-panel')).toHaveAttribute('data-is-admin', 'true'));
        expect(screen.getByTestId('group-chat-panel')).toHaveAttribute('data-must-set-real-name', 'false');
      });

      it('reopens the prompt when a dismissed admin reaches for the locked composer', async () => {
        const user = userEvent.setup();
        renderWithAccount(adminAccount(['some-other-room']));

        await waitFor(() => expect(screen.getByTestId('set-real-name-dialog')).toBeInTheDocument());
        await user.click(screen.getByText('Just reading'));
        await user.click(screen.getByText('Request real name'));

        expect(screen.getByTestId('set-real-name-dialog')).toBeInTheDocument();
      });

      it('stops asking once the admin says they are only reading', async () => {
        const user = userEvent.setup();
        renderWithAccount(adminAccount(['some-other-room']));

        await waitFor(() => expect(screen.getByTestId('set-real-name-dialog')).toBeInTheDocument());
        await user.click(screen.getByText('Just reading'));

        expect(screen.queryByTestId('set-real-name-dialog')).not.toBeInTheDocument();
        expect(mockSendData).not.toHaveBeenCalled();
      });
    });

    it('keeps the session pseudonym when the account has no real name for this room', async () => {
      mockRetrieveData.mockImplementation((url: string) =>
        Promise.resolve(url.startsWith('users/user/') ? accountWith(['some-other-room']) : []),
      );

      render(<RoomPage authType="guest" />);

      await waitFor(() => expect(screen.getByTestId('group-chat-panel')).toBeInTheDocument());
      expect(screen.getByTestId('group-chat-panel')).toHaveAttribute('data-real-name', 'Priya Raghunathan');
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

    it('names the reason on the message when the server explains itself', async () => {
      const user = userEvent.setup();
      mockSendData.mockResolvedValue({ error: true, status: 403, message: 'Forbidden' });
      render(<RoomPage authType="guest" />);

      await user.click(screen.getByText('Send group message'));

      await waitFor(() =>
        expect(screen.getByTestId('group-chat-panel')).toHaveAttribute(
          'data-pending-reason',
          'You are not registered for this room.',
        ),
      );
    });

    it('passes a bad-request message through as the server wrote it', async () => {
      const user = userEvent.setup();
      mockSendData.mockResolvedValue({ error: true, status: 400, message: 'That message is too long.' });
      render(<RoomPage authType="guest" />);

      await user.click(screen.getByText('Send group message'));

      await waitFor(() =>
        expect(screen.getByTestId('group-chat-panel')).toHaveAttribute('data-pending-reason', 'That message is too long.'),
      );
    });

    /* An admin who has not claimed a real name for this room is refused with a 400 saying so.
       That has to reach them as written: "not registered" would tell them to ask for an
       invitation, when what they need is to set a name. */
    it('tells an admin to set a real name in the words the server used', async () => {
      const user = userEvent.setup();
      mockSendData.mockResolvedValue({
        error: true,
        status: 400,
        message: 'Set your real name for this conversation before posting.',
      });
      render(<RoomPage authType="admin" />);

      await user.click(screen.getByText('Send group message'));

      await waitFor(() =>
        expect(screen.getByTestId('group-chat-panel')).toHaveAttribute(
          'data-pending-reason',
          'Set your real name for this conversation before posting.',
        ),
      );
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

      await user.click(screen.getByRole('button', { name: 'Private Chat' }));
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

  describe('moderation', () => {
    const accountWith = (conversations: string[]) => ({
      id: 'user-1',
      pseudonyms: [{ pseudonym: 'Chelsea Johnson', active: false, isRealName: true, conversations }],
    });

    const chatMsg = (id: string, minute: number, overrides: Record<string, unknown> = {}) => ({
      id,
      body: { text: `msg ${id}` },
      owner: id === 'm-mine' ? 'user-1' : `owner-${id}`,
      channels: ['chat'],
      createdAt: new Date(2024, 0, 1, 12, minute).toISOString(),
      ...overrides,
    });

    const handler = (event: string) => {
      const calls = mockSocket.on.mock.calls.filter(([name]: [string]) => name === event);
      return calls[calls.length - 1]?.[1];
    };

    const renderRoom = async (role: 'admin' | 'participant', history: any[]) => {
      mockRetrieveData.mockImplementation((url: string) => {
        if (url.startsWith('users/user/')) return Promise.resolve({ ...accountWith(['test-room-id']), role });
        if (url.startsWith('messages/test-room-id?channel=chat')) return Promise.resolve(history);
        return Promise.resolve([]);
      });
      render(<RoomPage authType={role === 'admin' ? 'admin' : 'guest'} />);
      await waitFor(() => expect(screen.getByTestId('group-chat-panel')).toBeInTheDocument());
      await waitFor(() => expect(handler('message:hidden')).toBeDefined());
      if (history.length) await screen.findByText(`msg ${history[0].id}`);
    };

    it('registers the moderation listeners and removes them on unmount', async () => {
      await renderRoom('participant', []);
      cleanup();
      expect(mockSocket.off).toHaveBeenCalledWith('message:hidden', expect.any(Function));
      expect(mockSocket.off).toHaveBeenCalledWith('message:hidden-notice', expect.any(Function));
    });

    it('removes a hidden message from a participant and ignores an unhide', async () => {
      await renderRoom('participant', [chatMsg('a', 1), chatMsg('b', 2)]);

      act(() => handler('message:hidden')({ messageIds: ['a'], hidden: true, display: 'omit' }));
      expect(screen.queryByText('msg a')).not.toBeInTheDocument();
      expect(screen.getByText('msg b')).toBeInTheDocument();

      act(() => handler('message:hidden')({ messageIds: ['b'], hidden: false, display: 'omit' }));
      expect(screen.getByText('msg b')).toBeInTheDocument();
    });

    it("keeps the author's own message visible", async () => {
      await renderRoom('participant', [chatMsg('m-mine', 1)]);
      act(() => handler('message:hidden')({ messageIds: ['m-mine'], hidden: true, display: 'omit' }));
      expect(screen.getByText('msg m-mine')).toBeInTheDocument();
    });

    it('toasts the hidden author', async () => {
      await renderRoom('participant', []);
      act(() =>
        handler('message:hidden-notice')({ conversationId: 'test-room-id', scope: 'message', messageIds: ['m-mine'] }),
      );
      expect(await screen.findByText(/A moderator has limited the visibility of your message/)).toBeInTheDocument();
    });

    it('ignores a hidden notice about another conversation', async () => {
      await renderRoom('participant', []);
      act(() => handler('message:hidden-notice')({ conversationId: 'other-room', scope: 'user', messageIds: ['x'] }));
      expect(screen.queryByText(/A moderator has limited/)).not.toBeInTheDocument();
    });

    it('ignores a message:new that belongs to another conversation', async () => {
      await renderRoom('participant', [chatMsg('a', 1)]);
      act(() => handler('message:new')(chatMsg('z', 2, { conversation: 'other-room' })));
      expect(screen.queryByText('msg z')).not.toBeInTheDocument();
      act(() => handler('message:new')(chatMsg('y', 3, { conversation: 'test-room-id' })));
      expect(screen.getByText('msg y')).toBeInTheDocument();
    });

    it('clears the hidden flag for an admin when message:new restores the message', async () => {
      await renderRoom('admin', [chatMsg('a', 1, { hidden: true })]);
      await waitFor(() => expect(screen.getByTestId('group-chat-panel')).toHaveAttribute('data-is-admin', 'true'));
      expect(screen.getByText('msg a').closest('[data-hidden]')).toHaveAttribute('data-hidden', 'true');

      act(() => handler('message:new')(chatMsg('a', 1)));
      expect(screen.getByText('msg a').closest('[data-hidden]')).toHaveAttribute('data-hidden', 'false');
      expect(screen.getAllByText('msg a')).toHaveLength(1);
    });

    it('greys the replies the server cascaded, using the response ids', async () => {
      const user = userEvent.setup();
      await renderRoom('admin', [chatMsg('a', 1), chatMsg('r', 2, { parentMessage: 'a' })]);
      await screen.findByText('Toggle hide a');

      mockSendData.mockResolvedValueOnce({ conversationId: 'test-room-id', messageIds: ['a', 'r'], hidden: true });
      await user.click(screen.getByText('Toggle hide a'));
      await waitFor(() => expect(screen.getByText('msg r').closest('[data-hidden]')).toHaveAttribute('data-hidden', 'true'));
    });

    it('puts back an optimistic hide the server reports as unchanged', async () => {
      const user = userEvent.setup();
      await renderRoom('admin', [chatMsg('a', 1, { hidden: true })]);
      await screen.findByText('Toggle hide a');

      mockSendData.mockResolvedValueOnce({ conversationId: 'test-room-id', messageIds: [], hidden: false });
      await user.click(screen.getByText('Toggle hide a'));
      await waitFor(() => expect(screen.getByText('msg a').closest('[data-hidden]')).toHaveAttribute('data-hidden', 'true'));
    });

    it('flags a message hidden for an admin instead of removing it', async () => {
      await renderRoom('admin', [chatMsg('a', 1)]);
      await waitFor(() => expect(screen.getByTestId('group-chat-panel')).toHaveAttribute('data-is-admin', 'true'));

      act(() => handler('message:hidden')({ messageIds: ['a'], hidden: true, display: 'omit' }));
      expect(screen.getByText('msg a').closest('[data-hidden]')).toHaveAttribute('data-hidden', 'true');
    });

    it('hides optimistically through the REST endpoint and rolls back on a refusal', async () => {
      const user = userEvent.setup();
      await renderRoom('admin', [chatMsg('a', 1)]);
      await screen.findByText('Toggle hide a');

      mockSendData.mockResolvedValueOnce({ success: true });
      await user.click(screen.getByText('Toggle hide a'));
      expect(mockSendData).toHaveBeenCalledWith('messages/a/hide', undefined, undefined, undefined, 'POST');
      expect(screen.getByText('msg a').closest('[data-hidden]')).toHaveAttribute('data-hidden', 'true');

      mockSendData.mockResolvedValueOnce({ error: true, status: 403 });
      await user.click(screen.getByText('Toggle hide a'));
      expect(mockSendData).toHaveBeenLastCalledWith('messages/a/hide', undefined, undefined, undefined, 'DELETE');
      await waitFor(() => expect(screen.getByText('msg a').closest('[data-hidden]')).toHaveAttribute('data-hidden', 'true'));
      expect(await screen.findByText(/Could not unhide/)).toBeInTheDocument();
    });

    it('hides everything from an author through the conversation endpoint', async () => {
      const user = userEvent.setup();
      await renderRoom('admin', [chatMsg('a', 1), chatMsg('b', 2, { owner: 'owner-a' })]);
      await screen.findByText('Hide author of a');

      mockSendData.mockResolvedValueOnce({ success: true });
      await user.click(screen.getByText('Hide author of a'));
      expect(mockSendData).toHaveBeenCalledWith(
        'conversations/test-room-id/users/owner-a/hide-messages',
        undefined,
        undefined,
        undefined,
        'POST',
      );
      expect(screen.getByText('msg b').closest('[data-hidden]')).toHaveAttribute('data-hidden', 'true');
    });

    it('does not repeat a message that message:new delivers twice, and orders a late one by time', async () => {
      await renderRoom('participant', [chatMsg('a', 1), chatMsg('c', 3)]);
      const onNew = handler('message:new');

      act(() => onNew(chatMsg('b', 2)));
      act(() => onNew(chatMsg('b', 2)));

      const order = screen.getAllByText(/^msg /).map((el) => el.textContent);
      expect(order).toEqual(['msg a', 'msg b', 'msg c']);
    });

    describe('gaps', () => {
      const hiddenState = (id: string) =>
        screen.getByText(`msg ${id}`).closest('[data-hidden]')?.getAttribute('data-hidden');

      const reconnect = (rerender: (ui: React.ReactElement) => void, role: 'admin' | 'participant') => {
        mockUseSessionJoin.mockReturnValue({
          socket: mockSocket,
          pseudonym: 'Priya Raghunathan',
          userId: 'user-1',
          isConnected: true,
          errorMessage: null,
          lastReconnectTime: Date.now(),
        });
        rerender(<RoomPage authType={role === 'admin' ? 'admin' : 'guest'} />);
      };

      const mockServer = (role: string, history: () => any[]) =>
        mockRetrieveData.mockImplementation((url: string) => {
          if (url.startsWith('users/user/')) return Promise.resolve({ ...accountWith(['test-room-id']), role });
          if (url.startsWith('messages/test-room-id?channel=chat')) return Promise.resolve(history());
          return Promise.resolve([]);
        });

      it("after a reconnect an admin gets the server's current hidden flags", async () => {
        let current = [chatMsg('a', 1), chatMsg('b', 2)];
        mockServer('admin', () => current);
        const { rerender } = render(<RoomPage authType="admin" />);
        await screen.findByText('msg a');
        await waitFor(() => expect(screen.getByTestId('group-chat-panel')).toHaveAttribute('data-is-admin', 'true'));
        expect(hiddenState('a')).toBe('false');

        current = [chatMsg('a', 1, { hidden: true }), chatMsg('b', 2)];
        reconnect(rerender, 'admin');
        await waitFor(() => expect(hiddenState('a')).toBe('true'));
        expect(hiddenState('b')).toBe('false');
      });

      it('after a reconnect a participant loses what was hidden while away and anything unhidden returns', async () => {
        let current = [chatMsg('a', 1), chatMsg('b', 2)];
        mockServer('participant', () => current);
        const { rerender } = render(<RoomPage authType="guest" />);
        await screen.findByText('msg a');

        current = [chatMsg('b', 2), chatMsg('c', 3)];
        reconnect(rerender, 'participant');
        await waitFor(() => expect(screen.queryByText('msg a')).not.toBeInTheDocument());
        expect(screen.getByText('msg b')).toBeInTheDocument();
        expect(screen.getByText('msg c')).toBeInTheDocument();
      });

      it('re-reads history when the room is rejoined after a short reconnect, with no gap signal', async () => {
        let current = [chatMsg('a', 1), chatMsg('b', 2)];
        mockServer('participant', () => current);
        render(<RoomPage authType="guest" />);
        await screen.findByText('msg a');
        await waitFor(() => expect(handler('connect')).toBeDefined());

        current = [chatMsg('b', 2)];
        // The socket reconnects within the gap threshold, so lastReconnectTime stays null.
        await act(async () => {
          handler('connect')();
        });
        await waitFor(() => expect(screen.queryByText('msg a')).not.toBeInTheDocument());
        expect(screen.getByText('msg b')).toBeInTheDocument();
      });

      it('applies a hide event idempotently and ignores ids it does not hold', async () => {
        await renderRoom('participant', [chatMsg('a', 1), chatMsg('b', 2)]);
        const event = { messageIds: ['a', 'not-here'], hidden: true, display: 'omit' };
        act(() => handler('message:hidden')(event));
        act(() => handler('message:hidden')(event));
        act(() => handler('message:hidden')({ messageIds: ['ghost'], hidden: true, display: 'omit' }));
        expect(screen.queryByText('msg a')).not.toBeInTheDocument();
        expect(screen.getByText('msg b')).toBeInTheDocument();
      });

      it('survives a hide event that lands before the history fetch resolves', async () => {
        let resolveHistory: (v: any[]) => void = () => {};
        mockRetrieveData.mockImplementation((url: string) => {
          if (url.startsWith('users/user/'))
            return Promise.resolve({ ...accountWith(['test-room-id']), role: 'participant' });
          if (url.startsWith('messages/test-room-id?channel=chat'))
            return new Promise((resolve) => {
              resolveHistory = resolve;
            });
          return Promise.resolve([]);
        });
        render(<RoomPage authType="guest" />);
        await waitFor(() => expect(handler('message:hidden')).toBeDefined());
        await waitFor(() =>
          expect(mockRetrieveData).toHaveBeenCalledWith(expect.stringContaining('channel=chat'), expect.anything()),
        );

        act(() => handler('message:hidden')({ messageIds: ['a'], hidden: true, display: 'omit' }));
        await act(async () => resolveHistory([chatMsg('b', 2)]));
        // History is the server's current state, so what it holds is what shows.
        expect(await screen.findByText('msg b')).toBeInTheDocument();
      });

      it('replaces a stub with the full message when message:new arrives for the same id', async () => {
        await renderRoom('participant', [chatMsg('a', 1), chatMsg('b', 2)]);
        act(() => handler('message:hidden')({ messageIds: ['a'], hidden: true, display: 'placeholder' }));
        expect(screen.queryByText('msg a')).not.toBeInTheDocument();
        expect(screen.getAllByText(/^msg /)).toHaveLength(1);

        act(() => handler('message:new')(chatMsg('a', 1)));
        expect(screen.getByText('msg a')).toBeInTheDocument();
        expect(screen.getAllByText(/^msg /)).toHaveLength(2);
      });

      it('keeps one set of listeners after the effect re-runs, and removes them on unmount', async () => {
        const live = (name: string) =>
          mockSocket.on.mock.calls.filter(([n]: [string]) => n === name).length -
          mockSocket.off.mock.calls.filter(([n]: [string]) => n === name).length;

        mockServer('admin', () => []);
        const { unmount } = render(<RoomPage authType="admin" />);
        // isAdmin flips once the account loads, which re-runs the listener effect.
        await waitFor(() => expect(screen.getByTestId('group-chat-panel')).toHaveAttribute('data-is-admin', 'true'));
        for (const name of ['message:new', 'message:hidden', 'message:hidden-notice']) expect(live(name)).toBe(1);

        unmount();
        for (const name of ['message:new', 'message:hidden', 'message:hidden-notice']) expect(live(name)).toBe(0);
      });

      it('gives a participant no moderation controls', async () => {
        await renderRoom('participant', [chatMsg('a', 1)]);
        expect(screen.queryByText('Toggle hide a')).not.toBeInTheDocument();
      });

      it('unhides through DELETE and clears the flag', async () => {
        const user = userEvent.setup();
        await renderRoom('admin', [chatMsg('a', 1, { hidden: true })]);
        await screen.findByText('Toggle hide a');

        mockSendData.mockResolvedValueOnce({ conversationId: 'test-room-id', messageIds: ['a'], hidden: false });
        await user.click(screen.getByText('Toggle hide a'));
        expect(mockSendData).toHaveBeenCalledWith('messages/a/hide', undefined, undefined, undefined, 'DELETE');
        await waitFor(() => expect(hiddenState('a')).toBe('false'));
      });

      it('unhides all of an author with DELETE on the hide-messages path', async () => {
        const user = userEvent.setup();
        await renderRoom('admin', [chatMsg('a', 1, { hidden: true }), chatMsg('b', 2, { hidden: true, owner: 'owner-a' })]);
        await screen.findByText('Toggle author of a');

        mockSendData.mockResolvedValueOnce({
          conversationId: 'test-room-id',
          userId: 'owner-a',
          messageIds: ['a', 'b'],
          hidden: false,
        });
        await user.click(screen.getByText('Toggle author of a'));
        expect(mockSendData).toHaveBeenCalledWith(
          'conversations/test-room-id/users/owner-a/hide-messages',
          undefined,
          undefined,
          undefined,
          'DELETE',
        );
        await waitFor(() => expect(hiddenState('b')).toBe('false'));
        expect(hiddenState('a')).toBe('false');
      });

      it('rolls hide-all back and toasts when the request fails', async () => {
        const user = userEvent.setup();
        await renderRoom('admin', [chatMsg('a', 1), chatMsg('b', 2, { owner: 'owner-a' })]);
        await screen.findByText('Hide author of a');

        mockSendData.mockResolvedValueOnce({ error: true, status: 500 });
        await user.click(screen.getByText('Hide author of a'));
        expect(await screen.findByText(/Could not hide/)).toBeInTheDocument();
        expect(hiddenState('a')).toBe('false');
        expect(hiddenState('b')).toBe('false');
      });

      it('sends the chosen reason in the JSON body of a message hide, and none when skipped', async () => {
        const user = userEvent.setup();
        await renderRoom('admin', [chatMsg('a', 1), chatMsg('b', 2)]);
        await screen.findByText('Hide for pii a');

        mockSendData.mockResolvedValue({ conversationId: 'test-room-id', messageIds: ['a'], hidden: true });
        await user.click(screen.getByText('Hide for pii a'));
        expect(mockSendData).toHaveBeenCalledWith('messages/a/hide', { reason: 'pii' }, undefined, undefined, 'POST');

        await user.click(screen.getByText('Toggle hide b'));
        expect(mockSendData).toHaveBeenLastCalledWith('messages/b/hide', undefined, undefined, undefined, 'POST');
      });

      it('sends the chosen reason in the JSON body of a hide-all', async () => {
        const user = userEvent.setup();
        await renderRoom('admin', [chatMsg('a', 1)]);
        await screen.findByText('Hide author for harassment a');

        mockSendData.mockResolvedValue({
          conversationId: 'test-room-id',
          userId: 'owner-a',
          messageIds: ['a'],
          hidden: true,
        });
        await user.click(screen.getByText('Hide author for harassment a'));
        expect(mockSendData).toHaveBeenCalledWith(
          'conversations/test-room-id/users/owner-a/hide-messages',
          { reason: 'harassment' },
          undefined,
          undefined,
          'POST',
        );
      });

      it('rolls back a hide that carried a reason when the request fails', async () => {
        const user = userEvent.setup();
        await renderRoom('admin', [chatMsg('a', 1)]);
        await screen.findByText('Hide for pii a');

        mockSendData.mockResolvedValueOnce({ error: true, status: 500 });
        await user.click(screen.getByText('Hide for pii a'));
        expect(await screen.findByText(/Could not hide/)).toBeInTheDocument();
        expect(hiddenState('a')).toBe('false');
      });

      it('rolls back when the request throws and returns nothing', async () => {
        const user = userEvent.setup();
        await renderRoom('admin', [chatMsg('a', 1)]);
        await screen.findByText('Toggle hide a');

        mockSendData.mockResolvedValueOnce(undefined);
        await user.click(screen.getByText('Toggle hide a'));
        expect(await screen.findByText(/Could not hide/)).toBeInTheDocument();
        expect(hiddenState('a')).toBe('false');
      });

      it('leaves a no-op hide (empty id list) unflagged', async () => {
        const user = userEvent.setup();
        await renderRoom('admin', [chatMsg('a', 1)]);
        await screen.findByText('Toggle hide a');

        mockSendData.mockResolvedValueOnce({ conversationId: 'test-room-id', messageIds: [], hidden: true });
        await user.click(screen.getByText('Toggle hide a'));
        await waitFor(() => expect(hiddenState('a')).toBe('false'));
      });
    });
  });

  it('has no accessibility violations once loaded', async () => {
    const { container } = render(<RoomPage authType="guest" />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
