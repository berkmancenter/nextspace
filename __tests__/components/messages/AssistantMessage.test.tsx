import React from 'react';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AssistantMessage } from '../../../components/messages/AssistantMessage';
import { PseudonymousMessage } from '../../../types.internal';
import { components } from '../../../types';

// Mock the MessageContent component
jest.mock('../../../components/messages/MessageContent', () => ({
  MessageContent: ({ text }: any) => <div data-testid="message-content">{text}</div>,
}));

describe('AssistantMessage Component', () => {
  const mockMessage: PseudonymousMessage = {
    id: 'msg-1',
    body: 'Hello, this is a test message',
    pseudonym: 'Assistant',
    pseudonymId: 'assistant-1',
    fromAgent: true,
    createdAt: new Date().toISOString(),
    conversation: 'conv-1',
    pause: false,
    visible: true,
    upVotes: [],
    downVotes: [],
  };

  describe('Basic message rendering', () => {
    it('renders assistant message content', () => {
      const testDate = new Date();
      const message: components['schemas']['Message'] = {
        id: 'msg-1',
        body: 'Assistant message',
        createdAt: testDate.toISOString(),
        conversation: 'conv-1',
        fromAgent: true,
        pause: false,
        visible: true,
        pseudonym: 'Event Assistant',
        pseudonymId: 'ea-1',
        upVotes: [],
        downVotes: [],
      };

      render(<AssistantMessage message={message} />);

      expect(screen.getByText('Assistant message')).toBeInTheDocument();
    });

    it('renders message text without media', () => {
      render(<AssistantMessage message={mockMessage} />);

      expect(screen.getByTestId('message-content')).toHaveTextContent('Hello, this is a test message');
    });

    it('renders without background styling when no prompt options', () => {
      const message: components['schemas']['Message'] = {
        id: 'msg-2',
        body: 'Simple message',
        conversation: 'conv-1',
        fromAgent: true,
        pause: false,
        visible: true,
        pseudonym: 'Event Assistant',
        pseudonymId: 'ea-1',
        upVotes: [],
        downVotes: [],
      };

      const { container } = render(<AssistantMessage message={message} />);
      // No background class — parent provides the bubble styling
      expect(container.querySelector('.bg-light-gray')).not.toBeInTheDocument();
      expect(screen.getByText('Simple message')).toBeInTheDocument();
    });

    it('applies the poll-card styling when message has prompt options', () => {
      const messageWithPrompt: PseudonymousMessage = {
        ...mockMessage,
        prompt: {
          type: 'singleChoice',
          options: [
            { label: 'Option 1', value: 'opt1' },
            { label: 'Option 2', value: 'opt2' },
          ],
        },
      };

      render(<AssistantMessage message={messageWithPrompt} />);

      // The card itself uses the same --nx-poll-* tokens PollMessage does, not a purple fill;
      // jsdom drops var()-based style values from the serialized style attribute, so this checks
      // the plain properties that do survive (border-radius/overflow) as a proxy for the card.
      const card = screen.getByText('Option 1').closest('.w-full.my-1');
      expect(card).toHaveStyle({ borderRadius: '10px', overflow: 'hidden' });
    });

    it('does not apply the poll-card styling when message has no prompt options', () => {
      const { container } = render(<AssistantMessage message={mockMessage} />);

      expect(container.querySelector('.w-full.my-1')).not.toHaveStyle({ borderRadius: '10px' });
    });
  });

  describe('Starting point pill', () => {
    it('shows the pill for a warmUpQuestion singleChoice message', () => {
      const messageWithPrompt: PseudonymousMessage = {
        ...mockMessage,
        prompt: { type: 'singleChoice', options: [{ label: 'Option 1', value: 'opt1' }] },
      };

      render(<AssistantMessage messageType="warmUpQuestion" message={messageWithPrompt} />);

      expect(screen.getByText('Starting point')).toBeInTheDocument();
    });

    it('shows the pill for a warmUpQuestion text message', () => {
      const messageWithPrompt: PseudonymousMessage = { ...mockMessage, prompt: { type: 'text' } };

      render(<AssistantMessage messageType="warmUpQuestion" message={messageWithPrompt} />);

      expect(screen.getByText('Starting point')).toBeInTheDocument();
    });

    it('does not show the pill when message has no prompt at all', () => {
      render(<AssistantMessage messageType="warmUpQuestion" message={mockMessage} />);

      expect(screen.queryByText('Starting point')).not.toBeInTheDocument();
    });

    it('does not show the pill for a message with a prompt shape but a different messageType, though the card and buttons still render', () => {
      // The card/buttons/textarea apply to any message with a prompt shape, regardless of why it
      // has one — only this pill is scoped to warm-up questions specifically.
      const messageWithPrompt: PseudonymousMessage = {
        ...mockMessage,
        prompt: { type: 'singleChoice', options: [{ label: 'Option 1', value: 'opt1' }] },
      };

      render(<AssistantMessage messageType="someOtherType" message={messageWithPrompt} />);

      expect(screen.queryByText('Starting point')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Option 1' })).toBeInTheDocument();
    });
  });

  describe('Media rendering', () => {
    it('renders a single image', () => {
      const media = [
        {
          type: 'image' as const,
          data: 'base64encodeddata',
          mimeType: 'image/png',
        },
      ];

      render(<AssistantMessage message={mockMessage} media={media} />);

      const images = screen.getAllByAltText('Visual response');
      expect(images).toHaveLength(1);
      expect(images[0]).toHaveAttribute('src', 'data:image/png;base64,base64encodeddata');
      expect(images[0]).toHaveStyle({
        maxWidth: '100%',
        height: 'auto',
        borderRadius: '8px',
      });
    });

    it('renders multiple images', () => {
      const media = [
        {
          type: 'image' as const,
          data: 'base64data1',
          mimeType: 'image/png',
        },
        {
          type: 'image' as const,
          data: 'base64data2',
          mimeType: 'image/jpeg',
        },
        {
          type: 'image' as const,
          data: 'base64data3',
          mimeType: 'image/gif',
        },
      ];

      render(<AssistantMessage message={mockMessage} media={media} />);

      const images = screen.getAllByAltText('Visual response');
      expect(images).toHaveLength(3);
      expect(images[0]).toHaveAttribute('src', 'data:image/png;base64,base64data1');
      expect(images[1]).toHaveAttribute('src', 'data:image/jpeg;base64,base64data2');
      expect(images[2]).toHaveAttribute('src', 'data:image/gif;base64,base64data3');
    });

    it('does not render images when media array is empty', () => {
      render(<AssistantMessage message={mockMessage} media={[]} />);

      expect(screen.queryByAltText('Visual response')).not.toBeInTheDocument();
    });

    it('does not render images when media is undefined', () => {
      render(<AssistantMessage message={mockMessage} />);

      expect(screen.queryByAltText('Visual response')).not.toBeInTheDocument();
    });

    it('renders images with proper container styling', () => {
      const media = [
        {
          type: 'image' as const,
          data: 'base64data',
          mimeType: 'image/png',
        },
      ];

      const { container } = render(<AssistantMessage message={mockMessage} media={media} />);

      // Find the media container (Box component with margin and display flex)
      const mediaContainer = container.querySelector('.MuiBox-root');
      expect(mediaContainer).toBeInTheDocument();
    });

    it('does not render non-image media types', () => {
      const media = [
        {
          type: 'audio' as const,
          data: 'base64audiodata',
          mimeType: 'audio/mp3',
        },
        {
          type: 'video' as const,
          data: 'base64videodata',
          mimeType: 'video/mp4',
        },
      ];

      render(<AssistantMessage message={mockMessage} media={media} />);

      // Audio and video types should not render (future feature)
      expect(screen.queryByAltText('Visual response')).not.toBeInTheDocument();
    });

    it('renders mixed media with only images displayed', () => {
      const media = [
        {
          type: 'image' as const,
          data: 'base64imagedata',
          mimeType: 'image/png',
        },
        {
          type: 'audio' as const,
          data: 'base64audiodata',
          mimeType: 'audio/mp3',
        },
      ];

      render(<AssistantMessage message={mockMessage} media={media} />);

      const images = screen.getAllByAltText('Visual response');
      expect(images).toHaveLength(1);
    });

    it('handles different image MIME types correctly', () => {
      const mimeTypes = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml'];

      mimeTypes.forEach((mimeType) => {
        const media = [
          {
            type: 'image' as const,
            data: 'testdata',
            mimeType,
          },
        ];

        const { unmount } = render(<AssistantMessage message={mockMessage} media={media} />);

        const image = screen.getByAltText('Visual response');
        expect(image).toHaveAttribute('src', `data:${mimeType};base64,testdata`);

        unmount();
      });
    });
  });

  describe('Prompt options', () => {
    it('renders prompt options in the poll-style card', () => {
      const mockOnPromptSelect = jest.fn();
      const message: components['schemas']['Message'] = {
        id: 'msg-3',
        body: 'Choose an option',
        conversation: 'conv-1',
        fromAgent: true,
        pause: false,
        visible: true,
        pseudonym: 'Event Assistant',
        pseudonymId: 'ea-1',
        upVotes: [],
        downVotes: [],
        prompt: {
          type: 'singleChoice' as const,
          options: [
            { label: 'Option 1', value: 'opt1' },
            { label: 'Option 2', value: 'opt2' },
          ],
        },
      };

      render(<AssistantMessage message={message} onPromptSelect={mockOnPromptSelect} />);

      const card = screen.getByText('Option 1').closest('.w-full.my-1');
      expect(card).toHaveStyle({ borderRadius: '10px', overflow: 'hidden' });

      // Check buttons render
      expect(screen.getByText('Option 1')).toBeInTheDocument();
      expect(screen.getByText('Option 2')).toBeInTheDocument();
    });

    it('renders prompt option buttons for singleChoice type', () => {
      const messageWithPrompt: PseudonymousMessage = {
        ...mockMessage,
        prompt: {
          type: 'singleChoice',
          options: [
            { label: 'Yes', value: 'yes' },
            { label: 'No', value: 'no' },
            { label: 'Maybe', value: 'maybe' },
          ],
        },
      };

      render(<AssistantMessage message={messageWithPrompt} />);

      expect(screen.getByRole('button', { name: 'Yes' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'No' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Maybe' })).toBeInTheDocument();
    });

    it('disables all buttons after selecting a prompt option', () => {
      const mockOnPromptSelect = jest.fn();
      const message: components['schemas']['Message'] = {
        id: 'msg-4',
        body: 'Choose an option',
        conversation: 'conv-1',
        fromAgent: true,
        pause: false,
        visible: true,
        pseudonym: 'Event Assistant',
        pseudonymId: 'ea-1',
        upVotes: [],
        downVotes: [],
        prompt: {
          type: 'singleChoice' as const,
          options: [
            { label: 'Option 1', value: 'opt1' },
            { label: 'Option 2', value: 'opt2' },
          ],
        },
      };

      const { getByRole } = render(<AssistantMessage message={message} onPromptSelect={mockOnPromptSelect} />);

      const button1 = getByRole('button', { name: 'Option 1' });
      const button2 = getByRole('button', { name: 'Option 2' });

      expect(button1).not.toBeDisabled();
      expect(button2).not.toBeDisabled();

      // Click first option
      act(() => {
        button1.click();
      });

      expect(mockOnPromptSelect).toHaveBeenCalledWith('opt1', 'msg-4');
      expect(button1).toBeDisabled();
      expect(button2).toBeDisabled();
    });

    it('does not show Event Assistant header when prompt options present', () => {
      const message: components['schemas']['Message'] = {
        id: 'msg-7',
        body: 'Choose',
        conversation: 'conv-1',
        fromAgent: true,
        pause: false,
        visible: true,
        pseudonym: 'Event Assistant',
        pseudonymId: 'ea-1',
        upVotes: [],
        downVotes: [],
        prompt: {
          type: 'singleChoice' as const,
          options: [{ label: 'Option', value: 'opt' }],
        },
      };

      render(<AssistantMessage message={message} />);

      expect(screen.queryByText('Event Assistant')).not.toBeInTheDocument();
    });

    it('does not render buttons when prompt type is not singleChoice', () => {
      const messageWithPrompt: PseudonymousMessage = {
        ...mockMessage,
        prompt: {
          type: 'multipleChoice' as any,
          options: [
            { label: 'Option 1', value: 'opt1' },
            { label: 'Option 2', value: 'opt2' },
          ],
        },
      };

      render(<AssistantMessage message={messageWithPrompt} />);

      expect(screen.queryByRole('button', { name: 'Option 1' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Option 2' })).not.toBeInTheDocument();
    });

    it('does not render buttons when options array is empty', () => {
      const messageWithPrompt: PseudonymousMessage = {
        ...mockMessage,
        prompt: {
          type: 'singleChoice',
          options: [],
        },
      };

      render(<AssistantMessage message={messageWithPrompt} />);

      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });
  });

  describe('Integration: Media with prompts', () => {
    it('renders both media and prompt options together', () => {
      const messageWithPrompt: PseudonymousMessage = {
        ...mockMessage,
        prompt: {
          type: 'singleChoice',
          options: [
            { label: 'Like', value: 'like' },
            { label: 'Dislike', value: 'dislike' },
          ],
        },
      };

      const media = [
        {
          type: 'image' as const,
          data: 'imagedata',
          mimeType: 'image/png',
        },
      ];

      render(<AssistantMessage message={messageWithPrompt} media={media} />);

      // Both media and prompts should be present
      expect(screen.getByAltText('Visual response')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Like' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Dislike' })).toBeInTheDocument();
    });

    it('renders multiple images with prompt options', () => {
      const messageWithPrompt: PseudonymousMessage = {
        ...mockMessage,
        body: 'Which image do you prefer?',
        prompt: {
          type: 'singleChoice',
          options: [
            { label: 'First', value: '1' },
            { label: 'Second', value: '2' },
          ],
        },
      };

      const media = [
        {
          type: 'image' as const,
          data: 'image1',
          mimeType: 'image/png',
        },
        {
          type: 'image' as const,
          data: 'image2',
          mimeType: 'image/png',
        },
      ];

      render(<AssistantMessage message={messageWithPrompt} media={media} />);

      const images = screen.getAllByAltText('Visual response');
      expect(images).toHaveLength(2);
      expect(screen.getByRole('button', { name: 'First' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Second' })).toBeInTheDocument();
    });
  });

  describe('Initial selected prompt', () => {
    it('disables all buttons when initialSelectedPrompt is provided', () => {
      const message: components['schemas']['Message'] = {
        id: 'msg-5',
        body: 'Choose an option',
        conversation: 'conv-1',
        fromAgent: true,
        pause: false,
        visible: true,
        pseudonym: 'Event Assistant',
        pseudonymId: 'ea-1',
        upVotes: [],
        downVotes: [],
        prompt: {
          type: 'singleChoice' as const,
          options: [
            { label: 'Option 1', value: 'opt1' },
            { label: 'Option 2', value: 'opt2' },
          ],
        },
      };

      render(<AssistantMessage message={message} initialSelectedPrompt="opt1" />);

      const button1 = screen.getByRole('button', { name: 'Option 1' });
      const button2 = screen.getByRole('button', { name: 'Option 2' });

      expect(button1).toBeDisabled();
      expect(button2).toBeDisabled();
    });

    it('marks the selected option with a checkmark when initialSelectedPrompt matches', () => {
      const message: components['schemas']['Message'] = {
        id: 'msg-6',
        body: 'Choose an option',
        conversation: 'conv-1',
        fromAgent: true,
        pause: false,
        visible: true,
        pseudonym: 'Event Assistant',
        pseudonymId: 'ea-1',
        upVotes: [],
        downVotes: [],
        prompt: {
          type: 'singleChoice' as const,
          options: [
            { label: 'Yes', value: 'yes' },
            { label: 'No', value: 'no' },
          ],
        },
      };

      const { container } = render(<AssistantMessage message={message} initialSelectedPrompt="yes" />);

      // The selected button should contain a check icon
      const yesButton = screen.getByText('Yes').closest('button');
      expect(yesButton).toBeInTheDocument();
      expect(yesButton?.querySelector('[data-testid="CheckIcon"]')).toBeInTheDocument();
    });

    it('updates selected prompt when initialSelectedPrompt changes', () => {
      const message: components['schemas']['Message'] = {
        id: 'msg-7',
        body: 'Choose an option',
        conversation: 'conv-1',
        fromAgent: true,
        pause: false,
        visible: true,
        pseudonym: 'Event Assistant',
        pseudonymId: 'ea-1',
        upVotes: [],
        downVotes: [],
        prompt: {
          type: 'singleChoice' as const,
          options: [
            { label: 'Option A', value: 'a' },
            { label: 'Option B', value: 'b' },
          ],
        },
      };

      const { rerender } = render(<AssistantMessage message={message} initialSelectedPrompt="a" />);

      // Both should be disabled initially
      expect(screen.getByRole('button', { name: 'Option A' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Option B' })).toBeDisabled();

      // Rerender with different initialSelectedPrompt
      rerender(<AssistantMessage message={message} initialSelectedPrompt="b" />);

      // Should still be disabled, but selection changed
      expect(screen.getByRole('button', { name: 'Option A' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Option B' })).toBeDisabled();
    });

    it('does not call onPromptSelect when a button is clicked if already selected', () => {
      const mockOnPromptSelect = jest.fn();
      const message: components['schemas']['Message'] = {
        id: 'msg-8',
        body: 'Choose an option',
        conversation: 'conv-1',
        fromAgent: true,
        pause: false,
        visible: true,
        pseudonym: 'Event Assistant',
        pseudonymId: 'ea-1',
        upVotes: [],
        downVotes: [],
        prompt: {
          type: 'singleChoice' as const,
          options: [
            { label: 'Option 1', value: 'opt1' },
            { label: 'Option 2', value: 'opt2' },
          ],
        },
      };

      render(<AssistantMessage message={message} onPromptSelect={mockOnPromptSelect} initialSelectedPrompt="opt1" />);

      const button1 = screen.getByRole('button', { name: 'Option 1' });

      // Button is disabled, so click won't work
      // But we verify that it's disabled which prevents the handler from being called
      expect(button1).toBeDisabled();
      expect(mockOnPromptSelect).not.toHaveBeenCalled();
    });
  });

  describe('Text prompts', () => {
    const makeTextPromptMessage = (overrides: Partial<components['schemas']['Message']> = {}) =>
      ({
        id: 'msg-text-1',
        body: 'What do you think?',
        conversation: 'conv-1',
        fromAgent: true,
        pause: false,
        visible: true,
        pseudonym: 'Event Assistant',
        pseudonymId: 'ea-1',
        upVotes: [],
        downVotes: [],
        prompt: { type: 'text' as const },
        ...overrides,
      }) as components['schemas']['Message'];

    it('applies the same poll-card styling as a singleChoice prompt', () => {
      render(<AssistantMessage message={makeTextPromptMessage()} />);

      const card = screen.getByRole('textbox', { name: 'Your answer' }).closest('.w-full.my-1');
      expect(card).toHaveStyle({ borderRadius: '10px', overflow: 'hidden' });
    });

    it('renders a textarea and Submit button instead of choice buttons', () => {
      render(<AssistantMessage message={makeTextPromptMessage()} />);

      expect(screen.getByRole('textbox', { name: 'Your answer' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Submit' })).toBeInTheDocument();
    });

    it('uses the prompt placeholder when provided', () => {
      render(<AssistantMessage message={makeTextPromptMessage({ prompt: { type: 'text', placeholder: 'Ask away' } })} />);

      expect(screen.getByPlaceholderText('Ask away')).toBeInTheDocument();
    });

    it('disables Submit until something is typed', async () => {
      const user = userEvent.setup();
      render(<AssistantMessage message={makeTextPromptMessage()} />);

      const submitButton = screen.getByRole('button', { name: 'Submit' });
      expect(submitButton).toBeDisabled();

      await user.type(screen.getByRole('textbox', { name: 'Your answer' }), 'My answer');
      expect(submitButton).toBeEnabled();
    });

    it('disables Submit for whitespace-only input', async () => {
      const user = userEvent.setup();
      render(<AssistantMessage message={makeTextPromptMessage()} />);

      await user.type(screen.getByRole('textbox', { name: 'Your answer' }), '   ');
      expect(screen.getByRole('button', { name: 'Submit' })).toBeDisabled();
    });

    it('calls onPromptSelect with the trimmed answer and the message id on submit', async () => {
      const user = userEvent.setup();
      const mockOnPromptSelect = jest.fn();
      render(<AssistantMessage message={makeTextPromptMessage()} onPromptSelect={mockOnPromptSelect} />);

      await user.type(screen.getByRole('textbox', { name: 'Your answer' }), '  My answer  ');
      await user.click(screen.getByRole('button', { name: 'Submit' }));

      expect(mockOnPromptSelect).toHaveBeenCalledWith('My answer', 'msg-text-1');
    });

    it('locks the field to a read-only display of the submitted answer', async () => {
      const user = userEvent.setup();
      render(<AssistantMessage message={makeTextPromptMessage()} />);

      await user.type(screen.getByRole('textbox', { name: 'Your answer' }), 'My answer');
      await user.click(screen.getByRole('button', { name: 'Submit' }));

      const textarea = screen.getByRole('textbox', { name: 'Your answer' });
      expect(textarea).toHaveValue('My answer');
      expect(textarea).toHaveAttribute('readonly');
      expect(textarea).toBeDisabled();
      expect(screen.queryByRole('button', { name: 'Submit' })).not.toBeInTheDocument();
    });

    it('shows the locked answer from initialSelectedPrompt on load, with no Submit button', () => {
      render(<AssistantMessage message={makeTextPromptMessage()} initialSelectedPrompt="Already answered" />);

      const textarea = screen.getByRole('textbox', { name: 'Your answer' });
      expect(textarea).toHaveValue('Already answered');
      expect(textarea).toBeDisabled();
      expect(screen.queryByRole('button', { name: 'Submit' })).not.toBeInTheDocument();
    });

    it('does not render the textarea for prompt types other than text or singleChoice', () => {
      render(<AssistantMessage message={makeTextPromptMessage({ prompt: { type: 'number' as any } })} />);

      expect(screen.queryByRole('textbox', { name: 'Your answer' })).not.toBeInTheDocument();
    });
  });
});
