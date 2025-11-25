import React, { forwardRef, RefObject, useEffect } from "react";
import { CloseFullscreen } from "@mui/icons-material";
import { IconButton } from "@mui/material";
import { PseudonymousMessage } from "../types.internal";

/**
 * Transcript component
 *
 * This component renders a live transcript of moderator messages.
 * It supports focusing on a specific message element when provided.
 * @param {object} props
 * @property {ModeratorMessage[]} content - An array of moderator messages to display in the transcript.
 * @property {HTMLDivElement | null} focusElement - An optional HTMLDivElement to focus on when the component updates.
 * @property {() => void} onClose - A callback function to handle closing the transcript view.
 * @property {React.Ref<HTMLDivElement>} ref - A ref object to access the scrollable container of the transcript.
 * @returns A React component for displaying the live transcript.
 */
export const Transcript = forwardRef(function Transcript(
  props: {
    content: PseudonymousMessage[];
    focusElement?: HTMLDivElement | null;
    onClose: () => void;
  },
  ref: React.Ref<HTMLDivElement>
) {
  const [currentFocus, setCurrentFocus] = React.useState<HTMLDivElement | null>(
    null
  );
  // If focusElement is passed in, scroll to it
  useEffect(() => {
    if (props.focusElement && props.focusElement) {
      setCurrentFocus(props.focusElement);

      props.focusElement.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "start",
      });
    }
  }, [props.focusElement]);
  return (
    // Outer div is to simulate border gradient
    <div className="relative z-50 bg-linear-to-b from-medium-slate-blue to-light-blue-100 h-full rounded-lg shadow-md">
      <div className="bg-linear-to-b from-[#f1f4fe] to-10% to-white h-full relative top-0.5 rounded-lg m-0.5 p-3.5">
        <div className="flex flex-row items-center justify-between">
          <h2 className="text-2xl font-semibold">Live Transcript</h2>
          <IconButton onClick={() => props.onClose()}>
            <CloseFullscreen />
          </IconButton>
        </div>
        <div
          className="mt-4 overflow-y-scroll overflow-x-hidden scroll-m-12 max-h-[60vh] flex flex-col-reverse"
          ref={ref}
        >
          {props.content.map((message, i) => (
            <div
              id={`message-${i}`}
              key={`message-${i}`}
              className={`msg my-4 ${
                currentFocus?.id === `message-${i}` ? "bg-amber-100" : ""
              }`}
            >
              <div className="flex flex-row gap-x-3">
                <span
                  className="time text-sm text-slate-400"
                  data-datetime={new Date().toISOString()}
                >
                  {new Date().toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: true,
                  })}
                </span>
              </div>
              <p>{message.body.text ? message.body.text : message.body}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});
