import React from "react";
import { render, screen } from "@testing-library/react";
import {
  AssistantMessage,
  AssistantMessageProps,
} from "../../components/messages/AssistantMessage";
import { PseudonymousMessage } from "../../types.internal";

// Mock the BaseMessage component
jest.mock("../../components/messages/BaseMessage", () => ({
  BaseMessage: ({ children, className }: any) => (
    <div data-testid="base-message" className={className}>
      {children}
    </div>
  ),
  MessageContent: ({ text }: any) => <div data-testid="message-content">{text}</div>,
}));

describe("AssistantMessage", () => {
  const mockMessage: PseudonymousMessage = {
    id: "msg-1",
    body: "Hello, this is a test message",
    pseudonym: "Assistant",
    fromAgent: true,
    createdAt: new Date().toISOString(),
    channels: [],
  };

  describe("Basic message rendering", () => {
    it("renders message text without media", () => {
      render(<AssistantMessage message={mockMessage} />);

      expect(screen.getByTestId("message-content")).toHaveTextContent(
        "Hello, this is a test message"
      );
    });

    it("applies purple card styling when message has prompt options", () => {
      const messageWithPrompt: PseudonymousMessage = {
        ...mockMessage,
        prompt: {
          type: "singleChoice",
          options: [
            { label: "Option 1", value: "opt1" },
            { label: "Option 2", value: "opt2" },
          ],
        },
      };

      render(<AssistantMessage message={messageWithPrompt} />);

      const baseMessage = screen.getByTestId("base-message");
      expect(baseMessage).toHaveClass(
        "bg-purple-100",
        "border-l-4",
        "border-purple-500",
        "rounded-lg",
        "p-3"
      );
    });

    it("does not apply purple styling when message has no prompt options", () => {
      render(<AssistantMessage message={mockMessage} />);

      const baseMessage = screen.getByTestId("base-message");
      expect(baseMessage).not.toHaveClass("bg-purple-100");
    });
  });

  describe("Media rendering", () => {
    it("renders a single image", () => {
      const media = [
        {
          type: "image" as const,
          data: "base64encodeddata",
          mimeType: "image/png",
        },
      ];

      render(<AssistantMessage message={mockMessage} media={media} />);

      const images = screen.getAllByAltText("Visual response");
      expect(images).toHaveLength(1);
      expect(images[0]).toHaveAttribute(
        "src",
        "data:image/png;base64,base64encodeddata"
      );
      expect(images[0]).toHaveStyle({
        maxWidth: "100%",
        height: "auto",
        borderRadius: "8px",
      });
    });

    it("renders multiple images", () => {
      const media = [
        {
          type: "image" as const,
          data: "base64data1",
          mimeType: "image/png",
        },
        {
          type: "image" as const,
          data: "base64data2",
          mimeType: "image/jpeg",
        },
        {
          type: "image" as const,
          data: "base64data3",
          mimeType: "image/gif",
        },
      ];

      render(<AssistantMessage message={mockMessage} media={media} />);

      const images = screen.getAllByAltText("Visual response");
      expect(images).toHaveLength(3);
      expect(images[0]).toHaveAttribute(
        "src",
        "data:image/png;base64,base64data1"
      );
      expect(images[1]).toHaveAttribute(
        "src",
        "data:image/jpeg;base64,base64data2"
      );
      expect(images[2]).toHaveAttribute(
        "src",
        "data:image/gif;base64,base64data3"
      );
    });

    it("does not render images when media array is empty", () => {
      render(<AssistantMessage message={mockMessage} media={[]} />);

      expect(screen.queryByAltText("Visual response")).not.toBeInTheDocument();
    });

    it("does not render images when media is undefined", () => {
      render(<AssistantMessage message={mockMessage} />);

      expect(screen.queryByAltText("Visual response")).not.toBeInTheDocument();
    });

    it("renders images with proper container styling", () => {
      const media = [
        {
          type: "image" as const,
          data: "base64data",
          mimeType: "image/png",
        },
      ];

      const { container } = render(
        <AssistantMessage message={mockMessage} media={media} />
      );

      // Find the media container (Box component)
      const mediaContainer = container.querySelector('[data-testid="base-message"] > div');
      expect(mediaContainer).toBeInTheDocument();
    });

    it("does not render non-image media types", () => {
      const media = [
        {
          type: "audio" as const,
          data: "base64audiodata",
          mimeType: "audio/mp3",
        },
        {
          type: "video" as const,
          data: "base64videodata",
          mimeType: "video/mp4",
        },
      ];

      render(<AssistantMessage message={mockMessage} media={media} />);

      // Audio and video types should not render (future feature)
      expect(screen.queryByAltText("Visual response")).not.toBeInTheDocument();
    });

    it("renders mixed media with only images displayed", () => {
      const media = [
        {
          type: "image" as const,
          data: "base64imagedata",
          mimeType: "image/png",
        },
        {
          type: "audio" as const,
          data: "base64audiodata",
          mimeType: "audio/mp3",
        },
      ];

      render(<AssistantMessage message={mockMessage} media={media} />);

      const images = screen.getAllByAltText("Visual response");
      expect(images).toHaveLength(1);
    });

    it("handles different image MIME types correctly", () => {
      const mimeTypes = [
        "image/png",
        "image/jpeg",
        "image/gif",
        "image/webp",
        "image/svg+xml",
      ];

      mimeTypes.forEach((mimeType) => {
        const media = [
          {
            type: "image" as const,
            data: "testdata",
            mimeType,
          },
        ];

        const { unmount } = render(
          <AssistantMessage message={mockMessage} media={media} />
        );

        const image = screen.getByAltText("Visual response");
        expect(image).toHaveAttribute("src", `data:${mimeType};base64,testdata`);

        unmount();
      });
    });
  });

  describe("Prompt options", () => {
    it("renders prompt option buttons for singleChoice type", () => {
      const messageWithPrompt: PseudonymousMessage = {
        ...mockMessage,
        prompt: {
          type: "singleChoice",
          options: [
            { label: "Yes", value: "yes" },
            { label: "No", value: "no" },
            { label: "Maybe", value: "maybe" },
          ],
        },
      };

      render(<AssistantMessage message={messageWithPrompt} />);

      expect(screen.getByRole("button", { name: "Yes" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "No" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Maybe" })).toBeInTheDocument();
    });

    it("does not render buttons when prompt type is not singleChoice", () => {
      const messageWithPrompt: PseudonymousMessage = {
        ...mockMessage,
        prompt: {
          type: "multipleChoice" as any,
          options: [
            { label: "Option 1", value: "opt1" },
            { label: "Option 2", value: "opt2" },
          ],
        },
      };

      render(<AssistantMessage message={messageWithPrompt} />);

      expect(screen.queryByRole("button", { name: "Option 1" })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Option 2" })).not.toBeInTheDocument();
    });

    it("does not render buttons when options array is empty", () => {
      const messageWithPrompt: PseudonymousMessage = {
        ...mockMessage,
        prompt: {
          type: "singleChoice",
          options: [],
        },
      };

      render(<AssistantMessage message={messageWithPrompt} />);

      expect(screen.queryByRole("button")).not.toBeInTheDocument();
    });
  });

  describe("Integration: Media with prompts", () => {
    it("renders both media and prompt options together", () => {
      const messageWithPrompt: PseudonymousMessage = {
        ...mockMessage,
        prompt: {
          type: "singleChoice",
          options: [
            { label: "Like", value: "like" },
            { label: "Dislike", value: "dislike" },
          ],
        },
      };

      const media = [
        {
          type: "image" as const,
          data: "imagedata",
          mimeType: "image/png",
        },
      ];

      render(<AssistantMessage message={messageWithPrompt} media={media} />);

      // Both media and prompts should be present
      expect(screen.getByAltText("Visual response")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Like" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Dislike" })).toBeInTheDocument();
    });

    it("renders multiple images with prompt options", () => {
      const messageWithPrompt: PseudonymousMessage = {
        ...mockMessage,
        body: "Which image do you prefer?",
        prompt: {
          type: "singleChoice",
          options: [
            { label: "First", value: "1" },
            { label: "Second", value: "2" },
          ],
        },
      };

      const media = [
        {
          type: "image" as const,
          data: "image1",
          mimeType: "image/png",
        },
        {
          type: "image" as const,
          data: "image2",
          mimeType: "image/png",
        },
      ];

      render(<AssistantMessage message={messageWithPrompt} media={media} />);

      const images = screen.getAllByAltText("Visual response");
      expect(images).toHaveLength(2);
      expect(screen.getByRole("button", { name: "First" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Second" })).toBeInTheDocument();
    });
  });
});
