import { FC, useState, useCallback, useEffect, useRef } from "react";
import { Dialog, IconButton, Box } from "@mui/material";
import { Close as CloseIcon } from "@mui/icons-material";
import { MarkmapView } from "./MarkmapView";

// Store the original viewport content
let originalViewportContent = "";

interface MediaLightboxProps {
  open: boolean;
  onClose: () => void;
  mediaType: "image" | "mindmap";
  mediaSrc: string;
  mimeType?: string;
  isMobile: boolean;
}

const ZOOM_STEP = 0.5;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 4;

export const MediaLightbox: FC<MediaLightboxProps> = ({
  open,
  onClose,
  mediaType,
  mediaSrc,
  mimeType,
  isMobile,
}) => {
  const [zoomLevel, setZoomLevel] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const imageRef = useRef<HTMLImageElement>(null);

  // Reset zoom and position when opening/closing
  // Also prevent viewport zoom on mobile
  useEffect(() => {
    if (open) {
      setZoomLevel(1);
      setPosition({ x: 0, y: 0 });

      // On mobile, disable viewport zoom to prevent the page from staying zoomed
      if (isMobile) {
        const viewportMeta = document.querySelector('meta[name="viewport"]');
        if (viewportMeta) {
          originalViewportContent = viewportMeta.getAttribute("content") || "";
          viewportMeta.setAttribute(
            "content",
            "width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no",
          );
        }
      }
    } else {
      // Restore original viewport settings when closing
      if (isMobile && originalViewportContent) {
        const viewportMeta = document.querySelector('meta[name="viewport"]');
        if (viewportMeta) {
          viewportMeta.setAttribute("content", originalViewportContent);
        }
      }
    }
  }, [open, isMobile]);

  const handleZoomIn = useCallback(() => {
    setZoomLevel((prev) => Math.min(prev + ZOOM_STEP, MAX_ZOOM));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoomLevel((prev) => Math.max(prev - ZOOM_STEP, MIN_ZOOM));
  }, []);

  const handleReset = useCallback(() => {
    setZoomLevel(1);
    setPosition({ x: 0, y: 0 });
  }, []);

  // Mouse wheel zoom
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      if (mediaType !== "image") return;
      e.preventDefault();
      const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
      setZoomLevel((prev) =>
        Math.max(MIN_ZOOM, Math.min(prev + delta, MAX_ZOOM)),
      );
    },
    [mediaType],
  );

  // Pan functionality
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (mediaType !== "image" || zoomLevel <= 1) return;
      setIsDragging(true);
      setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    },
    [mediaType, zoomLevel, position],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDragging) return;
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    },
    [isDragging, dragStart],
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Keyboard controls
  useEffect(() => {
    if (!open || mediaType !== "image") return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "+" || e.key === "=") {
        handleZoomIn();
      } else if (e.key === "-" || e.key === "_") {
        handleZoomOut();
      } else if (e.key === "0") {
        handleReset();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, mediaType, onClose, handleZoomIn, handleZoomOut, handleReset]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullScreen={isMobile}
      maxWidth={false}
      aria-labelledby="media-lightbox-title"
      aria-describedby="media-lightbox-description"
      slotProps={{
        paper: {
          sx: {
            backgroundColor: "rgba(0, 0, 0, 0.95)",
            ...(isMobile
              ? {}
              : mediaType === "mindmap"
                ? {
                    width: "95vw",
                    height: "90vh",
                    margin: "auto",
                  }
                : {
                    maxWidth: "90vw",
                    maxHeight: "90vh",
                    margin: "auto",
                  }),
          },
        },
      }}
    >
      {/* Close button */}
      <IconButton
        onClick={onClose}
        aria-label="Close lightbox"
        sx={{
          position: "absolute",
          bottom: 24,
          right: 16,
          color: "white",
          zIndex: 1,
          backgroundColor: "rgba(0, 0, 0, 0.5)",
          "&:hover": {
            backgroundColor: "rgba(0, 0, 0, 0.7)",
          },
        }}
      >
        <CloseIcon />
      </IconButton>

      {/* Content */}
      <Box
        sx={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          position: "relative",
        }}
      >
        {mediaType === "image" ? (
          <>
            {/* Image container */}
            <Box
              sx={{
                flex: 1,
                width: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
                cursor:
                  zoomLevel > 1
                    ? isDragging
                      ? "grabbing"
                      : "grab"
                    : "default",
              }}
              onWheel={handleWheel}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            >
              <img
                ref={imageRef}
                src={mediaSrc}
                alt="Visual response"
                style={{
                  maxWidth: zoomLevel === 1 ? "100%" : "none",
                  maxHeight: zoomLevel === 1 ? "100%" : "none",
                  transform: `scale(${zoomLevel}) translate(${position.x / zoomLevel}px, ${
                    position.y / zoomLevel
                  }px)`,
                  transition: isDragging ? "none" : "transform 0.2s ease-out",
                  touchAction: "pan-x pan-y pinch-zoom",
                  userSelect: "none",
                }}
              />
            </Box>

            {/* Zoom controls */}
            <Box
              sx={{
                position: "absolute",
                bottom: 24,
                left: "50%",
                transform: "translateX(-50%)",
                display: "flex",
                gap: 1,
                backgroundColor: "rgba(0, 0, 0, 0.7)",
                padding: "8px 12px",
                borderRadius: "24px",
              }}
            >
              <button
                onClick={handleZoomOut}
                disabled={zoomLevel <= MIN_ZOOM}
                className="px-3 py-1 text-sm rounded bg-gray-700 hover:bg-gray-600 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Zoom out"
              >
                −
              </button>
              <button
                onClick={handleReset}
                className="px-3 py-1 text-sm rounded bg-gray-700 hover:bg-gray-600 text-white"
                aria-label="Reset zoom"
              >
                {Math.round(zoomLevel * 100)}%
              </button>
              <button
                onClick={handleZoomIn}
                disabled={zoomLevel >= MAX_ZOOM}
                className="px-3 py-1 text-sm rounded bg-gray-700 hover:bg-gray-600 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Zoom in"
              >
                +
              </button>
            </Box>
          </>
        ) : (
          // Mindmap
          <Box
            sx={{
              width: "100%",
              height: "100%",
              padding: isMobile ? 0.5 : 1,
              paddingTop: isMobile ? 0.5 : 1,
              overflow: "auto",
            }}
          >
            <MarkmapView markdown={mediaSrc} fullscreen />
          </Box>
        )}
      </Box>
    </Dialog>
  );
};
