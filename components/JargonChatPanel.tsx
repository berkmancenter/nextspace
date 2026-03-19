"use client";

import React, { FC } from "react";
import { PseudonymousMessage } from "../types.internal";
import { parseMessageBody } from "../utils/Helpers";
import { useAutoScroll } from "../hooks/useAutoScroll";

interface JargonChatPanelProps {
  messages: PseudonymousMessage[];
  eventName?: string;
}

export const JargonChatPanel: FC<JargonChatPanelProps> = ({
  messages,
  eventName,
}) => {
  const { messagesEndRef, messagesContainerRef } = useAutoScroll(messages);

  return (
    <div className="flex flex-col h-full w-full overflow-hidden">
      <div
        ref={messagesContainerRef}
        className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden pl-2 pr-2 md:px-8 pt-2 bg-gray-100"
      >
        <div
          className="flex flex-col items-start gap-4 pb-2"
          aria-live="assertive"
        >
          {/* Header */}
          <div className="w-full pt-4 pb-2">
            <h2 className="text-xl font-bold uppercase tracking-wide text-gray-900">
              Welcome to&nbsp;
              <span className="text-medium-slate-blue">
                {eventName || "Your Event"}
              </span>
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Jargon Filter — technical terms from this session, explained in plain language.
            </p>
          </div>

          {/* Cards */}
          {messages.map((message, i) => {
            const parsed = parseMessageBody(message.body);
            if (parsed.type !== "jargon_clarification") return null;

            const sourceText =
              typeof message.body === "object" && message.body !== null
                ? (message.body as Record<string, string>).sourceText
                : null;

            const showTimestamp =
              i === 0 ||
              (() => {
                const prev = new Date(messages[i - 1].createdAt!);
                const curr = new Date(message.createdAt!);
                return (
                  prev.getHours() !== curr.getHours() ||
                  prev.getMinutes() !== curr.getMinutes()
                );
              })();

            return (
              <div key={`jargon-${i}`} className="w-full">
                {showTimestamp && (
                  <div className="flex justify-center my-1">
                    <span className="text-sm text-[#767676]">
                      {new Date(message.createdAt!).toLocaleTimeString(
                        "en-US",
                        { hour: "2-digit", minute: "2-digit" },
                      )}
                    </span>
                  </div>
                )}

                <div className="w-full rounded-xl overflow-hidden shadow-sm border border-[#D1C4E9]">
                  {/* Original section */}
                  {sourceText && (
                    <div className="px-4 py-3 bg-[#F3F0FF] border-l-[3px] border-l-mediumslateblue">
                      <p className="text-xs font-semibold uppercase tracking-wider mb-1 text-mediumslateblue">
                        Original
                      </p>
                      <p className="text-sm italic text-[#333]">
                        {sourceText}
                      </p>
                    </div>
                  )}

                  {/* Plain English section */}
                  <div className="px-4 py-3 bg-white border-l-[3px] border-l-[#7B78E5]">
                    <p className="text-xs font-semibold uppercase tracking-wider mb-1 text-mediumslateblue">
                      Plain English
                    </p>
                    <p className="text-sm text-gray-800">{parsed.text}</p>
                  </div>
                </div>
              </div>
            );
          })}

          <div ref={messagesEndRef} className="h-2" />
        </div>
      </div>
    </div>
  );
};
