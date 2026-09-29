import React, { FormEvent, useId, useRef, useState } from 'react';
import { Box, Button, IconButton, InputAdornment, TextField, Typography } from '@mui/material';
import { CheckCircleOutline, RadioButtonUnchecked, Visibility, VisibilityOff } from '@mui/icons-material';
import { PASSWORD_RULES, unmetPasswordRules } from '../utils/passwordRules';
import { PasswordFormProps } from '../types.internal';

export function PasswordForm({ heading, intro, submitLabel, onSubmit }: PasswordFormProps) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const passwordRef = useRef<HTMLInputElement>(null);

  const id = useId();
  const rulesId = `${id}-rules`;
  const errorId = `${id}-error`;
  const describedBy = error ? `${errorId} ${rulesId}` : rulesId;

  const showError = (message: string) => {
    setError(message);
    passwordRef.current?.focus();
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const unmetRules = unmetPasswordRules(password);
    if (unmetRules.length > 0) {
      showError(`Password needs: ${unmetRules.map((rule) => rule.label.toLowerCase()).join(', ')}.`);
      return;
    }

    setError(null);
    setSubmitting(true);
    let message: string | void;
    try {
      message = await onSubmit(password);
    } catch (error) {
      setSubmitting(false);
      throw error;
    }
    // No message means the caller handled the outcome (usually by navigating away), so the button stays disabled.
    if (message) {
      setSubmitting(false);
      showError(message);
    }
  };

  return (
    <Box component="form" noValidate onSubmit={handleSubmit}>
      <Typography variant="h5" component="h2" gutterBottom sx={{ textAlign: 'center' }}>
        {heading}
      </Typography>
      {intro && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2, textAlign: 'center' }}>
          {intro}
        </Typography>
      )}

      <TextField
        label="New password"
        name="password"
        type={showPassword ? 'text' : 'password'}
        autoComplete="new-password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        error={Boolean(error)}
        fullWidth
        margin="normal"
        inputRef={passwordRef}
        slotProps={{
          htmlInput: { 'aria-describedby': describedBy, 'aria-required': true },
          input: {
            endAdornment: (
              <InputAdornment position="end">
                <IconButton
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  onClick={() => setShowPassword(!showPassword)}
                  onMouseDown={(event) => event.preventDefault()}
                  edge="end"
                >
                  {showPassword ? <VisibilityOff /> : <Visibility />}
                </IconButton>
              </InputAdornment>
            ),
          },
        }}
      />

      {error && (
        <Typography id={errorId} role="alert" variant="body2" color="error" sx={{ mt: 1 }}>
          {error}
        </Typography>
      )}

      <Box id={rulesId} sx={{ mt: 2 }}>
        <Typography variant="body2">Your password needs:</Typography>
        <Box component="ul" sx={{ mt: 1, pl: 0, listStyle: 'none' }}>
          {PASSWORD_RULES.map((rule) => {
            const met = rule.isMet(password);
            return (
              <Box
                component="li"
                key={rule.id}
                sx={{ display: 'flex', alignItems: 'center', gap: 1, typography: 'body2', mb: 0.5 }}
              >
                {met ? (
                  <CheckCircleOutline fontSize="small" color="success" aria-hidden />
                ) : (
                  <RadioButtonUnchecked fontSize="small" color="disabled" aria-hidden />
                )}
                <span>{rule.label}</span>
                {met && <span className="sr-only">(done)</span>}
              </Box>
            );
          })}
        </Box>
      </Box>

      <Box sx={{ mt: 4, textAlign: 'center' }}>
        <Button type="submit" variant="outlined" disabled={submitting} sx={{ width: 300, maxWidth: '100%' }}>
          {submitLabel}
        </Button>
        {submitting && (
          <svg className="mx-auto w-12 h-5 mt-2.5 block" viewBox="0 0 40 10" fill="currentColor" aria-hidden="true">
            <circle className="animate-bounce fill-sky-400" cx="5" cy="5" r="4" />
            <circle className="animate-bounce [animation-delay:-0.2s] fill-medium-slate-blue" cx="20" cy="5" r="4" />
            <circle className="animate-bounce [animation-delay:-0.4s] fill-purple-500" cx="35" cy="5" r="4" />
          </svg>
        )}
      </Box>
    </Box>
  );
}
