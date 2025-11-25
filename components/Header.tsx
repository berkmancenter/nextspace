"use client";
import { JSX, useState, useEffect } from "react";
import Link from "next/link";

import { Box, Button, Drawer, IconButton, List, Toolbar } from "@mui/material";
import EventIcon from "@mui/icons-material/Event";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import LoginIcon from "@mui/icons-material/Login";
import LogoutIcon from "@mui/icons-material/Logout";
import FeedbackOutlinedIcon from "@mui/icons-material/FeedbackOutlined";

import { HeaderProps, PageName } from "../types.internal";
import Logo from "./Logo";
import { Close, Menu } from "@mui/icons-material";
import { useRouter } from "next/router";
import { Api } from "../utils";

// Admin pages navigation items (without Log In/Log Out - added dynamically)
const adminPagesBase: Record<string, { icon: JSX.Element; url: string }> = {
  "Event Schedule": { icon: <EventIcon />, url: "/admin/events" },
  "Schedule an Event": {
    icon: <AddCircleOutlineIcon />,
    url: "/admin/events/new",
  },
};

// Regular user pages navigation items
const userPages: Record<string, { icon: JSX.Element; url: string }> = {
  "Give Feedback": {
    icon: <FeedbackOutlinedIcon />,
    url: "https://docs.google.com/forms/d/e/1FAIpQLScVXBLSEJ5YVJtW8rwR01KDunJWnopN33Rs49YUC37OPrOgCg/viewform",
  },
};

/**
 * Header component
 *
 * This component renders the header for the app.
 * @param {object} props
 * @property {string} className - Optional Tailwind classes for styling.
 * @property {string} activeTab - The currently active tab/page name.
 * @property {string} variant - The variant of the header, either "transparent" or "solid".
 * @returns A React component for the header.
 */
export const Header = ({
  className = "",
  variant = "transparent",
  isAuthenticated,
}: HeaderProps) => {
  const variantStyles = {
    transparent: "flex-end bg-transparent shadow-none",
    solid:
      "flex-end bg-header bg-transparent bg-cover bg-center bg-no-repeat shadow-none",
  };
  const router = useRouter();
  const [open, setOpen] = useState(false);

  // Build admin pages with dynamic auth button
  const adminPages = {
    ...adminPagesBase,
    [isAuthenticated ? "Log Out" : "Log In"]: {
      icon: isAuthenticated ? <LogoutIcon /> : <LoginIcon />,
      url: isAuthenticated ? "/logout" : "/login",
    },
    "Give Feedback": {
      icon: <FeedbackOutlinedIcon />,
      url: "https://docs.google.com/forms/d/e/1FAIpQLScVXBLSEJ5YVJtW8rwR01KDunJWnopN33Rs49YUC37OPrOgCg/viewform",
    },
  };

  const currentPages = isAuthenticated ? adminPages : userPages;

  const toggleDrawer = (newOpen: boolean) => () => {
    setOpen(newOpen);
  };

  const NavItems = () => {
    return Object.keys(currentPages).map((pageName) => {
      const isExternalLink = currentPages[pageName].url.startsWith("http");
      return (
        <Link
          href={currentPages[pageName].url}
          key={pageName}
          target={isExternalLink ? "_blank" : undefined}
          rel={isExternalLink ? "noopener noreferrer" : undefined}
        >
          <Button
            sx={{
              textTransform: "capitalize",
              "&:hover": { color: "#4845d2" },
              fontSize: "1rem",
              color:
                router.asPath === currentPages[pageName].url
                  ? "#4845d2"
                  : "grey",
              backgroundColor: "transparent",
            }}
            startIcon={currentPages[pageName].icon}
          >
            {pageName}
          </Button>
        </Link>
      );
    });
  };

  return (
    <div
      className={`${className} ${variantStyles[variant]} bg-header shadow-sm`}
    >
      <Toolbar className="flex flex-row items-center justify-around w-full px-4 lg:px-8">
        <div className="flex flex-row items-center">
          <Logo className="mr-4" />
          <h1 className="text-3xl font-bold py-7 text-medium-slate-blue">
            NextSpace
          </h1>
        </div>
        <div className="flex lg:hidden flex-col justify-end">
          <IconButton onClick={toggleDrawer(true)}>
            <Menu className="text-medium-slate-blue" />
          </IconButton>
          <Drawer open={open} onClose={toggleDrawer(false)} anchor="right">
            <Box className="flex justify-end p-2">
              <IconButton onClick={toggleDrawer(false)}>
                <Close className="text-medium-slate-blue" />
              </IconButton>
            </Box>
            <List sx={{ margin: 3 }} className="flex flex-col">
              {NavItems()}
            </List>
          </Drawer>
        </div>
        <Box className="hidden lg:flex flex-row justify-end grow-1 space-x-6">
          {NavItems()}
        </Box>
      </Toolbar>
    </div>
  );
};
