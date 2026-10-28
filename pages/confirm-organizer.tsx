import React, { useCallback, useEffect, useRef, useState } from 'react';
import Head from 'next/head';
import { Alert, Box, Button, Paper, Typography } from '@mui/material';
import { useQueryToken } from '../hooks/useQueryToken';
import { ConfirmOrganizer, GetOrganizerConfirmation } from '../utils/Api';
import { OrganizerConfirmationDetails, OrganizerConfirmed } from '../types.internal';

const GENERIC_ERROR = "We couldn't confirm you as the organizer. Check your connection and try again.";

type Screen = 'checking' | 'confirm' | 'confirmed' | 'incomplete' | 'load-error' | 'dead';

// Short date-time without seconds, e.g. "10/23/2025, 4:00 PM". Matches Event/Status.tsx's format.
const formatDateTime = (isoString?: string) =>
  isoString
    ? new Date(isoString).toLocaleString([], {
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : null;

/**
 * A heading that takes focus when it appears, so a screen reader hears that the page's content
 * changed. Needed because clicking Confirm (or Try again) unmounts the button that held focus,
 * which would otherwise silently drop focus to the document body.
 */
function NoticeHeading({ children }: { children: React.ReactNode }) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => headingRef.current?.focus(), []);
  return (
    <Typography
      ref={headingRef}
      tabIndex={-1}
      variant="h5"
      component="h2"
      gutterBottom
      sx={{ textAlign: 'center', outline: 'none' }}
    >
      {children}
    </Typography>
  );
}

/**
 * Confirm Organizer Page
 *
 * Landing page for the link emailed when a relayed calendar invite can't fully trust who the
 * organizer is from the email alone (Zoom itself never verifies its Reply-To header). The backend
 * builds that link as `/confirm-organizer?token=...`, so this path and parameter name must not
 * change on their own. Mail scanners (Proofpoint, Safe Links) open the link before the person does,
 * so loading the page only checks the link; nothing is confirmed until the button is clicked.
 */
export default function ConfirmOrganizerPage() {
  const tokenState = useQueryToken();
  const token = tokenState.status === 'present' ? tokenState.token : null;
  const [screen, setScreen] = useState<Screen>('checking');
  const [confirmation, setConfirmation] = useState<OrganizerConfirmationDetails | null>(null);
  const [confirmed, setConfirmed] = useState<OrganizerConfirmed | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  // Every check replaces the nonce, so a submit must send the one from the latest check.
  const nonceRef = useRef<string | null>(null);
  // Bumped when a check starts and when the page unmounts, so a slow check can't overwrite a newer one.
  const latestCheckRef = useRef(0);

  const checkConfirmation = useCallback(async () => {
    if (!token) return;
    const checkId = ++latestCheckRef.current;
    setScreen('checking');
    const result = await GetOrganizerConfirmation(token);
    if (checkId !== latestCheckRef.current) return;

    if (result.status === 'valid') {
      nonceRef.current = result.confirmation.nonce;
      setConfirmation(result.confirmation);
      setScreen('confirm');
      return;
    }
    setScreen(result.status === 'error' ? 'load-error' : result.status);
  }, [token]);

  useEffect(() => {
    if (tokenState.status === 'missing') setScreen('incomplete');
    if (tokenState.status !== 'present') return;

    checkConfirmation();
    return () => {
      latestCheckRef.current += 1;
    };
  }, [tokenState.status, checkConfirmation]);

  const handleConfirm = async () => {
    if (!token || !nonceRef.current) return;
    setSubmitting(true);
    setSubmitError(null);

    let result = await ConfirmOrganizer(token, nonceRef.current);
    if (result.status === 'stale-nonce') {
      const refreshed = await GetOrganizerConfirmation(token);
      if (refreshed.status === 'dead') {
        setScreen('dead');
        setSubmitting(false);
        return;
      }
      if (refreshed.status !== 'valid') {
        setSubmitting(false);
        setSubmitError(GENERIC_ERROR);
        return;
      }
      nonceRef.current = refreshed.confirmation.nonce;
      setConfirmation(refreshed.confirmation);
      result = await ConfirmOrganizer(token, refreshed.confirmation.nonce);
    }

    setSubmitting(false);
    switch (result.status) {
      case 'success':
        setConfirmed(result.result);
        setScreen('confirmed');
        return;
      case 'dead':
        setScreen('dead');
        return;
      default:
        setSubmitError(GENERIC_ERROR);
    }
  };

  const renderContent = () => {
    switch (screen) {
      case 'checking':
        return (
          <Typography variant="body1" role="status" sx={{ textAlign: 'center' }}>
            Checking your confirmation link…
          </Typography>
        );
      case 'incomplete':
        return (
          <>
            <NoticeHeading>This link is incomplete</NoticeHeading>
            <Alert severity="warning">
              Open the link from your confirmation email again, or copy the whole address into your browser.
            </Alert>
          </>
        );
      case 'load-error':
        return (
          <>
            <NoticeHeading>We couldn&apos;t open your confirmation link</NoticeHeading>
            <Alert severity="error" sx={{ mb: 3 }}>
              Check your connection, then try again.
            </Alert>
            <Box sx={{ textAlign: 'center' }}>
              <Button variant="outlined" onClick={checkConfirmation} sx={{ width: 300, maxWidth: '100%' }}>
                Try again
              </Button>
            </Box>
          </>
        );
      case 'dead':
        return (
          <>
            <NoticeHeading>This link isn&apos;t valid</NoticeHeading>
            <Alert severity="warning">
              If you already confirmed this event, you&apos;re all set. If not, this link has expired. Send the meeting
              invitation again to set the event up from scratch.
            </Alert>
          </>
        );
      case 'confirmed':
        return (
          <>
            <NoticeHeading>You&apos;re confirmed as the organizer</NoticeHeading>
            {confirmed?.draft ? (
              <Alert severity="info">
                This event still needs a few more details filled in before it can go live. Check your email for next steps.
              </Alert>
            ) : (
              <Alert severity="success">This event is ready to go.</Alert>
            )}
          </>
        );
      case 'confirm': {
        if (!confirmation) return null;
        const { name, scheduledTime } = confirmation.conversation;
        const when = formatDateTime(scheduledTime);
        return (
          <>
            <Typography variant="h5" component="h2" gutterBottom sx={{ textAlign: 'center' }}>
              Confirm you&apos;re hosting &ldquo;{name}&rdquo;{when ? ` on ${when}` : ''}?
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', mb: 3 }}>
              This event was created from a calendar invite, so we need you to confirm you&apos;re really the organizer
              before it can go live.
            </Typography>
            {submitError && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {submitError}
              </Alert>
            )}
            <Box sx={{ textAlign: 'center' }}>
              <Button
                variant="contained"
                onClick={handleConfirm}
                disabled={submitting}
                sx={{ width: 300, maxWidth: '100%' }}
              >
                Confirm
              </Button>
            </Box>
          </>
        );
      }
    }
  };

  return (
    <>
      <Head>
        <title>Confirm organizer | NextSpace</title>
        <meta name="referrer" content="no-referrer" />
      </Head>
      <Paper elevation={3} sx={{ p: { xs: 2, sm: 4 }, maxWidth: 600, mx: { xs: 2, sm: 'auto' }, mt: { xs: 2, sm: 4 } }}>
        {renderContent()}
      </Paper>
    </>
  );
}
