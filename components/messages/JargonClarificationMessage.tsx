import { FC } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { MessageProps } from "../../types.internal";
import { parseMessageBody } from "../../utils/Helpers";

export const JargonClarificationMessage: FC<MessageProps> = ({ message }) => {
  const parsed = parseMessageBody(message.body);

  const sourceText =
    typeof message.body === "object" && message.body !== null
      ? (message.body as Record<string, string>).sourceText
      : null;

  return (
    <div style={{ width: "85%" }}>
      <div className="w-full rounded-xl overflow-hidden shadow-sm border border-[#D1C4E9]">
        {/* Original section */}
        {sourceText && (
          <div className="px-4 py-3 bg-[#F3F0FF] border-l-[3px] border-l-mediumslateblue">
            <p className="text-xs font-semibold uppercase tracking-wider mb-1 text-mediumslateblue">
              Original
            </p>
            <p className="text-sm italic text-[#333]">{sourceText}</p>
          </div>
        )}

        {/* Plain English section */}
        <div className="px-4 py-3 bg-white border-l-[3px] border-l-[#7B78E5]">
          <p className="text-xs font-semibold uppercase tracking-wider mb-4 text-mediumslateblue">
            Plain English
          </p>
          <div className="markdown-content text-sm text-gray-800">
            <Markdown
              remarkPlugins={[remarkGfm]}
              components={{
                li: ({ node, ...props }) => (
                  <li {...props} className="my-3" />
                ),
              }}
            >
              {/* Strip legacy summary section from older messages that were saved with it */}
              {parsed.text?.replace(/\*\*Summary:\*\*[\s\S]*?\n\n/, "")}
            </Markdown>
          </div>
        </div>
      </div>
    </div>
  );
};
