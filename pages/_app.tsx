import '../globals.css';
import type { AppProps } from 'next/app';
import Head from 'next/head';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { AppCacheProvider } from '@mui/material-nextjs/v15-pagesRouter';
import { createTheme, StyledEngineProvider, ThemeProvider } from '@mui/material';
import { Layout } from '../components';
import { ConversationTypeProvider } from '../context/ConversationTypeContext';
import SessionManager from '../utils/SessionManager';
import { validateEnv } from '../utils/validateEnv';
import { useSessionTracking } from '../hooks/useAnalytics';
import { AuthType } from '../types.internal';
import { isTokenPage } from '../utils/tokenPrivacy';

// Pages that don't require session creation
// Add more pages here as needed (e.g., "/about", "/privacy", "/terms")
const SESSION_BLOCKLIST = [
  '/', // Home page
  '/_error', // Error page
  '/404', // 404 page
  '/login', // Login page
  '/signup', // Signup page
  '/logout',
  '/forgot-password',
];

/**
 * Check if current route should skip session creation
 */
function shouldSkipSession(pathname: string): boolean {
  // Mail scanners open emailed links before the person does, and each visit would otherwise create a guest account.
  return SESSION_BLOCKLIST.includes(pathname) || isTokenPage(pathname);
}

// Validate environment variables on app initialization
if (typeof window === 'undefined') {
  try {
    validateEnv();
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Environment validation failed');
    throw error;
  }
}

export default function App({ Component, pageProps }: AppProps) {
  const [sessionReady, setSessionReady] = useState(false);
  const router = useRouter();

  // Track session-level analytics
  useSessionTracking();

  const theme = createTheme({
    typography: {
      fontFamily: ['Inter Variable', 'sans-serif'].join(','),
    },
    components: {
      // Colors come from CSS variables so the presentation view's dark theme can change them; the
      // light values in globals.css are MUI's defaults, so every other page looks the same.
      MuiButton: {
        styleOverrides: {
          root: ({ ownerState }) => {
            if (ownerState.color === 'error' && ownerState.variant !== 'contained') {
              return { color: 'var(--nx-button-error-text)' };
            }
            if (ownerState.color !== 'primary') return {};
            if (ownerState.variant === 'contained') {
              return {
                backgroundColor: 'var(--nx-button-contained-bg)',
                color: 'var(--nx-button-contained-fg)',
                '&:hover': { backgroundColor: 'var(--nx-button-contained-hover-bg)' },
              };
            }
            if (ownerState.variant === 'outlined') {
              return { color: 'var(--nx-button-text)', borderColor: 'var(--nx-button-outline-border)' };
            }
            return { color: 'var(--nx-button-text)' };
          },
        },
      },
      MuiIconButton: {
        styleOverrides: {
          root: ({ ownerState }) =>
            ownerState.color === 'default' || ownerState.color === undefined
              ? { color: 'var(--nx-icon-button)', '&:hover': { backgroundColor: 'var(--nx-icon-button-hover)' } }
              : {},
        },
      },
    },
  });

  // Restore or create session on app initialization (once)
  useEffect(() => {
    const initSession = async () => {
      const skipCreation = shouldSkipSession(router.pathname);

      if (skipCreation) {
        console.log(`Skipping session creation for ${router.pathname}`);
      }

      // Always try to restore existing session, but skip creation on blocklisted pages
      try {
        await SessionManager.get().restoreSession({ skipCreation });
      } catch (error) {
        console.error('Session initialization failed:', error);
      }
      setSessionReady(true);
    };

    initSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run once on mount

  // Show loading state while restoring session
  if (!sessionReady) {
    return (
      <AppCacheProvider>
        <ThemeProvider theme={theme}>
          <ConversationTypeProvider>
            <Layout authType={(pageProps.authType as AuthType) || 'guest'}>
              <Head>
                <title>NextSpace</title>
              </Head>
              <div className="flex items-center justify-center h-screen">
                <svg className="mx-auto w-12 h-5" viewBox="0 0 40 10" fill="currentColor">
                  <circle className="animate-bounce fill-sky-400" cx="5" cy="5" r="4" />
                  <circle className="animate-bounce [animation-delay:-0.2s] fill-medium-slate-blue" cx="20" cy="5" r="4" />
                  <circle className="animate-bounce [animation-delay:-0.4s] fill-purple-500" cx="35" cy="5" r="4" />
                </svg>
              </div>
            </Layout>
          </ConversationTypeProvider>
        </ThemeProvider>
      </AppCacheProvider>
    );
  }

  return (
    <AppCacheProvider>
      <ThemeProvider theme={theme}>
        <ConversationTypeProvider>
          <Layout authType={(pageProps.authType as AuthType) || 'guest'}>
            <Head>
              <title>NextSpace</title>
            </Head>
            <StyledEngineProvider injectFirst>
              <Component {...pageProps} />
            </StyledEngineProvider>
          </Layout>
        </ConversationTypeProvider>
      </ThemeProvider>
    </AppCacheProvider>
  );
}
