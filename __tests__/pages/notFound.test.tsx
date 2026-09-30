import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { axe } from 'jest-axe';
import NotFoundPage from '../../pages/404';
import { AuthType } from '../../types.internal';

let mockAuthType: AuthType = 'guest';
jest.mock('../../utils/SessionManager', () => ({
  __esModule: true,
  default: {
    get: () => ({ getAuthType: () => mockAuthType }),
  },
}));

const mockGetConfig = jest.fn();
jest.mock('../../utils', () => ({
  Api: {
    get: () => ({ GetConfig: mockGetConfig }),
  },
}));

describe('NotFoundPage', () => {
  beforeEach(() => {
    mockAuthType = 'guest';
    mockGetConfig.mockReset();
    mockGetConfig.mockResolvedValue({ conversationBotName: 'Nova' });
  });

  it('tells the visitor the page could not be found', () => {
    render(<NotFoundPage />);

    expect(screen.getByRole('heading', { level: 1, name: 'Oops!' })).toBeInTheDocument();
  });

  it("names this deployment's agent rather than a hardcoded one", async () => {
    render(<NotFoundPage />);

    expect(await screen.findByText("Nova looked everywhere, but this page doesn't exist.")).toBeInTheDocument();
  });

  it('falls back to a message with no name when the agent name cannot be loaded', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    mockGetConfig.mockRejectedValue(new Error('Failed to fetch config'));

    render(<NotFoundPage />);

    await waitFor(() => expect(warn).toHaveBeenCalled());
    expect(screen.getByText("We looked everywhere, but this page doesn't exist.")).toBeInTheDocument();
    warn.mockRestore();
  });

  it('offers a community room member a way back to the hallway', () => {
    mockAuthType = 'user';

    render(<NotFoundPage />);

    expect(screen.getByRole('link', { name: 'Back to the hallway' })).toHaveAttribute('href', '/hallway');
    expect(screen.queryByRole('link', { name: 'Back to events' })).not.toBeInTheDocument();
  });

  it('offers an admin a way back to the events page instead', () => {
    mockAuthType = 'admin';

    render(<NotFoundPage />);

    expect(screen.getByRole('link', { name: 'Back to events' })).toHaveAttribute('href', '/admin/events');
    expect(screen.queryByRole('link', { name: 'Back to the hallway' })).not.toBeInTheDocument();
  });

  it('has no detectable accessibility violations', async () => {
    const { container } = render(<NotFoundPage />);
    await screen.findByText(/Nova looked everywhere/);

    expect(await axe(container)).toHaveNoViolations();
  });
});
