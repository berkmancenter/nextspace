import React, { useState, useRef } from "react";
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
import { RetrieveData, SendData } from "../utils";
import { redirect, useRouter } from "next/navigation";

/**
 * Account Creation Page
 *
 * Displays the Account Creation form.
 * Allows users to create an account with username, email, and password
 */
export default function CreateAccountPage() {
  const [password, setPassword] = useState<string>("");
  const [confirmPassword, setConfirmPassword] = useState<string>("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState(false);
  const [usernameHasError, setUsernameHasError] = useState<boolean>(false);
  const [passwordHasError, setPasswordHasError] = useState<boolean>(false);
  const [emailError, setEmailError] = useState<string | null>(null);

  const formRef = useRef<HTMLFormElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const confirmPasswordRef = useRef<HTMLInputElement>(null);

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

  const handleToggleConfirmPasswordVisibility = () => {
    const cursorPosition = confirmPasswordRef.current?.selectionStart || null;
    setShowConfirmPassword(!showConfirmPassword);
    setTimeout(() => {
      if (confirmPasswordRef.current && cursorPosition !== null) {
        confirmPasswordRef.current.setSelectionRange(
          cursorPosition,
          cursorPosition
        );
      }
    }, 0);
  };

  const validatePassword = (pwd: string) => {
    const hasLetter = /[a-zA-Z]/.test(pwd);
    const hasNumber = /[0-9]/.test(pwd);
    const hasValidLength = pwd.length >= 8;
    return hasLetter && hasNumber && hasValidLength;
  };

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setEmailError("Invalid email address");
      return;
    }
    if (
      !formRef.current?.elements.namedItem("email") ||
      !(formRef.current.elements.namedItem("email") as HTMLInputElement).value
    ) {
      setEmailError("Enter an email address");
      return;
    }
    setEmailError(null);
  };

  const formIsValid = (formData: FormData) => {
    if (!formData.get("username")) {
      setFormError("Username is required");
      setUsernameHasError(true);
      return false;
    }
    if (!formData.get("email")) {
      setFormError("Email is required");
      setEmailError("Enter an email address");
      return false;
    }
    if (password !== confirmPassword) {
      setFormError("Passwords do not match");
      return false;
    }

    if (!validatePassword(password)) {
      setFormError(
        "Password must be at least 8 characters and contain at least one letter and one number"
      );
      setPasswordHasError(true);
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
    // Validate form data
    if (!formIsValid(formData)) return;

    try {
      // Get new pseudonym for session
      const pseudonymResponse = await RetrieveData("/auth/newPseudonym");

      if (!pseudonymResponse) {
        setFormError("Problem retrieving pseudonym");
        return;
      }
      // register user
      const registerResponse = await SendData("/auth/register", {
        token: pseudonymResponse.token,
        pseudonym: pseudonymResponse.pseudonym,
        username: formData.get("username"),
        password,
        email: formData.get("email"),
      });

      if (registerResponse.error) {
        if (registerResponse.status === 409) {
          setFormError(
            "Username or email already exists. Please choose another."
          );
          return;
        }
        setFormError(registerResponse.message);
        return;
      }

      // Redirect to login page after successful signup
      setFormSuccess(true);
      setTimeout(() => {
        router.push("/login");
      }, 2000);
    } catch (error: any) {
      console.error("Error registering user:", error);
      setFormError(`Failed to register user. (${error.message})`);
    }
  };

  const passwordsMatch = confirmPassword === "" || password === confirmPassword;
  const passwordValid = password === "" || validatePassword(password);

  return (
    <Paper elevation={3} sx={{ p: 4, maxWidth: 800, mx: "auto", mt: 4 }}>
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
      <Box component="form" noValidate action="#" ref={formRef}>
        <Typography
          variant="h5"
          component="h2"
          gutterBottom
          sx={{ textAlign: "center" }}
        >
          Get started with Nextspace
        </Typography>
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ mb: 2, textAlign: "center" }}
        >
          Already have an account?{" "}
          <Link href="/login" className="text-blue-600 hover:underline">
            Login here
          </Link>
        </Typography>

        <TextField
          name="username"
          label="Username"
          id="user-name"
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
          name="email"
          label="Email Address"
          id="email"
          type="email"
          required
          fullWidth
          variant="outlined"
          margin="normal"
          helperText={
            emailError && emailError?.length > 0
              ? emailError
              : "Enter your email address"
          }
          onBlur={(e) => validateEmail(e.target.value)}
          error={emailError !== null}
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
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onBlur={(e) =>
            setPasswordHasError(!validatePassword(password) && password !== "")
          }
          inputRef={passwordRef}
          error={!passwordValid || passwordHasError}
          helperText={
            passwordHasError
              ? "Password must be at least 8 characters and contain at least one letter and one number"
              : "Enter a password with at least 8 characters, one letter, and one number"
          }
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

        <TextField
          name="confirmPassword"
          label="Re-enter Password"
          id="confirm-password"
          type={showConfirmPassword ? "text" : "password"}
          required
          fullWidth
          variant="outlined"
          margin="normal"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          inputRef={confirmPasswordRef}
          error={!passwordsMatch}
          helperText={
            !passwordsMatch
              ? "Passwords do not match"
              : "Re-enter your password to confirm"
          }
          slotProps={{
            input: {
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    aria-label="toggle password visibility"
                    onClick={handleToggleConfirmPasswordVisibility}
                    onMouseDown={(e) => e.preventDefault()}
                    edge="end"
                  >
                    {showConfirmPassword ? <Visibility /> : <VisibilityOff />}
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
            disabled={formSuccess}
          >
            Create Account
          </Button>

          {formSuccess && (
            <>
              <svg
                className="mx-auto w-12 h-5 mt-2.5"
                viewBox="0 0 40 10"
                fill="currentColor"
              >
                <circle
                  className="animate-bounce fill-sky-400"
                  cx="5"
                  cy="5"
                  r="4"
                />
                <circle
                  className="animate-bounce [animation-delay:-0.2s] fill-medium-slate-blue"
                  cx="20"
                  cy="5"
                  r="4"
                />
                <circle
                  className="animate-bounce [animation-delay:-0.4s] fill-purple-500"
                  cx="35"
                  cy="5"
                  r="4"
                />
              </svg>

              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mb: 2, textAlign: "center" }}
              >
                Account created successfully! Sending you to login.
              </Typography>
            </>
          )}
        </Box>
      </Box>
    </Paper>
  );
}
