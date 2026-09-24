import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import ResetPasswordPage from '../../pages/reset-password';
import { ResetPassword } from '../../utils/Api';
import { QueryTokenState } from '../../types.internal';

const mockPush = jest.fn();
jest.mock('next/router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

let mockTokenState: QueryTokenState;
jest.mock('../../hooks/useQueryToken', () => ({
  useQueryToken: () => mockTokenState,
}));

jest.mock('../../utils/Api', () => ({
  ResetPassword: jest.fn(),
}));
const mockResetPassword = ResetPassword as jest.Mock;

const submitPassword = async (password = 'newpass123') => {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('New password', { selector: 'input' }), password);
  await user.click(screen.getByRole('button', { name: 'Reset password' }));
};

describe('ResetPasswordPage', () => {
  beforeEach(() => {
    mockPush.mockReset();
    mockResetPassword.mockReset();
    mockTokenState = { status: 'present', token: 'reset-token' };
  });

  it('shows the new password form when the link has a token', () => {
    render(<ResetPasswordPage />);

    expect(screen.getByRole('heading', { name: 'Choose a new password' })).toBeInTheDocument();
  });

  it('sends the token and new password, then sends the person to log in', async () => {
    mockResetPassword.mockResolvedValue({ status: 'success' });
    render(<ResetPasswordPage />);

    await submitPassword();

    expect(mockResetPassword).toHaveBeenCalledWith('reset-token', 'newpass123');
    expect(mockPush).toHaveBeenCalledWith('/login?passwordReset=1');
  });

  it('explains an expired or used link instead of showing the form', async () => {
    mockResetPassword.mockResolvedValue({ status: 'invalid-token' });
    render(<ResetPasswordPage />);

    await submitPassword();

    expect(await screen.findByText(/This link has expired or has already been used/)).toBeInTheDocument();
    expect(screen.queryByLabelText('New password', { selector: 'input' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to log in' })).toHaveAttribute('href', '/login');
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('explains a link with no token', () => {
    mockTokenState = { status: 'missing' };
    render(<ResetPasswordPage />);

    expect(screen.getByText(/This link is incomplete/)).toBeInTheDocument();
    expect(screen.queryByLabelText('New password', { selector: 'input' })).not.toBeInTheDocument();
  });

  it('shows the reason the backend rejected the password', async () => {
    mockResetPassword.mockResolvedValue({ status: 'rejected', message: 'Password must be at least 8 characters.' });
    render(<ResetPasswordPage />);

    await submitPassword();

    expect(await screen.findByRole('alert')).toHaveTextContent('Password must be at least 8 characters.');
  });

  it('shows a plain retry message when something else goes wrong', async () => {
    mockResetPassword.mockResolvedValue({ status: 'error' });
    render(<ResetPasswordPage />);

    await submitPassword();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "We couldn't reset your password. Check your connection and try again.",
    );
  });

  it('has no accessibility violations on the expired link message', async () => {
    mockTokenState = { status: 'missing' };
    const { container } = render(<ResetPasswordPage />);

    expect(await axe(container)).toHaveNoViolations();
  });
});
