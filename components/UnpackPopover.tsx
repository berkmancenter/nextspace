import React, { FC, useEffect, useId, useMemo, useRef, useState } from 'react';
import { ClickAwayListener, Popper } from '@mui/material';
import type { Instance as PopperInstance } from '@popperjs/core';
import { Close, Lock } from '@mui/icons-material';
import { sendUnpackToPrivateChat, useUnpackPreview } from '../hooks/useUnpackPreview';
import {
  TranscriptChunkText,
  UnpackCloseReason,
  UnpackErrorReason,
  UnpackSendOutcome,
  UnpackTarget,
} from '../types.internal';
import { alsoCoversLine, isPassageTooLong, previewOpening, unpackErrorCopy, widenSelection } from '../utils/unpackPassage';

interface UnpackPopoverProps {
  conversationId: string;
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

type SendState = { phase: 'idle' } | { phase: 'sending' } | { phase: 'done'; outcome: UnpackSendOutcome };

const labelClassName = 'text-[11px] font-bold uppercase tracking-[0.08em]';

const UnpackPopoverContent: FC<Omit<UnpackPopoverProps, 'target' | 'layoutVersion'> & { target: UnpackTarget }> = ({
  conversationId,
  target,
  chunks,
  onClose,
  onOpenPrivateChat,
  focusOnOpen,
}) => {
  const titleId = useId();
  const sendLabelId = useId();
  const sendHintId = useId();
  const dialogRef = useRef<HTMLElement>(null);
  const [sendState, setSendState] = useState<SendState>({ phase: 'idle' });

  // Chunks change as captions arrive, but the selected ones never do, so the widened range stays put.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const widened = useMemo(() => widenSelection(chunks, target.selection), [target.selection]);
  const tooLong = !!widened && isPassageTooLong(widened.quote);
  const { state: preview, retry } = useUnpackPreview(conversationId, widened && !tooLong ? widened.range : null);

  useEffect(() => {
    if (focusOnOpen) dialogRef.current?.focus();
  }, [focusOnOpen]);

  const quote = preview.status === 'ready' ? preview.explanation.quote : widened?.quote;
  const passageError: UnpackErrorReason | null = !widened ? 'selectionBackwards' : tooLong ? 'selectionTooLong' : null;
  const previewErrorCopy = passageError
    ? unpackErrorCopy(passageError)
    : preview.status === 'error'
      ? unpackErrorCopy(preview.reason)
      : null;
  const sendOutcome = sendState.phase === 'done' ? sendState.outcome : null;
  const sent = sendOutcome?.ok ? sendOutcome : null;
  const sendErrorCopy = sendOutcome && !sendOutcome.ok ? unpackErrorCopy(sendOutcome.reason) : null;
  const canSend =
    !!widened && sendState.phase !== 'sending' && (previewErrorCopy?.canSend ?? true) && (sendErrorCopy?.canSend ?? true);

  const handleSend = async () => {
    if (!widened || !canSend) return;
    setSendState({ phase: 'sending' });
    setSendState({ phase: 'done', outcome: await sendUnpackToPrivateChat(conversationId, widened.range) });
  };

  return (
    <section
      ref={dialogRef}
      role="dialog"
      aria-labelledby={titleId}
      tabIndex={-1}
      className="w-[min(540px,calc(100vw-32px))] box-border flex flex-col gap-5 rounded-2xl border-[1.5px] border-[#C7D2FE] bg-white p-6 text-[#0B0D0E] shadow-[0_6px_20px_rgba(72,69,210,0.14)] focus:outline-none focus-visible:outline-2 focus-visible:outline-[#4845D2]"
    >
      <div className="flex items-center justify-between">
        <h2 id={titleId} className="m-0 text-[15px] font-bold">
          Unpack this with Berkie
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

        <div aria-live="polite" className="flex flex-col gap-1.5 px-0.5 pt-0.5">
          <span className={`${labelClassName} text-[#4845D2]`}>Berkie&apos;s explanation · Preview</span>
          {previewErrorCopy ? (
            <div className="flex flex-wrap items-center gap-3">
              <p className="m-0 text-[15px] text-[#B91C1C]">{previewErrorCopy.message}</p>
              {previewErrorCopy.canRetry && !passageError && (
                <button
                  type="button"
                  onClick={retry}
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
            <p className="m-0 text-[15px] text-[#4B5563]">Berkie is reading this…</p>
          )}
        </div>
      </div>

      {sent ? (
        <div role="status" className="flex flex-col items-start gap-2.5">
          <p className="m-0 text-sm font-semibold">
            {sent.status === 'pending'
              ? 'Berkie is finishing your explanation. It will appear in your Private Chat.'
              : 'Your explanation is in your Private Chat.'}
          </p>
          {onOpenPrivateChat && (
            <button
              type="button"
              onClick={onOpenPrivateChat}
              className="rounded-[10px] border-0 bg-[#4845D2] px-3.5 py-2.5 text-sm font-semibold text-white hover:bg-[#3B38B8]"
            >
              Open Private Chat
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          <span className="text-sm font-semibold">Where should Berkie send the full explanation?</span>
          <button
            type="button"
            onClick={handleSend}
            disabled={!canSend}
            aria-labelledby={sendLabelId}
            aria-describedby={sendHintId}
            className="flex flex-col gap-[3px] rounded-[10px] border-0 bg-[#4845D2] px-3.5 py-[11px] text-left text-white hover:bg-[#3B38B8] disabled:cursor-not-allowed disabled:opacity-60 sm:w-1/2"
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

      <p className="m-0 text-xs text-[#6B7280]">Every ask is anonymous, including to organizers.</p>
    </section>
  );
};

const selectionKey = ({ selection }: UnpackTarget) =>
  `${selection.startMessageId}:${selection.startOffset}-${selection.endMessageId}:${selection.endOffset}`;

/** The "Unpack this with Berkie" popover: the quote, a preview of Berkie's explanation, and sending it. */
export const UnpackPopover: FC<UnpackPopoverProps> = ({ target, onClose, layoutVersion, ...contentProps }) => {
  const popperRef = useRef<PopperInstance | null>(null);

  useEffect(() => {
    popperRef.current?.update();
  }, [layoutVersion]);

  useEffect(() => {
    if (!target) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose('escape');
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [target, onClose]);

  if (!target) return null;

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
      <ClickAwayListener onClickAway={() => onClose('clickAway')} mouseEvent="onMouseDown" touchEvent="onTouchStart">
        <div>
          <UnpackPopoverContent key={selectionKey(target)} target={target} onClose={onClose} {...contentProps} />
        </div>
      </ClickAwayListener>
    </Popper>
  );
};
