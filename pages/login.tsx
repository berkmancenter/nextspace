import React, { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Alert,
  Box,
  Button,
  IconButton,
  InputAdornment,
  Link,
  Paper,
  Snackbar,
  TextField,
  Typography,
} from "@mui/material";
import { Visibility, VisibilityOff } from "@mui/icons-material";
import { Api, Authenticate } from "../utils";
import SessionManager from "../utils/SessionManager";

/**
 * Login Page
 *
 * Displays the login form for existing users.
 */
export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState(false);
  const [usernameHasError, setUsernameHasError] = useState<boolean>(false);
  const [passwordHasError, setPasswordHasError] = useState<boolean>(false);

  const formRef = useRef<HTMLFormElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const handleTogglePasswordVisibility = () => {
    const cursorPosition = passwordRef.current?.selectionStart || null;
    setShowPassword(!showPassword);
    setTimeout(() => {
      if (passwordRef.current && cursorPosition !== null) {
        passwordRef.current.setSelectionRange(cursorPosition, cursorPosition);
      }
    }, 0);
  };

  const formIsValid = (formData: FormData) => {
    if (!formData.get("username")) {
      setFormError("Username is required");
      return false;
    }
    if (!formData.get("password")) {
      setFormError("Password is required");
      return false;
    }
    if (!formRef.current?.checkValidity()) {
      setFormError("Please fill out all required fields.");
      return false;
    }

    setFormError(null);
    return true;
  };

  const sendData = async (formData: FormData) => {
    if (!formIsValid(formData)) return;
    try {
      const response = await Authenticate(
        formData.get("username")!.toString(),
        formData.get("password")!.toString()
      );
      if (response.error) {
        setFormError(response.message);
        return;
      }

      // TODO: we should not store admin tokens locally in memory like this;
      // while technically not easily accessed by browser, this is not good practice.
      // client should have to call a local API route to decrypt the cookie and then send requests.
      Api.get().SetAdminTokens(response.access.token, response.refresh.token);
      // Set regular token as well, for other operations
      Api.get().SetTokens(response.access.token, response.refresh.token);

      // Mark session as authenticated
      SessionManager.get().markAuthenticated();

      // Set session cookie via local API route
      await fetch("/api/session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: formData.get("username"),
          accessToken: response.access.token,
          refreshToken: response.refresh.token,
        }),
      });
      setFormSuccess(true);
      // Redirect to events page after successful login
      router.push("/admin/events");
    } catch (error: any) {
      console.error("Login failed:", error);
      setFormError("An unexpected error occurred. Please try again later.");
    }
  };

  return (
    <Paper elevation={3} sx={{ p: 4, maxWidth: 600, mx: "auto", mt: 4 }}>
      {formError && (
        <Snackbar
          open={Boolean(formError)}
          autoHideDuration={5000}
          onClose={() => setFormError(null)}
        >
          <Alert
            variant="filled"
            severity="error"
            onClose={() => setFormError(null)}
            sx={{ mt: 2 }}
          >
            {formError}
          </Alert>
        </Snackbar>
      )}

      {formSuccess && (
        <Snackbar
          open={formSuccess}
          autoHideDuration={3000}
          onClose={() => setFormSuccess(false)}
        >
          <Alert
            variant="filled"
            severity="success"
            onClose={() => setFormSuccess(false)}
            sx={{ mt: 2 }}
          >
            Login successful!
          </Alert>
        </Snackbar>
      )}

      <Box component="form" noValidate action="#" ref={formRef}>
        <Typography
          variant="h5"
          component="h2"
          gutterBottom
          sx={{ textAlign: "center" }}
        >
          Log into NextSpace
        </Typography>
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ mb: 2, textAlign: "center" }}
        >
          Don&apos;t have an account?&nbsp;
          <Link href="/signup" className="text-blue-600 hover:underline">
            Create one here
          </Link>
        </Typography>

        <TextField
          name="username"
          label="Username"
          id="username"
          required
          fullWidth
          variant="outlined"
          margin="normal"
          helperText={usernameHasError ? "Enter a username." : null}
          onBlur={() =>
            setUsernameHasError(
              !formRef.current?.elements.namedItem("username") ||
                !(
                  formRef.current.elements.namedItem(
                    "username"
                  ) as HTMLInputElement
                ).value
            )
          }
          error={usernameHasError}
        />

        <TextField
          name="password"
          label="Password"
          id="password"
          type={showPassword ? "text" : "password"}
          required
          fullWidth
          variant="outlined"
          margin="normal"
          helperText={passwordHasError ? "Enter a password." : null}
          onBlur={() =>
            setPasswordHasError(
              !formRef.current?.elements.namedItem("password") ||
                !(
                  formRef.current.elements.namedItem(
                    "password"
                  ) as HTMLInputElement
                ).value
            )
          }
          error={passwordHasError}
          inputRef={passwordRef}
          slotProps={{
            input: {
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    aria-label="toggle password visibility"
                    onClick={handleTogglePasswordVisibility}
                    onMouseDown={(e) => e.preventDefault()}
                    edge="end"
                  >
                    {showPassword ? <Visibility /> : <VisibilityOff />}
                  </IconButton>
                </InputAdornment>
              ),
            },
          }}
        />

        <Box sx={{ mt: 4, textAlign: "center" }}>
          <Button
            type="submit"
            variant="outlined"
            sx={{ width: 300, maxWidth: "100%" }}
            onClick={(e) => {
              e.preventDefault();
              if (formRef.current) sendData(new FormData(formRef.current));
            }}
          >
            Login
          </Button>
        </Box>
      </Box>
    </Paper>
  );
}
