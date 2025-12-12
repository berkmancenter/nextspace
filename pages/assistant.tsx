import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import { io } from "socket.io-client";
import { Box, IconButton, InputAdornment, TextField } from "@mui/material";
import { Send } from "@mui/icons-material";

import { Element, scroller } from "react-scroll";

import { DirectMessage } from "../components";
import { Api, JoinSession, RetrieveData, SendData } from "../utils";
import { components } from "../types";
import { PseudonymousMessage } from "../types.internal";
import { CheckAuthHeader, randomizedSvgShape } from "../utils/Helpers";
import { animate, AnimatePresence, cubicBezier, motion } from "motion/react";

export const getServerSideProps = async (context: { req: any }) => {
  return CheckAuthHeader(context.req.headers);
};

function EventAssistantRoom() {
  const router = useRouter();

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [joining, setJoining] = useState(false);
  const [waitingForResponse, setWaitingForResponse] = useState(false);

  const [messages, setMessages] = useState<PseudonymousMessage[]>([]);

  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  const [currentMessage, setCurrentMessage] = useState("");
  const [pseudonym, setPseudonym] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [agentId, setAgentId] = useState<string | null>(null);
  const [socket, setSocket] = useState<ReturnType<typeof io> | null>(null);

  const messageInputRef = useRef<HTMLInputElement>(null);
  const mediaPlayerRef = useRef<HTMLAudioElement>(null);

  // Flair animation for new EA messages
  const flair = () => {
    const flairElement = document.getElementById("message-flair");
    if (flairElement) {
      flairElement.style.maskImage = randomizedSvgShape();
    }
    animate(
      "#message-flair",
      {
        scale: [0, 1.4 + Math.random() * 0.3],
        opacity: [1, 0],
        rotate: [
          `${-15 + Math.random() * 10}deg`,
          `${15 + Math.random() * 10}deg`,
        ],
        background: [
          `radial-gradient(at ${1 + Math.random() * 150}% ${
            35 + Math.random() * 20
          }%, #6366F1, transparent)`,
          `radial-gradient(at ${1 + Math.random() * 150}% ${
            35 + Math.random() * 20
          }%, #A78BFA, transparent)`,
        ],
      },
      { duration: 1.4, ease: cubicBezier(0.075, 0.82, 0.165, 1.0) }
    );
  };

  useEffect(() => {
    if (socket || joining) return;
    setJoining(true);
    JoinSession(
      (result) => {
        setPseudonym(result.pseudonym);
        setUserId(result.userId);
        let socketLocal = io(process.env.NEXT_PUBLIC_SOCKET_URL, {
          auth: { token: Api.get().GetTokens().access },
        });
        // Set the socket instance in state
        setSocket(socketLocal);
        setJoining(false);
      },
      (error) => {
        setErrorMessage(error);
      }
    );
  }, [socket, joining]);

  useEffect(() => {
    if (!socket) return;
    socket.on("error", (error: string) => {
      console.error("Socket error:", error);
    });
    socket.on("connect", () => setIsConnected(true));
    socket.on("disconnect", () => setIsConnected(false));

    return () => {
      socket.off("connect", () => setIsConnected(true));
      socket.off("disconnect", () => setIsConnected(false));
    };
  }, [socket]);

  useEffect(() => {
    if (!Api.get().GetTokens().access || !router.isReady) return;
    if (!router.query.conversationId) {
      setErrorMessage("Please provide a Conversation ID.");
      return;
    }

    async function fetchConversationData() {
      RetrieveData(
        `conversations/${router.query.conversationId}`,
        Api.get().GetTokens().access!
      )
        .then(async (conversation: any) => {
          if (!conversation) {
            setErrorMessage("Conversation not found.");
            return;
          }
          if ("error" in conversation) {
            setErrorMessage(
              conversation.message?.message || "Error retrieving conversation."
            );
            return;
          }
          // Check if the event has an event assistant agent
          // TODO: This should really be a property of the conversation, not inferred from agents
          const hasEventAssistant = conversation.agents.some(
            (agent: components["schemas"]["Agent"]) =>
              agent.agentType === "eventAssistant"
          );
          if (hasEventAssistant)
            setAgentId(
              conversation.agents.find(
                (agent: components["schemas"]["Agent"]) =>
                  agent.agentType === "eventAssistant"
              )?.id
            );
          else {
            setErrorMessage(
              "This conversation does not have an event assistant agent."
            );
            return;
          }
          if (!socket || !socket.auth) {
            return;
          }

          if (!socket.hasListeners("message:new"))
            socket.on("message:new", (data) => {
              if (process.env.NODE_ENV !== "production")
                console.log("New message:", data);

              // Append new message to messages list
              setMessages((prev) => [...prev, data]);

              // Play new message sound
              if (
                mediaPlayerRef.current &&
                data.pseudonym !== pseudonym &&
                messagesRef.current.length > 0
              ) {
                flair();
                mediaPlayerRef.current.currentTime = 0;
                mediaPlayerRef.current.play().catch((e) => {
                  console.error("Error playing sound:", e);
                });
              }
              scroller.scrollTo("end", {
                duration: 800,
                delay: 0,
                offset: 200,
                smooth: "easeInOutQuart",
                containerId: "scroll-container",
              });
              if (data.pseudonym === "Event Assistant")
                setWaitingForResponse(false);
            });

          if (agentId && userId)
            socket.emit("conversation:join", {
              conversationId: router.query.conversationId,
              token: Api.get().GetTokens().access,
              channel: { name: `direct-${userId}-${agentId}` },
            });
        })
        .catch((error) => {
          console.error("Error fetching conversation data:", error);
          setErrorMessage("Failed to fetch conversation data.");
        });
    }
    fetchConversationData();
  }, [socket, router, userId, agentId, pseudonym, messages]);

  async function sendMessage(message: string) {
    if (!Api.get().GetTokens() || !message) return;
    let channels = [{ name: `direct-${userId}-${agentId}` }];

    setWaitingForResponse(true);
    setCurrentMessage("");

    await SendData("messages", {
      body: message,
      bodyType: "text",
      conversation: router.query.conversationId,
      channels,
    });

    messageInputRef.current!.value = "";
  }

  return (
    <div className="h-screen flex items-start justify-center mt-12">
      {/* Hidden media player for new message SFX */}
      <audio
        ref={mediaPlayerRef}
        src="/new-msg.wav"
        preload="auto"
        autoPlay={false}
        loop={false}
      />
      {errorMessage ? (
        <div className="text-medium-slate-blue text-lg font-bold mx-9">
          {errorMessage}
        </div>
      ) : (
        <div className="w-11/12 lg:w-2/3">
          <h2 className="text-3xl font-bold mb-4 w-full text-center">
            Ask the Event Assistant
          </h2>

          {
            isConnected ? (
              <Box
                display="flex"
                flexDirection="column"
                height="100vh"
                overflow="hidden"
              >
                {/* Conversation View */}
                <div
                  className="overflow-auto flex flex-col grow items-center gap-8 mt-4 mb-32 xl:mb-20"
                  id="scroll-container"
                  aria-live="assertive"
                >
                  {messages.map((message, i) => (
                    <div key={`msg-${i}`} className="w-full lg:w-3/4 px-2">
                      <div className="flex flex-col lg:flex-row gap-x-5.5">
                        <p className="flex flex-col min-w-24 items-center text-sm text-neutral-600 mb-1 lg:mb-0 lg:mt-2">
                          {new Date(message.createdAt!).toLocaleTimeString(
                            "en-US",
                            {
                              hour: "2-digit",
                              minute: "2-digit",
                            }
                          )}
                          {message.pseudonym === "Event Assistant" && (
                            <>
                              <span className="hidden lg:inline-block h-full border-l-2 border-l-dark-blue opacity-50 border-dotted my-1"></span>
                              {waitingForResponse &&
                                i ===
                                  messages.findLastIndex(
                                    (msg) => msg.pseudonym === "Event Assistant"
                                  ) && (
                                  <svg
                                    viewBox="0 0 32 32"
                                    className="w-10 h-10 text-black dark:text-white mx-auto"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="0.7"
                                  >
                                    <circle
                                      cx="16"
                                      cy="5.5"
                                      r="1"
                                      className="animate-bounce"
                                    />
                                    <line x1="16" y1="6.5" x2="16" y2="10" />
                                    <rect
                                      x="8"
                                      y="10"
                                      width="16"
                                      height="12"
                                      rx="6"
                                    />
                                    <circle cx="12" cy="16" r="1" />
                                    <circle cx="20" cy="16" r="1" />
                                    <path
                                      d="M13 19 Q16 21 19 19"
                                      stroke-linecap="round"
                                      fill="none"
                                    />
                                    <line x1="8" y1="15" x2="4.5" y2="13" />
                                    <line x1="24" y1="15" x2="27.5" y2="13" />
                                    <rect
                                      x="13"
                                      y="22"
                                      width="6"
                                      height="5"
                                      rx="2"
                                    />
                                  </svg>
                                )}
                            </>
                          )}
                        </p>
                        <AnimatePresence>
                          <motion.div
                            key={`msg-${i}`}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.3 }}
                          >
                            <DirectMessage
                              text={message.body}
                              date={new Date(message.createdAt!)}
                              theme={
                                message.pseudonym === "Event Assistant"
                                  ? "assistant"
                                  : "none"
                              }
                            />
                          </motion.div>
                        </AnimatePresence>
                      </div>
                    </div>
                  ))}

                  <motion.div
                    id="message-flair-dad"
                    className="relative h-56 w-1/2 blur-md"
                  >
                    <motion.div
                      className="w-full h-full rounded-full bg-radial-[at_30%_45%] from-indigo-500 to-transparent"
                      id="message-flair"
                      style={{
                        maskImage:
                          'url(\'data:image/svg+xml,%3Csvg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg"%3E%3Cpath fill="black" d="M44.7,-76.4C58.8,-69.2,71.8,-59.1,79.6,-45.8C87.4,-32.6,90,-16.3,88.5,-0.9C87,14.6,81.4,29.2,73.1,42.8C64.8,56.4,53.8,69,39.8,76.8C25.8,84.6,8.8,87.6,-7.6,87.1C-24,86.6,-39.4,82.6,-52.8,74.4C-66.2,66.2,-77.6,53.8,-84.8,38.8C-92,23.8,-95,6.2,-92.4,-10.2C-89.8,-26.6,-81.6,-41.8,-69.8,-52.8C-58,-63.8,-42.6,-70.6,-27.4,-77.4C-12.2,-84.2,2.6,-91,18.8,-91.4C35,-91.8,30.6,-83.6,44.7,-76.4Z" transform="translate(100 100)" stroke-linejoin="round" stroke-linecap="round" /%3E%3C/svg%3E\')',
                        maskSize: "contain",
                        maskRepeat: "no-repeat",
                        maskPosition: "center",
                      }}
                    />
                  </motion.div>
                  {/* Scroll to bottom element */}
                  <Element name="end" />
                </div>
                {pseudonym && (
                  <div className="flex justify-center fixed bottom-0 left-0 right-0 bg-white">
                    <div className="w-11/12 lg:w-1/2">
                      {/* Message Input */}
                      <Box display="flex" alignItems="center" padding="8px">
                        <div className="flex flex-col w-full">
                          <div className="border-[1px] border-b-0 border-[#A5B4FC] rounded-t-lg p-2 font-bold text-sm uppercase">
                            Writing as {pseudonym}
                          </div>
                          <TextField
                            id="message-input"
                            ref={messageInputRef}
                            type="text"
                            placeholder="Write a Comment"
                            value={currentMessage}
                            onChange={(e) => {
                              if (messageInputRef.current) {
                                messageInputRef.current.value = e.target.value;
                                setCurrentMessage(e.target.value);
                              }
                            }}
                            onKeyUp={(e) => {
                              if (
                                e.key === "Enter" &&
                                !!currentMessage &&
                                currentMessage.length > 0 &&
                                !waitingForResponse
                              )
                                sendMessage(messageInputRef.current!.value);
                            }}
                            style={{
                              flex: 1,
                            }}
                            sx={{
                              // Root class for the input field
                              "& .MuiOutlinedInput-root": {
                                // Class for the border around the input field
                                "& .MuiOutlinedInput-notchedOutline": {
                                  borderColor: "#A5B4FC",
                                  borderWidth: "1px",
                                  borderBottomLeftRadius: "8px",
                                  borderBottomRightRadius: "8px",
                                  borderTopLeftRadius: 0,
                                  borderTopRightRadius: 0,
                                },
                              },
                            }}
                            slotProps={{
                              input: {
                                endAdornment: (
                                  <InputAdornment position="end">
                                    <IconButton
                                      onClick={flair}
                                      aria-label="add flair"
                                      size="small"
                                    >
                                      ✨
                                    </IconButton>
                                    <IconButton
                                      onClick={() =>
                                        sendMessage(
                                          messageInputRef.current!.value
                                        )
                                      }
                                      aria-label="send message"
                                      disabled={
                                        !currentMessage ||
                                        currentMessage.length < 1 ||
                                        waitingForResponse
                                      }
                                    >
                                      <Send
                                        sx={{
                                          opacity:
                                            !currentMessage ||
                                            currentMessage.length < 1
                                              ? 0.5
                                              : 1,
                                          color: "white",
                                          backgroundColor: "#2f69c4",
                                          borderRadius: "50%",
                                          padding: "4px",
                                          transform: "rotate(-45deg)",
                                        }}
                                      />
                                    </IconButton>
                                  </InputAdornment>
                                ),
                              },
                            }}
                          />
                        </div>
                      </Box>
                    </div>
                  </div>
                )}
              </Box>
            ) : (
              <svg
                className="mx-auto w-12 h-5"
                viewBox="0 0 40 10"
                fill="currentColor"
              >
                <circle
                  className="animate-bounce fill-sky-400"
                  cx="5"
                  cy="5"
                  r="4"
                />
                <circle
                  className="animate-bounce [animation-delay:-0.2s] fill-medium-slate-blue"
                  cx="20"
                  cy="5"
                  r="4"
                />
                <circle
                  className="animate-bounce [animation-delay:-0.4s] fill-purple-500"
                  cx="35"
                  cy="5"
                  r="4"
                />
              </svg>
            ) /* Loading indicator */
          }
        </div>
      )}
    </div>
  );
}

export default EventAssistantRoom;
