import { FC } from 'react';
import { MessageProps, UnpackAlreadyPosted } from '../../types.internal';
import { SeeItInGroupChatButton } from './UnpackExplanationMessage';

interface UnpackAlreadyPostedMessageProps extends MessageProps {
  /** Opens Group Chat at the given post. Leave out to show the note without a link. */
  onOpenGroupChatPost?: (messageId: string) => void;
}

export const UnpackAlreadyPostedMessage: FC<UnpackAlreadyPostedMessageProps> = ({ message, onOpenGroupChatPost }) => {
  const { text, groupChatMessageId } = message.body as UnpackAlreadyPosted;

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[#D1C4E9] bg-white px-4 py-3 text-sm text-gray-800">
      <p>{text}</p>
      {onOpenGroupChatPost && <SeeItInGroupChatButton onClick={() => onOpenGroupChatPost(groupChatMessageId)} />}
    </div>
  );
};
