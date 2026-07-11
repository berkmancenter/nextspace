import React from 'react';
import { ChevronRight } from '@mui/icons-material';

/**
 * A collapsible white card used to lay out the Details sections (Event Details, Schedule,
 * Platform & format, Assistant configuration, Moderators & presenters, Reading & resources).
 * Expand state is controlled by the caller so a Status.tsx readiness-checklist row can jump
 * to and expand a specific card without SectionCard needing to know about that interaction.
 */
export const SectionCard: React.FC<{
  id: string;
  title: string;
  expanded: boolean;
  onToggle: (expanded: boolean) => void;
  headerChip?: React.ReactNode;
  flash?: boolean;
  children: React.ReactNode;
}> = ({ id, title, expanded, onToggle, headerChip, flash = false, children }) => {
  return (
    <div
      id={id}
      data-testid={`section-card-${id}`}
      className={`rounded-[10px] border border-[#ECECEF] bg-white ${flash ? 'animate-card-flash' : ''}`}
    >
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => onToggle(!expanded)}
        className="flex w-full items-center justify-between gap-3 px-[18px] py-[15px] text-left"
      >
        <span className="flex items-center gap-2">
          <span className="text-[12.5px] font-semibold text-[#0B0D0E]">{title}</span>
          {headerChip}
        </span>
        <ChevronRight
          fontSize="small"
          className={`text-[#8A8F99] transition-transform duration-[180ms] ${expanded ? 'rotate-90' : ''}`}
        />
      </button>
      {expanded && <div className="px-[18px] pb-[18px]">{children}</div>}
    </div>
  );
};
