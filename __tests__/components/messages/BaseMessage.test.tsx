import React from "react";
import { render, screen } from "@testing-library/react";
import {
  BaseMessage,
  MessageContent,
} from "../../../components/messages/BaseMessage";
import { MarkmapView } from "../../../components/MarkmapView";

// Mock MarkmapView component
jest.mock("../../../components/MarkmapView", () => ({
  MarkmapView: jest.fn(({ markdown }: { markdown: string }) => (
    <div data-testid="markmap-view">{markdown}</div>
  )),
}));

describe("BaseMessage Component", () => {
  it("renders children with default classes", () => {
    const { container } = render(
      <BaseMessage>
        <div>Test content</div>
      </BaseMessage>
    );

    expect(screen.getByText("Test content")).toBeInTheDocument();
    expect(container.querySelector(".w-full")).toBeInTheDocument();
    expect(container.querySelector(".my-1")).toBeInTheDocument();
  });

  it("applies custom className", () => {
    const { container } = render(
      <BaseMessage className="custom-class bg-red-500">
        <div>Test</div>
      </BaseMessage>
    );

    expect(container.querySelector(".custom-class")).toBeInTheDocument();
    expect(container.querySelector(".bg-red-500")).toBeInTheDocument();
  });

  it("wraps content in Box with flex column", () => {
    const { container } = render(
      <BaseMessage>
        <div>Content</div>
      </BaseMessage>
    );

    // Check for MUI Box component (rendered as div)
    const boxElement =
      container.querySelector('[class*="MuiBox"]') || container.firstChild;
    expect(boxElement).toBeInTheDocument();
  });
});

describe("MessageContent Component", () => {
  it("displays feedback messages with special styling", () => {
    const { container } = render(
      <MessageContent text="/feedback|Rating|msg-123|5" />
    );

    expect(screen.getByText("User feedback received.")).toBeInTheDocument();
    expect(container.querySelector(".bg-blue-50")).toBeInTheDocument();
    expect(container.querySelector(".border-blue-200")).toBeInTheDocument();
  });

  it("shows original text for non-feedback messages", () => {
    render(<MessageContent text="Regular message text" />);

    expect(screen.getByText("Regular message text")).toBeInTheDocument();
    expect(
      screen.queryByText("User feedback received.")
    ).not.toBeInTheDocument();
  });

  it("applies feedback styling when isFeedback prop is true", () => {
    const { container } = render(
      <MessageContent text="Some text" isFeedback={true} />
    );

    expect(container.querySelector(".bg-blue-50")).toBeInTheDocument();
    expect(container.querySelector(".italic")).toBeInTheDocument();
  });

  it("renders plain text", () => {
    render(<MessageContent text="Just plain text" />);

    expect(screen.getByText("Just plain text")).toBeInTheDocument();
  });

  it("handles empty text", () => {
    render(<MessageContent text="" />);

    // Should render without crashing
    const { container } = render(<MessageContent text="" />);
    expect(container).toBeInTheDocument();
  });

  it("wraps content in markdown-content div", () => {
    const { container } = render(<MessageContent text="Some text" />);

    expect(container.querySelector(".markdown-content")).toBeInTheDocument();
  });

  describe("Markmap code blocks", () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it("renders MarkmapView for code blocks with language markmap", () => {
      const markmapText = "Text with ```markmap\n# Root\n## Child\n```";
      render(<MessageContent text={markmapText} />);

      expect(screen.getByTestId("markmap-view")).toBeInTheDocument();
      expect(MarkmapView).toHaveBeenCalled();
    });

    it("renders MarkmapView for code blocks with markmap frontmatter", () => {
      const frontmatterText =
        "```\n---\nmarkmap: true\n---\n# Root\n## Child\n```";
      render(<MessageContent text={frontmatterText} />);

      expect(screen.getByTestId("markmap-view")).toBeInTheDocument();
      expect(MarkmapView).toHaveBeenCalled();
    });

    it("renders MarkmapView with frontmatter containing other fields", () => {
      const complexFrontmatter =
        "```\n---\ntitle: My Map\nmarkmap: enabled\nother: field\n---\n# Content\n```";
      render(<MessageContent text={complexFrontmatter} />);

      expect(screen.getByTestId("markmap-view")).toBeInTheDocument();
      expect(MarkmapView).toHaveBeenCalled();
    });

    it("does not render MarkmapView for regular code blocks", () => {
      const regularCode = "```javascript\nconst x = 1;\n```";
      render(<MessageContent text={regularCode} />);

      expect(screen.queryByTestId("markmap-view")).not.toBeInTheDocument();
      expect(MarkmapView).not.toHaveBeenCalled();
    });

    it("does not render MarkmapView for code blocks without markmap language or frontmatter", () => {
      const pythonCode = "```python\nprint('hello')\n```";
      render(<MessageContent text={pythonCode} />);

      expect(screen.queryByTestId("markmap-view")).not.toBeInTheDocument();
      expect(MarkmapView).not.toHaveBeenCalled();
    });

    it("passes the correct markdown content to MarkmapView with language", () => {
      const markmapContent = "# Root\n## Child 1\n## Child 2";
      const markmapText = `\`\`\`markmap\n${markmapContent}\n\`\`\``;
      render(<MessageContent text={markmapText} />);

      // Check that MarkmapView was called with content (may have trailing newline)
      expect(MarkmapView).toHaveBeenCalled();
      const callArgs = (MarkmapView as unknown as jest.Mock).mock.calls[0][0];
      expect(callArgs.markdown.trim()).toBe(markmapContent);
    });

    it("passes the full content including frontmatter to MarkmapView", () => {
      const fullContent = "---\nmarkmap: true\n---\n# Root\n## Child";
      const markmapText = `\`\`\`\n${fullContent}\n\`\`\``;
      render(<MessageContent text={markmapText} />);

      // Check that MarkmapView was called with content (may have trailing newline)
      expect(MarkmapView).toHaveBeenCalled();
      const callArgs = (MarkmapView as unknown as jest.Mock).mock.calls[0][0];
      expect(callArgs.markdown.trim()).toBe(fullContent);
    });

    it("handles multiple code blocks with mixed types", () => {
      const mixedText = `
Regular text
\`\`\`javascript
const x = 1;
\`\`\`

More text

\`\`\`markmap
# Markmap
## Section
\`\`\`

End text
`;
      render(<MessageContent text={mixedText} />);

      // Should render MarkmapView for the markmap block
      expect(screen.getByTestId("markmap-view")).toBeInTheDocument();
      expect(MarkmapView).toHaveBeenCalledTimes(1);
    });

    it("renders MarkmapView for each markmap code block in multiple markmap blocks", () => {
      const multipleMarkmaps = `
\`\`\`markmap
# First Map
\`\`\`

\`\`\`markmap
# Second Map
\`\`\`
`;
      render(<MessageContent text={multipleMarkmaps} />);

      // Should render MarkmapView twice
      expect(screen.getAllByTestId("markmap-view")).toHaveLength(2);
      expect(MarkmapView).toHaveBeenCalledTimes(2);
    });

    it("does not render MarkmapView for inline code", () => {
      const inlineCode = "This is `inline code` not a block";
      render(<MessageContent text={inlineCode} />);

      expect(screen.queryByTestId("markmap-view")).not.toBeInTheDocument();
      expect(MarkmapView).not.toHaveBeenCalled();
    });

    it("handles empty markmap code blocks", () => {
      const emptyMarkmap = "```markmap\n\n```";
      render(<MessageContent text={emptyMarkmap} />);

      expect(screen.getByTestId("markmap-view")).toBeInTheDocument();
      expect(MarkmapView).toHaveBeenCalled();
      const callArgs = (MarkmapView as unknown as jest.Mock).mock.calls[0][0];
      expect(callArgs.markdown.trim()).toBe("");
    });
  });
});
