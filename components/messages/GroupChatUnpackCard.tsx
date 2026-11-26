import { FC, useId } from 'react';
import { Share } from '@mui/icons-material';
import { PseudonymousMessage, UnpackExplanation } from '../../types.internal';

interface GroupChatUnpackCardProps {
  message: PseudonymousMessage;
}

export const groupChatMessageElementId = (messageId: string) => `group-chat-message-${messageId}`;

export const GroupChatUnpackCard: FC<GroupChatUnpackCardProps> = ({ message }) => {
  const explanation = message.body as UnpackExplanation;
  const { headline, quote, whatTheyreSaying, whyItMatters, footer } = explanation;
  const labelId = useId();
  const headlineId = useId();

  return (
    <div className="flex w-full max-w-[560px] flex-col gap-1.5">
      <article
        id={message.id ? groupChatMessageElementId(message.id) : undefined}
        tabIndex={-1}
        aria-labelledby={headline ? headlineId : labelId}
        className="flex flex-col gap-3 rounded-[14px] border border-[#DDD6FE] bg-[#FBFAFF] px-[18px] py-4 text-[#0B0D0E] focus:outline-none focus-visible:outline-2 focus-visible:outline-[#4845D2]"
      >
        <div className="flex flex-col gap-1">
          <p id={labelId} className="m-0 text-[11px] font-bold uppercase tracking-[0.08em] text-[#4B5563]">
            Unpacking a moment from the talk
          </p>
          {headline && (
            <h3 id={headlineId} className="m-0 text-base font-bold leading-[1.35]">
              {headline}
            </h3>
          )}
        </div>

        <blockquote className="m-0 rounded-lg bg-[#EEF0FF] px-3 py-2.5 text-[13px] italic leading-[1.45] text-[#1F2937]">
          &quot;{quote}&quot;
        </blockquote>

        <section className="flex flex-col gap-2">
          <h4 className="sr-only">In plain words</h4>
          <p className="m-0 text-sm leading-[1.55]">{whatTheyreSaying}</p>
        </section>

        <details className="group rounded-lg border border-[#C7D2FE] bg-white">
          <summary className="cursor-pointer list-none px-[13px] py-2 text-[13px] font-semibold text-[#312E81] hover:bg-[#F5F3FF] [&::-webkit-details-marker]:hidden">
            <span aria-hidden="true" className="mr-1.5 inline-block transition-transform group-open:rotate-90">
              ›
            </span>
            Why it matters
          </summary>
          <p className="m-0 px-[13px] pb-3 text-sm leading-[1.55]">{whyItMatters}</p>
        </details>
      </article>

      {footer && (
        <p className="m-0 flex items-center gap-1.5 text-xs text-[#4B5563]">
          <Share sx={{ fontSize: 13 }} aria-hidden="true" />
          {footer}
        </p>
      )}
    </div>
  );
};
