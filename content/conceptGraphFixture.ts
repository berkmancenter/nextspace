import { ConceptGraphPayload } from '../types.internal';

/**
 * A stand-in concept graph, for looking at the renderer without a backend.
 *
 * Used by the preview page at `/artifacts/preview` and by the graph's tests, so what the
 * tests assert and what a reviewer eyeballs are the same data. It is shaped to exercise the
 * cases that are easy to get wrong rather than to be a tidy example:
 *
 * - `k15` joins three concepts at once, which is the whole reason contributions are nodes
 *   rather than edges.
 * - Degree varies widely, so the sqrt size scales have something to do.
 * - Two origin prompts are attached, one to a concept and one to a contribution, so the
 *   dashed attribution links are visible and their exclusion from degree is observable.
 * - `c-key-rotation` is joined by contributions while `c-schema` sits at the edge of the
 *   graph, so both a hub and a leaf are on screen.
 * - Some contributions carry a `statement` and some do not, since the field is optional.
 *
 * Everything here is invented. Statements are written the way the generator's are — the
 * events these graphs come from are held under the Chatham House Rule, so nothing names or
 * identifies a participant, and no fixture should model otherwise.
 */
export const conceptGraphFixture: ConceptGraphPayload = {
  originPrompts: [
    { id: 'p1', text: 'What has to be trustworthy for a credential to mean anything?' },
    { id: 'p2', text: 'Where does this break under load?' },
  ],
  concepts: [
    { id: 'c-verifiable-credential', label: 'Verifiable Credential' },
    { id: 'c-decentralized-identifier', label: 'Decentralized Identifier' },
    { id: 'c-issuer', label: 'Issuer', origin: 'p1' },
    { id: 'c-holder', label: 'Holder' },
    { id: 'c-verifier', label: 'Verifier' },
    { id: 'c-trust-registry', label: 'Trust Registry', origin: 'p1' },
    { id: 'c-revocation-list', label: 'Revocation List' },
    { id: 'c-schema', label: 'Schema' },
    { id: 'c-selective-disclosure', label: 'Selective Disclosure' },
    { id: 'c-attestation', label: 'Attestation' },
    { id: 'c-governance-framework', label: 'Governance Framework' },
    { id: 'c-key-rotation', label: 'Key Rotation' },
  ],
  contributions: [
    {
      id: 'k1',
      kind: 'anchors',
      concepts: ['c-decentralized-identifier', 'c-verifiable-credential'],
      statement: 'An identifier only helps if the credential is bound to it rather than to whoever is holding it.',
    },
    { id: 'k2', kind: 'issued by', concepts: ['c-verifiable-credential', 'c-issuer'] },
    { id: 'k3', kind: 'held by', concepts: ['c-verifiable-credential', 'c-holder'] },
    { id: 'k4', kind: 'presented to', concepts: ['c-verifiable-credential', 'c-verifier'] },
    {
      id: 'k5',
      kind: 'checked against',
      concepts: ['c-verifiable-credential', 'c-revocation-list'],
      statement: 'Revocation was described as the step most often skipped once a system is under time pressure.',
      origin: 'p2',
    },
    { id: 'k6', kind: 'conforms to', concepts: ['c-verifiable-credential', 'c-schema'] },
    { id: 'k7', kind: 'supports', concepts: ['c-verifiable-credential', 'c-selective-disclosure'] },
    { id: 'k8', kind: 'listed in', concepts: ['c-issuer', 'c-trust-registry'] },
    {
      id: 'k9',
      kind: 'checks',
      concepts: ['c-verifier', 'c-trust-registry'],
      statement: 'A registry that nobody checks before accepting a credential was held to be decorative.',
    },
    { id: 'k10', kind: 'governed by', concepts: ['c-trust-registry', 'c-governance-framework'] },
    { id: 'k11', kind: 'performs', concepts: ['c-issuer', 'c-key-rotation'] },
    { id: 'k12', kind: 'enables', concepts: ['c-decentralized-identifier', 'c-key-rotation'] },
    { id: 'k13', kind: 'made by', concepts: ['c-attestation', 'c-issuer'] },
    { id: 'k14', kind: 'supports', concepts: ['c-attestation', 'c-verifiable-credential'] },
    {
      id: 'k15',
      kind: 'co-governs',
      concepts: ['c-issuer', 'c-verifier', 'c-trust-registry'],
      statement: 'Governance was argued to sit across all three at once, which is why it is one relationship and not three.',
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
 * The smallest graph that still draws all three node kinds, for checking labels and spacing
 * without fifteen contributions in the way.
 *
 * Its ids are prefixed so they do not collide with the full fixture's. The API only promises
 * ids are unique within one payload, but the preview page puts both graphs on one screen, and
 * two nodes answering to the same id there is confusing to anyone reading the DOM.
 */
export const minimalConceptGraphFixture: ConceptGraphPayload = {
  originPrompts: [{ id: 'min-p1', text: 'What is actually being trusted here?' }],
  concepts: [
    { id: 'min-c-issuer', label: 'Issuer', origin: 'min-p1' },
    { id: 'min-c-verifier', label: 'Verifier' },
  ],
  contributions: [{ id: 'min-k1', kind: 'vouches for', concepts: ['min-c-issuer', 'min-c-verifier'] }],
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
 * event's graph. `c-consent` below is exactly that case: raised early, joined again later.
 *
 * Carries `conversationId` and nothing else: a generated graph is unattributed, so a fixture
 * that modelled a pseudonym or a messageId would be modelling data the generator never emits.
 */
export const seriesConceptGraphFixture: ConceptGraphPayload = {
  originPrompts: [
    { id: 's-p1', text: 'What has to be trustworthy here?', provenance: { conversationId: SESSION_ONE } },
    { id: 's-p2', text: 'Who carries the cost when it fails?', provenance: { conversationId: SESSION_THREE } },
  ],
  concepts: [
    { id: 's-c-credential', label: 'Credential', origin: 's-p1', provenance: { conversationId: SESSION_ONE } },
    { id: 's-c-issuer', label: 'Issuer', provenance: { conversationId: SESSION_ONE } },
    { id: 's-c-consent', label: 'Consent', provenance: { conversationId: SESSION_ONE } },
    { id: 's-c-verifier', label: 'Verifier', provenance: { conversationId: SESSION_TWO } },
    { id: 's-c-registry', label: 'Trust Registry', provenance: { conversationId: SESSION_TWO } },
    { id: 's-c-redress', label: 'Redress', origin: 's-p2', provenance: { conversationId: SESSION_THREE } },
    { id: 's-c-liability', label: 'Liability', provenance: { conversationId: SESSION_THREE } },
  ],
  contributions: [
    {
      id: 's-k1',
      kind: 'issued by',
      concepts: ['s-c-credential', 's-c-issuer'],
      provenance: { conversationId: SESSION_ONE },
    },
    {
      id: 's-k2',
      kind: 'requires',
      concepts: ['s-c-credential', 's-c-consent'],
      statement: 'The first session held that a credential presented without consent is a disclosure, not a proof.',
      provenance: { conversationId: SESSION_ONE },
    },
    {
      id: 's-k3',
      kind: 'checks',
      concepts: ['s-c-verifier', 's-c-registry'],
      provenance: { conversationId: SESSION_TWO },
    },
    {
      id: 's-k4',
      kind: 'presented to',
      concepts: ['s-c-credential', 's-c-verifier'],
      provenance: { conversationId: SESSION_TWO },
    },
    {
      id: 's-k5',
      kind: 'complicates',
      concepts: ['s-c-consent', 's-c-verifier'],
      statement: 'The second session returned to consent, arguing a verifier cannot tell a fresh one from a stale one.',
      provenance: { conversationId: SESSION_TWO },
    },
    {
      id: 's-k6',
      kind: 'falls to',
      concepts: ['s-c-redress', 's-c-liability', 's-c-issuer'],
      statement: 'By the third session the question had moved from whether it fails to who is left holding the failure.',
      origin: 's-p2',
      provenance: { conversationId: SESSION_THREE },
    },
    {
      id: 's-k7',
      kind: 'depends on',
      concepts: ['s-c-redress', 's-c-consent'],
      provenance: { conversationId: SESSION_THREE },
    },
  ],
};
