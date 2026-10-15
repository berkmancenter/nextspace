import { EventAssistantRoom } from './assistant';
import { CheckAuthHeader } from '../utils/Helpers';
import { AuthType } from '../types.internal';

export const getServerSideProps = async (context: { req: any }) => {
  return CheckAuthHeader(context.req.headers);
};

function PresentationRoom({ authType }: { authType: AuthType }) {
  return <EventAssistantRoom authType={authType} presentation />;
}

export default PresentationRoom;
