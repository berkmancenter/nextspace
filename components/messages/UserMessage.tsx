import { FC, useMemo } from "react";
import Linkify from "linkify-react";
import { MessageProps } from "../../types.internal";
import { parseMessageBody } from "../../utils/Helpers";
import { MENTION_DISPLAY_REGEX } from "../../utils/mentionRegex";

interface UserMessageProps extends MessageProps {
  contributors?: string[];
  backgroundColor?: string;
  isHovered?: boolean;
}

/**
 * Parse message text and highlight @mentions with linkification.
 * When a contributors list is provided the regex matches only known handles
 * (longest first, so "Bob Smith" is preferred over "Bob").
 * Falls back to the generic greedy display regex when no list is available.
 */
const renderMessageWithMentions = (
  text: string,
  contributors?: string[],
): React.ReactNode => {
  let splitPattern: RegExp;

  if (contributors && contributors.length > 0) {
    // Sort longest-first so multi-word handles are tried before shorter ones
    const escaped = [...contributors]
      .sort((a, b) => b.length - a.length)
      .map((c) => c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    splitPattern = new RegExp(`(@(?:${escaped.join("|")}))`, "gi");
  } else {
    splitPattern = new RegExp(`(${MENTION_DISPLAY_REGEX.source})`, "g");
  }

  const parts = text.split(splitPattern);

  return parts.map((part, index) => {
    // Check if this part is a mention
    if (part.startsWith("@")) {
      return (
        <span
          key={index}
          className="font-semibold"
          style={{ color: "#7C3AED" }}
        >
          {part}
        </span>
      );
    }
    // Apply linkification to non-mention text
    return (
      <Linkify
        key={index}
        options={{
          attributes: {
            class: "text-medium-slate-blue",
            target: "_blank",
            rel: "noopener noreferrer",
          },
        }}
      >
        {part}
      </Linkify>
    );
  });
};

export const UserMessage: FC<UserMessageProps> = ({
  message,
  contributors,
  backgroundColor = "#E8F0FE",
  isHovered = false,
}) => {
  const parsed = parseMessageBody(message.body);

  return (
    <div
      className="rounded-2xl px-2 py-1 text-gray-800 self-start"
      style={{
        backgroundColor: isHovered ? "white" : backgroundColor,
        width: "85%",
        border: "1px solid rgba(0, 0, 0, 0.1)",
      }}
    >
      {renderMessageWithMentions(parsed.text, contributors)}

      {/* Render media items */}
      {parsed.media && parsed.media.length > 0 && (
        <div
          style={{
            marginTop: "0.5rem",
            display: "flex",
            flexDirection: "column",
            gap: "0.5rem",
          }}
        >
          {parsed.media.map((item, index) => {
            if (item.type === "image") {
              const imgSrc = `data:${item.mimeType};base64,${item.data}`;
              return (
                <img
                  key={`media-${index}`}
                  src={imgSrc}
                  alt="Uploaded image"
                  style={{
                    maxWidth: "100%",
                    height: "auto",
                    borderRadius: "8px",
                    border: "1px solid rgba(0, 0, 0, 0.1)",
                  }}
                />
              );
            }
            return null;
          })}
        </div>
      )}
    </div>
  );
};
