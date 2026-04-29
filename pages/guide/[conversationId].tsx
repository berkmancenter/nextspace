import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { Box, CircularProgress, Divider, Typography } from "@mui/material";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import GroupOutlinedIcon from "@mui/icons-material/GroupOutlined";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import MenuBookOutlined from "@mui/icons-material/MenuBookOutlined";
import { BotIcon } from "../../components/BotIcon";
import { TranscriptIcon } from "../../components/TranscriptIcon";
import { components, paths } from "../../types";
import { getRecentEntries } from "../../content/whatsNew";

type FeatureConfig = components["schemas"]["FeatureConfig"];
type GuideData = paths["/conversations/{conversationId}/features"]["get"]["responses"]["200"]["content"]["application/json"];

function tabLabel(tab: string, botName: string): string {
  switch (tab) {
    case "assistant":  return botName;
    case "group-chat": return "Group Chat";
    case "resources":  return "Resources";
    default:           return "Transcript";
  }
}

function tabIcon(tab: string): React.ReactElement {
  switch (tab) {
    case "assistant":  return <BotIcon size={20} />;
    case "group-chat": return <GroupOutlinedIcon sx={{ fontSize: 20 }} />;
    case "resources":  return <MenuBookOutlined sx={{ fontSize: 20 }} />;
    default:           return <TranscriptIcon size={20} />;
  }
}

function tabAccent(tab: string): { color: string; border: string; bg: string } {
  switch (tab) {
    case "assistant":  return { color: "#4845D2", border: "rgba(72,69,210,0.2)",   bg: "rgba(72,69,210,0.06)" };
    case "group-chat": return { color: "#0e7490", border: "rgba(14,116,144,0.2)",  bg: "rgba(14,116,144,0.06)" };
    case "resources":  return { color: "#0f7a4b", border: "rgba(15,122,75,0.2)",   bg: "rgba(15,122,75,0.06)" };
    default:           return { color: "#6b7280", border: "rgba(107,114,128,0.2)", bg: "rgba(107,114,128,0.06)" };
  }
}

const ROW_SX = {
  display: "grid",
  gridTemplateColumns: "160px 1fr",
  gap: 2,
  py: 1,
  borderBottom: "1px solid",
  borderColor: "divider",
  "&:last-child": { borderBottom: "none" },
} as const;

const TIER_LABEL_SX = {
  display: "block",
  mb: 1,
  textTransform: "uppercase" as const,
  letterSpacing: "0.07em",
  fontWeight: 700,
} as const;

function tabDescription(tab: string, botName: string): string | null {
  switch (tab) {
    case "assistant":  return `The ${botName} tab is a 1:1 chat — ask questions or follow up on topics from the event.`;
    case "group-chat": return `A chat with other event participants.`;
    default:           return null;
  }
}

function tabActionTip(tab: string, botName: string): string | null {
  switch (tab) {
    case "group-chat": return `Include @${botName} in your message to bring ${botName} into the conversation.`;
    default:           return null;
  }
}

function TabSection({ tab, features, botName }: { tab: string; features: FeatureConfig[]; botName: string }) {
  const { color, border, bg } = tabAccent(tab);
  const label = tabLabel(tab, botName);
  const icon = tabIcon(tab);
  const description = tabDescription(tab, botName);
  const actionTip = tabActionTip(tab, botName);

  const slashCommands   = features.filter((f) => f.slashCommand);
  const userControlled  = features.filter((f) => !f.slashCommand && f.userControlled);
  const automatic       = features.filter((f) => !f.slashCommand && !f.userControlled);

  return (
    <Box
      component="section"
      aria-label={label}
      sx={{ mb: 3, borderRadius: 2, border: "1px solid", borderColor: border, overflow: "hidden" }}
    >
      <Box sx={{ px: 3, py: 1.5, bgcolor: bg, borderBottom: "1px solid", borderColor: border, display: "flex", alignItems: "center", gap: 1 }}>
        <Box sx={{ display: "flex", alignItems: "center", color }}>{icon}</Box>
        <Typography variant="subtitle1" component="h3" fontWeight="bold" sx={{ color }}>
          {label}
        </Typography>
      </Box>

      <Box sx={{ px: 3 }}>
        {description && (
          <Typography variant="body2" color="text.secondary" sx={{ pt: 1.5, pb: 0.5 }}>
            {description}
          </Typography>
        )}
        {actionTip && (
          <Box sx={{ display: "flex", alignItems: "flex-start", gap: 0.75, pt: description ? 0.75 : 1.5, pb: 0.5 }}>
            <InfoOutlinedIcon sx={{ fontSize: 15, color: "text.disabled", mt: "2px", flexShrink: 0 }} />
            <Typography variant="caption" color="text.secondary">
              <Box component="span" sx={{ fontWeight: 700, mr: 0.5 }}>Tip:</Box>
              {actionTip}
            </Typography>
          </Box>
        )}
        {slashCommands.length > 0 && (
          <Box sx={{ pt: 1.5, pb: (userControlled.length + automatic.length) > 0 ? 0 : 1.5 }}>
            <Typography variant="caption" color="text.secondary" sx={TIER_LABEL_SX}>
              Commands — type / in the chat
            </Typography>
            <Box sx={{ pl: 2 }}>
              {slashCommands.map((f) => (
                <Box key={f.name} sx={ROW_SX}>
                  <Box>
                    <Typography
                      variant="body2"
                      sx={{ fontFamily: "monospace", bgcolor: "action.hover", display: "inline-block", px: 0.75, py: 0.25, borderRadius: 1 }}
                    >
                      /{f.slashCommand}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      {f.description}
                    </Typography>
                    {f.prerequisite && (
                      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 0.5, mt: 0.5 }}>
                        <SettingsOutlinedIcon sx={{ fontSize: 13, color: "text.disabled", mt: "2px", flexShrink: 0 }} />
                        <Typography variant="caption" color="text.secondary">
                          {f.prerequisite}
                        </Typography>
                      </Box>
                    )}
                  </Box>
                </Box>
              ))}
            </Box>
          </Box>
        )}

        {userControlled.length > 0 && (
          <Box sx={{ pt: 1.5, pb: automatic.length > 0 ? 0 : 1.5 }}>
            <Typography variant="caption" color="text.secondary" sx={TIER_LABEL_SX}>
              Your settings
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1, fontStyle: "italic" }}>
              Settings are in the {botName} tab. Once you&apos;ve set them, they won&apos;t appear again. We&apos;re working on making these easier to find.
            </Typography>
            <Box sx={{ pl: 2 }}>
              {userControlled.map((f) => (
                <Box key={f.name} sx={ROW_SX}>
                  <Typography variant="body2" fontWeight="medium">{f.label}</Typography>
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      {f.description}
                    </Typography>
                    {f.prerequisite && (
                      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 0.5, mt: 0.5 }}>
                        <SettingsOutlinedIcon sx={{ fontSize: 13, color: "text.disabled", mt: "2px", flexShrink: 0 }} />
                        <Typography variant="caption" color="text.secondary">
                          {f.prerequisite}
                        </Typography>
                      </Box>
                    )}
                  </Box>
                </Box>
              ))}
            </Box>
          </Box>
        )}

        {automatic.length > 0 && (
          <Box sx={{ pt: 1.5, pb: 1.5 }}>
            <Typography variant="caption" color="text.secondary" sx={TIER_LABEL_SX}>
              Always active
            </Typography>
            <Box sx={{ pl: 2 }}>
              {automatic.map((f) => (
                <Box key={f.name} sx={ROW_SX}>
                  <Typography variant="body2" fontWeight="medium">{f.label}</Typography>
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      {f.description}
                    </Typography>
                    {f.prerequisite && (
                      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 0.5, mt: 0.5 }}>
                        <SettingsOutlinedIcon sx={{ fontSize: 13, color: "text.disabled", mt: "2px", flexShrink: 0 }} />
                        <Typography variant="caption" color="text.secondary">
                          {f.prerequisite}
                        </Typography>
                      </Box>
                    )}
                  </Box>
                </Box>
              ))}
            </Box>
          </Box>
        )}
      </Box>
    </Box>
  );
}

function WhatsNew() {
  const entries = getRecentEntries();
  if (entries.length === 0) return null;

  return (
    <Box component="section" aria-labelledby="guide-whats-new" sx={{ mb: 4 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mb: 1.5 }}>
        <AutoAwesomeIcon sx={{ fontSize: 16, color: "#4845D2" }} />
        <Typography id="guide-whats-new" variant="h6" component="h2" fontWeight="bold">
          What&apos;s New
        </Typography>
      </Box>
      <Divider sx={{ mb: 2 }} />
      <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {entries.map((entry) => (
          <Box key={entry.releasedAt}>
            <Typography variant="body2" fontWeight="medium" gutterBottom>
              {entry.title}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {entry.body}
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

export default function GuidePage() {
  const router = useRouter();
  const conversationId = router.query.conversationId as string;

  const [guide, setGuide] = useState<GuideData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!conversationId) return;

    fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/conversations/${conversationId}/features`
    )
      .then((res) => {
        if (!res.ok) {
          if (res.status === 404) throw new Error("Conversation not found.");
          throw new Error("Failed to load guide.");
        }
        return res.json() as Promise<GuideData>;
      })
      .then(setGuide)
      .catch((err: Error) => setError(err.message));
  }, [conversationId]);

  if (error) {
    return (
      <Box sx={{ p: 4 }}>
        <Typography color="error">{error}</Typography>
      </Box>
    );
  }

  if (!guide) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", pt: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  const botName = guide.conversationBotName ?? "Berkie";
  const features = guide.features ?? [];
  const TAB_ORDER = ["assistant", "group-chat", "transcript", "resources"];
  const tabs = [...new Set(features.map((f) => f.category))].sort(
    (a, b) => TAB_ORDER.indexOf(a) - TAB_ORDER.indexOf(b)
  );

  return (
    <Box sx={{ bgcolor: "background.default", minHeight: "100vh", py: 5, px: 4 }}>
      <Box sx={{ maxWidth: 720, mx: "auto" }}>

        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" component="h1" fontWeight="bold" gutterBottom>
            Quick Guide
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Your home for live event discussions. Ask questions, dig into topics
            with {botName}, and see what other participants are thinking.
          </Typography>
        </Box>

        <WhatsNew />

        {tabs.length > 0 && (
          <Box component="section" aria-labelledby="guide-features">
            <Typography id="guide-features" variant="h6" component="h2" fontWeight="bold" sx={{ mb: 1.5 }}>
              Features
            </Typography>
            <Divider sx={{ mb: 2.5 }} />
            {tabs.map((tab) => (
              <TabSection
                key={tab}
                tab={tab}
                features={features.filter((f) => f.category === tab)}
                botName={botName}
              />
            ))}
          </Box>
        )}

      </Box>
    </Box>
  );
}
