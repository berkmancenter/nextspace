import React from 'react';
import { render, screen } from '@testing-library/react';
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

describe('NotFoundPage', () => {
  beforeEach(() => {
    mockAuthType = 'guest';
  });

  it('tells the visitor the page could not be found', () => {
    render(<NotFoundPage />);

    expect(screen.getByRole('heading', { level: 1, name: 'Oops!' })).toBeInTheDocument();
    expect(screen.getByText("Berkie looked everywhere, but this page doesn't exist.")).toBeInTheDocument();
  });

  it('offers a community room member a way back to the lounge', () => {
    mockAuthType = 'user';

    render(<NotFoundPage />);

    expect(screen.getByRole('link', { name: 'Back to the lounge' })).toHaveAttribute('href', '/lounge');
    expect(screen.queryByRole('link', { name: 'Back to events' })).not.toBeInTheDocument();
  });

  it('offers an admin a way back to the events page instead', () => {
    mockAuthType = 'admin';

    render(<NotFoundPage />);

    expect(screen.getByRole('link', { name: 'Back to events' })).toHaveAttribute('href', '/admin/events');
    expect(screen.queryByRole('link', { name: 'Back to the lounge' })).not.toBeInTheDocument();
  });

  it('has no detectable accessibility violations', async () => {
    const { container } = render(<NotFoundPage />);

    expect(await axe(container)).toHaveNoViolations();
  });
});
