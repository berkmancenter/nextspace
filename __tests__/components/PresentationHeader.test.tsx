import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PresentationHeader } from '../../components/PresentationHeader';

describe('PresentationHeader', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

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

  it('offers a light/dark toggle next to the exit button, dark by default', async () => {
    render(<PresentationHeader eventName="Legal Telescopes" onExit={jest.fn().mockResolvedValue(true)} />);

    expect(document.documentElement).toHaveAttribute('data-presenter-theme', 'dark');
    const toggle = screen.getByRole('button', { name: 'Switch to light mode' });
    expect(toggle.nextElementSibling).toBe(screen.getByRole('button', { name: 'Exit presentation view' }));

    await userEvent.click(toggle);

    expect(document.documentElement).toHaveAttribute('data-presenter-theme', 'light');
    expect(screen.getByRole('button', { name: 'Switch to dark mode' })).toBeInTheDocument();
    expect(window.localStorage.getItem('nextspace-presenter-theme')).toBe('light');
  });

  it('removes the theme from the page when the presentation view closes', () => {
    const { unmount } = render(
      <PresentationHeader eventName="Legal Telescopes" onExit={jest.fn().mockResolvedValue(true)} />,
    );

    unmount();

    expect(document.documentElement).not.toHaveAttribute('data-presenter-theme');
  });

  describe('join QR code', () => {
    const participantUrl = 'https://example.com/assistant/?conversationId=conv-123';

    it('shows no QR toggle when there is no participant link', () => {
      render(<PresentationHeader eventName="Legal Telescopes" onExit={jest.fn().mockResolvedValue(true)} />);

      expect(screen.queryByRole('button', { name: /join qr code/i })).not.toBeInTheDocument();
    });

    it('shows the QR code by default when a participant link is present', async () => {
      render(
        <PresentationHeader
          eventName="Legal Telescopes"
          onExit={jest.fn().mockResolvedValue(true)}
          participantUrl={participantUrl}
        />,
      );

      expect(await screen.findByRole('img', { name: 'Scan to join as a participant' })).toBeInTheDocument();
      expect(screen.getByText('Scan to join')).toBeInTheDocument();
      // The open Popover marks the rest of the page aria-hidden (standard MUI modal behavior,
      // purely for assistive tech — it doesn't block real mouse/keyboard interaction), so the
      // toggle button itself has to be queried past that to find it, same as a sighted user can
      // still click it.
      expect(screen.getByRole('button', { name: 'Hide join QR code', hidden: true })).toBeInTheDocument();
    });

    it('hides the QR code on toggle click, and shows it again on a second click', async () => {
      render(
        <PresentationHeader
          eventName="Legal Telescopes"
          onExit={jest.fn().mockResolvedValue(true)}
          participantUrl={participantUrl}
        />,
      );

      await screen.findByRole('img', { name: 'Scan to join as a participant' });

      await userEvent.click(screen.getByRole('button', { name: 'Hide join QR code', hidden: true }));
      await waitFor(() => {
        expect(screen.queryByRole('img', { name: 'Scan to join as a participant' })).not.toBeInTheDocument();
      });

      await userEvent.click(screen.getByRole('button', { name: 'Show join QR code' }));
      expect(await screen.findByRole('img', { name: 'Scan to join as a participant' })).toBeInTheDocument();
    });
  });
});
