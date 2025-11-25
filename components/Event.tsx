import React from "react";
import { Api } from "../utils";
import { EventProps } from "../types.internal";
import { ExperimentCreationForm } from "./ExperimentCreationForm";
import { EventCreationForm } from "./EventCreationForm";

/**
 * Event component
 *
 * This component handles the creation and editing of events.
 * It authenticates the user, manages the event ID state, and renders the EventForm component.
 * @param experiment - Optional boolean to indicate if the event is an experiment.
 * @returns A React component for creating or editing events.
 */
export const Event: React.FC<EventProps> = ({ experiment }) => {
  return (
    <div className="w-2/3">
      {experiment ? (
        <ExperimentCreationForm
          token={Api.get().GetTokens().access as string}
        />
      ) : (
        <EventCreationForm />
      )}
    </div>
  );
};
