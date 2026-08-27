import { useMemo, useRef, useState, useEffect, useCallback, KeyboardEvent, ChangeEvent } from 'react';
import { IconButton } from '@mui/material';
import { BotIcon } from '../BotIcon';
import { GenericEnhancerMenu } from '../GenericEnhancerMenu';
import { createMentionsEnhancer } from '../enhancers/mentionsEnhancer';
import { ActiveEnhancerState } from '../../types/inputEnhancer';
import styles from './communityRoom.module.css';

interface CommunityMessageInputProps {
  tab: 'chat' | 'assistant';
  realName: string;
  mentionTargets: string[];
  onSendMessage: (message: string) => Promise<boolean>;
  isEmptyRoom?: boolean;
  waitingForResponse?: boolean;
  disabled?: boolean;
  /**
   * True while the socket is down. Typing and sending stay live, since sends are
   * held and delivered on reconnect; only the shortcuts pause.
   */
  offline?: boolean;
}

const PLACEHOLDER: Record<string, string> = {
  chat: 'Message the room',
  chatEmpty: 'Say the first thing',
  assistant: 'Ask Berkie',
};

/**
 * The room's composer. Forked from the shared MessageInput because the
 * Solar Signal design drops the pseudonym pill (rooms use real names) and
 * adds an "Ask Berkie" shortcut alongside the @ mention button.
 */
export function CommunityMessageInput({
  tab,
  realName,
  mentionTargets,
  onSendMessage,
  isEmptyRoom = false,
  waitingForResponse = false,
  disabled = false,
  offline = false,
}: CommunityMessageInputProps) {
  const [value, setValue] = useState('');
  const [activeEnhancer, setActiveEnhancer] = useState<ActiveEnhancerState<any> | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const enhancers = useMemo(
    () => (tab === 'chat' ? [createMentionsEnhancer([...mentionTargets, 'Berkie'])] : []),
    [tab, mentionTargets],
  );

  const detectTriggersForValue = useCallback(
    (text: string) => {
      const cursor = textareaRef.current?.selectionStart ?? text.length;
      for (const enhancer of enhancers) {
        const trigger = enhancer.detectTrigger(text, cursor);
        if (trigger) {
          const items = enhancer.getItems(trigger.query);
          if (items.length > 0) {
            setActiveEnhancer({ enhancer, items, selectedIndex: 0, trigger });
            return;
          }
        }
      }
      setActiveEnhancer(null);
    },
    [enhancers],
  );

  useEffect(() => {
    if (value) detectTriggersForValue(value);
    else setActiveEnhancer(null);
  }, [value, detectTriggersForValue]);

  const insertAtCursor = (text: string) => {
    const cursor = textareaRef.current?.selectionStart ?? value.length;
    const before = value.slice(0, cursor);
    const after = value.slice(cursor);
    const newValue = before + text + after;
    const newCursor = before.length + text.length;
    setValue(newValue);
    setTimeout(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(newCursor, newCursor);
    }, 0);
  };

  const handleEnhancerSelect = useCallback(
    (item: any) => {
      if (!activeEnhancer) return;
      const cursor = textareaRef.current?.selectionStart ?? value.length;
      const result = activeEnhancer.enhancer.onSelect(item, value, cursor);
      setValue(result.value);
      setActiveEnhancer(null);
      setTimeout(() => {
        textareaRef.current?.focus();
        textareaRef.current?.setSelectionRange(result.cursorPos, result.cursorPos);
      }, 0);
    },
    [activeEnhancer, value],
  );

  const handleSend = async () => {
    if (!value.trim() || waitingForResponse) return;
    const message = value;
    setValue('');
    const success = await onSendMessage(message);
    if (!success) setValue(message);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (activeEnhancer && (e.key === 'Enter' || e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'Tab')) {
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey && value.trim() && !waitingForResponse) {
      e.preventDefault();
      handleSend();
    }
  };

  useEffect(() => {
    const onWindowKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') setActiveEnhancer(null);
      if (!activeEnhancer || activeEnhancer.items.length === 0) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveEnhancer((prev) =>
          prev ? { ...prev, selectedIndex: prev.selectedIndex < prev.items.length - 1 ? prev.selectedIndex + 1 : 0 } : null,
        );
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveEnhancer((prev) =>
          prev ? { ...prev, selectedIndex: prev.selectedIndex > 0 ? prev.selectedIndex - 1 : prev.items.length - 1 } : null,
        );
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        handleEnhancerSelect(activeEnhancer.items[activeEnhancer.selectedIndex]);
      }
    };
    window.addEventListener('keydown', onWindowKeyDown);
    return () => window.removeEventListener('keydown', onWindowKeyDown);
  }, [activeEnhancer, handleEnhancerSelect]);

  const placeholder = tab === 'chat' ? (isEmptyRoom ? PLACEHOLDER.chatEmpty : PLACEHOLDER.chat) : PLACEHOLDER.assistant;
  const disclosure =
    tab === 'chat'
      ? `You're posting as ${realName} · Berkie reads every message`
      : 'Only you can see this conversation · Berkie reads every message';

  return (
    <div className={styles.composerWrap}>
      <div className={styles.composerBox}>
        <textarea
          ref={textareaRef}
          value={value}
          placeholder={placeholder}
          disabled={disabled}
          onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          className={styles.composerTextarea}
          rows={1}
        />
        <div className={styles.composerButtonRow}>
          <div className={styles.composerButtonGroup}>
            {tab === 'chat' && (
              <>
                <IconButton
                  aria-label="Mention a member"
                  aria-disabled={offline ? 'true' : undefined}
                  disabled={disabled}
                  onClick={() => !offline && insertAtCursor('@')}
                  className={`${styles.mentionButton}${offline ? ` ${styles.shortcutIdle}` : ''}`}
                >
                  <span aria-hidden="true" className={styles.mentionButtonInner}>
                    @
                  </span>
                </IconButton>
                <IconButton
                  aria-label="Ask Berkie"
                  aria-disabled={offline ? 'true' : undefined}
                  disabled={disabled}
                  onClick={() => !offline && insertAtCursor('@Berkie ')}
                  className={`${styles.askBerkieButton}${offline ? ` ${styles.shortcutIdle}` : ''}`}
                >
                  <BotIcon size={20} color="var(--room-berkie-accent)" />
                  <span className={styles.askBerkieLabel}>Ask Berkie</span>
                </IconButton>
              </>
            )}
          </div>
          <IconButton
            aria-label="Send message"
            aria-disabled={!value.trim() || disabled ? 'true' : undefined}
            disabled={disabled}
            onClick={handleSend}
            className={styles.sendButton}
          >
            <span
              aria-hidden="true"
              className={`${styles.sendButtonInner}${value.trim() ? '' : ` ${styles.sendButtonIdle}`}`}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="#fff" style={{ transform: 'rotate(-45deg)' }}>
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
              </svg>
            </span>
          </IconButton>
        </div>
      </div>
      <p className={styles.disclosure}>{disclosure}</p>

      {activeEnhancer && (
        <GenericEnhancerMenu
          items={activeEnhancer.items}
          selectedIndex={activeEnhancer.selectedIndex}
          onSelect={handleEnhancerSelect}
          renderItem={activeEnhancer.enhancer.renderItem}
          getItemKey={(_item, index) => `${activeEnhancer.enhancer.id}-${index}`}
          anchorEl={textareaRef.current}
          open={true}
        />
      )}
    </div>
  );
}
