import { Box, Paper } from "@mui/material";
import { FC, useEffect, useRef, ReactNode } from "react";

interface GenericEnhancerMenuProps<T> {
  items: T[];
  selectedIndex: number;
  onSelect: (item: T) => void;
  renderItem: (item: T, isSelected: boolean) => ReactNode;
  getItemKey: (item: T, index: number) => string;
  anchorEl: HTMLElement | null;
  open: boolean;
}

/**
 * Generic menu component for input enhancers
 * Displays a popup menu positioned above the input field with keyboard-navigable items
 */
export const GenericEnhancerMenu = <T,>({
  items,
  selectedIndex,
  onSelect,
  renderItem,
  getItemKey,
  anchorEl,
  open,
}: GenericEnhancerMenuProps<T>): JSX.Element | null => {
  const menuRef = useRef<HTMLDivElement>(null);

  // Scroll selected item into view
  useEffect(() => {
    if (open && menuRef.current) {
      const selectedItem = menuRef.current.children[
        selectedIndex
      ] as HTMLElement;
      if (selectedItem) {
        selectedItem.scrollIntoView({
          block: "nearest",
          behavior: "smooth",
        });
      }
    }
  }, [selectedIndex, open]);

  if (!open || !anchorEl || items.length === 0) {
    return null;
  }

  // Calculate position based on anchor element
  const rect = anchorEl.getBoundingClientRect();

  return (
    <Paper
      ref={menuRef}
      elevation={8}
      sx={{
        position: "fixed",
        bottom: `${window.innerHeight - rect.top + 8}px`,
        left: rect.left,
        zIndex: 1400,
        maxHeight: 240,
        minWidth: 280,
        overflow: "auto",
        borderRadius: "8px",
        border: "1px solid",
        borderColor: "grey.300",
      }}
    >
      <Box>
        {items.map((item, index) => (
          <div
            key={getItemKey(item, index)}
            onClick={() => onSelect(item)}
            style={{ cursor: "pointer" }}
          >
            {renderItem(item, index === selectedIndex)}
          </div>
        ))}
      </Box>
    </Paper>
  );
};
