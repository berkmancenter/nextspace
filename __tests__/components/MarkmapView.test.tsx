import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MarkmapView } from "../../components/MarkmapView";

// Mock markmap libraries
const mockRescale = jest.fn();
const mockFit = jest.fn();
const mockCreate = jest.fn(() => ({
  rescale: mockRescale,
  fit: mockFit,
}));

jest.mock("markmap-lib", () => ({
  Transformer: jest.fn().mockImplementation(() => ({
    transform: jest.fn((markdown: string) => ({
      root: { data: { content: markdown } },
    })),
  })),
}));

jest.mock("markmap-view", () => ({
  Markmap: {
    create: mockCreate,
  },
  deriveOptions: jest.fn((options) => options || {}),
}));

describe("MarkmapView Component", () => {
  const sampleMarkdown = `
# Root
## Child 1
- Item 1
- Item 2
## Child 2
- Item 3
`;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock getBoundingClientRect to return valid dimensions for SVG
    Element.prototype.getBoundingClientRect = jest.fn(() => ({
      width: 800,
      height: 400,
      top: 0,
      left: 0,
      bottom: 400,
      right: 800,
      x: 0,
      y: 0,
      toJSON: () => {},
    }));
  });

  it("renders the component with controls", () => {
    render(<MarkmapView markdown={sampleMarkdown} />);

    expect(screen.getByLabelText("Zoom out mind map")).toBeInTheDocument();
    expect(screen.getByLabelText("Fit mind map to container")).toBeInTheDocument();
    expect(screen.getByLabelText("Zoom in mind map")).toBeInTheDocument();
  });

  it("renders zoom out button with minus sign", () => {
    render(<MarkmapView markdown={sampleMarkdown} />);

    const zoomOutButton = screen.getByLabelText("Zoom out mind map");
    expect(zoomOutButton).toHaveTextContent("−");
  });

  it("renders fit button", () => {
    render(<MarkmapView markdown={sampleMarkdown} />);

    const fitButton = screen.getByLabelText("Fit mind map to container");
    expect(fitButton).toHaveTextContent("fit");
  });

  it("renders zoom in button with plus sign", () => {
    render(<MarkmapView markdown={sampleMarkdown} />);

    const zoomInButton = screen.getByLabelText("Zoom in mind map");
    expect(zoomInButton).toHaveTextContent("+");
  });

  it("renders an SVG element", () => {
    const { container } = render(<MarkmapView markdown={sampleMarkdown} />);

    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveStyle({ width: "100%", height: "400px" });
  });

  it("creates markmap on mount", async () => {
    render(<MarkmapView markdown={sampleMarkdown} />);

    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalled();
    }, { timeout: 3000 });
  });

  it("calls rescale with zoom factor when zoom in is clicked", async () => {
    const user = userEvent.setup();
    render(<MarkmapView markdown={sampleMarkdown} />);

    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalled();
    }, { timeout: 3000 });

    const zoomInButton = screen.getByLabelText("Zoom in mind map");
    await user.click(zoomInButton);

    expect(mockRescale).toHaveBeenCalledWith(1.5);
  });

  it("calls rescale with inverse zoom factor when zoom out is clicked", async () => {
    const user = userEvent.setup();
    render(<MarkmapView markdown={sampleMarkdown} />);

    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalled();
    }, { timeout: 3000 });

    const zoomOutButton = screen.getByLabelText("Zoom out mind map");
    await user.click(zoomOutButton);

    expect(mockRescale).toHaveBeenCalledWith(1 / 1.5);
  });

  it("calls fit when fit button is clicked", async () => {
    const user = userEvent.setup();
    render(<MarkmapView markdown={sampleMarkdown} />);

    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalled();
    }, { timeout: 3000 });

    const fitButton = screen.getByLabelText("Fit mind map to container");
    await user.click(fitButton);

    expect(mockFit).toHaveBeenCalled();
  });

  it("handles multiple zoom in clicks", async () => {
    const user = userEvent.setup();
    render(<MarkmapView markdown={sampleMarkdown} />);

    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalled();
    }, { timeout: 3000 });

    const zoomInButton = screen.getByLabelText("Zoom in mind map");
    await user.click(zoomInButton);
    await user.click(zoomInButton);
    await user.click(zoomInButton);

    expect(mockRescale).toHaveBeenCalledTimes(3);
    expect(mockRescale).toHaveBeenCalledWith(1.5);
  });

  it("re-creates markmap when markdown changes", async () => {
    const { rerender } = render(<MarkmapView markdown={sampleMarkdown} />);

    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalledTimes(1);
    }, { timeout: 3000 });

    const newMarkdown = "# New Root\n## New Child";
    rerender(<MarkmapView markdown={newMarkdown} />);

    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalledTimes(2);
    }, { timeout: 3000 });
  });

  it("does not re-create markmap when markdown stays the same", async () => {
    const { rerender } = render(<MarkmapView markdown={sampleMarkdown} />);

    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalledTimes(1);
    }, { timeout: 3000 });

    rerender(<MarkmapView markdown={sampleMarkdown} />);

    // Should not call create again
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it("applies proper styling classes to buttons", () => {
    render(<MarkmapView markdown={sampleMarkdown} />);

    const buttons = screen.getAllByRole("button");
    buttons.forEach((button) => {
      expect(button).toHaveClass("px-2", "py-0.5", "text-sm", "rounded");
      expect(button).toHaveClass(
        "bg-gray-200",
        "hover:bg-gray-300",
        "text-gray-700"
      );
    });
  });

  it("renders controls in the correct order", () => {
    render(<MarkmapView markdown={sampleMarkdown} />);

    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(3);
    expect(buttons[0]).toHaveAttribute("aria-label", "Zoom out mind map");
    expect(buttons[1]).toHaveAttribute("aria-label", "Fit mind map to container");
    expect(buttons[2]).toHaveAttribute("aria-label", "Zoom in mind map");
  });

  it("handles empty markdown", async () => {
    render(<MarkmapView markdown="" />);

    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalled();
    }, { timeout: 3000 });

    // Should still render controls
    expect(screen.getByLabelText("Zoom in mind map")).toBeInTheDocument();
  });

  it("cleans up markmap reference on unmount", async () => {
    const { unmount } = render(<MarkmapView markdown={sampleMarkdown} />);

    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalled();
    }, { timeout: 3000 });

    // Unmount should not throw
    expect(() => unmount()).not.toThrow();
  });
});
