import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PresentationHeader } from '../../components/PresentationHeader';

describe('PresentationHeader', () => {
  const confirmExit = async () => {
    await userEvent.click(screen.getByRole('button', { name: 'Exit presentation view' }));
    await userEvent.click(screen.getByRole('button', { name: 'Go to participant view' }));
  };

  it('names the event and labels the screen as the presentation view', () => {
    render(<PresentationHeader eventName="Legal Telescopes" onExit={jest.fn().mockResolvedValue(true)} />);

    expect(screen.getByRole('heading', { level: 1, name: 'Legal Telescopes' })).toBeInTheDocument();
    expect(screen.getByText('Presentation view')).toBeInTheDocument();
  });

  it('asks before leaving, and stays put on "Keep presenting"', async () => {
    const onExit = jest.fn().mockResolvedValue(true);
    render(<PresentationHeader eventName="Legal Telescopes" onExit={onExit} />);

    await userEvent.click(screen.getByRole('button', { name: 'Exit presentation view' }));
    await userEvent.click(screen.getByRole('button', { name: 'Keep presenting' }));

    expect(onExit).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Exit presentation view?' })).not.toBeInTheDocument();
    });
  });

  it('shows an error when navigation is blocked rather than leaving the dialog open with no feedback', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    render(<PresentationHeader eventName="Legal Telescopes" onExit={jest.fn().mockResolvedValue(false)} />);

    await confirmExit();

    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't open the participant view. Try again.");
    expect(consoleError).toHaveBeenCalledWith('Failed to leave the presentation view: navigation was blocked');
    consoleError.mockRestore();
  });

  it('shows an error when navigation fails', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <PresentationHeader
        eventName="Legal Telescopes"
        onExit={jest.fn().mockRejectedValue(new Error('navigation cancelled'))}
      />,
    );

    await confirmExit();

    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't open the participant view. Try again.");
    expect(consoleError).toHaveBeenCalledWith('Failed to leave the presentation view:', expect.any(Error));
    consoleError.mockRestore();
  });
});
