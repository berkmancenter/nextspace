import { ParsedUrlQuery } from "querystring";
import { fetchWithTokenRefresh, RetrieveData, Request } from "./";
import { components } from "../types";
import {
  Conversation,
  EventUrl,
  EventUrls,
  PseudonymousMessage,
  MediaItem,
} from "../types.internal";

/**
 * Parsed message body structure
 * @property {string} text - The actual text content of the message
 * @property {string} [type] - Optional type for styling (e.g., "moderator_submitted")
 * @property {string} [message] - Optional message ID reference
 * @property {MediaItem[]} [media] - Optional array of media items (images, audio, video)
 */
export interface ParsedMessageBody {
  text: string;
  type?: string;
  message?: string;
  media?: MediaItem[];
}

/**
 * Parse the message body to extract text content and metadata
 * Handles both string and object formats
 */
export const parseMessageBody = (body: string | object): ParsedMessageBody => {
  // Handle object input
  if (body && typeof body === "object") {
    const obj = body as Record<string, any>;

    return {
      text: obj.text?.toString() || "",
      type: obj.type?.toString(),
      message: obj.message?.toString(),
      media: Array.isArray(obj.media) ? obj.media : undefined,
    };
  }

  // Handle string input
  return {
    text: typeof body === "string" ? body : String(body),
  };
};

/**
 * Structure to hold API tokens
 * @property {string | null} access - The access token
 * @property {string | null} refresh - The refresh token
 */
type ApiTokens = {
  access: string | null;
  refresh: string | null;
};

/**
 * Singleton class to manage API tokens.
 */
export class Api {
  private static _instance: Api;

  API_TOKENS: ApiTokens = {
    access: null,
    refresh: null,
  };

  ADMIN_TOKENS: ApiTokens = {
    access: null,
    refresh: null,
  };

  private configCache: {
    conversationTypes: components["schemas"]["ConversationType"][];
    availablePlatforms: components["schemas"]["PlatformConfig"][];
    supportedModels: components["schemas"]["LlmModelDetails"][];
    conversationBotName: string;
  } | null = null;

  SetTokens(access: string, refresh: string) {
    this.API_TOKENS = {
      access,
      refresh,
    };
  }
  GetTokens() {
    return this.API_TOKENS;
  }
  /**
   * Returns the current access token. Always call this at point-of-use so
   * you get the live value from the singleton rather than a value captured
   * at render/effect time that may have gone stale after a token refresh.
   */
  getAccessToken(): string {
    return this.API_TOKENS.access ?? "";
  }
  SetAdminTokens(access: string, refresh: string) {
    this.ADMIN_TOKENS = {
      access,
      refresh,
    };
  }
  GetAdminTokens() {
    return this.ADMIN_TOKENS;
  }
  IsLoggedIn() {
    return this.ADMIN_TOKENS.access !== null;
  }

  ClearAdminTokens() {
    this.ADMIN_TOKENS = {
      access: null,
      refresh: null,
    };
  }
  ClearTokens() {
    this.API_TOKENS = {
      access: null,
      refresh: null,
    };
  }

  async GetConfig() {
    if (!this.configCache) {
      const config = await RetrieveData("/config");
      if ("error" in config) {
        throw new Error("Failed to fetch config");
      }
      this.configCache = {
        conversationTypes: config.conversationTypes,
        availablePlatforms: config.availablePlatforms,
        supportedModels: config.supportedModels,
        conversationBotName: config.conversationBotName ?? "Berkie",
      };
    }
    return this.configCache;
  }

  ClearConfigCache() {
    this.configCache = null;
  }

  private constructor() {}

  static get() {
    if (this._instance) return this._instance;

    this._instance = new Api();
    return this._instance;
  }
}

/**
 * Extracts the passcode for a specific channel from the query parameters.
 * If the channel is present but no passcode is provided, it sets an error message.
 * @param channel - The channel to check for (e.g., "moderator", "participant").
 * @param query - The parsed URL query parameters.
 * @param setErrorMessage - Function to set an error message if needed.
 * @returns The passcode for the specified channel, or null if not found or error.
 */
export const GetChannelPasscode = (
  channel: string,
  query: ParsedUrlQuery,
  setErrorMessage: (err: string) => void,
) => {
  let hasChannel = false;
  let passcodeParam = null;
  let channelIndex = 0;

  if (!query.channel) {
    setErrorMessage("Please provide channels.");
    return null;
  }

  // Check if channel is a string or an array
  if (typeof query.channel === "string") {
    hasChannel = query.channel.includes(channel);
    // If it's a string, split it by comma
    if (hasChannel) passcodeParam = query.channel.split(",")[1];
  } else {
    // If it's an array, check if any of the channels is this channel and get the index
    hasChannel = !!query.channel.find((c, i) => {
      if (c.includes(channel)) {
        channelIndex = i;
        return true;
      }
    });

    // Get the passcode from channel string
    passcodeParam = query.channel[channelIndex].split(",")[1];
  }

  if (hasChannel) {
    if (!passcodeParam) {
      setErrorMessage(`Please provide a ${channel} passcode.`);
      return null;
    }
  }
  return passcodeParam;
};

/**
 * Sends data to the API
 * @param urlSuffix - The endpoint suffix to send data to.
 * @param payload - The data payload to send in the request body.
 * @param accessToken - Optional access token to use for authorization.
 * @param fetchOptions - Optional fetch options to customize the request.
 * @returns The response data from the API, or error information.
 */
export const SendData = async (
  urlSuffix: string,
  payload: any,
  accessToken?: string,
  fetchOptions?: RequestInit,
  method: string = "POST",
) => {
  const API_TOKENS = Api.get().GetTokens();

  let options: RequestInit = fetchOptions || {
    method,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  };

  // Ensure headers is a mutable object
  if (!options.headers) {
    options.headers = {};
  }

  // Add Authorization header; use provided accessToken if available
  (options.headers as Record<string, string>)["Authorization"] = accessToken
    ? `Bearer ${accessToken}`
    : `Bearer ${API_TOKENS.access}`;

  try {
    const response = await fetchWithTokenRefresh(
      `${process.env.NEXT_PUBLIC_API_URL}/${urlSuffix}`,
      options,
      !accessToken, // Use stored tokens if no explicit accessToken provided
    );

    // TODO: Handle other status codes as needed
    if (!response.ok) {
      console.error("Error:", response);
      return {
        error: true,
        status: response.status,
        message: response.statusText,
      };
    }

    // Handle responses with no content (204 or empty body)
    if (
      response.status === 204 ||
      response.headers.get("Content-Length") === "0"
    ) {
      return { success: true };
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("There was a problem with the send operation:", error);
  }
};

// Default easing class for animations
export const DefaultEase = " ease-[cubic-bezier(0.075, 0.820, 0.165, 1.000)]";

/**
 * Returns the conversation type for a particular conversation. Will use the conversationType property if set,
 * othwerwise maps agents to conversation type for legacy conversations (e.g. multiple agents combined into a single type)
 * @param conversation
 * @returns ConversationType the type for the conversation
 */
async function getTypeForConversation(
  conversation: components["schemas"]["Conversation"],
  conversationTypes: components["schemas"]["ConversationType"][],
): Promise<components["schemas"]["ConversationType"]> {
  if (conversation.conversationType) {
    const type = conversationTypes.find(
      (type) => type.name === conversation.conversationType,
    );
    if (type) return type;
  }
  const agentNames = conversation.agents.map((agent) => agent.agentType);
  // Bit of a hack to support legacy conversations without a type. Takes advantage of the fact that
  // backChannel and eventAssistant conversation types match their agent names
  // (both backChannelInsights and backChannelMetrics contain 'backChannel', the type name)
  return conversationTypes.find((convType) =>
    agentNames.some((agentName) => agentName.includes(convType.name)),
  )!;
}

function generateEventUrls(
  conversationData: Conversation,
  botName: string,
): EventUrls {
  const urlPrefix = `${window.location.protocol}//${window.location.host}`;
  const moderator: EventUrl[] = [];
  const participant: EventUrl[] = [];

  const zoomAdapter = conversationData.adapters.find(
    (adapter) => adapter.type === "zoom",
  );
  const zoom = zoomAdapter
    ? { label: "Zoom", url: zoomAdapter.config?.meetingUrl as string }
    : undefined;

  const convType = conversationData.type;

  const transcriptPasscode = conversationData.channels.find(
    (channel) => channel.name === "transcript",
  )?.passcode;
  const hasTranscript = Boolean(transcriptPasscode);

  const chatPasscode = conversationData.channels.find(
    (channel) => channel.name === "chat",
  )?.passcode;
  const hasChat = Boolean(chatPasscode);

  const modPasscode = conversationData.channels.find(
    (channel) => channel.name === "moderator",
  )?.passcode;

  const modUrl = modPasscode
    ? `${urlPrefix}/moderator/?conversationId=${
        conversationData.id
      }&channel=moderator,${modPasscode}${
        hasTranscript ? `&channel=transcript,${transcriptPasscode}` : ""
      }`
    : "";

  if (convType && convType.name === "backChannel") {
    const participantPasscode = conversationData.channels.find(
      (channel) => channel.name === "participant",
    )?.passcode;

    if (participantPasscode) {
      participant.push({
        label: "Back Channel",
        url: `${urlPrefix}/backchannel/?conversationId=${conversationData.id}&channel=participant,${participantPasscode}`,
      });
    }
    if (modPasscode) {
      moderator.push({
        label: "Back Channel",
        url: modUrl,
      });
    }
  } else if (convType && convType.name === "eventAssistant") {
    const eventAssistantUrl = {
      label: botName,
      url: `${urlPrefix}/assistant/?conversationId=${conversationData.id}${
        hasTranscript ? `&channel=transcript,${transcriptPasscode}` : ""
      }${hasChat ? `&channel=chat,${chatPasscode}` : ""}`,
    };
    participant.push(eventAssistantUrl);
  } else if (
    convType &&
    (convType.name === "eventAssistantPlus" ||
      convType.name === "eventAssistantPlusProactive")
  ) {
    const label =
      convType.name === "eventAssistantPlus"
        ? `${botName} Plus`
        : `${botName} Plus Proactive`;
    const eventAssistantPlusUrl = {
      label,
      url: `${urlPrefix}/assistant/?conversationId=${conversationData.id}${
        hasTranscript ? `&channel=transcript,${transcriptPasscode}` : ""
      }${hasChat ? `&channel=chat,${chatPasscode}` : ""}`,
    };
    participant.push(eventAssistantPlusUrl);
    if (modPasscode) {
      moderator.push({
        label,
        url: modUrl,
      });
    }
  }

  return {
    moderator,
    participant,
    zoom,
  };
}

export const getConversation = async (
  id: string,
): Promise<Conversation | null> => {
  const response = await Request(`conversations/${id}`);
  if (response && "error" in response) {
    console.error(
      `Error fetching conversation data for ID ${id}:`,
      response.message,
    );
    return null;
  }
  return await createConversationFromData(response);
};

export const createConversationFromData = async (
  data: components["schemas"]["Conversation"],
): Promise<Conversation> => {
  const { conversationTypes, availablePlatforms, conversationBotName } =
    await Api.get().GetConfig();

  const type = await getTypeForConversation(data, conversationTypes);
  const eventUrls = generateEventUrls(
    {
      ...data,
      type,
    } as Conversation,
    conversationBotName,
  );

  return {
    ...data,
    type,
    eventUrls,
    platformTypes: availablePlatforms.filter((platform) =>
      data.platforms?.some((p) => p === platform.name),
    ),
  };
};

/** Check the authentication type from request headers
 * @param headers - The request headers
 * @returns An object containing the authType property
 */
export const CheckAuthHeader = (headers: Record<string, string>) => {
  const authType =
    headers && headers["x-auth-type"] ? headers["x-auth-type"] : "guest";
  return {
    props: {
      authType,
    },
  };
};

/**
 * Resolves the bot display name for a conversation.
 * Uses the first agent's `agentConfig.botName` if it is a non-empty string,
 * otherwise falls back to `configBotName` (typically `config.conversationBotName`).
 *
 * Call this after loading conversation data so that every page that displays a
 * bot name (NavigationBar, chat panels, etc.) derives the value the same way.
 *
 * @param conversation - The loaded conversation object
 * @param configBotName - The fallback bot name from the platform config
 * @returns The resolved bot name string
 */
export const resolveConversationBotName = (
  conversation: { agents: components["schemas"]["Agent"][] },
  configBotName: string,
): string => {
  const firstAgent = conversation.agents[0];
  if (
    firstAgent?.agentConfig &&
    typeof firstAgent.agentConfig === "object" &&
    typeof (firstAgent.agentConfig as Record<string, unknown>).botName ===
      "string" &&
    (firstAgent.agentConfig as Record<string, unknown>).botName !== ""
  ) {
    return (firstAgent.agentConfig as Record<string, unknown>)
      .botName as string;
  }
  return configBotName;
};

/**
 * Normalizes Event Assistant variant pseudonyms to the configured bot name.
 * @param message - The message from the pseudonym to normalize
 * @param botName - The display name for the bot, from `conversationBotName` in config
 * @returns botName if the message is from an agent, otherwise the original pseudonym
 */
export const normalizeAssistantPseudonym = (
  message: PseudonymousMessage,
  botName: string,
): string => {
  if (!message || !message.pseudonym) return "";
  return message.fromAgent ? botName : message.pseudonym;
};
