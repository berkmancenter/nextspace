import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { ModerationControls } from '../../components/ModerationControls';
import { PseudonymousMessage } from '../../types.internal';

const message = (extra: Record<string, unknown> = {}) =>
  ({ id: 'm1', owner: 'owner-1', fromAgent: false, body: { text: 'hi' }, ...extra }) as PseudonymousMessage;

const setup = (msg = message(), authorHidden = false) => {
  const moderation = {
    onToggleHidden: jest.fn(),
    onToggleHideAuthor: jest.fn(),
    isAuthorHidden: jest.fn(() => authorHidden),
  };
  const user = userEvent.setup();
  const utils = render(<ModerationControls message={msg} moderation={moderation} />);
  return { moderation, user, ...utils };
};

const REASONS: [string, string][] = [
  ['Personal information', 'pii'],
  ['Harassment', 'harassment'],
  ['Off-topic', 'off-topic'],
  ['Other', 'other'],
];

describe('ModerationControls reason picker', () => {
  it('offers every reason plus Skip when hiding a message', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: 'Hide' }));
    const names = screen.getAllByRole('menuitem').map((i) => i.textContent);
    expect(names).toEqual(['Personal information', 'Harassment', 'Off-topic', 'Other', 'Skip']);
  });

  it.each(REASONS)('hides a message with the reason "%s"', async (label, value) => {
    const { user, moderation } = setup();
    await user.click(screen.getByRole('button', { name: 'Hide' }));
    await user.click(screen.getByRole('menuitem', { name: label }));
    expect(moderation.onToggleHidden).toHaveBeenCalledTimes(1);
    expect(moderation.onToggleHidden).toHaveBeenCalledWith(expect.objectContaining({ id: 'm1' }), value);
  });

  it.each(REASONS)('hides all from a user with the reason "%s"', async (label, value) => {
    const { user, moderation } = setup();
    await user.click(screen.getByRole('button', { name: 'Hide all from this user' }));
    await user.click(screen.getByRole('menuitem', { name: label }));
    expect(moderation.onToggleHideAuthor).toHaveBeenCalledWith(expect.objectContaining({ id: 'm1' }), false, value);
  });

  it('Skip hides with no reason', async () => {
    const { user, moderation } = setup();
    await user.click(screen.getByRole('button', { name: 'Hide' }));
    await user.click(screen.getByRole('menuitem', { name: 'Skip' }));
    expect(moderation.onToggleHidden).toHaveBeenCalledWith(expect.objectContaining({ id: 'm1' }), undefined);
  });

  it('Skip on hide-all hides with no reason', async () => {
    const { user, moderation } = setup();
    await user.click(screen.getByRole('button', { name: 'Hide all from this user' }));
    await user.click(screen.getByRole('menuitem', { name: 'Skip' }));
    expect(moderation.onToggleHideAuthor).toHaveBeenCalledWith(expect.objectContaining({ id: 'm1' }), false, undefined);
  });

  it('Escape cancels without hiding anything', async () => {
    const { user, moderation } = setup();
    await user.click(screen.getByRole('button', { name: 'Hide' }));
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('menuitem', { name: 'Skip' })).not.toBeInTheDocument());
    expect(moderation.onToggleHidden).not.toHaveBeenCalled();
    expect(moderation.onToggleHideAuthor).not.toHaveBeenCalled();
  });

  it('a click away cancels without hiding anything', async () => {
    const { user, moderation } = setup();
    await user.click(screen.getByRole('button', { name: 'Hide' }));
    await user.click(document.querySelector('.MuiBackdrop-root') as HTMLElement);
    await waitFor(() => expect(screen.queryByRole('menuitem', { name: 'Skip' })).not.toBeInTheDocument());
    expect(moderation.onToggleHidden).not.toHaveBeenCalled();
  });

  it('works from the keyboard: open, arrow to a reason, Enter', async () => {
    const { user, moderation } = setup();
    screen.getByRole('button', { name: 'Hide' }).focus();
    await user.keyboard('{Enter}');
    await waitFor(() => expect(screen.getByRole('menu')).toBeInTheDocument());
    await user.keyboard('{ArrowDown}{Enter}');
    expect(moderation.onToggleHidden).toHaveBeenCalledTimes(1);
    expect(moderation.onToggleHidden.mock.calls[0][1]).toBe('harassment');
  });

  it('unhide acts at once, with no picker', async () => {
    const { user, moderation } = setup(message({ hidden: true }));
    await user.click(screen.getByRole('button', { name: 'Unhide' }));
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(moderation.onToggleHidden).toHaveBeenCalledWith(expect.objectContaining({ id: 'm1' }));
    expect(moderation.onToggleHidden.mock.calls[0]).toHaveLength(1);
  });

  it('unhide all acts at once, with no picker', async () => {
    const { user, moderation } = setup(message(), true);
    await user.click(screen.getByRole('button', { name: 'Unhide all' }));
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(moderation.onToggleHideAuthor).toHaveBeenCalledWith(expect.objectContaining({ id: 'm1' }), true);
    expect(moderation.onToggleHideAuthor.mock.calls[0]).toHaveLength(2);
  });

  it('has no accessibility violations with the picker closed or open', async () => {
    const { user, container } = setup();
    expect(await axe(container)).toHaveNoViolations();
    await user.click(screen.getByRole('button', { name: 'Hide' }));
    await screen.findByRole('menu');
    // The page-level landmark rule does not apply to a fragment rendered on its own.
    expect(await axe(document.body, { rules: { region: { enabled: false } } })).toHaveNoViolations();
  });

  it('labels the menu for assistive tech', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: 'Hide' }));
    expect(screen.getByRole('menu', { name: 'Reason for hiding' })).toBeInTheDocument();
  });
});
