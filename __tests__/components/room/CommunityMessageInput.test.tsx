import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { CommunityMessageInput } from '../../../components/room/CommunityMessageInput';

describe('CommunityMessageInput', () => {
  const noop = async () => true;

  it('shows the "Message the room" placeholder on the group tab by default', () => {
    render(
      <CommunityMessageInput
        tab="chat"
        realName="Priya Raghunathan"
        botName="Berkie"
        mentionTargets={[]}
        onSendMessage={noop}
      />,
    );
    expect(screen.getByPlaceholderText('Message the room')).toBeInTheDocument();
  });

  it('shows the "Say the first thing" placeholder on the group tab when there are no messages yet', () => {
    render(
      <CommunityMessageInput
        tab="chat"
        realName="Priya Raghunathan"
        botName="Berkie"
        mentionTargets={[]}
        onSendMessage={noop}
        isEmptyRoom
      />,
    );
    expect(screen.getByPlaceholderText('Say the first thing')).toBeInTheDocument();
  });

  it('shows the "Ask Berkie" placeholder on the assistant tab', () => {
    render(
      <CommunityMessageInput
        tab="assistant"
        realName="Priya Raghunathan"
        botName="Berkie"
        mentionTargets={[]}
        onSendMessage={noop}
      />,
    );
    expect(screen.getByPlaceholderText('Ask Berkie')).toBeInTheDocument();
  });

  it('shows the group-chat disclosure line with the real name', () => {
    render(
      <CommunityMessageInput
        tab="chat"
        realName="Priya Raghunathan"
        botName="Berkie"
        mentionTargets={[]}
        onSendMessage={noop}
      />,
    );
    expect(screen.getByText("You're posting as Priya Raghunathan")).toBeInTheDocument();
  });

  it('shows the assistant-tab disclosure line', () => {
    render(
      <CommunityMessageInput
        tab="assistant"
        realName="Priya Raghunathan"
        botName="Berkie"
        mentionTargets={[]}
        onSendMessage={noop}
      />,
    );
    expect(screen.getByText('Only you can see this conversation')).toBeInTheDocument();
  });

  it('shows the @ mention and Ask Berkie buttons on the group tab', () => {
    render(
      <CommunityMessageInput
        tab="chat"
        realName="Priya Raghunathan"
        botName="Berkie"
        mentionTargets={[]}
        onSendMessage={noop}
      />,
    );
    expect(screen.getByRole('button', { name: 'Mention a member' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ask Berkie' })).toBeInTheDocument();
  });

  it('hides the @ mention and Ask Berkie buttons on the assistant tab', () => {
    render(
      <CommunityMessageInput
        tab="assistant"
        realName="Priya Raghunathan"
        botName="Berkie"
        mentionTargets={[]}
        onSendMessage={noop}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Mention a member' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Ask Berkie' })).not.toBeInTheDocument();
  });

  it('inserts "@Berkie " into the composer and focuses it when Ask Berkie is clicked', async () => {
    const user = userEvent.setup();
    render(
      <CommunityMessageInput
        tab="chat"
        realName="Priya Raghunathan"
        botName="Berkie"
        mentionTargets={['Sofia Marchetti']}
        onSendMessage={noop}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Ask Berkie' }));

    const textarea = screen.getByPlaceholderText('Message the room') as HTMLTextAreaElement;
    await waitFor(() => expect(textarea).toHaveValue('@Berkie '));
    expect(textarea).toHaveFocus();
  });

  it('inserts the mention at the current cursor position rather than replacing existing text', async () => {
    const user = userEvent.setup();
    render(
      <CommunityMessageInput
        tab="chat"
        realName="Priya Raghunathan"
        botName="Berkie"
        mentionTargets={[]}
        onSendMessage={noop}
      />,
    );

    const textarea = screen.getByPlaceholderText('Message the room') as HTMLTextAreaElement;
    await user.type(textarea, 'hello ');
    await user.click(screen.getByRole('button', { name: 'Ask Berkie' }));

    await waitFor(() => expect(textarea).toHaveValue('hello @Berkie '));
  });

  it('sends the message and clears the input on submit', async () => {
    const user = userEvent.setup();
    const onSendMessage = jest.fn().mockResolvedValue(true);
    render(
      <CommunityMessageInput
        tab="chat"
        realName="Priya Raghunathan"
        botName="Berkie"
        mentionTargets={[]}
        onSendMessage={onSendMessage}
      />,
    );

    const textarea = screen.getByPlaceholderText('Message the room');
    await user.type(textarea, 'hello room{Enter}');

    expect(onSendMessage).toHaveBeenCalledWith('hello room');
    await waitFor(() => expect(textarea).toHaveValue(''));
  });

  it('keeps the shortcuts visible but unavailable while the connection is down', async () => {
    const user = userEvent.setup();
    render(
      <CommunityMessageInput
        tab="chat"
        realName="Priya Raghunathan"
        botName="Berkie"
        mentionTargets={[]}
        onSendMessage={noop}
        offline
      />,
    );

    const askBerkie = screen.getByRole('button', { name: 'Ask Berkie' });
    expect(askBerkie).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('button', { name: 'Mention a member' })).toHaveAttribute('aria-disabled', 'true');

    await user.click(askBerkie);

    expect(screen.getByPlaceholderText('Message the room')).toHaveValue('');
  });

  it('still sends a message while the connection is down, since sends are held', async () => {
    const user = userEvent.setup();
    const onSendMessage = jest.fn().mockResolvedValue(true);
    render(
      <CommunityMessageInput
        tab="chat"
        realName="Priya Raghunathan"
        botName="Berkie"
        mentionTargets={[]}
        onSendMessage={onSendMessage}
        offline
      />,
    );

    await user.type(screen.getByPlaceholderText('Message the room'), 'held for later');
    await user.click(screen.getByRole('button', { name: 'Send message' }));

    await waitFor(() => expect(onSendMessage).toHaveBeenCalledWith('held for later'));
  });

  describe('when the poster has not set a real name', () => {
    const gatedProps = {
      realName: 'Priya Raghunathan',
      botName: 'Berkie',
      mentionTargets: [],
      mustSetRealName: true,
    };

    const nameGate = () => screen.getByRole('button', { name: 'Set your name' });

    it('swaps the text box for an explanation and a button that opens the naming dialog', () => {
      render(<CommunityMessageInput tab="chat" {...gatedProps} onSendMessage={noop} onRequestRealName={jest.fn()} />);

      expect(nameGate()).toHaveAttribute('aria-haspopup', 'dialog');
      expect(nameGate()).toHaveAccessibleDescription('You must set your real name before posting.');
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    });

    it('leaves the explanation itself inert', async () => {
      const user = userEvent.setup();
      const onRequestRealName = jest.fn();
      render(
        <CommunityMessageInput tab="chat" {...gatedProps} onSendMessage={noop} onRequestRealName={onRequestRealName} />,
      );

      await user.click(screen.getByText('You must set your real name before posting.'));

      expect(onRequestRealName).not.toHaveBeenCalled();
    });

    it('hides the posting-as line, which would name the pseudonym rather than a real name', () => {
      render(<CommunityMessageInput tab="chat" {...gatedProps} onSendMessage={noop} onRequestRealName={jest.fn()} />);
      expect(screen.queryByText("You're posting as Priya Raghunathan")).not.toBeInTheDocument();
    });

    it('keeps the assistant tab privacy line, which stays true', () => {
      render(<CommunityMessageInput tab="assistant" {...gatedProps} onSendMessage={noop} onRequestRealName={jest.fn()} />);
      expect(screen.getByText('Only you can see this conversation')).toBeInTheDocument();
    });

    it('disables the send and shortcut buttons', () => {
      render(<CommunityMessageInput tab="chat" {...gatedProps} onSendMessage={noop} onRequestRealName={jest.fn()} />);

      expect(screen.getByRole('button', { name: 'Send message' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Mention a member' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Ask Berkie' })).toBeDisabled();
    });

    it('asks for a real name when the button is clicked', async () => {
      const user = userEvent.setup();
      const onRequestRealName = jest.fn();
      render(
        <CommunityMessageInput tab="chat" {...gatedProps} onSendMessage={noop} onRequestRealName={onRequestRealName} />,
      );

      await user.click(nameGate());

      expect(onRequestRealName).toHaveBeenCalledTimes(1);
    });

    it('asks for a real name when the button is activated from the keyboard', async () => {
      const user = userEvent.setup();
      const onRequestRealName = jest.fn();
      render(
        <CommunityMessageInput tab="assistant" {...gatedProps} onSendMessage={noop} onRequestRealName={onRequestRealName} />,
      );

      nameGate().focus();
      await user.keyboard('{Enter}');

      expect(onRequestRealName).toHaveBeenCalledTimes(1);
    });

    it('does nothing when the disabled buttons are clicked', async () => {
      // Disabled buttons ignore pointer events, which user-event would otherwise refuse to click through.
      const user = userEvent.setup({ pointerEventsCheck: 0 });
      const onSendMessage = jest.fn().mockResolvedValue(true);
      const onRequestRealName = jest.fn();
      render(
        <CommunityMessageInput
          tab="chat"
          {...gatedProps}
          onSendMessage={onSendMessage}
          onRequestRealName={onRequestRealName}
        />,
      );

      await user.click(screen.getByRole('button', { name: 'Send message' }));
      await user.click(screen.getByRole('button', { name: 'Mention a member' }));
      await user.click(screen.getByRole('button', { name: 'Ask Berkie' }));

      expect(onRequestRealName).not.toHaveBeenCalled();
      expect(onSendMessage).not.toHaveBeenCalled();
    });

    it('has no accessibility violations', async () => {
      const { container } = render(
        <CommunityMessageInput tab="chat" {...gatedProps} onSendMessage={noop} onRequestRealName={jest.fn()} />,
      );
      expect(await axe(container)).toHaveNoViolations();
    });
  });

  it('has no accessibility violations on the group tab', async () => {
    const { container } = render(
      <CommunityMessageInput
        tab="chat"
        realName="Priya Raghunathan"
        botName="Berkie"
        mentionTargets={[]}
        onSendMessage={noop}
      />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no accessibility violations on the assistant tab', async () => {
    const { container } = render(
      <CommunityMessageInput
        tab="assistant"
        realName="Priya Raghunathan"
        botName="Berkie"
        mentionTargets={[]}
        onSendMessage={noop}
      />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
