"use client";
import React from "react";
import { Box, Divider, Typography } from "@mui/material";

import { allSlashCommands } from "../content/slashCommands";
import { getRecentEntries } from "../content/whatsNew";
import { useConversationType } from "../context/ConversationTypeContext";

interface QuickGuidePanelContentProps {
  /** ID of the heading element, used by aria-labelledby on the dialog wrapper. */
  headingId: string;
  /**
   * Whether to render the "Quick Guide" heading inside the panel.
   * Set to false on mobile where the Dialog AppBar already provides the heading.
   */
  showHeading?: boolean;
}

/**
 * The content rendered inside the Quick Guide panel.
 * Stateless — owns no open/close logic. Consumed by QuickGuideIconButton inside
 * both the desktop Popover and the mobile Dialog.
 */
export const QuickGuidePanelContent = ({ headingId, showHeading = true }: QuickGuidePanelContentProps) => {
  const recentEntries = getRecentEntries();
  const conversationType = useConversationType();

  // Filter to commands available for this event type once it's known.
  // Hidden entirely while the conversation type is still loading.
  const visibleCommands = conversationType
    ? allSlashCommands.filter((cmd) => {
        if (!cmd.conversationTypes || cmd.conversationTypes.length === 0) return true;
        return cmd.conversationTypes.includes(conversationType);
      })
    : null;

  return (
    <Box sx={{ p: 3 }}>
      {showHeading && (
        <Typography
          id={headingId}
          variant="h6"
          fontWeight="bold"
          gutterBottom
        >
          Quick Guide
        </Typography>
      )}

      {/* Product introduction */}
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        NextSpace is an AI-powered discussion platform. Use it during live
        events to ask questions, explore topics with the AI assistant, and
        collaborate with other participants.
      </Typography>

      {/* What's New — hidden when no entries fall within the rolling window */}
      {recentEntries.length > 0 && (
        <Box component="section" aria-labelledby="quick-guide-whats-new-heading">
          <Typography
            id="quick-guide-whats-new-heading"
            variant="subtitle2"
            fontWeight="bold"
            sx={{ mt: 2, position: "sticky", top: 0, bgcolor: "background.paper", pt: 1, pb: 0.5 }}
          >
            What&apos;s New
          </Typography>
          <Divider sx={{ mb: 1.5 }} />
          {recentEntries.map((entry) => (
            <Box key={entry.releasedAt} sx={{ mb: 1.5 }}>
              <Typography variant="body2" fontWeight="medium">
                {entry.title}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {entry.body}
              </Typography>
            </Box>
          ))}
        </Box>
      )}

      {/* Slash commands reference — hidden until conversation type is known */}
      {visibleCommands && (
      <Box component="section" aria-labelledby="quick-guide-commands-heading">
        <Typography
          id="quick-guide-commands-heading"
          variant="subtitle2"
          fontWeight="bold"
          sx={{ mt: 2, position: "sticky", top: 0, bgcolor: "background.paper", pt: 1, pb: 0.5 }}
        >
          Slash Commands &amp; Features
        </Typography>
        <Divider sx={{ mb: 1.5 }} />
        {visibleCommands.map((cmd) => (
          <Box key={cmd.command} sx={{ mb: 1.5 }}>
            <Typography variant="body2" fontWeight="medium">
              /{cmd.command}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {cmd.description}
            </Typography>
          </Box>
        ))}
      </Box>
      )}
    </Box>
  );
};
