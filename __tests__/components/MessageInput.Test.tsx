import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MessageInput } from "../../components/MessageInput";
import {
  SlashCommand,
  createSlashCommandEnhancer,
} from "../../components/enhancers/slashCommandEnhancer";

// Mock scrollIntoView (not available in jsdom)
Element.prototype.scrollIntoView = jest.fn();

describe("MessageInput Component", () => {
  const mockOnSendMessage = jest.fn();
  const mockOnExitControlledMode = jest.fn();

  const mockSlashCommands: SlashCommand[] = [
    {
      command: "mod",
      description: "Submit a question to the moderator",
      value: "/mod ",
      conversationTypes: ["eventAssistantPlus"],
    },
    {
      command: "test",
      description: "Test command",
      value: "/test ",
    },
  ];

  const defaultProps = {
    pseudonym: "TestUser",
    enhancers: [createSlashCommandEnhancer(mockSlashCommands)],
    onSendMessage: mockOnSendMessage,
    waitingForResponse: false,
    controlledMode: null,
    onExitControlledMode: mockOnExitControlledMode,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Basic Rendering", () => {
    it("renders with pseudonym", () => {
      render(
        <MessageInput {...defaultProps} />
      );

      expect(screen.getByText(/Writing as TestUser/i)).toBeInTheDocument();
      expect(
        screen.getByPlaceholderText("Enter your message here")
      ).toBeInTheDocument();
    });

    it("does not render when pseudonym is null", () => {
      const { container } = render(
        <MessageInput {...defaultProps} pseudonym={null} />
      );

      expect(container.firstChild).toBeNull();
    });
  });

  describe("Button State", () => {
    it("disables send button when message is empty", () => {
      render(
        <MessageInput {...defaultProps} />
      );

      const sendButton = screen.getByLabelText("send message");
      expect(sendButton).toBeDisabled();
    });

    it("enables send button when message has content", async () => {
      const user = userEvent.setup();
      render(
        <MessageInput {...defaultProps} />
      );

      const input = screen.getByPlaceholderText("Enter your message here");
      const sendButton = screen.getByLabelText("send message");

      expect(sendButton).toBeDisabled();

      await user.type(input, "Hello");

      expect(sendButton).not.toBeDisabled();
    });

    it("disables send button while waiting for response", async () => {
      const user = userEvent.setup();
      render(
        <MessageInput {...defaultProps} waitingForResponse={true} />
      );

      const input = screen.getByPlaceholderText("Enter your message here");
      const sendButton = screen.getByLabelText("send message");

      await user.type(input, "Hello");

      // Should still be disabled even with text because waitingForResponse is true
      expect(sendButton).toBeDisabled();
    });
  });

  describe("Message Sending", () => {
    it("sends message when send button is clicked", async () => {
      const user = userEvent.setup();
      render(
        <MessageInput {...defaultProps} />
      );

      const input = screen.getByPlaceholderText("Enter your message here");
      const sendButton = screen.getByLabelText("send message");

      await user.type(input, "Test message");
      await user.click(sendButton);

      expect(mockOnSendMessage).toHaveBeenCalledWith("Test message");
    });

    it("sends message when Enter key is pressed", async () => {
      const user = userEvent.setup();
      render(
        <MessageInput {...defaultProps} />
      );

      const input = screen.getByPlaceholderText("Enter your message here");

      await user.type(input, "Test message{Enter}");

      expect(mockOnSendMessage).toHaveBeenCalledWith("Test message");
    });

    it("clears input after sending message", async () => {
      const user = userEvent.setup();
      render(
        <MessageInput {...defaultProps} />
      );

      const input = screen.getByPlaceholderText(
        "Enter your message here"
      ) as HTMLInputElement;
      const sendButton = screen.getByLabelText("send message");

      await user.type(input, "Test message");
      await user.click(sendButton);

      await waitFor(() => {
        expect(input.value).toBe("");
      });
    });

    it("does not send empty message", async () => {
      const user = userEvent.setup();
      render(
        <MessageInput {...defaultProps} />
      );

      const input = screen.getByPlaceholderText("Enter your message here");

      // Try to send with just Enter (no message)
      await user.click(input);
      await user.keyboard("{Enter}");

      expect(mockOnSendMessage).not.toHaveBeenCalled();
    });

    it("sends message with slash command prefix", async () => {
      const user = userEvent.setup();
      render(
        <MessageInput {...defaultProps} />
      );

      const input = screen.getByPlaceholderText("Enter your message here");
      await user.type(input, "/mod my question");
      await user.keyboard("{Enter}");

      expect(mockOnSendMessage).toHaveBeenCalledWith("/mod my question");
    });
  });

  describe("Slash Command Functionality", () => {
    it("shows slash command menu when typing '/'", async () => {
      const user = userEvent.setup();
      render(
        <MessageInput {...defaultProps} />
      );

      const input = screen.getByPlaceholderText("Enter your message here");
      await user.type(input, "/");

      await waitFor(() => {
        expect(screen.getByText("/mod")).toBeInTheDocument();
        expect(
          screen.getByText("Submit a question to the moderator")
        ).toBeInTheDocument();
      });
    });

    it("hides slash command menu when space is typed after command", async () => {
      const user = userEvent.setup();
      render(
        <MessageInput {...defaultProps} />
      );

      const input = screen.getByPlaceholderText("Enter your message here");
      await user.type(input, "/mod ");

      await waitFor(() => {
        expect(screen.queryByText("/mod")).not.toBeInTheDocument();
      });
    });

    it("hides slash command menu when input is cleared", async () => {
      const user = userEvent.setup();
      render(
        <MessageInput {...defaultProps} />
      );

      const input = screen.getByPlaceholderText("Enter your message here");
      await user.type(input, "/");

      await waitFor(() => {
        expect(screen.getByText("/mod")).toBeInTheDocument();
      });

      await user.clear(input);

      await waitFor(() => {
        expect(screen.queryByText("/mod")).not.toBeInTheDocument();
      });
    });

    it("selects slash command when clicked", async () => {
      const user = userEvent.setup();
      render(
        <MessageInput {...defaultProps} />
      );

      const input = screen.getByPlaceholderText(
        "Enter your message here"
      ) as HTMLInputElement;
      await user.type(input, "/");

      await waitFor(() => {
        expect(screen.getByText("/mod")).toBeInTheDocument();
      });

      const modCommand = screen.getByText("/mod");
      await user.click(modCommand);

      await waitFor(() => {
        expect(input.value).toBe("/mod ");
        expect(screen.queryByText("/mod")).not.toBeInTheDocument();
      });
    });

    it("positions cursor at end of command after selection", async () => {
      const user = userEvent.setup();
      render(
        <MessageInput {...defaultProps} />
      );

      const input = screen.getByPlaceholderText(
        "Enter your message here"
      ) as HTMLInputElement;
      await user.type(input, "/");

      await waitFor(() => {
        expect(screen.getByText("/mod")).toBeInTheDocument();
      });

      const modCommand = screen.getByText("/mod");
      await user.click(modCommand);

      await waitFor(() => {
        expect(input.selectionStart).toBe(5); // "/mod " length
        expect(input.selectionEnd).toBe(5);
      });
    });

    it("allows typing after slash command selection", async () => {
      const user = userEvent.setup();
      render(
        <MessageInput {...defaultProps} />
      );

      const input = screen.getByPlaceholderText(
        "Enter your message here"
      ) as HTMLInputElement;
      await user.type(input, "/");

      await waitFor(() => {
        expect(screen.getByText("/mod")).toBeInTheDocument();
      });

      const modCommand = screen.getByText("/mod");
      await user.click(modCommand);

      await waitFor(() => {
        expect(input.value).toBe("/mod ");
      });

      await user.type(input, "my question");

      expect(input.value).toBe("/mod my question");
    });

    it("filters commands based on typed text", async () => {
      const user = userEvent.setup();
      render(
        <MessageInput {...defaultProps} />
      );

      const input = screen.getByPlaceholderText("Enter your message here");
      await user.type(input, "/m");

      await waitFor(() => {
        expect(screen.getByText("/mod")).toBeInTheDocument();
        expect(screen.queryByText("/test")).not.toBeInTheDocument();
      });
    });

    it("does not show slash menu when typing regular text", async () => {
      const user = userEvent.setup();
      render(
        <MessageInput {...defaultProps} />
      );

      const input = screen.getByPlaceholderText("Enter your message here");
      await user.type(input, "regular message");

      expect(screen.queryByText("/mod")).not.toBeInTheDocument();
    });

    it("does not show slash menu when typing slash mid-message", async () => {
      const user = userEvent.setup();
      render(
        <MessageInput {...defaultProps} />
      );

      const input = screen.getByPlaceholderText("Enter your message here");
      await user.type(input, "check out http://example.com");

      expect(screen.queryByText("/mod")).not.toBeInTheDocument();
    });

    it("does not send message when Enter selects a slash command", async () => {
      const user = userEvent.setup();
      render(
        <MessageInput {...defaultProps} />
      );

      const input = screen.getByPlaceholderText(
        "Enter your message here"
      ) as HTMLInputElement;
      await user.type(input, "/");

      await waitFor(() => {
        expect(screen.getByText("/mod")).toBeInTheDocument();
      });

      // Press Enter to select the command
      await user.keyboard("{Enter}");

      await waitFor(() => {
        expect(input.value).toBe("/mod ");
      });

      // Message should not have been sent
      expect(mockOnSendMessage).not.toHaveBeenCalled();
    });
  });

  describe("Controlled Mode", () => {
    it("displays controlled mode label", () => {
      const controlledMode = {
        prefix: "/feedback|",
        icon: <span>📝</span>,
        label: "Feedback Mode",
      };

      render(
        <MessageInput {...defaultProps} controlledMode={controlledMode} />
      );

      expect(screen.getByText(/Feedback Mode/i)).toBeInTheDocument();
    });

    it("shows exit button in controlled mode", () => {
      const controlledMode = {
        prefix: "/feedback|",
        icon: null,
        label: "Feedback Mode",
      };

      render(
        <MessageInput {...defaultProps} controlledMode={controlledMode} />
      );

      const closeButton = screen.getByRole("button", { name: "" });
      expect(closeButton).toBeInTheDocument();
    });

    it("calls onExitControlledMode when exit button is clicked", async () => {
      const user = userEvent.setup();
      const controlledMode = {
        prefix: "/feedback|",
        icon: null,
        label: "Feedback Mode",
      };

      render(
        <MessageInput {...defaultProps} controlledMode={controlledMode} />
      );

      // Find the close icon button
      const closeButtons = screen.getAllByRole("button");
      const exitButton = closeButtons.find((button) =>
        button.querySelector("svg[data-testid='CloseIcon']")
      );

      expect(exitButton).toBeDefined();
      await user.click(exitButton!);

      expect(mockOnExitControlledMode).toHaveBeenCalled();
    });

    it("clears input when entering controlled mode", async () => {
      const { rerender } = render(
        <MessageInput {...defaultProps} />
      );

      const user = userEvent.setup();
      const input = screen.getByPlaceholderText(
        "Enter your message here"
      ) as HTMLInputElement;

      await user.type(input, "Some text");
      expect(input.value).toBe("Some text");

      // Enter controlled mode
      const controlledMode = {
        prefix: "/feedback|",
        icon: null,
        label: "Feedback Mode",
      };

      rerender(
        <MessageInput {...defaultProps} controlledMode={controlledMode} />
      );

      await waitFor(() => {
        expect(input.value).toBe("");
      });
    });
  });

  describe("Multiple Messages", () => {
    it("allows typing and sending multiple messages", async () => {
      const user = userEvent.setup();
      render(
        <MessageInput {...defaultProps} />
      );

      const input = screen.getByPlaceholderText("Enter your message here");

      // Send first message
      await user.type(input, "First message{Enter}");
      await waitFor(() => {
        expect(mockOnSendMessage).toHaveBeenCalledWith("First message");
      });

      // Send second message
      await user.type(input, "Second message{Enter}");
      await waitFor(() => {
        expect(mockOnSendMessage).toHaveBeenCalledWith("Second message");
      });

      expect(mockOnSendMessage).toHaveBeenCalledTimes(2);
    });
  });
});
