import { useState } from 'react';
import { Dialog } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import LightModeIcon from '@mui/icons-material/LightMode';
import { Logo } from './Logo';
import { usePresenterTheme } from '../hooks/usePresenterTheme';

interface PresentationHeaderProps {
  eventName: string;
  /**
   * Called once the exit has been confirmed. Resolves to false when navigation was blocked; that
   * or a rejection keeps the dialog open with an error.
   */
  onExit: () => Promise<boolean>;
}

/**
 * Header for the presentation view, in place of the app's navigation header. Exiting asks first,
 * because a stray click on a projected screen would otherwise drop the whole room out of the view.
 */
export const PresentationHeader = ({ eventName, onExit }: PresentationHeaderProps) => {
  const [confirmingExit, setConfirmingExit] = useState(false);
  const [exitFailed, setExitFailed] = useState(false);
  const { theme, toggleTheme } = usePresenterTheme();
  const switchTo = theme === 'dark' ? 'light' : 'dark';

  const closeDialog = () => {
    setConfirmingExit(false);
    setExitFailed(false);
  };

  const confirmExit = async () => {
    setExitFailed(false);
    try {
      if ((await onExit()) === false) {
        console.error('Failed to leave the presentation view: navigation was blocked');
        setExitFailed(true);
      }
    } catch (error) {
      console.error('Failed to leave the presentation view:', error);
      setExitFailed(true);
    }
  };

  return (
    <header className="relative z-[1] flex h-[72px] flex-shrink-0 items-center gap-3.5 border-b border-gray-200 bg-white px-7 shadow-sm dark:border-nx-border-subtle dark:bg-nx-chrome">
      <Logo />
      <span className="text-[22px] font-extrabold tracking-tight text-medium-slate-blue dark:text-nx-text">NextSpace</span>
      <h1 className="ml-3.5 min-w-0 truncate text-lg font-normal text-gray-800">{eventName}</h1>

      <div className="ml-auto flex flex-shrink-0 items-center gap-3.5">
        <span className="whitespace-nowrap rounded-full bg-nx-pill px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-nx-pill-text">
          Presentation view
        </span>
        <button
          type="button"
          onClick={toggleTheme}
          aria-label={`Switch to ${switchTo} mode`}
          title={`Switch to ${switchTo} mode`}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border-[1.5px] dark:border-2 border-gray-300 bg-gray-100 text-gray-800 hover:bg-gray-200 dark:hover:bg-nx-active"
        >
          {theme === 'dark' ? <LightModeIcon /> : <DarkModeIcon />}
        </button>
        <button
          type="button"
          onClick={() => setConfirmingExit(true)}
          aria-label="Exit presentation view"
          title="Exit presentation view"
          className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-800 hover:bg-gray-200 dark:hover:bg-nx-active"
        >
          <CloseIcon />
        </button>
      </div>

      <Dialog
        open={confirmingExit}
        onClose={closeDialog}
        aria-labelledby="exit-presentation-title"
        aria-describedby="exit-presentation-description"
        slotProps={{ paper: { sx: { borderRadius: '12px', padding: '24px', maxWidth: '440px' } } }}
      >
        <h2 id="exit-presentation-title" className="text-lg font-bold text-gray-900">
          Exit presentation view?
        </h2>
        <p id="exit-presentation-description" className="mt-3 text-sm leading-relaxed text-gray-800">
          This window will open the participant view of this event. To present again, open the presentation link from the
          event&apos;s admin page.
        </p>
        {exitFailed && (
          <p role="alert" className="mt-3 text-sm font-semibold text-red-700">
            Couldn&apos;t open the participant view. Try again.
          </p>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={closeDialog}
            className="whitespace-nowrap rounded-md border border-gray-200 bg-white px-3.5 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-100 dark:border-nx-border-interactive dark:bg-nx-raised dark:hover:bg-nx-active"
          >
            Keep presenting
          </button>
          <button
            type="button"
            onClick={confirmExit}
            className="whitespace-nowrap rounded-md bg-nx-cta px-3.5 py-2 text-sm font-semibold text-white hover:bg-nx-cta-hover dark:text-nx-on-button dark:hover:brightness-110"
          >
            Go to participant view
          </button>
        </div>
      </Dialog>
    </header>
  );
};
