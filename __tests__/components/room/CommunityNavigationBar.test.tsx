import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { CommunityNavigationBar } from '../../../components/room/CommunityNavigationBar';

describe('CommunityNavigationBar', () => {
  it('renders the Group Chat and Private Chat tabs', () => {
    render(<CommunityNavigationBar activeTab="chat" onTabChange={jest.fn()} unreadAssistantCount={0} botName="Berkie" />);
    expect(screen.getByRole('button', { name: 'Group Chat' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Private Chat' })).toBeInTheDocument();
  });

  it('marks the active tab with aria-current', () => {
    render(<CommunityNavigationBar activeTab="chat" onTabChange={jest.fn()} unreadAssistantCount={0} botName="Berkie" />);
    expect(screen.getByRole('button', { name: 'Group Chat' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: 'Private Chat' })).not.toHaveAttribute('aria-current');
  });

  it('calls onTabChange with the tab id when a tab is clicked', async () => {
    const user = userEvent.setup();
    const onTabChange = jest.fn();
    render(<CommunityNavigationBar activeTab="chat" onTabChange={onTabChange} unreadAssistantCount={0} botName="Berkie" />);

    await user.click(screen.getByRole('button', { name: 'Group Chat' }));
    expect(onTabChange).toHaveBeenCalledWith('chat');

    await user.click(screen.getByRole('button', { name: /Private Chat/ }));
    expect(onTabChange).toHaveBeenCalledWith('assistant');
  });

  it('states the unread count in the Private Chat tab aria-label when there are unread messages', () => {
    render(<CommunityNavigationBar activeTab="chat" onTabChange={jest.fn()} unreadAssistantCount={2} botName="Berkie" />);
    expect(screen.getByRole('button', { name: 'Private Chat, 2 unread messages' })).toBeInTheDocument();
  });

  it('uses the singular form for exactly one unread message', () => {
    render(<CommunityNavigationBar activeTab="chat" onTabChange={jest.fn()} unreadAssistantCount={1} botName="Berkie" />);
    expect(screen.getByRole('button', { name: 'Private Chat, 1 unread message' })).toBeInTheDocument();
  });

  it('does not mention unread count in the aria-label when there is none', () => {
    render(<CommunityNavigationBar activeTab="chat" onTabChange={jest.fn()} unreadAssistantCount={0} botName="Berkie" />);
    expect(screen.getByRole('button', { name: 'Private Chat' })).toBeInTheDocument();
  });

  it('does not show the unread aria-label on the Private Chat tab while it is active', () => {
    render(
      <CommunityNavigationBar activeTab="assistant" onTabChange={jest.fn()} unreadAssistantCount={3} botName="Berkie" />,
    );
    expect(screen.getByRole('button', { name: 'Private Chat' })).toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    const { container } = render(
      <CommunityNavigationBar activeTab="chat" onTabChange={jest.fn()} unreadAssistantCount={2} botName="Berkie" />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
