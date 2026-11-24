import { FC, useEffect, useId, useRef, useState } from 'react';
import { MessageProps, UnpackExplanation, UnpackShareOutcome, UnpackShareState } from '../../types.internal';
import { useBotName } from '../../context/ConversationTypeContext';
import { unpackShareErrorCopy } from '../../utils/unpackPassage';

interface UnpackExplanationMessageProps extends MessageProps {
  /** Leave out where sharing isn't possible, such as after the event, which hides "Share to Group Chat". */
  onShareToGroupChat?: (messageId: string) => Promise<UnpackShareOutcome>;
  /** Opens Group Chat at the given post. */
  onOpenGroupChatPost?: (messageId: string) => void;
}

const headingClassName = 'text-xs font-semibold uppercase tracking-wider mb-1 text-mediumslateblue';

const formatSaidAt = (isoTime: string) =>
  new Date(isoTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });

const ShareToGroupChat: FC<{
  messageId: string;
  onShare: (messageId: string) => Promise<UnpackShareOutcome>;
  onOpenGroupChatPost?: (messageId: string) => void;
}> = ({ messageId, onShare, onOpenGroupChatPost }) => {
  const botName = useBotName();
  const hintId = useId();
  const statusId = useId();
  const statusRef = useRef<HTMLParagraphElement>(null);
  const seeItRef = useRef<HTMLButtonElement>(null);
  const [shareState, setShareState] = useState<UnpackShareState>({ phase: 'idle' });

  const outcome = shareState.phase === 'done' ? shareState.outcome : null;
  const shared = outcome?.ok ? outcome : null;
  const errorCopy = outcome && !outcome.ok ? unpackShareErrorCopy(outcome.reason, botName) : null;
  const canShare = shareState.phase !== 'sharing' && (errorCopy?.canSend ?? true);

  // The Share button is gone once shared, so focus would fall to the page unless it moves to what replaced it.
  useEffect(() => {
    if (shared) (seeItRef.current ?? statusRef.current)?.focus();
  }, [shared]);

  const handleShare = async () => {
    if (!canShare) return;
    setShareState({ phase: 'sharing' });
    setShareState({ phase: 'done', outcome: await onShare(messageId) });
  };

  if (shared) {
    return (
      <div className="flex flex-wrap items-center gap-3 px-4 py-3 bg-white border-t border-[#D1C4E9]">
        <p id={statusId} ref={statusRef} role="status" tabIndex={-1} className="font-semibold focus:outline-none">
          {shared.status === 'alreadyPosted'
            ? 'A post about this part of the talk is already in Group Chat.'
            : 'Shared to Group Chat, without your name.'}
        </p>
        {onOpenGroupChatPost && (
          <button
            ref={seeItRef}
            type="button"
            aria-describedby={statusId}
            onClick={() => onOpenGroupChatPost(shared.messageId)}
            className="rounded-lg border border-[#C7D2FE] bg-[#F5F3FF] px-3 py-1.5 text-sm font-semibold text-[#312E81] hover:bg-[#EDE9FE]"
          >
            See it in Group Chat
          </button>
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
        {shareState.phase === 'sharing' ? 'Sharing…' : 'The full explanation, posted now for everyone, without your name'}
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
}) => {
  const botName = useBotName();
  const { quote, passage, whatTheyreSaying, whyItMatters, terms, destination } = message.body as UnpackExplanation;

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
          <ShareToGroupChat messageId={message.id} onShare={onShareToGroupChat} onOpenGroupChatPost={onOpenGroupChatPost} />
        )}

        <p className="px-4 py-2 bg-white border-t border-[#D1C4E9] text-xs text-gray-600">
          {botName} unpacks what the speaker said. It doesn&apos;t check whether the claim is correct.
        </p>
      </div>
    </div>
  );
};
