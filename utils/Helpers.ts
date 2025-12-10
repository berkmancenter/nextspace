import { ParsedUrlQuery } from "querystring";
import { RefreshToken, RetrieveData, Request } from "./";
import { components } from "../types";
import { Conversation, EventUrl, EventUrls } from "../types.internal";

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
  setErrorMessage: (err: string) => void
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
 * Sends a POST request to the API
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
  fetchOptions?: RequestInit
) => {
  const apiI = Api.get();
  let API_TOKENS = apiI.GetTokens();
  let options = fetchOptions || {
    method: "POST",
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
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/${urlSuffix}`,
      {
        method: options.method,
        headers: options.headers,
        body: options.body,
      }
    );

    // If 401 Unauthorized, refresh the token
    if (response.status === 401 && API_TOKENS.refresh) {
      console.log("Token expired, refreshing...");
      // Refresh the token
      const tokensResponse = await RefreshToken(API_TOKENS.refresh);
      apiI.SetTokens(tokensResponse.access.token, tokensResponse.refresh.token);

      // Retry the request with the new token
      SendData(urlSuffix, payload);
      return null;
    }

    // TODO: Handle other status codes as needed
    if (!response.ok) {
      console.error("Error:", response);
      return {
        error: true,
        status: response.status,
        message: response.statusText,
      };
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("There was a problem with the send operation:", error);
  }
};

/**
 * Joins a session by obtaining a new pseudonym and registering it.
 * On success, it sets the API tokens and calls the success callback with the token and pseudonym.
 * On failure, it logs the error and calls the error callback with an error message.
 * @param success - Callback function to call on successful join, with token and pseudonym.
 * @param errorCallback - Callback function to call on error, with an error message.
 * @param isAuthenticated - Indicating if the user is authenticated.
 */
export const JoinSession = async (
  success: (result: { userId: string; pseudonym: string }) => void,
  errorCallback: (err: string) => void,
  isAuthenticated?: boolean
) => {
  try {
    // Get existing tokens if authenticated
    if (isAuthenticated) {
      const cookieRes = await fetch("/api/cookie");
      const cookieData = await cookieRes.json();

      if (cookieRes.status === 200 && cookieData.tokens) {
        // User is already logged in, set tokens and return
        Api.get().SetTokens(
          cookieData.tokens.access,
          cookieData.tokens.refresh
        );
        success({
          userId: cookieData.userId,
          pseudonym: cookieData.username,
        });
        return;
      }
    }

    // Get new pseudonym for session
    const pseudonymResponse = await RetrieveData("auth/newPseudonym");

    const registerResponse = await SendData("auth/register", {
      token: pseudonymResponse.token,
      pseudonym: pseudonymResponse.pseudonym,
    });

    Api.get().SetTokens(
      registerResponse.tokens.access.token,
      registerResponse.tokens.refresh.token
    );

    // Set session cookie via local API route
    await fetch("/api/session", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        username: pseudonymResponse.pseudonym,
        // Use the access, refresh tokens and userId from the register response
        userId: registerResponse.user.id,
        accessToken: registerResponse.tokens.access.token,
        refreshToken: registerResponse.tokens.refresh.token,
      }),
    });

    success({
      userId: registerResponse.user.id,
      pseudonym: pseudonymResponse.pseudonym,
    });
  } catch (err) {
    console.error("Failed to join:", err);
    errorCallback("Failed to join. Please try again.");
  }
};

// Default easing class for animations
export const DefaultEase = " ease-[cubic-bezier(0.075, 0.820, 0.165, 1.000)]";

/**
 * Returns the conversation types for a particular conversation. Will use the conversationType property if set,
 * othwerwise maps agents to conversation type for legacy conversations (e.g. multiple agents combined into a single type)
 * @param conversation
 * @returns ConversationType[] the types for the conversation
 */
async function getTypesForConversation(
  conversation: components["schemas"]["Conversation"],
  conversationTypes: components["schemas"]["ConversationType"][]
): Promise<components["schemas"]["ConversationType"][]> {
  if (conversation.conversationType) {
    const type = conversationTypes.find(
      (type) => type.name === conversation.conversationType
    );
    if (type) return [type];
  }
  const agentNames = conversation.agents.map((agent) => agent.agentType);
  // Bit of a hack to support legacy conversations without a type. Takes advantage of the fact that
  // backChannel and eventAssistant conversation types match their agent names
  // (both backChannelInsights and backChannelMetrics contain 'backChannel', the type name)
  return conversationTypes.filter((convType) =>
    agentNames.some((agentName) => agentName.includes(convType.name))
  );
}

function generateEventUrls(conversationData: Conversation): EventUrls {
  const urlPrefix = `${window.location.protocol}//${window.location.host}`;
  const moderator: EventUrl[] = [];
  const participant: EventUrl[] = [];

  const zoomAdapter = conversationData.adapters.find(
    (adapter) => adapter.type === "zoom"
  );
  const zoom = zoomAdapter
    ? { label: "Zoom", url: zoomAdapter.config?.meetingUrl as string }
    : undefined;

  for (const convType of conversationData.types) {
    if (convType.name === "backChannel") {
      const modPasscode = conversationData.channels.find(
        (channel) => channel.name === "moderator"
      )?.passcode;

      const participantPasscode = conversationData.channels.find(
        (channel) => channel.name === "participant"
      )?.passcode;

      const transcriptPasscode = conversationData.channels.find(
        (channel) => channel.name === "transcript"
      )?.passcode;
      const hasTranscript = Boolean(transcriptPasscode);
      if (modPasscode) {
        moderator.push({
          label: "Back Channel",
          url: `${urlPrefix}/moderator/?conversationId=${
            conversationData.id
          }&channel=moderator,${modPasscode}${
            hasTranscript ? `&channel=transcript,${transcriptPasscode}` : ""
          }`,
        });
      }
      if (participantPasscode) {
        participant.push({
          label: "Back Channel",
          url: `${urlPrefix}/backchannel/?conversationId=${conversationData.id}&channel=participant,${participantPasscode}`,
        });
      }
    } else if (convType.name === "eventAssistant") {
      const eventAssistantUrl = {
        label: "Event Assistant",
        url: `${urlPrefix}/assistant/?conversationId=${conversationData.id}`,
      };
      participant.push(eventAssistantUrl);
    }
  }

  return {
    moderator,
    participant,
    zoom,
  };
}

export const getConversation = async (
  id: string
): Promise<Conversation | null> => {
  const response = await Request(`conversations/${id}`);
  if (response && "error" in response) {
    console.error(
      `Error fetching conversation data for ID ${id}:`,
      response.message
    );
    return null;
  }
  return await createConversationFromData(response);
};

export const createConversationFromData = async (
  data: components["schemas"]["Conversation"]
): Promise<Conversation> => {
  const { conversationTypes, availablePlatforms } = await Api.get().GetConfig();

  const types = await getTypesForConversation(data, conversationTypes);
  const eventUrls = generateEventUrls({
    ...data,
    types,
  } as Conversation);

  return {
    ...data,
    types,
    eventUrls,
    platformTypes: availablePlatforms.filter((platform) =>
      data.platforms?.some((p) => p === platform.name)
    ),
  };
};

/** Check if the request has the authentication header set
 * @param headers - The request headers
 * @returns An object containing the isAuthenticated property
 */
export const CheckAuthHeader = (headers: Record<string, string>) => {
  const isAuthenticated = headers && headers["x-is-authenticated"] === "true";
  return {
    props: {
      isAuthenticated,
    },
  };
};
