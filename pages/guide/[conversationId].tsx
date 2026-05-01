import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { Box, CircularProgress, Divider, Typography } from "@mui/material";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import GroupOutlinedIcon from "@mui/icons-material/GroupOutlined";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import MenuBookOutlined from "@mui/icons-material/MenuBookOutlined";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import { BotIcon } from "../../components/BotIcon";
import { TranscriptIcon } from "../../components/TranscriptIcon";
import { components, paths } from "../../types";
import { getRecentEntries } from "../../content/whatsNew";

type FeatureConfig = components["schemas"]["FeatureConfig"] & {
  enabled?: boolean;
};
type GuideData =
  paths["/conversations/{conversationId}/features"]["get"]["responses"]["200"]["content"]["application/json"];
type PillState = "active" | "configurable" | "unavailable";

function tabLabel(tab: string, botName: string): string {
  switch (tab) {
    case "assistant":
      return botName;
    case "group-chat":
      return "Group Chat";
    case "resources":
      return "Resources";
    default:
      return "Transcript";
  }
}

function tabIcon(tab: string): React.ReactElement {
  switch (tab) {
    case "assistant":
      return <BotIcon size={22} />;
    case "group-chat":
      return <GroupOutlinedIcon sx={{ fontSize: 22 }} />;
    case "resources":
      return <MenuBookOutlined sx={{ fontSize: 22 }} />;
    default:
      return <TranscriptIcon size={22} />;
  }
}

function tabAccent(tab: string): { color: string; border: string; bg: string } {
  switch (tab) {
    case "assistant":
      return {
        color: "#4845D2",
        border: "rgba(72,69,210,0.2)",
        bg: "rgba(72,69,210,0.06)",
      };
    case "group-chat":
      return {
        color: "#0e7490",
        border: "rgba(14,116,144,0.2)",
        bg: "rgba(14,116,144,0.06)",
      };
    case "resources":
      return {
        color: "#0f7a4b",
        border: "rgba(15,122,75,0.2)",
        bg: "rgba(15,122,75,0.06)",
      };
    default:
      return {
        color: "#6b7280",
        border: "rgba(107,114,128,0.2)",
        bg: "rgba(107,114,128,0.06)",
      };
  }
}

const ROW_SX = {
  display: "grid",
  gridTemplateColumns: { xs: "110px 1fr", sm: "160px 1fr" },
  gap: 2,
  py: 1,
  borderBottom: "1px solid",
  borderColor: "divider",
  "&:last-child": { borderBottom: "none" },
};

const TIER_LABEL_SX = {
  display: "block",
  mb: 0,
  textTransform: "uppercase" as const,
  letterSpacing: "0.07em",
  fontWeight: 700,
} as const;

function tabDescription(tab: string, botName: string): string | null {
  switch (tab) {
    case "assistant":
      return `The ${botName} tab is a 1:1 chat — ask questions or follow up on topics from the event.`;
    case "group-chat":
      return `A chat with other event participants.`;
    default:
      return null;
  }
}

function tabActionTip(tab: string, botName: string): string | null {
  switch (tab) {
    case "group-chat":
      return `Include @${botName} in your message to bring ${botName} into the conversation.`;
    default:
      return null;
  }
}

/* Pill colors pass WCAG AA (4.5:1) against a white card background.
   Tinted backgrounds were removed — colored text on white is the contrast pair. */
const PILL_COLORS = {
  active: { color: "#15803d", bg: "transparent", border: "#15803d" },
  configurable: { color: "#b45309", bg: "transparent", border: "#b45309" },
  unavailable: { color: "#767676", bg: "transparent", border: "#767676" },
} as const;

function StatusPill({ state }: { state: PillState }) {
  const { color, bg, border } = PILL_COLORS[state];
  const base = {
    display: "inline-flex",
    alignItems: "center",
    gap: 0.5,
    borderRadius: "999px",
    px: 1.25,
    py: 0.375,
    flexShrink: 0,
    border: "1px solid",
    borderColor: border,
    bgcolor: bg,
  };

  if (state === "active") {
    return (
      <Box sx={base}>
        <CheckCircleOutlineIcon sx={{ fontSize: 13, color }} />
        <Typography
          variant="caption"
          sx={{ color, fontWeight: 600, lineHeight: 1 }}
        >
          Active
        </Typography>
      </Box>
    );
  }

  if (state === "configurable") {
    return (
      <Box sx={base}>
        <SettingsOutlinedIcon sx={{ fontSize: 13, color }} />
        <Typography
          variant="caption"
          sx={{ color, fontWeight: 600, lineHeight: 1 }}
        >
          Configurable
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={base}>
      <LockOutlinedIcon sx={{ fontSize: 13, color }} />
      <Typography
        variant="caption"
        sx={{ color, fontWeight: 600, lineHeight: 1 }}
      >
        Not available
      </Typography>
    </Box>
  );
}

function FeatureRow({
  f,
  nameSlot,
}: {
  f: FeatureConfig;
  nameSlot: React.ReactNode;
}) {
  return (
    <Box sx={ROW_SX}>
      {nameSlot}
      <Box>
        <Typography variant="body2" color="text.secondary">
          {f.description}
        </Typography>
        {f.prerequisite && (
          <Box
            sx={{
              display: "flex",
              alignItems: "flex-start",
              gap: 0.5,
              mt: 0.5,
            }}
          >
            <SettingsOutlinedIcon
              sx={{
                fontSize: 13,
                color: "text.disabled",
                mt: "2px",
                flexShrink: 0,
              }}
            />
            <Typography variant="caption" color="text.secondary">
              {f.prerequisite}
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
}

function getPillState(f: FeatureConfig): PillState {
  if (f.enabled === false) return "unavailable";
  if (f.userControlled) return "configurable";
  return "active";
}

function FeatureRowWithPill({ f }: { f: FeatureConfig }) {
  const state = getPillState(f);
  const isUnavailable = state === "unavailable";
  const labelColor = isUnavailable ? "text.disabled" : "text.primary";
  const descColor = isUnavailable ? "text.disabled" : "text.secondary";
  return (
    <Box
      aria-disabled={isUnavailable ? "true" : undefined}
      sx={{
        py: 1.5,
        borderBottom: "1px solid",
        borderColor: "divider",
        "&:last-child": { borderBottom: "none" },
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        gap: 2,
      }}
    >
      <Box sx={{ flex: 1 }}>
        <Typography
          variant="body2"
          fontWeight="medium"
          color={labelColor}
          sx={{ mb: 0.5 }}
        >
          {f.label}
        </Typography>
        <Typography variant="body2" color={descColor}>
          {f.description}
        </Typography>
        {f.prerequisite && (
          <Box
            sx={{
              display: "flex",
              alignItems: "flex-start",
              gap: 0.5,
              mt: 0.5,
            }}
          >
            <SettingsOutlinedIcon
              sx={{ fontSize: 13, color: descColor, mt: "2px", flexShrink: 0 }}
            />
            <Typography variant="caption" color={descColor}>
              {f.prerequisite}
            </Typography>
          </Box>
        )}
      </Box>
      <StatusPill state={state} />
    </Box>
  );
}

function TabSection({
  tab,
  features,
  botName,
}: {
  tab: string;
  features: FeatureConfig[];
  botName: string;
}) {
  const { color, border, bg } = tabAccent(tab);
  const label = tabLabel(tab, botName);
  const icon = tabIcon(tab);
  const description = tabDescription(tab, botName);
  const actionTip = tabActionTip(tab, botName);

  const slashCommands = features.filter((f) => f.slashCommand);
  const userControlled = features.filter(
    (f) => !f.slashCommand && f.userControlled,
  );
  const automatic = features.filter(
    (f) => !f.slashCommand && !f.userControlled,
  );
  const hasDisabled = features.some(
    (f) => !f.slashCommand && f.enabled === false,
  );
  const hasNonSlash = userControlled.length + automatic.length > 0;

  return (
    <Box
      component="section"
      aria-label={label}
      sx={{
        mb: 3,
        borderRadius: 2,
        border: "1px solid",
        borderColor: border,
        overflow: "hidden",
      }}
    >
      {/* Inverted header — dark accent bg, white text */}
      <Box
        sx={{
          px: 3,
          py: 1.5,
          bgcolor: color,
          borderBottom: "1px solid",
          borderColor: "rgba(255,255,255,0.15)",
          display: "flex",
          alignItems: "flex-end",
          gap: 1,
          color: "white",
        }}
      >
        {icon}
        <Typography
          variant="subtitle1"
          component="h3"
          fontWeight="bold"
          sx={{ color: "white", lineHeight: 1 }}
        >
          {label}
        </Typography>
      </Box>

      <Box sx={{ px: 3 }}>
        {description && (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ pt: 1.5, pb: 0.5 }}
          >
            {description}
          </Typography>
        )}

        {/* Caveat note in a gray box */}
        {hasDisabled && (
          <Box
            sx={{
              bgcolor: "action.hover",
              borderRadius: 1,
              px: 1.5,
              py: 1,
              mt: description ? 0.75 : 1.5,
              mb: 0.5,
            }}
          >
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ fontStyle: "italic" }}
            >
              Feature availability varies by event. Grayed-out features
              aren&apos;t part of this one.
            </Typography>
          </Box>
        )}

        {/* Slash commands — header with Active pill, existing table below */}
        {slashCommands.length > 0 && (
          <Box sx={{ pt: 1.5, pb: hasNonSlash ? 0 : 1.5 }}>
            <Box
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                mb: 1,
              }}
            >
              <Typography
                variant="caption"
                color="text.secondary"
                sx={TIER_LABEL_SX}
              >
                Commands — type / in the chat
              </Typography>
              <StatusPill state="active" />
            </Box>
            <Box sx={{ pl: 2 }}>
              {slashCommands.map((f) => (
                <FeatureRow
                  key={f.name}
                  f={f}
                  nameSlot={
                    <Box>
                      <Typography
                        variant="body2"
                        sx={{
                          fontFamily: "monospace",
                          bgcolor: "action.hover",
                          display: "inline-block",
                          px: 0.75,
                          py: 0.25,
                          borderRadius: 1,
                        }}
                      >
                        /{f.slashCommand}
                      </Typography>
                    </Box>
                  }
                />
              ))}
            </Box>
          </Box>
        )}

        {/* User-controlled features — Settings subheader + pill per row */}
        {userControlled.length > 0 && (
          <Box
            sx={{ pt: 1.5, pb: automatic.length > 0 ? 0 : actionTip ? 0 : 1.5 }}
          >
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ ...TIER_LABEL_SX, mb: 0.5 }}
            >
              Settings
            </Typography>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: "block", mb: 1, fontStyle: "italic" }}
            >
              You can change these settings in the {botName} tab. Once
              you&apos;ve set them, they won&apos;t appear again. We&apos;re
              working on making these easier to find.
            </Typography>
            {userControlled.map((f) => (
              <FeatureRowWithPill key={f.name} f={f} />
            ))}
          </Box>
        )}

        {/* Automatic features — pill per row, no tier header */}
        {automatic.length > 0 && (
          <Box sx={{ pt: 1.5, pb: actionTip ? 0 : 1.5 }}>
            {automatic.map((f) => (
              <FeatureRowWithPill key={f.name} f={f} />
            ))}
          </Box>
        )}

        {/* Tip box — bordered, uses section accent colors */}
        {actionTip && (
          <Box
            sx={{
              display: "flex",
              alignItems: "flex-start",
              gap: 0.75,
              mt: 1.5,
              mb: 1.5,
              border: "1px solid",
              borderColor: border,
              bgcolor: bg,
              borderRadius: 1.5,
              px: 1.5,
              py: 1,
            }}
          >
            <InfoOutlinedIcon
              sx={{ fontSize: 15, color, mt: "2px", flexShrink: 0 }}
            />
            <Typography variant="caption" color="text.secondary">
              <Box component="span" sx={{ fontWeight: 700, mr: 0.5, color }}>
                Tip:
              </Box>
              {actionTip}
            </Typography>
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
        <Typography
          id="guide-whats-new"
          variant="h6"
          component="h2"
          fontWeight="bold"
        >
          What&apos;s New
        </Typography>
      </Box>
      <Divider sx={{ mb: 2 }} />
      <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {entries.map((entry) => (
          <Box key={`${entry.releasedAt}-${entry.title}`}>
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
      `${process.env.NEXT_PUBLIC_API_URL}/conversations/${conversationId}/features`,
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
  const tabs = [...new Set(features.map((f) => f.category))].sort((a, b) => {
    const ai = TAB_ORDER.indexOf(a);
    const bi = TAB_ORDER.indexOf(b);
    return (
      (ai === -1 ? TAB_ORDER.length : ai) - (bi === -1 ? TAB_ORDER.length : bi)
    );
  });

  return (
    <Box
      sx={{ bgcolor: "background.default", minHeight: "100vh", py: 5, px: 4 }}
    >
      <Box sx={{ maxWidth: 720, mx: "auto" }}>
        <Box sx={{ mb: 4 }}>
          <Typography
            variant="h4"
            component="h1"
            fontWeight="bold"
            gutterBottom
          >
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
            <Typography
              id="guide-features"
              variant="h6"
              component="h2"
              fontWeight="bold"
              sx={{ mb: 1.5 }}
            >
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
