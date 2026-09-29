import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { SetRealNameDialog } from '../../../components/room/SetRealNameDialog';

describe('SetRealNameDialog', () => {
  const baseProps = {
    open: true,
    onSave: jest.fn().mockResolvedValue({ ok: true }),
    onDismiss: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const type = async (user: ReturnType<typeof userEvent.setup>, name: string) => {
    await user.clear(screen.getByLabelText('Your name'));
    await user.type(screen.getByLabelText('Your name'), name);
  };

  it('asks for a name, labelled by its own heading', () => {
    render(<SetRealNameDialog {...baseProps} />);

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAccessibleName('Set your name for this room');
    expect(screen.getByLabelText('Your name')).toBeInTheDocument();
  });

  it('puts the cursor in the name field so a keyboard user can type straight away', () => {
    render(<SetRealNameDialog {...baseProps} />);

    expect(screen.getByLabelText('Your name')).toHaveFocus();
  });

  it('has no accessibility violations', async () => {
    const { container } = render(<SetRealNameDialog {...baseProps} />);
    expect(await axe(container)).toHaveNoViolations();
  });

  describe('getting past it without setting a name', () => {
    it('lets an admin who only wants to read carry on', async () => {
      const user = userEvent.setup();
      render(<SetRealNameDialog {...baseProps} />);

      await user.click(screen.getByRole('button', { name: "I'm just reading" }));

      expect(baseProps.onDismiss).toHaveBeenCalled();
      expect(baseProps.onSave).not.toHaveBeenCalled();
    });

    // Claiming a name cannot be undone through the API, so it must never happen by accident.
    it('ignores Escape', async () => {
      const user = userEvent.setup();
      render(<SetRealNameDialog {...baseProps} />);

      await user.keyboard('{Escape}');

      expect(baseProps.onDismiss).not.toHaveBeenCalled();
    });

    it('offers no close icon', () => {
      render(<SetRealNameDialog {...baseProps} />);

      expect(screen.queryByRole('button', { name: /close/i })).not.toBeInTheDocument();
    });
  });

  describe('confirming before saving', () => {
    it('does not save on the first press, and shows the name back for checking', async () => {
      const user = userEvent.setup();
      render(<SetRealNameDialog {...baseProps} />);

      await type(user, 'Alex Admin');
      await user.click(screen.getByRole('button', { name: 'Set my name' }));

      expect(baseProps.onSave).not.toHaveBeenCalled();
      expect(screen.getByText('Alex Admin')).toBeInTheDocument();
      expect(screen.getByText(/cannot be changed/i)).toBeInTheDocument();
    });

    it('saves the confirmed name', async () => {
      const user = userEvent.setup();
      render(<SetRealNameDialog {...baseProps} />);

      await type(user, 'Alex Admin');
      await user.click(screen.getByRole('button', { name: 'Set my name' }));
      await user.click(screen.getByRole('button', { name: 'Yes, use this name' }));

      await waitFor(() => expect(baseProps.onSave).toHaveBeenCalledWith('Alex Admin'));
    });

    // The field and the button that was pressed both disappear on this step, so without this
    // focus falls to the document and a keyboard user has to tab back in from the top.
    it('moves focus onto the confirming button', async () => {
      const user = userEvent.setup();
      render(<SetRealNameDialog {...baseProps} />);

      await type(user, 'Alex Admin');
      await user.click(screen.getByRole('button', { name: 'Set my name' }));

      expect(screen.getByRole('button', { name: 'Yes, use this name' })).toHaveFocus();
    });

    it('goes back to the field so a typo can be corrected', async () => {
      const user = userEvent.setup();
      render(<SetRealNameDialog {...baseProps} />);

      await type(user, 'Alx Admin');
      await user.click(screen.getByRole('button', { name: 'Set my name' }));
      await user.click(screen.getByRole('button', { name: 'Back' }));

      expect(screen.getByLabelText('Your name')).toHaveValue('Alx Admin');
      expect(baseProps.onSave).not.toHaveBeenCalled();
    });

    it('asks for a name before offering to confirm an empty one', async () => {
      const user = userEvent.setup();
      render(<SetRealNameDialog {...baseProps} />);

      await user.click(screen.getByRole('button', { name: 'Set my name' }));

      expect(screen.getByText(/enter a name/i)).toBeInTheDocument();
      expect(baseProps.onSave).not.toHaveBeenCalled();
    });
  });

  describe('when the name is already taken in this room', () => {
    // The server's own 409 wording never reaches the client: SendData only reads the response
    // body on a 400. The dialog says it instead.
    it('asks for a different name and keeps the dialog open', async () => {
      const user = userEvent.setup();
      const onSave = jest.fn().mockResolvedValue({ ok: false, taken: true });
      render(<SetRealNameDialog {...baseProps} onSave={onSave} />);

      await type(user, 'Alex Admin');
      await user.click(screen.getByRole('button', { name: 'Set my name' }));
      await user.click(screen.getByRole('button', { name: 'Yes, use this name' }));

      await waitFor(() => expect(screen.getByText(/already using that name/i)).toBeInTheDocument());
      expect(screen.getByLabelText('Your name')).toBeInTheDocument();
      expect(baseProps.onDismiss).not.toHaveBeenCalled();
    });

    // Nothing else closes this dialog, so a save that throws must not leave every button
    // disabled: that would strand the admin until they reload the page.
    it('recovers when the save throws rather than answering', async () => {
      const user = userEvent.setup();
      const onSave = jest.fn().mockRejectedValue(new Error('no tokens'));
      render(<SetRealNameDialog {...baseProps} onSave={onSave} />);

      await type(user, 'Alex Admin');
      await user.click(screen.getByRole('button', { name: 'Set my name' }));
      await user.click(screen.getByRole('button', { name: 'Yes, use this name' }));

      await waitFor(() => expect(screen.getByText(/could not be saved/i)).toBeInTheDocument());
      expect(screen.getByRole('button', { name: 'Set my name' })).toBeEnabled();
      expect(screen.getByRole('button', { name: "I'm just reading" })).toBeEnabled();
    });

    it('reports any other failure without blaming the name', async () => {
      const user = userEvent.setup();
      const onSave = jest.fn().mockResolvedValue({ ok: false });
      render(<SetRealNameDialog {...baseProps} onSave={onSave} />);

      await type(user, 'Alex Admin');
      await user.click(screen.getByRole('button', { name: 'Set my name' }));
      await user.click(screen.getByRole('button', { name: 'Yes, use this name' }));

      await waitFor(() => expect(screen.getByText(/could not be saved/i)).toBeInTheDocument());
    });
  });
});
