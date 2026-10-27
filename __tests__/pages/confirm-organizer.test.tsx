import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ConfirmOrganizerPage from '../../pages/confirm-organizer';
import { ConfirmOrganizer, GetOrganizerConfirmation } from '../../utils/Api';
import { OrganizerConfirmationDetails, QueryTokenState } from '../../types.internal';

let mockTokenState: QueryTokenState;
jest.mock('../../hooks/useQueryToken', () => ({
  useQueryToken: () => mockTokenState,
}));

jest.mock('../../utils/Api', () => ({
  GetOrganizerConfirmation: jest.fn(),
  ConfirmOrganizer: jest.fn(),
}));
const mockGetConfirmation = GetOrganizerConfirmation as jest.Mock;
const mockConfirmOrganizer = ConfirmOrganizer as jest.Mock;

const SCHEDULED_TIME = '2026-11-03T16:00:00.000Z';
const confirmation: OrganizerConfirmationDetails = {
  nonce: 'nonce-1',
  conversation: { id: 'conv-1', name: 'Office Hours', scheduledTime: SCHEDULED_TIME },
};
// Mirrors the component's own formatDateTime, so the assertion holds regardless of the machine's time zone.
const formattedScheduledTime = new Date(SCHEDULED_TIME).toLocaleString([], {
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

const renderPage = async (details: OrganizerConfirmationDetails = confirmation) => {
  mockGetConfirmation.mockResolvedValueOnce({ status: 'valid', confirmation: details });
  const result = render(<ConfirmOrganizerPage />);
  await screen.findByRole('button', { name: 'Confirm' });
  return result;
};

const confirm = async () => {
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'Confirm' }));
  return user;
};

describe('ConfirmOrganizerPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTokenState = { status: 'present', token: 'confirm-token' };
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('on load', () => {
    it('checks the confirmation link and fires nothing else, since mail scanners open the link first', async () => {
      await renderPage();

      expect(mockGetConfirmation).toHaveBeenCalledTimes(1);
      expect(mockGetConfirmation).toHaveBeenCalledWith('confirm-token');
      expect(mockConfirmOrganizer).not.toHaveBeenCalled();
    });

    it('announces that it is checking the link while it waits', () => {
      mockGetConfirmation.mockReturnValueOnce(new Promise(() => {}));
      render(<ConfirmOrganizerPage />);

      expect(screen.getByRole('status')).toHaveTextContent('Checking your confirmation link');
    });

    it('asks for confirmation naming the event and its scheduled time', async () => {
      await renderPage();

      expect(
        screen.getByRole('heading', { name: `Confirm you're hosting “Office Hours” on ${formattedScheduledTime}?` }),
      ).toBeInTheDocument();
    });

    it('asks for confirmation with no date clause when the event has no scheduled time yet', async () => {
      await renderPage({ ...confirmation, conversation: { ...confirmation.conversation, scheduledTime: undefined } });

      expect(screen.getByRole('heading', { name: "Confirm you're hosting “Office Hours”?" })).toBeInTheDocument();
    });

    it('does not auto-submit on load, since mail scanners pre-fetch the link with a GET', async () => {
      await renderPage();

      expect(mockConfirmOrganizer).not.toHaveBeenCalled();
    });

    it('shows the link-is-dead state, not an error, for an expired or already-used link', async () => {
      mockGetConfirmation.mockResolvedValueOnce({ status: 'dead' });
      render(<ConfirmOrganizerPage />);

      expect(await screen.findByRole('heading', { name: "This link isn't valid" })).toBeInTheDocument();
    });

    it('explains a link with no token without calling the backend', () => {
      mockTokenState = { status: 'missing' };
      render(<ConfirmOrganizerPage />);

      expect(screen.getByRole('heading', { name: 'This link is incomplete' })).toBeInTheDocument();
      expect(mockGetConfirmation).not.toHaveBeenCalled();
    });

    it('explains a link the backend could not read', async () => {
      mockGetConfirmation.mockResolvedValueOnce({ status: 'incomplete' });
      render(<ConfirmOrganizerPage />);

      expect(await screen.findByRole('heading', { name: 'This link is incomplete' })).toBeInTheDocument();
    });

    it('offers to try again when the link could not be checked', async () => {
      mockGetConfirmation
        .mockResolvedValueOnce({ status: 'error' })
        .mockResolvedValueOnce({ status: 'valid', confirmation });
      render(<ConfirmOrganizerPage />);
      const user = userEvent.setup();

      await user.click(await screen.findByRole('button', { name: 'Try again' }));

      expect(await screen.findByRole('button', { name: 'Confirm' })).toBeInTheDocument();
      expect(mockGetConfirmation).toHaveBeenCalledTimes(2);
    });
  });

  describe('on confirm', () => {
    it('posts the token and the nonce from the load check', async () => {
      mockConfirmOrganizer.mockResolvedValueOnce({ status: 'success', result: { conversationId: 'conv-1', draft: false } });
      await renderPage();

      await confirm();

      expect(mockConfirmOrganizer).toHaveBeenCalledWith('confirm-token', 'nonce-1');
    });

    it('shows success once confirmed', async () => {
      mockConfirmOrganizer.mockResolvedValueOnce({ status: 'success', result: { conversationId: 'conv-1', draft: false } });
      await renderPage();

      await confirm();

      expect(await screen.findByRole('heading', { name: "You're confirmed as the organizer" })).toBeInTheDocument();
      expect(screen.getByText('This event is ready to go.')).toBeInTheDocument();
    });

    it('mentions missing details when the confirmed event is still a draft', async () => {
      mockConfirmOrganizer.mockResolvedValueOnce({ status: 'success', result: { conversationId: 'conv-1', draft: true } });
      await renderPage();

      await confirm();

      expect(await screen.findByText(/still needs a few more details/i)).toBeInTheDocument();
    });

    it('shows an error and stays confirmable when the submit fails outright', async () => {
      mockConfirmOrganizer.mockResolvedValueOnce({ status: 'error' });
      await renderPage();

      await confirm();

      expect(await screen.findByRole('alert')).toHaveTextContent("We couldn't confirm you as the organizer.");
      expect(screen.getByRole('button', { name: 'Confirm' })).toBeEnabled();
    });

    it('quietly gets a fresh nonce and retries once when the nonce is stale', async () => {
      mockConfirmOrganizer
        .mockResolvedValueOnce({ status: 'stale-nonce' })
        .mockResolvedValueOnce({ status: 'success', result: { conversationId: 'conv-1', draft: false } });
      await renderPage();
      mockGetConfirmation.mockResolvedValueOnce({
        status: 'valid',
        confirmation: { ...confirmation, nonce: 'nonce-2' },
      });

      await confirm();

      expect(await screen.findByRole('heading', { name: "You're confirmed as the organizer" })).toBeInTheDocument();
      expect(mockConfirmOrganizer).toHaveBeenLastCalledWith('confirm-token', 'nonce-2');
      expect(mockConfirmOrganizer).toHaveBeenCalledTimes(2);
      expect(screen.queryByText(/couldn't confirm you as the organizer/i)).not.toBeInTheDocument();
    });

    it('retries only once', async () => {
      mockConfirmOrganizer.mockResolvedValue({ status: 'stale-nonce' });
      await renderPage();
      mockGetConfirmation.mockResolvedValue({ status: 'valid', confirmation: { ...confirmation, nonce: 'nonce-2' } });

      await confirm();

      expect(await screen.findByRole('alert')).toHaveTextContent("We couldn't confirm you as the organizer.");
      expect(mockConfirmOrganizer).toHaveBeenCalledTimes(2);
    });

    it('shows the link-is-dead state when the fresh nonce request finds the link dead', async () => {
      mockConfirmOrganizer.mockResolvedValueOnce({ status: 'stale-nonce' });
      await renderPage();
      mockGetConfirmation.mockResolvedValueOnce({ status: 'dead' });

      await confirm();

      expect(await screen.findByRole('heading', { name: "This link isn't valid" })).toBeInTheDocument();
      expect(mockConfirmOrganizer).toHaveBeenCalledTimes(1);
    });

    it('shows the link-is-dead state when confirming finds it already confirmed or expired', async () => {
      mockConfirmOrganizer.mockResolvedValueOnce({ status: 'dead' });
      await renderPage();

      await confirm();

      expect(await screen.findByRole('heading', { name: "This link isn't valid" })).toBeInTheDocument();
    });

    it('disables the button while the confirmation request is in flight', async () => {
      mockConfirmOrganizer.mockReturnValueOnce(new Promise(() => {}));
      await renderPage();

      await confirm();

      expect(screen.getByRole('button', { name: 'Confirm' })).toBeDisabled();
    });
  });

  it('ignores a retried check that finishes after the page has moved on to a newer link', async () => {
    let finishRetry: (result: unknown) => void = () => {};
    mockGetConfirmation
      .mockResolvedValueOnce({ status: 'error' })
      .mockReturnValueOnce(new Promise((resolve) => (finishRetry = resolve)))
      .mockResolvedValueOnce({
        status: 'valid',
        confirmation: { ...confirmation, conversation: { ...confirmation.conversation, name: 'Second Event' } },
      });
    const { rerender } = render(<ConfirmOrganizerPage />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Try again' }));

    mockTokenState = { status: 'present', token: 'newer-token' };
    rerender(<ConfirmOrganizerPage />);
    await screen.findByText(/Second Event/);
    finishRetry({ status: 'valid', confirmation });

    await waitFor(() => expect(mockGetConfirmation).toHaveBeenCalledTimes(3));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(screen.getByText(/Second Event/)).toBeInTheDocument();
  });
});
