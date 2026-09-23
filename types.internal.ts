import { components, operations } from './types';

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

/* Artifacts. The shapes come from the backend's OpenAPI spec through types.ts. The spec
   leaves most fields optional because one schema covers both a bare id and a populated
   document; the aliases below narrow to what the read routes actually return. */
type Schemas = components['schemas'];

export type ArtifactType = NonNullable<Schemas['Artifact']['type']>;

/**
 * `conversationId` names a session, not a person, and is safe to draw. `messageId` and
 * `pseudonym` re-identify a contributor of an event held under the Chatham House Rule and
 * must never be rendered to a passcode holder; gate anything built on them to organizers.
 */
export type GraphNodeProvenance = Schemas['GraphNodeProvenance'];
/* `gloss` and `foldedFrom` are ahead of the generated spec: the backend added them for concept
   folding (a low-connection concept consolidated into a related one once a series graph grows
   past its size cap) before this ran against a deployed spec that has caught up. Narrowed here
   the same way ArtifactVersion below narrows what the spec leaves optional, rather than by
   hand-editing the generated file, which the next `openapi-types:generate` would overwrite. */
export type GraphConcept = Schemas['GraphConcept'] & {
  /* One plain sentence saying what this concept means in this discussion. */
  gloss?: string;
  /* Labels of concepts folded into this one because the series graph outgrew its size cap —
     distinct from an ordinary cross-session merge, which leaves no trace since the two labels
     really were the same idea. A folded concept was a genuinely distinct idea, consolidated
     for space, so its label is kept so a reader can still find it. */
  foldedFrom?: string[];
};
export type GraphContribution = Schemas['GraphContribution'];
export type GraphOriginPrompt = Schemas['GraphOriginPrompt'];

/* The backend defaults every array to [], so a payload never lacks one. `concepts` is
   narrowed to the extended GraphConcept above (gloss/foldedFrom), same reason as there. */
export type ConceptGraphPayload = Omit<Required<Schemas['ConceptGraphPayload']>, 'concepts'> & {
  concepts: GraphConcept[];
};

/* The spec types a document payload as an open object; this is the shape it holds. */
export interface DocumentPayload {
  body: string;
}

export type ArtifactPayload = Schemas['ArtifactVersion']['payload'];
/* Serialized documents always carry their id, whatever the spec marks optional. */
export type ArtifactVersion = Schemas['ArtifactVersion'] & { id: string };

/* Read routes return topic and conversation as ids, populate currentVersion, and always
   carry id, type and currentVersionNumber. */
export type Artifact = Omit<
  Schemas['Artifact'],
  'id' | 'type' | 'topic' | 'conversation' | 'currentVersion' | 'currentVersionNumber'
> & {
  id: string;
  type: ArtifactType;
  topic: string;
  conversation?: string;
  currentVersion?: ArtifactVersion;
  currentVersionNumber: number;
};

/* The paginate plugin fills every field, whatever the spec marks optional. */
type VersionPageResponse = Required<operations['listArtifactVersions']['responses'][200]['content']['application/json']>;
export type ArtifactVersionPage = Omit<VersionPageResponse, 'results'> & { results: ArtifactVersion[] };

/**
 * The `artifact:version` socket event, sent to the conversation room whenever a version is
 * appended. It names the version and its container and carries no content: the room is
 * joined without any passcode, so the content has to come from the REST route that checks
 * one. A received event does not say which room delivered it, so the container is what a
 * client filters on. `conversationId` is present only when `scope` is "conversation".
 */
export interface ArtifactVersionEvent {
  artifactId: string;
  versionNumber: number;
  scope: 'topic' | 'conversation';
  topicId: string;
  conversationId?: string;
}

/**
 * Which container's artifacts to read. Exactly one of the two is set — the API rejects
 * both and neither.
 */
export type ArtifactContainer = { conversationId: string; topicId?: never } | { topicId: string; conversationId?: never };

/**
 * What POST /v1/artifacts/generate answers with. A run that finds too little to map, or whose
 * output does not survive the Chatham House checks, is a success with nothing to show: it
 * answers `generated: false` with a reason rather than an error.
 */
type GenerateResponses = operations['generateConceptGraph']['responses'];
type GenerateResponseBody = GenerateResponses[200]['content']['application/json'] &
  GenerateResponses[202]['content']['application/json'];
export type ConceptGraphGenerationResult = { generated: boolean; artifact?: Artifact } & Omit<
  GenerateResponseBody,
  'generated' | 'artifact' | 'report'
> & {
    /* foldedConcepts and droppedGlosses are ahead of the generated spec — concept folding is
       new backend work; see GraphConcept's own gloss/foldedFrom note above for why this is
       narrowed here rather than by hand-editing the generated file. */
    report?: GenerateResponseBody['report'] & { foldedConcepts?: number; droppedGlosses?: number };
  };
