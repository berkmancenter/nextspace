import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NotificationBanner, Notification } from '../../components/NotificationBanner';

function makeNotification(overrides: Partial<Notification> = {}): Notification {
  return {
    id: 'jargon-terms',
    kind: 'jargonTerms',
    summary: '2 new terms: fungible, verticals',
    seen: false,
    onOpen: jest.fn(),
    onDismiss: jest.fn(),
    ...overrides,
  };
}

describe('NotificationBanner', () => {
  it('renders nothing when there is no notification', () => {
    const { container } = render(<NotificationBanner notification={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the summary text', () => {
    render(<NotificationBanner notification={makeNotification()} />);
    expect(screen.getByText('2 new terms: fungible, verticals')).toBeInTheDocument();
  });

  it('calls onOpen when the body is clicked', async () => {
    const user = userEvent.setup();
    const notification = makeNotification();
    render(<NotificationBanner notification={notification} />);

    await user.click(screen.getByRole('button', { name: /new terms/i }));

    expect(notification.onOpen).toHaveBeenCalledTimes(1);
    expect(notification.onDismiss).not.toHaveBeenCalled();
  });

  it('calls onDismiss, not onOpen, when the dismiss control is clicked', async () => {
    const user = userEvent.setup();
    const notification = makeNotification();
    render(<NotificationBanner notification={notification} />);

    await user.click(screen.getByRole('button', { name: /dismiss notification/i }));

    expect(notification.onDismiss).toHaveBeenCalledTimes(1);
    expect(notification.onOpen).not.toHaveBeenCalled();
  });
});
