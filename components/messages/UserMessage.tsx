import { FC } from "react";
import { BaseMessage, MessageContent } from "./BaseMessage";
import { MessageProps } from "../../types.internal";

interface UserMessageProps extends MessageProps {
  showSender?: boolean;
}

export const UserMessage: FC<UserMessageProps> = ({ message, showSender }) => {
  return (
    <BaseMessage>
      {showSender && message.pseudonym && (
        <p className="py-3 text-xs text-dark-blue font-bold uppercase">
          {message.pseudonym}
        </p>
      )}
      <MessageContent text={message.body as string} />
    </BaseMessage>
  );
};
