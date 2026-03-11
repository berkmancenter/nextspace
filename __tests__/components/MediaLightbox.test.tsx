import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MediaLightbox } from "../../components/MediaLightbox";

// Mock the MarkmapView component
jest.mock("../../components/MarkmapView", () => ({
  MarkmapView: ({ markdown, fullscreen }: any) => (
    <div data-testid="markmap-view" data-markdown={markdown} data-fullscreen={fullscreen}>
      Mocked MarkmapView
    </div>
  ),
}));

describe("MediaLightbox Component", () => {
  const mockOnClose = jest.fn();
  const sampleImageSrc = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
  const sampleMarkdown = "# Test Mindmap\n## Child Node";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Image Lightbox", () => {
    it("renders image lightbox when open", () => {
      render(
        <MediaLightbox
          open={true}
          onClose={mockOnClose}
          mediaType="image"
          mediaSrc={sampleImageSrc}
          mimeType="image/png"
          isMobile={false}
        />
      );

      const image = screen.getByAltText("Visual response");
      expect(image).toBeInTheDocument();
      expect(image).toHaveAttribute("src", sampleImageSrc);
    });

    it("renders close button for image lightbox", () => {
      render(
        <MediaLightbox
          open={true}
          onClose={mockOnClose}
          mediaType="image"
          mediaSrc={sampleImageSrc}
          mimeType="image/png"
          isMobile={false}
        />
      );

      const closeButton = screen.getByLabelText("Close lightbox");
      expect(closeButton).toBeInTheDocument();
    });

    it("calls onClose when close button is clicked", async () => {
      const user = userEvent.setup();
      render(
        <MediaLightbox
          open={true}
          onClose={mockOnClose}
          mediaType="image"
          mediaSrc={sampleImageSrc}
          mimeType="image/png"
          isMobile={false}
        />
      );

      const closeButton = screen.getByLabelText("Close lightbox");
      await user.click(closeButton);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it("renders zoom controls for image lightbox", () => {
      render(
        <MediaLightbox
          open={true}
          onClose={mockOnClose}
          mediaType="image"
          mediaSrc={sampleImageSrc}
          mimeType="image/png"
          isMobile={false}
        />
      );

      expect(screen.getByLabelText("Zoom out")).toBeInTheDocument();
      expect(screen.getByLabelText("Reset zoom")).toBeInTheDocument();
      expect(screen.getByLabelText("Zoom in")).toBeInTheDocument();
    });

    it("displays 100% as initial zoom level", () => {
      render(
        <MediaLightbox
          open={true}
          onClose={mockOnClose}
          mediaType="image"
          mediaSrc={sampleImageSrc}
          mimeType="image/png"
          isMobile={false}
        />
      );

      const resetButton = screen.getByLabelText("Reset zoom");
      expect(resetButton).toHaveTextContent("100%");
    });

    it("increases zoom level when zoom in is clicked", async () => {
      const user = userEvent.setup();
      render(
        <MediaLightbox
          open={true}
          onClose={mockOnClose}
          mediaType="image"
          mediaSrc={sampleImageSrc}
          mimeType="image/png"
          isMobile={false}
        />
      );

      const zoomInButton = screen.getByLabelText("Zoom in");
      await user.click(zoomInButton);

      const resetButton = screen.getByLabelText("Reset zoom");
      expect(resetButton).toHaveTextContent("150%");
    });

    it("decreases zoom level when zoom out is clicked", async () => {
      const user = userEvent.setup();
      render(
        <MediaLightbox
          open={true}
          onClose={mockOnClose}
          mediaType="image"
          mediaSrc={sampleImageSrc}
          mimeType="image/png"
          isMobile={false}
        />
      );

      // First zoom in
      const zoomInButton = screen.getByLabelText("Zoom in");
      await user.click(zoomInButton);

      // Then zoom out
      const zoomOutButton = screen.getByLabelText("Zoom out");
      await user.click(zoomOutButton);

      const resetButton = screen.getByLabelText("Reset zoom");
      expect(resetButton).toHaveTextContent("100%");
    });

    it("resets zoom to 100% when reset button is clicked", async () => {
      const user = userEvent.setup();
      render(
        <MediaLightbox
          open={true}
          onClose={mockOnClose}
          mediaType="image"
          mediaSrc={sampleImageSrc}
          mimeType="image/png"
          isMobile={false}
        />
      );

      // Zoom in twice
      const zoomInButton = screen.getByLabelText("Zoom in");
      await user.click(zoomInButton);
      await user.click(zoomInButton);

      // Reset
      const resetButton = screen.getByLabelText("Reset zoom");
      await user.click(resetButton);

      expect(resetButton).toHaveTextContent("100%");
    });

    it("disables zoom out button at minimum zoom", async () => {
      const user = userEvent.setup();
      render(
        <MediaLightbox
          open={true}
          onClose={mockOnClose}
          mediaType="image"
          mediaSrc={sampleImageSrc}
          mimeType="image/png"
          isMobile={false}
        />
      );

      const zoomOutButton = screen.getByLabelText("Zoom out");
      // Initially at 100%, should not be disabled (min is 50%)
      expect(zoomOutButton).not.toBeDisabled();

      // Zoom out to minimum (50%)
      await user.click(zoomOutButton);

      // Now should be disabled
      expect(zoomOutButton).toBeDisabled();
    });

    it("disables zoom in button at maximum zoom", async () => {
      const user = userEvent.setup();
      render(
        <MediaLightbox
          open={true}
          onClose={mockOnClose}
          mediaType="image"
          mediaSrc={sampleImageSrc}
          mimeType="image/png"
          isMobile={false}
        />
      );

      const zoomInButton = screen.getByLabelText("Zoom in");

      // Zoom in to max (from 1 to 4 with 0.5 steps = 6 clicks)
      for (let i = 0; i < 6; i++) {
        await user.click(zoomInButton);
      }

      expect(zoomInButton).toBeDisabled();
    });
  });

  describe("Mindmap Lightbox", () => {
    it("renders mindmap lightbox when open", () => {
      render(
        <MediaLightbox
          open={true}
          onClose={mockOnClose}
          mediaType="mindmap"
          mediaSrc={sampleMarkdown}
          isMobile={false}
        />
      );

      const markmapView = screen.getByTestId("markmap-view");
      expect(markmapView).toBeInTheDocument();
      expect(markmapView).toHaveAttribute("data-markdown", sampleMarkdown);
      expect(markmapView).toHaveAttribute("data-fullscreen", "true");
    });

    it("renders close button for mindmap lightbox", () => {
      render(
        <MediaLightbox
          open={true}
          onClose={mockOnClose}
          mediaType="mindmap"
          mediaSrc={sampleMarkdown}
          isMobile={false}
        />
      );

      const closeButton = screen.getByLabelText("Close lightbox");
      expect(closeButton).toBeInTheDocument();
    });

    it("does not render image zoom controls for mindmap", () => {
      render(
        <MediaLightbox
          open={true}
          onClose={mockOnClose}
          mediaType="mindmap"
          mediaSrc={sampleMarkdown}
          isMobile={false}
        />
      );

      expect(screen.queryByLabelText("Zoom out")).not.toBeInTheDocument();
      expect(screen.queryByLabelText("Reset zoom")).not.toBeInTheDocument();
      expect(screen.queryByLabelText("Zoom in")).not.toBeInTheDocument();
    });

    it("does not render image element for mindmap", () => {
      render(
        <MediaLightbox
          open={true}
          onClose={mockOnClose}
          mediaType="mindmap"
          mediaSrc={sampleMarkdown}
          isMobile={false}
        />
      );

      expect(screen.queryByAltText("Visual response")).not.toBeInTheDocument();
    });
  });

  describe("Desktop vs Mobile", () => {
    it("renders with desktop dimensions for desktop image", () => {
      render(
        <MediaLightbox
          open={true}
          onClose={mockOnClose}
          mediaType="image"
          mediaSrc={sampleImageSrc}
          mimeType="image/png"
          isMobile={false}
        />
      );

      // Verify desktop rendering by checking content is present
      expect(screen.getByAltText("Visual response")).toBeInTheDocument();
      expect(screen.getByLabelText("Close lightbox")).toBeInTheDocument();
    });

    it("renders with desktop dimensions for desktop mindmap", () => {
      render(
        <MediaLightbox
          open={true}
          onClose={mockOnClose}
          mediaType="mindmap"
          mediaSrc={sampleMarkdown}
          isMobile={false}
        />
      );

      // Verify desktop rendering by checking content is present
      expect(screen.getByTestId("markmap-view")).toBeInTheDocument();
      expect(screen.getByLabelText("Close lightbox")).toBeInTheDocument();
    });

    it("renders fullscreen for mobile", () => {
      render(
        <MediaLightbox
          open={true}
          onClose={mockOnClose}
          mediaType="image"
          mediaSrc={sampleImageSrc}
          mimeType="image/png"
          isMobile={true}
        />
      );

      // Verify mobile rendering by checking content is present
      expect(screen.getByAltText("Visual response")).toBeInTheDocument();
      expect(screen.getByLabelText("Close lightbox")).toBeInTheDocument();
    });
  });

  describe("Open/Close Behavior", () => {
    it("does not render when closed", () => {
      render(
        <MediaLightbox
          open={false}
          onClose={mockOnClose}
          mediaType="image"
          mediaSrc={sampleImageSrc}
          mimeType="image/png"
          isMobile={false}
        />
      );

      expect(screen.queryByAltText("Visual response")).not.toBeInTheDocument();
    });

    it("resets zoom when reopening", async () => {
      const user = userEvent.setup();
      const { rerender } = render(
        <MediaLightbox
          open={true}
          onClose={mockOnClose}
          mediaType="image"
          mediaSrc={sampleImageSrc}
          mimeType="image/png"
          isMobile={false}
        />
      );

      // Zoom in
      const zoomInButton = screen.getByLabelText("Zoom in");
      await user.click(zoomInButton);

      let resetButton = screen.getByLabelText("Reset zoom");
      expect(resetButton).toHaveTextContent("150%");

      // Close
      rerender(
        <MediaLightbox
          open={false}
          onClose={mockOnClose}
          mediaType="image"
          mediaSrc={sampleImageSrc}
          mimeType="image/png"
          isMobile={false}
        />
      );

      // Reopen
      rerender(
        <MediaLightbox
          open={true}
          onClose={mockOnClose}
          mediaType="image"
          mediaSrc={sampleImageSrc}
          mimeType="image/png"
          isMobile={false}
        />
      );

      resetButton = screen.getByLabelText("Reset zoom");
      expect(resetButton).toHaveTextContent("100%");
    });
  });

  describe("Accessibility", () => {
    it("has proper ARIA labels", () => {
      render(
        <MediaLightbox
          open={true}
          onClose={mockOnClose}
          mediaType="image"
          mediaSrc={sampleImageSrc}
          mimeType="image/png"
          isMobile={false}
        />
      );

      const dialog = screen.getByRole("dialog");
      expect(dialog).toHaveAttribute("aria-labelledby", "media-lightbox-title");
      expect(dialog).toHaveAttribute("aria-describedby", "media-lightbox-description");
    });

    it("close button has accessible label", () => {
      render(
        <MediaLightbox
          open={true}
          onClose={mockOnClose}
          mediaType="image"
          mediaSrc={sampleImageSrc}
          mimeType="image/png"
          isMobile={false}
        />
      );

      const closeButton = screen.getByLabelText("Close lightbox");
      expect(closeButton).toBeInTheDocument();
    });

    it("zoom controls have accessible labels for images", () => {
      render(
        <MediaLightbox
          open={true}
          onClose={mockOnClose}
          mediaType="image"
          mediaSrc={sampleImageSrc}
          mimeType="image/png"
          isMobile={false}
        />
      );

      expect(screen.getByLabelText("Zoom out")).toBeInTheDocument();
      expect(screen.getByLabelText("Reset zoom")).toBeInTheDocument();
      expect(screen.getByLabelText("Zoom in")).toBeInTheDocument();
    });
  });
});
