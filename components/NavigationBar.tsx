"use client";

import React from "react";
import { Badge } from "@mui/material";
import GroupOutlinedIcon from "@mui/icons-material/GroupOutlined";
import GroupIcon from "@mui/icons-material/Group";
import { BotIcon } from "./BotIcon";
import { TranscriptIcon } from "./TranscriptIcon";

export type NavTab = "assistant" | "chat" | "transcript";

interface NavItem {
  id: NavTab;
  label: string;
  ActiveIcon: React.ElementType | null;
  InactiveIcon: React.ElementType | null;
  show: boolean;
}

interface NavigationBarProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  unseenAssistantCount: number;
  unseenChatCount: number;
  showChat: boolean;
  showTranscript: boolean;
}

/**
 * NavigationBar component
 *
 * Renders a responsive navigation bar:
 *  - Mobile: fixed bottom bar, horizontal layout
 *  - Desktop: left sidebar, vertical layout
 *
 * Three items: Event Bot, Group Chat, Transcript.
 * Icons are black when selected, grey when unselected, on a light purple background.
 */
export function NavigationBar({
  activeTab,
  onTabChange,
  unseenAssistantCount,
  unseenChatCount,
  showChat,
  showTranscript,
}: NavigationBarProps) {
  const navItems: NavItem[] = (
    [
      {
        id: "assistant" as NavTab,
        label: "Event Bot",
        ActiveIcon: null,
        InactiveIcon: null,
        show: true,
      },
      {
        id: "chat" as NavTab,
        label: "Group Chat",
        ActiveIcon: GroupIcon,
        InactiveIcon: GroupOutlinedIcon,
        show: showChat,
      },
      {
        id: "transcript" as NavTab,
        label: "Transcript",
        ActiveIcon: null,
        InactiveIcon: null,
        show: showTranscript,
      },
    ] as NavItem[]
  ).filter((item) => item.show);

  const getUnseenCount = (id: NavTab) => {
    if (id === "assistant") return unseenAssistantCount;
    if (id === "chat") return unseenChatCount;
    return 0;
  };

  const renderIcon = (
    id: NavTab,
    ActiveIcon: React.ElementType | null,
    InactiveIcon: React.ElementType | null,
    isActive: boolean,
    size: number,
  ) => {
    const color = isActive ? "#1a1a1a" : "#9E9E9E";
    if (id === "assistant") {
      return <BotIcon size={size} color={color} />;
    }
    if (id === "transcript") {
      return <TranscriptIcon size={size} color={color} />;
    }
    const Icon = (isActive ? ActiveIcon : InactiveIcon)!;
    return <Icon sx={{ fontSize: size, color }} />;
  };

  const NavButton = ({
    item,
    size,
    fullWidth,
  }: {
    item: NavItem;
    size: number;
    fullWidth?: boolean;
  }) => {
    const { id, label, ActiveIcon, InactiveIcon } = item;
    const isActive = activeTab === id;
    const unseen = getUnseenCount(id);

    return (
      <button
        onClick={() => onTabChange(id)}
        className={`flex flex-col items-center gap-1 transition-colors ${
          fullWidth ? "justify-center flex-1 h-full gap-0.5" : "w-full px-1 py-3"
        }`}
        style={{
          background: isActive ? "#D1C4E9" : "transparent",
          border: "none",
          cursor: "pointer",
        }}
        aria-current={isActive ? "page" : undefined}
        aria-label={label}
      >
        <Badge
          color="secondary"
          variant="dot"
          invisible={unseen === 0 || isActive}
          sx={{ "& .MuiBadge-badge": { right: -2, top: 2 } }}
        >
          {renderIcon(id, ActiveIcon, InactiveIcon, isActive, size)}
        </Badge>
        <span
          style={{
            fontSize: "10px",
            fontWeight: isActive ? 700 : 400,
            color: isActive ? "#1a1a1a" : "#9E9E9E",
            letterSpacing: "0.03em",
            textTransform: "uppercase",
            lineHeight: 1.2,
            textAlign: "center",
          }}
        >
          {label}
        </span>
      </button>
    );
  };

  return (
    <>
      {/* ── Desktop: left vertical sidebar ── */}
      <nav
        className="hidden lg:flex flex-col items-center py-6 gap-2 flex-shrink-0"
        style={{
          backgroundColor: "#EDE7F6",
          width: "72px",
          minHeight: "100%",
          borderRight: "1px solid #D1C4E9",
        }}
        aria-label="Main navigation"
      >
        {navItems.map((item) => (
          <NavButton key={item.id} item={item} size={26} />
        ))}
      </nav>

      {/* ── Mobile: fixed bottom bar ── */}
      <nav
        className="lg:hidden fixed bottom-0 left-0 right-0 flex flex-row items-center justify-around z-50"
        style={{
          backgroundColor: "#EDE7F6",
          borderTop: "1px solid #D1C4E9",
          height: "60px",
        }}
        aria-label="Main navigation"
      >
        {navItems.map((item) => (
          <NavButton key={item.id} item={item} size={24} fullWidth />
        ))}
      </nav>
    </>
  );
}
