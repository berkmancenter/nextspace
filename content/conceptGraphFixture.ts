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
 */
export const minimalConceptGraphFixture: ConceptGraphPayload = {
  originPrompts: [{ id: 'p1', text: 'What is actually being trusted here?' }],
  concepts: [
    { id: 'c-issuer', label: 'Issuer', origin: 'p1' },
    { id: 'c-verifier', label: 'Verifier' },
  ],
  contributions: [{ id: 'k1', kind: 'vouches for', concepts: ['c-issuer', 'c-verifier'] }],
};
