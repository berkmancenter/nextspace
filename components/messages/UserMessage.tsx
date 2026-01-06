import { FC } from "react";
import { BaseMessage, MessageContent } from "./BaseMessage";
import { MessageProps } from "../../types.internal";

export const UserMessage: FC<MessageProps> = ({ message }) => {
  return (
    <BaseMessage>
      <MessageContent text={message.body as string} />
    </BaseMessage>
  );
};
