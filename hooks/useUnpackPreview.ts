import { useCallback, useEffect, useState } from 'react';
import { Api, SendData } from '../utils';
import { UnpackErrorReason, UnpackPreview, UnpackPreviewState, UnpackSelection, UnpackSendOutcome } from '../types.internal';

/** How long the selection must stay still before asking for a preview. */
export const UNPACK_PREVIEW_DELAY_MS = 300;

type UnpackResponse = { error: true; reason?: UnpackErrorReason } | Record<string, unknown> | undefined;

const isRefusal = (response: UnpackResponse): response is { error: true; reason?: UnpackErrorReason } =>
  !!response && response.error === true;

const rangeKey = (range: UnpackSelection | null) =>
  range ? `${range.startMessageId}:${range.startOffset}-${range.endMessageId}:${range.endOffset}` : null;

/**
 * Asks the server to explain a passage once the selection has been still for UNPACK_PREVIEW_DELAY_MS.
 * A newer range cancels the request for the older one.
 */
export function useUnpackPreview(conversationId: string, range: UnpackSelection | null) {
  const [state, setState] = useState<UnpackPreviewState>(range ? { status: 'loading' } : { status: 'idle' });
  const key = rangeKey(range);
  // Retries count per passage, so a new passage starts over with the usual delay.
  const [retries, setRetries] = useState({ key, count: 0 });
  const attempt = retries.key === key ? retries.count : 0;

  useEffect(() => {
    if (!range) {
      setState({ status: 'idle' });
      return;
    }
    setState({ status: 'loading' });
    const controller = new AbortController();
    const askForPreview = async () => {
      const response: UnpackResponse = await SendData(
        `unpack/${conversationId}/preview`,
        range,
        Api.get().getAccessToken(),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(range),
          signal: controller.signal,
        },
      );
      if (controller.signal.aborted) return;
      if (!response || isRefusal(response)) {
        if (!response) console.error('Unpack preview got no response', { conversationId, range });
        setState({ status: 'error', reason: response?.reason });
        return;
      }
      setState({ status: 'ready', explanation: (response as unknown as UnpackPreview).explanation });
    };

    const timer = attempt > 0 ? undefined : setTimeout(askForPreview, UNPACK_PREVIEW_DELAY_MS);
    if (attempt > 0) askForPreview();

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
    // The key stands in for range, so an equal range in a new object doesn't ask again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, key, attempt]);

  const retry = useCallback(
    () => setRetries((previous) => ({ key, count: previous.key === key ? previous.count + 1 : 1 })),
    [key],
  );

  return { state, retry };
}

export async function sendUnpackToPrivateChat(conversationId: string, range: UnpackSelection): Promise<UnpackSendOutcome> {
  const response: UnpackResponse = await SendData(
    `unpack/${conversationId}/send`,
    { ...range, destination: 'privateChat' },
    Api.get().getAccessToken(),
  );
  if (!response || isRefusal(response)) {
    if (!response) console.error('Unpack send got no response', { conversationId, range });
    return { ok: false, reason: response?.reason };
  }
  return { ok: true, status: response.status === 'pending' ? 'pending' : 'sent' };
}
