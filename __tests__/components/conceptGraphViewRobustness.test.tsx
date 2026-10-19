jest.mock('../../utils/analytics', () => ({
  trackEvent: jest.fn(),
  trackConversationEvent: jest.fn(),
}));
jest.mock('../../components/artifacts/sky/visibleLabels', () => {
  const actual = jest.requireActual('../../components/artifacts/sky/visibleLabels');
  return { ...actual, visibleLabels: jest.fn(actual.visibleLabels) };
});

import { act, fireEvent, render, screen } from '@testing-library/react';
import { ConceptGraphView } from '../../components/artifacts/ConceptGraphView';
import { visibleLabels } from '../../components/artifacts/sky/visibleLabels';
import { ConceptGraphPayload } from '../../types.internal';
import { ORBIT_DURATION_MS } from '../../utils/conceptSky';

/* jsdom has no matchMedia: stub the two queries the view reads. */
function mockMedia({ reduce = false } = {}) {
  window.matchMedia = jest.fn().mockImplementation((query: string) => ({
    matches: query.includes('reduced-motion') ? reduce : false,
    media: query,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    addListener: jest.fn(),
    removeListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })) as unknown as typeof window.matchMedia;
}

beforeEach(() => mockMedia());
afterEach(() => {
  delete (window as { matchMedia?: unknown }).matchMedia;
  jest.useRealTimers();
  jest.clearAllMocks();
});

const graph: ConceptGraphPayload = {
  originPrompts: [{ id: 'p1', text: 'What has to be trustworthy here?' }],
  concepts: [
    { id: 'c-issuer', label: 'Issuer', origin: 'p1' },
    { id: 'c-verifier', label: 'Verifier' },
    { id: 'c-holder', label: 'Holder' },
  ],
  contributions: [{ id: 'k1', kind: 'co-governs', concepts: ['c-issuer', 'c-verifier'] }],
};

describe('ConceptGraphView with a payload missing its arrays', () => {
  it('renders the empty state for an empty object', () => {
    render(<ConceptGraphView payload={{} as any} />);
    expect(screen.getByText(/empty so far/i)).toBeInTheDocument();
  });

  it.each(['concepts', 'contributions', 'originPrompts'] as const)('does not crash without %s', (key) => {
    const partial: Partial<ConceptGraphPayload> = { ...graph };
    delete partial[key];
    expect(() => render(<ConceptGraphView payload={partial as any} />)).not.toThrow();
    if (key === 'concepts') expect(screen.getByText(/empty so far/i)).toBeInTheDocument();
    else expect(screen.getByRole('button', { name: /^Issuer, concept/ })).toBeInTheDocument();
  });
});

describe('Orbit glide', () => {
  it('thins labels once for the glide, not once per animation frame', () => {
    jest.useFakeTimers();
    render(<ConceptGraphView payload={graph} />);
    fireEvent.click(screen.getByRole('button', { name: 'Orbit' }));
    const afterEntering = (visibleLabels as jest.Mock).mock.calls.length;
    expect(afterEntering).toBeGreaterThan(0);

    const frames = Math.ceil(ORBIT_DURATION_MS / 16) + 5;
    for (let i = 0; i < frames; i++) act(() => void jest.advanceTimersByTime(16));

    expect((visibleLabels as jest.Mock).mock.calls.length).toBe(afterEntering);
  });
});
