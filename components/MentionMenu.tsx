import { Box, Paper, MenuItem, Typography } from "@mui/material";
import { FC, useEffect, useRef } from "react";

export interface MentionItem {
  pseudonym: string;
}

interface MentionMenuProps {
  items: MentionItem[];
  selectedIndex: number;
  onSelect: (item: MentionItem) => void;
  anchorEl: HTMLElement | null;
  open: boolean;
}

export const MentionMenu: FC<MentionMenuProps> = ({
  items,
  selectedIndex,
  onSelect,
  anchorEl,
  open,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && menuRef.current) {
      const selected = menuRef.current.children[selectedIndex] as HTMLElement;
      selected?.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex, open]);

  if (!open || !anchorEl || items.length === 0) return null;

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
          <MenuItem
            key={item.pseudonym}
            selected={index === selectedIndex}
            onClick={() => onSelect(item)}
          >
            <Typography fontWeight={600}>@{item.pseudonym}</Typography>
          </MenuItem>
        ))}
      </Box>
    </Paper>
  );
};
