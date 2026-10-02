import React, { useCallback, useEffect, useRef, useState } from 'react';
import Head from 'next/head';
import NextLink from 'next/link';
import { useRouter } from 'next/router';
import { PasswordForm } from '../components/PasswordForm';
import { RoomMarkIcon } from '../components/room/RoomMarkIcon';
import { roomFontVariables } from '../components/room/roomFonts';
import styles from '../components/room/communityRoom.module.css';
import { useQueryToken } from '../hooks/useQueryToken';
import { ConsumeInvite, GetInvite, ResendInvite } from '../utils/Api';
import { Api } from '../utils/Helpers';
import SessionManager from '../utils/SessionManager';
import { AuthType, InviteDetails, InviteSession } from '../types.internal';

const GENERIC_ERROR = 'Something went wrong. Check your connection and try again.';
const CONTACT_ORGANIZERS = 'If nothing arrives in a few minutes, reach out to the organizers for a new link.';

type Screen = 'checking' | 'form' | 'incomplete' | 'load-error' | 'dead' | 'name-taken';

/**
 * Saves the tokens and session cookie the same way the login page does.
 * @returns false when the session could not be saved; the invite is already used up by then.
 */
const startSession = async ({ user, tokens }: InviteSession): Promise<boolean> => {
  const activePseudonym = user.pseudonyms.find((pseudonym) => pseudonym.active)?.pseudonym;
  if (!activePseudonym) {
    console.error('Invite accepted, but the account has no active pseudonym to start a session with.');
    return false;
  }

  Api.get().SetTokens(tokens.access.token, tokens.refresh.token, tokens.access.expires, tokens.refresh.expires, user.id);

  try {
    const response = await fetch('/api/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: activePseudonym,
        userId: user.id,
        accessToken: tokens.access.token,
        refreshToken: tokens.refresh.token,
        accessExpires: tokens.access.expires,
        refreshExpires: tokens.refresh.expires,
        // The server looks up whether this account is an admin, so only ask for a logged-in session.
        authType: 'user',
      }),
    });
    if (!response.ok) {
      console.error(`Invite accepted, but saving the session failed with status ${response.status}`);
      return false;
    }

    const savedSession = await response.json();
    const authType: AuthType = savedSession.authType === 'admin' ? 'admin' : 'user';
    SessionManager.get().markAuthenticated(activePseudonym, user.id, authType);
    return true;
  } catch (error) {
    console.error('Invite accepted, but saving the session failed:', error instanceof Error ? error.message : error);
    return false;
  }
};

/** A heading that takes focus when it appears, so a screen reader hears that the form was replaced. */
function NoticeHeading({ children }: { children: React.ReactNode }) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => headingRef.current?.focus(), []);
  return (
    <h2 ref={headingRef} tabIndex={-1} className={styles.inviteHeading}>
      {children}
    </h2>
  );
}

function DeadLinkNotice({ token }: { token: string | null }) {
  const [resendState, setResendState] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle');
  const statusRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (resendState === 'sent') statusRef.current?.focus();
  }, [resendState]);

  const requestNewLink = async () => {
    if (!token || resendState === 'sending' || resendState === 'sent') return;
    setResendState('sending');
    const result = await ResendInvite(token);
    setResendState(result.status === 'accepted' ? 'sent' : 'failed');
  };

  return (
    <>
      <NoticeHeading>This invite link has expired</NoticeHeading>
      <p className={styles.inviteText}>Invite links work once and expire after 14 days. We can email you a new one.</p>
      <button
        type="button"
        className={styles.invitePrimaryButton}
        onClick={requestNewLink}
        disabled={!token || resendState === 'sending' || resendState === 'sent'}
      >
        Send me a new link
      </button>
      {resendState === 'failed' && (
        <p role="alert" className={styles.inviteError}>
          We couldn&apos;t send your request. Check your connection and try again.
        </p>
      )}
      {resendState === 'sent' && (
        <p ref={statusRef} tabIndex={-1} role="status" className={styles.inviteStatus}>
          If this link was valid, we&apos;ve sent a new one to the address it came to.
        </p>
      )}
      <p className={styles.inviteHint}>{CONTACT_ORGANIZERS}</p>
      {resendState === 'sent' && (
        <p className={styles.inviteText}>
          Already joined? Go to{' '}
          <NextLink href="/login" className={styles.inviteLink}>
            log in
          </NextLink>{' '}
          instead.
        </p>
      )}
    </>
  );
}

/**
 * Invite Page
 *
 * Landing page for the link in a community room invite email. The backend builds that link as `/invite?token=...`,
 * so this path and parameter name must not change on their own. Mail scanners open the link before the person does,
 * so loading the page only checks the invite; nothing is used up until the password is submitted.
 */
export default function InvitePage() {
  const router = useRouter();
  const tokenState = useQueryToken();
  const token = tokenState.status === 'present' ? tokenState.token : null;
  const [screen, setScreen] = useState<Screen>('checking');
  const [invite, setInvite] = useState<InviteDetails | null>(null);
  // Every check of the invite replaces its nonce, so a submit must send the one from the latest check.
  const nonceRef = useRef<string | null>(null);

  const checkInvite = useCallback(
    async (isCancelled: () => boolean = () => false) => {
      if (!token) return;
      setScreen('checking');
      const result = await GetInvite(token);
      if (isCancelled()) return;

      if (result.status === 'valid') {
        nonceRef.current = result.invite.nonce;
        setInvite(result.invite);
        setScreen('form');
        return;
      }
      setScreen(result.status === 'error' ? 'load-error' : result.status);
    },
    [token],
  );

  useEffect(() => {
    if (tokenState.status === 'missing') setScreen('incomplete');
    if (tokenState.status !== 'present') return;

    let cancelled = false;
    checkInvite(() => cancelled);
    return () => {
      cancelled = true;
    };
  }, [tokenState.status, checkInvite]);

  const handleSubmit = async (password: string): Promise<string | void> => {
    if (!token || !nonceRef.current) return GENERIC_ERROR;

    let result = await ConsumeInvite(token, nonceRef.current, password);
    if (result.status === 'stale-nonce') {
      const refreshed = await GetInvite(token);
      if (refreshed.status === 'dead') {
        setScreen('dead');
        return;
      }
      if (refreshed.status !== 'valid') return GENERIC_ERROR;
      nonceRef.current = refreshed.invite.nonce;
      result = await ConsumeInvite(token, refreshed.invite.nonce, password);
    }

    switch (result.status) {
      case 'success': {
        const roomPath = `/room/${result.session.conversationId}`;
        const sessionStarted = await startSession(result.session);
        // The invite is used up by now, so if the session can't be saved the person logs in normally instead.
        router.push(sessionStarted ? roomPath : `/login?redirectTo=${encodeURIComponent(roomPath)}`);
        return;
      }
      case 'wrong-password':
        return 'That password is incorrect.';
      case 'name-taken':
        setScreen('name-taken');
        return;
      case 'dead':
        setScreen('dead');
        return;
      default:
        return GENERIC_ERROR;
    }
  };

  const roomName = invite?.conversation.name;

  const renderContent = () => {
    switch (screen) {
      case 'checking':
        return (
          <p role="status" className={styles.inviteText}>
            Checking your invite…
          </p>
        );
      case 'incomplete':
        return (
          <>
            <NoticeHeading>This link is incomplete</NoticeHeading>
            <p className={styles.inviteText}>
              Open the link from your invite email again, or copy the whole address into your browser.
            </p>
          </>
        );
      case 'load-error':
        return (
          <>
            <NoticeHeading>We couldn&apos;t open your invite</NoticeHeading>
            <p className={styles.inviteText}>Check your connection, then try again.</p>
            <button type="button" className={styles.invitePrimaryButton} onClick={() => checkInvite()}>
              Try again
            </button>
          </>
        );
      case 'dead':
        return <DeadLinkNotice token={token} />;
      case 'name-taken':
        return (
          <>
            <NoticeHeading>We couldn&apos;t finish setting up your account</NoticeHeading>
            <p className={styles.inviteText}>
              Someone else in {roomName} is listed under the same name as you. Please reach out to the organizers so they can
              fix the name, then open this invite link again.
            </p>
          </>
        );
      case 'form':
        if (!invite) return null;
        if (invite.member.hasAccount) {
          return (
            <>
              <PasswordForm
                purpose="current"
                heading={`Log in to join ${roomName}.`}
                submitLabel="Log in and join"
                onSubmit={handleSubmit}
              />
              <p className={styles.inviteForgot}>
                <NextLink href="/forgot-password" className={styles.inviteLink}>
                  Forgot password?
                </NextLink>
              </p>
            </>
          );
        }
        return (
          <PasswordForm
            heading={`Welcome to ${roomName}. Choose a password.`}
            intro="Next time you log in, use the email address this invite was sent to as your username."
            submitLabel="Join the room"
            onSubmit={handleSubmit}
          />
        );
    }
  };

  return (
    <div className={styles.root} style={{ minHeight: '100vh', ...roomFontVariables }}>
      <Head>
        <title>{roomName ? `Join ${roomName}` : 'Your invite'}</title>
        <meta name="referrer" content="no-referrer" />
      </Head>
      <header className={styles.header}>
        <div className={styles.headerLead}>
          <div className={styles.headerTitleGroup}>
            <span aria-hidden="true" className={styles.headerIcon}>
              <RoomMarkIcon />
            </span>
            <h1 className={styles.headerTitle}>{roomName ?? 'Community Room'}</h1>
          </div>
        </div>
      </header>
      <div className={styles.invite}>
        <div className={styles.inviteCard}>{renderContent()}</div>
      </div>
    </div>
  );
}
