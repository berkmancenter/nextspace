import { Box } from "@mui/material";
import { FC, useMemo } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { MarkmapView } from "../MarkmapView";
import { parseMessageBody } from "../../utils/Helpers";

/**
 * Props for BaseMessage component
 */
interface BaseMessageProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * BaseMessage component - provides common wrapper and styling
 */
export const BaseMessage: FC<BaseMessageProps> = ({
  children,
  className = "",
}) => {
  return (
    <Box display="flex" flexDirection="column" rowGap=".5rem">
      <div className={`block w-full my-1 ${className}`}>{children}</div>
    </Box>
  );
};

/**
 * Props for MessageContent component
 */
interface MessageContentProps {
  text: string | object;
  isFeedback?: boolean;
  onMarkmapClick?: (markdown: string) => void;
}

/**
 * MessageContent component - renders message text with linkification
 */
export const MessageContent: FC<MessageContentProps> = ({
  text,
  isFeedback = false,
  onMarkmapClick,
}) => {
  const parsed = parseMessageBody(text);
  const isFeedbackMessage = parsed.text.startsWith("/feedback");
  const displayText = isFeedbackMessage ? "User feedback received." : parsed.text;

  const markdownComponents = useMemo(
    () => ({
      a: ({ node, ...props }: any) => (
        <a
          {...props}
          className="text-medium-slate-blue"
          target="_blank"
          rel="noopener noreferrer"
        />
      ),
      code: ({ node, className, children, ...props }: any) => {
        const lang = /language-(\w+)/.exec(className || "")?.[1];
        const content = String(children);
        const hasMarkmapFrontMatter =
          /^---\s*\n[\s\S]*?\bmarkmap\s*:[\s\S]*?\n---/.test(content);
        if (lang === "markmap" || hasMarkmapFrontMatter) {
          return (
            <MarkmapView
              markdown={content}
              onClick={() => onMarkmapClick?.(content)}
            />
          );
        }
        return (
          <code className={className} {...props}>
            {children}
          </code>
        );
      },
    }),
    [onMarkmapClick]
  );

  if (isFeedbackMessage || isFeedback) {
    return (
      <Box className="bg-blue-50 border border-blue-200 rounded-lg p-3">
        <p className="text-gray-700 italic text-sm">{displayText}</p>
      </Box>
    );
  }

  return (
    <div className="markdown-content">
      <Markdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
        {displayText}
      </Markdown>
    </div>
  );
};
