import { useEffect, useState } from 'react';
import { Api, SendData } from '../utils';
import {
  UnpackPreview,
  UnpackPreviewState,
  UnpackRefusal,
  UnpackResponse,
  UnpackSelection,
  UnpackSendOutcome,
  UnpackShareOutcome,
} from '../types.internal';
import { passageKey } from '../utils/unpackPassage';

export const UNPACK_PREVIEW_DELAY_MS = 300;

const isRefusal = (response: UnpackResponse): response is UnpackRefusal => !!response && response.error === true;

const logFailure = (
  action: 'preview' | 'send' | 'share',
  context: { conversationId: string; range?: UnpackSelection; messageId?: string },
  response: UnpackRefusal | undefined,
) => {
  if (!response) {
    console.error(`Unpack ${action} got no response`, context);
    return;
  }
  console.warn(`Unpack ${action} refused`, { ...context, status: response.status, reason: response.reason });
};

/**
 * Asks the server to explain a passage once the selection has been still for UNPACK_PREVIEW_DELAY_MS.
 * A newer range cancels the request for the older one.
 */
export function useUnpackPreview(conversationId: string, range: UnpackSelection | null, transcriptPasscode?: string) {
  const [state, setState] = useState<UnpackPreviewState>(range ? { status: 'loading' } : { status: 'idle' });
  const [attempt, setAttempt] = useState(0);
  const key = range ? passageKey(range) : null;

  useEffect(() => {
    if (!range) {
      setState({ status: 'idle' });
      return;
    }
    setState({ status: 'loading' });
    const controller = new AbortController();
    const askForPreview = async () => {
      const response: UnpackResponse = await SendData(`unpack/${conversationId}/preview`, null, Api.get().getAccessToken(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...range, transcriptPasscode }),
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      if (!response || isRefusal(response)) {
        logFailure('preview', { conversationId, range }, response);
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
  }, [conversationId, key, transcriptPasscode, attempt]);

  const retry = () => setAttempt((previous) => previous + 1);

  return { state, retry };
}

export async function sendUnpackToPrivateChat(
  conversationId: string,
  range: UnpackSelection,
  transcriptPasscode?: string,
): Promise<UnpackSendOutcome> {
  const response: UnpackResponse = await SendData(
    `unpack/${conversationId}/send`,
    { ...range, transcriptPasscode, destination: 'privateChat' },
    Api.get().getAccessToken(),
  );
  if (!response || isRefusal(response)) {
    logFailure('send', { conversationId, range }, response);
    return { ok: false, reason: response?.reason };
  }
  return { ok: true, status: response.status === 'pending' ? 'pending' : 'sent' };
}

export async function shareUnpackToGroupChat(
  conversationId: string,
  messageId: string,
  passcodes: { transcriptPasscode?: string; chatPasscode?: string },
): Promise<UnpackShareOutcome> {
  const response: UnpackResponse = await SendData(
    `unpack/${conversationId}/share`,
    { messageId, ...passcodes },
    Api.get().getAccessToken(),
  );
  if (!response || isRefusal(response)) {
    logFailure('share', { conversationId, messageId }, response);
    return { ok: false, reason: response?.reason, message: response?.message };
  }
  return {
    ok: true,
    status: response.status === 'alreadyPosted' ? 'alreadyPosted' : 'sent',
    messageId: String(response.messageId),
    text: typeof response.text === 'string' ? response.text : undefined,
  };
}
