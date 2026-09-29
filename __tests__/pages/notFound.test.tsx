import React from 'react';
import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import NotFoundPage from '../../pages/404';

describe('NotFoundPage', () => {
  it('tells the visitor the page could not be found', () => {
    render(<NotFoundPage />);

    expect(screen.getByRole('heading', { level: 1, name: 'Oops!' })).toBeInTheDocument();
    expect(screen.getByText("Berkie looked everywhere, but this page doesn't exist.")).toBeInTheDocument();
  });

  it('offers a way back to the lounge', () => {
    render(<NotFoundPage />);

    expect(screen.getByRole('link', { name: 'Back to the lounge' })).toHaveAttribute('href', '/lounge');
  });

  it('has no detectable accessibility violations', async () => {
    const { container } = render(<NotFoundPage />);

    expect(await axe(container)).toHaveNoViolations();
  });
});
