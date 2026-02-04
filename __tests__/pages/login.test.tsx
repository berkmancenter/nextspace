import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LoginPage from "../../pages/login";
import { Authenticate } from "../../utils";
import SessionManager from "../../utils/SessionManager";

// Mock next/navigation
const mockPush = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

// Mock utils
jest.mock("../../utils", () => ({
  Authenticate: jest.fn(),
  Api: {
    get: jest.fn(() => ({
      SetTokens: jest.fn(),
      SetAdminTokens: jest.fn(),
    })),
  },
}));

// Mock SessionManager
const mockMarkAuthenticated = jest.fn();
jest.mock("../../utils/SessionManager", () => ({
  __esModule: true,
  default: {
    get: jest.fn(() => ({
      markAuthenticated: mockMarkAuthenticated,
    })),
  },
}));

// Mock fetch globally
global.fetch = jest.fn();

describe("LoginPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPush.mockReset();
    mockMarkAuthenticated.mockReset();
    (global.fetch as jest.Mock).mockReset();
  });

  it("renders the login form with all fields", () => {
    render(<LoginPage />);

    expect(screen.getByText("Log into NextSpace")).toBeInTheDocument();
    expect(screen.getByLabelText(/Username/i)).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /Username/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Login/i })).toBeInTheDocument();
    expect(screen.getByText(/Don't have an account/i)).toBeInTheDocument();
  });

  it("validates username is required", async () => {
    const user = userEvent.setup();
    render(<LoginPage />);

    const usernameField = screen.getByLabelText(/Username/i);
    await user.click(usernameField);
    await user.tab(); // Blur the field

    await waitFor(() => {
      expect(screen.getByText("Enter a username.")).toBeInTheDocument();
    });
  });

  it("validates password is required", async () => {
    const user = userEvent.setup();
    render(<LoginPage />);

    const passwordField = screen.getByRole("textbox", { name: /Username/i });
    // Tab to password field
    await user.click(passwordField);
    await user.tab();
    await user.tab(); // Blur the password field

    await waitFor(() => {
      expect(screen.getByText("Enter a password.")).toBeInTheDocument();
    });
  });

  it("toggles password visibility", async () => {
    const user = userEvent.setup();
    render(<LoginPage />);

    const passwordField = document.querySelector('input[name="password"]') as HTMLInputElement;
    const toggleButton = screen.getByLabelText("toggle password visibility");

    expect(passwordField).toHaveAttribute("type", "password");

    await user.click(toggleButton);
    expect(passwordField).toHaveAttribute("type", "text");

    await user.click(toggleButton);
    expect(passwordField).toHaveAttribute("type", "password");
  });

  it("prevents submission with empty form", async () => {
    const user = userEvent.setup();
    render(<LoginPage />);

    const submitButton = screen.getByRole("button", { name: /Login/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText("Username is required")).toBeInTheDocument();
    });

    expect(Authenticate).not.toHaveBeenCalled();
  });

  it("successfully logs in with valid credentials and active pseudonym", async () => {
    const user = userEvent.setup();
    const mockLoginResponse = {
      user: {
        id: "user123",
        username: "testuser",
        pseudonyms: [
          {
            pseudonym: "Intuitive Lyra",
            active: true,
          },
        ],
      },
      tokens: {
        access: { token: "access-token-123" },
        refresh: { token: "refresh-token-456" },
      },
    };

    (Authenticate as jest.Mock).mockResolvedValue(mockLoginResponse);
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ message: "Successfully set cookie!" }),
    });

    render(<LoginPage />);

    await user.type(screen.getByLabelText(/Username/i), "testuser");
    await user.type(document.querySelector('input[name="password"]')!, "password123");

    const submitButton = screen.getByRole("button", { name: /Login/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(Authenticate).toHaveBeenCalledWith("testuser", "password123");
    });

    // Verify session manager was called with pseudonym
    await waitFor(() => {
      expect(mockMarkAuthenticated).toHaveBeenCalledWith(
        "Intuitive Lyra",
        "user123"
      );
    });

    // Verify session cookie API was called with pseudonym and authType: "admin"
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/session",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            username: "Intuitive Lyra",
            userId: "user123",
            accessToken: "access-token-123",
            refreshToken: "refresh-token-456",
            authType: "admin",
          }),
        })
      );
    });

    await waitFor(() => {
      expect(screen.getByText("Login successful!")).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/admin/events");
    });
  });

  it("handles authentication error from server", async () => {
    const user = userEvent.setup();
    const mockErrorResponse = {
      error: true,
      message: "Invalid credentials",
    };

    (Authenticate as jest.Mock).mockResolvedValue(mockErrorResponse);

    render(<LoginPage />);

    await user.type(screen.getByLabelText(/Username/i), "testuser");
    await user.type(document.querySelector('input[name="password"]')!, "wrongpassword");

    const submitButton = screen.getByRole("button", { name: /Login/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText("Invalid credentials")).toBeInTheDocument();
    });

    expect(mockPush).not.toHaveBeenCalled();
  });

  it("handles missing active pseudonym error", async () => {
    const user = userEvent.setup();
    const mockLoginResponse = {
      user: {
        id: "user123",
        username: "testuser",
        pseudonyms: [
          {
            pseudonym: "Inactive User",
            active: false,
          },
        ],
      },
      tokens: {
        access: { token: "access-token-123" },
        refresh: { token: "refresh-token-456" },
      },
    };

    (Authenticate as jest.Mock).mockResolvedValue(mockLoginResponse);

    render(<LoginPage />);

    await user.type(screen.getByLabelText(/Username/i), "testuser");
    await user.type(document.querySelector('input[name="password"]')!, "password123");

    const submitButton = screen.getByRole("button", { name: /Login/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(
        screen.getByText("No active pseudonym found for user.")
      ).toBeInTheDocument();
    });

    expect(mockMarkAuthenticated).not.toHaveBeenCalled();
    expect(global.fetch).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("handles user with no pseudonyms array", async () => {
    const user = userEvent.setup();
    const mockLoginResponse = {
      user: {
        id: "user123",
        username: "testuser",
        // No pseudonyms array
      },
      tokens: {
        access: { token: "access-token-123" },
        refresh: { token: "refresh-token-456" },
      },
    };

    (Authenticate as jest.Mock).mockResolvedValue(mockLoginResponse);

    render(<LoginPage />);

    await user.type(screen.getByLabelText(/Username/i), "testuser");
    await user.type(document.querySelector('input[name="password"]')!, "password123");

    const submitButton = screen.getByRole("button", { name: /Login/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(
        screen.getByText("No active pseudonym found for user.")
      ).toBeInTheDocument();
    });
  });

  it("handles network errors during authentication", async () => {
    const user = userEvent.setup();
    (Authenticate as jest.Mock).mockRejectedValue(new Error("Network error"));

    render(<LoginPage />);

    await user.type(screen.getByLabelText(/Username/i), "testuser");
    await user.type(document.querySelector('input[name="password"]')!, "password123");

    const submitButton = screen.getByRole("button", { name: /Login/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(
        screen.getByText("An unexpected error occurred. Please try again later.")
      ).toBeInTheDocument();
    });
  });

  it("uses userId from response.userId as fallback", async () => {
    const user = userEvent.setup();
    const mockLoginResponse = {
      userId: "legacy-user-id",
      user: {
        // No id field on user object
        username: "testuser",
        pseudonyms: [
          {
            pseudonym: "Legacy User",
            active: true,
          },
        ],
      },
      tokens: {
        access: { token: "access-token-123" },
        refresh: { token: "refresh-token-456" },
      },
    };

    (Authenticate as jest.Mock).mockResolvedValue(mockLoginResponse);
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ message: "Successfully set cookie!" }),
    });

    render(<LoginPage />);

    await user.type(screen.getByLabelText(/Username/i), "testuser");
    await user.type(document.querySelector('input[name="password"]')!, "password123");

    const submitButton = screen.getByRole("button", { name: /Login/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockMarkAuthenticated).toHaveBeenCalledWith(
        "Legacy User",
        "legacy-user-id"
      );
    });

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/session",
        expect.objectContaining({
          body: JSON.stringify({
            username: "Legacy User",
            userId: "legacy-user-id",
            accessToken: "access-token-123",
            refreshToken: "refresh-token-456",
            authType: "admin",
          }),
        })
      );
    });
  });

  it("replaces existing guest session with authenticated session", async () => {
    const user = userEvent.setup();
    const mockLoginResponse = {
      user: {
        id: "auth-user-456",
        username: "authenticateduser",
        pseudonyms: [
          {
            pseudonym: "Authenticated Pro",
            active: true,
          },
        ],
      },
      tokens: {
        access: { token: "new-auth-access-token" },
        refresh: { token: "new-auth-refresh-token" },
      },
    };

    (Authenticate as jest.Mock).mockResolvedValue(mockLoginResponse);
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ message: "Successfully set cookie!" }),
    });

    render(<LoginPage />);

    await user.type(screen.getByLabelText(/Username/i), "authenticateduser");
    await user.type(document.querySelector('input[name="password"]')!, "password123");

    const submitButton = screen.getByRole("button", { name: /Login/i });
    await user.click(submitButton);

    await waitFor(() => {
      // Verify new authenticated tokens were set
      expect(SessionManager.get().markAuthenticated).toHaveBeenCalledWith(
        "Authenticated Pro",
        "auth-user-456"
      );
    });

    // Verify new session cookie was created, replacing any existing one
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/session",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            username: "Authenticated Pro", // Uses pseudonym, not username
            userId: "auth-user-456",
            accessToken: "new-auth-access-token",
            refreshToken: "new-auth-refresh-token",
            authType: "admin",
          }),
        })
      );
    });

    // Verify redirect happens after successful state replacement
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/admin/events");
    });
  });

  it("dismisses error messages when user clicks close", async () => {
    const user = userEvent.setup();
    render(<LoginPage />);

    const submitButton = screen.getByRole("button", { name: /Login/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText("Username is required")).toBeInTheDocument();
    });

    const closeButton = screen.getByLabelText(/close/i);
    await user.click(closeButton);

    await waitFor(() => {
      expect(
        screen.queryByText("Username is required")
      ).not.toBeInTheDocument();
    });
  });
});
