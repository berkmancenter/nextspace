'use client';
import React from 'react';
import { Button, IconButton } from '@mui/material';
import TipsAndUpdatesOutlinedIcon from '@mui/icons-material/TipsAndUpdatesOutlined';
import { useRouter } from 'next/router';

interface QuickGuideIconButtonProps {
  /**
   * When true, renders as a labelled Button matching the Header nav item style.
   * Use inside the mobile Drawer. Defaults to false (icon-only IconButton).
   */
  showLabel?: boolean;
}

/**
 * Opens the Quick Guide for the current event in a new tab.
 * Reads conversationId from the router query — only render this on event pages.
 */
export const QuickGuideIconButton = ({ showLabel = false }: QuickGuideIconButtonProps) => {
  const router = useRouter();
  const conversationId = router.query.conversationId as string;
  const href = `/guide/${conversationId}`;

  if (showLabel) {
    return (
      <Button
        component="a"
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        startIcon={<TipsAndUpdatesOutlinedIcon />}
        sx={{
          textTransform: 'capitalize',
          justifyContent: 'flex-start',
          '&:hover': { color: '#4845d2' },
          fontSize: '1rem',
          color: 'grey',
          backgroundColor: 'transparent',
        }}
      >
        Quick Guide
      </Button>
    );
  }

  return (
    <IconButton
      component="a"
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Open quick guide"
      sx={{ '&:hover': { color: '#4845d2' } }}
    >
      <TipsAndUpdatesOutlinedIcon />
    </IconButton>
  );
};
