import React from 'react';
import { render, screen } from '@testing-library/react';
import { useRouter } from 'next/router';
import { Layout } from '../../components/Layout';

jest.mock('next/router', () => ({ useRouter: jest.fn() }));

jest.mock('../../components/Header', () => ({
  Header: () => <div data-testid="app-header" />,
}));

jest.mock('../../components/Footer', () => ({
  Footer: () => <div data-testid="app-footer" />,
}));

const mockUseRouter = useRouter as jest.Mock;

describe('Layout', () => {
  beforeEach(() => jest.clearAllMocks());

  it('wraps an ordinary page in the app header and footer', () => {
    mockUseRouter.mockReturnValue({ pathname: '/admin/events', asPath: '/admin/events', isReady: true });

    render(
      <Layout>
        <p>page body</p>
      </Layout>,
    );

    expect(screen.getByTestId('app-header')).toBeInTheDocument();
    expect(screen.getByTestId('app-footer')).toBeInTheDocument();
  });

  it('leaves the community room to draw its own chrome', () => {
    mockUseRouter.mockReturnValue({ pathname: '/room/[conversationId]', asPath: '/room/room-1', isReady: true });

    render(
      <Layout>
        <p>room body</p>
      </Layout>,
    );

    expect(screen.queryByTestId('app-header')).not.toBeInTheDocument();
    expect(screen.queryByTestId('app-footer')).not.toBeInTheDocument();
    expect(screen.getByText('room body')).toBeInTheDocument();
  });

  it('leaves the lounge to draw its own chrome', () => {
    mockUseRouter.mockReturnValue({ pathname: '/lounge', asPath: '/lounge', isReady: true });

    render(
      <Layout>
        <p>lounge body</p>
      </Layout>,
    );

    expect(screen.queryByTestId('app-header')).not.toBeInTheDocument();
    expect(screen.queryByTestId('app-footer')).not.toBeInTheDocument();
    expect(screen.getByText('lounge body')).toBeInTheDocument();
  });
});
