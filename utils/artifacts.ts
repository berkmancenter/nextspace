/**
 *
 * @file Reads of the artifact endpoints: the shared objects that emerge from a
 * conversation or a topic. Every read is authorized either by the container's artifact
 * passcode or by the caller owning the container, so each function here takes an optional
 * passcode and threads it through as the `artifactPasscode` query parameter.
 *
 * The one write here is `generateConceptGraph`, the admin trigger that builds a graph from a
 * finished event. Creating an artifact by hand and appending a version are deliberately
 * absent — they are owner-or-admin only and no UI in this app offers them yet.
 */

import { RetrieveData } from './Api';
import { Api, SendData } from './Helpers';
import {
  Artifact,
  ArtifactContainer,
  ArtifactVersion,
  ArtifactVersionPage,
  ConceptGraphGenerationResult,
} from '../types.internal';

/**
 * A failed artifact request, carrying the HTTP status so callers can tell "you need the
 * passcode" apart from "something broke".
 */
export class ArtifactRequestError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'ArtifactRequestError';
    this.status = status;
  }

  /**
   * True for the 403 the artifact endpoints return. A wrong passcode, a missing passcode,
   * and an id that matches nothing all return that same 403 with the same message, so the
   * endpoint cannot be used to discover which conversations hold artifacts. Never render
   * "this artifact doesn't exist" for it — "you need this artifact's passcode" is the only
   * reading a visitor can act on.
   */
  get needsPasscode(): boolean {
    return this.status === 403;
  }
}

/** Turns a container plus an optional passcode into a query string, encoding as it goes. */
function containerQuery(container: ArtifactContainer, artifactPasscode?: string): string {
  const params = new URLSearchParams();
  if (container.conversationId) params.set('conversationId', container.conversationId);
  if (container.topicId) params.set('topicId', container.topicId);
  if (artifactPasscode) params.set('artifactPasscode', artifactPasscode);
  return params.toString();
}

/** Appends `?artifactPasscode=…` when there is one, encoded. */
function passcodeQuery(artifactPasscode?: string): string {
  if (!artifactPasscode) return '';
  return `?${new URLSearchParams({ artifactPasscode }).toString()}`;
}

/**
 * Unwraps a `RetrieveData` result, which reports failure as a value rather than by
 * throwing, into either the data or an `ArtifactRequestError`.
 */
function unwrap<T>(response: any, fallbackMessage: string): T {
  if (response === undefined || response === null) {
    throw new ArtifactRequestError(fallbackMessage);
  }
  if (response.error) {
    const status: number | undefined = response.status;
    const message = response.message?.message ?? (typeof response.message === 'string' ? response.message : undefined);
    throw new ArtifactRequestError(message || fallbackMessage, status);
  }
  return response as T;
}

/**
 * Every artifact in a container, newest first, each with `currentVersion` populated — so a
 * list view can render the whole set without a request per artifact. A topic listing
 * includes the artifacts of that topic's conversations.
 * @param container - Exactly one of `conversationId` or `topicId`.
 * @param artifactPasscode - The container's read passcode. Omit it when the caller owns the container or is an admin.
 * @returns The container's artifacts.
 */
export const listArtifacts = async (container: ArtifactContainer, artifactPasscode?: string): Promise<Artifact[]> => {
  const response = await RetrieveData(
    `artifacts?${containerQuery(container, artifactPasscode)}`,
    Api.get().getAccessToken(),
  );
  return unwrap<Artifact[]>(response, 'Could not load artifacts.');
};

/**
 * One artifact at its latest version. This is the default read; the versions calls below
 * reach earlier revisions.
 */
export const fetchArtifact = async (artifactId: string, artifactPasscode?: string): Promise<Artifact> => {
  const response = await RetrieveData(
    `artifacts/${artifactId}${passcodeQuery(artifactPasscode)}`,
    Api.get().getAccessToken(),
  );
  return unwrap<Artifact>(response, 'Could not load this artifact.');
};

/**
 * A page of an artifact's history, newest first.
 * @param page - 1-based page number.
 * @param limit - How many versions to a page.
 */
export const listArtifactVersions = async (
  artifactId: string,
  artifactPasscode?: string,
  { page = 1, limit = 20 }: { page?: number; limit?: number } = {},
): Promise<ArtifactVersionPage> => {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (artifactPasscode) params.set('artifactPasscode', artifactPasscode);
  const response = await RetrieveData(`artifacts/${artifactId}/versions?${params.toString()}`, Api.get().getAccessToken());
  return unwrap<ArtifactVersionPage>(response, 'Could not load this artifact’s history.');
};

/**
 * One numbered version, for showing a specific point in an artifact's history. Version
 * numbers are strictly increasing but not contiguous, so ask for a number the history
 * actually listed rather than counting.
 */
export const fetchArtifactVersion = async (
  artifactId: string,
  versionNumber: number,
  artifactPasscode?: string,
): Promise<ArtifactVersion> => {
  const response = await RetrieveData(
    `artifacts/${artifactId}/versions/${versionNumber}${passcodeQuery(artifactPasscode)}`,
    Api.get().getAccessToken(),
  );
  return unwrap<ArtifactVersion>(response, 'Could not load that version.');
};

/**
 * The container's read passcode, minting one if it has none yet. Authorized like a write
 * rather than a read — owner or admin only — because handing out the read key is the
 * owner's decision. Use it to build a shareable artifact link.
 */
export const fetchArtifactPasscode = async (container: ArtifactContainer): Promise<string> => {
  const response = await RetrieveData(`artifacts/passcode?${containerQuery(container)}`, Api.get().getAccessToken());
  return unwrap<{ artifactPasscode: string }>(response, 'Could not get the artifact passcode.').artifactPasscode;
};

/**
 * Builds a concept graph from a finished event's transcript and group chat.
 *
 * Administrators only, and safe to re-run: a second run appends a version to the existing
 * graph rather than replacing it or creating a duplicate, so a poor extraction can be redone
 * with both attempts left readable and comparable.
 *
 * A run that finds too little to map, or whose output does not survive the Chatham House
 * checks, comes back with `generated: false` and a reason. That is a result, not an error,
 * and has to be shown as one.
 */
export const generateConceptGraph = async (conversationId: string): Promise<ConceptGraphGenerationResult> => {
  const response = await SendData('artifacts/generate', { conversationId }, Api.get().getAccessToken());
  return unwrap<ConceptGraphGenerationResult>(response, 'Could not generate a concept graph.');
};
