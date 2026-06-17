import { Request } from '../../utils';
import { getConversation } from '../../utils/Helpers';

export const setupSortedConversations = () => {
  const now = new Date();
  // 30 days past
  const earliest = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  // 1 day future
  const middle = new Date(now.getTime());
  // 7 days future
  const latest = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const conversations = [
    {
      id: 'middle-event',
      name: 'Middle Event',
      active: true,
      scheduledTime: middle.toISOString(),
      createdAt: new Date(middle.getTime() - 10000).toISOString(),
      owner: 'user-456',
      platformTypes: [],
      eventUrls: { moderator: [], participant: [] },
    },
    {
      id: 'latest-event',
      name: 'Latest Event',
      active: true,
      scheduledTime: latest.toISOString(),
      createdAt: new Date(latest.getTime() - 1000).toISOString(),
      owner: 'user-456',
      platformTypes: [],
      eventUrls: { moderator: [], participant: [] },
    },
    {
      id: 'earliest-event',
      name: 'Earliest Event',
      active: false,
      scheduledTime: earliest.toISOString(),
      createdAt: earliest.toISOString(),
      owner: 'user-456',
      platformTypes: [],
      eventUrls: { moderator: [], participant: [] },
    },
  ];

  (Request as jest.Mock).mockResolvedValue(conversations);
  const conversationMap: Record<string, object> = {
    'middle-event': {
      id: 'middle-event',
      name: 'Middle Event',
      active: false,
      scheduledTime: middle.toISOString(),
      createdAt: new Date(latest.getTime() - 10000).toISOString(),
      owner: 'user-456',
      platformTypes: [],
      type: { label: 'Test Agent' },
      eventUrls: { zoom: null, moderator: [], participant: [] },
    },
    'latest-event': {
      id: 'latest-event',
      name: 'Latest Event',
      active: false,
      scheduledTime: latest.toISOString(),
      createdAt: new Date(latest.getTime() - 1000).toISOString(),
      owner: 'user-456',
      platformTypes: [],
      type: { label: 'Test Agent' },
      eventUrls: { zoom: null, moderator: [], participant: [] },
    },
    'earliest-event': {
      id: 'earliest-event',
      name: 'Earliest Event',
      active: false,
      scheduledTime: earliest.toISOString(),
      createdAt: earliest.toISOString(),
      owner: 'user-456',
      platformTypes: [],
      type: { label: 'Test Agent' },
      eventUrls: { zoom: null, moderator: [], participant: [] },
    },
  };
  (getConversation as jest.Mock).mockImplementation((id: string) => Promise.resolve(conversationMap[id]));
};
