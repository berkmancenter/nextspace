import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { getUserTimezone } from '../../utils';
import { CheckAuthHeader, getConversation } from '../../utils/Helpers';
import { useSessionJoin } from '../../utils/useSessionJoin';

import React from 'react';
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
  Alert,
  Snackbar,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Select,
  Drawer,
  FormControl,
  InputLabel,
  Chip,
  Box,
} from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import EventIcon from '@mui/icons-material/Event';
import ComputerIcon from '@mui/icons-material/Computer';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import ReportProblem from '@mui/icons-material/ReportProblem';
import DownloadIcon from '@mui/icons-material/Download';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StopIcon from '@mui/icons-material/Stop';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import { CloseSharp, FilterListSharp } from '@mui/icons-material';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs from 'dayjs';
import { components } from '../../types';
import { AuthType, Conversation, ErrorMessage } from '../../types.internal';
import { SendData } from '../../utils/Helpers';
import { Request } from '../../utils';
import {
  generateAndDownloadUserMetricsReport,
  generateAndDownloadDirectMessageResponsesReport,
} from '../../utils/eventReportGenerator';

const EventCard = ({
  event,
  currentUserId,
  onDelete,
  onMessage,
}: {
  event: Conversation;
  onDelete: (id: string) => void;
  currentUserId: string | null;
  onMessage: (id: string, message: string, error: boolean) => void;
}) => {
  const router = useRouter();
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [waitingOnAction, setWaitingOnAction] = useState(false);

  // Check if current user is the owner of this event (used for "My Event" badge only)
  const isOwner = currentUserId && event.owner === currentUserId;

  // Edit is available for future inactive events with a known type
  const eventStarted = !!event.startTime;
  const isPast = !!event.endTime;
  const isMissed =
    !event.active &&
    !event.startTime &&
    !event.endTime &&
    (!event.scheduledTime || new Date(event.scheduledTime) <= new Date());
  const canEdit = !event.active && !eventStarted && !!event.type?.name;

  const handleCopyLink = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedLink(url);
      setTimeout(() => setCopiedLink(null), 2000);
    } catch (err) {
      console.error('Failed to copy link:', err);
    }
  };

  const handleDeleteClick = () => {
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    setWaitingOnAction(true);
    try {
      await SendData(`conversations/${event.id}`, {}, undefined, {
        method: 'DELETE',
      });
      setDeleteDialogOpen(false);
      onDelete(event.id!);
    } catch (err) {
      console.error('Failed to delete event:', err);
      setWaitingOnAction(false);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
  };

  const handleDownloadReport = async () => {
    setWaitingOnAction(true);
    try {
      // Use the scheduled time or created time for the report date
      const reportDate = event.scheduledTime ? new Date(event.scheduledTime) : new Date(event.createdAt!);

      // Download first report: userMetrics
      await generateAndDownloadUserMetricsReport(event.id!, reportDate);

      // Download second report: directMessageResponses
      await generateAndDownloadDirectMessageResponsesReport(event.id!);
    } catch (err) {
      console.error('Failed to generate report:', err);
      alert('Failed to generate report. Please try again.');
    } finally {
      setWaitingOnAction(false);
    }
  };

  const handleStartEndEvent = async (id: string, start: boolean) => {
    setWaitingOnAction(true);
    try {
      const response = await SendData(`conversations/${id}/${start ? 'start' : 'stop'}`, {});
      if (!response || 'error' in response) {
        onMessage(id, `Failed to ${start ? 'start' : 'end'} event. Please try again.`, true);
        console.error(response && 'message' in response ? response.message?.message : 'Unknown error');
        setWaitingOnAction(false);
        return;
      }
      onMessage(id, `Event ${start ? 'started' : 'ended'} successfully.`, false);
    } catch (err) {
      setWaitingOnAction(false);
      console.error(`Failed to ${start ? 'start' : 'end'} event:`, err);
      onMessage(id, `Failed to ${start ? 'start' : 'end'} event. Please try again.`, true);
    } finally {
      setWaitingOnAction(false);
    }
  };

  return (
    <>
      <Card className="w-full shadow-sm rounded-xl border border-gray-200 hover:shadow-md transition-shadow">
        <CardContent className="p-4">
          {/* Header */}
          <div className="flex justify-between items-start">
            <div className="flex-1 pr-4">
              <Tooltip title={`ID: ${event.id}`} placement="bottom-start">
                <Typography variant="h5" className="font-semibold leading-snug line-clamp-2">
                  {event.name}
                </Typography>
              </Tooltip>
              {isOwner && (
                <span className="inline-block mt-1 px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                  My Event
                </span>
              )}
              {isPast && (
                <span className="inline-block mt-1 ml-1 px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-600 rounded-full">
                  Past
                </span>
              )}
              {isMissed && (
                <span className="inline-block mt-1 ml-1 px-2 py-0.5 text-xs font-medium bg-yellow-100 text-yellow-700 rounded-full">
                  Missed
                </span>
              )}
            </div>
            <div>
              {waitingOnAction ? (
                <CircularProgress />
              ) : (
                <IconButton
                  aria-label={`actions-menu-${event.id}`}
                  size="small"
                  onClick={(e) => setMenuAnchorEl(e.currentTarget)}
                  className="text-gray-500"
                >
                  <MoreVertIcon fontSize="small" />
                </IconButton>
              )}

              <Menu anchorEl={menuAnchorEl} open={Boolean(menuAnchorEl)} onClose={() => setMenuAnchorEl(null)}>
                {!event.active && (
                  <MenuItem
                    onClick={() => {
                      handleDownloadReport();
                      setMenuAnchorEl(null);
                    }}
                  >
                    <ListItemIcon>
                      <DownloadIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText>Download Reports</ListItemText>
                  </MenuItem>
                )}
                {canEdit && (
                  <MenuItem
                    onClick={() => {
                      router.push(`/admin/${event.type?.name}/edit/${event.id}`);
                      setMenuAnchorEl(null);
                    }}
                  >
                    <ListItemIcon>
                      <EditIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText>Edit Event</ListItemText>
                  </MenuItem>
                )}
                <MenuItem
                  onClick={() => {
                    handleStartEndEvent(event.id!, !event.active);
                    setMenuAnchorEl(null);
                  }}
                  disabled={waitingOnAction}
                >
                  <ListItemIcon>
                    {event.active ? (
                      <StopIcon fontSize="small" color="error" />
                    ) : (
                      <PlayArrowIcon fontSize="small" color="success" />
                    )}
                  </ListItemIcon>
                  <ListItemText>{event.active ? 'End Event' : 'Start Event'}</ListItemText>
                </MenuItem>
                <MenuItem
                  onClick={() => {
                    handleDeleteClick();
                    setMenuAnchorEl(null);
                  }}
                  sx={{ color: 'error.main' }}
                >
                  <ListItemIcon>
                    <DeleteIcon fontSize="small" sx={{ color: 'error.main' }} />
                  </ListItemIcon>
                  <ListItemText>Delete Event</ListItemText>
                </MenuItem>
              </Menu>
            </div>
          </div>

          {/* Date and Platforms */}
          <div className="flex flex-col gap-3 sm:flex-row sm:gap-4 text-sm text-gray-600 mt-3 mb-2">
            <div className="flex-1 flex items-start gap-2">
              <EventIcon color={event.active ? 'success' : 'inherit'} style={{ fontSize: '18px' }} className="mt-0.5" />
              <div>
                {new Date(event.startTime ?? event.scheduledTime ?? event.createdAt!).toLocaleString('en-US', {
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                  hour12: true,
                  timeZone: getUserTimezone(),
                  timeZoneName: 'short',
                })}
                {event.active && <span className="ml-2 text-green-600 font-medium">• In Progress</span>}
              </div>
            </div>

            {/* Platforms */}
            {event.platformTypes && event.platformTypes.length > 0 && (
              <div className="flex-1 flex items-start gap-2">
                <ComputerIcon style={{ fontSize: '18px' }} className="mt-0.5" />
                <div>
                  <span className="font-medium">Platforms:</span>{' '}
                  {event.platformTypes.map((platform) => platform.label || platform.name).join(', ')}
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
              <span className="font-medium">Zoom Link:</span>{' '}
              <a
                href={event.eventUrls.zoom.url}
                className="text-blue-600 hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                {event.eventUrls.zoom.label}
              </a>
              <Tooltip title={copiedLink === event.eventUrls.zoom.url ? 'Copied!' : 'Copy link'}>
                <IconButton size="small" onClick={() => handleCopyLink(event.eventUrls.zoom!.url)} className="p-0.5">
                  <ContentCopyIcon fontSize="small" className="text-gray-500" style={{ fontSize: '14px' }} />
                </IconButton>
              </Tooltip>
            </div>
          )}
          {/* Links */}
          <div className="flex flex-col gap-3 sm:flex-row sm:gap-2 text-sm mt-5">
            {event.eventUrls.moderator && event.eventUrls.moderator.length > 0 && (
              <div className="flex-1">
                <div className="font-medium">Moderator Links</div>
                {event.eventUrls.moderator?.map((link, i) => (
                  <div key={i}>
                    <a href={link.url} className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">
                      {link.label}
                    </a>
                    <Tooltip title={copiedLink === link.url ? 'Copied!' : 'Copy link'}>
                      <IconButton size="small" onClick={() => handleCopyLink(link.url)} className="p-0.5">
                        <ContentCopyIcon fontSize="small" className="text-gray-500" style={{ fontSize: '14px' }} />
                      </IconButton>
                    </Tooltip>
                  </div>
                ))}
              </div>
            )}

            {event.eventUrls.participant && event.eventUrls.participant.length > 0 && (
              <div className="flex-1">
                <div className="font-medium">Participant Links</div>
                {event.eventUrls.participant.map((link, i) => (
                  <div key={i}>
                    <a href={link.url} className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">
                      {link.label}
                    </a>
                    <Tooltip title={copiedLink === link.url ? 'Copied!' : 'Copy link'}>
                      <IconButton size="small" onClick={() => handleCopyLink(link.url)} className="p-0.5">
                        <ContentCopyIcon fontSize="small" className="text-gray-500" style={{ fontSize: '14px' }} />
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
              borderRadius: '16px',
              padding: '32px 24px',
              maxWidth: '440px',
              textAlign: 'center',
            },
          },
        }}
      >
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-full border-2 border-red-400 flex items-center justify-center">
            <ReportProblem sx={{ fontSize: 40, color: '#f87171' }} />
          </div>
          <h2 id="delete-dialog-title" className="text-2xl font-bold text-gray-900">
            Delete event?
          </h2>
          <p id="delete-dialog-description" className="text-gray-600 text-base leading-relaxed max-w-sm">
            This will permanently delete &quot;{event.name}&quot; and cannot be undone.
          </p>
          <div className="flex flex-col gap-3 w-full mt-2">
            <Button
              onClick={handleDeleteConfirm}
              disabled={waitingOnAction}
              variant="contained"
              sx={{
                backgroundColor: '#b91c1c',
                color: 'white',
                padding: '12px 24px',
                borderRadius: '8px',
                textTransform: 'none',
                fontSize: '16px',
                fontWeight: 600,
                '&:hover': {
                  backgroundColor: '#991b1b',
                },
              }}
              autoFocus
            >
              {waitingOnAction ? <CircularProgress size={20} /> : 'Yes, Delete'}
            </Button>
            <Button
              onClick={handleDeleteCancel}
              disabled={waitingOnAction}
              sx={{
                color: '#4b5563',
                textTransform: 'none',
                fontSize: '16px',
                fontWeight: 500,
                textDecoration: 'underline',
                '&:hover': {
                  backgroundColor: 'transparent',
                  textDecoration: 'underline',
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

enum SortOptions {
  StartTimeDesc = 'startTimeDesc',
  StartTime = 'startTime',
  CreatedAtDesc = 'createdAtDesc',
  CreatedAt = 'createdAt',
  Status = 'status',
}

function EventScreen({ authType }: { authType: AuthType }) {
  const router = useRouter();

  // Get userId from session
  const { userId } = useSessionJoin();

  const [conversationsCount, setConversationsCount] = useState<number>(0);
  const [filteredRefCount, setFilteredRefCount] = useState<number>(0);
  const [loadedConversations, setLoadedConversations] = useState<Conversation[]>([]);
  const [filteredConversations, setFilteredConversations] = useState<Conversation[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [eventsShown, setEventsShown] = useState(6);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [myEventsOnly, setMyEventsOnly] = useState(false);
  const [sortBy, setSortBy] = useState<SortOptions>(SortOptions.StartTimeDesc);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [statusFilters, setStatusFilters] = useState<string[]>(['active', 'upcoming']);

  const [startDateFilter, setStartDateFilter] = useState<Date | null>(null);
  const [endDateFilter, setEndDateFilter] = useState<Date | null>(null);
  const [startDateDisplay, setStartDateDisplay] = useState<dayjs.Dayjs | null>(null);
  const [endDateDisplay, setEndDateDisplay] = useState<dayjs.Dayjs | null>(null);
  const allConversationsRef = useRef<components['schemas']['Conversation'][] | null>(null);

  const sortConversations = <T extends components['schemas']['Conversation']>(list: T[]) => {
    const now = new Date();
    return [...list].sort((a, b) => {
      if (sortBy === SortOptions.Status) {
        const getStatusRank = (conv: components['schemas']['Conversation']) => {
          if (conv.active) return 1;
          if (conv.scheduledTime && new Date(conv.scheduledTime) > now) return 2;
          if (conv.endTime) return 3;
          return 4; // missed: no startTime, no endTime, schedule passed or never scheduled
        };
        const diff = getStatusRank(a) - getStatusRank(b);
        if (diff !== 0) return diff;
      }
      const aTime = new Date(
        sortBy === SortOptions.CreatedAt || sortBy === SortOptions.CreatedAtDesc
          ? a.createdAt!
          : (a.startTime ?? a.scheduledTime ?? a.createdAt!),
      ).getTime();
      const bTime = new Date(
        sortBy === SortOptions.CreatedAt || sortBy === SortOptions.CreatedAtDesc
          ? b.createdAt!
          : (b.startTime ?? b.scheduledTime ?? b.createdAt!),
      ).getTime();
      return sortBy === SortOptions.StartTime || sortBy === SortOptions.CreatedAt ? aTime - bTime : bTime - aTime;
    });
  };

  const [eventStatusChanged, setEventStatusChanged] = useState<{ changed: boolean; message: string | null }>({
    changed: false,
    message: null,
  });
  const [eventErrorMessage, setEventErrorMessage] = useState<string | null>(null);

  const handleClearFilters = () => {
    setStatusFilters(['active', 'upcoming']);

    setStartDateFilter(null);
    setEndDateFilter(null);
    setStartDateDisplay(null);
    setEndDateDisplay(null);
    setMyEventsOnly(false);
    setSortBy(SortOptions.StartTimeDesc);
  };

  const applyFilters = <T extends components['schemas']['Conversation']>(conversations: T[]) => {
    const now = new Date();
    return conversations.filter((conv) => {
      if (myEventsOnly && conv.owner !== userId) return false;
      if (statusFilters.length === 0) return true;

      const eventTime = new Date(conv.startTime ?? conv.scheduledTime ?? conv.createdAt!);
      if (startDateFilter && eventTime < startDateFilter) return false;
      if (endDateFilter && eventTime > endDateFilter) return false;

      if (conv.active) return statusFilters.includes('active');
      if (conv.scheduledTime && new Date(conv.scheduledTime) > now) return statusFilters.includes('upcoming');
      if (conv.endTime) return statusFilters.includes('past');
      return statusFilters.includes('missed');
    });
  };

  // Returns the full ref list pre-filtered and sorted for the current filter/sort state.
  // Used as the fetch source so pagination and initial load always pull the right events.
  const getFilteredRef = () => sortConversations(applyFilters(allConversationsRef.current ?? []));

  /**
   * Handle deletion of an event
   * @param id The conversation ID to delete
   */
  const handleDelete = async (id: string) => {
    setLoadedConversations((prev) => prev.filter((conv) => conv.id !== id));

    if (allConversationsRef.current) {
      allConversationsRef.current = allConversationsRef.current.filter((conv) => conv.id !== id);
      setConversationsCount(allConversationsRef.current.length);

      const filteredRef = getFilteredRef();
      if (filteredRef.length > eventsShown - 1) {
        const nextIndex = await fetchDetailedConversations(filteredRef, eventsShown - 1, 1);
        setEventsShown(nextIndex);
      }
    }
    setEventStatusChanged({ changed: true, message: 'Event deleted successfully.' });
  };

  /**
   * Refresh conversations list after an event is started or ended
   */
  const refreshConversations = async (_id: string) => {
    try {
      const data = await Request('conversations');
      if ('error' in data) return;
      const all = data as components['schemas']['Conversation'][];
      allConversationsRef.current = all;
      setConversationsCount(all.length);
      const nextIndex = await fetchDetailedConversations(getFilteredRef(), 0, eventsShown, true);
      setEventsShown(nextIndex);
    } catch (err) {
      console.error('Failed to refresh conversations:', err);
    }
  };

  /**
   * Handle starting or ending an event, showing success or error messages accordingly
   */
  const handleEventStatusChange = (id: string, message: string, isError: boolean) => {
    if (!isError) {
      setEventStatusChanged({
        changed: true,
        message: `Event ${message.includes('started') ? 'started' : 'ended'} successfully.`,
      });
      refreshConversations(id);
    } else {
      setEventErrorMessage(message);
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
    list: components['schemas']['Conversation'][],
    startIndex: number,
    target: number,
    replace: boolean = false,
  ): Promise<number> => {
    const allValid: Conversation[] = [];
    let currentIndex = startIndex;

    while (allValid.length < target && currentIndex < list.length) {
      const batchSize = Math.min(target - allValid.length, list.length - currentIndex);
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
          console.warn(`Conversation ${list[currentIndex + i].id} returned null`);
        }
      });
      allValid.push(
        ...batch.filter((conv): conv is Conversation => {
          if (!conv) return false;
          if (replace) return true;
          return !loadedConversations.some((loaded) => loaded.id === conv.id);
        }),
      );
      currentIndex += batchSize;
    }

    setLoadedConversations((prev) => [...(replace ? [] : prev), ...allValid]);

    return currentIndex;
  };

  useEffect(() => {
    async function fetchInitialConversations() {
      const data: components['schemas']['Conversation'][] | ErrorMessage = await Request('conversations');

      // If unauthorized, redirect to login
      if ('error' in data && data.message?.code === 401) {
        router.push('/login');
        return;
      }

      if ('error' in data) {
        setErrorMessage(data.message?.message || 'Failed to fetch conversations.');
        setIsInitialLoading(false);
        return;
      }

      // Store full list for pagination and filter changes
      allConversationsRef.current = data;
      setConversationsCount(data.length);

      // Load first 6 matching the current filters/sort
      const filteredRef = getFilteredRef();
      setFilteredRefCount(filteredRef.length);
      const nextIndex = await fetchDetailedConversations(filteredRef, 0, 6);
      setEventsShown(nextIndex);
      setIsInitialLoading(false);
    }

    if (!conversationsCount) fetchInitialConversations();
  }, [conversationsCount]);

  const handleLoadMore = async () => {
    if (!conversationsCount || isLoadingMore) return;
    if (!allConversationsRef.current) return;
    const filteredRef = getFilteredRef();
    if (eventsShown >= filteredRef.length) return;

    setIsLoadingMore(true);
    const nextIndex = await fetchDetailedConversations(filteredRef, eventsShown, 6);
    setEventsShown(nextIndex);
    setIsLoadingMore(false);
  };

  // Re-fetch from the filtered+sorted ref whenever filter or sort state changes.
  useEffect(() => {
    if (!allConversationsRef.current) return;
    setIsInitialLoading(true);
    const filteredRef = getFilteredRef();
    setFilteredRefCount(filteredRef.length);
    fetchDetailedConversations(filteredRef, 0, 6, true).then((nextIndex) => {
      setEventsShown(nextIndex);
      setIsInitialLoading(false);
    });
  }, [myEventsOnly, statusFilters, startDateFilter, endDateFilter, sortBy]);

  // Derive the render list from whatever is currently loaded.
  useEffect(() => {
    setFilteredConversations(sortConversations(applyFilters(loadedConversations)));
  }, [loadedConversations]);

  return (
    <>
      <Snackbar
        autoHideDuration={5000}
        onClose={() => setEventStatusChanged({ message: null, changed: false })}
        open={eventStatusChanged.changed}
      >
        <Alert severity="info">{eventStatusChanged.message}</Alert>
      </Snackbar>
      <Snackbar autoHideDuration={5000} onClose={() => setEventErrorMessage(null)} open={!!eventErrorMessage}>
        <Alert severity="error">{eventErrorMessage}</Alert>
      </Snackbar>
      <div className="flex flex-col items-center mt-12 mb-8">
        <Typography variant="h4" gutterBottom>
          Events
        </Typography>
        {errorMessage ? (
          <Typography color="error">{errorMessage}</Typography>
        ) : (
          <div className="w-3/4 space-y-6">
            <div className="flex justify-end">
              <Button startIcon={<FilterListSharp />} onClick={() => setFiltersOpen(true)}>
                Filters
              </Button>
            </div>

            <Drawer
              anchor="right"
              open={filtersOpen}
              onClose={() => setFiltersOpen(false)}
              slotProps={{ paper: { sx: { width: 360 } } }}
            >
              <div className="flex flex-col gap-6 p-6">
                <div className="flex justify-between items-center">
                  <Typography variant="h6">Filters & Sorting</Typography>
                  <IconButton aria-label="close-filters" onClick={() => setFiltersOpen(false)} size="small">
                    <CloseSharp />
                  </IconButton>
                </div>

                <FormControl fullWidth>
                  <InputLabel id="sort-by-label">Sort By</InputLabel>
                  <Select
                    labelId="sort-by-label"
                    value={sortBy}
                    label="Sort By"
                    onChange={(e) => setSortBy(e.target.value as SortOptions)}
                  >
                    <MenuItem value={SortOptions.StartTimeDesc}>Start Date (newest)</MenuItem>
                    <MenuItem value={SortOptions.StartTime}>Start Date (oldest)</MenuItem>
                    <MenuItem value={SortOptions.CreatedAtDesc}>Created Date (newest)</MenuItem>
                    <MenuItem value={SortOptions.CreatedAt}>Created Date (oldest)</MenuItem>
                    <MenuItem value={SortOptions.Status}>Status</MenuItem>
                  </Select>
                </FormControl>

                <FormControl fullWidth>
                  <InputLabel id="status-filter-label">Status</InputLabel>
                  <Select
                    labelId="status-filter-label"
                    multiple
                    value={statusFilters}
                    onChange={(e) => setStatusFilters(e.target.value as string[])}
                    label="Status"
                    renderValue={(selected) => (
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {(selected as string[]).map((value) => (
                          <Chip
                            key={value}
                            label={value.charAt(0).toUpperCase() + value.slice(1)}
                            size="medium"
                            onDelete={() => setStatusFilters((prev) => prev.filter((s) => s !== value))}
                            onMouseDown={(e) => e.stopPropagation()}
                            sx={{ borderRadius: '6px', '& .MuiChip-deleteIcon': { fontSize: '14px' } }}
                          />
                        ))}
                      </Box>
                    )}
                  >
                    {!statusFilters.includes('active') && <MenuItem value="active">Active</MenuItem>}
                    {!statusFilters.includes('upcoming') && <MenuItem value="upcoming">Upcoming</MenuItem>}
                    {!statusFilters.includes('past') && <MenuItem value="past">Past</MenuItem>}
                    {!statusFilters.includes('missed') && <MenuItem value="missed">Missed</MenuItem>}
                  </Select>
                </FormControl>

                <div>
                  <Typography variant="caption" className="text-gray-500">
                    Date Range
                  </Typography>
                  <LocalizationProvider dateAdapter={AdapterDayjs}>
                    <div className="flex gap-2 mt-1">
                      <DateTimePicker
                        label="From"
                        value={startDateDisplay}
                        onChange={(date) => {
                          setStartDateDisplay(date);
                          if (!date) setStartDateFilter(null);
                        }}
                        onAccept={(date) => setStartDateFilter(date?.toDate() ?? null)}
                        views={['year', 'month', 'day']}
                        maxDate={endDateDisplay ?? undefined}
                        slotProps={{ field: { clearable: true } }}
                      />
                      <DateTimePicker
                        label="To"
                        value={endDateDisplay}
                        onChange={(date) => {
                          setEndDateDisplay(date);
                          if (!date) setEndDateFilter(null);
                        }}
                        onAccept={(date) => setEndDateFilter(date ? date.endOf('day').toDate() : null)}
                        views={['year', 'month', 'day']}
                        minDate={startDateDisplay ?? undefined}
                        slotProps={{ field: { clearable: true } }}
                      />
                    </div>
                  </LocalizationProvider>
                </div>

                <Divider />

                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-sm text-gray-600">My events only</span>
                  <Switch checked={myEventsOnly} onChange={(e) => setMyEventsOnly(e.target.checked)} size="small" />
                </label>

                <div className="flex justify-end">
                  <Button variant="outlined" onClick={handleClearFilters}>
                    Reset
                  </Button>
                </div>
              </div>
            </Drawer>

            {isInitialLoading ? (
              // Show 6 skeleton cards while loading
              <>
                {[...Array(6)].map((_, i) => (
                  <EventCardSkeleton key={i} />
                ))}
              </>
            ) : (
              <>
                {filteredConversations.length === 0 ? (
                  <div className="border-2 border-dashed border-gray-300 rounded-xl p-12 flex flex-col items-center gap-3">
                    <EventIcon className="text-gray-400" style={{ fontSize: '40px' }} />
                    <Typography variant="body1" className="text-gray-500">
                      No events found. Create your first event, or adjust your filters to see more.
                    </Typography>
                    <Button variant="outlined" onClick={() => router.push('/admin/events/new')}>
                      Create an event
                    </Button>
                  </div>
                ) : (
                  <>
                    {filteredConversations.map(
                      (event) =>
                        event && (
                          <EventCard
                            key={event.id}
                            event={event}
                            onDelete={handleDelete}
                            onMessage={handleEventStatusChange}
                            currentUserId={userId}
                          />
                        ),
                    )}

                    {filteredRefCount > 0 && eventsShown < filteredRefCount && (
                      <div className="flex justify-center mt-6 mb-6">
                        <Button variant="outlined" onClick={handleLoadMore} disabled={isLoadingMore}>
                          {isLoadingMore ? <CircularProgress size={20} /> : 'Load More'}
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
    </>
  );
}

export default EventScreen;
