import { useEffect } from "react";
import { useRouter } from "next/router";
import { CircularProgress, Box, Typography } from "@mui/material";
import { Api } from "../utils";
import SessionManager from "../utils/SessionManager";

/**
 * Logout page component
 * Handles the logout process by clearing session and redirecting to login
 */
export default function Logout() {
  const router = useRouter();

  useEffect(() => {
    const performLogout = async () => {
      try {
        // Call the logout API to clear the session cookie
        const response = await fetch("/api/logout", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        });

        if (!response.ok) {
          throw new Error("Logout failed");
        }

        // Clear session state
        SessionManager.get().clearSession();

        // Redirect to home page
        router.push("/");
      } catch (error) {
        console.error("Error during logout:", error);
        // Even if there's an error, clear session and redirect
        SessionManager.get().clearSession();
        router.push("/");
      }
    };
    performLogout();
  }, [router]);

  return (
    <Box
      display="flex"
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      minHeight="100vh"
      gap={2}
    >
      <CircularProgress />
      <Typography variant="h6">Logging out...</Typography>
    </Box>
  );
}
