import React from "react";
import { render } from "@testing-library/react";
import { TranscriptIcon } from "../../components/TranscriptIcon";

describe("TranscriptIcon", () => {
  it("renders an SVG element", () => {
    const { container } = render(<TranscriptIcon />);
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("applies the given size as width and height", () => {
    const { container } = render(<TranscriptIcon size={32} />);
    const svg = container.querySelector("svg")!;
    expect(svg.getAttribute("width")).toBe("32");
    expect(svg.getAttribute("height")).toBe("32");
  });

  it("uses default size of 26 when no size prop given", () => {
    const { container } = render(<TranscriptIcon />);
    const svg = container.querySelector("svg")!;
    expect(svg.getAttribute("width")).toBe("26");
    expect(svg.getAttribute("height")).toBe("26");
  });

  it("applies the given color to all path fill attributes", () => {
    const { container } = render(<TranscriptIcon color="#9E9E9E" />);
    const paths = container.querySelectorAll("path");
    expect(paths.length).toBeGreaterThan(0);
    paths.forEach((path) => {
      expect(path.getAttribute("fill")).toBe("#9E9E9E");
    });
  });

  it("applies active color to all path fill attributes", () => {
    const { container } = render(<TranscriptIcon color="#1a1a1a" />);
    const paths = container.querySelectorAll("path");
    paths.forEach((path) => {
      expect(path.getAttribute("fill")).toBe("#1a1a1a");
    });
  });

  it("uses currentColor as default color", () => {
    const { container } = render(<TranscriptIcon />);
    const paths = container.querySelectorAll("path");
    paths.forEach((path) => {
      expect(path.getAttribute("fill")).toBe("currentColor");
    });
  });

  it("applies an extra className when provided", () => {
    const { container } = render(
      <TranscriptIcon className="my-custom-class" />,
    );
    const svg = container.querySelector("svg")!;
    expect(svg.classList.contains("my-custom-class")).toBe(true);
  });

  it("sets aria-hidden to true", () => {
    const { container } = render(<TranscriptIcon />);
    const svg = container.querySelector("svg")!;
    expect(svg.getAttribute("aria-hidden")).toBe("true");
  });

  it("renders exactly two paths (document and speaker shapes)", () => {
    const { container } = render(<TranscriptIcon />);
    const paths = container.querySelectorAll("path");
    expect(paths.length).toBe(2);
  });
});
