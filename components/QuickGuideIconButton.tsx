"use client";
import React, { useRef, useState, useId, useEffect } from "react";
import {
  AppBar,
  Box,
  Button,
  Dialog,
  IconButton,
  Popover,
  Slide,
  Toolbar,
  Typography,
  useMediaQuery,
} from "@mui/material";
import { TransitionProps } from "@mui/material/transitions";
import TipsAndUpdatesOutlinedIcon from "@mui/icons-material/TipsAndUpdatesOutlined";
import CloseIcon from "@mui/icons-material/Close";
import { useRouter } from "next/router";

import { QuickGuidePanelContent } from "./QuickGuidePanel";

const SlideUp = React.forwardRef(function SlideUp(
  props: TransitionProps & { children: React.ReactElement },
  ref: React.Ref<unknown>
) {
  return <Slide direction="up" ref={ref} {...props} />;
});

interface QuickGuideIconButtonProps {
  /**
   * When true, renders as a labelled Button matching the Header nav item style.
   * Use inside the mobile Drawer. Defaults to false (icon-only IconButton).
   */
  showLabel?: boolean;
}

/**
 * The Quick Guide icon button rendered in the Header.
 * On desktop (≥ 1024px) it opens an anchored Popover with a CSS arrow.
 * On mobile it opens a full-screen Dialog that slides up.
 * Owns open/close state only — no localStorage, no badge, no tracking.
 */
export const QuickGuideIconButton = ({ showLabel = false }: QuickGuideIconButtonProps) => {
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

  const trigger = showLabel ? (
    <Button
      ref={iconRef}
      onClick={open}
      aria-label="Open quick guide"
      aria-haspopup="dialog"
      aria-expanded={isOpen}
      startIcon={<TipsAndUpdatesOutlinedIcon />}
      sx={{
        textTransform: "capitalize",
        justifyContent: "flex-start",
        "&:hover": { color: "#4845d2" },
        fontSize: "1rem",
        color: "grey",
        backgroundColor: "transparent",
      }}
    >
      Quick Guide
    </Button>
  ) : (
    <IconButton
      ref={iconRef}
      onClick={open}
      aria-label="Open quick guide"
      aria-haspopup="dialog"
      aria-expanded={isOpen}
      sx={{ "&:hover": { color: "#4845d2" } }}
    >
      <TipsAndUpdatesOutlinedIcon />
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
            <IconButton
              onClick={close}
              aria-label="Close quick guide"
              size="small"
              sx={{ position: "absolute", top: 8, right: 8, zIndex: 2 }}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
            <QuickGuidePanelContent headingId={headingId} />
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
        <AppBar sx={{ position: "relative", bgcolor: "#4845D2" }}>
          <Toolbar>
            <Typography
              id={headingId}
              variant="h6"
              fontWeight="bold"
              sx={{ flex: 1 }}
            >
              Quick Guide
            </Typography>
            <IconButton
              edge="end"
              color="inherit"
              onClick={close}
              aria-label="Close quick guide"
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
          <QuickGuidePanelContent headingId={headingId} showHeading={false} />
        </Box>
      </Dialog>
    </>
  );
};
