import React, { FormEvent, useEffect, useRef, useState } from 'react';
import Head from 'next/head';
import NextLink from 'next/link';
import { Box, Button, Paper, TextField, Typography } from '@mui/material';
import { RequestPasswordReset } from '../utils/Api';

const CONNECTION_ERROR = "We couldn't send your request. Check your connection and try again.";

/**
 * Forgot Password Page
 *
 * Sends a password reset email. The confirmation never says whether an account uses the address, so the page
 * can't be used to find out who has an account.
 */
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);
  const confirmationRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (sent) confirmationRef.current?.focus();
  }, [sent]);

  const showError = (message: string) => {
    setError(message);
    emailRef.current?.focus();
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      showError('Enter your email address.');
      return;
    }

    setError(null);
    setSending(true);
    const result = await RequestPasswordReset(trimmedEmail);
    setSending(false);

    if (result.status === 'sent') setSent(true);
    else if (result.status === 'invalid-email') showError('Enter a valid email address.');
    else showError(CONNECTION_ERROR);
  };

  return (
    <>
      <Head>
        <title>Forgot password | NextSpace</title>
      </Head>
      <Paper elevation={3} sx={{ p: { xs: 2, sm: 4 }, maxWidth: 600, mx: { xs: 2, sm: 'auto' }, mt: { xs: 2, sm: 4 } }}>
        <Typography variant="h5" component="h2" gutterBottom sx={{ textAlign: 'center' }}>
          Forgot your password?
        </Typography>

        {sent ? (
          <>
            <Typography ref={confirmationRef} tabIndex={-1} role="status" sx={{ mb: 1, outline: 'none' }}>
              If an account uses that address, we&apos;ve sent it a link to choose a new password.
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              If nothing arrives in a few minutes, check your spam folder.
            </Typography>
            <Box sx={{ textAlign: 'center' }}>
              <Button component={NextLink} href="/login" variant="outlined" sx={{ width: 300, maxWidth: '100%' }}>
                Back to log in
              </Button>
            </Box>
          </>
        ) : (
          <Box component="form" noValidate onSubmit={handleSubmit}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2, textAlign: 'center' }}>
              Enter the email address for your account and we&apos;ll send you a link to choose a new password.
            </Typography>

            <TextField
              label="Email address"
              name="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              error={Boolean(error)}
              fullWidth
              margin="normal"
              inputRef={emailRef}
              slotProps={{
                htmlInput: { 'aria-describedby': error ? 'forgot-password-error' : undefined, 'aria-required': true },
              }}
            />

            {error && (
              <Typography id="forgot-password-error" role="alert" variant="body2" color="error" sx={{ mt: 1 }}>
                {error}
              </Typography>
            )}

            <Box sx={{ mt: 4, textAlign: 'center' }}>
              <Button type="submit" variant="outlined" disabled={sending} sx={{ width: 300, maxWidth: '100%' }}>
                Send reset link
              </Button>
            </Box>
          </Box>
        )}
      </Paper>
    </>
  );
}
