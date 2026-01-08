import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  SlashCommandMenu,
  SlashCommand,
} from "../../components/SlashCommandMenu";

describe("SlashCommandMenu", () => {
  const mockCommands: SlashCommand[] = [
    {
      command: "mod",
      description: "Submit a question to the moderator",
      value: "/mod ",
    },
    {
      command: "help",
      description: "Show available commands",
      value: "/help ",
    },
    {
      command: "feedback",
      description: "Provide feedback",
    },
  ];

  const mockOnSelect = jest.fn();
  let mockAnchorEl: HTMLDivElement;

  beforeEach(() => {
    jest.clearAllMocks();
    // Mock scrollIntoView
    HTMLElement.prototype.scrollIntoView = jest.fn();
    // Create a mock anchor element
    mockAnchorEl = document.createElement("div");
    document.body.appendChild(mockAnchorEl);
    // Set position for the anchor element
    jest.spyOn(mockAnchorEl, "getBoundingClientRect").mockReturnValue({
      top: 500,
      left: 100,
      bottom: 520,
      right: 400,
      width: 300,
      height: 20,
      x: 100,
      y: 500,
      toJSON: () => {},
    } as DOMRect);
  });

  afterEach(() => {
    document.body.removeChild(mockAnchorEl);
  });

  it("renders nothing when open is false", () => {
    const { container } = render(
      <SlashCommandMenu
        commands={mockCommands}
        selectedIndex={0}
        onSelect={mockOnSelect}
        anchorEl={mockAnchorEl}
        open={false}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when anchorEl is null", () => {
    const { container } = render(
      <SlashCommandMenu
        commands={mockCommands}
        selectedIndex={0}
        onSelect={mockOnSelect}
        anchorEl={null}
        open={true}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when commands array is empty", () => {
    const { container } = render(
      <SlashCommandMenu
        commands={[]}
        selectedIndex={0}
        onSelect={mockOnSelect}
        anchorEl={mockAnchorEl}
        open={true}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it("renders all commands when open", () => {
    render(
      <SlashCommandMenu
        commands={mockCommands}
        selectedIndex={0}
        onSelect={mockOnSelect}
        anchorEl={mockAnchorEl}
        open={true}
      />
    );

    expect(screen.getByText("/mod")).toBeInTheDocument();
    expect(
      screen.getByText("Submit a question to the moderator")
    ).toBeInTheDocument();
    expect(screen.getByText("/help")).toBeInTheDocument();
    expect(screen.getByText("Show available commands")).toBeInTheDocument();
    expect(screen.getByText("/feedback")).toBeInTheDocument();
    expect(screen.getByText("Provide feedback")).toBeInTheDocument();
  });

  it("highlights the selected command", () => {
    const { rerender } = render(
      <SlashCommandMenu
        commands={mockCommands}
        selectedIndex={0}
        onSelect={mockOnSelect}
        anchorEl={mockAnchorEl}
        open={true}
      />
    );

    // First command should be selected
    const firstMenuItem = screen.getByText("/mod").closest("li");
    expect(firstMenuItem).toHaveClass("Mui-selected");

    // Rerender with different selected index
    rerender(
      <SlashCommandMenu
        commands={mockCommands}
        selectedIndex={1}
        onSelect={mockOnSelect}
        anchorEl={mockAnchorEl}
        open={true}
      />
    );

    // Second command should now be selected
    const secondMenuItem = screen.getByText("/help").closest("li");
    expect(secondMenuItem).toHaveClass("Mui-selected");
  });

  it("calls onSelect when a command is clicked", async () => {
    const user = userEvent.setup();
    render(
      <SlashCommandMenu
        commands={mockCommands}
        selectedIndex={0}
        onSelect={mockOnSelect}
        anchorEl={mockAnchorEl}
        open={true}
      />
    );

    const modCommand = screen.getByText("/mod");
    await user.click(modCommand);

    expect(mockOnSelect).toHaveBeenCalledTimes(1);
    expect(mockOnSelect).toHaveBeenCalledWith(mockCommands[0]);
  });

  it("calls onSelect with correct command when different commands are clicked", async () => {
    const user = userEvent.setup();
    render(
      <SlashCommandMenu
        commands={mockCommands}
        selectedIndex={0}
        onSelect={mockOnSelect}
        anchorEl={mockAnchorEl}
        open={true}
      />
    );

    const helpCommand = screen.getByText("/help");
    await user.click(helpCommand);

    expect(mockOnSelect).toHaveBeenCalledTimes(1);
    expect(mockOnSelect).toHaveBeenCalledWith(mockCommands[1]);
  });

  it("positions menu above the anchor element", () => {
    const { container } = render(
      <SlashCommandMenu
        commands={mockCommands}
        selectedIndex={0}
        onSelect={mockOnSelect}
        anchorEl={mockAnchorEl}
        open={true}
      />
    );

    const menu = container.firstChild as HTMLElement;
    expect(menu).toHaveStyle({ position: "fixed" });

    // Menu should be positioned above the anchor (bottom style should be calculated)
    const computedStyle = window.getComputedStyle(menu);
    expect(computedStyle.position).toBe("fixed");
  });

  it("handles command without custom value", async () => {
    const user = userEvent.setup();
    render(
      <SlashCommandMenu
        commands={mockCommands}
        selectedIndex={0}
        onSelect={mockOnSelect}
        anchorEl={mockAnchorEl}
        open={true}
      />
    );

    // Click the feedback command which has no custom value
    const feedbackCommand = screen.getByText("/feedback");
    await user.click(feedbackCommand);

    expect(mockOnSelect).toHaveBeenCalledWith(mockCommands[2]);
  });

  it("displays commands in monospace font", () => {
    render(
      <SlashCommandMenu
        commands={mockCommands}
        selectedIndex={0}
        onSelect={mockOnSelect}
        anchorEl={mockAnchorEl}
        open={true}
      />
    );

    const commandText = screen.getByText("/mod");
    expect(commandText).toHaveStyle({ fontFamily: "monospace" });
  });

  it("scrolls selected item into view when selectedIndex changes", async () => {
    const scrollIntoViewMock = jest.fn();
    HTMLElement.prototype.scrollIntoView = scrollIntoViewMock;

    const { rerender } = render(
      <SlashCommandMenu
        commands={mockCommands}
        selectedIndex={0}
        onSelect={mockOnSelect}
        anchorEl={mockAnchorEl}
        open={true}
      />
    );

    // Change selected index
    rerender(
      <SlashCommandMenu
        commands={mockCommands}
        selectedIndex={2}
        onSelect={mockOnSelect}
        anchorEl={mockAnchorEl}
        open={true}
      />
    );

    await waitFor(() => {
      expect(scrollIntoViewMock).toHaveBeenCalled();
    });
  });

  it("renders with single command", () => {
    const singleCommand: SlashCommand[] = [
      {
        command: "solo",
        description: "Single command",
      },
    ];

    render(
      <SlashCommandMenu
        commands={singleCommand}
        selectedIndex={0}
        onSelect={mockOnSelect}
        anchorEl={mockAnchorEl}
        open={true}
      />
    );

    expect(screen.getByText("/solo")).toBeInTheDocument();
    expect(screen.getByText("Single command")).toBeInTheDocument();
  });

  it("handles very long command descriptions", () => {
    const longDescriptionCommand: SlashCommand[] = [
      {
        command: "long",
        description:
          "This is a very long description that might wrap to multiple lines and should be handled gracefully by the component",
      },
    ];

    render(
      <SlashCommandMenu
        commands={longDescriptionCommand}
        selectedIndex={0}
        onSelect={mockOnSelect}
        anchorEl={mockAnchorEl}
        open={true}
      />
    );

    expect(screen.getByText("/long")).toBeInTheDocument();
    expect(
      screen.getByText(
        "This is a very long description that might wrap to multiple lines and should be handled gracefully by the component"
      )
    ).toBeInTheDocument();
  });

  it("handles hover states correctly", async () => {
    const user = userEvent.setup();
    render(
      <SlashCommandMenu
        commands={mockCommands}
        selectedIndex={0}
        onSelect={mockOnSelect}
        anchorEl={mockAnchorEl}
        open={true}
      />
    );

    const helpCommand = screen.getByText("/help").closest("li");

    // Hover over the element
    await user.hover(helpCommand!);

    // The element should still be in the document and clickable
    expect(helpCommand).toBeInTheDocument();
  });

  it("maintains menu visibility with many commands", () => {
    const manyCommands: SlashCommand[] = Array.from({ length: 10 }, (_, i) => ({
      command: `cmd${i}`,
      description: `Description for command ${i}`,
    }));

    const { container } = render(
      <SlashCommandMenu
        commands={manyCommands}
        selectedIndex={0}
        onSelect={mockOnSelect}
        anchorEl={mockAnchorEl}
        open={true}
      />
    );

    // Menu should have max height constraint
    const menu = container.firstChild as HTMLElement;
    expect(menu).toHaveStyle({ maxHeight: "300px" });
    expect(menu).toHaveStyle({ overflow: "auto" });
  });

  it("handles rapid command selection", async () => {
    const user = userEvent.setup();
    render(
      <SlashCommandMenu
        commands={mockCommands}
        selectedIndex={0}
        onSelect={mockOnSelect}
        anchorEl={mockAnchorEl}
        open={true}
      />
    );

    const modCommand = screen.getByText("/mod");
    const helpCommand = screen.getByText("/help");

    // Click multiple commands rapidly
    await user.click(modCommand);
    await user.click(helpCommand);

    expect(mockOnSelect).toHaveBeenCalledTimes(2);
    expect(mockOnSelect).toHaveBeenNthCalledWith(1, mockCommands[0]);
    expect(mockOnSelect).toHaveBeenNthCalledWith(2, mockCommands[1]);
  });

  it("applies correct z-index for overlay", () => {
    const { container } = render(
      <SlashCommandMenu
        commands={mockCommands}
        selectedIndex={0}
        onSelect={mockOnSelect}
        anchorEl={mockAnchorEl}
        open={true}
      />
    );

    const menu = container.firstChild as HTMLElement;

    // Should have high z-index to appear above other elements
    expect(menu).toHaveStyle({ zIndex: 1400 });
  });
});
