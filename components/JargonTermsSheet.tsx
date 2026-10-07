import { IconButton, SwipeableDrawer } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { JargonTerm } from '../hooks/useJargonTerms';

interface JargonTermsSheetProps {
  open: boolean;
  onClose: () => void;
  terms: JargonTerm[];
  onManagePreferences: () => void;
}

/**
 * Bottom sheet listing the terms from the notification banner's current batch. `onClose` only
 * hides the sheet — dragging it down, tapping the backdrop, or its own header close button all
 * route here, never to the banner's dismiss action. `terms` is bound live to the banner's current
 * batch rather than a snapshot, so a newer message superseding the batch while the sheet happens
 * to be open is reflected immediately.
 */
export function JargonTermsSheet({ open, onClose, terms, onManagePreferences }: JargonTermsSheetProps) {
  return (
    <SwipeableDrawer
      anchor="bottom"
      open={open}
      onClose={onClose}
      onOpen={() => {}}
      disableSwipeToOpen
      // SwipeableDrawer forces ModalProps.keepMounted = true internally (so paperRef is
      // defined for its touch handlers), which would otherwise leave stale term content in
      // the DOM while closed. Override it back off — nothing here depends on touch dragging
      // from a hidden paper.
      ModalProps={{ keepMounted: false }}
      PaperProps={{
        sx: {
          maxHeight: '78dvh',
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          display: 'flex',
          flexDirection: 'column',
        },
      }}
    >
      <div className="flex justify-center pt-1 pb-0.5">
        <div className="w-9 h-1 rounded-full" style={{ backgroundColor: '#e2dcf0' }} />
      </div>

      <div className="flex items-center justify-between px-4 pt-1.5 pb-2.5 border-b border-[#efeaf7]">
        <h3 className="text-[15px] font-bold" style={{ color: '#241b38' }}>
          New terms ({terms.length})
        </h3>
        <IconButton aria-label="Close" size="small" onClick={onClose}>
          <CloseIcon sx={{ fontSize: 16 }} />
        </IconButton>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pt-1 pb-2">
        {terms.map((t) => (
          <div key={t.id} className="py-2.5 border-b border-[#f2eef9] last:border-none">
            <div className="text-[13px] font-bold" style={{ color: '#241b38' }}>
              {t.term}
            </div>
            <div className="text-[13px] mt-0.5" style={{ color: '#4a425a' }}>
              {t.definition}
            </div>
            {t.quote && (
              <div className="text-[11px] italic mt-0.5" style={{ color: '#9b92ab' }}>
                &ldquo;{t.quote}&rdquo;
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="px-4 pt-2.5 pb-3.5 border-t border-[#efeaf7]">
        <button type="button" onClick={onManagePreferences} className="text-[12px] font-semibold text-mediumslateblue">
          Manage term alerts in Preferences
        </button>
      </div>

      <div style={{ paddingBottom: 'env(safe-area-inset-bottom)' }} />
    </SwipeableDrawer>
  );
}
