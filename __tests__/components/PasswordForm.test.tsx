import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { PasswordForm } from '../../components/PasswordForm';

const renderForm = (onSubmit = jest.fn().mockResolvedValue(undefined)) => {
  render(<PasswordForm heading="Choose a new password" submitLabel="Reset password" onSubmit={onSubmit} />);
  return { onSubmit, passwordField: screen.getByLabelText('New password', { selector: 'input' }) };
};

describe('PasswordForm', () => {
  it('shows the heading and the password rules before anything is typed', () => {
    renderForm();

    expect(screen.getByRole('heading', { name: 'Choose a new password' })).toBeInTheDocument();
    expect(screen.getByText('At least 8 characters')).toBeInTheDocument();
    expect(screen.getByText('At least 1 letter and 1 number')).toBeInTheDocument();
  });

  it('uses a second-level heading, since the site header holds the page h1', () => {
    renderForm();

    expect(screen.getByRole('heading', { level: 2, name: 'Choose a new password' })).toBeInTheDocument();
  });

  it('describes the password field with the rules', () => {
    const { passwordField } = renderForm();

    expect(passwordField).toHaveAccessibleDescription(/At least 8 characters/);
  });

  it('marks the field for password managers to fill a new password', () => {
    const { passwordField } = renderForm();

    expect(passwordField).toHaveAttribute('autocomplete', 'new-password');
    expect(passwordField).toHaveAttribute('type', 'password');
  });

  it('accepts a pasted password', async () => {
    const user = userEvent.setup();
    const { passwordField } = renderForm();

    await user.click(passwordField);
    await user.paste('pasted123');

    expect(passwordField).toHaveValue('pasted123');
  });

  it('shows and hides the password', async () => {
    const user = userEvent.setup();
    const { passwordField } = renderForm();

    await user.click(screen.getByRole('button', { name: 'Show password' }));
    expect(passwordField).toHaveAttribute('type', 'text');

    await user.click(screen.getByRole('button', { name: 'Hide password' }));
    expect(passwordField).toHaveAttribute('type', 'password');
  });

  it('submits a password that meets the rules', async () => {
    const user = userEvent.setup();
    const { onSubmit, passwordField } = renderForm();

    await user.type(passwordField, 'newpass123');
    await user.click(screen.getByRole('button', { name: 'Reset password' }));

    expect(onSubmit).toHaveBeenCalledWith('newpass123');
  });

  it('blocks a password that breaks a rule and announces which rule', async () => {
    const user = userEvent.setup();
    const { onSubmit, passwordField } = renderForm();

    await user.type(passwordField, 'short1');
    await user.click(screen.getByRole('button', { name: 'Reset password' }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('Password needs: at least 8 characters.');
    expect(passwordField).toHaveAttribute('aria-invalid', 'true');
    expect(passwordField).toHaveAccessibleDescription(/Password needs: at least 8 characters\./);
    expect(passwordField).toHaveFocus();
  });

  it('shows the error message the submit handler returns', async () => {
    const user = userEvent.setup();
    const { passwordField } = renderForm(jest.fn().mockResolvedValue('That did not work.'));

    await user.type(passwordField, 'newpass123');
    await user.click(screen.getByRole('button', { name: 'Reset password' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('That did not work.');
  });

  it('re-enables the submit button when the handler returns an error', async () => {
    const user = userEvent.setup();
    let finish: (message: string) => void = () => {};
    const { passwordField } = renderForm(jest.fn(() => new Promise<string>((resolve) => (finish = resolve))));

    await user.type(passwordField, 'newpass123');
    await user.click(screen.getByRole('button', { name: 'Reset password' }));

    expect(screen.getByRole('button', { name: 'Reset password' })).toBeDisabled();
    finish('Try again.');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Reset password' })).toBeEnabled());
  });

  it('keeps the submit button disabled after the handler succeeds, so a second tap cannot resubmit', async () => {
    const user = userEvent.setup();
    const { onSubmit, passwordField } = renderForm(jest.fn().mockResolvedValue(undefined));

    await user.type(passwordField, 'newpass123');
    await user.click(screen.getByRole('button', { name: 'Reset password' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(screen.getByRole('button', { name: 'Reset password' })).toBeDisabled();
  });

  it('has no accessibility violations', async () => {
    const { container } = render(
      <PasswordForm heading="Choose a new password" submitLabel="Reset password" onSubmit={jest.fn()} />,
    );

    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no accessibility violations while showing an error', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <PasswordForm heading="Choose a new password" submitLabel="Reset password" onSubmit={jest.fn()} />,
    );

    await user.click(screen.getByRole('button', { name: 'Reset password' }));

    expect(await axe(container)).toHaveNoViolations();
  });
});
