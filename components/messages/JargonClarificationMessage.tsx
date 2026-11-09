import { FC } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { MessageProps } from '../../types.internal';
import { parseMessageBody } from '../../utils/Helpers';
import { cardAccentSectionClassName, cardFrameClassName, cardLabelClassName, cardPlainSectionClassName } from './cardStyles';

export const JargonClarificationMessage: FC<MessageProps> = ({ message }) => {
  const parsed = parseMessageBody(message.body);

  const sourceText =
    typeof message.body === 'object' && message.body !== null ? (message.body as Record<string, string>).sourceText : null;

  return (
    <div style={{ width: '85%' }}>
      <div className={cardFrameClassName}>
        {/* Original section */}
        {sourceText && (
          <div className={cardAccentSectionClassName}>
            <p className={`${cardLabelClassName} mb-1`}>Original</p>
            <p className="text-sm italic text-[#333]">{sourceText}</p>
          </div>
        )}

        {/* Plain English section */}
        <div className={cardPlainSectionClassName}>
          <p className={`${cardLabelClassName} mb-4`}>Plain English</p>
          <div className="markdown-content text-sm text-gray-800">
            <Markdown
              remarkPlugins={[remarkGfm]}
              components={{
                li: ({ node, ...props }) => <li {...props} className="my-3" />,
              }}
            >
              {/* Strip legacy summary section from older messages that were saved with it */}
              {parsed.text?.replace(/\*\*Summary:\*\*[\s\S]*?\n\n[\s\S]*?\n\n/, '')}
            </Markdown>
          </div>
        </div>
      </div>
    </div>
  );
};
