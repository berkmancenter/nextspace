import React from "react";
import { Button, Typography } from "@mui/material";
import { SendData } from "../../utils";
import { Conversation } from "../../types.internal";

/**
 * EventStatus component
 *
 * Displays the status of an event after it has been created.
 * It provides URLs for the moderator and participant views based on the conversation data.
 * Also displays start event button if event is in future.
 * @param conversationData - The conversation data object containing details about the event.
 * @returns A React component displaying event status and relevant URLs.
 */
export const EventStatus: React.FC<{
  conversationData: Conversation;
}> = ({ conversationData }) => {
  const [startingEvent, setStartingEvent] = React.useState(false);
  const [eventStarted, setEventStarted] = React.useState(false);

  // Format list with "and" before last item
  const formatList = (items: string[]) => {
    if (items.length === 0) return "";
    if (items.length === 1) return items[0];
    if (items.length === 2) return items.join(" and ");
    return items.slice(0, -1).join(", ") + ", and " + items.slice(-1);
  };

  const StartEventButton: React.FC = () => {
    const handleStartEvent = () => {
      setStartingEvent(true);
      SendData(`conversations/${conversationData.id}/start`, {})
        .then((data) => {
          setStartingEvent(false);
          if (!data) {
            console.error("No data returned from start event");
            return;
          }
          setEventStarted(true);
        })
        .catch((error) => {
          setStartingEvent(false);
          console.error("Error sending data:", error);
        });
    };

    if (!eventStarted && !conversationData.active)
      return (
        <Button
          variant="contained"
          color="primary"
          loading={startingEvent}
          onClick={handleStartEvent}
        >
          Start Event
        </Button>
      );

    return <></>;
  };

  return (
    <div className="flex flex-col items-center justify-center w-full">
      <Typography variant="h5" component="h2" gutterBottom>
        Event Status
      </Typography>
      <p className="mt-2 text-center">
        {`Event '${conversationData.name}' includes the ${
          conversationData.type.label || conversationData.type.name
        }${
          conversationData.platformTypes?.length
            ? ` in ${formatList(
                conversationData.platformTypes.map(
                  (platformType) => platformType.label || platformType.name
                )
              )}`
            : ""
        }.`}
      </p>
      <p className="mt-2 font-bold">
        The event is currently{" "}
        {eventStarted || conversationData.active ? "active" : "not started"}.
      </p>

      <div className="wrap-anywhere w-3/4 mt-5">
        {conversationData.eventUrls.zoom && (
          <>
            <p className="mt-2">{conversationData.eventUrls.zoom.label}:</p>
            <p className="mt-2">
              <a
                href={conversationData.eventUrls.zoom.url}
                target="_blank"
                className="text-medium-slate-blue"
              >
                {conversationData.eventUrls.zoom.url}
              </a>
            </p>
          </>
        )}
        {conversationData.eventUrls.moderator.length > 0 && (
          <>
            <p className="mt-2">The URLs for the moderator are:</p>
            {conversationData.eventUrls.moderator.map((urlObj, index) => (
              <p key={index} className="mt-2">
                {urlObj.label}:
                <br />
                <a
                  href={urlObj.url}
                  target="_blank"
                  className="text-medium-slate-blue"
                >
                  {urlObj.url}
                </a>
              </p>
            ))}
          </>
        )}
        {conversationData.eventUrls.participant.length > 0 && (
          <>
            <p className="mt-2">The URLs for the participant are:</p>
            {conversationData.eventUrls.participant.map((urlObj, index) => (
              <p key={index} className="mt-2">
                {urlObj.label}:
                <br />
                <a
                  href={urlObj.url}
                  target="_blank"
                  className="text-medium-slate-blue"
                >
                  {urlObj.url}
                </a>
              </p>
            ))}
          </>
        )}
        <StartEventButton />
        {eventStarted && <p className="mt-2">The event has started!</p>}
      </div>
    </div>
  );
};
