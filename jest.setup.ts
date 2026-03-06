import "@testing-library/jest-dom";
import { TextEncoder, TextDecoder } from "util";

// Polyfill TextEncoder/TextDecoder for Node.js environment
global.TextEncoder = TextEncoder as typeof global.TextEncoder;
global.TextDecoder = TextDecoder as typeof global.TextDecoder;

// Mock react-markdown and remark-gfm since they're ESM-only
jest.mock("react-markdown", () => {
  const React = require("react");
  return {
    __esModule: true,
    default: ({
      children,
      components,
    }: {
      children: string;
      components?: any;
    }) => {
      // Parse markdown for code blocks and render custom components
      const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g;
      const parts: React.ReactNode[] = [];
      let lastIndex = 0;
      let match;
      let keyIndex = 0;

      while ((match = codeBlockRegex.exec(children)) !== null) {
        // Add text before code block
        if (match.index > lastIndex) {
          parts.push(
            React.createElement(
              "span",
              { key: `text-${keyIndex++}` },
              children.slice(lastIndex, match.index)
            )
          );
        }

        const [, lang, content] = match;

        // Call custom code component if provided
        if (components?.code) {
          const CodeComponent = components.code;
          parts.push(
            React.createElement(
              "span",
              { key: `code-${keyIndex++}` },
              CodeComponent({
                className: lang ? `language-${lang}` : undefined,
                children: content,
              })
            )
          );
        } else {
          parts.push(
            React.createElement("span", { key: `code-${keyIndex++}` }, content)
          );
        }

        lastIndex = match.index + match[0].length;
      }

      // Add remaining text
      if (lastIndex < children.length) {
        parts.push(
          React.createElement(
            "span",
            { key: `text-${keyIndex++}` },
            children.slice(lastIndex)
          )
        );
      }

      return parts.length > 0 ? parts : children;
    },
  };
});

jest.mock("remark-gfm", () => ({
  __esModule: true,
  default: () => {},
}));

// Mock markmap libraries
jest.mock("markmap-lib", () => ({
  Transformer: jest.fn().mockImplementation(() => ({
    transform: jest.fn((markdown: string) => ({
      root: { data: { content: markdown } },
    })),
  })),
}));

jest.mock("markmap-view", () => ({
  Markmap: {
    create: jest.fn(() => ({
      rescale: jest.fn(),
      fit: jest.fn(),
    })),
  },
}));
