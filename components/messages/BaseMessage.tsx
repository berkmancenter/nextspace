import { Box } from "@mui/material";
import { FC } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

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
  text: string;
  isFeedback?: boolean;
}

/**
 * MessageContent component - renders message text with linkification
 */
export const MessageContent: FC<MessageContentProps> = ({
  text,
  isFeedback = false,
}) => {
  const isFeedbackMessage = text.startsWith("/feedback");
  const displayText = isFeedbackMessage ? "User feedback received." : text;

  if (isFeedbackMessage || isFeedback) {
    return (
      <Box className="bg-blue-50 border border-blue-200 rounded-lg p-3">
        <p className="text-gray-700 italic text-sm">{displayText}</p>
      </Box>
    );
  }

  return (
    <div className="markdown-content">
      <Markdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ node, ...props }) => (
            <a
              {...props}
              className="text-medium-slate-blue"
              target="_blank"
              rel="noopener noreferrer"
            />
          ),
        }}
      >
        {displayText}
      </Markdown>
    </div>
  );
};
