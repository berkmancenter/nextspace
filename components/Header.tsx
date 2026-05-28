'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';

import { HeaderProps } from '../types.internal';

import { Box, Button, Drawer, IconButton, List, Toolbar } from '@mui/material';
import { Close, Menu } from '@mui/icons-material';

import Logo from './Logo';
import { QuickGuideIconButton } from './QuickGuideIconButton';

// Admin pages navigation items (without Log In/Log Out - added dynamically)
const adminPagesBase: Record<string, { url: string }> = {
  'Event Schedule': { url: '/admin/events' },
  'Schedule an Event': { url: '/admin/events/new' },
};

/**
 * Header component
 *
 * This component renders the header for the app.
 * @param {object} props
 * @property {string} className - Optional Tailwind classes for styling.
 * @property {string} variant - The variant of the header, either "transparent" or "solid".
 * @property {AuthType} authType - The authentication type of the current user.
 * @returns A React component for the header.
 */
export const Header = ({ className = '', variant = 'transparent', authType = 'guest' }: HeaderProps) => {
  const variantStyles = {
    transparent: 'flex-end bg-transparent shadow-none',
    solid: 'flex-end bg-header bg-transparent bg-cover bg-center bg-no-repeat shadow-none',
  };
  const router = useRouter();
  const [open, setOpen] = useState(false);

  // Check if current route starts with /admin
  const isAdminRoute = router.pathname.startsWith('/admin');

  // Build pages based on authType
  let currentPages: Record<string, { url: string }>;

  if (authType === 'admin') {
    // Admin users see admin pages; Give Feedback + Log Out rendered after Quick Guide
    currentPages = { ...adminPagesBase };
  } else if (authType === 'user') {
    // Regular logged-in users; Give Feedback + Log Out rendered after Quick Guide
    currentPages = {};
  } else {
    // Guest users: show login button only on admin routes
    currentPages = {
      ...(isAdminRoute && {
        'Log In': { url: '/login' },
      }),
    };
  }

  const isLoggedIn = authType === 'admin' || authType === 'user';

  /* Shared button style for nav items rendered explicitly after Quick Guide */
  const navButtonSx = {
    textTransform: 'capitalize' as const,
    '&:hover': { color: '#4845d2' },
    fontSize: '1rem',
    color: 'black',
    backgroundColor: 'transparent',
  };

  const giveFeedbackUrl =
    'https://docs.google.com/forms/d/e/1FAIpQLScVXBLSEJ5YVJtW8rwR01KDunJWnopN33Rs49YUC37OPrOgCg/viewform';

  const isOnAssistantPage = router.asPath.includes('conversationId');

  const TrailingNavItems = () => (
    <>
      {isOnAssistantPage && (
        <div>
          <Button
            onClick={() => router.push({ pathname: router.pathname, query: { ...router.query, view: 'preferences' } })}
            sx={navButtonSx}
          >
            Preferences
          </Button>
        </div>
      )}
      <Link href={giveFeedbackUrl} target="_blank" rel="noopener noreferrer">
        <Button sx={navButtonSx}>Give Feedback</Button>
      </Link>
      {isLoggedIn && (
        <Link href="/logout">
          <Button sx={navButtonSx}>Log Out</Button>
        </Link>
      )}
    </>
  );

  const toggleDrawer = (newOpen: boolean) => () => {
    setOpen(newOpen);
  };

  const NavItems = () => {
    return Object.keys(currentPages)
      .map((pageName) => {
        const pageData = currentPages[pageName];

        // Guard against undefined/invalid page data
        if (!pageData.url) {
          console.warn(`Navigation item "${pageName}" has no URL`);
          return null;
        }

        const isExternalLink = pageData.url.startsWith('http');
        return (
          <Link
            href={pageData.url}
            key={pageName}
            target={isExternalLink ? '_blank' : undefined}
            rel={isExternalLink ? 'noopener noreferrer' : undefined}
          >
            <Button
              sx={{
                textTransform: 'capitalize',
                '&:hover': { color: '#4845d2' },
                fontSize: '1rem',
                color: 'black',
                backgroundColor: 'transparent',
              }}
            >
              {pageName}
            </Button>
          </Link>
        );
      })
      .filter((item) => item !== null);
  };

  return (
    <div className={`${className} ${variantStyles[variant]}`}>
      <Toolbar className="flex flex-row items-center justify-around w-full px-4 lg:px-8 h-14">
        <div className="flex flex-row items-center">
          <Logo className="mr-3" />
          <h1 className="text-2xl font-bold py-7">NextSpace</h1>
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
              {router.asPath.includes('conversationId') && <QuickGuideIconButton showLabel />}
              <TrailingNavItems />
            </List>
          </Drawer>
        </div>
        <div className="hidden lg:flex flex-row justify-end grow-1 gap-x-6 items-center">
          {NavItems()}
          {router.asPath.includes('conversationId') && <QuickGuideIconButton showLabel />}
          <TrailingNavItems />
        </div>
      </Toolbar>
    </div>
  );
};
