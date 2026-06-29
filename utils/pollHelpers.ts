import { RetrieveData, SendData } from './';

export const respondToPoll = async (pollId: string, choiceText: string) =>
  SendData(`polls/${pollId}/respond`, { choice: { text: choiceText } });

export const getPollResponseCounts = async (pollId: string): Promise<Record<string, number>> => {
  const result = await RetrieveData(`polls/${pollId}/responseCounts`);
  return result && typeof result === 'object' && !('error' in result) ? result : {};
};

export const inspectPoll = async (pollId: string): Promise<{ choices?: { text: string; isSelected: boolean }[] } | null> => {
  const result = await RetrieveData(`polls/${pollId}`);
  return result && !('error' in result) ? result : null;
};
