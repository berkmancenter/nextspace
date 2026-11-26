import { FC, forwardRef, useEffect, useId, useRef, useState } from 'react';
import { MessageProps, UnpackExplanation, UnpackShareOutcome, UnpackShareState } from '../../types.internal';
import { useBotName } from '../../context/ConversationTypeContext';
import { unpackShareErrorCopy } from '../../utils/unpackPassage';

interface UnpackExplanationMessageProps extends MessageProps {
  /** Leave out where sharing isn't possible, such as after the event, which hides "Share to Group Chat". */
  onShareToGroupChat?: (messageId: string) => Promise<UnpackShareOutcome>;
  /** Opens Group Chat at the given post. */
  onOpenGroupChatPost?: (messageId: string) => void;
  /** How an earlier share of this card went. The card is rebuilt on each tab switch, so the page keeps it. */
  shareOutcome?: UnpackShareOutcome;
}

const headingClassName = 'text-xs font-semibold uppercase tracking-wider mb-1 text-mediumslateblue';

const formatSaidAt = (isoTime: string) =>
  new Date(isoTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });

export const SeeItInGroupChatButton = forwardRef<HTMLButtonElement, { onClick: () => void; 'aria-describedby'?: string }>(
  function SeeItInGroupChatButton({ onClick, 'aria-describedby': describedBy }, ref) {
    return (
      <button
        ref={ref}
        type="button"
        aria-describedby={describedBy}
        onClick={onClick}
        className="rounded-lg border border-[#C7D2FE] bg-[#F5F3FF] px-3 py-1.5 text-sm font-semibold text-[#312E81] hover:bg-[#EDE9FE]"
      >
        See it in Group Chat
      </button>
    );
  },
);

const ShareToGroupChat: FC<{
  messageId: string;
  onShare: (messageId: string) => Promise<UnpackShareOutcome>;
  onOpenGroupChatPost?: (messageId: string) => void;
  earlierOutcome?: UnpackShareOutcome;
  sharingDisabled?: boolean;
}> = ({ messageId, onShare, onOpenGroupChatPost, earlierOutcome, sharingDisabled }) => {
  const botName = useBotName();
  const hintId = useId();
  const statusId = useId();
  const statusRef = useRef<HTMLParagraphElement>(null);
  const seeItRef = useRef<HTMLButtonElement>(null);
  const refusedRef = useRef<HTMLParagraphElement>(null);
  const [shareState, setShareState] = useState<UnpackShareState>(
    earlierOutcome ? { phase: 'done', outcome: earlierOutcome } : { phase: 'idle' },
  );
  const sharedJustNow = useRef(false);

  const outcome = shareState.phase === 'done' ? shareState.outcome : null;
  const shared = outcome?.ok ? outcome : null;
  const errorCopy = outcome && !outcome.ok ? unpackShareErrorCopy(outcome.reason, botName, outcome.message) : null;
  const canShare = shareState.phase !== 'sharing' && (errorCopy?.canSend ?? true);
  const refusedForGood = !!outcome && !outcome.ok && outcome.reason === 'sharingDisabled';

  // The Share button is gone once shared, so focus would fall to the page unless it moves to what replaced it.
  useEffect(() => {
    if (shared && sharedJustNow.current) (seeItRef.current ?? statusRef.current)?.focus();
  }, [shared]);

  useEffect(() => {
    if (refusedForGood && sharedJustNow.current) refusedRef.current?.focus();
  }, [refusedForGood]);

  const handleShare = async () => {
    if (!canShare) return;
    sharedJustNow.current = true;
    setShareState({ phase: 'sharing' });
    setShareState({ phase: 'done', outcome: await onShare(messageId) });
  };

  if (sharingDisabled || refusedForGood) {
    // A card that was never shared and loaded without sharing just has no button; a click needs an answer.
    if (!earlierOutcome?.ok && !refusedForGood) return null;
    return (
      <p ref={refusedRef} tabIndex={-1} className="px-4 py-3 bg-white border-t border-[#D1C4E9] focus:outline-none">
        Sharing options are not enabled for this post.
      </p>
    );
  }

  if (shared) {
    return (
      <div className="flex flex-wrap items-center gap-3 px-4 py-3 bg-white border-t border-[#D1C4E9]">
        <p id={statusId} ref={statusRef} role="status" tabIndex={-1} className="font-semibold focus:outline-none">
          {shared.status === 'alreadyPosted' ? shared.text : 'Shared to Group Chat.'}
        </p>
        {onOpenGroupChatPost && (
          <SeeItInGroupChatButton
            ref={seeItRef}
            aria-describedby={statusId}
            onClick={() => onOpenGroupChatPost(shared.messageId)}
          />
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start gap-2 px-4 py-3 bg-white border-t border-[#D1C4E9]">
      {/* aria-disabled, not disabled: a disabled button drops keyboard focus to the page. */}
      <button
        type="button"
        onClick={handleShare}
        aria-disabled={!canShare}
        aria-describedby={hintId}
        className="rounded-lg border border-[#C7D2FE] bg-white px-3 py-1.5 text-sm font-semibold text-[#312E81] hover:bg-[#F5F3FF] aria-disabled:cursor-not-allowed aria-disabled:opacity-60"
      >
        Share to Group Chat
      </button>
      <span id={hintId} className="text-xs text-gray-600">
        {shareState.phase === 'sharing' ? 'Sharing…' : 'Posts the full explanation to Group Chat under your name'}
      </span>
      {errorCopy && (
        <p role="alert" className="text-sm text-[#B91C1C]">
          {errorCopy.message}
        </p>
      )}
    </div>
  );
};

export const UnpackExplanationMessage: FC<UnpackExplanationMessageProps> = ({
  message,
  onShareToGroupChat,
  onOpenGroupChatPost,
  shareOutcome,
}) => {
  const botName = useBotName();
  const { quote, passage, whatTheyreSaying, whyItMatters, terms, destination, groupChatShare, sharingDisabled } =
    message.body as UnpackExplanation;
  // A share made on this visit is newer than what the card had when it loaded
  const earlierShareOutcome: UnpackShareOutcome | undefined =
    shareOutcome ?? (groupChatShare && { ok: true, ...groupChatShare });

  return (
    <div className="flex flex-col gap-3" style={{ width: '85%' }}>
      <div
        data-testid="unpack-ask"
        className="self-end max-w-[90%] rounded-2xl bg-[#F3D5DA] px-4 py-3 text-sm text-gray-900"
      >
        <p className="text-xs font-semibold uppercase tracking-wider mb-1 text-[#7F1D2D]">Unpack this</p>
        <p>&quot;{quote}&quot;</p>
      </div>

      <div
        data-testid="unpack-explanation"
        className="w-full rounded-xl overflow-hidden shadow-sm border border-[#D1C4E9] text-sm text-gray-800"
      >
        <p className="px-4 pt-3 bg-white">
          <span className="inline-block rounded-full bg-[#EEF0FF] px-2.5 py-0.5 text-xs font-semibold text-[#3730A3]">
            Said at {formatSaidAt(passage.start)}
          </span>
        </p>

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

        {onShareToGroupChat && message.id && destination === 'privateChat' && (
          <ShareToGroupChat
            messageId={message.id}
            onShare={onShareToGroupChat}
            onOpenGroupChatPost={onOpenGroupChatPost}
            earlierOutcome={earlierShareOutcome}
            sharingDisabled={sharingDisabled}
          />
        )}

        <p className="px-4 py-2 bg-white border-t border-[#D1C4E9] text-xs text-gray-600">
          {botName} unpacks what the speaker said. It doesn&apos;t check whether the claim is correct.
        </p>
      </div>
    </div>
  );
};
