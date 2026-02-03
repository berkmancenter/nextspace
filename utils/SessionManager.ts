import { Api } from "./Helpers";

type SessionState =
  | "uninitialized"
  | "initializing"
  | "guest"
  | "authenticated"
  | "cleared";

type SessionInfo = {
  userId: string;
  username: string;
};

class SessionManager {
  private static _instance: SessionManager;
  private sessionState: SessionState = "uninitialized";
  private initializationPromise: Promise<SessionInfo | null> | null = null;
  private currentSession: SessionInfo | null = null;
  private accessExpiresAt: number | null = null;
  private refreshTimer: NodeJS.Timeout | null = null;
  private isRefreshing: boolean = false;
  
  // Refresh tokens 5 minutes before expiration
  private readonly REFRESH_THRESHOLD_MS = 5 * 60 * 1000;

  private constructor() {
    // Cleanup timer on page unload
    if (typeof window !== "undefined") {
      window.addEventListener("beforeunload", () => {
        this.stopRefreshTimer();
      });
    }
  }

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
   * @param options.skipCreation - If true, don't create a new guest session if none exists
   * @returns SessionInfo if session exists, null otherwise
   */
  async restoreSession(options?: { skipCreation?: boolean }): Promise<SessionInfo | null> {
    // Prevent multiple simultaneous initialization attempts
    if (this.initializationPromise) {
      return await this.initializationPromise;
    }

    if (this.sessionState !== "uninitialized") {
      return this.currentSession; // Already initialized
    }

    this.sessionState = "initializing";
    this.initializationPromise = this._restoreSession(options?.skipCreation);

    try {
      const sessionInfo = await this.initializationPromise;
      return sessionInfo;
    } finally {
      this.initializationPromise = null;
    }
  }

  private async _restoreSession(skipCreation?: boolean): Promise<SessionInfo | null> {
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

        this.currentSession = {
          userId: data.userId,
          username: data.username,
        };

        // Store expiration time and start refresh timer
        this.accessExpiresAt = data.accessExpiresAt;
        this.startRefreshTimer();

        console.log(`Session restored: ${this.sessionState}`, data.username);
        return this.currentSession;
      }
    } catch (error) {
      console.error("Failed to restore session:", error);
    }

    // No existing session - create a new guest session only if allowed
    if (skipCreation) {
      console.log("Skipping guest session creation (blacklisted page)");
      this.sessionState = "cleared";
      return null;
    }

    return await this._createGuestSession();
  }

  /**
   * Create a new guest session (called when no existing session found)
   */
  private async _createGuestSession(): Promise<SessionInfo> {
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
          accessExpiresAt: registerResponse.tokens.access.expiresAt,
          expirationFromNow: 60 * 60 * 24 * 30, // 30 days like Vue app
        }),
      });

      this.sessionState = "guest";
      this.currentSession = {
        userId: registerResponse.user.id,
        username: pseudonymResponse.pseudonym,
      };

      // Store expiration time and start refresh timer
      this.accessExpiresAt = registerResponse.tokens.access.expiresAt;
      this.startRefreshTimer();

      console.log("Guest session created:", pseudonymResponse.pseudonym);
      return this.currentSession;
    } catch (error) {
      console.error("Failed to create guest session:", error);
      this.sessionState = "ready";
      throw error;
    }
  }

  /**
   * Get current session info
   */
  getSessionInfo(): SessionInfo | null {
    return this.currentSession;
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
   * @param username - The authenticated user's username
   * @param userId - The authenticated user's ID
   */
  markAuthenticated(username?: string, userId?: string): void {
    this.sessionState = "authenticated";
    
    // Update session info if provided
    if (username !== undefined && userId !== undefined) {
      this.currentSession = {
        userId: userId,
        username: username,
      };
    }
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
    this.sessionState = "cleared";
    this.currentSession = null;
    this.accessExpiresAt = null;
    this.stopRefreshTimer();
    Api.get().ClearTokens();
    Api.get().ClearAdminTokens();
  }

  /**
   * Start the proactive token refresh timer
   */
  private startRefreshTimer(): void {
    // Only run in browser environment
    if (typeof window === "undefined") return;
    
    this.stopRefreshTimer(); // Clear any existing timer
    
    if (!this.accessExpiresAt) {
      console.warn("Cannot start refresh timer: no expiration time available");
      return;
    }

    const expiresAt = new Date(this.accessExpiresAt).getTime();
    const now = Date.now();
    const timeUntilExpiration = expiresAt - now;
    const timeUntilRefresh = timeUntilExpiration - this.REFRESH_THRESHOLD_MS;

    if (timeUntilRefresh <= 0) {
      // Token is already expired or about to expire, refresh immediately
      console.log("Token near expiration, refreshing immediately");
      this.refreshTokens();
    } else {
      // Schedule refresh before expiration
      console.log(`Scheduling token refresh in ${Math.round(timeUntilRefresh / 1000)}s`);
      this.refreshTimer = setTimeout(() => {
        this.refreshTokens();
      }, timeUntilRefresh);
    }
  }

  /**
   * Stop the refresh timer
   */
  private stopRefreshTimer(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  /**
   * Refresh tokens proactively before they expire
   */
  private async refreshTokens(): Promise<void> {
    // Prevent multiple simultaneous refresh attempts
    if (this.isRefreshing) {
      console.log("Refresh already in progress, skipping");
      return;
    }

    this.isRefreshing = true;

    try {
      console.log("Refreshing access token...");
      
      const response = await fetch("/api/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        console.error("Token refresh failed:", response.status);
        
        // If refresh fails with 401, session is invalid - clear it
        if (response.status === 401) {
          console.log("Session expired, clearing session");
          this.clearSession();
        }
        return;
      }

      const data = await response.json();

      // Update tokens in memory
      Api.get().SetTokens(data.tokens.access, data.tokens.refresh);

      // Update expiration time
      this.accessExpiresAt = data.accessExpiresAt;

      console.log("Token refreshed successfully");

      // Schedule next refresh
      this.startRefreshTimer();
    } catch (error) {
      console.error("Error refreshing token:", error);
    } finally {
      this.isRefreshing = false;
    }
  }

  /**
   * Manually trigger a token refresh (useful for testing or forcing refresh)
   */
  async forceRefresh(): Promise<void> {
    await this.refreshTokens();
  }
}

export default SessionManager;
