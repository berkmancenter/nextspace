'use client';

import React, { useState, useEffect } from 'react';
import { components } from '../types';
import { ExpandMore, ExpandLess, MenuBook, Person, Info, Bookmark } from '@mui/icons-material';

type Resource = components['schemas']['Resource'];

interface ResourcesPanelProps {
  resources: Resource[];
  eventDescription?: string;
  speakers?: Array<{ name: string; bio: string }>;
  moderators?: Array<{ name: string; bio: string }>;
  eventName?: string;
  unseenReadingsCount?: number;
  onMarkReadingsAsSeen?: () => void;
  newResourceIds?: Set<string>;
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

const TruncatedText: React.FC<TruncatedTextProps> = ({ text, maxLength, className = '' }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const needsTruncation = text.length > maxLength;

  if (!needsTruncation) {
    return <span className={className}>{text}</span>;
  }

  return (
    <span className={className}>
      {isExpanded ? text : `${text.slice(0, maxLength)}...`}{' '}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="text-medium-slate-blue hover:opacity-80 font-medium underline cursor-pointer"
      >
        {isExpanded ? 'less' : 'more'}
      </button>
    </span>
  );
};

export const ResourcesPanel: React.FC<ResourcesPanelProps> = ({
  resources,
  eventDescription,
  speakers = [],
  moderators = [],
  eventName,
  unseenReadingsCount = 0,
  onMarkReadingsAsSeen,
  newResourceIds,
}) => {
  const suggestedResources = resources.filter((r) => r.category === 'suggested');
  const requiredResources = resources.filter((r) => r.category === 'required');

  // Track which categories are expanded
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  // Snapshot of new resource IDs captured at expand time, so highlights persist
  // even after the parent clears newResourceIds
  const [newResourceIdsSnapshot, setNewResourceIdsSnapshot] = useState<Set<string>>(new Set());

  // When new resources arrive while the section is already expanded, merge them into the snapshot
  useEffect(() => {
    if (!expandedCategories.has('readings') || !newResourceIds) return;
    setNewResourceIdsSnapshot((prev) => {
      const hasNew = [...newResourceIds].some((id) => !prev.has(id));
      if (!hasNew) return prev;
      return new Set([...prev, ...newResourceIds]);
    });
  }, [newResourceIds, expandedCategories]);

  const categories: CategorySection[] = [
    {
      id: 'speakers',
      title: 'Speakers',
      icon: Person,
      count: 0,
      defaultExpanded: false,
    },
    {
      id: 'required',
      title: 'Required Reading',
      icon: Bookmark,
      count: 0,
      defaultExpanded: false,
    },
    {
      id: 'readings',
      title: 'Readings & References (optional)',
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
      } else {
        newSet.add(categoryId);
      }
      return newSet;
    });
    if (categoryId === 'readings') {
      if (expandedCategories.has(categoryId)) {
        // Mark as seen on collapse so re-expanding doesn't re-show highlights
        setNewResourceIdsSnapshot(new Set());
        if (onMarkReadingsAsSeen) onMarkReadingsAsSeen();
      } else {
        // Snapshot current new IDs before clearing, so highlights render correctly
        setNewResourceIdsSnapshot(new Set(newResourceIds));
      }
    }
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
          <Icon sx={{ fontSize: 20, color: '#4A0979' }} aria-hidden="true" />
          <span className="font-semibold text-gray-900 text-sm">{category.title}</span>
          {category.count > 0 && (
            <span aria-hidden="true" className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">
              {category.count}
            </span>
          )}
        </div>
        {isExpanded ? (
          <ExpandLess sx={{ fontSize: 20, color: '#666' }} aria-hidden="true" />
        ) : (
          <ExpandMore sx={{ fontSize: 20, color: '#666' }} aria-hidden="true" />
        )}
      </button>
    );
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-gray-50">
      {/* Event Description Header */}
      <div className="flex-shrink-0 bg-gradient-to-r from-purple-50 to-indigo-50 border-b border-purple-200 px-6 py-4">
        <div className="flex items-start gap-3">
          <Info sx={{ fontSize: 24, color: '#4A0979', marginTop: '2px' }} />
          <div>
            <h1 className="text-lg font-bold text-gray-900 mb-1">{eventName || 'Event Resources'}</h1>
            {eventDescription && (
              <p className="text-sm text-gray-700 leading-relaxed">
                <TruncatedText text={eventDescription} maxLength={500} className="text-sm text-gray-700 leading-relaxed" />
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Scrollable Categories */}
      <div className="flex-1 overflow-y-auto">
        {/* Speakers */}
        <div className="mb-2">
          <CategoryHeader category={categories[0]} isExpanded={expandedCategories.has('speakers')} />
          {expandedCategories.has('speakers') && (
            <div className="bg-white px-6 py-4 border-b border-gray-200">
              <div className="space-y-4">
                {moderators.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Moderators</h4>
                    <div className="space-y-3">
                      {moderators.map((mod, idx) => (
                        <div key={idx} className="flex items-start gap-3">
                          <div className="bg-gradient-to-br from-blue-100 to-blue-200 rounded-full w-10 h-10 flex items-center justify-center flex-shrink-0">
                            <Person sx={{ fontSize: 20, color: '#1e40af' }} />
                          </div>
                          <div>
                            <h5 className="text-sm font-semibold text-gray-900">{mod.name}</h5>
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
                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Speakers</h4>
                    <div className="space-y-3">
                      {speakers.map((speaker, idx) => (
                        <div key={idx} className="flex items-start gap-3">
                          <div className="bg-gradient-to-br from-purple-100 to-purple-200 rounded-full w-10 h-10 flex items-center justify-center flex-shrink-0">
                            <Person sx={{ fontSize: 20, color: '#4A0979' }} />
                          </div>
                          <div>
                            <h5 className="text-sm font-semibold text-gray-900">{speaker.name}</h5>
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

        {/* Required Reading */}
        <div className="mb-2">
          <CategoryHeader category={categories[1]} isExpanded={expandedCategories.has('required')} />
          {expandedCategories.has('required') && (
            <div className="bg-white px-6 py-4 border-b border-gray-200">
              {requiredResources.length === 0 ? (
                <p className="text-sm text-gray-500 italic">No required readings assigned yet.</p>
              ) : (
                <>
                  <p className="text-xs text-gray-600 mb-4">
                    The following{' '}
                    {requiredResources.length === 1 ? 'reading was' : `${requiredResources.length} readings were`} assigned
                    by the event organizer to prepare for this session.
                  </p>
                  <ul className="space-y-5 list-none">
                    {requiredResources.map((resource, idx) => (
                      <li key={resource.id || idx} className="border border-amber-200 rounded-lg bg-amber-50 p-4">
                        <div aria-hidden="true" className="flex items-center gap-2 mb-2">
                          <span className="inline-block text-xs font-semibold text-amber-800 bg-amber-200 px-2 py-0.5 rounded-full">
                            Required
                          </span>
                        </div>
                        <h3 className="text-sm font-semibold text-amber-900 mb-1">
                          {resource.url ? (
                            <a href={resource.url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                              {resource.title}
                            </a>
                          ) : (
                            <span tabIndex={0}>{resource.title}</span>
                          )}
                        </h3>
                        {resource.authors && resource.authors.length > 0 && (
                          <p tabIndex={0} className="text-xs text-gray-600 mb-3">
                            <span className="sr-only">Authors and year: </span>
                            {resource.authors.join(', ')}
                            {resource.year ? ` (${resource.year})` : ''}
                          </p>
                        )}
                        {resource.description && (
                          <p tabIndex={0} className="text-xs text-gray-600 italic mb-2">
                            {resource.description}
                          </p>
                        )}
                        {resource.summary && (
                          <div className="border-t border-amber-200 pt-3 mt-2">
                            <p className="text-xs font-semibold text-amber-900 mb-1">Summary</p>
                            <p tabIndex={0} className="text-xs text-gray-700 leading-relaxed">
                              <TruncatedText
                                text={resource.summary}
                                maxLength={400}
                                className="text-xs text-gray-700 leading-relaxed"
                              />
                            </p>
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}
        </div>

        {/* Readings & References */}
        <div className="mb-2">
          <CategoryHeader category={categories[2]} isExpanded={expandedCategories.has('readings')} />
          {expandedCategories.has('readings') && (
            <div className="bg-white px-6 py-4 border-b border-gray-200">
              <p className="text-xs text-gray-600 mb-3">
                References sourced from{' '}
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
                {suggestedResources.length === 0 ? (
                  <li className="text-sm text-gray-500 italic">No reading recommendations available yet.</li>
                ) : (
                  suggestedResources.map((resource) => {
                    const isNew = resource.id ? newResourceIdsSnapshot.has(resource.id) : false;
                    return (
                      <li
                        key={resource.id}
                        className={`border-l-4 pl-4 py-3 rounded-r ${
                          isNew ? 'border-amber-400 bg-amber-50' : 'border-indigo-400 bg-indigo-50'
                        }`}
                      >
                        <div aria-hidden="true" className="flex items-center gap-2 mb-2">
                          <span className="inline-block text-xs font-semibold text-purple-700 bg-purple-100 px-2 py-0.5 rounded-full">
                            {resource.source === 'ai' ? 'AI Pick' : 'Speaker Pick'}
                          </span>
                          {isNew && (
                            <span className="inline-block text-xs font-semibold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full">
                              New
                            </span>
                          )}
                        </div>
                        <h3 className={`text-sm font-semibold mb-1 ${isNew ? 'text-amber-900' : 'text-indigo-900'}`}>
                          {resource.url ? (
                            <a href={resource.url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                              {resource.title}
                            </a>
                          ) : (
                            <span tabIndex={0}>{resource.title}</span>
                          )}
                        </h3>
                        {resource.authors && resource.authors.length > 0 && (
                          <p tabIndex={0} className="text-xs text-gray-600 mb-2">
                            <span className="sr-only">Authors and year: </span>
                            {resource.authors.join(', ')}
                            {resource.year ? ` (${resource.year})` : ''}
                          </p>
                        )}
                        {(resource.relevanceReason || resource.description || resource.summary) && (
                          <p tabIndex={0} className="text-xs text-gray-700 leading-relaxed mb-2">
                            <span className="sr-only">Relevance: </span>
                            {resource.relevanceReason || resource.description || resource.summary}
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
