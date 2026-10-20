import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { EventAssistantRoom } from './assistant';
import { CheckAuthHeader } from '../utils/Helpers';
import { AuthType } from '../types.internal';
import { savePresentationChannels } from '../utils/presentationChannels';

export const getServerSideProps = async (context: { req: any }) => {
  return CheckAuthHeader(context.req.headers);
};

function PresentationRoom({ authType }: { authType: AuthType }) {
  const router = useRouter();
  const { conversationId, channel } = router.query;
  // Next.js hands back a new array on every router update, so compare by value.
  const channelKey = Array.isArray(channel) ? channel.join('|') : channel;

  useEffect(() => {
    if (!router.isReady || typeof conversationId !== 'string' || !channel) return;
    if (!savePresentationChannels(conversationId, channel)) return;
    const { channel: _, ...queryWithoutPasscodes } = router.query;
    router
      .replace({ pathname: '/present', query: queryWithoutPasscodes }, undefined, { shallow: true })
      .catch((error) => console.warn('Could not remove passcodes from the address bar:', error));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady, conversationId, channelKey]);

  return <EventAssistantRoom authType={authType} presentation />;
}

export default PresentationRoom;
