import { FC } from 'react';
import { MessageProps, UnpackExplanation } from '../../types.internal';
import { useBotName } from '../../context/ConversationTypeContext';

const headingClassName = 'text-xs font-semibold uppercase tracking-wider mb-1 text-mediumslateblue';

const formatSaidAt = (isoTime: string) =>
  new Date(isoTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });

export const UnpackExplanationMessage: FC<MessageProps> = ({ message }) => {
  const botName = useBotName();
  const { quote, passage, whatTheyreSaying, whyItMatters, terms } = message.body as UnpackExplanation;

  return (
    <div style={{ width: '85%' }}>
      <div className="w-full rounded-xl overflow-hidden shadow-sm border border-[#D1C4E9] text-sm text-gray-800">
        <section className="px-4 py-3 bg-[#F3F0FF] border-l-[3px] border-l-mediumslateblue">
          <p className="text-xs font-semibold uppercase tracking-wider mb-1 text-gray-600">Unpack this</p>
          <p className="italic text-gray-700">&quot;{quote}&quot;</p>
          <p className="mt-1 text-xs text-gray-600">Said at {formatSaidAt(passage.start)}</p>
        </section>

        <section className="px-4 py-3 bg-white border-l-[3px] border-l-[#7B78E5]">
          <h3 className={headingClassName}>In plain words</h3>
          <p>{whatTheyreSaying}</p>
        </section>

        <section className="px-4 py-3 bg-white border-l-[3px] border-l-[#7B78E5]">
          <h3 className={headingClassName}>Why it matters here</h3>
          <p>{whyItMatters}</p>
        </section>

        {terms.length > 0 && (
          <section className="px-4 py-3 bg-white border-t border-[#D1C4E9] border-l-[3px] border-l-[#7B78E5]">
            <h3 className={headingClassName}>Terms in this passage</h3>
            <dl className="flex flex-col gap-2">
              {terms.map(({ term, text }, index) => (
                <div key={`${term}-${index}`}>
                  <dt className="font-semibold">{term}</dt>
                  <dd>{text}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}

        <p className="px-4 py-2 bg-white border-t border-[#D1C4E9] text-xs text-gray-600">
          {botName} unpacks what the speaker said. It doesn&apos;t check whether the claim is correct.
        </p>
      </div>
    </div>
  );
};
