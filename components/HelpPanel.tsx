"use client";
import React from "react";
import { Box, Divider, Typography } from "@mui/material";

import { allSlashCommands } from "../content/slashCommands";
import { getRecentEntries } from "../content/whatsNew";

interface HelpPanelContentProps {
  /** ID of the heading element, used by aria-labelledby on the dialog wrapper. */
  headingId: string;
  /**
   * Whether to render the "Help" heading inside the panel.
   * Set to false on mobile where the Dialog AppBar already provides the heading.
   */
  showHeading?: boolean;
}

/**
 * The content rendered inside the Help panel.
 * Stateless — owns no open/close logic. Consumed by HelpIconButton inside
 * both the desktop Popover and the mobile Dialog.
 */
export const HelpPanelContent = ({ headingId, showHeading = true }: HelpPanelContentProps) => {
  const recentEntries = getRecentEntries();

  return (
    <Box sx={{ p: 3 }}>
      {showHeading && (
        <Typography
          id={headingId}
          variant="h6"
          fontWeight="bold"
          gutterBottom
        >
          Help
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
        <Box component="section" aria-labelledby="help-whats-new-heading">
          <Typography
            id="help-whats-new-heading"
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

      {/* Slash commands reference */}
      <Box component="section" aria-labelledby="help-commands-heading">
        <Typography
          id="help-commands-heading"
          variant="subtitle2"
          fontWeight="bold"
          sx={{ mt: 2, position: "sticky", top: 0, bgcolor: "background.paper", pt: 1, pb: 0.5 }}
        >
          Slash Commands &amp; Features
        </Typography>
        <Divider sx={{ mb: 1.5 }} />
        {allSlashCommands.map((cmd) => (
          <Box key={cmd.command} sx={{ mb: 1.5 }}>
            <Typography variant="body2" fontWeight="medium">
              /{cmd.command}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {cmd.description}
            </Typography>
            {cmd.conversationTypes && cmd.conversationTypes.length > 0 && (
              <Typography variant="caption" color="text.disabled">
                Available in: {cmd.conversationTypes.join(", ")}
              </Typography>
            )}
          </Box>
        ))}
      </Box>
    </Box>
  );
};
