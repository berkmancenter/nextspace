import { components } from './types';

/**
 * Authentication type for user sessions
 * @property "guest" - Anonymous user with persistent pseudonym (not logged in)
 * @property "user" - Logged-in regular user
 * @property "admin" - Logged-in admin user with access to admin features
 */
export type AuthType = 'guest' | 'user' | 'admin';

export interface BaseComponentProps {
  className?: string; // Optional Tailwind styling
}

/**
 * Props for the Event and EventForm component
 * @property {string} [id] - The ID of the event to edit or "new" to create a new event.
 * @property {string} [token] - The access token for API authentication.
 * @property {boolean} [experiment] - Indicate if the event is an experiment.
 */
export type EventProps = {
  id?: string;
  token?: string;
  experiment?: boolean;
};

export interface EventUrl {
  url: string;
  label: string;
}

export interface EventUrls {
  moderator: EventUrl[];
  participant: EventUrl[];
  zoom?: EventUrl;
}

export type Conversation = components['schemas']['Conversation'] & {
  type: components['schemas']['ConversationType'];
  eventUrls: EventUrls;
  platformTypes?: components['schemas']['PlatformConfig'][];
  /**
   * True until every field required to run this conversation as a scheduled event is
   * present and valid (llm_engine's conversation.service). Not yet in the generated
   * schema because the backend branch that adds it (cj/draft-status) hasn't merged —
   * remove this manual addition once types.ts is regenerated against a main that has it.
   */
  draft?: boolean;
};

/**
 * Error message type representing an error structure.
 * @property {boolean} error - Indicates if there is an error.
 * @property {Object} message - The error message details.
 * @property {number} message.code - The error code.
 * @property {string} message.message - The error message text.
 * @property {string} message.stack - The stack trace of the error.
 */
export type ErrorMessage = {
  error: boolean;
  message: {
    code: number;
    message: string;
    stack: string;
  };
};

// Define a fixed type for page names
// TODO: this is here just so the build succeeds; removed in PR #133
export type PageName = 'Conversation' | 'Survey';

export interface HeaderProps extends BaseComponentProps {
  variant?: 'transparent' | 'solid'; // Optional styling variants
  authType?: AuthType; // Optional authentication type
}

/**
 * Message type for pseudonymous messages used by specific agents.
 * Extends the base Message schema with additional properties.
 * @property {any} body - The body of the message.
 */
export type PseudonymousMessage = components['schemas']['Message'] & {
  body: any;
  /**
   * Set only on client-side placeholders for a message the server has not accepted:
   * 'waiting' while it is queued for delivery, 'failed' once the server refused it.
   * Never present on a message that came back from the API or the socket.
   */
  pending?: 'waiting' | 'failed';
};

/**
 * Message type for moderator metrics messages.
 * Extends the PseudonymousMessage with a specific body structure.
 * @property {Object} body - The body of the message containing metrics and timestamp.
 * @property {Array<{ comments: any[]; name: string; value: number }>} body.metrics - An array of metric objects.
 * @property {Object} body.timestamp - The timestamp object with start and end times.
 * @property {number} body.timestamp.start - The start time of the metrics.
 * @property {number} body.timestamp.end - The end time of the metrics.
 */
export type ModeratorMetricsMessage = PseudonymousMessage & {
  body: {
    metrics: {
      comments: any[];
      name: string;
      value: number;
    }[];
    timestamp: {
      start: number;
      end: number;
    };
  };
};

/**
 * Message type for moderator insights messages.
 * Extends the PseudonymousMessage with a specific body structure.
 * @property {Object} body - The body of the message containing insights and timestamp.
 * @property {Array<{ comments: Array<{ user: string; text: string }>; value: string }>} body.insights - An array of insight objects.
 * @property {Object} body.timestamp - The timestamp object with start and end times.
 * @property {number} body.timestamp.start - The start time of the insights.
 * @property {number} body.timestamp.end - The end time of the insights.
 */
export type ModeratorInsightsMessage = PseudonymousMessage & {
  body: {
    insights: {
      comments: {
        user: string;
        text: string;
      }[];
      value: string;
      source?: 'ai' | 'participant';
      recommendations?: string[];
    }[];
    timestamp: {
      start: number;
      end: number;
    };
  };
};

export interface MessageProps {
  message: components['schemas']['Message'];
}

export interface ControlledInputConfig {
  prefix: string;
  icon: React.ReactNode;
  label: string;
}

/**
 * Feedback configuration for message feedback UI
 * @property {Set<string>} eligibleMessageIds - Set of message IDs that should display feedback UI
 * @property {Map<string, string>} messageRatings - Map of message IDs to their submitted ratings
 * @property {function} onPopulateFeedbackText - Callback to populate feedback text input
 * @property {function} onSendRating - Callback to send feedback rating
 */
export interface FeedbackConfig {
  eligibleMessageIds: Set<string>;
  messageRatings: Map<string, string>;
  onPopulateFeedbackText: (config: ControlledInputConfig) => void;
  onSendRating: (messageId: string, rating: string) => void;
}

/**
 * Media item structure for multimodal messages
 * @property {"image" | "audio" | "video"} type - The type of media
 * @property {string} data - Base64 encoded media data
 * @property {string} mimeType - MIME type of the media (e.g., "image/png", "audio/mp3")
 */
export interface MediaItem {
  type: 'image' | 'audio' | 'video';
  data: string;
  mimeType: string;
}

/**
 * Configuration for building a direct channel subscription for a specific agent.
 * @property {string} agentId - The agent's ID, used to construct the channel name.
 * @property {string} [preferenceKey] - If set, the channel is only included when
 *   the matching user preference is true. If omitted, the channel is always included.
 */
export interface AgentChannelConfig {
  agentId: string;
}

/**
 * A single "What's New" entry displayed in the Help panel.
 * @property {string} title - Short feature name or headline.
 * @property {string} body - One or two sentence description of the change.
 * @property {string} releasedAt - ISO date string (e.g. "2026-04-01"). Future-dated
 *   entries and malformed strings are silently excluded by getRecentEntries().
 */
export interface WhatsNewEntry {
  title: string;
  body: string;
  releasedAt: string;
}

/**
 * Payload carried on the `content` field of a message whose body type is
 * `memberIntro`. The bot posts one of these the first time a member appears in a
 * community room, and the room feed renders it as a MemberIntroCard instead of
 * an ordinary message bubble.
 * @property {string} name - The member's real name, as registered.
 * @property {string} bio - The bio the member supplied when they joined.
 * @property {string} [role] - Affiliation line, e.g. "Fellow, metaLAB".
 * @property {string} [joinedLabel] - Human-readable join recency, e.g. "joined this week".
 */
export interface MemberIntroContent {
  name: string;
  bio: string;
  role?: string;
  joinedLabel?: string;
}

/**
 * One entry from GET /v1/users/pseudonyms. A community room stamps messages with the
 * entry registered for that room rather than the account's active pseudonym, so both
 * flavors come back here and the caller picks.
 * @property {boolean} [isRealName] - True on the real-name entry created at registration.
 * @property {string[]} [conversations] - Conversation ids this entry is scoped to.
 */
export interface UserPseudonym {
  pseudonym: string;
  active?: boolean;
  isRealName?: boolean;
  conversations?: string[];
}

/**
 * A message a room member has sent that the server has not accepted yet, either
 * because the socket is down or because its POST is still in flight. The room
 * queues these and delivers them when the connection returns, so `id` is a
 * client-side handle with no server meaning.
 * @property {string} body - The text the member typed.
 * @property {'chat' | 'assistant'} tab - Which room feed the message belongs to.
 * @property {string} [parentMessageId] - Set when the message is a threaded reply.
 * @property {boolean} [failed] - True once the server refused it.
 */
export interface PendingRoomMessage {
  id: string;
  body: string;
  tab: 'chat' | 'assistant';
  parentMessageId?: string;
  /** Set once the server has refused this message, which stops further delivery attempts. */
  failed?: boolean;
  /** Why the server refused it, in words a member can act on. */
  failureReason?: string;
}

/**
 * One row in the lounge: a community room the member belongs to, with just enough
 * of its latest activity to render a preview.
 * @property {string} preview - "Sender: message text", empty for a room with no messages.
 * @property {string | null} lastMessageAt - ISO timestamp of the newest message, null if there is none.
 * @property {boolean} hasUnread - Whether messages arrived since this device last opened the room.
 */
export interface LoungeRoom {
  id: string;
  name: string;
  preview: string;
  lastMessageAt: string | null;
  hasUnread: boolean;
}

/* ---------------------------------------------------------------------------
 * Artifacts
 *
 * Shared objects that emerge from one or more conversations. These shapes are all
 * published in the backend's OpenAPI spec (`Artifact`, `ArtifactVersion`,
 * `ConceptGraphPayload`, `GraphConcept`, `GraphContribution`, `GraphOriginPrompt`,
 * `GraphNodeProvenance`), but the branch that adds them (llm_engine's bm/artifacts)
 * has not merged, so `types.ts` has no trace of them yet. Written out by hand here
 * for the same reason `Conversation.draft` above is — delete this block and switch
 * to `components['schemas'][...]` once types.ts is regenerated against a main that
 * carries them.
 * ------------------------------------------------------------------------- */

/** Which renderer an artifact needs, and what shape its version payload has. */
export type ArtifactType = 'DocumentArtifact' | 'ConceptGraphArtifact';

/**
 * Where a graph node came from. Every field is optional: a node assembled from several
 * conversations, or written by an organizer rather than drawn from a message, may carry
 * none of it.
 *
 * DO NOT RENDER THIS TO A PASSCODE HOLDER. Generated graphs are unattributed by design —
 * the events they come from are held under the Chatham House Rule, so what was said may be
 * used but who said it may not be revealed, affiliation included. `messageId` resolves to a
 * message that has an owner, which re-identifies the contributor, and `pseudonym` names one
 * outright. Any affordance built on either — jump-to-message above all — has to be gated to
 * organizers, not to everyone holding the artifact passcode. Nothing in this app renders
 * these fields today, and that is deliberate rather than unfinished.
 *
 * @property {string} [conversationId] - The conversation the node was drawn from; topic graphs draw on several.
 * @property {string} [messageId] - The message it came from. Re-identifying: organizer-gated affordances only.
 * @property {string} [pseudonym] - Who contributed it. Re-identifying: organizer-gated affordances only.
 */
export interface GraphNodeProvenance {
  conversationId?: string;
  messageId?: string;
  pseudonym?: string;
}

/**
 * An idea or entity in a concept graph.
 * @property {string} id - Opaque and stable; key on this, never on the label.
 * @property {string} label - What the client draws.
 * @property {string} [origin] - Id of the GraphOriginPrompt this concept came out of.
 */
export interface GraphConcept {
  id: string;
  label: string;
  origin?: string;
  provenance?: GraphNodeProvenance;
}

/**
 * A relationship between concepts, reified as its own node rather than left as an edge —
 * which is what lets one contribution join three or more concepts at once. Concepts never
 * reference each other directly; they are always joined through a contribution.
 * @property {string} kind - The relationship's name, and the short label drawn on the node.
 * @property {string} [statement] - What the conversation said about the relationship, in a sentence.
 * @property {string[]} concepts - Ids of the concepts this relationship joins; one or more, and more than two is normal.
 * @property {string} [origin] - Id of the GraphOriginPrompt this contribution came out of.
 */
export interface GraphContribution {
  id: string;
  kind: string;
  statement?: string;
  concepts: string[];
  origin?: string;
  provenance?: GraphNodeProvenance;
}

/**
 * The prompt or question a concept or contribution came out of: the third node kind.
 * Attached by a direct `origin` reference rather than through a contribution, since an
 * origin is attribution rather than a relationship between concepts.
 */
export interface GraphOriginPrompt {
  id: string;
  text: string;
  provenance?: GraphNodeProvenance;
}

/**
 * The version payload of a ConceptGraphArtifact. Every array defaults to empty, so an
 * artifact can exist before an event has filled it in — render an empty state rather than
 * assuming nodes. Ids are unique across all three arrays, and the backend guarantees every
 * id in `contributions[].concepts` and every `origin` names a node in the same payload, so
 * lookups need no null-guarding.
 */
export interface ConceptGraphPayload {
  concepts: GraphConcept[];
  contributions: GraphContribution[];
  originPrompts: GraphOriginPrompt[];
}

/** The version payload of a DocumentArtifact: a single body of text. */
export interface DocumentPayload {
  body: string;
}

export type ArtifactPayload = DocumentPayload | ConceptGraphPayload;

/**
 * One immutable revision of an artifact. Versions are append-only, and each carries the
 * whole payload rather than a patch.
 * @property {number} versionNumber - 1-based and strictly increasing, but NOT contiguous: a
 *   failed append burns a number. Use it for ordering and display, never as a count.
 * @property {string} [note] - Free-text note on what changed, for the history view.
 */
export interface ArtifactVersion {
  id: string;
  artifact: string;
  versionNumber: number;
  payload: ArtifactPayload;
  createdBy?: string;
  note?: string;
  createdAt?: string;
}

/**
 * A shared object scoped to one conversation or one topic. The artifact's content is the
 * payload of its `currentVersion`; every earlier version stays readable through the
 * versions endpoints.
 * @property {ArtifactType} type - Switch the renderer on this. Published as `type`, never as mongoose's `__t`.
 * @property {string} topic - Always set, conversation-scoped artifacts included.
 * @property {string} [conversation] - Set only when `scope` is "conversation".
 * @property {ArtifactVersion} [currentVersion] - Populated by the fetch and list endpoints.
 * @property {boolean} locked - When true no further versions may be appended; the artifact stays readable.
 */
export interface Artifact {
  id: string;
  type: ArtifactType;
  scope: 'topic' | 'conversation';
  topic: string;
  conversation?: string;
  title: string;
  description?: string;
  currentVersion?: ArtifactVersion;
  currentVersionNumber: number;
  createdBy?: string;
  locked: boolean;
  createdAt?: string;
}

/** A page of an artifact's history, as the versions endpoint returns it. */
export interface ArtifactVersionPage {
  results: ArtifactVersion[];
  page: number;
  limit: number;
  totalPages: number;
  totalResults: number;
}

/**
 * The `artifact:version` socket event, broadcast to the conversation room whenever a
 * version is appended. It carries the version itself so a client can re-render without
 * refetching — and so it never has to re-present the passcode over the socket.
 */
export interface ArtifactVersionEvent {
  artifactId: string;
  type: ArtifactType;
  title: string;
  version: ArtifactVersion;
}

/**
 * Which container's artifacts to read. Exactly one of the two is set — the API rejects
 * both and neither.
 */
export type ArtifactContainer = { conversationId: string; topicId?: never } | { topicId: string; conversationId?: never };

/**
 * What POST /v1/artifacts/generate answers with.
 *
 * A run that finds too little of the event record to map, or whose output does not survive
 * the Chatham House checks, is a success with nothing to show rather than a failure: it
 * answers `generated: false` with a reason. A run that wrote something answers
 * `generated: true` with the artifact, the version it appended, and what the assembly and
 * safety passes removed on the way.
 * @property {boolean} generated - Whether a version was written.
 * @property {string} [reason] - Why nothing was written, when nothing was.
 */
export interface ConceptGraphGenerationResult {
  generated: boolean;
  reason?: string;
  artifact?: Artifact;
  version?: ArtifactVersion;
  report?: {
    droppedConcepts?: number;
    droppedContributions?: number;
    droppedStatements?: number;
    droppedOriginPrompts?: number;
    mergedConcepts?: number;
  };
}
