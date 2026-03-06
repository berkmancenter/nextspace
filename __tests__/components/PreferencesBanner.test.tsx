import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PreferencesBanner, PreferenceOption } from "../../components/PreferencesBanner";

describe("PreferencesBanner", () => {
  const mockOptions: PreferenceOption[] = [
    {
      value: "visualResponse",
      label: "Visual Response",
      description: "Answer my questions with images when appropriate",
    },
    {
      value: "detailedAnswers",
      label: "Detailed Answers",
      description: "Provide more comprehensive responses",
    },
  ];

  const mockOnSubmit = jest.fn();
  const mockOnDismiss = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders with default title and description", () => {
    render(
      <PreferencesBanner options={mockOptions} onSubmit={mockOnSubmit} />
    );

    expect(screen.getByText("Set Your Preferences")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Help us personalize your experience by selecting your preferences below."
      )
    ).toBeInTheDocument();
  });

  it("renders with custom title and description", () => {
    render(
      <PreferencesBanner
        title="Custom Title"
        description="Custom description text"
        options={mockOptions}
        onSubmit={mockOnSubmit}
      />
    );

    expect(screen.getByText("Custom Title")).toBeInTheDocument();
    expect(screen.getByText("Custom description text")).toBeInTheDocument();
  });

  it("renders all preference options with labels and descriptions", () => {
    render(
      <PreferencesBanner options={mockOptions} onSubmit={mockOnSubmit} />
    );

    expect(screen.getByText("Visual Response")).toBeInTheDocument();
    expect(
      screen.getByText("Answer my questions with images when appropriate")
    ).toBeInTheDocument();
    expect(screen.getByText("Detailed Answers")).toBeInTheDocument();
    expect(
      screen.getByText("Provide more comprehensive responses")
    ).toBeInTheDocument();
  });

  it("renders Settings icon", () => {
    render(
      <PreferencesBanner options={mockOptions} onSubmit={mockOnSubmit} />
    );

    const settingsIcon = document.querySelector('[data-testid="SettingsIcon"]');
    expect(settingsIcon).toBeInTheDocument();
  });

  it("disables submit button when no options are selected", () => {
    render(
      <PreferencesBanner options={mockOptions} onSubmit={mockOnSubmit} />
    );

    const submitButton = screen.getByRole("button", {
      name: /Save Preferences/i,
    });
    expect(submitButton).toBeDisabled();
  });

  it("enables submit button when at least one option is selected", async () => {
    const user = userEvent.setup();
    render(
      <PreferencesBanner options={mockOptions} onSubmit={mockOnSubmit} />
    );

    const checkbox = screen.getByRole("checkbox", { name: /Visual Response/i });
    await user.click(checkbox);

    const submitButton = screen.getByRole("button", {
      name: /Save Preferences/i,
    });
    expect(submitButton).not.toBeDisabled();
  });

  it("toggles checkbox selection on click", async () => {
    const user = userEvent.setup();
    render(
      <PreferencesBanner options={mockOptions} onSubmit={mockOnSubmit} />
    );

    const checkbox = screen.getByRole("checkbox", { name: /Visual Response/i });
    expect(checkbox).not.toBeChecked();

    await user.click(checkbox);
    expect(checkbox).toBeChecked();

    await user.click(checkbox);
    expect(checkbox).not.toBeChecked();
  });

  it("allows multiple selections", async () => {
    const user = userEvent.setup();
    render(
      <PreferencesBanner options={mockOptions} onSubmit={mockOnSubmit} />
    );

    const visualCheckbox = screen.getByRole("checkbox", {
      name: /Visual Response/i,
    });
    const detailedCheckbox = screen.getByRole("checkbox", {
      name: /Detailed Answers/i,
    });

    await user.click(visualCheckbox);
    await user.click(detailedCheckbox);

    expect(visualCheckbox).toBeChecked();
    expect(detailedCheckbox).toBeChecked();
  });

  it("calls onSubmit with selected values when Save Preferences is clicked", async () => {
    const user = userEvent.setup();
    render(
      <PreferencesBanner options={mockOptions} onSubmit={mockOnSubmit} />
    );

    const visualCheckbox = screen.getByRole("checkbox", {
      name: /Visual Response/i,
    });
    const detailedCheckbox = screen.getByRole("checkbox", {
      name: /Detailed Answers/i,
    });

    await user.click(visualCheckbox);
    await user.click(detailedCheckbox);

    const submitButton = screen.getByRole("button", {
      name: /Save Preferences/i,
    });
    await user.click(submitButton);

    expect(mockOnSubmit).toHaveBeenCalledTimes(1);
    expect(mockOnSubmit).toHaveBeenCalledWith([
      "visualResponse",
      "detailedAnswers",
    ]);
  });

  it("calls onSubmit with only selected values", async () => {
    const user = userEvent.setup();
    render(
      <PreferencesBanner options={mockOptions} onSubmit={mockOnSubmit} />
    );

    const visualCheckbox = screen.getByRole("checkbox", {
      name: /Visual Response/i,
    });
    await user.click(visualCheckbox);

    const submitButton = screen.getByRole("button", {
      name: /Save Preferences/i,
    });
    await user.click(submitButton);

    expect(mockOnSubmit).toHaveBeenCalledWith(["visualResponse"]);
  });

  it("renders dismiss button when onDismiss is provided", () => {
    render(
      <PreferencesBanner
        options={mockOptions}
        onSubmit={mockOnSubmit}
        onDismiss={mockOnDismiss}
      />
    );

    expect(
      screen.getByRole("button", { name: /Skip for now/i })
    ).toBeInTheDocument();
  });

  it("does not render dismiss button when onDismiss is not provided", () => {
    render(
      <PreferencesBanner options={mockOptions} onSubmit={mockOnSubmit} />
    );

    expect(
      screen.queryByRole("button", { name: /Skip for now/i })
    ).not.toBeInTheDocument();
  });

  it("calls onDismiss when Skip for now button is clicked", async () => {
    const user = userEvent.setup();
    render(
      <PreferencesBanner
        options={mockOptions}
        onSubmit={mockOnSubmit}
        onDismiss={mockOnDismiss}
      />
    );

    const dismissButton = screen.getByRole("button", { name: /Skip for now/i });
    await user.click(dismissButton);

    expect(mockOnDismiss).toHaveBeenCalledTimes(1);
  });

  it("does not display error message when error is null", () => {
    render(
      <PreferencesBanner
        options={mockOptions}
        onSubmit={mockOnSubmit}
        error={null}
      />
    );

    const errorIcon = document.querySelector('[data-testid="ErrorOutlineIcon"]');
    expect(errorIcon).not.toBeInTheDocument();
  });

  it("displays error message when error is provided", () => {
    const errorMessage = "Failed to save preferences. Please try again.";
    render(
      <PreferencesBanner
        options={mockOptions}
        onSubmit={mockOnSubmit}
        error={errorMessage}
      />
    );

    expect(screen.getByText(errorMessage)).toBeInTheDocument();
    const errorIcon = document.querySelector('[data-testid="ErrorOutlineIcon"]');
    expect(errorIcon).toBeInTheDocument();
  });

  it("handles single option", async () => {
    const user = userEvent.setup();
    const singleOption = [mockOptions[0]];

    render(
      <PreferencesBanner options={singleOption} onSubmit={mockOnSubmit} />
    );

    const checkbox = screen.getByRole("checkbox", { name: /Visual Response/i });
    await user.click(checkbox);

    const submitButton = screen.getByRole("button", {
      name: /Save Preferences/i,
    });
    await user.click(submitButton);

    expect(mockOnSubmit).toHaveBeenCalledWith(["visualResponse"]);
  });

  it("renders option without description", () => {
    const optionWithoutDescription: PreferenceOption[] = [
      {
        value: "testOption",
        label: "Test Option",
      },
    ];

    render(
      <PreferencesBanner
        options={optionWithoutDescription}
        onSubmit={mockOnSubmit}
      />
    );

    expect(screen.getByText("Test Option")).toBeInTheDocument();
  });

  it("maintains selection state after multiple toggles", async () => {
    const user = userEvent.setup();
    render(
      <PreferencesBanner options={mockOptions} onSubmit={mockOnSubmit} />
    );

    const checkbox = screen.getByRole("checkbox", { name: /Visual Response/i });

    // Toggle on, off, on
    await user.click(checkbox);
    await user.click(checkbox);
    await user.click(checkbox);

    expect(checkbox).toBeChecked();

    const submitButton = screen.getByRole("button", {
      name: /Save Preferences/i,
    });
    await user.click(submitButton);

    expect(mockOnSubmit).toHaveBeenCalledWith(["visualResponse"]);
  });
});
