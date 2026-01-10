import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { RetrieveData } from "../../utils";
import { Api, CheckAuthHeader, getConversation } from "../../utils/Helpers";

import React from "react";
import {
  Card,
  CardContent,
  Typography,
  Divider,
  CircularProgress,
  Button,
  Skeleton,
  IconButton,
  Tooltip,
  Box,
} from "@mui/material";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import EventIcon from "@mui/icons-material/Event";
import ComputerIcon from "@mui/icons-material/Computer";
import { components } from "../../types";
import { Conversation, ErrorMessage } from "../../types.internal";
import { Request } from "../../utils/Api";

const EventCard = ({ event }: { event: Conversation }) => {
  const [copiedLink, setCopiedLink] = useState<string | null>(null);

  const handleCopyLink = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedLink(url);
      setTimeout(() => setCopiedLink(null), 2000);
    } catch (err) {
      console.error("Failed to copy link:", err);
    }
  };
  return (
    <Card className="w-full shadow-sm rounded-xl border border-gray-200 hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div className="flex-1 pr-4">
            <Typography
              variant="h5"
              className="font-semibold leading-snug line-clamp-2"
            >
              {event.name}
            </Typography>
          </div>
        </div>

        {/* Date and Platforms */}
        <div className="flex flex-col gap-3 sm:flex-row sm:gap-4 text-sm text-gray-600 mt-3 mb-2">
          <div className="flex-1 flex items-start gap-2">
            <EventIcon
              color={event.active ? "success" : "inherit"}
              style={{ fontSize: "18px" }}
              className="mt-0.5"
            />
            <div>
              {event.scheduledTime
                ? new Date(event.scheduledTime).toLocaleString("en-US", {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                    hour12: true,
                    timeZone: "America/New_York",
                    timeZoneName: "short",
                  })
                : new Date(event.createdAt!).toLocaleString("en-US", {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                    hour12: true,
                    timeZone: "America/New_York",
                    timeZoneName: "short",
                  })}
              {event.active && (
                <span className="ml-2 text-green-600 font-medium">
                  • In Progress
                </span>
              )}
            </div>
          </div>

          {/* Platforms */}
          {event.platformTypes && event.platformTypes.length > 0 && (
            <div className="flex-1 flex items-start gap-2">
              <ComputerIcon style={{ fontSize: "18px" }} className="mt-0.5" />
              <div>
                <span className="font-medium">Platforms:</span>{" "}
                {event.platformTypes
                  .map((platform) => platform.label || platform.name)
                  .join(", ")}
              </div>
            </div>
          )}
        </div>

        <Divider className="my-3" />

        {/* Agent info */}
        {event.type && (
          <div className="text-sm text-gray-700">
            <span className="font-medium">Agent:</span> {event.type.label}
          </div>
        )}
        {event.eventUrls.zoom && (
          <div className="text-sm text-gray-700 mt-1">
            <span className="font-medium">Zoom Link:</span>{" "}
            <a
              href={event.eventUrls.zoom.url}
              className="text-blue-600 hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              {event.eventUrls.zoom.label}
            </a>
            <Tooltip
              title={
                copiedLink === event.eventUrls.zoom.url
                  ? "Copied!"
                  : "Copy link"
              }
            >
              <IconButton
                size="small"
                onClick={() => handleCopyLink(event.eventUrls.zoom!.url)}
                className="p-0.5"
              >
                <ContentCopyIcon
                  fontSize="small"
                  className="text-gray-500"
                  style={{ fontSize: "14px" }}
                />
              </IconButton>
            </Tooltip>
          </div>
        )}
        {/* Links */}
        <div className="flex flex-col gap-3 sm:flex-row sm:gap-2 text-sm mt-5">
          {event.eventUrls.moderator &&
            event.eventUrls.moderator.length > 0 && (
              <div className="flex-1">
                <div className="font-medium">Moderator Links</div>
                {event.eventUrls.moderator?.map((link, i) => (
                  <div key={i}>
                    <a
                      href={link.url}
                      className="text-blue-600 hover:underline"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {link.label}
                    </a>
                    <Tooltip
                      title={copiedLink === link.url ? "Copied!" : "Copy link"}
                    >
                      <IconButton
                        size="small"
                        onClick={() => handleCopyLink(link.url)}
                        className="p-0.5"
                      >
                        <ContentCopyIcon
                          fontSize="small"
                          className="text-gray-500"
                          style={{ fontSize: "14px" }}
                        />
                      </IconButton>
                    </Tooltip>
                  </div>
                ))}
              </div>
            )}

          {event.eventUrls.participant &&
            event.eventUrls.participant.length > 0 && (
              <div className="flex-1">
                <div className="font-medium">Participant Links</div>
                {event.eventUrls.participant.map((link, i) => (
                  <div key={i}>
                    <a
                      href={link.url}
                      className="text-blue-600 hover:underline"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {link.label}
                    </a>
                    <Tooltip
                      title={copiedLink === link.url ? "Copied!" : "Copy link"}
                    >
                      <IconButton
                        size="small"
                        onClick={() => handleCopyLink(link.url)}
                        className="p-0.5"
                      >
                        <ContentCopyIcon
                          fontSize="small"
                          className="text-gray-500"
                          style={{ fontSize: "14px" }}
                        />
                      </IconButton>
                    </Tooltip>
                  </div>
                ))}
              </div>
            )}
        </div>
      </CardContent>
    </Card>
  );
};

const EventCardSkeleton = () => {
  return (
    <Card className="w-full shadow-sm rounded-xl border border-gray-200">
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div className="flex-1 pr-4">
            <Skeleton variant="text" width="70%" height={28} />
          </div>
        </div>

        {/* Date and Time */}
        <Skeleton variant="text" width="50%" height={20} className="mt-1" />

        <Divider className="my-3" />

        {/* Agent info */}
        <Skeleton variant="text" width="40%" height={20} />

        {/* Zoom link*/}
        <Skeleton variant="text" width="40%" height={20} />

        {/* Links */}
        <div className="flex flex-col gap-3 sm:flex-row sm:gap-2 mt-3">
          <div className="flex-1">
            <Skeleton variant="text" width="60%" height={20} />
            <Skeleton variant="text" width="80%" height={20} />
          </div>
          <div className="flex-1">
            <Skeleton variant="text" width="60%" height={20} />
            <Skeleton variant="text" width="80%" height={20} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export const getServerSideProps = async (context: { req: any }) => {
  return CheckAuthHeader(context.req.headers);
};

function EventScreen({ isAuthenticated }: { isAuthenticated: boolean }) {
  const router = useRouter();
  const [conversationsList, setConversationsList] =
    useState<components["schemas"]["Conversation"][]>();
  const [loadedConversations, setLoadedConversations] = useState<
    Conversation[]
  >([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [eventsShown, setEventsShown] = useState(6);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  /**
   * Filter conversations to only include those with scheduledTime in the future
   */
  const filterUpcomingConversations = (
    conversations: components["schemas"]["Conversation"][]
  ) => {
    const now = new Date();
    return conversations.filter((conv) => {
      if (!conv.scheduledTime) {
        return conv.active;
      }
      const scheduledDate = new Date(conv.scheduledTime);
      return scheduledDate > now;
    });
  };

  /**
   * Fetch detailed conversation data for specific conversations
   * @param list Array of conversations to fetch details for
   * @param indices Array of indices from conversationsList to fetch
   */
  const fetchDetailedConversations = async (
    list: components["schemas"]["Conversation"][],
    indices: number[]
  ) => {
    const detailedConversations = await Promise.all(
      indices.map(async (index) => {
        const conversationId = list[index].id;
        return await getConversation(conversationId!);
      })
    );

    // Filter out null values from failed fetches
    const validConversations = detailedConversations.filter(
      (conv): conv is Conversation => conv !== null
    );

    setLoadedConversations([
      ...(loadedConversations || []),
      ...validConversations,
    ]);
  };

  useEffect(() => {
    async function fetchInitialConversations() {
      const data: components["schemas"]["Conversation"][] | ErrorMessage =
        await Request("conversations/userConversations");

      // If unauthorized, redirect to login
      if ("error" in data && data.message?.code === 401) {
        router.push("/login");
        return;
      }

      if ("error" in data) {
        setErrorMessage(
          data.message?.message || "Failed to fetch conversations."
        );
        setIsInitialLoading(false);
        return;
      }

      // Filter to only upcoming events
      const upcomingConversations = filterUpcomingConversations(data);
      // Sort conversations chronologically: use scheduledTime if available, otherwise use createdAt
      const sortedConversations = upcomingConversations.sort((a, b) => {
        const aTime = a.scheduledTime
          ? new Date(a.scheduledTime).getTime()
          : new Date(a.createdAt!).getTime();
        const bTime = b.scheduledTime
          ? new Date(b.scheduledTime).getTime()
          : new Date(b.createdAt!).getTime();

        return aTime - bTime;
      });
      setConversationsList(sortedConversations);

      // Load first 6 details
      const initialIndices = sortedConversations.slice(0, 6).map((_, i) => i);
      await fetchDetailedConversations(sortedConversations, initialIndices);
      setIsInitialLoading(false);
    }

    if (!conversationsList) fetchInitialConversations();
  }, [conversationsList]);

  const handleLoadMore = async () => {
    if (!conversationsList || isLoadingMore) return;
    if (eventsShown >= conversationsList.length) return;

    setIsLoadingMore(true);

    const nextIndices = conversationsList
      .slice(eventsShown, eventsShown + 6)
      .map((_, i) => i + eventsShown);

    await fetchDetailedConversations(conversationsList, nextIndices);
    setEventsShown((prev) => prev + 6);
    setIsLoadingMore(false);
  };

  return (
    <div className="flex flex-col items-center mt-12 mb-8">
      <Typography variant="h4" gutterBottom>
        Upcoming Events
      </Typography>
      {errorMessage ? (
        <Typography color="error">{errorMessage}</Typography>
      ) : (
        <div className="w-3/4 space-y-6">
          {isInitialLoading ? (
            // Show 6 skeleton cards while loading
            <>
              {[...Array(6)].map((_, i) => (
                <EventCardSkeleton key={i} />
              ))}
            </>
          ) : (
            <>
              {loadedConversations.length === 0 && !isInitialLoading ? (
                <Box
                  display="flex"
                  flexDirection="column"
                  alignItems="center"
                  justifyContent="center"
                >
                  <Typography
                    variant="body1"
                    className="text-gray-600 text-center"
                  >
                    Currently you have no events scheduled
                  </Typography>
                  <Box mt={6}>
                    <Button
                      variant="outlined"
                      onClick={() => router.push("/admin/events/new")}
                    >
                      Create an event
                    </Button>
                  </Box>
                </Box>
              ) : (
                <>
                  {loadedConversations.map((event) => (
                    <EventCard key={event.id} event={event} />
                  ))}

                  {conversationsList &&
                    eventsShown < conversationsList.length && (
                      <div className="flex justify-center mt-6 mb-6">
                        <Button
                          variant="outlined"
                          onClick={handleLoadMore}
                          disabled={isLoadingMore}
                        >
                          {isLoadingMore ? (
                            <CircularProgress size={20} />
                          ) : (
                            "Load More"
                          )}
                        </Button>
                      </div>
                    )}
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default EventScreen;
