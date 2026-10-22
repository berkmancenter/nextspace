import { renderHook, act } from '@testing-library/react';
import { useState } from 'react';

jest.mock('../../utils', () => ({
  SendData: jest.fn(),
}));

import { SendData } from '../../utils';
import { useMessageModeration } from '../../hooks/useMessageModeration';
import type { PseudonymousMessage } from '../../types.internal';

const mockSendData = SendData as jest.Mock;

const msg = (id: string, extra: Record<string, any> = {}) =>
  ({ id, owner: 'owner-1', body: `msg ${id}`, createdAt: '2026-01-01T00:00:00.000Z', ...extra }) as PseudonymousMessage;

function makeSocket() {
  const handlers: Record<string, Function> = {};
  return {
    handlers,
    on: jest.fn((event: string, fn: Function) => {
      handlers[event] = fn;
    }),
    off: jest.fn(),
  };
}

function setup(
  opts: {
    isAdmin?: boolean;
    userId?: string | null;
    chat?: PseudonymousMessage[];
    assistant?: PseudonymousMessage[];
    socket?: ReturnType<typeof makeSocket> | null;
  } = {},
) {
  const socket = opts.socket === undefined ? makeSocket() : opts.socket;
  const pendingHiddenRef = { current: new Map<string, boolean>() };
  const view = renderHook(() => {
    const [chatMessages, setChatMessages] = useState<PseudonymousMessage[]>(opts.chat ?? []);
    const [assistantMessages, setAssistantMessages] = useState<PseudonymousMessage[]>(opts.assistant ?? []);
    const moderation = useMessageModeration({
      socket: socket as any,
      userId: opts.userId === undefined ? 'viewer-1' : opts.userId,
      conversationId: 'conv-1',
      isAdmin: opts.isAdmin ?? false,
      chatMessages,
      setChatMessages,
      setAssistantMessages,
      pendingHiddenRef,
    });
    return { ...moderation, chatMessages, assistantMessages };
  });
  return { ...view, socket, pendingHiddenRef };
}

const hiddenOf = (messages: PseudonymousMessage[], id: string) => Boolean(messages.find((m) => m.id === id)?.hidden);

describe('useMessageModeration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('controls', () => {
    it('offers no controls to a non-admin, a signed-out viewer or an unreadable account', () => {
      expect(setup({ isAdmin: false }).result.current.moderation).toBeUndefined();
      expect(setup({ isAdmin: false, userId: null, socket: null }).result.current.moderation).toBeUndefined();
    });

    it('offers controls to an admin', () => {
      expect(setup({ isAdmin: true }).result.current.moderation).toBeDefined();
    });

    it('does not throw without a socket', () => {
      expect(() => setup({ isAdmin: true, socket: null })).not.toThrow();
    });

    it('reports an author as hidden only when every one of their messages is', () => {
      const { result } = setup({
        isAdmin: true,
        chat: [msg('a', { hidden: true }), msg('b', { hidden: true }), msg('c', { owner: 'owner-2' })],
      });
      expect(result.current.moderation!.isAuthorHidden(msg('a'))).toBe(true);
      expect(result.current.moderation!.isAuthorHidden(msg('c', { owner: 'owner-2' }))).toBe(false);
    });
  });

  describe('socket events', () => {
    it('registers both listeners and removes them on unmount', () => {
      const { socket, unmount } = setup();
      expect(socket!.on).toHaveBeenCalledWith('message:hidden', expect.any(Function));
      expect(socket!.on).toHaveBeenCalledWith('message:hidden-notice', expect.any(Function));
      unmount();
      expect(socket!.off).toHaveBeenCalledWith('message:hidden', expect.any(Function));
      expect(socket!.off).toHaveBeenCalledWith('message:hidden-notice', expect.any(Function));
    });

    it('applies message:hidden to both lists', () => {
      const { result, socket } = setup({
        isAdmin: true,
        chat: [msg('a'), msg('b')],
        assistant: [msg('x')],
      });
      act(() => socket!.handlers['message:hidden']({ messageIds: ['a', 'x'], hidden: true, display: 'omit' }));
      expect(hiddenOf(result.current.chatMessages, 'a')).toBe(true);
      expect(hiddenOf(result.current.chatMessages, 'b')).toBe(false);
      expect(hiddenOf(result.current.assistantMessages, 'x')).toBe(true);
    });

    it('drops a hidden message for a participant but keeps the author their own', () => {
      const { result, socket } = setup({
        userId: 'owner-1',
        chat: [msg('mine'), msg('theirs', { owner: 'owner-2' })],
      });
      act(() => socket!.handlers['message:hidden']({ messageIds: ['mine', 'theirs'], hidden: true, display: 'omit' }));
      expect(result.current.chatMessages.map((m) => m.id)).toEqual(['mine']);
    });

    it('shows the author notice only for this conversation', () => {
      const { result, socket } = setup();
      act(() => socket!.handlers['message:hidden-notice']({ conversationId: 'other', scope: 'user', messageIds: [] }));
      expect(result.current.toast).toBeNull();
      act(() => socket!.handlers['message:hidden-notice'](undefined));
      expect(result.current.toast).toBeNull();

      act(() =>
        socket!.handlers['message:hidden-notice']({ conversationId: 'conv-1', scope: 'message', messageIds: ['a'] }),
      );
      expect(result.current.toast).toEqual({
        severity: 'info',
        text: 'A moderator has limited the visibility of your message(s).',
      });
      act(() => result.current.clearToast());
      expect(result.current.toast).toBeNull();
    });
  });

  describe('acting as an admin', () => {
    it('hides at once, then settles on the ids the server reports', async () => {
      mockSendData.mockResolvedValueOnce({ conversationId: 'conv-1', messageIds: ['a', 'r'], hidden: true });
      const { result, pendingHiddenRef } = setup({ isAdmin: true, chat: [msg('a'), msg('r', { parentMessage: 'a' })] });

      act(() => {
        result.current.moderation!.onToggleHidden(msg('a'), 'off-topic');
      });
      expect(hiddenOf(result.current.chatMessages, 'a')).toBe(true);
      expect(pendingHiddenRef.current.get('a')).toBe(true);
      await act(async () => {
        await Promise.resolve();
      });

      expect(mockSendData).toHaveBeenCalledWith('messages/a/hide', { reason: 'off-topic' }, undefined, undefined, 'POST');
      expect(hiddenOf(result.current.chatMessages, 'r')).toBe(true);
      expect(pendingHiddenRef.current.size).toBe(0);
    });

    it('puts a hide back and reports it when the server refuses', async () => {
      mockSendData.mockResolvedValueOnce({ error: 'nope' });
      const { result } = setup({ isAdmin: true, chat: [msg('a')] });

      await act(async () => {
        result.current.moderation!.onToggleHidden(msg('a'));
      });

      expect(hiddenOf(result.current.chatMessages, 'a')).toBe(false);
      expect(result.current.toast).toEqual({ severity: 'error', text: 'Could not hide the message(s). Try again.' });
    });

    it('unhides with a DELETE and no body', async () => {
      mockSendData.mockResolvedValueOnce({ conversationId: 'conv-1', messageIds: ['a'], hidden: false });
      const { result } = setup({ isAdmin: true, chat: [msg('a', { hidden: true })] });

      await act(async () => {
        result.current.moderation!.onToggleHidden(msg('a', { hidden: true }));
      });

      expect(mockSendData).toHaveBeenCalledWith('messages/a/hide', undefined, undefined, undefined, 'DELETE');
      expect(hiddenOf(result.current.chatMessages, 'a')).toBe(false);
    });

    it('puts back a guessed hide the server reports as unchanged', async () => {
      mockSendData.mockResolvedValueOnce({ conversationId: 'conv-1', messageIds: [], hidden: true });
      const { result } = setup({ isAdmin: true, chat: [msg('a')] });

      await act(async () => {
        result.current.moderation!.onToggleHidden(msg('a'));
      });

      expect(hiddenOf(result.current.chatMessages, 'a')).toBe(false);
    });

    it('hides every visible message from an author in one request', async () => {
      mockSendData.mockResolvedValueOnce({ conversationId: 'conv-1', messageIds: ['a', 'b'], hidden: true });
      const { result } = setup({
        isAdmin: true,
        chat: [msg('a'), msg('b'), msg('c', { owner: 'owner-2' }), msg('d', { hidden: true })],
      });

      await act(async () => {
        result.current.moderation!.onToggleHideAuthor(msg('a'), false, 'harassment');
      });

      expect(mockSendData).toHaveBeenCalledWith(
        'conversations/conv-1/users/owner-1/hide-messages',
        { reason: 'harassment' },
        undefined,
        undefined,
        'POST',
      );
      expect(hiddenOf(result.current.chatMessages, 'b')).toBe(true);
      expect(hiddenOf(result.current.chatMessages, 'c')).toBe(false);
    });

    it('lets a stale response not undo a newer action on the same message', async () => {
      let rejectFirst!: (v: unknown) => void;
      mockSendData
        .mockReturnValueOnce(new Promise((resolve) => (rejectFirst = resolve)))
        .mockResolvedValueOnce({ conversationId: 'conv-1', messageIds: ['a'], hidden: false });
      const { result, pendingHiddenRef } = setup({ isAdmin: true, chat: [msg('a')] });

      // Hide (slow), then unhide before it answers.
      act(() => {
        result.current.moderation!.onToggleHidden(msg('a'));
      });
      expect(hiddenOf(result.current.chatMessages, 'a')).toBe(true);
      await act(async () => {
        result.current.moderation!.onToggleHidden(msg('a', { hidden: true }));
      });
      expect(hiddenOf(result.current.chatMessages, 'a')).toBe(false);
      expect(pendingHiddenRef.current.size).toBe(0);

      // The first request now fails; reverting it would hide the message again.
      await act(async () => {
        rejectFirst({ error: 'late failure' });
      });
      expect(hiddenOf(result.current.chatMessages, 'a')).toBe(false);
    });
  });
});
