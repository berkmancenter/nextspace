jest.mock('../../utils/analytics', () => ({
  trackEvent: jest.fn(),
  trackConversationEvent: jest.fn(),
  deleteCustomDimension: jest.fn(),
}));

import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  conceptGraphFixture,
  denseConceptGraphFixture,
  emptyConceptGraphFixture,
  longSeriesConceptGraphFixture,
  seriesConceptGraphFixture,
} from '../../content/conceptGraphFixture';
import { ConceptGraphView } from '../../components/artifacts/ConceptGraphView';
import { DWELL_MS, SkyCanvas } from '../../components/artifacts/sky/SkyCanvas';
import { buildScene } from '../../components/artifacts/sky/scene';
import { filterSky, layoutSky } from '../../utils/conceptSky';
import { trackConversationEvent, trackEvent } from '../../utils/analytics';
import { ConceptGraphPayload } from '../../types.internal';

/* jsdom lays nothing out and has no matchMedia, so the two media queries the view reads are
   stubbed: narrow screens default to the list, and reduced motion makes Orbit jump. These
   tests therefore go through the DOM structure and aria labels, not pixels. */
function mockMedia({ narrow = false, reduce = false } = {}) {
  window.matchMedia = jest.fn().mockImplementation((query: string) => ({
    matches: query.includes('max-width') ? narrow : query.includes('reduced-motion') ? reduce : false,
    media: query,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    addListener: jest.fn(),
    removeListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })) as unknown as typeof window.matchMedia;
}

beforeEach(() => {
  mockMedia();
});

afterEach(() => {
  delete (window as { matchMedia?: unknown }).matchMedia;
});

const star = (label: string) => screen.getByRole('button', { name: new RegExp(`^${label}, concept`) });
const starGroup = (container: HTMLElement, id: string) => container.querySelector(`[data-concept-id="${id}"]`)!;
const panel = () => screen.getByRole('complementary', { name: 'Reading panel' });

const graph: ConceptGraphPayload = {
  originPrompts: [{ id: 'p1', text: 'What has to be trustworthy here?' }],
  concepts: [
    { id: 'c-issuer', label: 'Issuer', origin: 'p1', gloss: 'The party that vouches for a credential.' },
    { id: 'c-verifier', label: 'Verifier' },
    { id: 'c-holder', label: 'Holder', foldedFrom: ['Wallet owner'] },
  ],
  contributions: [
    { id: 'k1', kind: 'co-governs', concepts: ['c-issuer', 'c-verifier'] },
    {
      id: 'k2',
      kind: 'depends on',
      concepts: ['c-issuer', 'c-verifier', 'c-holder'],
      statement: 'Nobody trusts the credential until all three of them agree on what it means.',
      origin: 'p1',
    },
  ],
};

describe('ConceptGraphView', () => {
  it('draws every concept as a focusable button labelled with its connection count', () => {
    render(<ConceptGraphView payload={graph} />);

    // Issuer is joined to Verifier and Holder.
    const issuer = star('Issuer');
    expect(issuer).toHaveAttribute('tabindex', '0');
    expect(issuer).toHaveAccessibleName('Issuer, concept, 2 connections');
    expect(star('Holder')).toHaveAccessibleName('Holder, concept, 2 connections');
  });

  it('draws a two-concept contribution as a line and a three-concept one as a diamond, both buttons', () => {
    render(<ConceptGraphView payload={graph} />);

    expect(screen.getByRole('button', { name: 'Co-governs, summary only, joins Issuer and Verifier' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Depends on, quote, joins Issuer, Verifier and Holder' })).toBeInTheDocument();
  });

  it('opens the reading panel on a click, and clears it on a second click', async () => {
    const user = userEvent.setup();
    render(<ConceptGraphView payload={graph} />);

    expect(within(panel()).getByText('Reading the sky')).toBeInTheDocument();

    await user.click(star('Issuer'));
    expect(within(panel()).getByText('Concept · joins 2')).toBeInTheDocument();
    expect(within(panel()).getByRole('heading', { name: 'Issuer' })).toBeInTheDocument();
    expect(star('Issuer')).toHaveAttribute('aria-pressed', 'true');

    await user.click(star('Issuer'));
    expect(within(panel()).getByText('Reading the sky')).toBeInTheDocument();
  });

  it('selects with Enter and Space, and clears with Escape', async () => {
    const user = userEvent.setup();
    render(<ConceptGraphView payload={graph} />);

    act(() => star('Verifier').focus());
    await user.keyboard('{Enter}');
    expect(within(panel()).getByRole('heading', { name: 'Verifier' })).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(within(panel()).getByText('Reading the sky')).toBeInTheDocument();

    act(() => star('Holder').focus());
    await user.keyboard(' ');
    expect(within(panel()).getByRole('heading', { name: 'Holder' })).toBeInTheDocument();
  });

  it('is an aria-live region, so a screen reader hears what a selection opened', () => {
    render(<ConceptGraphView payload={graph} />);
    expect(panel()).toHaveAttribute('aria-live', 'polite');
  });

  it('shows a card beside a hovered or focused star', () => {
    render(<ConceptGraphView payload={graph} />);

    fireEvent.focus(star('Issuer'));
    expect(screen.getByText(/2 contributions touch this concept/)).toBeInTheDocument();
    fireEvent.blur(star('Issuer'));
    expect(screen.queryByText(/contributions touch this concept/)).not.toBeInTheDocument();
  });

  it('dims everything outside a hovered star’s constellation', () => {
    const { container } = render(<ConceptGraphView payload={denseConceptGraphFixture} />);
    const stars = [...container.querySelectorAll('[data-concept-id]')];
    expect(stars.every((s) => s.getAttribute('opacity') === '1')).toBe(true);

    fireEvent.focus(stars[0]);
    const opacities = new Set([...container.querySelectorAll('[data-concept-id]')].map((s) => s.getAttribute('opacity')));
    expect(opacities).toEqual(new Set(['1', '0.22']));
  });

  describe('the concept panel', () => {
    it('sets the gloss under the name, then what the concept encompasses, then one section per contribution', async () => {
      const user = userEvent.setup();
      render(<ConceptGraphView payload={graph} />);

      await user.click(star('Issuer'));
      const p = panel();
      expect(within(p).getByText('The party that vouches for a credential.')).toBeInTheDocument();
      // Capitalised from the generator's lowercase phrase, as the design shows "Distinguishes".
      expect(within(p).getByRole('button', { name: 'Co-governs' })).toBeInTheDocument();
      expect(within(p).getByRole('button', { name: 'Depends on' })).toBeInTheDocument();
      expect(within(p).getByText(/Nobody trusts the credential/)).toBeInTheDocument();

      await user.click(star('Holder'));
      expect(within(panel()).getByText('Also encompasses Wallet owner')).toBeInTheDocument();
    });

    it('says a contribution with no quote is summary only', async () => {
      const user = userEvent.setup();
      render(<ConceptGraphView payload={graph} />);

      await user.click(star('Verifier'));
      expect(within(panel()).getByText('Summary only. There is no direct quote for this contribution.')).toBeInTheDocument();
    });

    it('jumps to another concept from its chip', async () => {
      const user = userEvent.setup();
      render(<ConceptGraphView payload={graph} />);

      await user.click(star('Issuer'));
      await user.click(within(panel()).getAllByRole('button', { name: 'Holder' })[0]);
      expect(within(panel()).getByRole('heading', { name: 'Holder' })).toBeInTheDocument();
    });
  });

  describe('the contribution panel', () => {
    it('sets a quote large, with the concepts it connects and its origin prompt', async () => {
      const user = userEvent.setup();
      render(<ConceptGraphView payload={graph} />);

      await user.click(screen.getByRole('button', { name: /^Depends on, quote/ }));
      const p = panel();
      expect(within(p).getByText(/Contribution with a quote · joins 3/)).toBeInTheDocument();
      expect(within(p).getByText(/Nobody trusts the credential/)).toBeInTheDocument();
      expect(within(p).getByRole('button', { name: /What has to be trustworthy here/ })).toBeInTheDocument();
      expect(within(p).getByRole('button', { name: 'Holder' })).toBeInTheDocument();
    });

    it('shows the relation phrase and a dashed-note for a summary-only one', async () => {
      const user = userEvent.setup();
      render(<ConceptGraphView payload={graph} />);

      await user.click(screen.getByRole('button', { name: /^Co-governs, summary only/ }));
      const p = panel();
      expect(within(p).getByText(/Summary-only contribution · joins 2/)).toBeInTheDocument();
      expect(within(p).getByText('Co-governs')).toBeInTheDocument();
      expect(within(p).getByText('Summary only. There is no direct quote for this contribution.')).toBeInTheDocument();
      expect(within(p).getByRole('button', { name: 'Issuer' })).toBeInTheDocument();
    });

    it('holds a statement of about three hundred characters, and a long label, without cutting them off', async () => {
      const user = userEvent.setup();
      const statement = `${'A long remark that keeps going and going without a break. '.repeat(5)}`.slice(0, 300).trim();
      const long: ConceptGraphPayload = {
        originPrompts: [],
        concepts: [
          { id: 'c1', label: 'Ambiguity of machine agency and responsibility' },
          { id: 'c2', label: 'Western rationalist assumptions in AI' },
        ],
        contributions: [{ id: 'k', kind: 'central worry about', concepts: ['c1', 'c2'], statement }],
      };
      render(<ConceptGraphView payload={long} />);

      await user.click(screen.getByRole('button', { name: /^Central worry about, quote/ }));
      expect(statement.length).toBeGreaterThan(280);
      expect(within(panel()).getByText(statement)).toBeInTheDocument();
      expect(within(panel()).getByRole('button', { name: 'Western rationalist assumptions in AI' })).toBeInTheDocument();
    });
  });

  describe('origin prompts', () => {
    it('draws a text-less pill that opens the prompt, then its concepts and contributions', async () => {
      const user = userEvent.setup();
      render(<ConceptGraphView payload={graph} />);

      const pill = screen.getByRole('button', { name: 'Origin prompt, led to 1' });
      expect(pill).not.toHaveTextContent('What has to be trustworthy here?');

      await user.click(pill);
      const p = panel();
      expect(within(p).getByText('Origin prompt · led to 1')).toBeInTheDocument();
      expect(within(p).getByRole('heading', { name: 'What has to be trustworthy here?' })).toBeInTheDocument();
      expect(within(p).getByRole('button', { name: 'Issuer' })).toBeInTheDocument();
      // The contribution it led to is listed under the concepts.
      expect(within(p).getByRole('button', { name: 'Depends on' })).toBeInTheDocument();

      await user.click(within(p).getByRole('button', { name: 'Issuer' }));
      expect(within(panel()).getByRole('heading', { name: 'Issuer' })).toBeInTheDocument();
    });

    it('names the session on a series graph', async () => {
      const user = userEvent.setup();
      render(<ConceptGraphView payload={seriesConceptGraphFixture} />);

      await user.click(screen.getByRole('button', { name: 'Origin prompt, session 1, led to 1' }));
      expect(within(panel()).getByText('Origin prompt · Session 1 · led to 1')).toBeInTheDocument();
    });

    it('draws connectors to concepts at rest, and to its contributions once selected', async () => {
      const user = userEvent.setup();
      const { container } = render(<ConceptGraphView payload={graph} />);
      const connectors = () => container.querySelectorAll('line[stroke-dasharray="1.5 3"]');

      expect(connectors()).toHaveLength(1);
      await user.click(screen.getByRole('button', { name: 'Origin prompt, led to 1' }));
      expect(connectors()).toHaveLength(2);
    });
  });

  describe('on a series graph', () => {
    it('cuts a star’s ring into one arc per session it appears in', () => {
      const { container } = render(<ConceptGraphView payload={seriesConceptGraphFixture} />);

      // Trust is raised in sessions 1, 2 and 3; the assistant in 1 and 2; Blame only in 3.
      expect(starGroup(container, 's-c-trust').querySelectorAll('path')).toHaveLength(3);
      expect(starGroup(container, 's-c-assistant').querySelectorAll('path')).toHaveLength(2);
      expect(starGroup(container, 's-c-blame').querySelectorAll('path')).toHaveLength(0);
      expect(starGroup(container, 's-c-blame').querySelectorAll('circle[stroke^="var(--cg-session"]')).toHaveLength(1);
    });

    it('offers Full series and one entry per session, and fades what is outside the chosen one without moving it', async () => {
      const user = userEvent.setup();
      const { container } = render(<ConceptGraphView payload={seriesConceptGraphFixture} />);

      const select = screen.getByRole('combobox', { name: /show/i });
      expect([...(select as HTMLSelectElement).options].map((o) => o.textContent)).toEqual([
        'Full series',
        'Session 1',
        'Session 2',
        'Session 3',
      ]);

      const before = starGroup(container, 's-c-blame').getAttribute('transform');
      await user.selectOptions(select, 'Session 1');
      expect(starGroup(container, 's-c-blame')).toHaveAttribute('opacity', '0.12');
      expect(starGroup(container, 's-c-trust')).toHaveAttribute('opacity', '1');
      expect(starGroup(container, 's-c-blame').getAttribute('transform')).toBe(before);
      expect(trackEvent).toHaveBeenCalledWith('graph', 'filter', 'session', 1);
    });

    it('lists a session colour key and an origin prompt entry in the legend', () => {
      render(<ConceptGraphView payload={seriesConceptGraphFixture} />);

      const key = screen.getByRole('list', { name: 'Session colours' });
      expect(
        within(key)
          .getAllByRole('listitem')
          .map((li) => li.textContent),
      ).toEqual(['Ring colour is the session', 'Session 1', 'Session 2', 'Session 3']);
      const legend = screen.getByRole('list', { name: 'Legend' });
      for (const text of [
        /Concept star/,
        'Quote',
        'Summary only',
        /Quote joining two/,
        /Summary joining two/,
        'Origin prompt',
      ]) {
        expect(within(legend).getByText(text)).toBeInTheDocument();
      }
    });

    it('keeps going past eight sessions, reusing the colours in order', () => {
      const { container } = render(<ConceptGraphView payload={longSeriesConceptGraphFixture} />);

      expect(within(screen.getByRole('list', { name: 'Session colours' })).getAllByRole('listitem')).toHaveLength(10);
      expect((screen.getByRole('combobox', { name: /show/i }) as HTMLSelectElement).options).toHaveLength(10);
      // The ninth session's star wraps to the first colour.
      expect(starGroup(container, 'l-c8').querySelector('[stroke="var(--cg-session-1)"]')).toBeInTheDocument();
      // And no ring is ever dashed: dashed is reserved for "summary only".
      expect(container.querySelectorAll('[data-concept-id] [stroke-dasharray]:not(.cg-focus-ring)')).toHaveLength(0);
    });
  });

  describe('on a graph with no provenance, as a real one may be', () => {
    it('draws plain stars with no rings, hides the filter, and leaves the session key and prompt entry out', () => {
      const { container } = render(<ConceptGraphView payload={denseConceptGraphFixture} />);

      expect(container.querySelectorAll('[data-concept-id]')).toHaveLength(47);
      expect(container.querySelectorAll('[data-concept-id] path')).toHaveLength(0);
      expect(container.querySelectorAll('[data-concept-id] circle[stroke^="var(--cg-session"]')).toHaveLength(0);
      expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
      expect(screen.queryByRole('list', { name: 'Session colours' })).not.toBeInTheDocument();
      expect(within(screen.getByRole('list', { name: 'Legend' })).queryByText('Origin prompt')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /^Origin prompt/ })).not.toBeInTheDocument();
    });

    it('hides the filter on a graph from a single session too', () => {
      render(<ConceptGraphView payload={conceptGraphFixture} />);
      expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    });

    it('draws the dense fixture’s lines and diamonds, including summary-only ones as dashed', () => {
      const { container } = render(<ConceptGraphView payload={denseConceptGraphFixture} />);

      expect(screen.getAllByRole('button', { name: /, summary only, joins/ })).toHaveLength(3);
      expect(
        container.querySelectorAll('line[stroke-dasharray="4 4"], rect[stroke-dasharray="3 2"]').length,
      ).toBeGreaterThan(0);
    });
  });

  describe('Orbit', () => {
    it('centres the selected concept when entered from the panel, and returns to the sky', async () => {
      mockMedia({ reduce: true });
      const user = userEvent.setup();
      const { container } = render(<ConceptGraphView payload={graph} />);
      const skyPosition = starGroup(container, 'c-verifier').getAttribute('transform');

      await user.click(star('Verifier'));
      await user.click(within(panel()).getByRole('button', { name: 'Center the sky here' }));

      expect(screen.getByRole('button', { name: 'Orbit' })).toHaveAttribute('aria-pressed', 'true');
      expect(starGroup(container, 'c-verifier')).toHaveAttribute('transform', 'translate(500.0 340.0)');
      expect(container.textContent).toContain('1 STEP');

      await user.click(within(panel()).getByRole('button', { name: 'Back to the sky' }));
      expect(screen.getByRole('button', { name: 'Sky' })).toHaveAttribute('aria-pressed', 'true');
      expect(starGroup(container, 'c-verifier').getAttribute('transform')).toBe(skyPosition);
    });

    it('re-centres when another star is selected', async () => {
      mockMedia({ reduce: true });
      const user = userEvent.setup();
      const { container } = render(<ConceptGraphView payload={graph} />);

      await user.click(screen.getByRole('button', { name: 'Orbit' }));
      await user.click(star('Holder'));
      expect(starGroup(container, 'c-holder')).toHaveAttribute('transform', 'translate(500.0 340.0)');
    });

    it('glides over about 900ms when motion is allowed, ending at the same place', async () => {
      const user = userEvent.setup();
      const { container } = render(<ConceptGraphView payload={graph} />);

      await user.click(star('Verifier'));
      await user.click(within(panel()).getByRole('button', { name: 'Center the sky here' }));
      await waitFor(
        () => expect(starGroup(container, 'c-verifier')).toHaveAttribute('transform', 'translate(500.0 340.0)'),
        { timeout: 3000 },
      );
    });
  });

  describe('List', () => {
    it('is the default on a narrow screen', () => {
      mockMedia({ narrow: true });
      render(<ConceptGraphView payload={graph} />);

      expect(screen.getByRole('button', { name: 'List' })).toHaveAttribute('aria-pressed', 'true');
      expect(screen.queryByRole('button', { name: /, concept,/ })).not.toBeInTheDocument();
    });

    it('lists every concept, most connected first, with what it connects to, and every prompt', async () => {
      const user = userEvent.setup();
      render(<ConceptGraphView payload={seriesConceptGraphFixture} />);

      await user.click(screen.getByRole('button', { name: 'List' }));
      const items = within(document.querySelector('ol') as HTMLElement).getAllByRole('listitem');
      expect(items).toHaveLength(seriesConceptGraphFixture.concepts.length);
      // Three concepts tie for most connected, so they come out by label.
      expect(items.slice(0, 3).map((li) => within(li).getAllByRole('button')[0].textContent)).toEqual([
        'Habit',
        'The Assistant',
        'Trust',
      ]);
      expect(items[2]).toHaveTextContent('3 connections');
      expect(items[2]).toHaveTextContent(/Connects to/);
      expect(items[2]).toHaveTextContent('Session 1, Session 2, Session 3');
      for (const prompt of seriesConceptGraphFixture.originPrompts) {
        expect(screen.getByRole('button', { name: prompt.text })).toBeInTheDocument();
      }
    });

    it('opens the same reading panel, and respects the filter', async () => {
      const user = userEvent.setup();
      render(<ConceptGraphView payload={seriesConceptGraphFixture} />);

      await user.click(screen.getByRole('button', { name: 'List' }));
      await user.selectOptions(screen.getByRole('combobox', { name: /show/i }), 'Session 3');
      expect(screen.queryByRole('button', { name: 'Skepticism' })).not.toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Blame' }));
      expect(within(panel()).getByRole('heading', { name: 'Blame' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Blame' })).toHaveAttribute('aria-pressed', 'true');
    });
  });

  it('shows an empty state rather than an empty canvas', () => {
    render(<ConceptGraphView payload={emptyConceptGraphFixture} />);

    expect(screen.getByText(/empty so far/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /, concept,/ })).not.toBeInTheDocument();
  });

  it('says a session is still below the horizon when the filter leaves nothing in view', async () => {
    const user = userEvent.setup();
    // Session 3 is still known to the graph, through its origin prompt, but none of its concepts or
    // contributions have been placed: the case of an event that has not happened yet.
    const thirdId = seriesConceptGraphFixture.concepts[4].provenance!.conversationId;
    const inLaterSession = (n: { provenance?: { conversationId?: string } }) => n.provenance?.conversationId === thirdId;
    const droppedConcepts = new Set(seriesConceptGraphFixture.concepts.filter(inLaterSession).map((c) => c.id));
    const payload: ConceptGraphPayload = {
      ...seriesConceptGraphFixture,
      concepts: seriesConceptGraphFixture.concepts.filter((c) => !droppedConcepts.has(c.id)),
      contributions: seriesConceptGraphFixture.contributions
        .filter((k) => !inLaterSession(k))
        .map((k) => ({ ...k, concepts: k.concepts.filter((id) => !droppedConcepts.has(id)) })),
    };
    render(<ConceptGraphView payload={payload} />);

    await user.selectOptions(screen.getByRole('combobox', { name: /show/i }), 'Session 3');
    expect(screen.getByText(/still below the horizon/i)).toBeInTheDocument();
  });

  it('never renders a pseudonym or message id, however the payload carries them', async () => {
    const user = userEvent.setup();
    const leaky: ConceptGraphPayload = {
      originPrompts: [
        {
          id: 'p1',
          text: 'A prompt',
          provenance: { conversationId: 'conv-a', pseudonym: 'Pseudonym-Zed', messageId: 'msg-zed-1' },
        },
      ],
      concepts: [
        {
          id: 'c1',
          label: 'One',
          origin: 'p1',
          provenance: { conversationId: 'conv-a', pseudonym: 'Pseudonym-Zed', messageId: 'msg-zed-2' },
        },
        {
          id: 'c2',
          label: 'Two',
          provenance: { conversationId: 'conv-b', pseudonym: 'Pseudonym-Yan', messageId: 'msg-yan-1' },
        },
      ],
      contributions: [
        {
          id: 'k1',
          kind: 'joins',
          concepts: ['c1', 'c2'],
          statement: 'Said plainly.',
          provenance: { conversationId: 'conv-b', pseudonym: 'Pseudonym-Yan', messageId: 'msg-yan-2' },
        },
      ],
    };
    const { container } = render(<ConceptGraphView payload={leaky} />);
    const leaked = () => /Pseudonym|msg-|conv-a|conv-b/.test(container.innerHTML);

    expect(leaked()).toBe(false);
    await user.click(star('One'));
    await user.click(screen.getAllByRole('button', { name: /^Joins, quote/ })[0]);
    await user.click(screen.getByRole('button', { name: 'Origin prompt, session 1, led to 1' }));
    await user.click(screen.getByRole('button', { name: 'List' }));
    expect(leaked()).toBe(false);
  });

  it('tracks view changes and selections without ever sending an id or text', async () => {
    const user = userEvent.setup();
    render(<ConceptGraphView payload={graph} />);

    await user.click(screen.getByRole('button', { name: 'Orbit' }));
    expect(trackEvent).toHaveBeenCalledWith('graph', 'view', 'orbit', undefined);
    await user.click(star('Issuer'));
    expect(trackEvent).toHaveBeenCalledWith('graph', 'select', 'concept', undefined);
  });

  describe('analytics', () => {
    beforeEach(() => jest.clearAllMocks());

    const stars = () => screen.getAllByRole('button', { name: /, concept/ });

    it('attributes graph events to the conversation when there is one', async () => {
      const user = userEvent.setup();
      render(<ConceptGraphView payload={graph} conversationId="conv-1" />);

      await user.click(screen.getByRole('button', { name: 'Orbit' }));
      await user.click(star('Issuer'));

      expect(trackConversationEvent).toHaveBeenCalledWith('conv-1', 'graph', 'view', 'orbit', undefined);
      expect(trackConversationEvent).toHaveBeenCalledWith('conv-1', 'graph', 'select', 'concept', undefined);
      expect(trackEvent).not.toHaveBeenCalledWith('graph', 'select', 'concept', undefined);
    });

    it('records the session number, and full_series for the whole graph', async () => {
      const user = userEvent.setup();
      render(<ConceptGraphView payload={seriesConceptGraphFixture} conversationId="conv-1" />);
      const select = screen.getByRole('combobox', { name: /show/i });

      await user.selectOptions(select, 'Session 3');
      expect(trackConversationEvent).toHaveBeenCalledWith('conv-1', 'graph', 'filter', 'session', 3);

      await user.selectOptions(select, 'Full series');
      expect(trackConversationEvent).toHaveBeenCalledWith('conv-1', 'graph', 'filter', 'full_series', undefined);
    });

    it('records a deselect by a second click on the node', async () => {
      const user = userEvent.setup();
      render(<ConceptGraphView payload={graph} conversationId="conv-1" />);

      await user.click(star('Issuer'));
      expect(trackConversationEvent).not.toHaveBeenCalledWith('conv-1', 'graph', 'deselect', expect.anything(), undefined);
      await user.click(star('Issuer'));

      expect(trackConversationEvent).toHaveBeenCalledWith('conv-1', 'graph', 'deselect', 'toggle', undefined);
    });

    it('records a deselect by closing the reading panel', async () => {
      const user = userEvent.setup();
      render(<ConceptGraphView payload={graph} conversationId="conv-1" />);

      await user.click(star('Issuer'));
      await user.click(within(panel()).getByRole('button', { name: /^Close/ }));

      expect(trackConversationEvent).toHaveBeenCalledWith('conv-1', 'graph', 'deselect', 'panel', undefined);
    });

    it('records a deselect by Escape, and none when nothing is selected', async () => {
      const user = userEvent.setup();
      render(<ConceptGraphView payload={graph} conversationId="conv-1" />);

      stars()[0].focus();
      await user.keyboard('{Escape}');
      expect(trackConversationEvent).not.toHaveBeenCalledWith('conv-1', 'graph', 'deselect', 'escape', undefined);

      await user.click(star('Issuer'));
      await user.keyboard('{Escape}');
      expect(trackConversationEvent).toHaveBeenCalledWith('conv-1', 'graph', 'deselect', 'escape', undefined);
    });

    it('records a deselect by a click on empty sky', async () => {
      const user = userEvent.setup();
      const { container } = render(<ConceptGraphView payload={graph} conversationId="conv-1" />);

      await user.click(star('Issuer'));
      await user.click(container.querySelector('.concept-sky') as HTMLElement);

      expect(trackConversationEvent).toHaveBeenCalledWith('conv-1', 'graph', 'deselect', 'empty_sky', undefined);
    });

    it('never sends a node id, for any kind, as the name of a select', async () => {
      const user = userEvent.setup();
      render(<ConceptGraphView payload={graph} conversationId="conv-1" />);

      await user.click(star('Issuer'));
      await user.click(screen.getByRole('button', { name: /^Co-governs, summary only/ }));
      await user.click(screen.getByRole('button', { name: /^Origin prompt/ }));

      const names = (trackConversationEvent as jest.Mock).mock.calls.filter((c) => c[2] === 'select').map((c) => c[3]);
      expect(names).toEqual(['concept', 'contribution', 'prompt']);
    });

    describe('hover', () => {
      beforeEach(() => jest.useFakeTimers());
      afterEach(() => jest.useRealTimers());

      const hovers = () => (trackConversationEvent as jest.Mock).mock.calls.filter((c) => c[2] === 'hover');
      const promptPill = () => screen.getByRole('button', { name: /^Origin prompt/ });

      it('reports one hover per node kind once the pointer has stayed for 500ms', () => {
        render(<ConceptGraphView payload={graph} conversationId="conv-1" />);

        fireEvent.pointerEnter(star('Issuer'));
        act(() => void jest.advanceTimersByTime(499));
        expect(hovers()).toHaveLength(0);
        act(() => void jest.advanceTimersByTime(1));
        expect(trackConversationEvent).toHaveBeenCalledWith('conv-1', 'graph', 'hover', 'concept', undefined);

        // Staying put (and any re-render) does not fire it again.
        act(() => void jest.advanceTimersByTime(5000));
        expect(hovers()).toHaveLength(1);

        fireEvent.pointerLeave(star('Issuer'));
        fireEvent.pointerEnter(promptPill());
        act(() => void jest.advanceTimersByTime(500));
        expect(trackConversationEvent).toHaveBeenCalledWith('conv-1', 'graph', 'hover', 'prompt', undefined);
        expect(hovers()).toHaveLength(2);
      });

      it('does not report a pointer that passes over a node, or one that left before 500ms', () => {
        render(<ConceptGraphView payload={graph} conversationId="conv-1" />);

        fireEvent.pointerEnter(star('Issuer'));
        act(() => void jest.advanceTimersByTime(300));
        fireEvent.pointerLeave(star('Issuer'));
        fireEvent.pointerEnter(star('Verifier'));
        act(() => void jest.advanceTimersByTime(300));
        fireEvent.pointerLeave(star('Verifier'));
        act(() => void jest.advanceTimersByTime(5000));

        expect(hovers()).toHaveLength(0);
      });

      it('reports a new dwell when the pointer comes back to the same node', () => {
        render(<ConceptGraphView payload={graph} conversationId="conv-1" />);

        for (let i = 0; i < 2; i += 1) {
          fireEvent.pointerEnter(star('Issuer'));
          act(() => void jest.advanceTimersByTime(500));
          fireEvent.pointerLeave(star('Issuer'));
        }

        expect(hovers()).toHaveLength(2);
      });

      it('never reports a contribution, however long it is hovered', () => {
        render(<ConceptGraphView payload={graph} conversationId="conv-1" />);

        fireEvent.pointerEnter(screen.getByRole('button', { name: /^Co-governs, summary only/ }));
        fireEvent.pointerEnter(screen.getAllByRole('button', { name: /^Depends on/ })[0]);
        act(() => void jest.advanceTimersByTime(5000));

        expect(hovers()).toHaveLength(0);
      });

      it('cancels a pending dwell when the graph unmounts', () => {
        const { unmount } = render(<ConceptGraphView payload={graph} conversationId="conv-1" />);

        fireEvent.pointerEnter(star('Issuer'));
        act(() => void jest.advanceTimersByTime(200));
        unmount();
        act(() => void jest.advanceTimersByTime(5000));

        expect(hovers()).toHaveLength(0);
      });

      it('does not fire twice, or later, when the filter changes while a node stays hovered', () => {
        render(<ConceptGraphView payload={seriesConceptGraphFixture} conversationId="conv-1" />);

        fireEvent.pointerEnter(stars()[0]);
        act(() => void jest.advanceTimersByTime(300));
        fireEvent.change(screen.getByRole('combobox', { name: /show/i }), { target: { value: '1' } });
        act(() => void jest.advanceTimersByTime(199));
        expect(hovers()).toHaveLength(0);
        act(() => void jest.advanceTimersByTime(1));
        expect(hovers()).toHaveLength(1);

        act(() => void jest.advanceTimersByTime(5000));
        expect(hovers()).toHaveLength(1);
      });

      it('sends a hover without attribution when there is no conversation', () => {
        render(<ConceptGraphView payload={graph} />);

        fireEvent.pointerEnter(star('Issuer'));
        act(() => void jest.advanceTimersByTime(500));

        expect(trackEvent).toHaveBeenCalledWith('graph', 'hover', 'concept', undefined);
        expect(trackConversationEvent).not.toHaveBeenCalled();
      });
    });

    it('sends events without attribution when there is no conversation (a series or the preview)', async () => {
      const user = userEvent.setup();
      render(<ConceptGraphView payload={graph} />);

      await user.click(star('Issuer'));
      await user.click(star('Issuer'));

      expect(trackEvent).toHaveBeenCalledWith('graph', 'deselect', 'toggle', undefined);
      expect(trackConversationEvent).not.toHaveBeenCalled();
    });
  });

  describe('with the backend’s session list', () => {
    const withSessions: ConceptGraphPayload = {
      originPrompts: [],
      sessions: [
        { conversationId: 'conv-2', order: 2, date: '2025-10-02T18:00:00Z' },
        { conversationId: 'conv-1', order: 1, title: 'Kickoff night' },
      ],
      concepts: [
        { id: 'a', label: 'Alpha', provenance: { conversationId: 'conv-2' }, conversationIds: ['conv-1', 'conv-2'] },
        { id: 'b', label: 'Beta', provenance: { conversationId: 'conv-2' } },
      ],
      contributions: [{ id: 'k', kind: 'links', concepts: ['a', 'b'], provenance: { conversationId: 'conv-2' } }],
    };

    it('labels the filter and ring key by title or date, in event order', () => {
      render(<ConceptGraphView payload={withSessions} />);

      const options = [...(screen.getByRole('combobox', { name: /show/i }) as HTMLSelectElement).options];
      expect(options.map((o) => o.textContent)).toEqual(['Full series', 'Kickoff night', 'Session 2 · Oct 2']);
      const key = within(screen.getByRole('list', { name: 'Session colours' }));
      expect(key.getByText('Kickoff night')).toBeInTheDocument();
      expect(key.getByText('Session 2 · Oct 2')).toBeInTheDocument();
    });

    it('draws a ring arc for every session the concept lists, even those no contribution shows', () => {
      const { container } = render(<ConceptGraphView payload={withSessions} />);

      expect(starGroup(container, 'a').querySelectorAll('path')).toHaveLength(2);
      expect(starGroup(container, 'b').querySelectorAll('path')).toHaveLength(0);
    });
  });

  it('keeps the feedback prompt beneath the sky', () => {
    render(<ConceptGraphView payload={graph} />);
    expect(screen.getByText(/Is this graph interesting, useful and clear/)).toBeInTheDocument();
  });
});

describe('SkyCanvas dwell', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  const scene = buildScene(graph);
  const positions = layoutSky(scene.model);
  const filter = filterSky(scene.model, 'all');

  const canvas = (hoverId: string | null, onDwell: jest.Mock, withScene = scene) => (
    <SkyCanvas
      scene={withScene}
      positions={positions}
      targetPositions={positions}
      orbit={false}
      filter={filter}
      hoverId={hoverId}
      selectedId={null}
      onHover={jest.fn()}
      onDwell={onDwell}
      onToggle={jest.fn()}
    />
  );

  it('reports the kind of a hovered concept or prompt after DWELL_MS, and nothing sooner', () => {
    const onDwell = jest.fn();
    const { rerender } = render(canvas('c-issuer', onDwell));

    act(() => void jest.advanceTimersByTime(DWELL_MS - 1));
    expect(onDwell).not.toHaveBeenCalled();
    act(() => void jest.advanceTimersByTime(1));
    expect(onDwell).toHaveBeenCalledTimes(1);
    expect(onDwell).toHaveBeenLastCalledWith('concept');

    rerender(canvas('p1', onDwell));
    act(() => void jest.advanceTimersByTime(DWELL_MS));
    expect(onDwell).toHaveBeenCalledTimes(2);
    expect(onDwell).toHaveBeenLastCalledWith('prompt');
  });

  it('never reports a contribution', () => {
    const onDwell = jest.fn();
    render(canvas('k1', onDwell));

    act(() => void jest.advanceTimersByTime(5000));
    expect(onDwell).not.toHaveBeenCalled();
  });

  it('keeps one timer through a new scene or callback identity, and calls the latest callback', () => {
    const first = jest.fn();
    const second = jest.fn();
    const { rerender } = render(canvas('c-issuer', first));

    act(() => void jest.advanceTimersByTime(300));
    rerender(canvas('c-issuer', second, buildScene(graph)));
    act(() => void jest.advanceTimersByTime(199));
    expect(second).not.toHaveBeenCalled();
    act(() => void jest.advanceTimersByTime(1));
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);

    act(() => void jest.advanceTimersByTime(5000));
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('cancels on leaving and on unmount', () => {
    const onDwell = jest.fn();
    const { rerender, unmount } = render(canvas('c-issuer', onDwell));

    act(() => void jest.advanceTimersByTime(200));
    rerender(canvas(null, onDwell));
    act(() => void jest.advanceTimersByTime(1000));
    expect(onDwell).not.toHaveBeenCalled();

    rerender(canvas('c-issuer', onDwell));
    act(() => void jest.advanceTimersByTime(200));
    unmount();
    act(() => void jest.advanceTimersByTime(1000));
    expect(onDwell).not.toHaveBeenCalled();
  });
});
