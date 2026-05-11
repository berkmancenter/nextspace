import React, { FC, useCallback, useEffect, useMemo, useState } from "react";
import { useTheme, useMediaQuery } from "@mui/material";
import {
  AssistantMessage,
  SubmittedMessage,
  ModeratorSubmittedMessage,
  UserMessage,
  JargonClarificationMessage,
} from "../components/messages";
import { MessageInput } from "./MessageInput";
import {
  SlashCommand,
  createSlashCommandEnhancer,
} from "./enhancers/slashCommandEnhancer";
import {
  ControlledInputConfig,
  PseudonymousMessage,
  FeedbackConfig,
} from "../types.internal";
import { getAvatarStyle, getAssistantAvatarStyle } from "../utils/avatarUtils";
import { useAutoScroll } from "../hooks/useAutoScroll";
import { parseMessageBody } from "../utils/Helpers";
import { BotIcon } from "./BotIcon";
import { PreferencesBanner, PreferenceOption } from "./PreferencesBanner";
import { MediaLightbox } from "./MediaLightbox";
import { ThreadedMessage } from "./ThreadedMessage";
import { ThreadPanel } from "./ThreadPanel";

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
  onSendMessage: (message: string, parentMessageId?: string) => void;
  onExitControlledMode: () => void;
  onPromptSelect: (prompt: string, promptMessageId?: string) => void;
  userId: string | null;
  showPreferences?: boolean;
  preferenceOptions?: PreferenceOption[];
  onPreferencesSubmit?: (selectedValues: string[]) => void;
  preferencesError?: string | null;
  feedbackConfig?: FeedbackConfig;
  messagesWithUnreadReplies?: Set<string>;
  onMarkAsRead?: (messageId: string) => void;
  inactive?: boolean;
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
  userId,
  showPreferences = false,
  preferenceOptions = [],
  onPreferencesSubmit,
  preferencesError = null,
  feedbackConfig,
  messagesWithUnreadReplies = new Set(),
  onMarkAsRead,
  inactive = false,
}) => {
  const [preferencesVisible, setPreferencesVisible] = useState(showPreferences);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
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

  // Helper to check if a message is a prompt response
  const isPromptResponse = (msg: PseudonymousMessage): boolean => {
    return !!msg.answersPrompt;
  };

  // Organize messages into threads
  const parentMessages = messages
    .filter((m) => !m.parentMessage)
    .filter((m) => !isPromptResponse(m));

  // Auto-scroll based on parent messages only (not threaded replies)
  const { messagesEndRef, messagesContainerRef } =
    useAutoScroll(parentMessages);

  const threadMap = new Map<string, PseudonymousMessage[]>();
  messages
    .filter((m) => m.parentMessage)
    .filter((m) => !isPromptResponse(m))
    .forEach((reply) => {
      const parentId = reply.parentMessage!;
      if (!threadMap.has(parentId)) {
        threadMap.set(parentId, []);
      }
      threadMap.get(parentId)!.push(reply);
    });

  // Sort replies by createdAt
  threadMap.forEach((replies) => {
    replies.sort(
      (a, b) =>
        new Date(a.createdAt!).getTime() - new Date(b.createdAt!).getTime(),
    );
  });

  // Thread handlers
  const handleOpenThread = (messageId: string) => {
    setSelectedThreadId(messageId);
  };

  const handleCloseThread = () => {
    setSelectedThreadId(null);
  };

  const handleSendReply = (text: string, parentId: string) => {
    onSendMessage(text, parentId);
  };

  // Handler for marking a message as read (called after 1 second of visibility)
  const handleMarkAsRead = (messageId: string) => {
    onMarkAsRead?.(messageId);
  };

  // Find selected thread
  const selectedThread = selectedThreadId
    ? parentMessages.find((m) => m.id === selectedThreadId)
    : null;

  // Determine if we're waiting for a threaded reply
  const lastMessage = messages[messages.length - 1];
  const waitingForThreadedReply =
    waitingForResponse && lastMessage?.parentMessage;

  // Create enhancers for thread input (slash commands only)
  const threadEnhancers = [];
  if (slashCommands.length > 0) {
    threadEnhancers.push(createSlashCommandEnhancer(slashCommands));
  }

  // Render functions for ThreadedMessage and ThreadPanel
  const renderAvatar = (msg: PseudonymousMessage) => {
    const isAssistant = msg.fromAgent;
    const isCurrentUser = msg.pseudonym === pseudonym;
    const style = isAssistant
      ? getAssistantAvatarStyle()
      : getAvatarStyle(msg.pseudonym, isCurrentUser);

    return (
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
    );
  };

  const renderMessageContent = (msg: PseudonymousMessage) => {
    const isAssistant = msg.fromAgent;
    const isCurrentUser = msg.pseudonym === pseudonym;
    const parsed = parseMessageBody(msg.body);
    const messageType = parsed.type;
    const style = isAssistant
      ? getAssistantAvatarStyle()
      : getAvatarStyle(msg.pseudonym, isCurrentUser);

    const hasPromptOptions =
      msg.prompt?.options &&
      msg.prompt.options.length > 0 &&
      msg.prompt.type === "singleChoice";

    const bodyText = parsed.text;

    // Check for multimodal source context
    const sourceMessageId = parsed.sourceMessage;
    const sourceMsg = sourceMessageId
      ? messages.find((m) => m.id === sourceMessageId)
      : null;
    const sourceContextText = sourceMsg
      ? (() => {
          const sourceParsed = parseMessageBody(sourceMsg.body);
          const sourceText = sourceParsed.text;
          return sourceText.length > 60
            ? sourceText.substring(0, 60) + "..."
            : sourceText;
        })()
      : null;

    // Jargon clarification messages
    if (messageType === "jargon_clarification") {
      return <JargonClarificationMessage message={msg} />;
    }

    // Moderator submitted messages
    if (
      messageType === "moderator_submitted" ||
      submittedIds.includes(msg.id)
    ) {
      return (
        <div style={{ width: "85%" }}>
          {messageType === "moderator_submitted" ? (
            <ModeratorSubmittedMessage
              message={{
                ...msg,
                body: parsed.text,
              }}
            />
          ) : (
            <SubmittedMessage message={msg} />
          )}
        </div>
      );
    }

    // Assistant messages
    if (isAssistant) {
      if (hasPromptOptions) {
        return (
          <div style={{ width: "85%" }}>
            {sourceContextText && (
              <div className="text-xs text-gray-500 mb-1.5 pl-2 py-1 border-l-2 border-gray-300 bg-gray-50 rounded">
                <span className="font-medium">In reply to: </span>
                {sourceContextText}
              </div>
            )}
            <AssistantMessage
              message={{
                ...msg,
                body: bodyText,
              }}
              media={parsed.media}
              onPromptSelect={onPromptSelect}
              onImageClick={handleImageClick}
              onMarkmapClick={handleMarkmapClick}
              initialSelectedPrompt={
                msg.id
                  ? (() => {
                      const response = messages.find(
                        (m) => m.answersPrompt === msg.id,
                      );
                      return response
                        ? parseMessageBody(response.body).text
                        : undefined;
                    })()
                  : undefined
              }
            />
          </div>
        );
      } else {
        return (
          <div style={{ width: "85%" }}>
            {sourceContextText && (
              <div className="text-xs text-gray-500 mb-1.5 pl-2 py-1 border-l-2 border-gray-300 bg-gray-50 rounded">
                <span className="font-medium">In reply to: </span>
                {sourceContextText}
              </div>
            )}
            <div
              className="rounded-2xl px-2 py-1 text-gray-800 self-start"
              style={{
                backgroundColor: style.bubbleBg,
                width: "100%",
                border: "1px solid rgba(0, 0, 0, 0.1)",
              }}
            >
              <AssistantMessage
                message={{
                  ...msg,
                  body: bodyText,
                }}
                media={parsed.media}
                onPromptSelect={onPromptSelect}
                onImageClick={handleImageClick}
                onMarkmapClick={handleMarkmapClick}
              />
            </div>
          </div>
        );
      }
    }

    // User messages
    return <UserMessage message={msg} backgroundColor={style.bubbleBg} />;
  };

  return (
    <div className="flex h-full w-full">
      {/* Main chat panel - hidden on mobile when thread is open */}
      <div
        className={`flex flex-col h-full overflow-hidden ${
          selectedThreadId ? "hidden md:flex md:w-1/2" : "w-full"
        }`}
      >
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
                Ask {botName} any questions about the event — this conversation
                is private.
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

            {parentMessages.map((message, i) => {
              const replies = threadMap.get(message.id!) || [];
              // Calculate if we should show timestamp
              const showTimestamp = (() => {
                // Some messages, like intros, may not have createdAt - in that case, don't show timestamp
                if (!message.createdAt) return false;
                if (i === 0) return true;
                const prevDate = new Date(parentMessages[i - 1].createdAt!);
                const currDate = new Date(message.createdAt!);
                return (
                  prevDate.getHours() !== currDate.getHours() ||
                  prevDate.getMinutes() !== currDate.getMinutes()
                );
              })();

              return (
                <ThreadedMessage
                  key={`msg-${message.id}`}
                  message={message}
                  replies={replies}
                  pseudonym={pseudonym}
                  onOpenThread={handleOpenThread}
                  onMarkAsRead={handleMarkAsRead}
                  botName={botName}
                  renderAvatar={renderAvatar}
                  renderMessageContent={renderMessageContent}
                  feedbackConfig={feedbackConfig}
                  showTimestamp={showTimestamp}
                  isThreadOpen={selectedThreadId === message.id}
                  hasUnreadReplies={
                    message.id
                      ? messagesWithUnreadReplies.has(message.id)
                      : false
                  }
                />
              );
            })}

            {/* Bot loading indicator - appears after last user message (only for main chat) */}
            {waitingForResponse &&
              !waitingForThreadedReply &&
              parentMessages.length > 0 && (
                <div className="relative z-10 flex items-center gap-1 mt-2 mb-1">
                  <BotIcon size={32} color="#4b5563" bouncing={true} />
                  <span className="text-xs text-gray-500 italic">
                    thinking...
                  </span>
                </div>
              )}
            {/* Scroll target */}
            <div ref={messagesEndRef} className="h-2" />
          </div>
        </div>

        {/* MessageInput*/}
        <div className="flex-shrink-0">
          {inactive ? (
            <div className="px-4 py-3 text-sm text-gray-500 italic text-center border-t border-gray-200">
              This event has ended. {botName} is no longer active.
            </div>
          ) : (
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
          )}
        </div>
      </div>

      {/* Thread Panel - shown when a thread is selected */}
      {selectedThreadId && selectedThread && (
        <div className="w-full md:w-1/2">
          <ThreadPanel
            parentMessage={selectedThread}
            replies={threadMap.get(selectedThreadId) || []}
            pseudonym={pseudonym}
            onClose={handleCloseThread}
            onSendReply={handleSendReply}
            renderAvatar={renderAvatar}
            renderMessageContent={renderMessageContent}
            enhancers={threadEnhancers}
            botName={botName}
            feedbackConfig={feedbackConfig}
            waitingForResponse={
              !!(
                waitingForThreadedReply &&
                lastMessage?.parentMessage === selectedThreadId
              )
            }
          />
        </div>
      )}

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
