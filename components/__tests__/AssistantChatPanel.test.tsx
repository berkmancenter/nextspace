import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { AssistantChatPanel } from '../AssistantChatPanel';

jest.mock('../MessageInput', () => ({
  MessageInput: () => <div data-testid="message-input" />,
}));

jest.mock('../ThreadedMessage', () => ({
  ThreadedMessage: () => null,
}));

jest.mock('../ThreadPanel', () => ({
  ThreadPanel: () => null,
}));

jest.mock('../MediaLightbox', () => ({
  MediaLightbox: () => null,
}));

jest.mock('../BotIcon', () => ({
  BotIcon: () => null,
}));

jest.mock('../../hooks/useAutoScroll', () => ({
  useAutoScroll: () => ({
    messagesEndRef: { current: null },
    messagesContainerRef: { current: null },
  }),
}));

const defaultProps = {
  messages: [],
  pseudonym: 'TestUser',
  waitingForResponse: false,
  controlledMode: null,
  slashCommands: [],
  botName: 'Berkie',
  onSendMessage: jest.fn().mockResolvedValue(true),
  onExitControlledMode: jest.fn(),
  onPromptSelect: jest.fn(),
  userId: 'user-1',
};

describe('AssistantChatPanel input toggle', () => {
  it('shows the message input by default', () => {
    render(<AssistantChatPanel {...defaultProps} />);
    expect(screen.getByTestId('message-input')).toBeInTheDocument();
  });

  it('hides the message input when the toggle button is clicked', () => {
    render(<AssistantChatPanel {...defaultProps} />);
    fireEvent.click(screen.getByLabelText('Hide input'));
    expect(screen.queryByTestId('message-input')).not.toBeInTheDocument();
  });

  it('shows the message input again after toggling twice', () => {
    render(<AssistantChatPanel {...defaultProps} />);
    fireEvent.click(screen.getByLabelText('Hide input'));
    fireEvent.click(screen.getByLabelText('Show input'));
    expect(screen.getByTestId('message-input')).toBeInTheDocument();
  });

  it('shows "Show input" aria-label when input is hidden', () => {
    render(<AssistantChatPanel {...defaultProps} />);
    fireEvent.click(screen.getByLabelText('Hide input'));
    expect(screen.getByLabelText('Show input')).toBeInTheDocument();
  });

  it('does not render the toggle or input when inactive', () => {
    render(<AssistantChatPanel {...defaultProps} inactive={true} />);
    expect(screen.queryByTestId('message-input')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Hide input')).not.toBeInTheDocument();
  });
});
