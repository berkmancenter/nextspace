import SessionManager from "../../utils/SessionManager";
import { Api } from "../../utils/Helpers";

// Create persistent mock for Api
const mockApiInstance = {
  SetTokens: jest.fn(),
  GetTokens: jest.fn(() => ({ access: null, refresh: null })),
  ClearTokens: jest.fn(),
  ClearAdminTokens: jest.fn(),
};

// Mock Api
jest.mock("../../utils/Helpers", () => ({
  Api: {
    get: jest.fn(() => mockApiInstance),
  },
}));

// Mock fetch
global.fetch = jest.fn();

describe("SessionManager", () => {
  let sessionManager: ReturnType<typeof SessionManager.get>;

  beforeEach(() => {
    // Reset singleton instance
    (SessionManager as any)._instance = undefined;
    sessionManager = SessionManager.get();
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockClear();
    // Reset mock function call counts
    mockApiInstance.SetTokens.mockClear();
    mockApiInstance.GetTokens.mockClear();
    mockApiInstance.ClearTokens.mockClear();
    mockApiInstance.ClearAdminTokens.mockClear();
  });

  describe("Singleton Pattern", () => {
    it("returns the same instance on multiple calls", () => {
      const instance1 = SessionManager.get();
      const instance2 = SessionManager.get();
      expect(instance1).toBe(instance2);
    });
  });

  describe("Session Restoration", () => {
    it("restores existing session from cookie", async () => {
      const mockCookieData = {
        tokens: {
          access: "mock-access-token",
          refresh: "mock-refresh-token",
        },
        userId: "user-123",
        username: "testuser",
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        status: 200,
        json: async () => mockCookieData,
      });

      const result = await sessionManager.restoreSession();

      expect(result).toEqual({ userId: "user-123", username: "testuser" });
      expect(global.fetch).toHaveBeenCalledWith("/api/cookie");
      expect(mockApiInstance.SetTokens).toHaveBeenCalledWith(
        "mock-access-token",
        "mock-refresh-token"
      );
      expect(sessionManager.getState()).toBe("authenticated");
    });

    it("identifies guest users correctly", async () => {
      const mockCookieData = {
        tokens: {
          access: "guest-access-token",
          refresh: "guest-refresh-token",
        },
        userId: "guest-456",
        username: "GuestUser123", // Starts with "Guest"
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        status: 200,
        json: async () => mockCookieData,
      });

      await sessionManager.restoreSession();

      expect(sessionManager.getState()).toBe("guest");
    });

    it("creates new guest session when no cookie exists", async () => {
      const mockPseudonym = {
        token: "new-token",
        pseudonym: "GuestUser789",
      };

      const mockRegisterResponse = {
        tokens: {
          access: { token: "new-access-token" },
          refresh: { token: "new-refresh-token" },
        },
        user: { id: "new-user-id" },
      };

      // Mock cookie check (no cookie)
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          status: 401,
          json: async () => ({ error: "No session cookie found" }),
        })
        // Mock get new pseudonym
        .mockResolvedValueOnce({
          json: async () => mockPseudonym,
        })
        // Mock register
        .mockResolvedValueOnce({
          json: async () => mockRegisterResponse,
        })
        // Mock set session cookie
        .mockResolvedValueOnce({
          status: 200,
          json: async () => ({ message: "Session created" }),
        });

      await sessionManager.restoreSession();

      expect(sessionManager.getState()).toBe("guest");
      expect(global.fetch).toHaveBeenCalledWith(
        `${process.env.NEXT_PUBLIC_API_URL}/auth/newPseudonym`
      );
      expect(global.fetch).toHaveBeenCalledWith(
        `${process.env.NEXT_PUBLIC_API_URL}/auth/register`,
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            token: "new-token",
            pseudonym: "GuestUser789",
          }),
        })
      );
    });

    it("prevents multiple simultaneous initialization attempts", async () => {
      const mockCookieData = {
        tokens: { access: "token", refresh: "refresh" },
        userId: "user-123",
        username: "testuser",
      };

      (global.fetch as jest.Mock).mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  status: 200,
                  json: async () => mockCookieData,
                }),
              100
            )
          )
      );

      // Call restoreSession multiple times simultaneously
      const promises = [
        sessionManager.restoreSession(),
        sessionManager.restoreSession(),
        sessionManager.restoreSession(),
      ];

      await Promise.all(promises);

      // Should only call fetch once (for cookie check)
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it("returns true if already initialized", async () => {
      const mockCookieData = {
        tokens: { access: "token", refresh: "refresh" },
        userId: "user-123",
        username: "testuser",
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        status: 200,
        json: async () => mockCookieData,
      });

      // First initialization
      await sessionManager.restoreSession();
      expect(sessionManager.getState()).not.toBe("uninitialized");

      // Clear fetch mock to verify it's not called again
      (global.fetch as jest.Mock).mockClear();

      // Second call should return immediately
      const result = await sessionManager.restoreSession();

      expect(result).toEqual({ userId: "user-123", username: "testuser" });
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  describe("Session State Management", () => {
    it("hasSession returns true for guest state", async () => {
      const mockCookieData = {
        tokens: { access: "token", refresh: "refresh" },
        userId: "guest-123",
        username: "GuestUser",
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        status: 200,
        json: async () => mockCookieData,
      });

      await sessionManager.restoreSession();

      expect(sessionManager.hasSession()).toBe(true);
    });

    it("hasSession returns true for authenticated state", async () => {
      const mockCookieData = {
        tokens: { access: "token", refresh: "refresh" },
        userId: "user-123",
        username: "authenticateduser",
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        status: 200,
        json: async () => mockCookieData,
      });

      await sessionManager.restoreSession();

      expect(sessionManager.hasSession()).toBe(true);
    });

    it("marks session as authenticated", () => {
      sessionManager.markAuthenticated();
      expect(sessionManager.getState()).toBe("authenticated");
    });

    it("updates session info when marking as authenticated with parameters", () => {
      sessionManager.markAuthenticated("authenticatedUser", "auth-user-123");
      
      expect(sessionManager.getState()).toBe("authenticated");
      expect(sessionManager.getSessionInfo()).toEqual({
        userId: "auth-user-123",
        username: "authenticatedUser",
      });
    });

    it("preserves existing session info when marking as authenticated without parameters", async () => {
      // First set up a guest session
      const mockCookieData = {
        tokens: { access: "token", refresh: "refresh" },
        userId: "guest-123",
        username: "GuestUser",
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        status: 200,
        json: async () => mockCookieData,
      });

      await sessionManager.restoreSession();
      
      // Now mark as authenticated without parameters
      sessionManager.markAuthenticated();
      
      expect(sessionManager.getState()).toBe("authenticated");
      // Session info should still be the guest info
      expect(sessionManager.getSessionInfo()).toEqual({
        userId: "guest-123",
        username: "GuestUser",
      });
    });

    it("updates session info from guest to authenticated user on login", async () => {
      // First set up a guest session
      const mockGuestData = {
        tokens: { access: "guest-token", refresh: "guest-refresh" },
        userId: "guest-456",
        username: "GuestUser789",
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        status: 200,
        json: async () => mockGuestData,
      });

      await sessionManager.restoreSession();
      
      expect(sessionManager.getState()).toBe("guest");
      expect(sessionManager.getSessionInfo()).toEqual({
        userId: "guest-456",
        username: "GuestUser789",
      });

      // Simulate login - mark as authenticated with new user info
      sessionManager.markAuthenticated("realuser", "real-user-123");
      
      expect(sessionManager.getState()).toBe("authenticated");
      expect(sessionManager.getSessionInfo()).toEqual({
        userId: "real-user-123",
        username: "realuser",
      });
    });

    it("marks session as guest", () => {
      sessionManager.markGuest();
      expect(sessionManager.getState()).toBe("guest");
    });

    it("clears session state", () => {
      sessionManager.markGuest();
      sessionManager.clearSession();

      expect(sessionManager.getState()).toBe("cleared");
      expect(sessionManager.getSessionInfo()).toBeNull();
      expect(mockApiInstance.ClearTokens).toHaveBeenCalled();
      expect(mockApiInstance.ClearAdminTokens).toHaveBeenCalled();
    });

    it("skips session creation when skipCreation is true", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        status: 401,
        json: async () => ({ error: "No session cookie found" }),
      });

      const result = await sessionManager.restoreSession({ skipCreation: true });

      expect(result).toBeNull();
      expect(sessionManager.getState()).toBe("cleared");
      // Should only have called cookie check, not pseudonym/register
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it("restores existing session even with skipCreation true", async () => {
      const mockCookieData = {
        tokens: { access: "token", refresh: "refresh" },
        userId: "user-123",
        username: "testuser",
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        status: 200,
        json: async () => mockCookieData,
      });

      const result = await sessionManager.restoreSession({ skipCreation: true });

      expect(result).toEqual({ userId: "user-123", username: "testuser" });
      expect(sessionManager.hasSession()).toBe(true);
      expect(sessionManager.getState()).toBe("authenticated");
    });
  });

  describe("Error Handling", () => {
    it("handles cookie fetch error gracefully", async () => {
      (global.fetch as jest.Mock)
        .mockRejectedValueOnce(new Error("Network error"))
        // Mock fallback to create guest session
        .mockResolvedValueOnce({
          json: async () => ({ token: "token", pseudonym: "Guest" }),
        })
        .mockResolvedValueOnce({
          json: async () => ({
            tokens: {
              access: { token: "access" },
              refresh: { token: "refresh" },
            },
            user: { id: "user-id" },
          }),
        })
        .mockResolvedValueOnce({
          status: 200,
          json: async () => ({ message: "Session created" }),
        });

      await sessionManager.restoreSession();

      // Should create guest session as fallback
      expect(sessionManager.getState()).toBe("guest");
    });

    it("throws error if guest session creation fails", async () => {
      (global.fetch as jest.Mock)
        // No cookie
        .mockResolvedValueOnce({
          status: 401,
          json: async () => ({ error: "No cookie" }),
        })
        // Pseudonym fetch fails
        .mockRejectedValueOnce(new Error("API down"));

      await expect(sessionManager.restoreSession()).rejects.toThrow(
        "API down"
      );
      expect(sessionManager.getState()).toBe("ready");
    });
  });

  describe("State Transitions", () => {
    it("transitions through states correctly during initialization", async () => {
      const states: string[] = [];

      const mockCookieData = {
        tokens: { access: "token", refresh: "refresh" },
        userId: "user-123",
        username: "testuser",
      };

      (global.fetch as jest.Mock).mockImplementation(async () => {
        states.push(sessionManager.getState());
        return {
          status: 200,
          json: async () => mockCookieData,
        };
      });

      states.push(sessionManager.getState()); // initial
      await sessionManager.restoreSession();
      states.push(sessionManager.getState()); // final

      expect(states).toEqual([
        "uninitialized",
        "initializing",
        "authenticated",
      ]);
    });
  });
});
