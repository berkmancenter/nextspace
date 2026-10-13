import { useCallback, useMemo, useState } from 'react';
import { PseudonymousMessage } from '../types.internal';
import { parseMessageBody } from '../utils/Helpers';

export interface JargonTerm {
  id: string;
  term: string;
  definition: string;
  quote?: string;
  createdAt: string;
}

export interface UseJargonTermsReturn {
  /** Full, un-windowed history of every term seen this session — for a future Resources-tab glossary. */
  terms: JargonTerm[];
  /** Terms from only the latest jargon_clarification message, unless that message was dismissed. */
  batchTerms: JargonTerm[];
  seen: boolean;
  active: boolean;
  markSeen: () => void;
  dismiss: () => void;
}

interface JargonTermEntry {
  term?: string;
  text?: string;
  sourceText?: string;
}

function snippet(text: string | undefined): string {
  if (!text) return '';
  return text.length > 40 ? `${text.slice(0, 40).trim()}…` : text;
}

/**
 * True only when `terms` holds per-term objects (`{ term, text, sourceText? }`). Events from
 * before the jargon channel stored a flat list of term names with one shared definition; those
 * return false and show as ordinary assistant messages instead.
 */
export function isStructuredJargonMessage(message: PseudonymousMessage): boolean {
  if (parseMessageBody(message.body).type !== 'jargon_clarification') return false;
  const body = message.body as { terms?: unknown };
  return Array.isArray(body.terms) && body.terms.length > 0 && typeof body.terms[0] === 'object';
}

/** Pulls the per-term rows out of a single structured jargon_clarification message. */
function termsFromMessage(message: PseudonymousMessage): JargonTerm[] {
  const body = message.body as { terms: JargonTermEntry[] };
  const createdAt = message.createdAt ?? '';

  return body.terms.map((entry, index) => ({
    id: `${message.id}:${index}`,
    term: entry.term ?? snippet(entry.text),
    definition: entry.text ?? '',
    quote: entry.sourceText,
    createdAt,
  }));
}

/** Banner summary text for a batch, e.g. "3 new terms: verticals, fungible, phenomenology". */
export function summarizeJargonTerms(terms: JargonTerm[]): string {
  if (terms.length === 0) return '';
  const label = `${terms.length} new term${terms.length === 1 ? '' : 's'}`;
  const names = terms
    .slice(0, 3)
    .map((t) => t.term)
    .join(', ');
  return `${label}: ${names}${terms.length > 3 ? '…' : ''}`;
}

/**
 * Tracks jargon_clarification messages for the notification banner/sheet and the (future)
 * Resources-tab glossary. The banner/sheet only ever reflect the single most recent message's
 * batch — a new message replaces what's shown rather than accumulating onto it, so the count
 * stays bounded by however many terms one backend message bundles, not the whole session's
 * total. Dismissing only suppresses that specific message; a newer one always supersedes it
 * regardless of seen/dismissed state.
 *
 * `enabled` gates the user's own jargonClarification preference. The backend always broadcasts
 * on the shared jargon channel regardless of any individual's preference (simpler than per-socket
 * delivery filtering), so this hook is what actually respects it: when `false`, it discards
 * everything outright — not merely hiding the banner — so a disabled preference never processes
 * or surfaces content the user opted out of, live, in both directions, with no reconnect needed.
 */
export function useJargonTerms(messages: PseudonymousMessage[], options: { enabled?: boolean } = {}): UseJargonTermsReturn {
  const { enabled = true } = options;
  const [dismissedMessageId, setDismissedMessageId] = useState<string | null>(null);
  const [seenMessageId, setSeenMessageId] = useState<string | null>(null);

  const jargonMessages = useMemo(
    () =>
      !enabled
        ? []
        : messages
            .filter(isStructuredJargonMessage)
            .sort((a, b) => new Date(a.createdAt!).getTime() - new Date(b.createdAt!).getTime()),
    [messages, enabled],
  );

  const terms = useMemo(() => jargonMessages.flatMap(termsFromMessage), [jargonMessages]);

  const latestMessage = jargonMessages[jargonMessages.length - 1];

  const batchTerms = useMemo(
    () => (latestMessage && latestMessage.id !== dismissedMessageId ? termsFromMessage(latestMessage) : []),
    [latestMessage, dismissedMessageId],
  );

  const seen = !latestMessage || latestMessage.id === seenMessageId;

  const markSeen = useCallback(() => {
    if (latestMessage) setSeenMessageId(latestMessage.id!);
  }, [latestMessage]);

  const dismiss = useCallback(() => {
    if (latestMessage) setDismissedMessageId(latestMessage.id!);
  }, [latestMessage]);

  return {
    terms,
    batchTerms,
    seen,
    active: batchTerms.length > 0,
    markSeen,
    dismiss,
  };
}
