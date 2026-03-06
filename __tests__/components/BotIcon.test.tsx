import React from "react";
import { render } from "@testing-library/react";
import { BotIcon } from "../../components/BotIcon";

describe("BotIcon", () => {
  it("renders an SVG element", () => {
    const { container } = render(<BotIcon />);
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("applies the given size as width and height", () => {
    const { container } = render(<BotIcon size={32} />);
    const svg = container.querySelector("svg")!;
    expect(svg.getAttribute("width")).toBe("32");
    expect(svg.getAttribute("height")).toBe("32");
  });

  it("uses default size of 26 when no size prop given", () => {
    const { container } = render(<BotIcon />);
    const svg = container.querySelector("svg")!;
    expect(svg.getAttribute("width")).toBe("26");
    expect(svg.getAttribute("height")).toBe("26");
  });

  it("applies the given color to stroke and fill elements", () => {
    const { container } = render(<BotIcon color="#ff0000" />);
    const svg = container.querySelector("svg")!;
    expect(svg.getAttribute("stroke")).toBe("#ff0000");
    // Filled elements (circles) should also use the color
    const circles = container.querySelectorAll("circle");
    circles.forEach((circle) => {
      expect(circle.getAttribute("fill")).toBe("#ff0000");
    });
  });

  it("uses currentColor as default color", () => {
    const { container } = render(<BotIcon />);
    const svg = container.querySelector("svg")!;
    expect(svg.getAttribute("stroke")).toBe("currentColor");
  });

  it("applies an extra className when provided", () => {
    const { container } = render(<BotIcon className="my-custom-class" />);
    const svg = container.querySelector("svg")!;
    expect(svg.classList.contains("my-custom-class")).toBe(true);
  });

  it("adds animate-bounce class to the antenna dot (first circle) when bouncing is true", () => {
    const { container } = render(<BotIcon bouncing={true} />);
    // The SVG itself should NOT bounce
    const svg = container.querySelector("svg")!;
    expect(svg.classList.contains("animate-bounce")).toBe(false);
    // The first circle (antenna dot) should bounce
    const antennaDot = container.querySelector("circle")!;
    expect(antennaDot.classList.contains("animate-bounce")).toBe(true);
  });

  it("does not add animate-bounce class to anything when bouncing is false", () => {
    const { container } = render(<BotIcon bouncing={false} />);
    const svg = container.querySelector("svg")!;
    expect(svg.classList.contains("animate-bounce")).toBe(false);
    const antennaDot = container.querySelector("circle")!;
    expect(antennaDot.classList.contains("animate-bounce")).toBe(false);
  });

  it("sets aria-hidden to true", () => {
    const { container } = render(<BotIcon />);
    const svg = container.querySelector("svg")!;
    expect(svg.getAttribute("aria-hidden")).toBe("true");
  });
});
