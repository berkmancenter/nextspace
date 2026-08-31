import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import LoungePage from '../../pages/lounge';
import { LoungeRoom } from '../../types.internal';

const mockRouter = {
  push: jest.fn(),
  isReady: true,
  pathname: '/lounge',
};

jest.mock('next/router', () => ({
  useRouter: () => mockRouter,
}));

const mockUseSessionJoin = jest.fn();
jest.mock('../../hooks/useSessionJoin', () => ({
  useSessionJoin: (...args: any[]) => mockUseSessionJoin(...args),
}));

const mockUseLoungeRooms = jest.fn();
jest.mock('../../hooks/useLoungeRooms', () => ({
  useLoungeRooms: (...args: any[]) => mockUseLoungeRooms(...args),
}));

const mockRetrieveData = jest.fn();
const mockGetTokens = jest.fn();

jest.mock('../../utils', () => ({
  Api: {
    get: jest.fn(() => ({
      GetTokens: (...args: any[]) => mockGetTokens(...args),
      getAccessToken: jest.fn(() => 'mock-access-token'),
    })),
  },
  RetrieveData: (...args: any[]) => mockRetrieveData(...args),
}));

function makeRoom(overrides: Partial<LoungeRoom> = {}): LoungeRoom {
  return {
    id: 'room-1',
    name: 'BKC Community Room',
    preview: 'Miriam Halevi: Morning all, the DSA transparency reports just dropped.',
    lastMessageAt: '2026-08-28T09:41:00.000Z',
    hasUnread: true,
    ...overrides,
  };
}

const fourRooms: LoungeRoom[] = [
  makeRoom(),
  makeRoom({
    id: 'room-2',
    name: 'Algorithmic Accountability WG',
    preview: 'You: Sent the draft agenda for review.',
    hasUnread: false,
  }),
  makeRoom({
    id: 'room-3',
    name: 'Digital Rights Reading Group',
    preview: 'Ethan Brooks: Anyone free to co-lead next week?',
  }),
  makeRoom({
    id: 'room-4',
    name: 'Platform Governance Cohort',
    preview: 'Berkie: Summary posted for last Tuesday.',
    hasUnread: false,
  }),
];

describe('Lounge page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetTokens.mockReturnValue({ access: 'token' });
    mockRetrieveData.mockResolvedValue({ pseudonyms: [{ pseudonym: 'Priya Raghunathan', isRealName: true }] });
    mockUseSessionJoin.mockReturnValue({ pseudonym: 'Trendy Impala', userId: 'my-user-id' });
    mockUseLoungeRooms.mockReturnValue({ rooms: fourRooms, loaded: true, error: null });
  });

  describe('the room list', () => {
    it('lists every room the member belongs to', async () => {
      render(<LoungePage />);

      expect(await screen.findByRole('button', { name: /BKC Community Room/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Algorithmic Accountability WG/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Digital Rights Reading Group/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Platform Governance Cohort/ })).toBeInTheDocument();
    });

    it('opens a room when its row is tapped', async () => {
      render(<LoungePage />);

      await userEvent.click(await screen.findByRole('button', { name: /BKC Community Room/ }));

      expect(mockRouter.push).toHaveBeenCalledWith('/room/room-1');
    });

    it('says so when the member has no rooms', async () => {
      mockUseLoungeRooms.mockReturnValue({ rooms: [], loaded: true, error: null });
      render(<LoungePage />);

      expect(await screen.findByText('You are not in any rooms yet.')).toBeInTheDocument();
    });

    it('offers no way to browse or join a room, since rooms arrive by invitation', async () => {
      render(<LoungePage />);

      await screen.findByRole('button', { name: /BKC Community Room/ });
      expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /invite code/ })).not.toBeInTheDocument();
    });

    it('shows a message when the rooms could not be loaded', async () => {
      mockUseLoungeRooms.mockReturnValue({ rooms: [], loaded: true, error: 'Could not load your rooms.' });
      render(<LoungePage />);

      expect(await screen.findByRole('alert')).toHaveTextContent('Could not load your rooms.');
    });
  });

  describe('the header', () => {
    it('names the space, with the screen named below it', async () => {
      render(<LoungePage />);

      expect(await screen.findByRole('heading', { name: 'BKC Community Rooms' })).toBeInTheDocument();
      expect(screen.getByText('Your rooms')).toBeInTheDocument();
    });

    it("shows the member's own initials", async () => {
      render(<LoungePage />);

      expect(await screen.findByRole('button', { name: 'Your account, Priya Raghunathan' })).toBeInTheDocument();
      expect(screen.getByText('PR')).toBeInTheDocument();
    });

    it('falls back to the session name when the account cannot be read', async () => {
      mockRetrieveData.mockResolvedValue({ error: true, status: 403 });
      render(<LoungePage />);

      expect(await screen.findByRole('button', { name: 'Your account, Trendy Impala' })).toBeInTheDocument();
    });
  });

  describe('the bottom navigation', () => {
    it('marks the lounge as the current screen', async () => {
      render(<LoungePage />);

      const lounge = await screen.findByRole('link', { name: 'Lounge' });
      expect(lounge).toHaveAttribute('aria-current', 'page');
    });

    it('links to the profile screen', async () => {
      render(<LoungePage />);

      expect(await screen.findByRole('link', { name: 'Profile' })).toHaveAttribute('href', '/profile');
    });
  });

  it('has no accessibility violations', async () => {
    const { container } = render(<LoungePage />);

    await screen.findByRole('heading', { name: 'BKC Community Rooms' });
    await waitFor(async () => {
      expect(await axe(container)).toHaveNoViolations();
    });
  });
});
