jest.mock('../../utils/analytics', () => ({
  trackEvent: jest.fn(),
  trackConversationEvent: jest.fn(),
}));

import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { denseConceptGraphFixture, seriesConceptGraphFixture } from '../../content/conceptGraphFixture';
import { ConceptGraphView } from '../../components/artifacts/ConceptGraphView';
import { ConceptGraphPayload } from '../../types.internal';

/* Panel, hover-card, filter and list behaviours the main view suite does not reach: the panel's
   variants (prompt text that needs shortening, a prompt that led nowhere, a summary-only
   contribution with an origin), the hover card per kind, and the list's empty and singular wording. */
function mockMedia({ narrow = false } = {}) {
  window.matchMedia = jest.fn().mockImplementation((query: string) => ({
    matches: query.includes('max-width') ? narrow : false,
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
});

const panel = () => screen.getByRole('complementary', { name: 'Reading panel' });
const star = (label: string) => screen.getByRole('button', { name: new RegExp(`^${label}, concept`) });

const LONG_PROMPT =
  'What would it take for you to hand a decision that matters to you over to a system you cannot question?';

const graph: ConceptGraphPayload = {
  originPrompts: [
    { id: 'p-long', text: LONG_PROMPT },
    { id: 'p-only-contribution', text: 'Where does it break?' },
    { id: 'p-nothing', text: 'Anything else?' },
  ],
  concepts: [
    { id: 'c-a', label: 'Autonomy', origin: 'p-long' },
    { id: 'c-b', label: 'Oversight' },
    { id: 'c-c', label: 'Recourse' },
  ],
  contributions: [
    // Summary only, with an origin: a dashed line.
    { id: 'k-summary', kind: 'strains', concepts: ['c-a', 'c-b'], origin: 'p-only-contribution' },
    // Quote, no origin: a diamond.
    { id: 'k-quote', kind: 'needs', concepts: ['c-a', 'c-b', 'c-c'], statement: 'Somebody has to be able to say no.' },
  ],
};

describe('the concept panel', () => {
  it('shortens a long origin prompt on its chip, which still opens the whole prompt', async () => {
    const user = userEvent.setup();
    render(<ConceptGraphView payload={graph} />);

    await user.click(star('Autonomy'));
    const chip = within(panel()).getByRole('button', { name: /^What would it take/ });
    expect(chip.textContent).toHaveLength(70);
    expect(chip.textContent?.endsWith('…')).toBe(true);

    await user.click(chip);
    expect(within(panel()).getByRole('heading', { name: LONG_PROMPT })).toBeInTheDocument();
  });

  it('leaves out the origin section for a concept with no origin, and lists only the contributions it touches', async () => {
    const user = userEvent.setup();
    render(<ConceptGraphView payload={graph} />);

    await user.click(star('Recourse'));
    expect(within(panel()).queryByText('Origin prompt')).not.toBeInTheDocument();
    expect(within(panel()).getByRole('button', { name: 'Needs' })).toBeInTheDocument();
    expect(within(panel()).queryByRole('button', { name: 'Strains' })).not.toBeInTheDocument();
  });

  it('shows only the contributions inside the chosen session', async () => {
    const user = userEvent.setup();
    render(<ConceptGraphView payload={seriesConceptGraphFixture} />);

    await user.click(star('The Assistant'));
    expect(within(panel()).getByRole('button', { name: 'Requires' })).toBeInTheDocument();
    expect(within(panel()).getByRole('button', { name: 'Meets' })).toBeInTheDocument();

    await user.selectOptions(screen.getByRole('combobox', { name: /show/i }), 'Session 2');
    expect(within(panel()).queryByRole('button', { name: 'Requires' })).not.toBeInTheDocument();
    expect(within(panel()).getByRole('button', { name: 'Meets' })).toBeInTheDocument();

    await user.selectOptions(screen.getByRole('combobox', { name: /show/i }), 'Full series');
    expect(within(panel()).getByRole('button', { name: 'Requires' })).toBeInTheDocument();
  });
});

describe('the contribution panel', () => {
  it('says a summary-only contribution has no quote, and still offers its origin prompt and concepts', async () => {
    const user = userEvent.setup();
    render(<ConceptGraphView payload={graph} />);

    await user.click(screen.getByRole('button', { name: /^Strains, summary only/ }));
    const p = panel();
    expect(within(p).getByText('Summary-only contribution · joins 2')).toBeInTheDocument();
    expect(within(p).getByText(/There is no direct quote/)).toBeInTheDocument();
    expect(within(p).getByRole('button', { name: 'Where does it break?' })).toBeInTheDocument();
    expect(within(p).getByRole('button', { name: 'Autonomy' })).toBeInTheDocument();
    expect(within(p).getByRole('button', { name: 'Oversight' })).toBeInTheDocument();
  });

  it('leaves out the origin section for a quoted contribution with no origin', async () => {
    const user = userEvent.setup();
    render(<ConceptGraphView payload={graph} />);

    await user.click(screen.getByRole('button', { name: /^Needs, quote/ }));
    const p = panel();
    expect(within(p).getByText('Contribution with a quote · joins 3')).toBeInTheDocument();
    expect(within(p).getByText('Somebody has to be able to say no.')).toBeInTheDocument();
    expect(within(p).queryByText('Origin prompt')).not.toBeInTheDocument();
  });

  it('closes back to the explainer', async () => {
    const user = userEvent.setup();
    render(<ConceptGraphView payload={graph} />);

    await user.click(screen.getByRole('button', { name: /^Needs, quote/ }));
    await user.click(within(panel()).getByRole('button', { name: 'Close contribution' }));
    expect(within(panel()).getByText('Reading the sky')).toBeInTheDocument();
  });
});

describe('the origin prompt panel', () => {
  const only = (prompt: { id: string; text: string }, rest: Partial<ConceptGraphPayload>): ConceptGraphPayload => ({
    originPrompts: [prompt],
    concepts: [],
    contributions: [],
    ...rest,
  });

  it('lists the contributions that came out of a prompt that produced no concept, each opening its own panel', async () => {
    const user = userEvent.setup();
    render(
      <ConceptGraphView
        payload={only(graph.originPrompts[1], {
          concepts: graph.concepts,
          contributions: [graph.contributions[0]],
        })}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Origin prompt, led to 0' }));
    expect(within(panel()).getByRole('heading', { name: 'Where does it break?' })).toBeInTheDocument();
    expect(within(panel()).queryByText('Concepts that came out of it')).not.toBeInTheDocument();
    expect(within(panel()).getByText('Contributions that came out of it')).toBeInTheDocument();

    await user.click(within(panel()).getByRole('button', { name: 'Strains' }));
    expect(within(panel()).getByText('Summary-only contribution · joins 2')).toBeInTheDocument();
  });

  it('shows neither list for a prompt that led nowhere', async () => {
    const user = userEvent.setup();
    render(<ConceptGraphView payload={only(graph.originPrompts[2], { concepts: graph.concepts })} />);

    await user.click(screen.getByRole('button', { name: 'Origin prompt, led to 0' }));
    expect(within(panel()).getByRole('heading', { name: 'Anything else?' })).toBeInTheDocument();
    expect(within(panel()).queryByText('Concepts that came out of it')).not.toBeInTheDocument();
    expect(within(panel()).queryByText('Contributions that came out of it')).not.toBeInTheDocument();
    expect(within(panel()).getByRole('button', { name: 'Close prompt' })).toBeInTheDocument();
  });
});

describe('the hover card', () => {
  it('describes a summary-only contribution by its relation and the concepts it joins', () => {
    render(<ConceptGraphView payload={graph} />);

    fireEvent.focus(screen.getByRole('button', { name: /^Strains, summary only/ }));
    expect(screen.getByText('Summary only · joins 2')).toBeInTheDocument();
    expect(screen.getByText('Autonomy, Oversight')).toBeInTheDocument();
  });

  it('describes a quoted contribution as a quote', () => {
    render(<ConceptGraphView payload={graph} />);

    fireEvent.focus(screen.getByRole('button', { name: /^Needs, quote/ }));
    expect(screen.getByText('Quote · joins 3')).toBeInTheDocument();
  });

  it('describes an origin prompt by how many concepts it led to, naming its session on a series', () => {
    const { unmount } = render(<ConceptGraphView payload={graph} />);
    fireEvent.focus(screen.getAllByRole('button', { name: /^Origin prompt, led to 1/ })[0]);
    expect(screen.getByText('Led to 1 concept')).toBeInTheDocument();
    expect(screen.getByText('Select to read the prompt.')).toBeInTheDocument();
    unmount();

    render(<ConceptGraphView payload={seriesConceptGraphFixture} />);
    fireEvent.focus(screen.getAllByRole('button', { name: /^Origin prompt, session 1, led to 1/ })[0]);
    expect(screen.getByText('Origin prompt · Session 1')).toBeInTheDocument();
  });

  it('says "1 contribution touches" for a concept with one', () => {
    render(<ConceptGraphView payload={graph} />);

    fireEvent.focus(star('Recourse'));
    expect(screen.getByText(/^1 contribution touches this concept/)).toBeInTheDocument();
  });
});

describe('Orbit labels on a crowded graph', () => {
  it('thins labels, but a star brings its own back when it is focused', () => {
    const { container } = render(<ConceptGraphView payload={denseConceptGraphFixture} />);

    const stars = () => [...container.querySelectorAll('[data-concept-id]')];
    fireEvent.click(star(denseConceptGraphFixture.concepts[0].label));
    fireEvent.click(within(panel()).getByRole('button', { name: 'Center the sky here' }));

    const thinned = stars().find((g) => !g.querySelector('text'));
    expect(thinned).toBeDefined();
    fireEvent.focus(thinned!);
    expect(thinned!.querySelector('text')).toBeInTheDocument();
  }, 20000);
});

describe('List', () => {
  beforeEach(() => mockMedia({ narrow: true }));

  it('says there is nothing to list when the chosen session has no concept yet', async () => {
    const user = userEvent.setup();
    const thirdId = seriesConceptGraphFixture.concepts[4].provenance!.conversationId;
    const inLaterSession = (n: { provenance?: { conversationId?: string } }) => n.provenance?.conversationId === thirdId;
    const dropped = new Set(seriesConceptGraphFixture.concepts.filter(inLaterSession).map((c) => c.id));
    render(
      <ConceptGraphView
        payload={{
          ...seriesConceptGraphFixture,
          concepts: seriesConceptGraphFixture.concepts.filter((c) => !dropped.has(c.id)),
          contributions: seriesConceptGraphFixture.contributions
            .filter((k) => !inLaterSession(k))
            .map((k) => ({ ...k, concepts: k.concepts.filter((id) => !dropped.has(id)) })),
        }}
      />,
    );

    await user.selectOptions(screen.getByRole('combobox', { name: /show/i }), 'Session 3');
    expect(screen.getByText('Nothing here yet.')).toBeInTheDocument();
    expect(document.querySelector('ol')).not.toBeInTheDocument();
  });

  it('uses the singular for one connection and one contribution, and omits the prompts heading when there are none', () => {
    const payload: ConceptGraphPayload = {
      originPrompts: [],
      concepts: [
        { id: 'a', label: 'Alpha' },
        { id: 'b', label: 'Beta' },
      ],
      contributions: [{ id: 'k', kind: 'meets', concepts: ['a', 'b'] }],
    };
    render(<ConceptGraphView payload={payload} />);

    const items = within(document.querySelector('ol') as HTMLElement).getAllByRole('listitem');
    expect(items[0]).toHaveTextContent('1 connection · 1 contribution');
    expect(screen.queryByRole('heading', { name: 'Origin prompts' })).not.toBeInTheDocument();
  });

  it('marks the selected prompt as pressed and opens it in the panel', async () => {
    const user = userEvent.setup();
    render(<ConceptGraphView payload={graph} />);

    const entry = screen.getByRole('button', { name: LONG_PROMPT });
    expect(entry).toHaveAttribute('aria-pressed', 'false');
    await user.click(entry);
    expect(screen.getByRole('button', { name: LONG_PROMPT, pressed: true })).toBeInTheDocument();
    expect(within(panel()).getByRole('heading', { name: LONG_PROMPT })).toBeInTheDocument();
  });
});
