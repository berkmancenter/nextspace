"use client";

import React, { useState, useMemo } from "react";
import { PseudonymousMessage } from "../types.internal";
import { parseMessageBody } from "../utils/Helpers";
import {
  ExpandMore,
  ExpandLess,
  MenuBook,
  Person,
  Info,
} from "@mui/icons-material";

interface ResourcesPanelProps {
  messages: PseudonymousMessage[];
  eventDescription?: string;
  speakers?: Array<{ name: string; bio: string }>;
  moderators?: Array<{ name: string; bio: string }>;
  eventName?: string;
  unseenReadingsCount?: number;
  onMarkReadingsAsSeen?: () => void;
  newReadingMessageIds?: Set<string>;
}

interface CategorySection {
  id: string;
  title: string;
  icon: React.ElementType;
  count: number;
  defaultExpanded: boolean;
}

interface TruncatedTextProps {
  text: string;
  maxLength: number;
  className?: string;
}

const TruncatedText: React.FC<TruncatedTextProps> = ({
  text,
  maxLength,
  className = "",
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const needsTruncation = text.length > maxLength;

  if (!needsTruncation) {
    return <span className={className}>{text}</span>;
  }

  return (
    <span className={className}>
      {isExpanded ? text : `${text.slice(0, maxLength)}...`}{" "}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="text-medium-slate-blue hover:opacity-80 font-medium underline cursor-pointer"
      >
        {isExpanded ? "less" : "more"}
      </button>
    </span>
  );
};

export const ResourcesPanel: React.FC<ResourcesPanelProps> = ({
  messages,
  eventDescription,
  speakers = [],
  moderators = [],
  eventName,
  unseenReadingsCount = 0,
  onMarkReadingsAsSeen,
  newReadingMessageIds,
}) => {
  // Track which categories are expanded
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(),
  );
  // Snapshot of new reading IDs captured at expand time, so highlights persist
  // even after the parent clears newReadingMessageIds
  const [newReadingIdsSnapshot, setNewReadingIdsSnapshot] = useState<Set<string>>(new Set());

  // Extract reading recommendations from messages
  const readings = useMemo(() => {
    const allReadings: Array<{
      title: string;
      url?: string;
      authors: string[];
      year: number;
      abstract?: string;
      relevanceReason?: string;
      messageId: string;
    }> = [];

    messages.forEach((msg) => {
      const parsed = parseMessageBody(msg.body);
      if (parsed.type === "reading" && Array.isArray(parsed.content)) {
        allReadings.push(
          ...parsed.content.map((r) => ({ ...r, messageId: msg.id! })),
        );
      }
    });

    return allReadings;
  }, [messages]);

  const categories: CategorySection[] = [
    {
      id: "speakers",
      title: "Speakers",
      icon: Person,
      count: 0, // Don't show badge for speakers (static content)
      defaultExpanded: false,
    },
    {
      id: "readings",
      title: "Readings & References",
      icon: MenuBook,
      count: unseenReadingsCount,
      defaultExpanded: false,
    },
  ];

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(categoryId)) {
        newSet.delete(categoryId);
        if (categoryId === "readings") setNewReadingIdsSnapshot(new Set());
      } else {
        newSet.add(categoryId);
        // Snapshot current new IDs before clearing, so highlights render correctly
        if (categoryId === "readings") {
          setNewReadingIdsSnapshot(new Set(newReadingMessageIds));
          if (onMarkReadingsAsSeen) onMarkReadingsAsSeen();
        }
      }
      return newSet;
    });
  };

  const CategoryHeader: React.FC<{
    category: CategorySection;
    isExpanded: boolean;
  }> = ({ category, isExpanded }) => {
    const Icon = category.icon;
    return (
      <button
        onClick={() => toggleCategory(category.id)}
        aria-expanded={isExpanded}
        className="w-full flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Icon sx={{ fontSize: 20, color: "#4A0979" }} aria-hidden="true" />
          <span className="font-semibold text-gray-900 text-sm">
            {category.title}
          </span>
          {category.count > 0 && (
            <span aria-hidden="true" className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">
              {category.count}
            </span>
          )}
        </div>
        {isExpanded ? (
          <ExpandLess sx={{ fontSize: 20, color: "#666" }} aria-hidden="true" />
        ) : (
          <ExpandMore sx={{ fontSize: 20, color: "#666" }} aria-hidden="true" />
        )}
      </button>
    );
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-gray-50">
      {/* Event Description Header */}
      <div className="flex-shrink-0 bg-gradient-to-r from-purple-50 to-indigo-50 border-b border-purple-200 px-6 py-4">
        <div className="flex items-start gap-3">
          <Info sx={{ fontSize: 24, color: "#4A0979", marginTop: "2px" }} />
          <div>
            <h1 className="text-lg font-bold text-gray-900 mb-1">
              {eventName || "Event Resources"}
            </h1>
            {eventDescription && (
              <p className="text-sm text-gray-700 leading-relaxed">
                <TruncatedText
                  text={eventDescription}
                  maxLength={500}
                  className="text-sm text-gray-700 leading-relaxed"
                />
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Scrollable Categories */}
      <div className="flex-1 overflow-y-auto">
        {/* Speakers */}
        <div className="mb-2">
          <CategoryHeader
            category={categories[0]}
            isExpanded={expandedCategories.has("speakers")}
          />
          {expandedCategories.has("speakers") && (
            <div className="bg-white px-6 py-4 border-b border-gray-200">
              <div className="space-y-4">
                {moderators.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">
                      Moderators
                    </h4>
                    <div className="space-y-3">
                      {moderators.map((mod, idx) => (
                        <div key={idx} className="flex items-start gap-3">
                          <div className="bg-gradient-to-br from-blue-100 to-blue-200 rounded-full w-10 h-10 flex items-center justify-center flex-shrink-0">
                            <Person sx={{ fontSize: 20, color: "#1e40af" }} />
                          </div>
                          <div>
                            <h5 className="text-sm font-semibold text-gray-900">
                              {mod.name}
                            </h5>
                            <p className="text-xs text-gray-600 leading-relaxed mt-1">
                              <TruncatedText
                                text={mod.bio}
                                maxLength={300}
                                className="text-xs text-gray-600 leading-relaxed"
                              />
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {speakers.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">
                      Speakers
                    </h4>
                    <div className="space-y-3">
                      {speakers.map((speaker, idx) => (
                        <div key={idx} className="flex items-start gap-3">
                          <div className="bg-gradient-to-br from-purple-100 to-purple-200 rounded-full w-10 h-10 flex items-center justify-center flex-shrink-0">
                            <Person sx={{ fontSize: 20, color: "#4A0979" }} />
                          </div>
                          <div>
                            <h5 className="text-sm font-semibold text-gray-900">
                              {speaker.name}
                            </h5>
                            <p className="text-xs text-gray-600 leading-relaxed mt-1">
                              <TruncatedText
                                text={speaker.bio}
                                maxLength={300}
                                className="text-xs text-gray-600 leading-relaxed"
                              />
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Readings & References */}
        <div className="mb-2">
          <CategoryHeader
            category={categories[1]}
            isExpanded={expandedCategories.has("readings")}
          />
          {expandedCategories.has("readings") && (
            <div className="bg-white px-6 py-4 border-b border-gray-200">
              <p className="text-xs text-gray-600 mb-3">
                References sourced from{" "}
                <a
                  href="https://www.semanticscholar.org"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-gray-600"
                >
                  Semantic Scholar
                </a>
                .
              </p>
              <ul className="space-y-4 list-none">
                {readings.length === 0 ? (
                  <li className="text-sm text-gray-500 italic">
                    No reading recommendations available yet.
                  </li>
                ) : (
                  readings.map((reading, idx) => {
                    const isNew = newReadingIdsSnapshot.has(reading.messageId);
                    return (
                      <li
                        key={idx}
                        className={`border-l-4 pl-4 py-3 rounded-r ${
                          isNew
                            ? "border-amber-400 bg-amber-50"
                            : "border-indigo-400 bg-indigo-50"
                        }`}
                      >
                        <div aria-hidden="true" className="flex items-center gap-2 mb-2">
                          <span className="inline-block text-xs font-semibold text-purple-700 bg-purple-100 px-2 py-0.5 rounded-full">
                            AI Pick
                          </span>
                          {isNew && (
                            <span className="inline-block text-xs font-semibold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full">
                              New
                            </span>
                          )}
                        </div>
                        <h3
                          className={`text-sm font-semibold mb-1 ${isNew ? "text-amber-900" : "text-indigo-900"}`}
                        >
                          {reading.url ? (
                            <a
                              href={reading.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="hover:underline"
                            >
                              {reading.title}
                            </a>
                          ) : (
                            <span tabIndex={0}>{reading.title}</span>
                          )}
                        </h3>
                        <p tabIndex={0} className="text-xs text-gray-600 mb-2">
                          <span className="sr-only">Authors and year: </span>
                          {reading.authors.join(", ")} ({reading.year})
                        </p>
                        {(reading.relevanceReason || reading.abstract) && (
                          <p tabIndex={0} className="text-xs text-gray-700 leading-relaxed mb-2">
                            <span className="sr-only">Relevance: </span>
                            {reading.relevanceReason || reading.abstract}
                          </p>
                        )}
                      </li>
                    );
                  })
                )}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
