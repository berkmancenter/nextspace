import { Api } from "./Helpers";

type SessionState =
  | "uninitialized"
  | "initializing"
  | "ready"
  | "guest"
  | "authenticated";

class SessionManager {
  private static _instance: SessionManager;
  private sessionState: SessionState = "uninitialized";
  private initializationPromise: Promise<void> | null = null;

  private constructor() {}

  static get() {
    if (!this._instance) {
      this._instance = new SessionManager();
    }
    return this._instance;
  }

  getState(): SessionState {
    return this.sessionState;
  }

  /**
   * Restore session from encrypted cookie if it exists.
   * This should be called once on app initialization.
   */
  async restoreSession(): Promise<boolean> {
    // Prevent multiple simultaneous initialization attempts
    if (this.initializationPromise) {
      await this.initializationPromise;
      return this.sessionState !== "uninitialized";
    }

    if (this.sessionState !== "uninitialized") {
      return true; // Already initialized
    }

    this.sessionState = "initializing";
    this.initializationPromise = this._restoreSession();

    try {
      await this.initializationPromise;
      return this.sessionState !== "uninitialized";
    } finally {
      this.initializationPromise = null;
    }
  }

  private async _restoreSession(): Promise<void> {
    try {
      const response = await fetch("/api/cookie");
      const data = await response.json();

      if (response.status === 200 && data.tokens) {
        // Valid session cookie exists
        Api.get().SetTokens(data.tokens.access, data.tokens.refresh);

        // Determine if this is a guest or authenticated user
        // Guest users have pseudonym-like usernames, authenticated users have custom usernames
        // (This is a heuristic - you might want to add an explicit flag in the cookie)
        this.sessionState =
          data.username && !data.username.startsWith("Guest")
            ? "authenticated"
            : "guest";

        console.log(`Session restored: ${this.sessionState}`, data.username);
        return;
      }
    } catch (error) {
      console.error("Failed to restore session:", error);
    }

    // No existing session - create a new guest session immediately
    await this._createGuestSession();
  }

  /**
   * Create a new guest session (called when no existing session found)
   */
  private async _createGuestSession(): Promise<void> {
    try {
      console.log("Creating new guest session...");

      // Get new pseudonym from API
      const pseudonymResponse = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/auth/newPseudonym`
      ).then((res) => res.json());

      // Register as guest
      const registerResponse = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/auth/register`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            token: pseudonymResponse.token,
            pseudonym: pseudonymResponse.pseudonym,
          }),
        }
      ).then((res) => res.json());

      // Set tokens in memory
      Api.get().SetTokens(
        registerResponse.tokens.access.token,
        registerResponse.tokens.refresh.token
      );

      // Set encrypted cookie via API route
      await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: pseudonymResponse.pseudonym,
          userId: registerResponse.user.id,
          accessToken: registerResponse.tokens.access.token,
          refreshToken: registerResponse.tokens.refresh.token,
          expirationFromNow: 60 * 60 * 24 * 30, // 30 days like Vue app
        }),
      });

      this.sessionState = "guest";
      console.log("Guest session created:", pseudonymResponse.pseudonym);
    } catch (error) {
      console.error("Failed to create guest session:", error);
      this.sessionState = "ready";
      throw error;
    }
  }

  /**
   * Check if a session exists (either guest or authenticated)
   */
  hasSession(): boolean {
    return (
      this.sessionState === "guest" || this.sessionState === "authenticated"
    );
  }

  /**
   * Mark session as authenticated (called after login)
   */
  markAuthenticated(): void {
    this.sessionState = "authenticated";
  }

  /**
   * Mark session as guest (called after guest registration)
   */
  markGuest(): void {
    this.sessionState = "guest";
  }

  /**
   * Clear session state (called on logout)
   */
  clearSession(): void {
    this.sessionState = "ready";
    Api.get().ClearTokens();
    Api.get().ClearAdminTokens();
  }
}

export default SessionManager;
