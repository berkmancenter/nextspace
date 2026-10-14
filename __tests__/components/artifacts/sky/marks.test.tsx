import { render, screen } from '@testing-library/react';
import {
  PromptPillMark,
  QuoteLineMark,
  SelectedStarMark,
  StarMark,
  StatementDiamondMark,
  SummaryDiamondMark,
  SummaryLineMark,
} from '../../../../components/artifacts/sky/SkyMarks';

describe('sky marks', () => {
  it('are hidden from assistive tech unless given a title, which becomes their accessible name', () => {
    const { container, rerender } = render(<StarMark />);
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.queryByRole('img')).not.toBeInTheDocument();

    rerender(<StarMark title="Concept star" />);
    expect(screen.getByRole('img', { name: 'Concept star' })).toBeInTheDocument();
  });

  it('adds a ring to a selected star only', () => {
    const rings = (el: HTMLElement) => el.querySelectorAll('circle[fill="none"]').length;
    const plain = render(<StarMark />);
    const selected = render(<SelectedStarMark />);
    expect(rings(plain.container)).toBe(0);
    expect(rings(selected.container)).toBe(1);
  });

  it('draws a diamond solid when it has a quote and dashed when it is summary only', () => {
    const quote = render(<StatementDiamondMark />).container.querySelector('rect')!;
    const summary = render(<SummaryDiamondMark />).container.querySelector('rect')!;
    expect(quote).not.toHaveAttribute('stroke-dasharray');
    expect(summary).toHaveAttribute('stroke-dasharray');
  });

  it('fills a diamond with the link colour when asked, and with the sky colour otherwise', () => {
    const open = render(<StatementDiamondMark />).container.querySelector('rect')!;
    const filled = render(<StatementDiamondMark filled />).container.querySelector('rect')!;
    expect(open.getAttribute('fill')).toContain('surface-sky');
    expect(filled.getAttribute('fill')).toContain('link');
  });

  it('draws a line solid with a quote and dashed when summary only', () => {
    const quote = render(<QuoteLineMark />).container.querySelector('line')!;
    const summary = render(<SummaryLineMark width={28} />).container.querySelector('line')!;
    expect(quote).not.toHaveAttribute('stroke-dasharray');
    expect(summary).toHaveAttribute('stroke-dasharray');
  });

  it('draws an origin-prompt pill outlined in its colour, and filled with it when hot', () => {
    const rest = render(<PromptPillMark color="#abcdef" />).container.querySelector('rect')!;
    const hot = render(<PromptPillMark color="#abcdef" filled width={56} title="Origin prompt" />).container;
    expect(rest).toHaveAttribute('stroke', '#abcdef');
    expect(rest.getAttribute('fill')).toContain('surface-sky');
    expect(hot.querySelector('rect')).toHaveAttribute('fill', '#abcdef');
    expect(hot.querySelector('svg')).toHaveAttribute('height', '28');
  });
});
