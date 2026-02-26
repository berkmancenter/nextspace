import { FC, ReactNode, useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import {
  Box,
  Button,
  IconButton,
  InputAdornment,
  TextField,
  Tooltip,
} from "@mui/material";
import { CloudOffOutlined, CloudOutlined, Send } from "@mui/icons-material";
import { Element, scroller } from "react-scroll";

import {
  Api,
  GetChannelPasscode,
  QueryParamsError,
  SendData,
  emitWithTokenRefresh,
} from "../utils";

import { components } from "../types";
import { BackchannelMessage } from "../components/messages/BackchannelMessage";
import { CheckAuthHeader } from "../utils/Helpers";
import { useSessionJoin } from "../utils/useSessionJoin";
import { AuthType } from "../types.internal";
import { useAnalytics } from "../hooks/useAnalytics";
import {
  trackConversationEvent,
} from "../utils/analytics";

export const getServerSideProps = async (context: { req: any }) => {
  return CheckAuthHeader(context.req.headers);
};

function BackchannelRoom({ authType }: { authType: AuthType }) {
  const router = useRouter();

  // Initialize page-level analytics
  useAnalytics({ pageType: "backchannel" });

  const [showWelcome, setShowWelcome] = useState(true);
  const [participantPasscode, setParticipantPasscode] = useState("");
  const [transcriptPasscode, setTranscriptPasscode] = useState<string | null>(
    null,
  );
  const [localError, setLocalError] = useState<string | null>(null);

  const [messages, setMessages] = useState<components["schemas"]["Message"][]>(
    [],
  );
  const [currentMessage, setCurrentMessage] = useState("");

  const messageInputRef = useRef<HTMLInputElement>(null);

  // Use custom hook for session joining
  const {
    socket,
    pseudonym,
    isConnected,
    errorMessage: sessionError,
  } = useSessionJoin();

  // Combine session and local errors
  const errorMessage = sessionError || localError;

  useEffect(() => {
    if (participantPasscode || !router.isReady) return;
    if (
      !router.query.conversationId ||
      !router.query.channel ||
      router.query.channel.length === 0
    ) {
      setLocalError(QueryParamsError(router));
      return;
    }

    async function fetchConversationData() {
      if (router.query.channel) {
        setTranscriptPasscode(
          GetChannelPasscode("transcript", router.query, setLocalError)
        );
        const participantPasscodeParam = GetChannelPasscode(
          "participant",
          router.query,
          setLocalError
        );

        if (!participantPasscodeParam) return;
        // Store passcode in state; the join effect below will handle the actual
        // conversation:join (and re-join on every reconnection).
        setParticipantPasscode(participantPasscodeParam);
      }
    }
    fetchConversationData();
  }, [participantPasscode, socket, router]);

  // Join the backchannel conversation once the passcode is known, and re-join
  // on every socket reconnection (e.g. after a token refresh or network drop).
  useEffect(() => {
    if (!socket || !router.query.conversationId || !participantPasscode) return;

    const joinBackchannel = () => {
      // Always read the current token so re-joins after a refresh use the
      // new token rather than the one captured at socket-creation time.
      emitWithTokenRefresh(
        socket,
        "conversation:join",
        {
          conversationId: router.query.conversationId,
          token: Api.get().GetTokens().access,
          threadId: router.query.threadId,
        },
        () => console.log("Successfully joined backchannel conversation"),
        (error) =>
          console.error("Error joining backchannel conversation:", error),
      );
    };

    // Initial join
    joinBackchannel();

    // Re-join on every subsequent reconnection (e.g. after token refresh)
    socket.on("connect", joinBackchannel);

    return () => {
      socket.off("connect", joinBackchannel);
    };
  }, [socket, router.query.conversationId, router.query.threadId, participantPasscode]);

  function sendMessage(message: string, preset = false) {
    if (!participantPasscode) return;

    let channels = [{ name: "participant", passcode: participantPasscode }];

    // Add transcript channel and passcode passed in query
    if (transcriptPasscode)
      channels.push({
        name: "transcript",
        passcode: transcriptPasscode,
      });

    // Track message send
    const conversationId = router.query.conversationId as string;
    if (preset) {
      trackConversationEvent(
        conversationId,
        "backchannel",
        "quick_response_sent",
        message,
      );
    } else {
      trackConversationEvent(
        conversationId,
        "backchannel",
        "custom_message_sent",
        "custom_message",
      );
    }

    SendData("messages", {
      body: {
        text: message || "This is a test message",
        preset,
      },
      bodyType: "json",
      conversation: router.query.conversationId,
      channels,
    })
      .then((message) => {
        setMessages((prev) => [
          ...prev,
          {
            ...message[0],
          },
        ]);
        setCurrentMessage("");
        messageInputRef.current!.value = "";

        scroller.scrollTo("end", {
          duration: 800,
          delay: 0,
          offset: 200,
          smooth: "easeInOutQuart",
          containerId: "scroll-container",
        });
      })
      .catch((error) => {
        console.error("Failed to send message:", error);
        setLocalError("Failed to send message. Please try again.");
      });
  }

  // TODO: We need a proper MUI theme
  const QuickResponseButton: FC<{ label: string; icon: ReactNode }> = ({
    label,
    icon,
  }) => (
    <Button
      onClick={async () => {
        // setCurrentMessage(label);
        await sendMessage(label, true);
      }}
      variant="outlined"
      size="small"
      aria-label={label}
      sx={{
        display: "block",
        borderRadius: "50px",
        borderColor: "#97C3F0",
        textTransform: "none",
        color: "#0B6BCB",
      }}
    >
      <div className="block sm:inline-block">{icon}</div>
      <span>&nbsp;{label}</span>
    </Button>
  );

  return (
    <div className="h-screen flex items-start justify-center mt-12">
      {errorMessage ? (
        <div className="text-medium-slate-blue text-lg font-bold mx-9">
          {errorMessage}
        </div>
      ) : (
        <div className="w-11/12 lg:w-2/3">
          {showWelcome ? (
            <div className="flex flex-col h-screen items-center">
              <h1 className="text-xl font-bold text-medium-slate-blue text-center">
                Welcome to your backchannel
              </h1>
              <div className="mt-4 mx-2 lg:mx-28 text-lg text-gray-500">
                <p>
                  This is the LLM backchannel, here to help today&apos;s
                  moderator steer the discussion toward what the audience cares
                  about most.
                </p>
                <p className="mt-4">
                  Send reactions, questions, or topics you want more of, and the
                  moderator will get a digestible summary.
                </p>
                <p className="mt-4">
                  Please note that a pseudonymized message transcript will be
                  visible to our engineering team. Please share your feedback on
                  the tool at <b>brk.mn/feedback!</b>, and enjoy the event!
                </p>
              </div>
              <Button
                variant="contained"
                color="primary"
                onClick={() => {
                  setShowWelcome(false);
                  const conversationId = router.query.conversationId as string;
                  if (conversationId) {
                    trackConversationEvent(
                      conversationId,
                      "backchannel",
                      "welcome_dismissed",
                      "welcome_screen",
                    );
                  }
                }}
                sx={{ marginTop: "1rem", maxWidth: "10rem" }}
              >
                Got it!
              </Button>
            </div>
          ) : (
            <>
              <div
                className="max-w-2.5"
                aria-label={`Connection status is ${
                  isConnected ? "connected" : "disconnected"
                }`}
              >
                {isConnected ? (
                  <Tooltip
                    title={
                      <>
                        <p>{`Pseudonym: ${pseudonym}`}</p>
                        <p>{`Conversation ID: ${process.env.NEXT_PUBLIC_LLM_FCLTR_CONVERSATION_ID}`}</p>
                      </>
                    }
                  >
                    <CloudOutlined sx={{ color: "green" }} />
                  </Tooltip>
                ) : (
                  <Tooltip
                    title={
                      <>
                        <p>{`Pseudonym: ${pseudonym}`}</p>
                        <p>{`Conversation ID: ${process.env.NEXT_PUBLIC_LLM_FCLTR_CONVERSATION_ID}`}</p>
                      </>
                    }
                  >
                    <CloudOffOutlined sx={{ color: "red" }} />
                  </Tooltip>
                )}
              </div>
              <Box
                display="flex"
                flexDirection="column"
                height="90vh"
                overflow="hidden"
              >
                {/* Conversation View */}
                <Box
                  flex="1"
                  overflow="auto"
                  display="flex"
                  flexDirection="column"
                  gap="8px"
                  id="scroll-container"
                >
                  {messages.map((message, i) => (
                    <BackchannelMessage
                      key={`msg-${i}`}
                      message={{ ...message, body: (message.body as any).text }}
                    />
                  ))}
                  <div className="mt-20 w-full block" />
                  <Element name="end" />
                </Box>
                <div className="flex justify-center fixed bottom-0 left-0 right-0 bg-white">
                  <div className="w-11/12 lg:w-4/5">
                    {/* Quick Response Buttons */}
                    <div className="flex flex-row justify-center gap-x-2 md:gap-x-3 items-center text-xs p-2">
                      <QuickResponseButton label="Let's move on" icon="😀" />
                      <QuickResponseButton label="That's cool" icon="🌟" />
                      <QuickResponseButton label="I'm confused" icon="😵‍💫" />
                    </div>
                    {/* Message Input */}
                    <Box display="flex" alignItems="center" padding="8px">
                      <TextField
                        id="message-input"
                        ref={messageInputRef}
                        type="text"
                        placeholder="Type your message..."
                        value={currentMessage}
                        onChange={(e) => {
                          if (messageInputRef.current) {
                            messageInputRef.current.value = e.target.value;
                            setCurrentMessage(e.target.value);
                          }
                        }}
                        onKeyUp={(e) => {
                          if (e.key === "Enter")
                            sendMessage(messageInputRef.current!.value);
                        }}
                        style={{
                          flex: 1,
                          padding: "8px",
                          marginRight: "8px",
                        }}
                        sx={{
                          // Root class for the input field
                          "& .MuiOutlinedInput-root": {
                            // Class for the border around the input field
                            "& .MuiOutlinedInput-notchedOutline": {
                              borderColor: "#A5B4FC",
                              borderWidth: "1px",
                              borderRadius: "8px",
                            },
                          },
                        }}
                        slotProps={{
                          input: {
                            endAdornment: (
                              <InputAdornment position="end">
                                <IconButton
                                  onClick={() =>
                                    sendMessage(messageInputRef.current!.value)
                                  }
                                  aria-label="send message"
                                  disabled={
                                    !currentMessage || currentMessage.length < 1
                                  }
                                >
                                  <Send
                                    sx={{
                                      color:
                                        !currentMessage ||
                                        currentMessage.length < 1
                                          ? "grey"
                                          : "#4845D2",
                                    }}
                                  />
                                </IconButton>
                              </InputAdornment>
                            ),
                          },
                        }}
                      />
                    </Box>
                  </div>
                </div>
              </Box>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default BackchannelRoom;
