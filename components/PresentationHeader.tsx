import { useState } from 'react';
import { Dialog } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { Logo } from './Logo';

interface PresentationHeaderProps {
  eventName: string;
  /** Called once the exit has been confirmed. If it rejects, the dialog stays open and shows an error. */
  onExit: () => Promise<unknown>;
}

/**
 * Header for the presentation view, in place of the app's navigation header. Exiting asks first,
 * because a stray click on a projected screen would otherwise drop the whole room out of the view.
 */
export const PresentationHeader = ({ eventName, onExit }: PresentationHeaderProps) => {
  const [confirmingExit, setConfirmingExit] = useState(false);
  const [exitFailed, setExitFailed] = useState(false);

  const closeDialog = () => {
    setConfirmingExit(false);
    setExitFailed(false);
  };

  const confirmExit = async () => {
    setExitFailed(false);
    try {
      await onExit();
    } catch (error) {
      console.error('Failed to leave the presentation view:', error);
      setExitFailed(true);
    }
  };

  return (
    <header className="relative z-[1] flex h-[72px] flex-shrink-0 items-center gap-3.5 border-b border-gray-200 bg-white px-7 shadow-sm">
      <Logo />
      <span className="text-[22px] font-extrabold tracking-tight text-medium-slate-blue">NextSpace</span>
      <h1 className="ml-3.5 min-w-0 truncate text-lg font-normal text-gray-800">{eventName}</h1>

      <div className="ml-auto flex flex-shrink-0 items-center gap-3.5">
        <span className="whitespace-nowrap rounded-full bg-[#E0E7FF] px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-medium-slate-blue">
          Presentation view
        </span>
        <button
          type="button"
          onClick={() => setConfirmingExit(true)}
          aria-label="Exit presentation view"
          title="Exit presentation view"
          className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-800 hover:bg-gray-200"
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
            className="whitespace-nowrap rounded-md border border-gray-200 bg-white px-3.5 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-100"
          >
            Keep presenting
          </button>
          <button
            type="button"
            onClick={confirmExit}
            className="whitespace-nowrap rounded-md bg-medium-slate-blue px-3.5 py-2 text-sm font-semibold text-white hover:bg-[#3b38b8]"
          >
            Go to participant view
          </button>
        </div>
      </Dialog>
    </header>
  );
};
