import React from 'react';
import { render, screen } from '@testing-library/react';
import { QuickGuideIconButton } from '../../components/QuickGuideIconButton';

jest.mock('next/router', () => ({
  useRouter: () => ({
    query: { conversationId: 'abc-123' },
  }),
}));

describe('QuickGuideIconButton', () => {
  it('renders a link to the guide page for the current conversation', () => {
    render(<QuickGuideIconButton />);
    const link = screen.getByRole('link', { name: /open quick guide/i });
    expect(link).toHaveAttribute('href', '/guide/abc-123');
  });

  it('opens in a new tab with safe rel attributes', () => {
    render(<QuickGuideIconButton />);
    const link = screen.getByRole('link', { name: /open quick guide/i });
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('renders icon-only with aria-label when showLabel is false', () => {
    render(<QuickGuideIconButton showLabel={false} />);
    expect(screen.getByRole('link', { name: 'Open quick guide' })).toBeInTheDocument();
    expect(screen.queryByText('Quick Guide')).not.toBeInTheDocument();
  });

  it("renders visible 'Quick Guide' label when showLabel is true", () => {
    render(<QuickGuideIconButton showLabel={true} />);
    expect(screen.getByText('Quick Guide')).toBeInTheDocument();
  });
});
