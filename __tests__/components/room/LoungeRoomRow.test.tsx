import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { LoungeRoomRow, formatLoungeTimestamp } from '../../../components/room/LoungeRoomRow';
import { LoungeRoom } from '../../../types.internal';

function makeRoom(overrides: Partial<LoungeRoom> = {}): LoungeRoom {
  return {
    id: 'room-1',
    name: 'BKC Community Room',
    preview: 'Miriam Halevi: Morning all, the DSA transparency reports just dropped.',
    lastMessageAt: '2026-08-28T09:41:00.000Z',
    hasUnread: false,
    ...overrides,
  };
}

describe('LoungeRoomRow', () => {
  describe('what it shows', () => {
    it('shows the room name, its initials and the last message', () => {
      render(<LoungeRoomRow room={makeRoom()} onOpen={jest.fn()} />);

      expect(screen.getByText('BKC Community Room')).toBeInTheDocument();
      expect(screen.getByText('BK')).toBeInTheDocument();
      expect(screen.getByText('Miriam Halevi: Morning all, the DSA transparency reports just dropped.')).toBeInTheDocument();
    });

    it('says so when a room has no messages yet', () => {
      render(<LoungeRoomRow room={makeRoom({ preview: '', lastMessageAt: null })} onOpen={jest.fn()} />);

      expect(screen.getByText('No messages yet')).toBeInTheDocument();
    });
  });

  describe('the unread indicator', () => {
    it('names the unread state in the accessible name', () => {
      render(<LoungeRoomRow room={makeRoom({ hasUnread: true })} onOpen={jest.fn()} />);

      expect(screen.getByRole('button', { name: /BKC Community Room, unread messages/ })).toBeInTheDocument();
    });

    it('leaves the accessible name unqualified when everything has been read', () => {
      render(<LoungeRoomRow room={makeRoom({ hasUnread: false })} onOpen={jest.fn()} />);

      const button = screen.getByRole('button', { name: /BKC Community Room/ });
      expect(button).toHaveAccessibleName(expect.stringContaining('BKC Community Room'));
      expect(button.getAttribute('aria-label')).not.toContain('unread');
    });

    it('hides the dot itself from assistive technology', () => {
      const { container } = render(<LoungeRoomRow room={makeRoom({ hasUnread: true })} onOpen={jest.fn()} />);

      const dot = container.querySelector('[aria-hidden="true"][class*="loungeUnreadDot"]');
      expect(dot).toBeInTheDocument();
    });

    it('draws no dot when everything has been read', () => {
      const { container } = render(<LoungeRoomRow room={makeRoom({ hasUnread: false })} onOpen={jest.fn()} />);

      expect(container.querySelector('[class*="loungeUnreadDot"]')).not.toBeInTheDocument();
    });
  });

  describe('opening a room', () => {
    it('passes the room id up when tapped', async () => {
      const onOpen = jest.fn();
      render(<LoungeRoomRow room={makeRoom()} onOpen={onOpen} />);

      await userEvent.click(screen.getByRole('button', { name: /BKC Community Room/ }));

      expect(onOpen).toHaveBeenCalledWith('room-1');
    });
  });

  it('has no accessibility violations', async () => {
    const { container } = render(<LoungeRoomRow room={makeRoom({ hasUnread: true })} onOpen={jest.fn()} />);

    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('formatLoungeTimestamp', () => {
  const now = new Date('2026-08-28T14:00:00.000Z');

  it('shows a clock time for a message sent today', () => {
    expect(formatLoungeTimestamp('2026-08-28T09:41:00.000Z', now)).toMatch(/\d{1,2}:\d{2}\s?(AM|PM)/i);
  });

  it('says Yesterday for a message sent the day before', () => {
    expect(formatLoungeTimestamp('2026-08-27T09:41:00.000Z', now)).toBe('Yesterday');
  });

  it('names the weekday for a message sent earlier in the week', () => {
    expect(formatLoungeTimestamp('2026-08-24T09:41:00.000Z', now)).toBe('Mon');
  });

  it('gives a date for anything older than a week', () => {
    expect(formatLoungeTimestamp('2026-07-04T09:41:00.000Z', now)).toBe('4 Jul');
  });

  it('returns an empty string when there is no timestamp', () => {
    expect(formatLoungeTimestamp(null, now)).toBe('');
  });
});
