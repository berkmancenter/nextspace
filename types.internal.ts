import { components } from "./types";

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

export type Conversation = components["schemas"]["Conversation"] & {
  type: components["schemas"]["ConversationType"];
  eventUrls: EventUrls;
  platformTypes?: components["schemas"]["PlatformConfig"][];
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
export type PageName = "Conversation" | "Survey";

export interface HeaderProps extends BaseComponentProps {
  variant?: "transparent" | "solid"; // Optional styling variants
  isAuthenticated?: boolean; // Optional authentication status
}

/**
 * Message type for pseudonymous messages used by specific agents.
 * Extends the base Message schema with additional properties.
 * @property {any} body - The body of the message.
 * @property {string[]} channels - The channels associated with the message.
 * @property {"Back Channel Insights Agent" | "Back Channel Metrics Agent" | "Event Assistant" | "Event Assistant Plus"} pseudonym - The pseudonym of the agent sending the message.
 */
export type PseudonymousMessage = components["schemas"]["Message"] & {
  body: any;
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
    }[];
    timestamp: {
      start: number;
      end: number;
    };
  };
};

export interface MessageProps {
  message: components["schemas"]["Message"];
}

export interface ControlledInputConfig {
  prefix: string;
  icon: React.ReactNode;
  label: string;
}
