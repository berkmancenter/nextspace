import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import ForgotPasswordPage from '../../pages/forgot-password';
import { RequestPasswordReset } from '../../utils/Api';

jest.mock('../../utils/Api', () => ({
  RequestPasswordReset: jest.fn(),
}));
const mockRequestPasswordReset = RequestPasswordReset as jest.Mock;

const CONFIRMATION = "If an account uses that address, we've sent it a link to choose a new password.";

const requestReset = async (email = 'ada@example.com') => {
  const user = userEvent.setup();
  if (email) await user.type(screen.getByLabelText('Email address', { selector: 'input' }), email);
  await user.click(screen.getByRole('button', { name: 'Send reset link' }));
  return user;
};

describe('ForgotPasswordPage', () => {
  beforeEach(() => {
    mockRequestPasswordReset.mockReset();
  });

  it('asks for the email address with a labelled field', () => {
    render(<ForgotPasswordPage />);

    expect(screen.getByRole('heading', { level: 2, name: 'Forgot your password?' })).toBeInTheDocument();
    const field = screen.getByLabelText('Email address', { selector: 'input' });
    expect(field).toHaveAttribute('type', 'email');
    expect(field).toHaveAttribute('autocomplete', 'email');
  });

  it('sends the address the person typed, without surrounding spaces', async () => {
    mockRequestPasswordReset.mockResolvedValueOnce({ status: 'sent' });
    render(<ForgotPasswordPage />);

    await requestReset('  ada@example.com ');

    expect(mockRequestPasswordReset).toHaveBeenCalledWith('ada@example.com');
  });

  it('shows one confirmation whether or not an account uses the address, and announces it', async () => {
    mockRequestPasswordReset.mockResolvedValueOnce({ status: 'sent' });
    render(<ForgotPasswordPage />);

    await requestReset();

    const confirmation = await screen.findByRole('status');
    expect(confirmation).toHaveTextContent(CONFIRMATION);
    await waitFor(() => expect(confirmation).toHaveFocus());
    expect(screen.queryByLabelText('Email address', { selector: 'input' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to log in' })).toHaveAttribute('href', '/login');
  });

  it('asks for an address instead of sending an empty one', async () => {
    render(<ForgotPasswordPage />);

    await requestReset('');

    expect(mockRequestPasswordReset).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('Enter your email address.');
    expect(screen.getByLabelText('Email address', { selector: 'input' })).toHaveFocus();
  });

  it('asks for a valid address when the backend rejects it', async () => {
    mockRequestPasswordReset.mockResolvedValueOnce({ status: 'invalid-email' });
    render(<ForgotPasswordPage />);

    await requestReset('ada');

    expect(await screen.findByRole('alert')).toHaveTextContent('Enter a valid email address.');
    expect(screen.getByLabelText('Email address', { selector: 'input' })).toHaveAccessibleDescription(
      'Enter a valid email address.',
    );
  });

  it('lets them try again when the request fails', async () => {
    mockRequestPasswordReset.mockResolvedValueOnce({ status: 'error' });
    render(<ForgotPasswordPage />);

    await requestReset();

    expect(await screen.findByRole('alert')).toHaveTextContent("We couldn't send your request");
    expect(screen.getByRole('button', { name: 'Send reset link' })).toBeEnabled();
  });

  it('disables the button while the request is in flight', async () => {
    mockRequestPasswordReset.mockReturnValueOnce(new Promise(() => {}));
    render(<ForgotPasswordPage />);

    await requestReset();

    expect(screen.getByRole('button', { name: 'Send reset link' })).toBeDisabled();
  });

  it('has no accessibility violations while showing an error', async () => {
    const { container } = render(<ForgotPasswordPage />);

    await requestReset('');

    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no accessibility violations on the confirmation', async () => {
    mockRequestPasswordReset.mockResolvedValueOnce({ status: 'sent' });
    const { container } = render(<ForgotPasswordPage />);

    await requestReset();
    await screen.findByRole('status');

    expect(await axe(container)).toHaveNoViolations();
  });
});
