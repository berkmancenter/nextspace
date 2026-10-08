import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { GroupChatPanel } from '../GroupChatPanel';

jest.mock('../MessageInput', () => ({
  MessageInput: ({ onHide, shownOnScreen }: { onHide?: () => void; shownOnScreen?: boolean }) => (
    <div data-testid="message-input" data-shown-on-screen={shownOnScreen ? 'true' : 'false'}>
      {onHide && <button onClick={onHide}>Hide</button>}
    </div>
  ),
}));

jest.mock('../ThreadedMessage', () => ({
  ThreadedMessage: () => null,
}));

jest.mock('../ThreadPanel', () => ({
  ThreadPanel: () => null,
}));

jest.mock('../BotIcon', () => ({
  BotIcon: () => null,
}));

jest.mock('../../hooks/useAutoScroll', () => ({
  useAutoScroll: () => ({
    messagesEndRef: { current: null },
    messagesContainerRef: { current: null },
    isAtBottom: true,
    scrollToBottom: jest.fn(),
  }),
}));

const defaultProps = {
  messages: [],
  pseudonym: 'TestUser',
  onSendMessage: jest.fn().mockResolvedValue(true),
};

describe('GroupChatPanel input toggle', () => {
  it('shows the message input by default', () => {
    render(<GroupChatPanel {...defaultProps} />);
    expect(screen.getByTestId('message-input')).toBeInTheDocument();
  });

  it('hides the message input when the toggle button is clicked', () => {
    render(<GroupChatPanel {...defaultProps} />);
    fireEvent.click(screen.getByLabelText('Hide input'));
    expect(screen.queryByTestId('message-input')).not.toBeInTheDocument();
  });

  it('shows the message input again after toggling twice', () => {
    render(<GroupChatPanel {...defaultProps} />);
    fireEvent.click(screen.getByLabelText('Hide input'));
    fireEvent.click(screen.getByLabelText('Show input'));
    expect(screen.getByTestId('message-input')).toBeInTheDocument();
  });

  it('shows "Show input" aria-label when input is hidden', () => {
    render(<GroupChatPanel {...defaultProps} />);
    fireEvent.click(screen.getByLabelText('Hide input'));
    expect(screen.getByLabelText('Show input')).toBeInTheDocument();
  });

  it('does not render the toggle or input when inactive', () => {
    render(<GroupChatPanel {...defaultProps} inactive={true} />);
    expect(screen.queryByTestId('message-input')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Hide input')).not.toBeInTheDocument();
  });
});

describe('GroupChatPanel in the presentation view', () => {
  it('starts with the composer collapsed to a "Write a message" button', () => {
    render(<GroupChatPanel {...defaultProps} presentation />);

    expect(screen.queryByTestId('message-input')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /write a message/i })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByLabelText('Show input')).not.toBeInTheDocument();
  });

  it('expands the composer, marked as shown on screen, and collapses it again with Hide', () => {
    render(<GroupChatPanel {...defaultProps} presentation />);

    fireEvent.click(screen.getByRole('button', { name: /write a message/i }));
    expect(screen.getByTestId('message-input')).toHaveAttribute('data-shown-on-screen', 'true');

    fireEvent.click(screen.getByRole('button', { name: 'Hide' }));
    expect(screen.queryByTestId('message-input')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /write a message/i })).toBeInTheDocument();
  });

  it('sets message text to at least 2rem (32px) so it reads from across a room', () => {
    render(<GroupChatPanel {...defaultProps} presentation />);

    expect(screen.getByTestId('chat-message-list')).toHaveStyle({ fontSize: '2rem' });
  });

  it('keeps the default message size outside the presentation view', () => {
    render(<GroupChatPanel {...defaultProps} />);

    expect(screen.getByTestId('chat-message-list')).not.toHaveStyle({ fontSize: '2rem' });
  });

  it('still shows the inactive notice instead of a composer when the event is not active', () => {
    render(<GroupChatPanel {...defaultProps} presentation inactive />);

    expect(screen.getByText('This event is not active.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /write a message/i })).not.toBeInTheDocument();
  });
});
