import { ConceptGraphPayload } from '../types.internal';

/**
 * A stand-in concept graph, for looking at the renderer without a backend.
 *
 * Used by the preview page at `/artifacts/preview` and by the graph's tests, so what the
 * tests assert and what a reviewer eyeballs are the same data. Concepts are the graph's
 * themes; most contributions are leaves — one person's statement about living with an
 * assistant day to day, linked to the single concept it speaks to — and a handful are plain
 * relationships between two concepts that no one statement carries alone. It is shaped to
 * exercise the cases that are easy to get wrong rather than to be a tidy example:
 *
 * - `k18` joins three concepts at once, which is the whole reason contributions are nodes
 *   rather than edges.
 * - Degree varies widely, so the sqrt size scales have something to do.
 * - Two origin prompts are attached, one to a concept and one to a contribution, so the
 *   dashed attribution links are visible and their exclusion from degree is observable.
 * - `c-assistant` is joined by a contribution from nearly every other concept while
 *   `c-hallucination` and `c-workplace-norms` sit at the edge of the graph, so both a hub
 *   and a leaf are on screen.
 * - A contribution draws its statement, when it has one, in place of its short `kind` — see
 *   {@link buildGraph} — which is why most of these run long enough that a reader has to
 *   zoom in before one resolves without colliding with whatever is near it. A few carry no
 *   statement at all, since the field is optional: a plain relationship between two concepts,
 *   not any one person's account.
 *
 * Everything here is invented. Statements are written the way the generator's are — the
 * events these graphs come from are held under the Chatham House Rule, so nothing names or
 * identifies a participant, and no fixture should model otherwise.
 */
export const conceptGraphFixture: ConceptGraphPayload = {
  originPrompts: [
    { id: 'p1', text: 'What does it feel like when the assistant actually gets it right?' },
    { id: 'p2', text: 'Where does that feeling break down?' },
  ],
  concepts: [
    { id: 'c-assistant', label: 'The Assistant' },
    { id: 'c-trust', label: 'Trust', origin: 'p1' },
    { id: 'c-skepticism', label: 'Skepticism' },
    { id: 'c-personalization', label: 'Personalization' },
    { id: 'c-habit', label: 'Habit' },
    { id: 'c-boundary-setting', label: 'Boundary-Setting' },
    { id: 'c-attachment', label: 'Emotional Attachment' },
    { id: 'c-hallucination', label: 'Hallucination' },
    { id: 'c-burnout', label: 'Novelty Fatigue' },
    { id: 'c-workplace-norms', label: 'Workplace Norms' },
  ],
  contributions: [
    // Plain relationships between two concepts — no one statement carries these alone, so
    // there is nothing to draw but the relation itself.
    { id: 'k1', kind: 'tempers', concepts: ['c-skepticism', 'c-trust'] },
    { id: 'k2', kind: 'shaped by', concepts: ['c-trust', 'c-workplace-norms'] },
    { id: 'k3', kind: 'accelerates', concepts: ['c-personalization', 'c-burnout'] },
    { id: 'k4', kind: 'dulls', concepts: ['c-habit', 'c-boundary-setting'] },
    { id: 'k5', kind: 'complicates', concepts: ['c-attachment', 'c-boundary-setting'] },
    { id: 'k6', kind: 'meets', concepts: ['c-assistant', 'c-skepticism'] },

    // Leaves: one statement each, linked to the concept it speaks to.
    {
      id: 'k7',
      kind: 'put it this way',
      concepts: ['c-assistant'],
      statement: "Honestly, it's become the first place I go before I even think about opening a search engine.",
    },
    {
      id: 'k8',
      kind: 'admitted',
      concepts: ['c-assistant'],
      statement: 'I catch myself saying thank you to it, then feeling a little silly about that.',
    },
    {
      id: 'k9',
      kind: 'worried',
      concepts: ['c-assistant'],
      statement: "I wonder sometimes if I'm getting worse at writing because it's always right there to lean on.",
    },
    {
      id: 'k10',
      kind: 'admitted',
      concepts: ['c-trust'],
      statement: "I trust it with a first draft, never with anything I'd be embarrassed to have wrong.",
    },
    {
      id: 'k11',
      kind: 'said flatly',
      concepts: ['c-skepticism'],
      statement: "I still read everything it gives me the way I'd read a first-year intern's homework.",
    },
    {
      id: 'k12',
      kind: 'noted',
      concepts: ['c-personalization'],
      statement: 'It only started feeling useful once it remembered how I like things explained.',
    },
    {
      id: 'k13',
      kind: 'confessed',
      concepts: ['c-habit'],
      statement: "I open it before I've even finished forming the question, which worries me a little.",
    },
    {
      id: 'k14',
      kind: 'insisted',
      concepts: ['c-boundary-setting'],
      statement: 'There are things I have decided I will never ask it, on principle.',
    },
    {
      id: 'k15',
      kind: 'admitted, laughing',
      concepts: ['c-attachment'],
      statement: "I know it isn't a person, and I still felt bad cutting the conversation short.",
    },
    {
      id: 'k16',
      kind: 'warned',
      concepts: ['c-hallucination'],
      statement: "It told me something completely wrong with so much confidence that I almost didn't check.",
      origin: 'p2',
    },
    {
      id: 'k17',
      kind: 'sighed',
      concepts: ['c-burnout'],
      statement: "Every few months it changes enough that I feel like I'm learning it all over again.",
    },

    // The one statement that touches three concepts at once — the case a plain edge cannot
    // express, and the reason contributions are nodes rather than links between concepts.
    {
      id: 'k18',
      kind: 'co-shapes',
      concepts: ['c-assistant', 'c-trust', 'c-skepticism'],
      statement:
        "The trust I've built up doesn't come from believing it's always right — it comes from getting fast enough at spotting when it's wrong.",
      origin: 'p1',
    },
  ],
};

/**
 * A graph with nothing in it yet. Valid: all three arrays default to empty, so an artifact
 * can be created when an event starts and fill in as it runs. Here so the empty state is as
 * easy to look at as the full one.
 */
export const emptyConceptGraphFixture: ConceptGraphPayload = {
  concepts: [],
  contributions: [],
  originPrompts: [],
};

/**
 * The smallest graph that still draws all three node kinds — one concept, the one leaf
 * statement linked to it, and the prompt that drew the statement out — for checking labels
 * and spacing without eighteen contributions in the way.
 *
 * Its ids are prefixed so they do not collide with the full fixture's. The API only promises
 * ids are unique within one payload, but the preview page puts both graphs on one screen, and
 * two nodes answering to the same id there is confusing to anyone reading the DOM.
 */
export const minimalConceptGraphFixture: ConceptGraphPayload = {
  originPrompts: [{ id: 'min-p1', text: 'What does it feel like when it actually helps?' }],
  concepts: [{ id: 'min-c-assistant', label: 'The Assistant', origin: 'min-p1' }],
  contributions: [
    {
      id: 'min-k1',
      kind: 'admitted',
      concepts: ['min-c-assistant'],
      statement: 'It got the tone exactly right on the first try, and that alone made me trust it a little more.',
    },
  ],
};

/* Three invented conversation ids, standing in for three events in one series. They are
   opaque to the reader — the graph numbers sessions by first appearance rather than showing
   these — and a session is not a person, so unlike the rest of provenance this is safe to
   render. */
const SESSION_ONE = '6733fe79ca20209f1fa02168';
const SESSION_TWO = '6733fe79ca20209f1fa02169';
const SESSION_THREE = '6733fe79ca20209f1fa0216a';

/**
 * A series graph: one topic's worth of sessions folded into a single graph.
 *
 * A topic graph is refined rather than rebuilt, so a concept raised in the first session and
 * returned to in the third is one node with a high degree rather than three nodes — which is
 * what makes `provenance.conversationId` worth rendering here and pointless on a single
 * event's graph. `c-trust` below is exactly that case: raised early, joined again in every
 * session after.
 *
 * Carries `conversationId` and nothing else: a generated graph is unattributed, so a fixture
 * that modelled a pseudonym or a messageId would be modelling data the generator never emits.
 */
export const seriesConceptGraphFixture: ConceptGraphPayload = {
  originPrompts: [
    {
      id: 's-p1',
      text: 'What has to feel trustworthy for this to become part of your day?',
      provenance: { conversationId: SESSION_ONE },
    },
    { id: 's-p2', text: 'Who carries the weight when it lets you down?', provenance: { conversationId: SESSION_THREE } },
  ],
  concepts: [
    { id: 's-c-assistant', label: 'The Assistant', origin: 's-p1', provenance: { conversationId: SESSION_ONE } },
    { id: 's-c-trust', label: 'Trust', provenance: { conversationId: SESSION_ONE } },
    { id: 's-c-skepticism', label: 'Skepticism', provenance: { conversationId: SESSION_TWO } },
    { id: 's-c-habit', label: 'Habit', provenance: { conversationId: SESSION_TWO } },
    { id: 's-c-disappointment', label: 'Disappointment', origin: 's-p2', provenance: { conversationId: SESSION_THREE } },
    { id: 's-c-blame', label: 'Blame', provenance: { conversationId: SESSION_THREE } },
  ],
  contributions: [
    {
      id: 's-k1',
      kind: 'admitted',
      concepts: ['s-c-assistant'],
      statement: 'By the end of the first week I was checking it before I checked anything else.',
      provenance: { conversationId: SESSION_ONE },
    },
    {
      id: 's-k2',
      kind: 'requires',
      concepts: ['s-c-assistant', 's-c-trust'],
      statement: "The first session held that relying on it without trust isn't reliance, it's just risk.",
      provenance: { conversationId: SESSION_ONE },
    },
    {
      id: 's-k3',
      kind: 'wears against',
      concepts: ['s-c-skepticism', 's-c-habit'],
      provenance: { conversationId: SESSION_TWO },
    },
    {
      id: 's-k4',
      kind: 'meets',
      concepts: ['s-c-assistant', 's-c-skepticism'],
      provenance: { conversationId: SESSION_TWO },
    },
    {
      id: 's-k5',
      kind: 'complicates',
      concepts: ['s-c-trust'],
      statement: 'The second session returned to trust, wondering whether skepticism can tell earned trust from mere habit.',
      provenance: { conversationId: SESSION_TWO },
    },
    {
      id: 's-k6',
      kind: 'falls to',
      concepts: ['s-c-disappointment', 's-c-blame'],
      statement:
        'By the third session the question had moved from whether it disappoints to who is left carrying that disappointment.',
      origin: 's-p2',
      provenance: { conversationId: SESSION_THREE },
    },
    {
      id: 's-k7',
      kind: 'depends on',
      concepts: ['s-c-disappointment', 's-c-trust'],
      provenance: { conversationId: SESSION_THREE },
    },
  ],
};
