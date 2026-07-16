import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { SectionCard } from '../../../components';

describe('SectionCard', () => {
  it('renders its title and children when expanded', () => {
    render(
      <SectionCard id="s1" title="Event Details" expanded onToggle={() => {}}>
        <p>Body content</p>
      </SectionCard>,
    );
    expect(screen.getByText('Event Details')).toBeInTheDocument();
    expect(screen.getByText('Body content')).toBeInTheDocument();
  });

  it('hides children when collapsed', () => {
    render(
      <SectionCard id="s1" title="Event Details" expanded={false} onToggle={() => {}}>
        <p>Body content</p>
      </SectionCard>,
    );
    expect(screen.queryByText('Body content')).not.toBeInTheDocument();
  });

  it('calls onToggle with the inverse of the current expanded state when the header is clicked', () => {
    const onToggle = jest.fn();
    render(
      <SectionCard id="s1" title="Event Details" expanded onToggle={onToggle}>
        <p>Body content</p>
      </SectionCard>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Event Details' }));
    expect(onToggle).toHaveBeenCalledWith(false);
  });

  it('renders an optional header chip', () => {
    render(
      <SectionCard id="s1" title="Schedule" expanded onToggle={() => {}} headerChip={<span>Needs attention</span>}>
        <p>Body content</p>
      </SectionCard>,
    );
    expect(screen.getByText('Needs attention')).toBeInTheDocument();
  });

  it('applies a flash animation class when flash is true', () => {
    render(
      <SectionCard id="s1" title="Schedule" expanded onToggle={() => {}} flash>
        <p>Body content</p>
      </SectionCard>,
    );
    expect(screen.getByTestId('section-card-s1')).toHaveClass('animate-card-flash');
  });

  it('does not apply the flash class by default', () => {
    render(
      <SectionCard id="s1" title="Schedule" expanded onToggle={() => {}}>
        <p>Body content</p>
      </SectionCard>,
    );
    expect(screen.getByTestId('section-card-s1')).not.toHaveClass('animate-card-flash');
  });
});
