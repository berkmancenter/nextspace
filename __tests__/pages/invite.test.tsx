import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import InvitePage from '../../pages/invite';
import { ConsumeInvite, GetInvite, ResendInvite } from '../../utils/Api';
import { Api } from '../../utils/Helpers';
import SessionManager from '../../utils/SessionManager';
import { InviteDetails, InviteSession, QueryTokenState } from '../../types.internal';

const mockPush = jest.fn();
jest.mock('next/router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

let mockTokenState: QueryTokenState;
jest.mock('../../hooks/useQueryToken', () => ({
  useQueryToken: () => mockTokenState,
}));

jest.mock('../../utils/Api', () => ({
  GetInvite: jest.fn(),
  ConsumeInvite: jest.fn(),
  ResendInvite: jest.fn(),
}));
const mockGetInvite = GetInvite as jest.Mock;
const mockConsumeInvite = ConsumeInvite as jest.Mock;
const mockResendInvite = ResendInvite as jest.Mock;

const mockSetTokens = jest.fn();
jest.mock('../../utils/Helpers', () => ({
  Api: { get: jest.fn() },
}));

const mockMarkAuthenticated = jest.fn();
jest.mock('../../utils/SessionManager', () => ({
  __esModule: true,
  default: { get: jest.fn() },
}));

const newMemberInvite: InviteDetails = {
  nonce: 'nonce-1',
  member: { name: 'Ada Lovelace', hasAccount: false },
  conversation: { id: 'room-1', name: 'Lantern Lounge' },
};
const returningMemberInvite: InviteDetails = {
  ...newMemberInvite,
  member: { name: 'Ada Lovelace', hasAccount: true },
};
const session: InviteSession = {
  user: {
    id: 'user-1',
    pseudonyms: [
      { pseudonym: 'Ada Lovelace', active: false },
      { pseudonym: 'Bold Aardvark', active: true },
    ],
  },
  tokens: {
    access: { token: 'access-token', expires: '2026-10-02T12:00:00.000Z' },
    refresh: { token: 'refresh-token', expires: '2026-11-02T12:00:00.000Z' },
  },
  conversationId: 'room-1',
};

const EMAIL_PATTERN = /[^\s@]+@[^\s@]+\.[^\s@]+/;
const NEW_PASSWORD = 'newpass123';

const renderPage = async (invite: InviteDetails = newMemberInvite) => {
  mockGetInvite.mockResolvedValueOnce({ status: 'valid', invite });
  const result = render(<InvitePage />);
  await screen.findByRole('button', { name: invite.member.hasAccount ? 'Log in and join' : 'Join the room' });
  return result;
};

const submit = async (password = NEW_PASSWORD, label = 'New password') => {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText(label, { selector: 'input' }), password);
  await user.click(screen.getByRole('button', { name: /Join the room|Log in and join/ }));
  return user;
};

const renderDeadLink = async () => {
  mockGetInvite.mockResolvedValueOnce({ status: 'dead' });
  const result = render(<InvitePage />);
  await screen.findByRole('button', { name: 'Send me a new link' });
  return result;
};

describe('InvitePage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTokenState = { status: 'present', token: 'invite-token' };
    (Api.get as jest.Mock).mockReturnValue({ SetTokens: mockSetTokens });
    (SessionManager.get as jest.Mock).mockReturnValue({ markAuthenticated: mockMarkAuthenticated });
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ authType: 'user' }) });
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('on load', () => {
    it('checks the invite and fires nothing else, since mail scanners open the link first', async () => {
      await renderPage();

      expect(mockGetInvite).toHaveBeenCalledTimes(1);
      expect(mockGetInvite).toHaveBeenCalledWith('invite-token');
      expect(mockConsumeInvite).not.toHaveBeenCalled();
      expect(mockResendInvite).not.toHaveBeenCalled();
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('announces that it is checking the invite while it waits', () => {
      mockGetInvite.mockReturnValueOnce(new Promise(() => {}));
      render(<InvitePage />);

      expect(screen.getByRole('status')).toHaveTextContent('Checking your invite');
    });

    it('names the room in the page heading', async () => {
      await renderPage();

      expect(screen.getByRole('heading', { level: 1, name: 'Lantern Lounge' })).toBeInTheDocument();
    });

    it('explains a link with no token without calling the backend', () => {
      mockTokenState = { status: 'missing' };
      render(<InvitePage />);

      expect(screen.getByRole('heading', { name: 'This link is incomplete' })).toBeInTheDocument();
      expect(mockGetInvite).not.toHaveBeenCalled();
    });

    it('explains a link the backend could not read', async () => {
      mockGetInvite.mockResolvedValueOnce({ status: 'incomplete' });
      render(<InvitePage />);

      expect(await screen.findByRole('heading', { name: 'This link is incomplete' })).toBeInTheDocument();
    });

    it('offers to try again when the invite could not be checked', async () => {
      mockGetInvite
        .mockResolvedValueOnce({ status: 'error' })
        .mockResolvedValueOnce({ status: 'valid', invite: newMemberInvite });
      render(<InvitePage />);
      const user = userEvent.setup();

      await user.click(await screen.findByRole('button', { name: 'Try again' }));

      expect(await screen.findByRole('button', { name: 'Join the room' })).toBeInTheDocument();
      expect(mockGetInvite).toHaveBeenCalledTimes(2);
    });
  });

  describe('for someone without an account', () => {
    it('asks them to choose a password', async () => {
      await renderPage();

      expect(
        screen.getByRole('heading', { level: 2, name: 'Welcome to Lantern Lounge. Choose a password.' }),
      ).toBeInTheDocument();
      expect(screen.getByLabelText('New password', { selector: 'input' })).toHaveAttribute('autocomplete', 'new-password');
    });

    it('tells them their username is their email address, without showing it', async () => {
      await renderPage();

      expect(screen.getByText(/use the email address this invite was sent to as your username/)).toBeInTheDocument();
    });

    it('offers no way to switch to logging in', async () => {
      await renderPage();

      expect(screen.queryByRole('link', { name: 'Forgot password?' })).not.toBeInTheDocument();
      expect(screen.queryByText(/Log in to join/)).not.toBeInTheDocument();
    });
  });

  describe('for someone who already has an account', () => {
    it('asks only for their password', async () => {
      await renderPage(returningMemberInvite);

      expect(screen.getByRole('heading', { level: 2, name: 'Log in to join Lantern Lounge.' })).toBeInTheDocument();
      expect(screen.getByLabelText('Password', { selector: 'input' })).toHaveAttribute('autocomplete', 'current-password');
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    });

    it('links to the page for requesting a password reset', async () => {
      await renderPage(returningMemberInvite);

      expect(screen.getByRole('link', { name: 'Forgot password?' })).toHaveAttribute('href', '/forgot-password');
    });

    it('offers no way to switch to choosing a new password', async () => {
      await renderPage(returningMemberInvite);

      expect(screen.queryByText(/Choose a password/)).not.toBeInTheDocument();
      expect(screen.queryByText('Your password needs:')).not.toBeInTheDocument();
    });
  });

  describe('submitting', () => {
    it('sends the token, the nonce from the page load, and the password', async () => {
      mockConsumeInvite.mockResolvedValueOnce({ status: 'success', session });
      await renderPage();

      await submit();

      expect(mockConsumeInvite).toHaveBeenCalledWith('invite-token', 'nonce-1', NEW_PASSWORD);
    });

    it('starts a logged-in session and goes straight to the room', async () => {
      mockConsumeInvite.mockResolvedValueOnce({ status: 'success', session });
      await renderPage();

      await submit();

      await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/room/room-1'));
      expect(mockSetTokens).toHaveBeenCalledWith(
        'access-token',
        'refresh-token',
        '2026-10-02T12:00:00.000Z',
        '2026-11-02T12:00:00.000Z',
        'user-1',
      );
      const [url, request] = (global.fetch as jest.Mock).mock.calls[0];
      expect(url).toBe('/api/session');
      expect(JSON.parse(request.body)).toEqual({
        username: 'Bold Aardvark',
        userId: 'user-1',
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        accessExpires: '2026-10-02T12:00:00.000Z',
        refreshExpires: '2026-11-02T12:00:00.000Z',
        authType: 'user',
      });
      expect(mockMarkAuthenticated).toHaveBeenCalledWith('Bold Aardvark', 'user-1', 'user');
    });

    it('takes someone with an account straight to the room too', async () => {
      mockConsumeInvite.mockResolvedValueOnce({ status: 'success', session });
      await renderPage(returningMemberInvite);

      await submit('oldpass', 'Password');

      await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/room/room-1'));
    });

    it('sends them to log in, then the room, if the session cannot be saved after the invite is used', async () => {
      mockConsumeInvite.mockResolvedValueOnce({ status: 'success', session });
      (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: false, json: async () => ({ error: 'nope' }) });
      await renderPage();

      await submit();

      await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/login?redirectTo=%2Froom%2Froom-1'));
      expect(mockMarkAuthenticated).not.toHaveBeenCalled();
    });

    it('disables the button while the request is in flight, so a second tap cannot resubmit', async () => {
      mockConsumeInvite.mockReturnValueOnce(new Promise(() => {}));
      await renderPage();

      const user = await submit();
      await user.type(screen.getByLabelText('New password', { selector: 'input' }), '{Enter}');

      expect(screen.getByRole('button', { name: 'Join the room' })).toBeDisabled();
      expect(mockConsumeInvite).toHaveBeenCalledTimes(1);
    });
  });

  describe('when the submit fails', () => {
    it('says the password is incorrect and keeps the invite usable', async () => {
      mockConsumeInvite.mockResolvedValueOnce({ status: 'wrong-password' });
      await renderPage(returningMemberInvite);

      await submit('wrongpass', 'Password');

      expect(await screen.findByRole('alert')).toHaveTextContent('That password is incorrect.');
      expect(screen.getByRole('button', { name: 'Log in and join' })).toBeEnabled();
      expect(mockGetInvite).toHaveBeenCalledTimes(1);
    });

    it('quietly gets a fresh nonce and resubmits once when the nonce is stale', async () => {
      mockConsumeInvite
        .mockResolvedValueOnce({ status: 'stale-nonce' })
        .mockResolvedValueOnce({ status: 'success', session });
      await renderPage();
      mockGetInvite.mockResolvedValueOnce({ status: 'valid', invite: { ...newMemberInvite, nonce: 'nonce-2' } });

      await submit();

      await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/room/room-1'));
      expect(mockConsumeInvite).toHaveBeenLastCalledWith('invite-token', 'nonce-2', NEW_PASSWORD);
      expect(mockConsumeInvite).toHaveBeenCalledTimes(2);
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('keeps using the fresh nonce on the next submit', async () => {
      mockConsumeInvite
        .mockResolvedValueOnce({ status: 'stale-nonce' })
        .mockResolvedValueOnce({ status: 'wrong-password' })
        .mockResolvedValueOnce({ status: 'success', session });
      await renderPage(returningMemberInvite);
      mockGetInvite.mockResolvedValueOnce({ status: 'valid', invite: { ...returningMemberInvite, nonce: 'nonce-2' } });

      const user = await submit('wrongpass', 'Password');
      await screen.findByRole('alert');
      await user.click(screen.getByRole('button', { name: 'Log in and join' }));

      await waitFor(() => expect(mockConsumeInvite).toHaveBeenCalledTimes(3));
      expect(mockConsumeInvite).toHaveBeenLastCalledWith('invite-token', 'nonce-2', 'wrongpass');
    });

    it("handles the retry's own failure", async () => {
      mockConsumeInvite.mockResolvedValueOnce({ status: 'stale-nonce' }).mockResolvedValueOnce({ status: 'wrong-password' });
      await renderPage(returningMemberInvite);
      mockGetInvite.mockResolvedValueOnce({ status: 'valid', invite: { ...returningMemberInvite, nonce: 'nonce-2' } });

      await submit('wrongpass', 'Password');

      expect(await screen.findByRole('alert')).toHaveTextContent('That password is incorrect.');
    });

    it('retries only once', async () => {
      mockConsumeInvite.mockResolvedValue({ status: 'stale-nonce' });
      await renderPage();
      mockGetInvite.mockResolvedValue({ status: 'valid', invite: { ...newMemberInvite, nonce: 'nonce-2' } });

      await submit();

      expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong');
      expect(mockConsumeInvite).toHaveBeenCalledTimes(2);
    });

    it('shows the expired link screen when the fresh nonce request finds the link dead', async () => {
      mockConsumeInvite.mockResolvedValueOnce({ status: 'stale-nonce' });
      await renderPage();
      mockGetInvite.mockResolvedValueOnce({ status: 'dead' });

      await submit();

      expect(await screen.findByRole('button', { name: 'Send me a new link' })).toBeInTheDocument();
      expect(mockConsumeInvite).toHaveBeenCalledTimes(1);
    });

    it('asks them to contact the organizers when their name is already taken in the room', async () => {
      mockConsumeInvite.mockResolvedValueOnce({ status: 'name-taken' });
      await renderPage();

      await submit();

      expect(await screen.findByText(/reach out to the organizers so they can fix the name/)).toBeInTheDocument();
      expect(screen.queryByLabelText('New password', { selector: 'input' })).not.toBeInTheDocument();
    });

    it('shows the expired link screen when the link died before the submit', async () => {
      mockConsumeInvite.mockResolvedValueOnce({ status: 'dead' });
      await renderPage();

      await submit();

      expect(await screen.findByRole('heading', { name: 'This invite link has expired' })).toBeInTheDocument();
      expect(screen.queryByLabelText('New password', { selector: 'input' })).not.toBeInTheDocument();
    });

    it('shows a retry message for anything else', async () => {
      mockConsumeInvite.mockResolvedValueOnce({ status: 'error' });
      await renderPage();

      await submit();

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Something went wrong. Check your connection and try again.',
      );
      expect(screen.getByRole('button', { name: 'Join the room' })).toBeEnabled();
    });
  });

  describe('with an expired link', () => {
    it('offers a new link and always says what to do if nothing arrives', async () => {
      await renderDeadLink();

      expect(screen.getByRole('heading', { name: 'This invite link has expired' })).toBeInTheDocument();
      expect(
        screen.getByText('If nothing arrives in a few minutes, reach out to the organizers for a new link.'),
      ).toBeInTheDocument();
      expect(screen.queryByLabelText(/password/i, { selector: 'input' })).not.toBeInTheDocument();
    });

    it('asks for a new link once, then says the same thing whether or not one was sent', async () => {
      mockResendInvite.mockResolvedValueOnce({ status: 'accepted' });
      await renderDeadLink();
      const user = userEvent.setup();
      const button = screen.getByRole('button', { name: 'Send me a new link' });

      await user.click(button);
      await user.click(button);

      expect(
        await screen.findByText("If this link was valid, we've sent a new one to the address it came to."),
      ).toBeInTheDocument();
      expect(button).toBeDisabled();
      expect(mockResendInvite).toHaveBeenCalledTimes(1);
      expect(mockResendInvite).toHaveBeenCalledWith('invite-token');
      expect(screen.getByRole('link', { name: 'log in' })).toHaveAttribute('href', '/login');
      expect(
        screen.getByText('If nothing arrives in a few minutes, reach out to the organizers for a new link.'),
      ).toBeInTheDocument();
    });

    it('lets them try again if the request never reached the server', async () => {
      mockResendInvite.mockResolvedValueOnce({ status: 'error' });
      await renderDeadLink();
      const user = userEvent.setup();

      await user.click(screen.getByRole('button', { name: 'Send me a new link' }));

      expect(await screen.findByRole('alert')).toHaveTextContent("We couldn't send your request");
      expect(screen.getByRole('button', { name: 'Send me a new link' })).toBeEnabled();
    });
  });

  describe('privacy', () => {
    it('never shows an email address in any state', async () => {
      mockConsumeInvite.mockResolvedValueOnce({ status: 'name-taken' });
      const { unmount } = await renderPage();
      expect(document.body.textContent).not.toMatch(EMAIL_PATTERN);
      await submit();
      await screen.findByText(/reach out to the organizers/);
      expect(document.body.textContent).not.toMatch(EMAIL_PATTERN);
      unmount();

      await renderPage(returningMemberInvite);
      expect(document.body.textContent).not.toMatch(EMAIL_PATTERN);
    });
  });

  describe('accessibility', () => {
    it('has no violations when choosing a password', async () => {
      const { container } = await renderPage();

      expect(await axe(container)).toHaveNoViolations();
    });

    it('has no violations when logging in, with an error showing', async () => {
      mockConsumeInvite.mockResolvedValueOnce({ status: 'wrong-password' });
      const { container } = await renderPage(returningMemberInvite);
      await submit('wrongpass', 'Password');
      await screen.findByRole('alert');

      expect(await axe(container)).toHaveNoViolations();
    });

    it('has no violations on the expired link screen after asking for a new link', async () => {
      mockResendInvite.mockResolvedValueOnce({ status: 'accepted' });
      const { container } = await renderDeadLink();
      await userEvent.setup().click(screen.getByRole('button', { name: 'Send me a new link' }));
      await screen.findByText(/we've sent a new one/);

      expect(await axe(container)).toHaveNoViolations();
    });

    it('moves focus to the new message when the form is replaced', async () => {
      mockConsumeInvite.mockResolvedValueOnce({ status: 'name-taken' });
      await renderPage();

      await submit();

      await waitFor(() =>
        expect(screen.getByRole('heading', { name: "We couldn't finish setting up your account" })).toHaveFocus(),
      );
    });
  });
});
