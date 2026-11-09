import { FC } from 'react';
import { MessageProps } from '../../types.internal';
import { components } from '../../types';
import { formatTimeRange } from '../../utils/catchUp';
import { useBotName } from '../../context/ConversationTypeContext';
import { cardAccentSectionClassName, cardFrameClassName, cardLabelClassName, cardPlainSectionClassName } from './cardStyles';

type CatchUpSummary = components['schemas']['CatchUpSummary'];

const headingClassName = `${cardLabelClassName} mb-1`;

export const CatchUpSummaryMessage: FC<MessageProps> = ({ message }) => {
  const botName = useBotName();
  const { passage, earlierSpeech, inShort, whatTheyCovered, comingUp } = message.body as CatchUpSummary;

  return (
    <div style={{ width: '85%' }}>
      <div className={`${cardFrameClassName} text-sm text-gray-800`}>
        <div className="px-4 pt-3 text-xs text-gray-600">
          <p>{formatTimeRange(new Date(passage.start), new Date(passage.end))}</p>
          {earlierSpeech && (
            <p className="mt-1">Nothing was said in the last 60 seconds, so this covers what was said just before.</p>
          )}
        </div>

        <section className={cardPlainSectionClassName}>
          <h3 className={headingClassName}>In short</h3>
          <p>{inShort}</p>
        </section>

        {whatTheyCovered.length > 0 && (
          <section className={cardAccentSectionClassName}>
            <h3 className={headingClassName}>What they covered</h3>
            <ul className="list-disc pl-5 flex flex-col gap-1">
              {whatTheyCovered.map((point, index) => (
                // The points never change after Berkie posts them, and two can share the same text.
                <li key={index}>{point}</li>
              ))}
            </ul>
          </section>
        )}

        {comingUp && (
          <section className={cardPlainSectionClassName}>
            <h3 className={headingClassName}>Coming up</h3>
            <p>{comingUp}</p>
          </section>
        )}

        <p className="px-4 py-3 border-t border-[#D1C4E9] text-xs text-gray-600">
          Catch-ups are only for you. They aren&apos;t shared or counted toward Group Chat posts. {botName} summarizes what
          the speaker said; it doesn&apos;t check whether claims are correct.
        </p>
      </div>
    </div>
  );
};
