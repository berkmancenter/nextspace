import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/router";
import { getUserTimezone } from "../../utils";
import { CheckAuthHeader, getConversation } from "../../utils/Helpers";
import { AuthType } from "../../types.internal";

import React from "react";
import {
  Card,
  CardContent,
  Typography,
  Divider,
  CircularProgress,
  Button,
  Switch,
  Skeleton,
  IconButton,
  Tooltip,
  Dialog,
} from "@mui/material";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import EventIcon from "@mui/icons-material/Event";
import ComputerIcon from "@mui/icons-material/Computer";
import DeleteIcon from "@mui/icons-material/Delete";
import ReportProblem from "@mui/icons-material/ReportProblem";
import { components } from "../../types";
import { Conversation, ErrorMessage } from "../../types.internal";
import { Request } from "../../utils/Api";
import { SendData } from "../../utils/Helpers";

const EventCard = ({
  event,
  onDelete,
}: {
  event: Conversation;
  onDelete: (id: string) => void;
}) => {
  const [copiedLink, setCopiedLink] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleCopyLink = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedLink(url);
      setTimeout(() => setCopiedLink(null), 2000);
    } catch (err) {
      console.error("Failed to copy link:", err);
    }
  };

  const handleDeleteClick = () => {
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    setIsDeleting(true);
    try {
      await SendData(`conversations/${event.id}`, {}, undefined, {
        method: "DELETE",
      });
      setDeleteDialogOpen(false);
      onDelete(event.id!);
    } catch (err) {
      console.error("Failed to delete event:", err);
      setIsDeleting(false);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
  };

  return (
    <>
      <Card className="w-full shadow-sm rounded-xl border border-gray-200 hover:shadow-md transition-shadow">
        <CardContent className="p-4">
          {/* Header */}
          <div className="flex justify-between items-start">
            <div className="flex-1 pr-4">
              <Tooltip title={`ID: ${event.id}`} placement="bottom-start">
                <Typography
                  variant="h5"
                  className="font-semibold leading-snug line-clamp-2"
                >
                  {event.name}
                </Typography>
              </Tooltip>
            </div>
            <Tooltip title="Delete event">
              <IconButton
                size="small"
                onClick={handleDeleteClick}
                className="text-gray-500 hover:text-red-600"
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Tooltip>
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
                      timeZone: getUserTimezone(),
                      timeZoneName: "short",
                    })
                  : new Date(event.createdAt!).toLocaleString("en-US", {
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                      hour12: true,
                      timeZone: getUserTimezone(),
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
                        title={
                          copiedLink === link.url ? "Copied!" : "Copy link"
                        }
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
                        title={
                          copiedLink === link.url ? "Copied!" : "Copy link"
                        }
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

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={handleDeleteCancel}
        aria-labelledby="delete-dialog-title"
        aria-describedby="delete-dialog-description"
        slotProps={{
          paper: {
            sx: {
              borderRadius: "16px",
              padding: "32px 24px",
              maxWidth: "440px",
              textAlign: "center",
            },
          },
        }}
      >
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-full border-2 border-red-400 flex items-center justify-center">
            <ReportProblem sx={{ fontSize: 40, color: "#f87171" }} />
          </div>
          <h2
            id="delete-dialog-title"
            className="text-2xl font-bold text-gray-900"
          >
            Delete event?
          </h2>
          <p
            id="delete-dialog-description"
            className="text-gray-600 text-base leading-relaxed max-w-sm"
          >
            This will permanently delete "{event.name}" and cannot be undone.
          </p>
          <div className="flex flex-col gap-3 w-full mt-2">
            <Button
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
              variant="contained"
              sx={{
                backgroundColor: "#b91c1c",
                color: "white",
                padding: "12px 24px",
                borderRadius: "8px",
                textTransform: "none",
                fontSize: "16px",
                fontWeight: 600,
                "&:hover": {
                  backgroundColor: "#991b1b",
                },
              }}
              autoFocus
            >
              {isDeleting ? <CircularProgress size={20} /> : "Yes, Delete"}
            </Button>
            <Button
              onClick={handleDeleteCancel}
              disabled={isDeleting}
              sx={{
                color: "#4b5563",
                textTransform: "none",
                fontSize: "16px",
                fontWeight: 500,
                textDecoration: "underline",
                "&:hover": {
                  backgroundColor: "transparent",
                  textDecoration: "underline",
                },
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      </Dialog>
    </>
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

function EventScreen({ authType }: { authType: AuthType }) {
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
  const [includePast, setIncludePast] = useState(false);
  const allConversationsRef = useRef<
    components["schemas"]["Conversation"][] | null
  >(null);

  /**
   * Filter conversations to upcoming or past events
   * @param past true to return past events, false for upcoming
   */
  const filterConversations = (
    conversations: components["schemas"]["Conversation"][],
    past: boolean,
  ) => {
    const now = new Date();
    return conversations.filter((conv) => {
      if (past) {
        if (conv.active) return false;
        if (!conv.scheduledTime) return true;
        return new Date(conv.scheduledTime) <= now;
      }
      if (!conv.scheduledTime) return conv.active;
      if (conv.active) return true; // Show all active events
      return new Date(conv.scheduledTime) > now;
    });
  };

  /**
   * Sort conversations by time
   * @param ascending true for earliest first (upcoming), false for latest first (past)
   */
  const sortConversations = (
    conversations: components["schemas"]["Conversation"][],
    ascending: boolean,
  ) => {
    return [...conversations].sort((a, b) => {
      const aTime = a.scheduledTime
        ? new Date(a.scheduledTime).getTime()
        : new Date(a.createdAt!).getTime();
      const bTime = b.scheduledTime
        ? new Date(b.scheduledTime).getTime()
        : new Date(b.createdAt!).getTime();
      return ascending ? aTime - bTime : bTime - aTime;
    });
  };

  /**
   * Handle deletion of an event
   * @param id The conversation ID to delete
   */
  const handleDelete = async (id: string) => {
    setLoadedConversations((prev) => prev.filter((conv) => conv.id !== id));

    const newList = conversationsList?.filter((conv) => conv.id !== id) ?? [];
    setConversationsList(newList);

    if (allConversationsRef.current) {
      allConversationsRef.current = allConversationsRef.current.filter(
        (conv) => conv.id !== id,
      );
    }

    // Load the next event to fill the gap if one exists
    if (newList.length > eventsShown - 1) {
      const nextIndex = await fetchDetailedConversations(
        newList,
        eventsShown - 1,
        1,
      );
      setEventsShown(nextIndex);
    }
  };

  /**
   * Fetch detailed conversation data, skipping past nulls until target is met
   * @param list Full sorted conversation list to fetch from
   * @param startIndex Index to begin fetching from
   * @param target Number of valid conversations to load
   * @param replace If true, replace loadedConversations instead of appending
   * @returns The next index to fetch from after this call
   */
  const fetchDetailedConversations = async (
    list: components["schemas"]["Conversation"][],
    startIndex: number,
    target: number,
    replace: boolean = false,
  ): Promise<number> => {
    const allValid: Conversation[] = [];
    let currentIndex = startIndex;

    while (allValid.length < target && currentIndex < list.length) {
      const batchSize = Math.min(
        target - allValid.length,
        list.length - currentIndex,
      );
      const batch = await Promise.all(
        Array.from({ length: batchSize }, async (_, i) => {
          const id = list[currentIndex + i].id;
          try {
            return await getConversation(id!);
          } catch (err) {
            console.error(`Failed to fetch conversation ${id}:`, err);
            return null;
          }
        }),
      );
      batch.forEach((conv, i) => {
        if (!conv) {
          console.warn(
            `Conversation ${list[currentIndex + i].id} returned null`,
          );
        }
      });
      allValid.push(
        ...batch.filter((conv): conv is Conversation => conv !== null),
      );
      currentIndex += batchSize;
    }

    setLoadedConversations((prev) => [
      ...(replace ? [] : prev),
      ...allValid,
    ]);

    return currentIndex;
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
          data.message?.message || "Failed to fetch conversations.",
        );
        setIsInitialLoading(false);
        return;
      }

      // Store raw response for tab switching
      allConversationsRef.current = data;

      // Filter to only upcoming events and sort chronologically
      const upcomingConversations = filterConversations(data, false);
      const sortedConversations = sortConversations(
        upcomingConversations,
        true,
      );
      setConversationsList(sortedConversations);

      // Load first 6 details
      const nextIndex = await fetchDetailedConversations(
        sortedConversations,
        0,
        6,
      );
      setEventsShown(nextIndex);
      setIsInitialLoading(false);
    }

    if (!conversationsList) fetchInitialConversations();
  }, [conversationsList]);

  const handleLoadMore = async () => {
    if (!conversationsList || isLoadingMore) return;
    if (eventsShown >= conversationsList.length) return;

    setIsLoadingMore(true);

    const nextIndex = await fetchDetailedConversations(
      conversationsList,
      eventsShown,
      6,
    );
    setEventsShown(nextIndex);
    setIsLoadingMore(false);
  };

  const handleToggle = async (include: boolean) => {
    if (!allConversationsRef.current) return;
    setIncludePast(include);
    setIsInitialLoading(true);

    const sortedUpcoming = sortConversations(
      filterConversations(allConversationsRef.current, false),
      true,
    );
    const sorted = include
      ? [
          ...sortedUpcoming,
          ...sortConversations(
            filterConversations(allConversationsRef.current, true),
            true,
          ),
        ]
      : sortedUpcoming;

    setConversationsList(sorted);

    const nextIndex = await fetchDetailedConversations(sorted, 0, 6, true);
    setEventsShown(nextIndex);
    setIsInitialLoading(false);
  };

  return (
    <div className="flex flex-col items-center mt-12 mb-8">
      <Typography variant="h4" gutterBottom>
        Events
      </Typography>
      {errorMessage ? (
        <Typography color="error">{errorMessage}</Typography>
      ) : (
        <div className="w-3/4 space-y-6">
          <div className="flex justify-end">
            <label className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 transition-colors rounded-full px-3 py-1 cursor-pointer">
              <span className="text-xs text-gray-500 select-none">
                Include past events
              </span>
              <Switch
                checked={includePast}
                onChange={(e) => handleToggle(e.target.checked)}
                size="small"
                sx={{ m: 0 }}
              />
            </label>
          </div>
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
                <div className="border-2 border-dashed border-gray-300 rounded-xl p-12 flex flex-col items-center gap-3">
                  <EventIcon
                    className="text-gray-400"
                    style={{ fontSize: "40px" }}
                  />
                  <Typography variant="body1" className="text-gray-500">
                    {includePast ? "No events" : "No upcoming events"}
                  </Typography>
                  <Button
                    variant="outlined"
                    onClick={() => router.push("/admin/events/new")}
                  >
                    Create an event
                  </Button>
                </div>
              ) : (
                <>
                  {loadedConversations.map((event) => (
                    <EventCard
                      key={event.id}
                      event={event}
                      onDelete={handleDelete}
                    />
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
