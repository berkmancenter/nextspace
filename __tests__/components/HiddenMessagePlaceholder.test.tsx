import React from 'react';
import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { HiddenMessagePlaceholder, isHiddenStub } from '../../components/HiddenMessagePlaceholder';

describe('isHiddenStub', () => {
  it('is true only for a hidden message with a null body', () => {
    expect(isHiddenStub({ hidden: true, body: null })).toBe(true);
  });

  it.each([
    ['flagged but with a body', { hidden: true, body: { text: 'hi' } }],
    ['null body but not hidden', { hidden: false, body: null }],
    ['body missing', { hidden: true }],
    ['empty-string body', { hidden: true, body: '' }],
    ['plain message', { body: { text: 'hi' } }],
    ['hidden undefined with null body', { body: null }],
  ])('is false for %s', (_name, message) => {
    expect(isHiddenStub(message as any)).toBe(false);
  });
});

describe('HiddenMessagePlaceholder', () => {
  it('says plainly that a moderator removed the message', () => {
    render(<HiddenMessagePlaceholder />);
    expect(screen.getByTestId('hidden-message-placeholder')).toHaveTextContent('Message removed by a moderator');
    expect(screen.getByText('Message removed by a moderator')).toBeVisible();
  });

  it('has no accessibility violations', async () => {
    const { container } = render(<HiddenMessagePlaceholder />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
