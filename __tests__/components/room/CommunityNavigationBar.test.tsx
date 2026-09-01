import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { CommunityNavigationBar } from '../../../components/room/CommunityNavigationBar';

describe('CommunityNavigationBar', () => {
  it('renders the Group Chat and Berkie tabs', () => {
    render(<CommunityNavigationBar activeTab="chat" onTabChange={jest.fn()} unreadAssistantCount={0} botName="Berkie" />);
    expect(screen.getByRole('button', { name: 'Group Chat' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Berkie' })).toBeInTheDocument();
  });

  it('marks the active tab with aria-current', () => {
    render(<CommunityNavigationBar activeTab="chat" onTabChange={jest.fn()} unreadAssistantCount={0} botName="Berkie" />);
    expect(screen.getByRole('button', { name: 'Group Chat' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: 'Berkie' })).not.toHaveAttribute('aria-current');
  });

  it('calls onTabChange with the tab id when a tab is clicked', async () => {
    const user = userEvent.setup();
    const onTabChange = jest.fn();
    render(<CommunityNavigationBar activeTab="chat" onTabChange={onTabChange} unreadAssistantCount={0} botName="Berkie" />);

    await user.click(screen.getByRole('button', { name: 'Group Chat' }));
    expect(onTabChange).toHaveBeenCalledWith('chat');

    await user.click(screen.getByRole('button', { name: /Berkie/ }));
    expect(onTabChange).toHaveBeenCalledWith('assistant');
  });

  it('states the unread count in the Berkie tab aria-label when there are unread messages', () => {
    render(<CommunityNavigationBar activeTab="chat" onTabChange={jest.fn()} unreadAssistantCount={2} botName="Berkie" />);
    expect(screen.getByRole('button', { name: 'Berkie, 2 unread messages' })).toBeInTheDocument();
  });

  it('uses the singular form for exactly one unread message', () => {
    render(<CommunityNavigationBar activeTab="chat" onTabChange={jest.fn()} unreadAssistantCount={1} botName="Berkie" />);
    expect(screen.getByRole('button', { name: 'Berkie, 1 unread message' })).toBeInTheDocument();
  });

  it('does not mention unread count in the aria-label when there is none', () => {
    render(<CommunityNavigationBar activeTab="chat" onTabChange={jest.fn()} unreadAssistantCount={0} botName="Berkie" />);
    expect(screen.getByRole('button', { name: 'Berkie' })).toBeInTheDocument();
  });

  it('does not show the unread aria-label on the Berkie tab while it is active', () => {
    render(<CommunityNavigationBar activeTab="assistant" onTabChange={jest.fn()} unreadAssistantCount={3} botName="Berkie" />);
    expect(screen.getByRole('button', { name: 'Berkie' })).toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    const { container } = render(
      <CommunityNavigationBar activeTab="chat" onTabChange={jest.fn()} unreadAssistantCount={2} botName="Berkie" />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
