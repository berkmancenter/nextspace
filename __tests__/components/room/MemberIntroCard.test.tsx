import React from 'react';
import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { MemberIntroCard } from '../../../components/room/MemberIntroCard';

describe('MemberIntroCard', () => {
  const baseProps = {
    name: 'Lucía Navarro',
    role: 'Affiliate',
    joinedLabel: 'joined today',
    bio: "Works on public-interest AI procurement in Latin America. Previously at Chile's data protection authority.",
    botName: 'Berkie',
  };

  it('renders as a labelled group so it reads as one introduction unit', () => {
    render(<MemberIntroCard {...baseProps} />);
    expect(screen.getByRole('group', { name: 'Introduction posted by Berkie' })).toBeInTheDocument();
  });

  it("shows the member's name, role, and join label", () => {
    render(<MemberIntroCard {...baseProps} />);
    expect(screen.getByText('Lucía Navarro')).toBeInTheDocument();
    expect(screen.getByText('Affiliate · joined today')).toBeInTheDocument();
  });

  it('shows the bio text', () => {
    render(<MemberIntroCard {...baseProps} />);
    expect(screen.getByText(baseProps.bio)).toBeInTheDocument();
  });

  it("shows the member's initials in the avatar", () => {
    render(<MemberIntroCard {...baseProps} />);
    expect(screen.getByText('LN')).toBeInTheDocument();
  });

  it('states the provenance and one-time-post rule', () => {
    render(<MemberIntroCard {...baseProps} />);
    expect(
      screen.getByText("From the bio Lucía wrote when they joined. Posted once. Berkie won't mention it again."),
    ).toBeInTheDocument();
  });

  it('uses only the first name in the provenance line', () => {
    render(<MemberIntroCard {...baseProps} name="Lucía Navarro Ibáñez" />);
    expect(screen.getByText(/^From the bio Lucía wrote/)).toBeInTheDocument();
  });

  it('shows the join label alone when no role is given', () => {
    render(<MemberIntroCard {...baseProps} role={undefined} />);
    expect(screen.getByText('joined today')).toBeInTheDocument();
    expect(screen.queryByText(/Affiliate/)).not.toBeInTheDocument();
  });

  it('omits the role/join line entirely when neither is given', () => {
    render(<MemberIntroCard {...baseProps} role={undefined} joinedLabel={undefined} />);
    expect(screen.queryByText(/joined today/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Affiliate/)).not.toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    const { container } = render(<MemberIntroCard {...baseProps} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
