import { Request } from '../../utils';
import { getConversation } from '../../utils/Helpers';

export const setupSortedConversations = () => {
  const now = new Date();
  // Today
  const today = new Date(now.getTime());
  // 30 days past
  const past = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  // 1 day future
  const middle = new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000);
  // 7 days future
  const future = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const conversations = [
    {
      id: 'now-event',
      name: 'Now Event',
      active: true,
      scheduledTime: today.toISOString(),
      createdAt: new Date(today.getTime() - 10000).toISOString(),
      owner: 'user-456',
      platformTypes: [],
      eventUrls: { moderator: [], participant: [] },
    },
    {
      id: 'middle-event',
      name: 'Middle Event',
      active: false,
      scheduledTime: middle.toISOString(),
      createdAt: new Date(middle.getTime() - 10000).toISOString(),
      owner: 'user-456',
      platformTypes: [],
      eventUrls: { moderator: [], participant: [] },
    },
    {
      id: 'future-event',
      name: 'Future Event',
      active: false,
      scheduledTime: new Date(future.getTime() - 1000).toISOString(),
      createdAt: new Date(future.getTime() - 1000).toISOString(),
      owner: 'user-456',
      platformTypes: [],
      eventUrls: { moderator: [], participant: [] },
    },
    {
      id: 'other-future-event',
      name: 'Other Future Event',
      active: false,
      // 10 days future
      scheduledTime: new Date(future.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date(future.getTime() - 5000000).toISOString(),
      owner: 'user-456',
      platformTypes: [],
      eventUrls: { moderator: [], participant: [] },
    },
    {
      id: 'earliest-event',
      name: 'Earliest Event',
      active: false,
      scheduledTime: past.toISOString(),
      createdAt: past.toISOString(),
      owner: 'user-456',
      platformTypes: [],
      eventUrls: { moderator: [], participant: [] },
    },
  ];

  (Request as jest.Mock).mockResolvedValue(conversations);
  const conversationMap: Record<string, object> = {
    'now-event': {
      id: 'now-event',
      name: 'Now Event',
      active: true,
      scheduledTime: today.toISOString(),
      createdAt: new Date(today.getTime() - 10000).toISOString(),
      owner: 'user-456',
      platformTypes: [],
      type: { name: 'eventAssistant', label: 'Test Agent' },
      eventUrls: { zoom: null, moderator: [], participant: [] },
    },
    'middle-event': {
      id: 'middle-event',
      name: 'Middle Event',
      active: false,
      scheduledTime: middle.toISOString(),
      createdAt: new Date(future.getTime() - 10000).toISOString(),
      owner: 'user-456',
      platformTypes: [],
      type: { name: 'eventAssistant', label: 'Test Agent' },
      eventUrls: { zoom: null, moderator: [], participant: [] },
    },
    'future-event': {
      id: 'future-event',
      name: 'Future Event',
      active: false,
      scheduledTime: future.toISOString(),
      createdAt: new Date(future.getTime() - 1000).toISOString(),
      owner: 'user-456',
      platformTypes: [],
      type: { name: 'eventAssistant', label: 'Test Agent' },
      eventUrls: { zoom: null, moderator: [], participant: [] },
    },
    'other-future-event': {
      id: 'other-future-event',
      name: 'Other Future Event',
      active: false,
      scheduledTime: new Date(future.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date(future.getTime() - 5000000).toISOString(),
      owner: 'user-456',
      platformTypes: [],
      type: { name: 'eventAssistant', label: 'Test Agent' },
      eventUrls: { zoom: null, moderator: [], participant: [] },
    },
    'earliest-event': {
      id: 'earliest-event',
      name: 'Earliest Event',
      active: false,
      scheduledTime: past.toISOString(),
      createdAt: past.toISOString(),
      owner: 'user-456',
      platformTypes: [],
      type: { name: 'eventAssistant', label: 'Test Agent' },
      eventUrls: { zoom: null, moderator: [], participant: [] },
    },
  };
  (getConversation as jest.Mock).mockImplementation((id: string) => Promise.resolve(conversationMap[id]));
};
