import { ConceptGraphPayload, GraphConcept, GraphContribution, GraphOriginPrompt } from '../../../types.internal';
import { SkyModel, buildSkyModel, conceptSessions, sessionIndex, sessionLabel } from '../../../utils/conceptSky';
import { cgVar, sessionVar } from './tokens';

/**
 * Everything the sky's components look up by id, derived once per payload so each of them
 * reads the same answers instead of re-deriving them.
 *
 * PRIVACY: only `provenance.conversationId` is ever read from a node, and only to number
 * sessions. `messageId` and `pseudonym` identify who said what; these graphs come from events
 * held under the Chatham House Rule and anyone reaching them holds only the artifact
 * passcode, so nothing in the sky reads or renders either field.
 */
export interface SkyScene {
  model: SkyModel;
  /** Conversation id to zero-based session index; empty unless the graph spans 2+ sessions. */
  sessionIndex: Map<string, number>;
  sessionCount: number;
  /** Per session index: its title, or "Session N" with a date when the payload gives one. */
  sessionLabels: string[];
  /** Concept id to the sessions it appears in, sorted. */
  conceptSessions: Map<string, number[]>;
  concepts: Map<string, GraphConcept>;
  contributions: Map<string, GraphContribution>;
  prompts: Map<string, GraphOriginPrompt>;
}

export type NodeKind = 'concept' | 'contribution' | 'prompt';

export function buildScene(payload: ConceptGraphPayload): SkyScene {
  const model = buildSkyModel(payload);
  const index = sessionIndex(payload);
  return {
    model,
    sessionIndex: index,
    sessionCount: index.size,
    sessionLabels: Array.from({ length: index.size }, (_, i) => sessionLabel(payload, i)),
    conceptSessions: conceptSessions(model),
    concepts: new Map(payload.concepts.map((c) => [c.id, c])),
    contributions: new Map(payload.contributions.map((k) => [k.id, k])),
    prompts: new Map(payload.originPrompts.map((p) => [p.id, p])),
  };
}

export function nodeKind(scene: SkyScene, id: string | null | undefined): NodeKind | null {
  if (!id) return null;
  if (scene.concepts.has(id)) return 'concept';
  if (scene.contributions.has(id)) return 'contribution';
  if (scene.prompts.has(id)) return 'prompt';
  return null;
}

/** The session a node came from, or undefined for a single-session graph or an unattributed node. */
export function sessionOfNode(scene: SkyScene, node: { provenance?: { conversationId?: string } }): number | undefined {
  const id = node.provenance?.conversationId;
  return id === undefined ? undefined : scene.sessionIndex.get(id);
}

export const sessionName = (index: number): string => `Session ${index + 1}`;

/** The colour an origin prompt's pill takes: its session's, or neutral ash when it has none. */
export function promptColor(scene: SkyScene, promptId: string): string {
  const prompt = scene.prompts.get(promptId);
  const index = prompt ? sessionOfNode(scene, prompt) : undefined;
  return index === undefined ? cgVar('sessionFallback') : sessionVar(index);
}

export const conceptLabel = (scene: SkyScene, id: string): string => scene.concepts.get(id)?.label ?? id;

/**
 * A contribution's relation phrase for display. The generator emits lowercase verb phrases
 * ("enables", "tension with") that read as a sentence fragment; the design sets them as a
 * capitalised phrase ("Distinguishes").
 */
export const relationPhrase = (kind: string): string => kind.charAt(0).toUpperCase() + kind.slice(1);

export const joined = (labels: string[]): string =>
  labels.length <= 2 ? labels.join(' and ') : `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`;
