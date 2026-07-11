import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { Alert, CircularProgress } from '@mui/material';
import { CheckAuthHeader, getConversation } from '../../../../utils/Helpers';
import { AuthType } from '../../../../types.internal';

import { EventStatus, EventDetails } from '../../../../components';
import { Conversation } from '../../../../types.internal';

export const getServerSideProps = async (context: { req: any }) => {
  return CheckAuthHeader(context.req.headers);
};

function EventScreen({ authType }: { authType: AuthType }) {
  const router = useRouter();
  const { id } = router.query;

  const [conversationData, setConversationData] = useState<Conversation | null>(null);

  // Bumped each time a readiness-checklist row is reviewed, so Details re-opens the target card
  // even on a repeat jump to the same section.
  const [openSectionRequest, setOpenSectionRequest] = useState<{ id: string; nonce: number }>();
  const jumpNonce = useRef(0);

  // PDF uploads that failed during create/edit are handed off via sessionStorage since those
  // flows redirect here; surface them once, then clear so a refresh doesn't repeat the warning.
  const [pdfWarnings, setPdfWarnings] = useState<string[]>([]);

  useEffect(() => {
    const stored = sessionStorage.getItem('pdfUploadWarnings');
    if (!stored) return;
    try {
      setPdfWarnings(JSON.parse(stored));
    } catch {
      // Malformed stash: drop it rather than crash the page.
    }
    sessionStorage.removeItem('pdfUploadWarnings');
  }, []);

  useEffect(() => {
    if (!id) return;

    const fetchConversationData = async () => {
      try {
        const data = await getConversation(id as string);
        setConversationData(data);
      } catch (error) {
        console.error('Error fetching thread data:', error);
      }
    };

    fetchConversationData();
  }, [id]);

  const handleJumpToSection = (cardId: string) => {
    jumpNonce.current += 1;
    setOpenSectionRequest({ id: cardId, nonce: jumpNonce.current });
    document.getElementById(cardId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  if (!conversationData) {
    return (
      <div className="flex justify-center" style={{ marginTop: 40 }}>
        <CircularProgress />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAF9] px-6 py-8">
      <nav aria-label="Breadcrumb" className="mx-auto max-w-3xl text-[12px] text-[#6B7280]">
        <button type="button" onClick={() => router.push('/admin/events')} className="hover:underline">
          Events
        </button>
        <span className="mx-1.5">›</span>
        <span className="text-[#0B0D0E]">{conversationData.name}</span>
      </nav>

      <h1 className="mx-auto mt-2 mb-5 max-w-3xl text-[27px] font-bold leading-[1.15] tracking-[-0.02em] text-[#0B0D0E]">
        {conversationData.name}
      </h1>

      {pdfWarnings.length > 0 && (
        <Alert severity="warning" sx={{ maxWidth: 768, mx: 'auto', mb: 3 }}>
          The following PDFs could not be uploaded and will not be available as AI context:{' '}
          <strong>{pdfWarnings.join(', ')}</strong>. You can retry by editing the event.
        </Alert>
      )}

      <EventStatus conversationData={conversationData} onJumpToSection={handleJumpToSection} />
      <EventDetails conversationData={conversationData} openSectionRequest={openSectionRequest} />
    </div>
  );
}

export default EventScreen;
