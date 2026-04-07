"use client";
import React, { useRef, useState, useId, useEffect } from "react";
import {
  AppBar,
  Box,
  Dialog,
  IconButton,
  Popover,
  Slide,
  Toolbar,
  Typography,
  useMediaQuery,
} from "@mui/material";
import { TransitionProps } from "@mui/material/transitions";
import HelpOutlineOutlinedIcon from "@mui/icons-material/HelpOutlineOutlined";
import CloseIcon from "@mui/icons-material/Close";
import { useRouter } from "next/router";

import { HelpPanelContent } from "./HelpPanel";

const SlideUp = React.forwardRef(function SlideUp(
  props: TransitionProps & { children: React.ReactElement },
  ref: React.Ref<unknown>
) {
  return <Slide direction="up" ref={ref} {...props} />;
});

/**
 * The Help icon button rendered in the Header.
 * On desktop (≥ 1024px) it opens an anchored Popover with a CSS arrow.
 * On mobile it opens a full-screen Dialog that slides up.
 * Owns open/close state only — no localStorage, no badge, no tracking.
 */
export const HelpIconButton = () => {
  const [isOpen, setIsOpen] = useState(false);
  const iconRef = useRef<HTMLButtonElement>(null);
  const headingId = useId();
  const router = useRouter();

  // Match Header.tsx's lg: breakpoint — Tailwind uses 1024px, not MUI's 1200px default
  const isDesktop = useMediaQuery("(min-width: 1024px)");

  const open = () => setIsOpen(true);
  const close = () => setIsOpen(false);

  // Close the panel when navigating to a different page
  useEffect(() => {
    router.events.on("routeChangeStart", close);
    return () => {
      router.events.off("routeChangeStart", close);
    };
  }, [router.events]);

  const trigger = (
    <IconButton
      ref={iconRef}
      onClick={open}
      aria-label="Help and what's new"
      aria-haspopup="dialog"
      aria-expanded={isOpen}
      sx={{ "&:hover": { color: "#4845d2" } }}
    >
      <HelpOutlineOutlinedIcon />
    </IconButton>
  );

  if (isDesktop) {
    return (
      <>
        {trigger}
        <Popover
          open={isOpen}
          anchorEl={iconRef.current}
          onClose={close}
          anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
          transformOrigin={{ vertical: "top", horizontal: "right" }}
          marginThreshold={16}
          slotProps={{
            paper: {
              role: "dialog",
              "aria-labelledby": headingId,
              "aria-modal": false,
              sx: {
                mt: 1.5,
                overflow: "visible", // required — the arrow pseudo-element clips without this
                width: 380,
                border: "1px solid",
                borderColor: "grey.300",
                borderRadius: "8px",
                boxShadow: 8,
                "&::before": {
                  content: '""',
                  position: "absolute",
                  top: -7, // -(arrowSize/2) - 1 to sit flush on the border
                  right: 16,
                  width: 12,
                  height: 12,
                  bgcolor: "background.paper",
                  borderTop: "1px solid",
                  borderLeft: "1px solid",
                  borderColor: "grey.300",
                  transform: "rotate(45deg)",
                  zIndex: 0,
                },
              },
            },
          }}
        >
          <Box
            sx={{
              maxHeight: "calc(100vh - 120px)",
              overflowY: "auto",
              borderRadius: "8px",
              position: "relative",
              zIndex: 1, // prevents scrolled content bleeding through the arrow protrusion
            }}
          >
            <HelpPanelContent headingId={headingId} />
          </Box>
        </Popover>
      </>
    );
  }

  return (
    <>
      {trigger}
      <Dialog
        fullScreen
        open={isOpen}
        onClose={close}
        TransitionComponent={SlideUp}
        aria-labelledby={headingId}
      >
        <AppBar sx={{ position: "relative" }}>
          <Toolbar>
            <Typography
              id={headingId}
              variant="h6"
              fontWeight="bold"
              sx={{ flex: 1 }}
            >
              Help
            </Typography>
            <IconButton
              edge="end"
              color="inherit"
              onClick={close}
              aria-label="Close help"
            >
              <CloseIcon />
            </IconButton>
          </Toolbar>
        </AppBar>
        <Box
          sx={{
            overflowY: "auto",
            borderRadius: "16px",
            padding: "32px 24px",
          }}
        >
          <HelpPanelContent headingId={headingId} showHeading={false} />
        </Box>
      </Dialog>
    </>
  );
};
