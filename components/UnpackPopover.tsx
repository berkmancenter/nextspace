import React, { FC, useEffect, useId, useRef, useState } from 'react';
import { ClickAwayListener, Popper } from '@mui/material';
import type { Instance as PopperInstance } from '@popperjs/core';
import { Close, Lock } from '@mui/icons-material';
import { sendUnpackToPrivateChat, useUnpackPreview } from '../hooks/useUnpackPreview';
import { isScrollbarPress } from '../utils/Helpers';
import { useBotName } from '../context/ConversationTypeContext';
import { TranscriptChunkText, UnpackCloseReason, UnpackErrorReason, UnpackSendState, UnpackTarget } from '../types.internal';
import {
  alsoCoversLine,
  isPassageTooLong,
  passageKey,
  previewOpening,
  unpackErrorCopy,
  widenSelection,
} from '../utils/unpackPassage';

interface UnpackPopoverProps {
  conversationId: string;
  /** The server checks it against the transcript channel, as it does when the page reads the transcript. */
  transcriptPasscode?: string;
  target: UnpackTarget | null;
  /** The transcript chunks on the page, in spoken order. */
  chunks: TranscriptChunkText[];
  onClose: (reason: UnpackCloseReason) => void;
  /** Leave out when Private Chat is already on screen, which hides the "Open Private Chat" button. */
  onOpenPrivateChat?: () => void;
  /** Move focus into the popover, for when the keyboard opened it. */
  focusOnOpen?: boolean;
  /**
   * Change it whenever the page may have moved under the popover without scrolling, such as a new transcript
   * chunk arriving, so the popover re-measures where its passage is.
   */
  layoutVersion?: unknown;
}

const labelClassName = 'text-[11px] font-bold uppercase tracking-[0.08em]';

const TABBABLE = 'button, [href], input, [tabindex]:not([tabindex="-1"])';

const UnpackPopoverContent: FC<
  Omit<UnpackPopoverProps, 'target' | 'layoutVersion'> & {
    target: UnpackTarget;
    dialogRef: React.RefObject<HTMLElement | null>;
    titleId: string;
  }
> = ({
  conversationId,
  transcriptPasscode,
  target,
  chunks,
  onClose,
  onOpenPrivateChat,
  focusOnOpen,
  dialogRef,
  titleId,
}) => {
  const botName = useBotName();
  const sendLabelId = useId();
  const sendHintId = useId();
  const previewRef = useRef<HTMLDivElement>(null);
  const statusRef = useRef<HTMLDivElement>(null);
  const openPrivateChatRef = useRef<HTMLButtonElement>(null);
  const [sendState, setSendState] = useState<UnpackSendState>({ phase: 'idle' });

  const widened = widenSelection(chunks, target.selection);
  const tooLong = !!widened && isPassageTooLong(widened.quote);
  const { state: preview, retry } = useUnpackPreview(
    conversationId,
    widened && !tooLong ? widened.range : null,
    transcriptPasscode,
  );

  useEffect(() => {
    if (focusOnOpen) dialogRef.current?.focus();
  }, [focusOnOpen, dialogRef]);

  const quote = preview.status === 'ready' ? preview.explanation.quote : widened?.quote;
  const passageError: UnpackErrorReason | null = !widened ? 'selectionBackwards' : tooLong ? 'selectionTooLong' : null;
  const previewErrorCopy = passageError
    ? unpackErrorCopy(passageError, botName)
    : preview.status === 'error'
      ? unpackErrorCopy(preview.reason, botName)
      : null;
  const sendOutcome = sendState.phase === 'done' ? sendState.outcome : null;
  const sent = sendOutcome?.ok ? sendOutcome : null;
  const sendErrorCopy = sendOutcome && !sendOutcome.ok ? unpackErrorCopy(sendOutcome.reason, botName) : null;
  const canSend =
    !!widened && sendState.phase !== 'sending' && (previewErrorCopy?.canSend ?? true) && (sendErrorCopy?.canSend ?? true);

  // The Send button is gone once sent, so focus would fall to the page unless it moves to what replaced it.
  useEffect(() => {
    if (!sent) return;
    const active = document.activeElement;
    if (active && active !== document.body && !dialogRef.current?.contains(active)) return;
    (openPrivateChatRef.current ?? statusRef.current)?.focus();
  }, [sent, dialogRef]);

  const handleSend = async () => {
    if (!widened || !canSend) return;
    setSendState({ phase: 'sending' });
    setSendState({
      phase: 'done',
      outcome: await sendUnpackToPrivateChat(conversationId, widened.range, transcriptPasscode),
    });
  };

  const handleRetry = () => {
    retry();
    previewRef.current?.focus();
  };

  const handleOpenPrivateChat = () => {
    onOpenPrivateChat?.();
    onClose('openPrivateChat');
  };

  return (
    <>
      <div className="flex items-center justify-between">
        <h2 id={titleId} className="m-0 text-[15px] font-bold">
          Unpack this with {botName}
        </h2>
        <button
          type="button"
          aria-label="Close"
          onClick={() => onClose('closeButton')}
          className="flex h-7 w-7 items-center justify-center rounded-full border-0 bg-transparent text-[#4B5563] hover:bg-black/5"
        >
          <Close fontSize="small" aria-hidden="true" />
        </button>
      </div>

      <div className="flex flex-col gap-2.5">
        <div className="flex flex-col gap-1.5 rounded-[10px] bg-[#EDE9FE] px-3.5 py-3">
          <span className={`${labelClassName} text-[#4B5563]`}>What the speaker said</span>
          {quote && <p className="m-0 text-[13px] italic leading-normal text-[#374151]">&quot;{quote}&quot;</p>}
        </div>

        <div
          ref={previewRef}
          aria-live="polite"
          tabIndex={-1}
          className="flex flex-col gap-1.5 px-0.5 pt-0.5 focus:outline-none"
        >
          <span className={`${labelClassName} text-[#4845D2]`}>{botName}&apos;s explanation · Preview</span>
          {previewErrorCopy ? (
            <div className="flex flex-wrap items-center gap-3">
              <p className="m-0 text-[15px] text-[#B91C1C]">{previewErrorCopy.message}</p>
              {previewErrorCopy.canRetry && !passageError && (
                <button
                  type="button"
                  onClick={handleRetry}
                  className="rounded-lg border border-[#C7D2FE] bg-[#F5F3FF] px-3 py-1.5 text-sm font-semibold text-[#312E81] hover:bg-[#EDE9FE]"
                >
                  Try again
                </button>
              )}
            </div>
          ) : preview.status === 'ready' ? (
            <>
              <p className="m-0 text-[15px] leading-[1.55]">{previewOpening(preview.explanation.whatTheyreSaying)}</p>
              <p className="m-0 text-[13px] text-[#4B5563]">{alsoCoversLine(preview.explanation.terms.length)}</p>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <p className="m-0 text-[15px] text-[#4B5563]">{botName} is reading this</p>
              <svg
                data-testid="unpack-loading-dots"
                className="w-6 h-3 shrink-0 fill-[#4B5563]"
                viewBox="0 0 40 10"
                aria-hidden="true"
              >
                <circle className="motion-safe:animate-bounce" cx="5" cy="5" r="4" />
                <circle className="motion-safe:animate-bounce [animation-delay:-0.2s]" cx="20" cy="5" r="4" />
                <circle className="motion-safe:animate-bounce [animation-delay:-0.4s]" cx="35" cy="5" r="4" />
              </svg>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col items-start gap-2.5">
        {/* Stays on the page before sending, since screen readers skip a live region that arrives with its text. */}
        <div ref={statusRef} role="status" tabIndex={-1} className="focus:outline-none">
          {sent && (
            <p className="m-0 text-sm font-semibold">
              {sent.status === 'pending'
                ? `${botName} is finishing your explanation. It will appear in your Private Chat.`
                : 'Your explanation is in your Private Chat.'}
            </p>
          )}
        </div>
        {sent ? (
          onOpenPrivateChat && (
            <button
              ref={openPrivateChatRef}
              type="button"
              onClick={handleOpenPrivateChat}
              className="rounded-[10px] border-0 bg-[#4845D2] px-3.5 py-2.5 text-sm font-semibold text-white hover:bg-[#3B38B8]"
            >
              Open Private Chat
            </button>
          )
        ) : (
          <div className="flex w-full flex-col gap-2.5">
            <span className="text-sm font-semibold">Where should {botName} send the full explanation?</span>
            {/* aria-disabled, not disabled: a disabled button drops keyboard focus to the page. */}
            <button
              type="button"
              onClick={handleSend}
              aria-disabled={!canSend}
              aria-labelledby={sendLabelId}
              aria-describedby={sendHintId}
              className="flex flex-col gap-[3px] rounded-[10px] border-0 bg-[#4845D2] px-3.5 py-[11px] text-left text-white hover:bg-[#3B38B8] aria-disabled:cursor-not-allowed aria-disabled:opacity-60 sm:w-1/2"
            >
              <span id={sendLabelId} className="flex items-center gap-1.5 text-sm font-semibold">
                <Lock sx={{ fontSize: 15 }} aria-hidden="true" />
                Send to my Private Chat
              </span>
              <span id={sendHintId} className="text-xs text-[#E0E7FF]">
                {sendState.phase === 'sending' ? 'Sending…' : 'The full explanation, visible only to you'}
              </span>
            </button>
            {sendErrorCopy && (
              <p role="alert" className="m-0 text-sm text-[#B91C1C]">
                {sendErrorCopy.message}
              </p>
            )}
          </div>
        )}
      </div>

      <p className="m-0 text-xs text-[#6B7280]">Every ask is anonymous, including to organizers.</p>
    </>
  );
};

const chunkIdsInRange = (chunks: TranscriptChunkText[], { selection }: UnpackTarget): string[] => {
  const ids = chunks.map(({ id }) => id);
  return ids.slice(ids.indexOf(selection.startMessageId), ids.indexOf(selection.endMessageId) + 1);
};

export const UnpackPopover: FC<UnpackPopoverProps> = ({ target, onClose, layoutVersion, ...contentProps }) => {
  const popperRef = useRef<PopperInstance | null>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const titleId = useId();

  useEffect(() => {
    popperRef.current?.update();
  }, [layoutVersion]);

  const targetChunkIds = target ? chunkIdsInRange(contentProps.chunks, target).join(' ') : '';
  useEffect(() => {
    if (!targetChunkIds) return;
    const ownChunks = targetChunkIds.split(' ');
    // Escape belongs to whatever has focus; only claim it when focus is here, on the passage, or nowhere.
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      const active = document.activeElement;
      const chunkId = active?.closest('[data-message-id]')?.getAttribute('data-message-id');
      const focusIsOurs =
        !active ||
        active === document.body ||
        !!dialogRef.current?.contains(active) ||
        (!!chunkId && ownChunks.includes(chunkId));
      if (!focusIsOurs) return;
      // The page's own Escape listeners on window, such as leaving a slash command, would act on it too.
      event.stopPropagation();
      onCloseRef.current('escape');
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [targetChunkIds]);

  if (!target) return null;

  // The popover is portaled to the end of the page, so Tab past its edges would land there instead of back
  // in the transcript.
  const handleTabOut = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key !== 'Tab' || !dialogRef.current) return;
    const active = document.activeElement;
    if (!active) return;
    const tabbable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(TABBABLE));
    // Focus can rest on an element Tab skips, such as the sent confirmation, so compare page positions.
    const direction = event.shiftKey ? Node.DOCUMENT_POSITION_PRECEDING : Node.DOCUMENT_POSITION_FOLLOWING;
    if (tabbable.some((element) => active.compareDocumentPosition(element) & direction)) return;
    event.preventDefault();
    onClose('tabOut');
  };

  // A right-click or a scroll bar drag, such as scrolling the transcript to reread the passage, keeps it open.
  const handleClickAway = (event: MouseEvent | TouchEvent) => {
    if (event instanceof MouseEvent && (event.button !== 0 || isScrollbarPress(event))) return;
    onClose('clickAway');
  };

  return (
    <Popper
      open
      anchorEl={target.anchor}
      popperRef={popperRef}
      placement="bottom-start"
      style={{ zIndex: 1300 }}
      modifiers={[
        { name: 'offset', options: { offset: [0, 8] } },
        { name: 'preventOverflow', options: { padding: 16 } },
      ]}
    >
      {/* Mouse down, not click: the click that ends a drag-selection would otherwise close the popover it opened. */}
      <ClickAwayListener onClickAway={handleClickAway} mouseEvent="onMouseDown" touchEvent="onTouchStart">
        <section
          ref={dialogRef}
          role="dialog"
          aria-labelledby={titleId}
          tabIndex={-1}
          onKeyDown={handleTabOut}
          className="w-[min(540px,calc(100vw-32px))] box-border flex flex-col gap-5 rounded-2xl border-[1.5px] border-[#C7D2FE] bg-white p-6 text-[#0B0D0E] shadow-[0_6px_20px_rgba(72,69,210,0.14)] focus:outline-none focus-visible:outline-2 focus-visible:outline-[#4845D2]"
        >
          <UnpackPopoverContent
            key={passageKey(target.selection)}
            target={target}
            onClose={onClose}
            dialogRef={dialogRef}
            titleId={titleId}
            {...contentProps}
          />
        </section>
      </ClickAwayListener>
    </Popper>
  );
};
