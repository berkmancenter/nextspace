import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from '@mui/icons-material';

interface BotPresenceProps {
  conversationId: string;
  botName: string;
  transcriptPasscode?: string;
  /**
   * False when the organizer set voiceDestination to 'zoom': Recall's own Zoom-facing bot is
   * speaking there, so this panel must stay visual-only to avoid playing the bot's voice twice.
   */
  audioEnabled?: boolean;
}

const LOAD_TIMEOUT_MS = 8000;

/**
 * Presentation-view panel embedding bot-media-server's own page, the same self-contained,
 * socket.io-driven page Recall.ai's Zoom bot renders — reused unmodified here via iframe rather
 * than ported to React. Shows the bot's animated character on the shared screen, with audio
 * unless the organizer routed the bot's voice to Zoom instead (see `audioEnabled`).
 */
export const BotPresence = ({ conversationId, botName, transcriptPasscode, audioEnabled = true }: BotPresenceProps) => {
  const [status, setStatus] = useState<'loading' | 'loaded' | 'timedOut'>('loading');
  const [audioPromptDismissed, setAudioPromptDismissed] = useState(false);
  const [isOpen, setIsOpen] = useState<boolean>(true);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (status !== 'loading') return;
    const timer = setTimeout(() => setStatus((current) => (current === 'loading' ? 'timedOut' : current)), LOAD_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [status]);

  useEffect(() => {
    // A click that lands inside the (cross-origin) iframe moves focus into it, which fires a
    // blur on the parent window. That's the only signal we get that the user interacted with the
    // embed, which is also what Chrome's per-origin autoplay policy requires to unlock audio there.
    const onWindowBlur = () => {
      if (document.activeElement === iframeRef.current) setAudioPromptDismissed(true);
    };
    window.addEventListener('blur', onWindowBlur);
    return () => window.removeEventListener('blur', onWindowBlur);
  }, []);

  const botMediaUrl = process.env.NEXT_PUBLIC_BOT_MEDIA_URL;
  if (!botMediaUrl) return null;

  const params = new URLSearchParams({ conversationId, botName });
  if (transcriptPasscode) params.set('transcriptPasscode', transcriptPasscode);
  if (!audioEnabled) params.set('audio', 'false');
  const src = `${botMediaUrl}/?${params.toString()}`;

  return (
    <div
      className={`hidden flex-shrink-0 flex-col border-l border-gray-200 bg-white transition-[width] duration-300 ease-in-out dark:border-nx-border-subtle dark:bg-nx-chrome lg:flex ${
        isOpen ? 'w-[280px]' : 'w-16'
      }`}
    >
      <div className="flex flex-shrink-0 items-center justify-center border-b border-gray-200 py-1 dark:border-nx-border-subtle">
        <button
          onClick={() => setIsOpen((open) => !open)}
          className="rounded p-1 text-gray-500 transition-colors hover:bg-gray-100 dark:text-nx-text dark:hover:bg-nx-active"
          aria-label={isOpen ? 'Collapse presentation view' : 'Expand presentation view'}
        >
          {isOpen ? <ChevronRight /> : <ChevronLeft />}
        </button>
      </div>

      {!isOpen && (
        <div className="flex flex-1 items-center justify-center">
          <div className="-rotate-90 whitespace-nowrap text-xs font-semibold tracking-widest text-gray-500 dark:text-nx-text">
            {botName.toUpperCase()}
          </div>
        </div>
      )}

      {/* Stays mounted (and the iframe's socket.io connection with it) even while collapsed —
          only hidden via CSS — so toggling the panel never interrupts the bot's presence. */}
      <div
        data-testid="bot-presence-content"
        className={`relative flex-1 overflow-hidden bg-gray-900 ${isOpen ? '' : 'hidden'}`}
      >
        {status !== 'loaded' && (
          <div className="absolute inset-0 flex items-center justify-center px-4 text-center text-sm text-gray-300">
            {status === 'timedOut' ? `Couldn't connect to ${botName}'s presence panel.` : `Connecting to ${botName}…`}
          </div>
        )}
        <iframe
          ref={iframeRef}
          src={src}
          title={`${botName} presence`}
          allow="autoplay"
          className="h-full w-full border-0"
          onLoad={() => setStatus('loaded')}
        />
        {status === 'loaded' && audioEnabled && !audioPromptDismissed && (
          <div
            role="status"
            className="pointer-events-none absolute inset-x-0 bottom-0 bg-black/70 px-3 py-2 text-center text-xs font-semibold text-white"
          >
            Click {botName} to enable audio
          </div>
        )}
      </div>
    </div>
  );
};
