import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
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
const mockEmitWithTokenRefresh = jest.fn((socket, event, data, onSuccess) => onSuccess());

jest.mock('../../utils', () => ({
  Api: {
    get: jest.fn(() => ({
      GetTokens: jest.fn(() => ({ access: 'mock-access-token' })),
      getAccessToken: jest.fn(() => 'mock-access-token'),
    })),
  },
  RetrieveData: jest.fn(),
  SendData: (...args: any[]) => mockSendData(...args),
  emitWithTokenRefresh: (...args: any[]) => mockEmitWithTokenRefresh(...args),
  getPollResponseCounts: jest.fn(),
  inspectPoll: jest.fn(),
}));

jest.mock('../../components/room/CommunityGroupChatPanel', () => ({
  CommunityGroupChatPanel: ({ messages, realName, onSendMessage }: any) => (
    <div data-testid="group-chat-panel" data-real-name={realName}>
      {messages.map((m: any) => (
        <div key={m.id}>{typeof m.body === 'string' ? m.body : m.body?.text}</div>
      ))}
      <button onClick={() => onSendMessage('hello room')}>Send group message</button>
    </div>
  ),
}));

jest.mock('../../components/room/CommunityAssistantPanel', () => ({
  CommunityAssistantPanel: ({ messages, onSendMessage }: any) => (
    <div data-testid="assistant-panel">
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

  it('shows the room name and a LIVE badge in the header on the group tab', () => {
    render(<RoomPage authType="guest" />);
    expect(screen.getByText('BKC Community Room')).toBeInTheDocument();
    expect(screen.getByText('LIVE')).toBeInTheDocument();
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

  it('has no accessibility violations once loaded', async () => {
    const { container } = render(<RoomPage authType="guest" />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
