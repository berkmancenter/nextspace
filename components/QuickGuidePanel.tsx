"use client";
import React from "react";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import { Box, Divider, Typography } from "@mui/material";

import { allFeatures } from "../content/features";
import { getRecentEntries } from "../content/whatsNew";
import { useBotName, useConversationType } from "../context/ConversationTypeContext";

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
  const botName = useBotName();

  // Filter features to those available for this event type once it's known.
  // Both groups are hidden entirely while the conversation type is still loading.
  const visibleFeatures = conversationType
    ? allFeatures.filter((f) => {
        if (!f.conversationTypes || f.conversationTypes.length === 0) return true;
        return f.conversationTypes.includes(conversationType);
      })
    : null;

  const visibleSlashCommands = visibleFeatures?.filter((f) => f.type === "slashCommand") ?? [];
  const visibleAssistantFeatures = visibleFeatures?.filter((f) => f.type === "assistant") ?? [];

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
            variant="subtitle1"
            fontWeight="bold"
            sx={{ mt: 2, pb: 0.5, display: "flex", alignItems: "center", gap: 0.5 }}
          >
            <AutoAwesomeIcon sx={{ fontSize: 15, color: "#4845D2" }} />
            What&apos;s New
          </Typography>
          <Divider sx={{ mb: 1.5 }} />
          {recentEntries.map((entry) => (
            <Box
              key={entry.releasedAt}
              sx={{
                mb: 1.5,
                pl: 1.5,
                py: 0.75,
                borderLeft: "3px solid #4845D2",
                bgcolor: "action.hover",
                borderRadius: "0 4px 4px 0",
              }}
            >
              <Typography variant="body2">
                {entry.title}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {entry.body}
              </Typography>
            </Box>
          ))}
        </Box>
      )}

      {/* Features — hidden until conversation type is known */}
      {visibleFeatures && (
        <Box component="section" aria-labelledby="quick-guide-features-heading">
          <Typography
            id="quick-guide-features-heading"
            variant="subtitle1"
            fontWeight="bold"
            sx={{ mt: 2, pb: 0.5 }}
          >
            Features
          </Typography>
          <Divider sx={{ mb: 1.5 }} />

          {/* Slash commands subsection */}
          {visibleSlashCommands.length > 0 && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="overline" color="text.primary" fontWeight="bold" sx={{ lineHeight: 1.5 }}>
                Slash Commands
              </Typography>
              <Typography variant="body2" color="text.secondary" display="block" sx={{ mb: 2 }}>
                Type / in the chat input to use these.
              </Typography>
              {/* Compact grid: command column auto-sizes, description takes remaining width */}
              <Box sx={{ display: "grid", gridTemplateColumns: "auto 1fr", columnGap: 2, rowGap: 1, alignItems: "start" }}>
                {visibleSlashCommands.map((feature) => (
                  <React.Fragment key={feature.command}>
                    <Typography variant="body2" sx={{ fontFamily: "monospace" }}>
                      /{feature.command}
                    </Typography>
                    <Box>
                      <Typography variant="body2">
                        {feature.description}
                      </Typography>
                      {feature.note && (
                        <Typography variant="body2" color="text.secondary" display="block" sx={{ mt: 0.25 }}>
                          {feature.note}
                        </Typography>
                      )}
                    </Box>
                  </React.Fragment>
                ))}
              </Box>
            </Box>
          )}

          {/* Event assistant subsection */}
          {visibleAssistantFeatures.length > 0 && (
            <Box>
              <Typography variant="overline" color="text.primary" fontWeight="bold" sx={{ lineHeight: 1.5 }}>
                {botName}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                These run automatically in the {botName} tab based on your settings. You can also
                summon {botName} in the group chat tab by typing @{botName}.
              </Typography>
              {visibleAssistantFeatures.map((feature) => (
                <Box key={feature.name} sx={{ mb: 1.5, pl: 1.5 }}>
                  <Typography variant="body2" fontWeight="medium">
                    {feature.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {feature.description}
                  </Typography>
                  {feature.note && (
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25, display: "block" }}>
                      {feature.note}
                    </Typography>
                  )}
                </Box>
              ))}
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
};
