import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { JargonTermsSheet } from '../../components/JargonTermsSheet';
import { JargonTerm } from '../../hooks/useJargonTerms';

const terms: JargonTerm[] = [
  {
    id: 'msg-1:0',
    term: 'fungible',
    definition: 'Interchangeable.',
    quote: '...fungible across teams...',
    createdAt: '2024-01-01T00:00:00Z',
  },
  { id: 'msg-1:1', term: 'verticals', definition: 'Industry sectors.', createdAt: '2024-01-01T00:00:00Z' },
];

describe('JargonTermsSheet', () => {
  it('renders nothing when closed', () => {
    render(<JargonTermsSheet open={false} onClose={jest.fn()} terms={terms} onManagePreferences={jest.fn()} />);

    expect(screen.queryByText('fungible')).not.toBeInTheDocument();
  });

  it('lists each term with its definition and optional quote when open', () => {
    render(<JargonTermsSheet open={true} onClose={jest.fn()} terms={terms} onManagePreferences={jest.fn()} />);

    expect(screen.getByText('New terms (2)')).toBeInTheDocument();
    expect(screen.getByText('fungible')).toBeInTheDocument();
    expect(screen.getByText('Interchangeable.')).toBeInTheDocument();
    expect(screen.getByText('“...fungible across teams...”')).toBeInTheDocument();
    expect(screen.getByText('verticals')).toBeInTheDocument();
    expect(screen.getByText('Industry sectors.')).toBeInTheDocument();
  });

  it('calls onClose (not a dismiss-shaped callback) from its own header close button', async () => {
    const user = userEvent.setup();
    const onClose = jest.fn();
    render(<JargonTermsSheet open={true} onClose={onClose} terms={terms} onManagePreferences={jest.fn()} />);

    await user.click(screen.getByRole('button', { name: /close/i }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onManagePreferences from the footer link', async () => {
    const user = userEvent.setup();
    const onManagePreferences = jest.fn();
    render(<JargonTermsSheet open={true} onClose={jest.fn()} terms={terms} onManagePreferences={onManagePreferences} />);

    await user.click(screen.getByText('Manage term alerts in Preferences'));

    expect(onManagePreferences).toHaveBeenCalledTimes(1);
  });
});
