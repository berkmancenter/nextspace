import React from "react";
import {
  render,
  screen,
  waitFor,
  act,
  fireEvent,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CreateAccountPage from "../../pages/signup";
import { RetrieveData, SendData } from "../../utils";

// Mock next/navigation
const mockPush = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  redirect: jest.fn(),
}));

// Mock utils
jest.mock("../../utils", () => ({
  RetrieveData: jest.fn(),
  SendData: jest.fn(),
}));

describe("CreateAccountPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPush.mockReset();
  });

  it("renders the signup form with all fields", async () => {
    render(<CreateAccountPage />);

    expect(screen.getByText("Get started with Nextspace")).toBeInTheDocument();
    expect(screen.getByLabelText(/Username/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Email Address/i)).toBeInTheDocument();

    expect(screen.getByLabelText("Password *")).toBeInTheDocument();
    expect(screen.getByLabelText(/Re-enter Password/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Create Account/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/Already have an account/i)).toBeInTheDocument();
  });

  it("validates username is required", async () => {
    const user = userEvent.setup();
    render(<CreateAccountPage />);

    const usernameField = screen.getByLabelText(/Username/i);
    await user.click(usernameField);
    await user.tab(); // Blur the field

    await waitFor(() => {
      expect(screen.getByText("Enter a username.")).toBeInTheDocument();
    });
  });

  it("validates email format", async () => {
    const user = userEvent.setup();
    render(<CreateAccountPage />);

    const emailField = screen.getByLabelText(/Email Address/i);
    await user.type(emailField, "invalid-email");
    await user.tab(); // Blur the field

    await waitFor(() => {
      expect(screen.getByText("Invalid email address")).toBeInTheDocument();
    });

    // Test valid email
    await user.clear(emailField);
    await user.type(emailField, "test@example.com");
    await user.tab();

    await waitFor(() => {
      expect(
        screen.queryByText("Invalid email address")
      ).not.toBeInTheDocument();
    });
  });

  it("validates password requirements", async () => {
    const user = userEvent.setup();
    render(<CreateAccountPage />);

    const passwordField = screen.getByLabelText("Password *");
    // Test weak password
    await user.type(passwordField, "weak");
    await user.tab();

    await waitFor(() => {
      expect(
        screen.getByText(
          /Password must be at least 8 characters and contain at least one letter and one number/i
        )
      ).toBeInTheDocument();
    });

    // Test valid password
    await user.clear(passwordField);
    await user.type(passwordField, "ValidPass123");
    await user.tab();

    await waitFor(() => {
      expect(
        screen.queryByText(/Password must be at least 8 characters/i)
      ).not.toBeInTheDocument();
    });
  });

  it("validates password confirmation matches", async () => {
    const user = userEvent.setup();
    render(<CreateAccountPage />);

    const passwordField = screen.getByLabelText("Password *");
    const confirmPasswordField = screen.getByLabelText(/Re-enter Password/i);

    await user.type(passwordField, "ValidPass123");
    await user.type(confirmPasswordField, "DifferentPass123");

    await waitFor(() => {
      expect(screen.getByText("Passwords do not match")).toBeInTheDocument();
    });

    // Fix the mismatch
    await user.clear(confirmPasswordField);
    await user.type(confirmPasswordField, "ValidPass123");

    await waitFor(() => {
      expect(
        screen.queryByText("Passwords do not match")
      ).not.toBeInTheDocument();
    });
  });

  it("toggles password visibility", async () => {
    const user = userEvent.setup();
    render(<CreateAccountPage />);

    const passwordField = screen.getByLabelText("Password *");
    const toggleButton = screen.getAllByLabelText(
      "toggle password visibility"
    )[0];

    expect(passwordField).toHaveAttribute("type", "password");

    await user.click(toggleButton);
    expect(passwordField).toHaveAttribute("type", "text");

    await user.click(toggleButton);
    expect(passwordField).toHaveAttribute("type", "password");
  });

  it("prevents submission with invalid form data", async () => {
    const user = userEvent.setup();
    render(<CreateAccountPage />);

    const submitButton = screen.getByRole("button", {
      name: /Create Account/i,
    });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText("Username is required")).toBeInTheDocument();
    });

    expect(RetrieveData).not.toHaveBeenCalled();
    expect(SendData).not.toHaveBeenCalled();
  });

  it("successfully submits valid form data", async () => {
    const user = userEvent.setup();
    const mockPseudonymResponse = {
      token: "mock-token",
      pseudonym: "mock-pseudonym",
    };
    const mockRegisterResponse = { success: true };

    (RetrieveData as jest.Mock).mockResolvedValue(mockPseudonymResponse);
    (SendData as jest.Mock).mockResolvedValue(mockRegisterResponse);

    render(<CreateAccountPage />);

    // Fill out the form
    await user.type(screen.getByLabelText(/Username/i), "testuser");
    await user.type(
      screen.getByLabelText(/Email Address/i),
      "test@example.com"
    );
    await user.type(screen.getByLabelText("Password *"), "ValidPass123");
    await user.type(
      screen.getByLabelText(/Re-enter Password/i),
      "ValidPass123"
    );

    const submitButton = screen.getByRole("button", {
      name: /Create Account/i,
    });
    await user.click(submitButton);

    await waitFor(() => {
      expect(RetrieveData).toHaveBeenCalledWith("/auth/newPseudonym");
    });

    await waitFor(() => {
      expect(SendData).toHaveBeenCalledWith("/auth/register", {
        token: "mock-token",
        pseudonym: "mock-pseudonym",
        username: "testuser",
        password: "ValidPass123",
        email: "test@example.com",
      });
    });

    await waitFor(() => {
      expect(
        screen.getByText("Account created successfully! Sending you to login.")
      ).toBeInTheDocument();
    });

    // Should redirect after delay
    await waitFor(
      () => {
        expect(mockPush).toHaveBeenCalledWith("/login");
      },
      { timeout: 3000 }
    );
  });

  it("handles registration errors gracefully", async () => {
    const user = userEvent.setup();
    const mockPseudonymResponse = {
      token: "mock-token",
      pseudonym: "mock-pseudonym",
    };
    const mockRegisterResponse = {
      error: true,
      status: 409,
      message: "Username or email already exists",
    };

    (RetrieveData as jest.Mock).mockResolvedValue(mockPseudonymResponse);
    (SendData as jest.Mock).mockResolvedValue(mockRegisterResponse);

    render(<CreateAccountPage />);

    // Fill out the form
    await user.type(screen.getByLabelText(/Username/i), "existinguser");
    await user.type(
      screen.getByLabelText(/Email Address/i),
      "existing@example.com"
    );
    await user.type(screen.getByLabelText("Password *"), "ValidPass123");
    await user.type(
      screen.getByLabelText(/Re-enter Password/i),
      "ValidPass123"
    );

    const submitButton = screen.getByRole("button", {
      name: /Create Account/i,
    });
    await user.click(submitButton);

    await waitFor(() => {
      expect(
        screen.getByText(
          "Username or email already exists. Please choose another."
        )
      ).toBeInTheDocument();
    });

    expect(mockPush).not.toHaveBeenCalled();
  });

  it("handles network errors during registration", async () => {
    const user = userEvent.setup();
    const mockPseudonymResponse = {
      token: "mock-token",
      pseudonym: "mock-pseudonym",
    };

    (RetrieveData as jest.Mock).mockResolvedValue(mockPseudonymResponse);
    (SendData as jest.Mock).mockRejectedValue(new Error("Network error"));

    render(<CreateAccountPage />);

    // Fill out the form
    await user.type(screen.getByLabelText(/Username/i), "testuser");
    await user.type(
      screen.getByLabelText(/Email Address/i),
      "test@example.com"
    );
    await user.type(screen.getByLabelText("Password *"), "ValidPass123");
    await user.type(
      screen.getByLabelText(/Re-enter Password/i),
      "ValidPass123"
    );

    const submitButton = screen.getByRole("button", {
      name: /Create Account/i,
    });
    await user.click(submitButton);

    await waitFor(() => {
      expect(
        screen.getByText(/Failed to register user.*Network error/i)
      ).toBeInTheDocument();
    });
  });

  it("handles pseudonym retrieval failure", async () => {
    const user = userEvent.setup();

    (RetrieveData as jest.Mock).mockResolvedValue(null);

    render(<CreateAccountPage />);

    // Fill out the form
    await user.type(screen.getByLabelText(/Username/i), "testuser");
    await user.type(
      screen.getByLabelText(/Email Address/i),
      "test@example.com"
    );
    await user.type(screen.getByLabelText("Password *"), "ValidPass123");
    await user.type(
      screen.getByLabelText(/Re-enter Password/i),
      "ValidPass123"
    );

    const submitButton = screen.getByRole("button", {
      name: /Create Account/i,
    });
    await user.click(submitButton);

    await waitFor(() => {
      expect(
        screen.getByText("Problem retrieving pseudonym")
      ).toBeInTheDocument();
    });

    expect(SendData).not.toHaveBeenCalled();
  });

  it("dismisses error messages when user clicks close", async () => {
    const user = userEvent.setup();
    render(<CreateAccountPage />);

    const submitButton = screen.getByRole("button", {
      name: /Create Account/i,
    });
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
