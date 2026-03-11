import React, { FC, useCallback, useEffect, useMemo, useState } from "react";
import { useTheme, useMediaQuery } from "@mui/material";
import {
  AssistantMessage,
  SubmittedMessage,
  ModeratorSubmittedMessage,
} from "../components/messages";
import { MessageFeedback } from "./MessageFeedback";
import { MessageInput } from "./MessageInput";
import {
  SlashCommand,
  createSlashCommandEnhancer,
} from "./enhancers/slashCommandEnhancer";
import {
  ControlledInputConfig,
  MediaItem,
  PseudonymousMessage,
} from "../types.internal";
import { getAvatarStyle, getAssistantAvatarStyle } from "../utils/avatarUtils";
import { useAutoScroll } from "../hooks/useAutoScroll";
import { normalizeAssistantPseudonym } from "../utils/Helpers";
import { BotIcon } from "./BotIcon";
import { PreferencesBanner, PreferenceOption } from "./PreferencesBanner";
import { MediaLightbox } from "./MediaLightbox";

/**
 * Parsed message body structure
 * @property {string} text - The actual text content of the message
 * @property {string} [type] - Optional type for styling (e.g., "moderator_submitted")
 * @property {string} [message] - Optional message ID reference
 * @property {MediaItem[]} [media] - Optional array of media items (images, audio, video)
 */
interface ParsedMessageBody {
  text: string;
  type?: string;
  message?: string;
  media?: MediaItem[];
}

/**
 * Parse the message body to extract text content and metadata
 * Handles both string and object formats
 */
const parseMessageBody = (body: string | object): ParsedMessageBody => {
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

interface AssistantChatPanelProps {
  messages: PseudonymousMessage[];
  pseudonym: string | null;
  waitingForResponse: boolean;
  controlledMode: ControlledInputConfig | null;
  slashCommands: SlashCommand[];
  eventName?: string;
  botName: string;
  inputValue?: string;
  onInputChange?: (value: string) => void;
  onSendMessage: (message: string) => void;
  onExitControlledMode: () => void;
  onPromptSelect: (prompt: string) => void;
  enterControlledMode: (config: ControlledInputConfig) => void;
  sendFeedbackRating: (messageId: string, rating: string) => void;
  userId: string | null;
  showPreferences?: boolean;
  preferenceOptions?: PreferenceOption[];
  onPreferencesSubmit?: (selectedValues: string[]) => void;
  preferencesError?: string | null;
}

export const AssistantChatPanel: FC<AssistantChatPanelProps> = ({
  messages,
  pseudonym,
  waitingForResponse,
  controlledMode,
  slashCommands,
  eventName,
  botName,
  inputValue,
  onInputChange,
  onSendMessage,
  onExitControlledMode,
  onPromptSelect,
  enterControlledMode,
  sendFeedbackRating,
  userId,
  showPreferences = false,
  preferenceOptions = [],
  onPreferencesSubmit,
  preferencesError = null,
}) => {
  const { messagesEndRef, messagesContainerRef } = useAutoScroll(messages);
  const [preferencesVisible, setPreferencesVisible] = useState(showPreferences);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  // Lightbox state for images and mindmaps
  const [lightboxState, setLightboxState] = useState<{
    isOpen: boolean;
    mediaType: "image" | "mindmap";
    mediaSrc: string;
    mimeType?: string;
  }>({
    isOpen: false,
    mediaType: "image",
    mediaSrc: "",
    mimeType: undefined,
  });

  // Sync local state with prop changes
  useEffect(() => {
    setPreferencesVisible(showPreferences);
  }, [showPreferences]);

  // Lightbox handlers
  const handleImageClick = useCallback((src: string, mimeType: string) => {
    setLightboxState({
      isOpen: true,
      mediaType: "image",
      mediaSrc: src,
      mimeType,
    });
  }, []);

  const handleMarkmapClick = useCallback((markdown: string) => {
    setLightboxState({
      isOpen: true,
      mediaType: "mindmap",
      mediaSrc: markdown,
      mimeType: undefined,
    });
  }, []);

  const handleLightboxClose = useCallback(() => {
    setLightboxState((prev) => ({ ...prev, isOpen: false }));
  }, []);

  // Create enhancers for assistant mode (slash commands only)
  const enhancers = useMemo(() => {
    const registered = [];
    if (slashCommands.length > 0) {
      registered.push(createSlashCommandEnhancer(slashCommands));
    }
    return registered;
  }, [slashCommands]);

  // Collect all message IDs referenced by moderator_submitted messages
  const submittedIds = messages
    .filter((msg) => {
      if (typeof msg.body === "object" && msg.body !== null) {
        const bodyObj = msg.body as Record<string, any>;
        return bodyObj.type === "moderator_submitted" && bodyObj.message;
      }
      return false;
    })
    .map((msg) => (msg.body as any).message);

  // Handle preferences submission - don't hide optimistically, let parent control visibility
  const handlePreferencesSubmit = (selectedValues: string[]) => {
    onPreferencesSubmit?.(selectedValues);
  };

  const handlePreferencesDismiss = () => {
    setPreferencesVisible(false);
  };

  // Collect message IDs that have singleChoice prompts
  const singleChoicePromptIds = new Set(
    messages
      .filter(
        (msg) =>
          msg.prompt?.type === "singleChoice" &&
          msg.prompt?.options &&
          msg.prompt.options.length > 0,
      )
      .map((msg) => msg.id),
  );

  return (
    <div className="flex flex-col h-full w-full overflow-hidden">
      {/* Scrollable messages area */}
      <div
        ref={messagesContainerRef}
        className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden pl-2 pr-2 md:px-8 pt-2 bg-gray-100"
      >
        <div
          className="flex flex-col items-start gap-4 pb-2"
          aria-live="assertive"
        >
          {/* Panel title and subtitle */}
          <div className="w-full pt-4 pb-2">
            <h2 className="text-xl font-bold uppercase tracking-wide text-gray-900">
              Welcome to&nbsp;
              <span className="text-medium-slate-blue">
                {eventName || "Your Event"}
              </span>
              &nbsp;
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Ask {botName} any questions about the event — this conversation is
              private.
            </p>
          </div>

          {/* Preferences Banner */}
          {preferencesVisible && preferenceOptions.length > 0 && (
            <div className="w-full">
              <PreferencesBanner
                options={preferenceOptions}
                onSubmit={handlePreferencesSubmit}
                onDismiss={handlePreferencesDismiss}
                error={preferencesError}
              />
            </div>
          )}

          {messages
            .filter(
              (message) =>
                !message.parentMessage ||
                !singleChoicePromptIds.has(message.parentMessage),
            )
            .map((message, i) => {
              const isAssistant = message.fromAgent;
              const isCurrentUser = message.pseudonym === pseudonym;

              const parsed = parseMessageBody(message.body);
              const messageType = parsed.type;
              const style = isAssistant
                ? getAssistantAvatarStyle()
                : getAvatarStyle(message.pseudonym, isCurrentUser);

              const displayName = normalizeAssistantPseudonym(message, botName);

              const hasPromptOptions =
                message.prompt?.options &&
                message.prompt.options.length > 0 &&
                message.prompt.type === "singleChoice";

              // Special message types rendered in the same avatar+name layout
              if (
                messageType === "moderator_submitted" ||
                submittedIds.includes(message.id)
              ) {
                return (
                  <div key={`msg-${i}`} className="w-full">
                    {/* Timestamp centered */}
                    {(() => {
                      if (i === 0) return true;
                      const prevDate = new Date(messages[i - 1].createdAt!);
                      const currDate = new Date(message.createdAt!);
                      return (
                        prevDate.getHours() !== currDate.getHours() ||
                        prevDate.getMinutes() !== currDate.getMinutes()
                      );
                    })() ? (
                      <div className="flex justify-center my-1">
                        <span className="text-sm text-gray-400">
                          {new Date(message.createdAt!).toLocaleTimeString(
                            "en-US",
                            {
                              hour: "2-digit",
                              minute: "2-digit",
                            },
                          )}
                        </span>
                      </div>
                    ) : null}

                    <div
                      className={`flex gap-1.5 mb-1 ${
                        isCurrentUser ? "flex-row-reverse" : "flex-row"
                      }`}
                    >
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: style.avatarBg }}
                      >
                        {isAssistant ? (
                          <BotIcon size={22} color="#4b5563" />
                        ) : (
                          <style.icon fontSize="inherit" />
                        )}
                      </div>
                      <div
                        className={`flex flex-col ${
                          isCurrentUser ? "items-end" : "items-start"
                        } flex-1 min-w-0`}
                      >
                        <div
                          className={`text-sm font-bold mb-1 ${
                            isCurrentUser ? "text-right" : "text-left"
                          }`}
                        >
                          {displayName}
                          {isCurrentUser && (
                            <span className="text-gray-600 font-normal">
                              {" "}
                              (You)
                            </span>
                          )}
                        </div>
                        <div style={{ width: "85%" }}>
                          {messageType === "moderator_submitted" ? (
                            <ModeratorSubmittedMessage
                              message={{
                                ...message,
                                body: parsed.text,
                              }}
                            />
                          ) : (
                            <SubmittedMessage message={message} />
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              }

              return (
                <div key={`msg-${i}`} className="w-full">
                  {/* Timestamp centered */}
                  {(() => {
                    if (i === 0) return true;
                    const prevDate = new Date(messages[i - 1].createdAt!);
                    const currDate = new Date(message.createdAt!);
                    return (
                      prevDate.getHours() !== currDate.getHours() ||
                      prevDate.getMinutes() !== currDate.getMinutes()
                    );
                  })() ? (
                    <div className="flex justify-center my-1">
                      <span className="text-sm text-gray-400">
                        {new Date(message.createdAt!).toLocaleTimeString(
                          "en-US",
                          {
                            hour: "2-digit",
                            minute: "2-digit",
                          },
                        )}
                      </span>
                    </div>
                  ) : null}

                  {/* Message with avatar */}
                  <div
                    className={`flex gap-1.5 mb-1 ${
                      isCurrentUser ? "flex-row-reverse" : "flex-row"
                    }`}
                  >
                    {/* Avatar */}
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: style.avatarBg }}
                    >
                      {isAssistant ? (
                        <BotIcon size={22} color="#4b5563" />
                      ) : (
                        <style.icon fontSize="inherit" />
                      )}
                    </div>

                    {/* Message content */}
                    <div
                      className={`flex flex-col ${
                        isCurrentUser ? "items-end" : "items-start"
                      } flex-1 min-w-0`}
                    >
                      {/* Name */}
                      <div
                        className={`text-sm font-bold mb-1 ${
                          isCurrentUser ? "text-right" : "text-left"
                        }`}
                      >
                        {displayName}
                        {isCurrentUser && (
                          <span className="text-gray-600 font-normal">
                            {" "}
                            (You)
                          </span>
                        )}
                      </div>

                      {/* Reply context - shows parent message snippet */}
                      {message.parentMessage &&
                        (() => {
                          const parentMsg = messages.find(
                            (m) => m.id === message.parentMessage,
                          );
                          if (!parentMsg) return null;

                          const parentParsed = parseMessageBody(parentMsg.body);
                          const parentText = parentParsed.text;
                          const truncatedText =
                            parentText.length > 60
                              ? parentText.substring(0, 60) + "..."
                              : parentText;

                          return (
                            <div
                              className="text-xs text-gray-500 mb-1.5 pl-2 py-1 border-l-2 border-gray-300 bg-gray-50 rounded"
                              style={{ width: "85%" }}
                            >
                              <span className="font-medium">In reply to: </span>
                              {truncatedText}
                            </div>
                          );
                        })()}

                      {/* Message bubble */}
                      {isAssistant ? (
                        <>
                          {hasPromptOptions ? (
                            /* Prompt messages keep their own purple card styling */
                            <div style={{ width: "85%" }}>
                              <AssistantMessage
                                key={`msg-${i}`}
                                message={{
                                  ...message,
                                  body: parsed.text,
                                }}
                                media={parsed.media}
                                onPromptSelect={onPromptSelect}
                                onImageClick={handleImageClick}
                                onMarkmapClick={handleMarkmapClick}
                              />
                            </div>
                          ) : (
                            <div
                              className="rounded-2xl px-2 py-1 text-gray-800 self-start"
                              style={{
                                backgroundColor: style.bubbleBg,
                                width: "85%",
                                border: "1px solid rgba(0, 0, 0, 0.1)",
                              }}
                            >
                              <AssistantMessage
                                key={`msg-${i}`}
                                message={{
                                  ...message,
                                  body: parsed.text,
                                }}
                                media={parsed.media}
                                onPromptSelect={onPromptSelect}
                                onImageClick={handleImageClick}
                                onMarkmapClick={handleMarkmapClick}
                              />
                            </div>
                          )}

                          {/* Feedback - rendered below the bubble */}
                          {message.id && !messageType && (
                            <div className="mt-0">
                              <MessageFeedback
                                messageId={message.id}
                                onPopulateFeedbackText={enterControlledMode}
                                onSendFeedbackRating={sendFeedbackRating}
                              />
                            </div>
                          )}
                        </>
                      ) : (
                        <div
                          className={`rounded-2xl px-2 py-1 text-gray-800 ${
                            isCurrentUser ? "self-end" : "self-start"
                          }`}
                          style={{
                            backgroundColor: style.bubbleBg,
                            width: "85%",
                            border: "1px solid rgba(0, 0, 0, 0.1)",
                          }}
                        >
                          {parsed.text}
                        </div>
                      )}

                      {/* Bot loading indicator - appears after last user message */}
                      {!isAssistant &&
                        waitingForResponse &&
                        i === messages.length - 1 && (
                          <div className="relative z-10 flex items-center gap-1 mt-2 mb-1">
                            <BotIcon
                              size={32}
                              color="#4b5563"
                              bouncing={true}
                            />
                            <span className="text-xs text-gray-500 italic">
                              thinking...
                            </span>
                          </div>
                        )}
                    </div>
                  </div>
                </div>
              );
            })}
          {/* Scroll target */}
          <div ref={messagesEndRef} className="h-2" />
        </div>
      </div>

      {/* MessageInput*/}
      <div className="flex-shrink-0">
        <MessageInput
          pseudonym={pseudonym}
          enhancers={enhancers}
          onSendMessage={onSendMessage}
          waitingForResponse={waitingForResponse}
          controlledMode={controlledMode}
          onExitControlledMode={onExitControlledMode}
          inputValue={inputValue}
          onInputChange={onInputChange}
        />
      </div>

      {/* Media Lightbox */}
      <MediaLightbox
        open={lightboxState.isOpen}
        onClose={handleLightboxClose}
        mediaType={lightboxState.mediaType}
        mediaSrc={lightboxState.mediaSrc}
        mimeType={lightboxState.mimeType}
        isMobile={isMobile}
      />
    </div>
  );
};
