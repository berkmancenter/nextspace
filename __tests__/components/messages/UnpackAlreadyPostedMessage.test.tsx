import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { UnpackAlreadyPostedMessage } from '../../../components/messages/UnpackAlreadyPostedMessage';
import { PseudonymousMessage } from '../../../types.internal';

const note: PseudonymousMessage = {
  id: 'note-1',
  pseudonym: 'Berkie',
  pseudonymId: 'agent-1',
  createdAt: '2025-10-17T10:45:00Z',
  bodyType: 'json',
  body: {
    type: 'unpack_already_posted',
    groupChatMessageId: 'post-0',
    text: 'A post about this part of the talk is already in Group Chat.',
  },
  channels: ['direct-user-1-agent-1'],
  conversation: 'conv-1',
  fromAgent: true,
  pause: false,
  visible: true,
  upVotes: [],
  downVotes: [],
};

describe('UnpackAlreadyPostedMessage', () => {
  it('shows the note the server sent', () => {
    render(<UnpackAlreadyPostedMessage message={note} />);

    expect(screen.getByText('A post about this part of the talk is already in Group Chat.')).toBeInTheDocument();
  });

  it('links to the existing Group Chat post', async () => {
    const user = userEvent.setup();
    const onOpenGroupChatPost = jest.fn();
    render(<UnpackAlreadyPostedMessage message={note} onOpenGroupChatPost={onOpenGroupChatPost} />);

    await user.click(screen.getByRole('button', { name: 'See it in Group Chat' }));

    expect(onOpenGroupChatPost).toHaveBeenCalledWith('post-0');
  });

  it('leaves out the link where Group Chat cannot be opened', () => {
    render(<UnpackAlreadyPostedMessage message={note} />);

    expect(screen.queryByRole('button', { name: 'See it in Group Chat' })).not.toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    const { container } = render(<UnpackAlreadyPostedMessage message={note} onOpenGroupChatPost={jest.fn()} />);

    expect(await axe(container)).toHaveNoViolations();
  });
});
