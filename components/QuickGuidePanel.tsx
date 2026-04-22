"use client";
import React from "react";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import { Box, Divider, Typography } from "@mui/material";

import { components } from "../types";
import { getRecentEntries } from "../content/whatsNew";
import { useBotName, useConversationType } from "../context/ConversationTypeContext";

type FeatureConfig = components["schemas"]["FeatureConfig"];

// Maps a tab key to its display label. The assistant tab uses the bot's name
// so it matches what participants see in the nav.
function tabSectionLabel(tab: FeatureConfig["tab"], botName: string): string {
  if (tab === "assistant") return botName;
  if (tab === "group-chat") return "Group Chat";
  return "Transcript";
}

// Small inline badge indicating which tab a feature lives in.
// role="img" makes it findable by aria-label in tests and screen readers.
const badgeSx = {
  px: 0.75,
  py: 0.125,
  borderRadius: "4px",
  bgcolor: "action.selected",
  fontSize: "0.65rem",
  fontFamily: "inherit",
  color: "text.secondary",
  lineHeight: 1.6,
};

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
 *
 * Features come from the ConversationType stored in context, which is set by the
 * page once the conversation loads. The panel hides the features section entirely
 * until the type is known.
 */
export const QuickGuidePanelContent = ({ headingId, showHeading = true }: QuickGuidePanelContentProps) => {
  const recentEntries = getRecentEntries();
  const conversationType = useConversationType();
  const botName = useBotName();

  // null = type not yet loaded; hide features entirely until known.
  // Filter to participant-visible features only — moderator-only entries never render here.
  const visibleFeatures = conversationType
    ? (conversationType.features ?? []).filter(
        (f) => f.audience === "participant" || f.audience === "both"
      )
    : null;

  // Collect tabs in first-seen order so the section order matches the feature list.
  const tabsInOrder = visibleFeatures
    ? [...new Set(visibleFeatures.map((f) => f.tab))]
    : [];

  return (
    <Box sx={{ p: 3 }}>
      {showHeading && (
        <Typography id={headingId} variant="h6" fontWeight="bold" gutterBottom>
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
              <Typography variant="body2">{entry.title}</Typography>
              <Typography variant="body2" color="text.secondary">{entry.body}</Typography>
            </Box>
          ))}
        </Box>
      )}

      {/* Features — hidden until type is known and has at least one visible feature */}
      {visibleFeatures && tabsInOrder.length > 0 && (
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

          {tabsInOrder.map((tab) => {
            const tabFeatures = visibleFeatures.filter((f) => f.tab === tab);
            const slashCommands = tabFeatures.filter((f) => f.slashCommand);
            const passiveFeatures = tabFeatures.filter((f) => !f.slashCommand);
            const label = tabSectionLabel(tab, botName);

            return (
              <Box key={tab} sx={{ mb: 2 }}>
                <Typography variant="overline" color="text.primary" fontWeight="bold" sx={{ lineHeight: 1.5 }}>
                  {label}
                </Typography>

                {/* Slash commands within this tab */}
                {slashCommands.length > 0 && (
                  <Box sx={{ mb: passiveFeatures.length > 0 ? 1.5 : 0 }}>
                    <Typography variant="body2" color="text.secondary" display="block" sx={{ mb: 1 }}>
                      Type / in the chat input to use these.
                    </Typography>
                    <Box sx={{ display: "grid", gridTemplateColumns: "auto 1fr", columnGap: 2, rowGap: 1, alignItems: "start" }}>
                      {slashCommands.map((feature) => (
                        <React.Fragment key={feature.name}>
                          {/* Badge is a sibling, not nested — keeps Typography textContent clean for queries */}
                          <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, flexWrap: "wrap" }}>
                            <Typography variant="body2" sx={{ fontFamily: "monospace" }}>
                              /{feature.slashCommand}
                            </Typography>
                            <Box component="span" role="img" aria-label={`Available in ${label}`} sx={badgeSx}>
                              {label}
                            </Box>
                          </Box>
                          <Typography variant="body2" color="text.secondary">
                            {feature.participantDescription ?? feature.description}
                          </Typography>
                        </React.Fragment>
                      ))}
                    </Box>
                  </Box>
                )}

                {/* Passive features within this tab */}
                {passiveFeatures.map((feature) => (
                  <Box key={feature.name} sx={{ mb: 1.5, pl: 1.5 }}>
                    {/* Badge is a sibling, not nested — keeps Typography textContent clean for queries */}
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, flexWrap: "wrap" }}>
                      <Typography variant="body2" fontWeight="medium">
                        {feature.label}
                      </Typography>
                      <Box component="span" role="img" aria-label={`Available in ${label}`} sx={badgeSx}>
                        {label}
                      </Box>
                    </Box>
                    <Typography variant="body2" color="text.secondary">
                      {feature.participantDescription ?? feature.description}
                    </Typography>
                  </Box>
                ))}
              </Box>
            );
          })}
        </Box>
      )}
    </Box>
  );
};
