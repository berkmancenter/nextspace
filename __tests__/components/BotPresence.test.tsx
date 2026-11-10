import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { BotPresence } from '../../components/BotPresence';

const baseProps = {
  conversationId: 'conv-123',
  botName: 'Berkie',
};

describe('BotPresence', () => {
  const originalBotMediaUrl = process.env.NEXT_PUBLIC_BOT_MEDIA_URL;

  afterEach(() => {
    process.env.NEXT_PUBLIC_BOT_MEDIA_URL = originalBotMediaUrl;
    jest.useRealTimers();
  });

  it('renders nothing when bot-media-server is not configured', () => {
    delete process.env.NEXT_PUBLIC_BOT_MEDIA_URL;
    const { container } = render(<BotPresence {...baseProps} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('embeds bot-media-server with the conversation, bot name, and transcript passcode', () => {
    process.env.NEXT_PUBLIC_BOT_MEDIA_URL = 'https://bot-media.example.com';
    render(<BotPresence {...baseProps} transcriptPasscode="secret-pass" />);

    const iframe = screen.getByTitle('Berkie presence');
    expect(iframe).toHaveAttribute(
      'src',
      'https://bot-media.example.com/?conversationId=conv-123&botName=Berkie&transcriptPasscode=secret-pass',
    );
  });

  it('omits the transcript passcode param when there is none', () => {
    process.env.NEXT_PUBLIC_BOT_MEDIA_URL = 'https://bot-media.example.com';
    render(<BotPresence {...baseProps} />);

    expect(screen.getByTitle('Berkie presence')).toHaveAttribute(
      'src',
      'https://bot-media.example.com/?conversationId=conv-123&botName=Berkie',
    );
  });

  it('shows a connecting message until the embed loads, then an audio prompt', () => {
    process.env.NEXT_PUBLIC_BOT_MEDIA_URL = 'https://bot-media.example.com';
    render(<BotPresence {...baseProps} />);

    expect(screen.getByText('Connecting to Berkie…')).toBeInTheDocument();

    fireLoad();

    expect(screen.queryByText('Connecting to Berkie…')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Click Berkie to enable audio');
  });

  it('tells bot-media-server to stay muted, and skips the audio prompt, when audio is disabled', () => {
    process.env.NEXT_PUBLIC_BOT_MEDIA_URL = 'https://bot-media.example.com';
    render(<BotPresence {...baseProps} audioEnabled={false} />);

    expect(screen.getByTitle('Berkie presence')).toHaveAttribute(
      'src',
      'https://bot-media.example.com/?conversationId=conv-123&botName=Berkie&audio=false',
    );

    fireLoad();

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('is expanded by default, showing the bot embed', () => {
    process.env.NEXT_PUBLIC_BOT_MEDIA_URL = 'https://bot-media.example.com';
    render(<BotPresence {...baseProps} />);

    expect(screen.getByRole('button', { name: 'Collapse presentation view' })).toBeInTheDocument();
    expect(screen.getByTestId('bot-presence-content')).not.toHaveClass('hidden');
  });

  it('collapses to a thin strip on click, without unmounting the bot embed', () => {
    process.env.NEXT_PUBLIC_BOT_MEDIA_URL = 'https://bot-media.example.com';
    render(<BotPresence {...baseProps} />);

    fireEvent.click(screen.getByRole('button', { name: 'Collapse presentation view' }));

    expect(screen.getByRole('button', { name: 'Expand presentation view' })).toBeInTheDocument();
    // Still in the DOM, just hidden via CSS — collapsing must not drop the iframe's live connection.
    expect(screen.getByTitle('Berkie presence')).toBeInTheDocument();
    expect(screen.getByTestId('bot-presence-content')).toHaveClass('hidden');
  });

  it('expands again on a second click', () => {
    process.env.NEXT_PUBLIC_BOT_MEDIA_URL = 'https://bot-media.example.com';
    render(<BotPresence {...baseProps} />);

    fireEvent.click(screen.getByRole('button', { name: 'Collapse presentation view' }));
    fireEvent.click(screen.getByRole('button', { name: 'Expand presentation view' }));

    expect(screen.getByRole('button', { name: 'Collapse presentation view' })).toBeInTheDocument();
    expect(screen.getByTestId('bot-presence-content')).not.toHaveClass('hidden');
  });

  it('shows a timeout message if the embed never loads', () => {
    jest.useFakeTimers();
    process.env.NEXT_PUBLIC_BOT_MEDIA_URL = 'https://bot-media.example.com';
    render(<BotPresence {...baseProps} />);

    act(() => {
      jest.advanceTimersByTime(8000);
    });

    expect(screen.getByText("Couldn't connect to Berkie's presence panel.")).toBeInTheDocument();
  });

  function fireLoad() {
    fireEvent.load(screen.getByTitle('Berkie presence'));
  }
});
