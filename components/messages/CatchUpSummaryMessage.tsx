import { FC } from 'react';
import { MessageProps } from '../../types.internal';
import { components } from '../../types';
import { formatTimeRange } from '../../utils/catchUp';
import { useBotName } from '../../context/ConversationTypeContext';

type CatchUpSummary = components['schemas']['CatchUpSummary'];

const headingClassName = 'text-[11px] font-bold uppercase tracking-[0.08em] text-gray-600';

export const CatchUpSummaryMessage: FC<MessageProps> = ({ message }) => {
  const botName = useBotName();
  const { passage, earlierSpeech, inShort, whatTheyCovered, comingUp } = message.body as CatchUpSummary;
  const timeRange = formatTimeRange(new Date(passage.start), new Date(passage.end));

  return (
    <div style={{ width: '85%' }}>
      <div className="flex flex-col gap-4 rounded-xl border border-[#A5B4FC] bg-white p-5 text-gray-900">
        {(timeRange || earlierSpeech) && (
          <div className="flex flex-col items-start gap-2">
            {timeRange && (
              <p className="rounded-full bg-[#EEF0FF] px-3 py-1 text-xs font-semibold text-[#4845D2]">{timeRange}</p>
            )}
            {earlierSpeech && (
              <p className="text-xs text-gray-600">
                Nothing was said in the last 60 seconds, so this covers what was said just before.
              </p>
            )}
          </div>
        )}

        <section className="flex flex-col gap-1.5">
          <h3 className={headingClassName}>In short</h3>
          <p className="text-[15px] leading-relaxed">{inShort}</p>
        </section>

        {whatTheyCovered.length > 0 && (
          <section className="flex flex-col gap-2">
            <h3 className={headingClassName}>What they covered</h3>
            <ul className="list-disc pl-5 flex flex-col gap-1.5 text-sm leading-normal">
              {whatTheyCovered.map((point, index) => (
                // The points never change after Berkie posts them, and two can share the same text.
                <li key={index}>{point}</li>
              ))}
            </ul>
          </section>
        )}

        {comingUp && (
          <section className="flex flex-col gap-1.5">
            <h3 className={headingClassName}>Coming up</h3>
            <p className="text-sm leading-normal">{comingUp}</p>
          </section>
        )}

        <p className="border-t border-[#EDE9FE] pt-3 text-xs leading-snug text-gray-500">
          Catch-ups are only for you. They aren&apos;t shared or counted toward Group Chat posts. {botName} summarizes what
          the speaker said; it doesn&apos;t check whether claims are correct.
        </p>
      </div>
    </div>
  );
};
