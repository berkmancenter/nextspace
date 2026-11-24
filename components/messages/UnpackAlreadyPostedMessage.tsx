import { FC } from 'react';
import { MessageProps, UnpackAlreadyPosted } from '../../types.internal';

interface UnpackAlreadyPostedMessageProps extends MessageProps {
  /** Opens Group Chat at the given post. Leave out to show the note without a link. */
  onOpenGroupChatPost?: (messageId: string) => void;
}

export const UnpackAlreadyPostedMessage: FC<UnpackAlreadyPostedMessageProps> = ({ message, onOpenGroupChatPost }) => {
  const { text, groupChatMessageId } = message.body as UnpackAlreadyPosted;

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[#D1C4E9] bg-white px-4 py-3 text-sm text-gray-800">
      <p>{text}</p>
      {onOpenGroupChatPost && (
        <button
          type="button"
          onClick={() => onOpenGroupChatPost(groupChatMessageId)}
          className="rounded-lg border border-[#C7D2FE] bg-[#F5F3FF] px-3 py-1.5 text-sm font-semibold text-[#312E81] hover:bg-[#EDE9FE]"
        >
          See it in Group Chat
        </button>
      )}
    </div>
  );
};
