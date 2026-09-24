import React, { useState } from 'react';
import Head from 'next/head';
import NextLink from 'next/link';
import { useRouter } from 'next/router';
import { Alert, Button, Paper, Typography } from '@mui/material';
import { PasswordForm } from '../components/PasswordForm';
import { useQueryToken } from '../hooks/useQueryToken';
import { ResetPassword } from '../utils/Api';

const GENERIC_ERROR = "We couldn't reset your password. Check your connection and try again.";

/**
 * Reset Password Page
 *
 * Landing page for the link in a password reset email. The backend builds that link as
 * `/reset-password?token=...`, so this path and parameter name must not change on their own.
 */
export default function ResetPasswordPage() {
  const router = useRouter();
  const tokenState = useQueryToken();
  const [tokenRejected, setTokenRejected] = useState(false);

  const handleSubmit = async (password: string) => {
    if (tokenState.status !== 'present') return;

    const result = await ResetPassword(tokenState.token, password);
    switch (result.status) {
      case 'success':
        router.push('/login?passwordReset=1');
        return;
      case 'invalid-token':
        setTokenRejected(true);
        return;
      case 'rejected':
        return result.message;
      case 'error':
        return GENERIC_ERROR;
    }
  };

  const renderContent = () => {
    if (tokenState.status === 'loading') return null;

    if (tokenState.status === 'missing' || tokenRejected) {
      return (
        <>
          <Typography variant="h5" component="h1" gutterBottom>
            Reset your password
          </Typography>
          <Alert severity="warning" sx={{ mb: 3 }}>
            {tokenRejected
              ? 'This link has expired or has already been used. Reset links work once and expire after a short time.'
              : 'This link is incomplete. Open the link from your password reset email again, or copy the whole address into your browser.'}
          </Alert>
          <Button component={NextLink} href="/login" variant="outlined" sx={{ width: { xs: '100%', sm: 'auto' } }}>
            Go to log in
          </Button>
        </>
      );
    }

    return <PasswordForm heading="Choose a new password" submitLabel="Reset password" onSubmit={handleSubmit} />;
  };

  return (
    <>
      <Head>
        <title>Reset password | NextSpace</title>
        <meta name="referrer" content="no-referrer" />
      </Head>
      <Paper elevation={3} sx={{ p: { xs: 2, sm: 4 }, maxWidth: 600, mx: { xs: 2, sm: 'auto' }, mt: { xs: 2, sm: 4 } }}>
        {renderContent()}
      </Paper>
    </>
  );
}
