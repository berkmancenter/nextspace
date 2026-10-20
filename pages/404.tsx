import { useEffect, useState } from 'react';
import Link from 'next/link';
import KeyboardReturnIcon from '@mui/icons-material/KeyboardReturn';
import { BotIcon } from '../components/BotIcon';
import { Api } from '../utils';
import { roomFontVariables } from '../components/room/roomFonts';
import styles from '../components/room/communityRoom.module.css';

export default function NotFoundPage() {
  const [agentName, setAgentName] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Api.get()
      .GetConfig()
      .then((config) => {
        if (!cancelled) setAgentName(config.conversationBotName);
      })
      .catch((error) => console.warn('Could not load the agent name for the not-found page:', error));
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className={styles.root} style={roomFontVariables}>
      <div className={styles.notFound}>
        <h1 className={styles.notFoundTitle}>Oops!</h1>
        <p className={styles.notFoundMessage}>{agentName ?? 'We'} looked everywhere, but this page doesn&apos;t exist.</p>

        <div className={styles.notFoundArt} aria-hidden="true">
          <svg viewBox="0 0 200 160" className={styles.notFoundBlob}>
            <path d="M38 30C62 4 118 8 150 22c30 13 48 46 38 78-10 33-48 54-88 52-38-2-78-22-88-54C2 70 16 52 38 30Z" />
          </svg>
          <BotIcon size={130} color="var(--not-found-art)" className={styles.notFoundBot} />
          <span className={styles.notFoundQuestion}>?</span>
        </div>

        <Link href="/hallway" className={styles.notFoundLink}>
          <KeyboardReturnIcon sx={{ fontSize: 18 }} aria-hidden="true" />
          Back to the hallway
        </Link>
      </div>
    </div>
  );
}
