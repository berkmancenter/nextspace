import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EventCreationForm } from '../../components/EventCreationForm';
import { RetrieveData, Request } from '../../utils';
import { Api, SendData, updateConversation } from '../../utils/Helpers';
import '@testing-library/jest-dom';

jest.setTimeout(60000);

// Generate a date string in the format the DateTimePicker expects (MM/DD/YYYY HH:MM AM/PM),
// offset from today so tests don't break as time passes.
const getFutureDateString = (daysFromNow: number, hour: number, minute = 0): string => {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  date.setHours(hour, minute, 0, 0);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const year = date.getFullYear();
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const hour12 = String(hour % 12 || 12).padStart(2, '0');
  const mins = String(minute).padStart(2, '0');
  return `${month}/${day}/${year} ${hour12}:${mins} ${ampm}`;
};

const futureStartTime = getFutureDateString(30, 10); // 30 days from now at 10:00 AM
const futureEndTime = getFutureDateString(30, 11); // 30 days from now at 11:00 AM
const futureEndBeforeStart = getFutureDateString(30, 9); // 30 days from now at 09:00 AM (before start)

// Mock next/router
const mockPush = jest.fn();
jest.mock('next/router', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

// Mock utils
jest.mock('../../utils', () => ({
  RetrieveData: jest.fn(),
  Request: jest.fn(),
}));

jest.mock('../../utils/Helpers', () => ({
  ...jest.requireActual('../../utils/Helpers'),
  SendData: jest.fn(),
  updateConversation: jest.fn(),
}));

jest.mock('../../utils/SessionManager', () => ({
  __esModule: true,
  default: {
    get: () => ({
      getSessionInfo: () => ({ userId: 'current-user-id' }),
    }),
  },
}));

const mockPublicTopics = [
  {
    id: 'topic-1',
    name: 'Public Topic 1',
    private: false,
    archived: false,
    isDeleted: false,
    owner: 'other-user-id',
  },
  {
    id: 'topic-2',
    name: 'Public Topic 2',
    private: false,
    archived: false,
    isDeleted: false,
    owner: 'other-user-id',
  },
  {
    id: 'topic-archived',
    name: 'Archived Topic',
    private: false,
    archived: true,
    isDeleted: false,
    owner: 'other-user-id',
  },
  {
    id: 'topic-deleted',
    name: 'Deleted Topic',
    private: false,
    archived: false,
    isDeleted: true,
    owner: 'other-user-id',
  },
];

const mockUserTopics = [
  {
    id: 'topic-3',
    name: 'My Private Topic',
    private: true,
    archived: false,
    isDeleted: false,
    owner: 'current-user-id',
  },
];

const makeRequestMock =
  (conversationResult: any = null) =>
  (endpoint: string, payload?: any) => {
    if (endpoint === 'topics' && !payload) return Promise.resolve(mockPublicTopics);
    if (endpoint === 'topics/userTopics') return Promise.resolve(mockUserTopics);
    return Promise.resolve(conversationResult);
  };

const fillEventDetails = async (name: string, zoomUrl: string) => {
  const user = userEvent.setup();

  // Fill in event name
  const nameInput = screen.getByLabelText(/Event Name/i);
  await user.type(nameInput, name);

  // Select a topic (required)
  const topicInput = screen.getByLabelText(/Select a series/i);
  fireEvent.click(topicInput);
  fireEvent.keyDown(topicInput, { key: 'ArrowDown' });
  const topicOption = await screen.findByRole('option', {
    name: /Public Topic 1/i,
  });
  fireEvent.click(topicOption);

  // Fill in Zoom URL
  const urlInput = screen.getByLabelText(/Zoom Meeting URL/i);
  await user.type(urlInput, zoomUrl);

  // Set day/time - directly type into the datetime input
  const dateInput = screen.getAllByLabelText(/Meeting Day\/Time/i)[0];
  await user.type(dateInput, futureStartTime);

  // Assert the input value
  expect(dateInput).toHaveTextContent(`${futureStartTime}Meeting Day/Time`);

  // Set end time (required when start time is provided)
  const endTimeInput = screen.getAllByLabelText(/Meeting End Time/i)[0];
  await user.type(endTimeInput, futureEndTime);
};

const mockConfig = {
  supportedModels: [
    {
      name: 'gpt-4o-mini',
      label: 'OpenAI GPT-4o Mini',
      description: 'Fast, lightweight model ideal for everyday conversations',
      llmPlatform: 'openai',
      llmModel: 'gpt-4o-mini',
    },
    {
      name: 'claude-3-5-haiku',
      label: 'AWS Bedrock Claude 3.5 Haiku',
      description: 'Efficient and cost-effective model for quick responses',
      llmPlatform: 'bedrock',
      llmModel: 'anthropic.claude-3-5-haiku-20241022-v1:0',
    },
    {
      name: 'claude-3-5-sonnet',
      label: 'AWS Bedrock Claude 3.5 Sonnet',
      description: 'Balanced model for complex reasoning and analysis',
      llmPlatform: 'bedrock',
      llmModel: 'anthropic.claude-3-5-sonnet-20240620-v1:0',
    },
  ],
  availablePlatforms: [
    {
      name: 'nextspace',
      label: 'Nextspace',
    },
    {
      name: 'zoom',
      label: 'Zoom',
    },
  ],
  conversationTypes: [
    {
      name: 'backChannel',
      label: 'Back Channel',
      description: 'An agent to analyze participant comments',
      properties: [
        {
          name: 'zoomMeetingUrl',
          type: 'string',
          label: 'Zoom Meeting URL',
          required: true,
        },
        {
          name: 'botName',
          type: 'string',
          label: 'Bot Name',
          default: 'Back Channel',
          required: false,
        },
        {
          name: 'llmModel',
          type: 'enum',
          label: 'AI Model',
          description: 'Select the AI model to use for this conversation',
          required: true,
          validationKeys: ['llmPlatform', 'llmModel'],
          options: [
            {
              name: 'gpt-4o-mini',
              label: 'OpenAI GPT-4o Mini',
              description: 'Fast, lightweight model ideal for everyday conversations',
              llmPlatform: 'openai',
              llmModel: 'gpt-4o-mini',
            },
            {
              name: 'claude-3-5-haiku',
              label: 'AWS Bedrock Claude 3.5 Haiku',
              description: 'Efficient and cost-effective model for quick responses',
              llmPlatform: 'bedrock',
              llmModel: 'anthropic.claude-3-5-haiku-20241022-v1:0',
            },
            {
              name: 'claude-3-5-sonnet',
              label: 'AWS Bedrock Claude 3.5 Sonnet',
              description: 'Balanced model for complex reasoning and analysis',
              llmPlatform: 'bedrock',
              llmModel: 'anthropic.claude-3-5-sonnet-20240620-v1:0',
            },
          ],
        },
      ],
      features: [
        {
          name: 'liveTranscript',
          label: 'Live Transcript',
          description: 'Display a live transcript during the event',
          userControlled: false,
          default: false,
          properties: [
            {
              name: 'transcriptDelay',
              type: 'number',
              label: 'Transcript Delay (seconds)',
              default: 5,
              required: false,
            },
          ],
        },
        {
          name: 'autoSummary',
          label: 'Auto Summary',
          description: 'Generate a summary at the end of the event',
          userControlled: false,
          default: false,
          properties: [],
        },
      ],
    },
    {
      name: 'eventAssistantExtraTest',
      label: 'Event Assistant With Additional Features',
      description: 'A combination of Event Assistant and Back Channel',
      properties: [
        {
          name: 'zoomMeetingUrl',
          type: 'string',
          label: 'Zoom Meeting URL',
          required: true,
        },
      ],
      features: [
        {
          name: 'collectiveVoice',
          label: 'Collective Voice',
          description: 'Contributes to the group chat by surfacing what participants are privately thinking.',
          userControlled: false,
          default: true,
          properties: [],
        },
        {
          name: 'catalyst',
          label: 'Catalyst',
          description: 'Participates in the group chat as an active voice, jumping into silences.',
          userControlled: false,
          default: true,
          properties: [],
        },
        {
          name: 'librarian',
          label: 'Reading Recommendations',
          description: 'Periodically recommends relevant reading during the event.',
          userControlled: false,
          default: true,
          properties: [],
        },
        {
          name: 'mod',
          label: 'Submit to Moderator',
          description: 'Submit a private question to the moderator.',
          userControlled: true,
          default: true,
          properties: [],
        },
        {
          name: 'mindmap',
          label: 'Mind Map',
          description: 'Creates a visual mind map of the key topics discussed in the event.',
          userControlled: true,
          default: true,
          properties: [],
        },
        {
          name: 'visual',
          label: 'Visual Response',
          description: 'Ask for a visual (image) response to a question.',
          userControlled: true,
          default: true,
          properties: [],
        },
        {
          name: 'jargonFilter',
          label: 'Jargon Filter',
          description: 'Automatically explains jargon and technical terms used by speakers.',
          userControlled: true,
          default: true,
          properties: [],
        },
      ],
    },
    {
      name: 'eventAssistant',
      label: 'Event Assistant',
      description: 'An assistant to answer questions about an event',
      properties: [
        {
          name: 'zoomMeetingUrl',
          type: 'string',
          label: 'Zoom Meeting URL',
          required: true,
        },
        {
          name: 'botName',
          type: 'string',
          label: 'Bot Name',
          default: 'Berkie',
          required: false,
        },
        {
          name: 'llmModel',
          type: 'enum',
          label: 'AI Model',
          description: 'Select the AI model to use for this conversation',
          required: true,
          validationKeys: ['llmPlatform', 'llmModel'],
          options: [
            {
              name: 'gpt-4o-mini',
              label: 'OpenAI GPT-4o Mini',
              description: 'Fast, lightweight model ideal for everyday conversations',
              llmPlatform: 'openai',
              llmModel: 'gpt-4o-mini',
            },
            {
              name: 'claude-3-5-haiku',
              label: 'AWS Bedrock Claude 3.5 Haiku',
              description: 'Efficient and cost-effective model for quick responses',
              llmPlatform: 'bedrock',
              llmModel: 'anthropic.claude-3-5-haiku-20241022-v1:0',
            },
            {
              name: 'claude-3-5-sonnet',
              label: 'AWS Bedrock Claude 3.5 Sonnet',
              description: 'Balanced model for complex reasoning and analysis',
              llmPlatform: 'bedrock',
              llmModel: 'anthropic.claude-3-5-sonnet-20240620-v1:0',
            },
          ],
        },
      ],
    },
  ],
};

describe('EventCreationForm Component', () => {
  beforeEach(() => {
    Api.get().ClearConfigCache();
    jest.clearAllMocks();
    mockPush.mockReset();
    (RetrieveData as jest.Mock).mockResolvedValue(mockConfig);
    (Request as jest.Mock).mockImplementation(makeRequestMock());
  });

  it('renders the form with initial state on step 1', async () => {
    await act(async () => {
      render(<EventCreationForm />);
    });

    // Check that all step labels are present in the stepper
    expect(screen.getAllByText('Event Details').length).toBeGreaterThan(0);
    expect(screen.getByText('Conversation Setup')).toBeInTheDocument();
    expect(screen.getByText('Configuration')).toBeInTheDocument();
    expect(screen.getByText('Speakers')).toBeInTheDocument();

    // Should show Step 1 content
    expect(screen.getByLabelText(/Event Name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Zoom Meeting URL/i)).toBeInTheDocument();
  });

  it('validates Step 1 before allowing navigation to Step 2', async () => {
    const user = userEvent.setup();
    await act(async () => {
      render(<EventCreationForm />);
    });

    // Try to go to next step without filling required fields
    const nextButton = screen.getByRole('button', { name: /next/i });
    await user.click(nextButton);

    // Should show error and remain on Step 1
    await waitFor(() => {
      expect(screen.getByText('Event Name is required')).toBeInTheDocument();
    });
    expect(screen.getByLabelText(/Event Name/i)).toBeInTheDocument();
  });

  it('navigates to Step 2 after valid Step 1 data', async () => {
    const user = userEvent.setup();
    await act(async () => {
      render(<EventCreationForm />);
    });

    // Fill Step 1
    await fillEventDetails('Test Event', 'https://huitstage.zoom.us/j/1234567890');

    const nextButton = screen.getByRole('button', { name: /next/i });
    await user.click(nextButton);

    // Should now be on Step 2
    await waitFor(() => {
      expect(screen.getByText('Where do you want your audience to interact?')).toBeInTheDocument();
    });
  });

  it('shows platform selection checkboxes on Step 2', async () => {
    const user = userEvent.setup();
    await act(async () => {
      render(<EventCreationForm />);
    });

    // Fill Step 1 and navigate
    await fillEventDetails('Test Event', 'https://huitstage.zoom.us/j/1234567890');
    const nextButton = screen.getByRole('button', { name: /next/i });
    await user.click(nextButton);

    await waitFor(() => {
      expect(screen.getByText('Nextspace')).toBeInTheDocument();
      expect(screen.getByText('Zoom')).toBeInTheDocument();
    });
  });

  it('updates selected platforms when checkboxes are clicked', async () => {
    const user = userEvent.setup();
    await act(async () => {
      render(<EventCreationForm />);
    });

    // Navigate to Step 2
    await fillEventDetails('Test Event', 'https://huitstage.zoom.us/j/1234567890');
    await user.click(screen.getByRole('button', { name: /next/i }));

    await waitFor(() => {
      expect(screen.getByText('Nextspace')).toBeInTheDocument();
    });

    const nextspaceCheckbox = screen.getByRole('checkbox', {
      name: /nextspace/i,
    });
    const zoomCheckbox = screen.getByRole('checkbox', { name: /zoom/i });

    await user.click(nextspaceCheckbox);
    expect(nextspaceCheckbox).toBeChecked();

    await user.click(zoomCheckbox);
    expect(zoomCheckbox).toBeChecked();

    await user.click(nextspaceCheckbox);
    expect(nextspaceCheckbox).not.toBeChecked();
  });

  it('validates Step 2 requires platform and agent selection', async () => {
    const user = userEvent.setup();
    await act(async () => {
      render(<EventCreationForm />);
    });

    // Navigate to Step 2
    await fillEventDetails('Test Event', 'https://huitstage.zoom.us/j/1234567890');
    await user.click(screen.getByRole('button', { name: /next/i }));

    await waitFor(() => {
      expect(screen.getByText('Nextspace')).toBeInTheDocument();
    });

    // Try to proceed without selections
    await user.click(screen.getByRole('button', { name: /next/i }));

    await waitFor(() => {
      expect(screen.getByText('At least one platform must be selected')).toBeInTheDocument();
    });
  });

  it('navigates to Step 3 after valid Step 2 data', async () => {
    const user = userEvent.setup();
    await act(async () => {
      render(<EventCreationForm />);
    });

    // Fill Step 1 and navigate
    await fillEventDetails('Test Event', 'https://huitstage.zoom.us/j/1234567890');
    await user.click(screen.getByRole('button', { name: /next/i }));

    await waitFor(() => {
      expect(screen.getByText('Nextspace')).toBeInTheDocument();
    });

    // Fill Step 2
    await user.click(screen.getByRole('checkbox', { name: /zoom/i }));
    await user.click(screen.getByRole('radio', { name: /back channel/i }));

    // Navigate to Step 3
    await user.click(screen.getByRole('button', { name: /next/i }));

    await waitFor(() => {
      expect(screen.getByLabelText(/Bot Name/i)).toBeInTheDocument();
    });
  });

  it('displays agent descriptions on Step 2', async () => {
    const user = userEvent.setup();
    await act(async () => {
      render(<EventCreationForm />);
    });

    // Navigate to Step 2
    await fillEventDetails('Test Event', 'https://huitstage.zoom.us/j/1234567890');
    await user.click(screen.getByRole('button', { name: /next/i }));

    await waitFor(() => {
      expect(screen.getByText(/An agent to analyze participant comments/i)).toBeInTheDocument();
      expect(screen.getByText(/An assistant to answer questions about an event/i)).toBeInTheDocument();
    });
  });

  it('displays model selection options with descriptions on Step 3', async () => {
    const user = userEvent.setup();
    await act(async () => {
      render(<EventCreationForm />);
    });

    // Navigate to Step 3
    await fillEventDetails('Test Event', 'https://huitstage.zoom.us/j/1234567890');
    await user.click(screen.getByRole('button', { name: /next/i }));

    await waitFor(() => {
      expect(screen.getByText('Nextspace')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('checkbox', { name: /zoom/i }));
    await user.click(screen.getByRole('radio', { name: /back channel/i }));
    await user.click(screen.getByRole('button', { name: /next/i }));

    await waitFor(() => {
      expect(screen.getByText(/OpenAI GPT-4o Mini/i)).toBeInTheDocument();
      expect(screen.getByText(/AWS Bedrock Claude 3.5 Haiku/i)).toBeInTheDocument();
      expect(screen.getByText(/AWS Bedrock Claude 3.5 Sonnet/i)).toBeInTheDocument();
      expect(screen.getByText(/Fast, lightweight model ideal for everyday conversations/i)).toBeInTheDocument();
    });
  });

  it('navigates to Step 4 (Moderators & Speakers)', async () => {
    const user = userEvent.setup();
    await act(async () => {
      render(<EventCreationForm />);
    });

    // Navigate through all steps
    await fillEventDetails('Test Event', 'https://huitstage.zoom.us/j/1234567890');
    await user.click(screen.getByRole('button', { name: /next/i }));

    await waitFor(() => {
      expect(screen.getByText('Nextspace')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('checkbox', { name: /zoom/i }));
    await user.click(screen.getByRole('radio', { name: /back channel/i }));
    await user.click(screen.getByRole('button', { name: /next/i }));

    await waitFor(() => {
      expect(screen.getByLabelText(/Bot Name/i)).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /next/i }));

    await waitFor(() => {
      expect(screen.getByText('About the Speakers')).toBeInTheDocument();
      expect(screen.getByText('About the Moderators')).toBeInTheDocument();
    });
  });

  it('allows adding and removing speakers on Step 4', async () => {
    const user = userEvent.setup();
    await act(async () => {
      render(<EventCreationForm />);
    });

    // Navigate to Step 4
    await fillEventDetails('Test Event', 'https://huitstage.zoom.us/j/1234567890');
    await user.click(screen.getByRole('button', { name: /next/i }));
    await waitFor(() => screen.getByText('Nextspace'));
    await user.click(screen.getByRole('checkbox', { name: /zoom/i }));
    await user.click(screen.getByRole('radio', { name: /back channel/i }));
    await user.click(screen.getByRole('button', { name: /next/i }));
    await waitFor(() => screen.getByLabelText(/Bot Name/i));
    await user.click(screen.getByRole('button', { name: /next/i }));

    await waitFor(() => {
      expect(screen.getByText('About the Speakers')).toBeInTheDocument();
    });

    // Should have one speaker initially
    expect(screen.getByText('Speaker 1')).toBeInTheDocument();

    // Add another speaker
    const addSpeakerButton = screen.getByRole('button', {
      name: /\+ Add Another Speaker/i,
    });
    await user.click(addSpeakerButton);

    expect(screen.getByText('Speaker 2')).toBeInTheDocument();

    // Remove the second speaker
    const removeButtons = screen.getAllByRole('button', { name: /remove/i });
    await user.click(removeButtons[0]);

    expect(screen.queryByText('Speaker 2')).not.toBeInTheDocument();
  });

  it('allows adding moderators on Step 4', async () => {
    const user = userEvent.setup();
    await act(async () => {
      render(<EventCreationForm />);
    });

    // Navigate to Step 4
    await fillEventDetails('Test Event', 'https://huitstage.zoom.us/j/1234567890');
    await user.click(screen.getByRole('button', { name: /next/i }));
    await waitFor(() => screen.getByText('Nextspace'));
    await user.click(screen.getByRole('checkbox', { name: /zoom/i }));
    await user.click(screen.getByRole('radio', { name: /back channel/i }));
    await user.click(screen.getByRole('button', { name: /next/i }));
    await waitFor(() => screen.getByLabelText(/Bot Name/i));
    await user.click(screen.getByRole('button', { name: /next/i }));

    await waitFor(() => {
      expect(screen.getByText('About the Moderators')).toBeInTheDocument();
    });

    // Initially moderators should not be shown
    expect(screen.queryByText('Moderator 1')).not.toBeInTheDocument();

    // Click to add moderators
    const addModeratorsButton = screen.getByRole('button', {
      name: /\+ Add Moderators/i,
    });
    await user.click(addModeratorsButton);

    expect(screen.getByText('Moderator 1')).toBeInTheDocument();
  });

  it('navigates back through steps', async () => {
    const user = userEvent.setup();
    await act(async () => {
      render(<EventCreationForm />);
    });

    // Navigate to Step 2
    await fillEventDetails('Test Event', 'https://huitstage.zoom.us/j/1234567890');
    await user.click(screen.getByRole('button', { name: /next/i }));

    await waitFor(() => {
      expect(screen.getByText('Nextspace')).toBeInTheDocument();
    });

    // Go back to Step 1
    const backButton = screen.getByRole('button', { name: /back/i });
    await user.click(backButton);

    await waitFor(() => {
      expect(screen.getByLabelText(/Event Name/i)).toBeInTheDocument();
    });

    // Back button should be disabled on Step 1
    expect(screen.getByRole('button', { name: /back/i })).toBeDisabled();
  });

  it('allows custom bot name configuration on Step 3', async () => {
    const user = userEvent.setup();
    await act(async () => {
      render(<EventCreationForm />);
    });

    // Navigate to Step 3
    await fillEventDetails('Test Event', 'https://huitstage.zoom.us/j/1234567890');
    await user.click(screen.getByRole('button', { name: /next/i }));
    await waitFor(() => screen.getByText('Nextspace'));
    await user.click(screen.getByRole('checkbox', { name: /zoom/i }));
    await user.click(screen.getByRole('radio', { name: /back channel/i }));
    await user.click(screen.getByRole('button', { name: /next/i }));

    await waitFor(() => {
      expect(screen.getByLabelText(/Bot Name/i)).toBeInTheDocument();
    });

    const botNameInput = screen.getByLabelText(/Bot Name/i) as HTMLInputElement;
    expect(botNameInput).toHaveValue('Back Channel');

    // Use fireEvent to directly change the value
    fireEvent.change(botNameInput, { target: { value: 'Custom Bot Name' } });
    expect(botNameInput).toHaveValue('Custom Bot Name');
  });

  it('submits correct payload for Back Channel agent with default model', async () => {
    const user = userEvent.setup();
    const mockConversationData = {
      id: 'new-conv-123',
      name: 'Test Event',
      channels: [],
      agents: [],
      adapters: [],
      conversationType: 'eventAssistant',
    };
    (Request as jest.Mock).mockImplementation(makeRequestMock(mockConversationData));

    await act(async () => {
      render(<EventCreationForm />);
    });

    // Complete all steps
    await fillEventDetails('Test Event', 'https://huitstage.zoom.us/j/1234567890');
    await user.click(screen.getByRole('button', { name: /next/i }));

    await waitFor(() => screen.getByText('Nextspace'));
    await user.click(screen.getByRole('checkbox', { name: /zoom/i }));
    await user.click(screen.getByRole('radio', { name: /back channel/i }));
    await user.click(screen.getByRole('button', { name: /next/i }));

    await waitFor(() => screen.getByLabelText(/Bot Name/i));
    await user.click(screen.getByRole('button', { name: /next/i }));

    await waitFor(() => screen.getByText('About the Speakers'));
    await user.click(screen.getByRole('button', { name: /next/i }));
    await waitFor(() => screen.getByText('Reading & Resources'));

    // Submit form
    const submitButton = screen.getByRole('button', {
      name: /create conversation/i,
    });
    await user.click(submitButton);

    await waitFor(() => {
      expect(Request).toHaveBeenCalledWith(
        'conversations/from-type',
        expect.objectContaining({
          name: 'Test Event',
          type: 'backChannel',
          platforms: ['zoom'],
          topicId: 'topic-1',
          properties: expect.objectContaining({
            zoomMeetingUrl: 'https://huitstage.zoom.us/j/1234567890',
            botName: 'Back Channel',
            llmModel: {
              llmPlatform: 'openai',
              llmModel: 'gpt-4o-mini',
            },
          }),
        }),
      );
    });
  });

  it('submits correct payload for Event Assistant with custom model', async () => {
    const user = userEvent.setup();
    const mockConversationData = {
      id: 'new-conv-456',
      name: 'Test Event Assistant',
      channels: [],
      agents: [],
      adapters: [],
      conversationType: 'eventAssistant',
    };
    (Request as jest.Mock).mockImplementation(makeRequestMock(mockConversationData));

    await act(async () => {
      render(<EventCreationForm />);
    });

    // Complete all steps
    await fillEventDetails('Test Event Assistant', 'https://huitstage.zoom.us/j/9876543210');
    await user.click(screen.getByRole('button', { name: /next/i }));

    await waitFor(() => screen.getByText('Nextspace'));
    await user.click(screen.getByRole('checkbox', { name: /zoom/i }));
    await user.click(screen.getByRole('radio', { name: /^event assistant$/i }));
    await user.click(screen.getByRole('button', { name: /next/i }));

    await waitFor(() => {
      expect(screen.getByText(/OpenAI GPT-4o Mini/i)).toBeInTheDocument();
    });

    const sonnetRadio = screen.getByRole('radio', {
      name: /aws bedrock claude 3\.5 sonnet/i,
    });
    await user.click(sonnetRadio);
    await user.click(screen.getByRole('button', { name: /next/i }));

    await waitFor(() => screen.getByText('About the Speakers'));
    await user.click(screen.getByRole('button', { name: /next/i }));
    await waitFor(() => screen.getByText('Reading & Resources'));

    const submitButton = screen.getByRole('button', {
      name: /create conversation/i,
    });
    await user.click(submitButton);

    await waitFor(() => {
      expect(Request).toHaveBeenCalledWith(
        'conversations/from-type',
        expect.objectContaining({
          name: 'Test Event Assistant',
          topicId: 'topic-1',
          properties: expect.objectContaining({
            llmModel: {
              llmPlatform: 'bedrock',
              llmModel: 'anthropic.claude-3-5-sonnet-20240620-v1:0',
            },
          }),
          scheduledTime: expect.any(String),
        }),
      );
    });
  });

  it('submits payload with custom bot name', async () => {
    const user = userEvent.setup();
    const mockConversationData = {
      id: 'new-conv-789',
      name: 'Custom Bot Event',
      channels: [],
      agents: [],
      adapters: [],
      conversationType: 'eventAssistant',
    };
    (Request as jest.Mock).mockImplementation(makeRequestMock(mockConversationData));

    await act(async () => {
      render(<EventCreationForm />);
    });

    // Complete all steps with custom bot name
    await fillEventDetails('Custom Bot Event', 'https://huitstage.zoom.us/j/5555555555');
    await user.click(screen.getByRole('button', { name: /next/i }));

    await waitFor(() => screen.getByText('Nextspace'));
    await user.click(screen.getByRole('checkbox', { name: /zoom/i }));
    await user.click(screen.getByRole('radio', { name: /back channel/i }));
    await user.click(screen.getByRole('button', { name: /next/i }));

    const botNameInput = (await screen.findByLabelText(/Bot Name/i)) as HTMLInputElement;
    // Use fireEvent to directly change the value
    fireEvent.change(botNameInput, { target: { value: 'MyCustomBot' } });
    await user.click(screen.getByRole('button', { name: /next/i }));

    await waitFor(() => screen.getByText('About the Speakers'));
    await user.click(screen.getByRole('button', { name: /next/i }));
    await waitFor(() => screen.getByText('Reading & Resources'));

    const submitButton = screen.getByRole('button', {
      name: /create conversation/i,
    });
    await user.click(submitButton);

    await waitFor(() => {
      expect(Request).toHaveBeenCalledWith(
        'conversations/from-type',
        expect.objectContaining({
          properties: expect.objectContaining({
            zoomMeetingUrl: 'https://huitstage.zoom.us/j/5555555555',
            botName: 'MyCustomBot',
          }),
        }),
      );
    });
  });

  it('submits payload with speakers and moderators', async () => {
    const user = userEvent.setup();
    const mockConversationData = {
      id: 'new-conv-speakers',
      name: 'Event with Speakers',
      channels: [],
      agents: [],
      adapters: [],
      conversationType: 'eventAssistant',
    };
    (Request as jest.Mock).mockImplementation(makeRequestMock(mockConversationData));

    await act(async () => {
      render(<EventCreationForm />);
    });

    // Complete all steps
    await fillEventDetails('Event with Speakers', 'https://huitstage.zoom.us/j/1111111111');
    await user.click(screen.getByRole('button', { name: /next/i }));

    await waitFor(() => screen.getByText('Nextspace'));
    await user.click(screen.getByRole('checkbox', { name: /zoom/i }));
    await user.click(screen.getByRole('radio', { name: /back channel/i }));
    await user.click(screen.getByRole('button', { name: /next/i }));

    await waitFor(() => screen.getByLabelText(/Bot Name/i));
    await user.click(screen.getByRole('button', { name: /next/i }));

    await waitFor(() => screen.getByText('About the Speakers'));

    // Add speaker info
    const speakerNameInputs = screen.getAllByLabelText(/^Name$/i);
    await user.type(speakerNameInputs[0], 'John Doe');
    const speakerBioInputs = screen.getAllByLabelText(/Bio/i);
    await user.type(speakerBioInputs[0], 'Expert speaker');

    // Add moderator
    const addModeratorsButton = screen.getByRole('button', {
      name: /\+ Add Moderators/i,
    });
    await user.click(addModeratorsButton);

    await waitFor(() => {
      expect(screen.getByText('Moderator 1')).toBeInTheDocument();
    });

    const moderatorNameInput = screen.getAllByLabelText(/^Name$/i)[1];
    await user.type(moderatorNameInput, 'Jane Smith');
    const moderatorBioInput = screen.getAllByLabelText(/Bio/i)[1];
    await user.type(moderatorBioInput, 'Experienced moderator');

    await user.click(screen.getByRole('button', { name: /next/i }));
    await waitFor(() => screen.getByText('Reading & Resources'));

    const submitButton = screen.getByRole('button', {
      name: /create conversation/i,
    });
    await user.click(submitButton);

    await waitFor(() => {
      expect(Request).toHaveBeenCalledWith(
        'conversations/from-type',
        expect.objectContaining({
          presenters: [{ name: 'John Doe', bio: 'Expert speaker' }],
          moderators: [{ name: 'Jane Smith', bio: 'Experienced moderator' }],
        }),
      );
    });
  });

  it('displays error message when event name is left empty', async () => {
    const user = userEvent.setup();
    await act(async () => {
      render(<EventCreationForm />);
    });

    // Fill in event name we will then clear and zoom URL
    await fillEventDetails('Scheduled Event To Clear', 'https://huitstage.zoom.us/j/1111111111');

    const nameInput = screen.getByLabelText(/Event Name/i);
    await user.clear(nameInput);

    await user.click(screen.getByRole('button', { name: /next/i }));

    await waitFor(() => {
      expect(screen.getByText('Event Name is required')).toBeInTheDocument();
    });
  });

  it('displays error message when zoom URL is left empty', async () => {
    const user = userEvent.setup();

    await act(async () => {
      render(<EventCreationForm />);
    });

    // Fill in event and zoom URL we will then clear
    await fillEventDetails('Scheduled Event', 'https://huitstage.zoom.us/j/1111111111');

    const urlInput = screen.getByLabelText(/Zoom Meeting URL/i);
    await user.clear(urlInput);

    await user.click(screen.getByRole('button', { name: /next/i }));

    await waitFor(() => {
      expect(screen.getByText('Zoom Meeting URL is required')).toBeInTheDocument();
    });
  });

  it('displays error when no platform is selected', async () => {
    const user = userEvent.setup();

    await act(async () => {
      render(<EventCreationForm />);
    });

    await fillEventDetails('Test Event', 'https://huitstage.zoom.us/j/1234567890');

    // Navigate to Step 3 without selecting platform
    await user.click(screen.getByRole('button', { name: /next/i }));
    await user.click(screen.getByRole('button', { name: /next/i }));

    await waitFor(() => {
      expect(screen.getByText('At least one platform must be selected')).toBeInTheDocument();
    });
  });

  it('clears platform error when platform is selected', async () => {
    const user = userEvent.setup();

    await act(async () => {
      render(<EventCreationForm />);
    });

    await fillEventDetails('Test Event', 'https://huitstage.zoom.us/j/1234567890');

    // Navigate to Step 3 without selecting platform
    await user.click(screen.getByRole('button', { name: /next/i }));
    await user.click(screen.getByRole('button', { name: /next/i }));

    await waitFor(() => {
      expect(screen.getByText('At least one platform must be selected')).toBeInTheDocument();
    });

    const zoomCheckbox = screen.getByRole('checkbox', { name: /zoom/i });
    await user.click(zoomCheckbox);

    await user.click(screen.getByRole('button', { name: /next/i }));

    await waitFor(() => {
      expect(screen.queryByText('At least one platform must be selected')).not.toBeInTheDocument();
    });
  });

  it('does not submit when platform is unselected after being selected', async () => {
    const user = userEvent.setup();

    await act(async () => {
      render(<EventCreationForm />);
    });

    await fillEventDetails('Test Event', 'https://huitstage.zoom.us/j/1234567890');

    await user.click(screen.getByRole('button', { name: /next/i }));

    const backChannelRadio = screen.getByRole('radio', {
      name: /back channel/i,
    });
    await user.click(backChannelRadio);

    const zoomCheckbox = screen.getByRole('checkbox', { name: /zoom/i });

    await user.click(zoomCheckbox);
    await user.click(zoomCheckbox); // Unselect

    await user.click(screen.getByRole('button', { name: /next/i }));

    await waitFor(() => {
      expect(screen.getByText('At least one platform must be selected')).toBeInTheDocument();
    });

    expect(Request).not.toHaveBeenCalledWith('conversations/from-type', expect.anything());
  });

  it('displays error message when form submission fails', async () => {
    const user = userEvent.setup();
    (Request as jest.Mock).mockImplementation((endpoint: string, payload?: any) => {
      if (endpoint === 'topics' && !payload) return Promise.resolve(mockPublicTopics);
      if (endpoint === 'topics/userTopics') return Promise.resolve(mockUserTopics);
      return Promise.reject(new Error('Network error'));
    });

    await act(async () => {
      render(<EventCreationForm />);
    });

    // Complete all steps
    await fillEventDetails('Test Event', 'https://huitstage.zoom.us/j/1234567890');
    await user.click(screen.getByRole('button', { name: /next/i }));

    await waitFor(() => screen.getByText('Nextspace'));
    await user.click(screen.getByRole('checkbox', { name: /zoom/i }));
    await user.click(screen.getByRole('radio', { name: /back channel/i }));
    await user.click(screen.getByRole('button', { name: /next/i }));

    await waitFor(() => screen.getByLabelText(/Bot Name/i));
    await user.click(screen.getByRole('button', { name: /next/i }));

    await waitFor(() => screen.getByText('About the Speakers'));
    await user.click(screen.getByRole('button', { name: /next/i }));
    await waitFor(() => screen.getByText('Reading & Resources'));

    const submitButton = screen.getByRole('button', {
      name: /create conversation/i,
    });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/Failed to send data.*Network error/)).toBeInTheDocument();
    });
  });

  it('displays error when config fetch fails', async () => {
    (RetrieveData as jest.Mock).mockResolvedValue({
      error: true,
      message: { message: 'Failed to load configuration' },
    });

    await act(async () => {
      render(<EventCreationForm />);
    });

    await waitFor(() => {
      expect(screen.getByText('Failed to load configuration.')).toBeInTheDocument();
    });
  });

  it('displays event status after successful conversation creation', async () => {
    const user = userEvent.setup();
    const mockConversationData = {
      id: 'new-conv-redirect',
      name: 'Test Event',
      channels: [],
      agents: [],
      adapters: [],
      conversationType: 'eventAssistant',
    };
    (Request as jest.Mock).mockImplementation(makeRequestMock(mockConversationData));

    await act(async () => {
      render(<EventCreationForm />);
    });

    // Complete all steps
    await fillEventDetails('Test Event', 'https://huitstage.zoom.us/j/1234567890');
    await user.click(screen.getByRole('button', { name: /next/i }));

    await waitFor(() => screen.getByText('Nextspace'));
    await user.click(screen.getByRole('checkbox', { name: /zoom/i }));
    await user.click(screen.getByRole('radio', { name: /back channel/i }));
    await user.click(screen.getByRole('button', { name: /next/i }));

    await waitFor(() => screen.getByLabelText(/Bot Name/i));
    await user.click(screen.getByRole('button', { name: /next/i }));

    await waitFor(() => screen.getByText('About the Speakers'));
    await user.click(screen.getByRole('button', { name: /next/i }));
    await waitFor(() => screen.getByText('Reading & Resources'));

    const submitButton = screen.getByRole('button', {
      name: /create conversation/i,
    });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Event Status')).toBeInTheDocument();
    });

    expect(mockPush).not.toHaveBeenCalled();
  });

  it('fetches configuration from backend on mount', async () => {
    await act(async () => {
      render(<EventCreationForm />);
    });

    await waitFor(() => {
      expect(RetrieveData).toHaveBeenCalledWith('/config');
    });
  });

  it('only fetches config once when supportedModels and availablePlatforms are null', async () => {
    await act(async () => {
      render(<EventCreationForm />);
    });

    await waitFor(() => {
      expect(RetrieveData).toHaveBeenCalledWith('/config');
    });

    // RetrieveData should only be called once during initial mount
    expect(RetrieveData).toHaveBeenCalledTimes(1);
  });

  it('sets default model selection after config is fetched', async () => {
    const user = userEvent.setup();
    await act(async () => {
      render(<EventCreationForm />);
    });

    // Navigate to Step 3 where model selection is shown
    await fillEventDetails('Test Event', 'https://huitstage.zoom.us/j/1234567890');
    await user.click(screen.getByRole('button', { name: /next/i }));

    await waitFor(() => screen.getByText('Nextspace'));
    await user.click(screen.getByRole('checkbox', { name: /zoom/i }));
    await user.click(screen.getByRole('radio', { name: /back channel/i }));
    await user.click(screen.getByRole('button', { name: /next/i }));

    await waitFor(() => {
      const gptRadio = screen.getByRole('radio', {
        name: /openai gpt-4o mini/i,
      });
      // First model (gpt-4o-mini) should be selected by default
      expect(gptRadio).toBeChecked();
    });
  });

  // Helper to navigate to Step 3 with Back Channel selected
  const navigateToStep3WithBackChannel = async (user: ReturnType<typeof userEvent.setup>) => {
    await fillEventDetails('Test Event', 'https://huitstage.zoom.us/j/1234567890');
    await user.click(screen.getByRole('button', { name: /next/i }));
    await waitFor(() => screen.getByText('Nextspace'));
    await user.click(screen.getByRole('checkbox', { name: /zoom/i }));
    await user.click(screen.getByRole('radio', { name: /back channel/i }));
    await user.click(screen.getByRole('button', { name: /next/i }));
    await waitFor(() => screen.getByLabelText(/Bot Name/i));
  };

  describe('Features', () => {
    it('displays the Features section on Step 3 when the conversation type has features', async () => {
      const user = userEvent.setup();
      await act(async () => {
        render(<EventCreationForm />);
      });

      await navigateToStep3WithBackChannel(user);

      expect(screen.getByText('Features')).toBeInTheDocument();
      expect(screen.getByText('Live Transcript')).toBeInTheDocument();
      expect(screen.getByText('Display a live transcript during the event')).toBeInTheDocument();
      expect(screen.getByText('Auto Summary')).toBeInTheDocument();
    });

    it('feature checkboxes are unchecked by default when feature.default is false', async () => {
      const user = userEvent.setup();
      await act(async () => {
        render(<EventCreationForm />);
      });

      await navigateToStep3WithBackChannel(user);

      const liveTranscriptCheckbox = screen.getByRole('checkbox', {
        name: /live transcript/i,
      });
      expect(liveTranscriptCheckbox).not.toBeChecked();

      const autoSummaryCheckbox = screen.getByRole('checkbox', {
        name: /auto summary/i,
      });
      expect(autoSummaryCheckbox).not.toBeChecked();
    });

    it('toggling a feature checkbox shows its sub-properties', async () => {
      const user = userEvent.setup();
      await act(async () => {
        render(<EventCreationForm />);
      });

      await navigateToStep3WithBackChannel(user);

      // Sub-property should not be visible before enabling the feature
      expect(screen.queryByLabelText(/Transcript Delay/i)).not.toBeInTheDocument();

      const liveTranscriptCheckbox = screen.getByRole('checkbox', {
        name: /live transcript/i,
      });
      await user.click(liveTranscriptCheckbox);

      expect(liveTranscriptCheckbox).toBeChecked();
      expect(screen.getByLabelText(/Transcript Delay/i)).toBeInTheDocument();
    });

    it('unchecking a feature hides its sub-properties', async () => {
      const user = userEvent.setup();
      await act(async () => {
        render(<EventCreationForm />);
      });

      await navigateToStep3WithBackChannel(user);

      const liveTranscriptCheckbox = screen.getByRole('checkbox', {
        name: /live transcript/i,
      });
      await user.click(liveTranscriptCheckbox);
      expect(screen.getByLabelText(/Transcript Delay/i)).toBeInTheDocument();

      await user.click(liveTranscriptCheckbox);
      expect(liveTranscriptCheckbox).not.toBeChecked();
      expect(screen.queryByLabelText(/Transcript Delay/i)).not.toBeInTheDocument();
    });

    it('includes features as an empty array in the payload when none are enabled', async () => {
      const user = userEvent.setup();
      (Request as jest.Mock).mockImplementation(
        makeRequestMock({
          id: 'conv-no-features',
          name: 'Test Event',
          channels: [],
          agents: [],
          adapters: [],
          conversationType: 'backChannel',
        }),
      );

      await act(async () => {
        render(<EventCreationForm />);
      });

      await navigateToStep3WithBackChannel(user);
      await user.click(screen.getByRole('button', { name: /next/i }));
      await waitFor(() => screen.getByText('About the Speakers'));
      await user.click(screen.getByRole('button', { name: /next/i }));
      await waitFor(() => screen.getByText('Reading & Resources'));
      await user.click(screen.getByRole('button', { name: /create conversation/i }));

      await waitFor(() => {
        const conversationCall = (Request as jest.Mock).mock.calls.find((call) => call[0] === 'conversations/from-type');
        expect(conversationCall![1]).toHaveProperty('features', []);
      });
    });

    it('includes enabled features with their properties in the submission payload', async () => {
      const user = userEvent.setup();
      (Request as jest.Mock).mockImplementation(
        makeRequestMock({
          id: 'conv-with-features',
          name: 'Test Event',
          channels: [],
          agents: [],
          adapters: [],
          conversationType: 'backChannel',
        }),
      );

      await act(async () => {
        render(<EventCreationForm />);
      });

      await navigateToStep3WithBackChannel(user);

      // Enable the liveTranscript feature
      await user.click(screen.getByRole('checkbox', { name: /live transcript/i }));

      // Also enable autoSummary
      await user.click(screen.getByRole('checkbox', { name: /auto summary/i }));

      await user.click(screen.getByRole('button', { name: /next/i }));
      await waitFor(() => screen.getByText('About the Speakers'));
      await user.click(screen.getByRole('button', { name: /next/i }));
      await waitFor(() => screen.getByText('Reading & Resources'));
      await user.click(screen.getByRole('button', { name: /create conversation/i }));

      await waitFor(() => {
        expect(Request).toHaveBeenCalledWith(
          'conversations/from-type',
          expect.objectContaining({
            features: expect.arrayContaining([
              { name: 'liveTranscript', config: { transcriptDelay: 5 } },
              { name: 'autoSummary', config: {} },
            ]),
          }),
        );
      });
    });

    it('shows only the organizer-configured features for Event Assistant Extra Test', async () => {
      // This test is an explicit allowlist. If you add a new feature to the test type eventAssistantExtraTest
      // and it should appear in the event creation form (userControlled: false), add it here.
      // If it should NOT appear (userControlled: true), add it to the "should not appear" block.
      const user = userEvent.setup();
      await act(async () => {
        render(<EventCreationForm />);
      });

      await fillEventDetails('Test Event', 'https://huitstage.zoom.us/j/1234567890');
      await user.click(screen.getByRole('button', { name: /next/i }));
      await waitFor(() => screen.getByText('Nextspace'));
      await user.click(screen.getByRole('checkbox', { name: /zoom/i }));
      await user.click(
        screen.getByRole('radio', {
          name: /event assistant with additional features/i,
        }),
      );
      await user.click(screen.getByRole('button', { name: /next/i }));
      await waitFor(() => screen.getByText('Features'));

      // Organizer-configured features (userControlled: false) — should appear
      expect(screen.getByText('Collective Voice')).toBeInTheDocument();
      expect(screen.getByText('Catalyst')).toBeInTheDocument();
      expect(screen.getByText('Reading Recommendations')).toBeInTheDocument();

      // Participant-facing features (userControlled: true) — should not appear
      expect(screen.queryByText('Submit to Moderator')).not.toBeInTheDocument();
      expect(screen.queryByText('Mind Map')).not.toBeInTheDocument();
      expect(screen.queryByText('Visual Response')).not.toBeInTheDocument();
      expect(screen.queryByText('Jargon Filter')).not.toBeInTheDocument();
    });

    it('does not show Features section when conversationType has no features', async () => {
      const user = userEvent.setup();
      await act(async () => {
        render(<EventCreationForm />);
      });

      await fillEventDetails('Test Event', 'https://huitstage.zoom.us/j/1234567890');
      await user.click(screen.getByRole('button', { name: /next/i }));
      await waitFor(() => screen.getByText('Nextspace'));
      await user.click(screen.getByRole('checkbox', { name: /zoom/i }));
      // Event Assistant has no features in the mock config
      await user.click(screen.getByRole('radio', { name: /^event assistant$/i }));
      await user.click(screen.getByRole('button', { name: /next/i }));
      await waitFor(() => screen.getByLabelText(/Bot Name/i));

      expect(screen.queryByText('Features')).not.toBeInTheDocument();
    });
  });

  describe('Scheduled Times', () => {
    it('shows error when start time is provided but end time is missing', async () => {
      const user = userEvent.setup();
      await act(async () => {
        render(<EventCreationForm />);
      });

      // Fill required fields with a start time but no end time
      await user.type(screen.getByLabelText(/Event Name/i), 'Test Event');

      const topicInput = screen.getByLabelText(/Select a series/i);
      fireEvent.click(topicInput);
      fireEvent.keyDown(topicInput, { key: 'ArrowDown' });
      fireEvent.click(await screen.findByRole('option', { name: /Public Topic 1/i }));

      await user.type(screen.getByLabelText(/Zoom Meeting URL/i), 'https://huitstage.zoom.us/j/1234567890');

      const startTimeInput = screen.getAllByLabelText(/Meeting Day\/Time/i)[0];
      await user.type(startTimeInput, futureStartTime);

      // No end time set
      await user.click(screen.getByRole('button', { name: /next/i }));

      await waitFor(() => {
        expect(screen.getByText('Meeting End Time is required when a start time is provided')).toBeInTheDocument();
      });
    });

    it('shows error when end time is provided but start time is missing', async () => {
      const user = userEvent.setup();
      await act(async () => {
        render(<EventCreationForm />);
      });

      // Fill required fields without setting start time
      const nameInput = screen.getByLabelText(/Event Name/i);
      await user.type(nameInput, 'Test Event');

      const topicInput = screen.getByLabelText(/Select a series/i);
      fireEvent.click(topicInput);
      fireEvent.keyDown(topicInput, { key: 'ArrowDown' });
      const topicOption = await screen.findByRole('option', {
        name: /Public Topic 1/i,
      });
      fireEvent.click(topicOption);

      const urlInput = screen.getByLabelText(/Zoom Meeting URL/i);
      await user.type(urlInput, 'https://huitstage.zoom.us/j/1234567890');

      // Set only end time, no start time
      const endTimeInput = screen.getAllByLabelText(/Meeting End Time/i)[0];
      await user.type(endTimeInput, futureEndTime);

      await user.click(screen.getByRole('button', { name: /next/i }));

      await waitFor(() => {
        expect(screen.getByText('Meeting Start Time is required when an end time is provided')).toBeInTheDocument();
      });
    });

    it('shows inline error when end time is before start time', async () => {
      const user = userEvent.setup();
      await act(async () => {
        render(<EventCreationForm />);
      });

      // Set start time to 10:00 AM
      const startTimeInput = screen.getAllByLabelText(/Meeting Day\/Time/i)[0];
      await user.type(startTimeInput, futureStartTime);

      // Set end time to 09:00 AM (before start)
      const endTimeInput = screen.getAllByLabelText(/Meeting End Time/i)[0];
      await user.type(endTimeInput, futureEndBeforeStart);

      await waitFor(() => {
        expect(screen.getByText('Meeting End Time must be after the start time.')).toBeInTheDocument();
      });
    });

    it('includes scheduledEndTime in payload when both times are provided', async () => {
      const user = userEvent.setup();
      const mockConversationData = {
        id: 'new-conv-times',
        name: 'Timed Event',
        channels: [],
        agents: [],
        adapters: [],
        conversationType: 'backChannel',
      };
      (Request as jest.Mock).mockImplementation(makeRequestMock(mockConversationData));

      await act(async () => {
        render(<EventCreationForm />);
      });

      // Fill name and topic
      await user.type(screen.getByLabelText(/Event Name/i), 'Timed Event');

      const topicInput = screen.getByLabelText(/Select a series/i);
      fireEvent.click(topicInput);
      fireEvent.keyDown(topicInput, { key: 'ArrowDown' });
      fireEvent.click(await screen.findByRole('option', { name: /Public Topic 1/i }));

      await user.type(screen.getByLabelText(/Zoom Meeting URL/i), 'https://huitstage.zoom.us/j/1234567890');

      // Set start and end times
      const startTimeInput = screen.getAllByLabelText(/Meeting Day\/Time/i)[0];
      await user.type(startTimeInput, futureStartTime);

      const endTimeInput = screen.getAllByLabelText(/Meeting End Time/i)[0];
      await user.type(endTimeInput, futureEndTime);

      await user.click(screen.getByRole('button', { name: /next/i }));

      await waitFor(() => screen.getByText('Nextspace'));
      await user.click(screen.getByRole('checkbox', { name: /zoom/i }));
      await user.click(screen.getByRole('radio', { name: /back channel/i }));
      await user.click(screen.getByRole('button', { name: /next/i }));

      await waitFor(() => screen.getByLabelText(/Bot Name/i));
      await user.click(screen.getByRole('button', { name: /next/i }));

      await waitFor(() => screen.getByText('About the Speakers'));
      await user.click(screen.getByRole('button', { name: /next/i }));
      await waitFor(() => screen.getByText('Reading & Resources'));
      await user.click(screen.getByRole('button', { name: /create conversation/i }));

      await waitFor(() => {
        expect(Request).toHaveBeenCalledWith(
          'conversations/from-type',
          expect.objectContaining({
            scheduledTime: expect.any(String),
            scheduledEndTime: expect.any(String),
          }),
        );
      });
    });
  });

  describe('Event Series', () => {
    it('renders the Event Series field on Step 1', async () => {
      await act(async () => {
        render(<EventCreationForm />);
      });

      expect(screen.getByText(/Event Series/i)).toBeInTheDocument();
      expect(screen.getByRole('radio', { name: /choose existing series/i })).toBeInTheDocument();
      expect(screen.getByRole('radio', { name: /create new series/i })).toBeInTheDocument();
    });

    it("defaults to 'Choose existing series' mode", async () => {
      await act(async () => {
        render(<EventCreationForm />);
      });

      expect(screen.getByRole('radio', { name: /choose existing series/i })).toBeChecked();
      expect(screen.getByRole('radio', { name: /create new series/i })).not.toBeChecked();
    });

    it('fetches and displays public topics in the autocomplete', async () => {
      const user = userEvent.setup();
      await act(async () => {
        render(<EventCreationForm />);
      });

      await waitFor(() => {
        expect(Request).toHaveBeenCalledWith('topics');
        expect(Request).toHaveBeenCalledWith('topics/userTopics');
      });

      const topicInput = screen.getByLabelText(/Select a series/i);
      fireEvent.click(topicInput);
      fireEvent.keyDown(topicInput, { key: 'ArrowDown' });

      await waitFor(() => {
        expect(screen.getByText('Public Topic 1')).toBeInTheDocument();
        expect(screen.getByText('Public Topic 2')).toBeInTheDocument();
      });
    });

    it('excludes archived and deleted topics from the list', async () => {
      const user = userEvent.setup();
      await act(async () => {
        render(<EventCreationForm />);
      });

      const topicInput = screen.getByLabelText(/Select a series/i);
      fireEvent.click(topicInput);
      fireEvent.keyDown(topicInput, { key: 'ArrowDown' });

      // Wait for the listbox to open, then assert excluded topics are absent
      await screen.findByRole('listbox');
      expect(screen.queryByText('Archived Topic')).not.toBeInTheDocument();
      expect(screen.queryByText('Deleted Topic')).not.toBeInTheDocument();
    });

    it('shows private topics owned by the current user', async () => {
      const user = userEvent.setup();
      await act(async () => {
        render(<EventCreationForm />);
      });

      const topicInput = screen.getByLabelText(/Select a series/i);
      fireEvent.click(topicInput);
      fireEvent.keyDown(topicInput, { key: 'ArrowDown' });

      await waitFor(() => {
        expect(screen.getByText('My Private Topic')).toBeInTheDocument();
      });
    });

    it('shows error when Next is clicked with no topic selected', async () => {
      const user = userEvent.setup();
      await act(async () => {
        render(<EventCreationForm />);
      });

      const nameInput = screen.getByLabelText(/Event Name/i);
      await user.type(nameInput, 'Test Event');

      const urlInput = screen.getByLabelText(/Zoom Meeting URL/i);
      await user.type(urlInput, 'https://huitstage.zoom.us/j/1234567890');

      await user.click(screen.getByRole('button', { name: /next/i }));

      await waitFor(() => {
        expect(screen.getByText('An Event Series is required')).toBeInTheDocument();
      });
    });

    it('shows error on blur when autocomplete is left empty', async () => {
      const user = userEvent.setup();
      await act(async () => {
        render(<EventCreationForm />);
      });

      const topicInput = screen.getByLabelText(/Select a series/i);
      fireEvent.focus(topicInput);
      fireEvent.blur(topicInput);

      await waitFor(() => {
        expect(screen.getByText('Please select an Event Series.')).toBeInTheDocument();
      });
    });

    it('switches to new series creation form', async () => {
      const user = userEvent.setup();
      await act(async () => {
        render(<EventCreationForm />);
      });

      await user.click(screen.getByRole('radio', { name: /create new series/i }));

      expect(screen.getByLabelText(/Series Name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Series Description/i)).toBeInTheDocument();
      expect(screen.getByRole('checkbox', { name: /public/i })).toBeInTheDocument();
    });

    it('new series Public checkbox is unchecked by default', async () => {
      const user = userEvent.setup();
      await act(async () => {
        render(<EventCreationForm />);
      });

      await user.click(screen.getByRole('radio', { name: /create new series/i }));

      expect(screen.getByRole('checkbox', { name: /public/i })).not.toBeChecked();
    });

    it('shows error when Next is clicked with empty series name', async () => {
      const user = userEvent.setup();
      await act(async () => {
        render(<EventCreationForm />);
      });

      await user.click(screen.getByRole('radio', { name: /create new series/i }));

      const nameInput = screen.getByLabelText(/Event Name/i);
      await user.type(nameInput, 'Test Event');

      const urlInput = screen.getByLabelText(/Zoom Meeting URL/i);
      await user.type(urlInput, 'https://huitstage.zoom.us/j/1234567890');

      await user.click(screen.getByRole('button', { name: /next/i }));

      await waitFor(() => {
        expect(screen.getByText('Series name is required')).toBeInTheDocument();
      });
    });

    it('shows series name error on blur when left empty', async () => {
      const user = userEvent.setup();
      await act(async () => {
        render(<EventCreationForm />);
      });

      await user.click(screen.getByRole('radio', { name: /create new series/i }));

      const seriesNameInput = screen.getByLabelText(/Series Name/i);
      await user.click(seriesNameInput);
      await user.tab();

      await waitFor(() => {
        expect(screen.getByText('Series name is required.')).toBeInTheDocument();
      });
    });

    it('creates a new topic then submits the conversation with the new topic ID', async () => {
      const user = userEvent.setup();
      const newTopicId = 'new-topic-id-123';
      const mockConversationData = {
        id: 'new-conv-123',
        name: 'Test Event',
        channels: [],
        agents: [],
        adapters: [],
        conversationType: 'backChannel',
      };
      (Request as jest.Mock).mockImplementation((endpoint: string, payload?: any) => {
        if (endpoint === 'topics' && !payload) return Promise.resolve(mockPublicTopics);
        if (endpoint === 'topics/userTopics') return Promise.resolve(mockUserTopics);
        if (endpoint === 'topics' && payload) return Promise.resolve({ id: newTopicId });
        return Promise.resolve(mockConversationData);
      });

      await act(async () => {
        render(<EventCreationForm />);
      });

      // Switch to new series mode
      await user.click(screen.getByRole('radio', { name: /create new series/i }));

      // Fill in series name
      await user.type(screen.getByLabelText(/Series Name/i), 'My New Series');
      await user.type(screen.getByLabelText(/Series Description/i), 'A great series');

      // Fill the rest of Step 1
      await user.type(screen.getByLabelText(/Event Name/i), 'Test Event');
      await user.type(screen.getByLabelText(/Zoom Meeting URL/i), 'https://huitstage.zoom.us/j/1234567890');

      await user.click(screen.getByRole('button', { name: /next/i }));

      await waitFor(() => screen.getByText('Nextspace'));
      await user.click(screen.getByRole('checkbox', { name: /zoom/i }));
      await user.click(screen.getByRole('radio', { name: /back channel/i }));
      await user.click(screen.getByRole('button', { name: /next/i }));

      await waitFor(() => screen.getByLabelText(/Bot Name/i));
      await user.click(screen.getByRole('button', { name: /next/i }));

      await waitFor(() => screen.getByText('About the Speakers'));
      await user.click(screen.getByRole('button', { name: /next/i }));
      await waitFor(() => screen.getByText('Reading & Resources'));
      await user.click(screen.getByRole('button', { name: /create conversation/i }));

      await waitFor(() => {
        expect(Request).toHaveBeenCalledWith(
          'topics',
          expect.objectContaining({
            name: 'My New Series',
            description: 'A great series',
            private: true,
          }),
        );
        expect(Request).toHaveBeenCalledWith('conversations/from-type', expect.objectContaining({ topicId: newTopicId }));
      });
    });

    it('submits with selected existing topic ID', async () => {
      const user = userEvent.setup();
      const mockConversationData = {
        id: 'new-conv-123',
        name: 'Test Event',
        channels: [],
        agents: [],
        adapters: [],
        conversationType: 'backChannel',
      };
      (Request as jest.Mock).mockImplementation(makeRequestMock(mockConversationData));

      await act(async () => {
        render(<EventCreationForm />);
      });

      await fillEventDetails('Test Event', 'https://huitstage.zoom.us/j/1234567890');
      await user.click(screen.getByRole('button', { name: /next/i }));

      await waitFor(() => screen.getByText('Nextspace'));
      await user.click(screen.getByRole('checkbox', { name: /zoom/i }));
      await user.click(screen.getByRole('radio', { name: /back channel/i }));
      await user.click(screen.getByRole('button', { name: /next/i }));

      await waitFor(() => screen.getByLabelText(/Bot Name/i));
      await user.click(screen.getByRole('button', { name: /next/i }));

      await waitFor(() => screen.getByText('About the Speakers'));
      await user.click(screen.getByRole('button', { name: /next/i }));
      await waitFor(() => screen.getByText('Reading & Resources'));
      await user.click(screen.getByRole('button', { name: /create conversation/i }));

      await waitFor(() => {
        expect(Request).toHaveBeenCalledWith('conversations/from-type', expect.objectContaining({ topicId: 'topic-1' }));
        // Should NOT have called topics POST to create a new topic
        expect(Request).not.toHaveBeenCalledWith('topics', expect.anything());
      });
    });
  });

  describe('Resources (Step 5)', () => {
    const mockConversationData = {
      id: 'conv-resources',
      name: 'Test Event',
      channels: [],
      agents: [],
      adapters: [],
      conversationType: 'backChannel',
      resources: [],
    };

    const navigateToStep5 = async (user: ReturnType<typeof userEvent.setup>) => {
      await fillEventDetails('Test Event', 'https://huitstage.zoom.us/j/1234567890');
      await user.click(screen.getByRole('button', { name: /next/i }));
      await waitFor(() => screen.getByText('Nextspace'));
      await user.click(screen.getByRole('checkbox', { name: /zoom/i }));
      await user.click(screen.getByRole('radio', { name: /back channel/i }));
      await user.click(screen.getByRole('button', { name: /next/i }));
      await waitFor(() => screen.getByLabelText(/Bot Name/i));
      await user.click(screen.getByRole('button', { name: /next/i }));
      await waitFor(() => screen.getByText('About the Speakers'));
      await user.click(screen.getByRole('button', { name: /next/i }));
      await waitFor(() => screen.getByText('Reading & Resources'));
    };

    beforeEach(() => {
      (Request as jest.Mock).mockImplementation(makeRequestMock(mockConversationData));
      (SendData as jest.Mock).mockResolvedValue({});
    });

    it('renders step 5 with one resource entry by default', async () => {
      const user = userEvent.setup();
      await act(async () => {
        render(<EventCreationForm />);
      });
      await navigateToStep5(user);

      expect(screen.getByText('Resource 1')).toBeInTheDocument();
      expect(screen.getByLabelText(/^Title/i)).toBeInTheDocument();
    });

    it('renders all resource fields', async () => {
      const user = userEvent.setup();
      await act(async () => {
        render(<EventCreationForm />);
      });
      await navigateToStep5(user);

      expect(screen.getByLabelText(/^Title/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/^URL/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Authors/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Year/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Citation/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Description/i)).toBeInTheDocument();
    });

    it('renders the PDF drop zone', async () => {
      const user = userEvent.setup();
      await act(async () => {
        render(<EventCreationForm />);
      });
      await navigateToStep5(user);

      expect(screen.getByText(/Drop a PDF here or/i)).toBeInTheDocument();
      expect(screen.getByText(/Max 20 MB/i)).toBeInTheDocument();
    });

    it('renders Show to attendees and Mark as required checkboxes', async () => {
      const user = userEvent.setup();
      await act(async () => {
        render(<EventCreationForm />);
      });
      await navigateToStep5(user);

      expect(screen.getByRole('checkbox', { name: /show to attendees/i })).toBeInTheDocument();
      expect(screen.getByRole('checkbox', { name: /mark as required/i })).toBeInTheDocument();
    });

    it('Show to attendees is checked by default', async () => {
      const user = userEvent.setup();
      await act(async () => {
        render(<EventCreationForm />);
      });
      await navigateToStep5(user);

      expect(screen.getByRole('checkbox', { name: /show to attendees/i })).toBeChecked();
    });

    it('Mark as required is unchecked by default', async () => {
      const user = userEvent.setup();
      await act(async () => {
        render(<EventCreationForm />);
      });
      await navigateToStep5(user);

      expect(screen.getByRole('checkbox', { name: /mark as required/i })).not.toBeChecked();
    });

    it('Mark as required is disabled when Show to attendees is unchecked', async () => {
      const user = userEvent.setup();
      await act(async () => {
        render(<EventCreationForm />);
      });
      await navigateToStep5(user);

      await user.click(screen.getByRole('checkbox', { name: /show to attendees/i }));

      expect(screen.getByRole('checkbox', { name: /mark as required/i })).toBeDisabled();
    });

    it('hides Remove button when there is only one resource', async () => {
      const user = userEvent.setup();
      await act(async () => {
        render(<EventCreationForm />);
      });
      await navigateToStep5(user);

      expect(screen.queryByRole('button', { name: /^remove$/i })).not.toBeInTheDocument();
    });

    it('adds a second resource entry when Add Resource is clicked', async () => {
      const user = userEvent.setup();
      await act(async () => {
        render(<EventCreationForm />);
      });
      await navigateToStep5(user);

      await user.click(screen.getByRole('button', { name: /\+ Add Resource/i }));

      expect(screen.getByText('Resource 2')).toBeInTheDocument();
    });

    it('shows Remove button when there are multiple resources', async () => {
      const user = userEvent.setup();
      await act(async () => {
        render(<EventCreationForm />);
      });
      await navigateToStep5(user);

      await user.click(screen.getByRole('button', { name: /\+ Add Resource/i }));

      expect(screen.getAllByRole('button', { name: /^remove$/i })).toHaveLength(2);
    });

    it('removes a resource entry when Remove is clicked', async () => {
      const user = userEvent.setup();
      await act(async () => {
        render(<EventCreationForm />);
      });
      await navigateToStep5(user);

      await user.click(screen.getByRole('button', { name: /\+ Add Resource/i }));
      expect(screen.getByText('Resource 2')).toBeInTheDocument();

      await user.click(screen.getAllByRole('button', { name: /^remove$/i })[0]);
      expect(screen.queryByText('Resource 2')).not.toBeInTheDocument();
    });

    it('does not include resources in payload when title is empty', async () => {
      const user = userEvent.setup();
      await act(async () => {
        render(<EventCreationForm />);
      });
      await navigateToStep5(user);

      // Leave title blank, submit
      await user.click(screen.getByRole('button', { name: /create conversation/i }));

      await waitFor(() => {
        const call = (Request as jest.Mock).mock.calls.find((c) => c[0] === 'conversations/from-type');
        expect(call![1]).not.toHaveProperty('resources');
      });
    });

    it('includes resource in payload when title is filled', async () => {
      const user = userEvent.setup();
      await act(async () => {
        render(<EventCreationForm />);
      });
      await navigateToStep5(user);

      await user.type(screen.getByLabelText(/^Title/i), 'Attention Is All You Need');
      await user.click(screen.getByRole('button', { name: /create conversation/i }));

      await waitFor(() => {
        expect(Request).toHaveBeenCalledWith(
          'conversations/from-type',
          expect.objectContaining({
            resources: expect.arrayContaining([
              expect.objectContaining({
                title: 'Attention Is All You Need',
                source: 'speaker',
                category: 'suggested',
                participantVisible: true,
              }),
            ]),
          }),
        );
      });
    });

    it('sends category "required" when Mark as required is checked', async () => {
      const user = userEvent.setup();
      await act(async () => {
        render(<EventCreationForm />);
      });
      await navigateToStep5(user);

      await user.type(screen.getByLabelText(/^Title/i), 'Required Paper');
      await user.click(screen.getByRole('checkbox', { name: /mark as required/i }));
      await user.click(screen.getByRole('button', { name: /create conversation/i }));

      await waitFor(() => {
        expect(Request).toHaveBeenCalledWith(
          'conversations/from-type',
          expect.objectContaining({
            resources: expect.arrayContaining([expect.objectContaining({ category: 'required' })]),
          }),
        );
      });
    });

    it('sends participantVisible: false when Show to attendees is unchecked', async () => {
      const user = userEvent.setup();
      await act(async () => {
        render(<EventCreationForm />);
      });
      await navigateToStep5(user);

      await user.type(screen.getByLabelText(/^Title/i), 'Private Paper');
      await user.click(screen.getByRole('checkbox', { name: /show to attendees/i }));
      await user.click(screen.getByRole('button', { name: /create conversation/i }));

      await waitFor(() => {
        expect(Request).toHaveBeenCalledWith(
          'conversations/from-type',
          expect.objectContaining({
            resources: expect.arrayContaining([expect.objectContaining({ participantVisible: false })]),
          }),
        );
      });
    });

    it('splits authors string into array in the payload', async () => {
      const user = userEvent.setup();
      await act(async () => {
        render(<EventCreationForm />);
      });
      await navigateToStep5(user);

      await user.type(screen.getByLabelText(/^Title/i), 'Paper');
      await user.type(screen.getByLabelText(/Authors/i), 'Jane Smith, John Doe');
      await user.click(screen.getByRole('button', { name: /create conversation/i }));

      await waitFor(() => {
        expect(Request).toHaveBeenCalledWith(
          'conversations/from-type',
          expect.objectContaining({
            resources: expect.arrayContaining([expect.objectContaining({ authors: ['Jane Smith', 'John Doe'] })]),
          }),
        );
      });
    });

    it('includes optional fields when provided', async () => {
      const user = userEvent.setup();
      await act(async () => {
        render(<EventCreationForm />);
      });
      await navigateToStep5(user);

      await user.type(screen.getByLabelText(/^Title/i), 'Full Paper');
      await user.type(screen.getByLabelText(/^URL/i), 'https://example.com');
      await user.type(screen.getByLabelText(/Year/i), '2024');
      await user.type(screen.getByLabelText(/Citation/i), 'Smith et al. (2024).');
      await user.type(screen.getByLabelText(/Description/i), 'Very relevant.');
      await user.click(screen.getByRole('button', { name: /create conversation/i }));

      await waitFor(() => {
        expect(Request).toHaveBeenCalledWith(
          'conversations/from-type',
          expect.objectContaining({
            resources: expect.arrayContaining([
              expect.objectContaining({
                url: 'https://example.com',
                year: '2024',
                citation: 'Smith et al. (2024).',
                description: 'Very relevant.',
              }),
            ]),
          }),
        );
      });
    });

    it('rejects a PDF over 20 MB and shows an error', async () => {
      const user = userEvent.setup();
      await act(async () => {
        render(<EventCreationForm />);
      });
      await navigateToStep5(user);

      const oversizedFile = new File(['x'.repeat(1)], 'big.pdf', { type: 'application/pdf' });
      Object.defineProperty(oversizedFile, 'size', { value: 51 * 1024 * 1024 });

      const input = document.getElementById('pdf-upload-0') as HTMLInputElement;
      await user.upload(input, oversizedFile);

      await waitFor(() => {
        expect(screen.getByText(/exceeds the 20 MB limit/i)).toBeInTheDocument();
      });
    });

    it('accepts a PDF under 20 MB and shows the filename', async () => {
      const user = userEvent.setup();
      await act(async () => {
        render(<EventCreationForm />);
      });
      await navigateToStep5(user);

      const validFile = new File(['content'], 'notes.pdf', { type: 'application/pdf' });

      const input = document.getElementById('pdf-upload-0') as HTMLInputElement;
      await user.upload(input, validFile);

      await waitFor(() => {
        expect(screen.getByText('notes.pdf')).toBeInTheDocument();
        expect(screen.getByText(/Used as AI background context/i)).toBeInTheDocument();
      });
    });

    it('calls SendData to upload PDF after conversation creation when resource has a PDF', async () => {
      const user = userEvent.setup();
      const convWithResources = {
        ...mockConversationData,
        resources: [
          { id: 'res-abc', title: 'My Paper', source: 'speaker', category: 'suggested', participantVisible: true },
        ],
      };
      (Request as jest.Mock).mockImplementation(makeRequestMock(convWithResources));

      await act(async () => {
        render(<EventCreationForm />);
      });
      await navigateToStep5(user);

      await user.type(screen.getByLabelText(/^Title/i), 'My Paper');

      const validFile = new File(['content'], 'paper.pdf', { type: 'application/pdf' });
      const input = document.getElementById('pdf-upload-0') as HTMLInputElement;
      await user.upload(input, validFile);

      await waitFor(() => screen.getByText('paper.pdf'));

      await user.click(screen.getByRole('button', { name: /create conversation/i }));

      await waitFor(() => {
        expect(SendData).toHaveBeenCalledWith(
          'resources/conv-resources/res-abc/pdf',
          null,
          undefined,
          expect.objectContaining({ method: 'POST', body: expect.any(FormData) }),
        );
      });
    });

    it('shows a warning when PDF upload fails but still shows EventStatus', async () => {
      const user = userEvent.setup();
      const convWithResources = {
        ...mockConversationData,
        resources: [
          { id: 'res-fail', title: 'Fail Paper', source: 'speaker', category: 'suggested', participantVisible: true },
        ],
      };
      (Request as jest.Mock).mockImplementation(makeRequestMock(convWithResources));
      (SendData as jest.Mock).mockResolvedValue({ error: true });

      await act(async () => {
        render(<EventCreationForm />);
      });
      await navigateToStep5(user);

      await user.type(screen.getByLabelText(/^Title/i), 'Fail Paper');

      const validFile = new File(['content'], 'fail.pdf', { type: 'application/pdf' });
      const input = document.getElementById('pdf-upload-0') as HTMLInputElement;
      await user.upload(input, validFile);

      await waitFor(() => screen.getByText('fail.pdf'));

      await user.click(screen.getByRole('button', { name: /create conversation/i }));

      await waitFor(() => {
        expect(screen.getByText(/fail\.pdf/i)).toBeInTheDocument();
        expect(screen.getByText('Event Status')).toBeInTheDocument();
      });
    });

    it('does not call SendData when resource has no PDF attached', async () => {
      const user = userEvent.setup();
      const convWithResources = {
        ...mockConversationData,
        resources: [
          { id: 'res-nopdf', title: 'No PDF Paper', source: 'speaker', category: 'suggested', participantVisible: true },
        ],
      };
      (Request as jest.Mock).mockImplementation(makeRequestMock(convWithResources));

      await act(async () => {
        render(<EventCreationForm />);
      });
      await navigateToStep5(user);

      await user.type(screen.getByLabelText(/^Title/i), 'No PDF Paper');
      await user.click(screen.getByRole('button', { name: /create conversation/i }));

      await waitFor(() => screen.getByText('Event Status'));
      expect(SendData).not.toHaveBeenCalled();
    });
  });

  describe('Edit mode', () => {
    const mockInitialEvent: any = {
      id: 'conv-edit-123',
      name: 'My Existing Event',
      description: 'An existing event description',
      active: false,
      owner: 'current-user-id',
      properties: {
        zoomMeetingUrl: 'https://zoom.us/j/existing',
        botName: 'ExistingBot',
      },
      scheduledTime: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
      scheduledEndTime: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
      platforms: ['zoom'],
      conversationType: 'backChannel',
      type: {
        name: 'backChannel',
        label: 'Back Channel',
        description: 'An agent to analyze participant comments',
        properties: [],
        platforms: [],
      },
      topic: 'topic-1',
      moderators: [],
      presenters: [],
      features: [],
      channels: [],
      agents: [],
      adapters: [],
      messages: [],
      followers: [],
      enableDMs: [],
      experiments: [],
      eventUrls: { moderator: [], participant: [] },
    };

    beforeEach(() => {
      (updateConversation as jest.Mock).mockResolvedValue({ id: 'conv-edit-123' });
    });

    it('shows "Edit Event" as the form title in edit mode', async () => {
      await act(async () => {
        render(<EventCreationForm mode="edit" initialEvent={mockInitialEvent} />);
      });

      await waitFor(() => {
        expect(screen.getByText('Edit Event')).toBeInTheDocument();
      });
    });

    it('pre-fills the event name from the existing conversation', async () => {
      await act(async () => {
        render(<EventCreationForm mode="edit" initialEvent={mockInitialEvent} />);
      });

      await waitFor(() => {
        const nameInput = screen.getByLabelText(/Event Name/i) as HTMLInputElement;
        expect(nameInput.value).toBe('My Existing Event');
      });
    });

    it('pre-fills the Zoom URL from the existing conversation', async () => {
      await act(async () => {
        render(<EventCreationForm mode="edit" initialEvent={mockInitialEvent} />);
      });

      await waitFor(() => {
        const urlInput = screen.getByLabelText(/Zoom Meeting URL/i) as HTMLInputElement;
        expect(urlInput.value).toBe('https://zoom.us/j/existing');
      });
    });

    it('shows "Save Changes" as the submit button in edit mode', async () => {
      const user = userEvent.setup();
      await act(async () => {
        render(<EventCreationForm mode="edit" initialEvent={mockInitialEvent} />);
      });

      // Navigate to last step
      await waitFor(() => screen.getByLabelText(/Event Name/i));
      await user.click(screen.getByRole('button', { name: /next/i }));
      await waitFor(() => screen.getByText('Nextspace'));
      await user.click(screen.getByRole('button', { name: /next/i }));
      await waitFor(() => screen.getByText('Customize your conversation settings'));
      await user.click(screen.getByRole('button', { name: /next/i }));
      await waitFor(() => screen.getByText('About the Speakers'));
      await user.click(screen.getByRole('button', { name: /next/i }));
      await waitFor(() => screen.getByText('Reading & Resources'));

      expect(screen.getByRole('button', { name: /save changes/i })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /create conversation/i })).not.toBeInTheDocument();
    });

    it('calls updateConversation on submit in edit mode, not Request', async () => {
      const user = userEvent.setup();
      await act(async () => {
        render(<EventCreationForm mode="edit" initialEvent={mockInitialEvent} />);
      });

      // Navigate to last step
      await waitFor(() => screen.getByLabelText(/Event Name/i));
      await user.click(screen.getByRole('button', { name: /next/i }));
      await waitFor(() => screen.getByText('Nextspace'));
      await user.click(screen.getByRole('button', { name: /next/i }));
      await waitFor(() => screen.getByText('Customize your conversation settings'));
      await user.click(screen.getByRole('button', { name: /next/i }));
      await waitFor(() => screen.getByText('About the Speakers'));
      await user.click(screen.getByRole('button', { name: /next/i }));
      await waitFor(() => screen.getByText('Reading & Resources'));

      await user.click(screen.getByRole('button', { name: /save changes/i }));

      await waitFor(() => {
        expect(updateConversation).toHaveBeenCalledWith(
          'conv-edit-123',
          expect.objectContaining({
            name: 'My Existing Event',
            properties: expect.objectContaining({
              zoomMeetingUrl: 'https://zoom.us/j/existing',
            }),
          }),
        );
        expect(Request).not.toHaveBeenCalledWith('conversations/from-type', expect.anything());
      });
    });

    it('navigates to the view page after saving a legacy event with no type object set', async () => {
      /* Legacy events may have conversationType (a string) but no type object. The
         post-save redirect must not crash by reading type.name directly — it should
         fall back to conversationType the same way the Cancel button does. */
      const legacyEvent = {
        ...mockInitialEvent,
        type: undefined,
        conversationType: 'backChannel',
      };
      (updateConversation as jest.Mock).mockResolvedValue({ id: 'conv-edit-123' });
      const user = userEvent.setup();
      await act(async () => {
        render(<EventCreationForm mode="edit" initialEvent={legacyEvent} />);
      });
      await waitFor(() => screen.getByLabelText(/Event Name/i));
      await user.click(screen.getByRole('button', { name: /next/i }));
      await waitFor(() => screen.getByText('Nextspace'));
      await user.click(screen.getByRole('button', { name: /next/i }));
      await waitFor(() => screen.getByText('Customize your conversation settings'));
      await user.click(screen.getByRole('button', { name: /next/i }));
      await waitFor(() => screen.getByText('About the Speakers'));
      await user.click(screen.getByRole('button', { name: /next/i }));
      await waitFor(() => screen.getByText('Reading & Resources'));
      await user.click(screen.getByRole('button', { name: /save changes/i }));

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/admin/backChannel/view/conv-edit-123');
      });
    });

    describe('Agent type change hint', () => {
      const navigateToStep2 = async (user: ReturnType<typeof userEvent.setup>) => {
        await waitFor(() => screen.getByLabelText(/Event Name/i));
        await user.click(screen.getByRole('button', { name: /next/i }));
        await waitFor(() => screen.getByText('Nextspace'));
      };

      it('shows hint when the user changes the pre-filled agent type', async () => {
        const user = userEvent.setup();
        await act(async () => {
          render(<EventCreationForm mode="edit" initialEvent={mockInitialEvent} />);
        });

        await navigateToStep2(user);

        // Back Channel is pre-filled; switching to Event Assistant should trigger the hint
        await user.click(screen.getByRole('radio', { name: /event assistant$/i }));

        expect(screen.getByText(/changing the agent type will also update the bot name/i)).toBeInTheDocument();
      });

      it('does not show hint when first arriving at Step 2 without changing the selection', async () => {
        const user = userEvent.setup();
        await act(async () => {
          render(<EventCreationForm mode="edit" initialEvent={mockInitialEvent} />);
        });

        await navigateToStep2(user);

        expect(screen.queryByText(/changing the agent type will also update the bot name/i)).not.toBeInTheDocument();
      });

      it('preserves the saved AI model when the agent type is changed', async () => {
        const eventWithHaikuModel: any = {
          ...mockInitialEvent,
          properties: {
            ...mockInitialEvent.properties,
            llmModel: { llmPlatform: 'bedrock', llmModel: 'anthropic.claude-3-5-haiku-20241022-v1:0' },
          },
        };
        const user = userEvent.setup();
        await act(async () => {
          render(<EventCreationForm mode="edit" initialEvent={eventWithHaikuModel} />);
        });

        await navigateToStep2(user);
        // Switch from Back Channel to Event Assistant — whose first/default option is gpt-4o-mini
        await user.click(screen.getByRole('radio', { name: /event assistant$/i }));
        // Navigate to Step 3 (Zoom is already pre-filled from the event, no need to re-check)
        await user.click(screen.getByRole('button', { name: /next/i }));
        await waitFor(() => screen.getByText('Customize your conversation settings'));

        // The saved haiku model should still be selected, not reset to gpt-4o-mini
        const haikuRadio = screen.getByRole('radio', { name: /AWS Bedrock Claude 3\.5 Haiku/i });
        expect(haikuRadio).toBeChecked();
      });
    });

    describe('Configuration pre-fill (Step 3)', () => {
      // Uses a richer event that includes a non-default model and an enabled feature
      // with a non-default sub-property value. Tests fail if the form resets these
      // to type defaults instead of restoring the saved settings.
      const mockInitialEventWithConfig: any = {
        ...mockInitialEvent,
        properties: {
          zoomMeetingUrl: 'https://zoom.us/j/existing',
          botName: 'ExistingBot',
          // Non-default model (default is gpt-4o-mini / openai)
          llmModel: { llmPlatform: 'bedrock', llmModel: 'anthropic.claude-3-5-haiku-20241022-v1:0' },
        },
        features: [{ name: 'liveTranscript', enabled: true, config: { transcriptDelay: 10 } }],
      };

      const navigateToStep3 = async (user: ReturnType<typeof userEvent.setup>, event = mockInitialEventWithConfig) => {
        await act(async () => {
          render(<EventCreationForm mode="edit" initialEvent={event} />);
        });
        await waitFor(() => screen.getByLabelText(/Event Name/i));
        await user.click(screen.getByRole('button', { name: /next/i }));
        await waitFor(() => screen.getByText('Nextspace'));
        await user.click(screen.getByRole('button', { name: /next/i }));
        await waitFor(() => screen.getByText('Customize your conversation settings'));
      };

      it('pre-fills bot name in Step 3', async () => {
        const user = userEvent.setup();
        await navigateToStep3(user);
        const botNameInput = screen.getByLabelText(/Bot Name/i) as HTMLInputElement;
        expect(botNameInput.value).toBe('ExistingBot');
      });

      it('pre-selects the saved AI model radio button in Step 3', async () => {
        const user = userEvent.setup();
        await navigateToStep3(user);
        const claudeHaikuRadio = screen.getByRole('radio', {
          name: /AWS Bedrock Claude 3\.5 Haiku/i,
        });
        expect(claudeHaikuRadio).toBeChecked();
      });

      it('pre-checks enabled feature toggles in Step 3', async () => {
        const user = userEvent.setup();
        await navigateToStep3(user);
        const liveTranscriptCheckbox = screen.getByRole('checkbox', {
          name: /Live Transcript/i,
        });
        expect(liveTranscriptCheckbox).toBeChecked();
      });

      it('pre-fills feature sub-property values in Step 3', async () => {
        const user = userEvent.setup();
        await navigateToStep3(user);
        // transcriptDelay is only visible when liveTranscript is enabled
        const delayInput = screen.getByLabelText(/Transcript Delay/i) as HTMLInputElement;
        expect(delayInput.value).toBe('10');
      });

      it('pre-selects the correct model even when property keys come back in unexpected order', async () => {
        // MongoDB Mixed fields don't guarantee key order, so the stored object may have
        // keys in a different order than the form built when it was saved. The radio
        // comparison must be key-order-agnostic or it silently resets to the default.
        const eventWithReversedKeys: any = {
          ...mockInitialEventWithConfig,
          properties: {
            ...mockInitialEventWithConfig.properties,
            llmModel: { llmModel: 'anthropic.claude-3-5-haiku-20241022-v1:0', llmPlatform: 'bedrock' },
          },
        };
        const user = userEvent.setup();
        await navigateToStep3(user, eventWithReversedKeys);
        const claudeHaikuRadio = screen.getByRole('radio', {
          name: /AWS Bedrock Claude 3\.5 Haiku/i,
        });
        expect(claudeHaikuRadio).toBeChecked();
      });
    });

    it('always includes features in the payload even when none are enabled', async () => {
      const user = userEvent.setup();
      await act(async () => {
        render(<EventCreationForm mode="edit" initialEvent={mockInitialEvent} />);
      });

      // Navigate through all steps without enabling any features
      await waitFor(() => screen.getByLabelText(/Event Name/i));
      await user.click(screen.getByRole('button', { name: /next/i }));
      await waitFor(() => screen.getByText('Nextspace'));
      await user.click(screen.getByRole('button', { name: /next/i }));
      await waitFor(() => screen.getByText('Customize your conversation settings'));
      await user.click(screen.getByRole('button', { name: /next/i }));
      await waitFor(() => screen.getByText('About the Speakers'));
      await user.click(screen.getByRole('button', { name: /next/i }));
      await waitFor(() => screen.getByText('Reading & Resources'));

      await user.click(screen.getByRole('button', { name: /save changes/i }));

      await waitFor(() => {
        expect(updateConversation).toHaveBeenCalledWith('conv-edit-123', expect.objectContaining({ features: [] }));
      });
    });

    describe('Features editing — payload', () => {
      // Event with one feature enabled (liveTranscript)
      const mockEventWithOneFeature: any = {
        ...mockInitialEvent,
        features: [{ name: 'liveTranscript', enabled: true, config: { transcriptDelay: 10 } }],
      };

      // Event with both features enabled
      const mockEventWithBothFeatures: any = {
        ...mockInitialEvent,
        features: [
          { name: 'liveTranscript', enabled: true, config: { transcriptDelay: 10 } },
          { name: 'autoSummary', enabled: true, config: {} },
        ],
      };

      const renderAndGoToStep3 = async (user: ReturnType<typeof userEvent.setup>, event: any = mockEventWithOneFeature) => {
        await act(async () => {
          render(<EventCreationForm mode="edit" initialEvent={event} />);
        });
        await waitFor(() => screen.getByLabelText(/Event Name/i));
        await user.click(screen.getByRole('button', { name: /next/i }));
        await waitFor(() => screen.getByText('Nextspace'));
        await user.click(screen.getByRole('button', { name: /next/i }));
        await waitFor(() => screen.getByText('Customize your conversation settings'));
      };

      const submitFromStep3 = async (user: ReturnType<typeof userEvent.setup>) => {
        await user.click(screen.getByRole('button', { name: /next/i }));
        await waitFor(() => screen.getByText('About the Speakers'));
        await user.click(screen.getByRole('button', { name: /next/i }));
        await waitFor(() => screen.getByText('Reading & Resources'));
        await user.click(screen.getByRole('button', { name: /save changes/i }));
      };

      it('preserves a pre-enabled feature in the payload when it is not changed', async () => {
        const user = userEvent.setup();
        await renderAndGoToStep3(user);

        await submitFromStep3(user);

        await waitFor(() => {
          expect(updateConversation).toHaveBeenCalledWith(
            'conv-edit-123',
            expect.objectContaining({
              features: expect.arrayContaining([{ name: 'liveTranscript', config: { transcriptDelay: 10 } }]),
            }),
          );
        });
      });

      it('removes only the disabled feature from the payload, preserving others', async () => {
        const user = userEvent.setup();
        await renderAndGoToStep3(user, mockEventWithBothFeatures);

        // Uncheck liveTranscript — autoSummary should remain
        await user.click(screen.getByRole('checkbox', { name: /live transcript/i }));

        await submitFromStep3(user);

        await waitFor(() => {
          const call = (updateConversation as jest.Mock).mock.calls[0];
          const payload = call[1];
          const featureNames = payload.features.map((f: any) => f.name);
          expect(featureNames).not.toContain('liveTranscript');
          expect(featureNames).toContain('autoSummary');
        });
      });

      it('sends features: [] when all pre-enabled features are disabled', async () => {
        const user = userEvent.setup();
        await renderAndGoToStep3(user, mockEventWithBothFeatures);

        await user.click(screen.getByRole('checkbox', { name: /live transcript/i }));
        await user.click(screen.getByRole('checkbox', { name: /auto summary/i }));

        await submitFromStep3(user);

        await waitFor(() => {
          expect(updateConversation).toHaveBeenCalledWith('conv-edit-123', expect.objectContaining({ features: [] }));
        });
      });

      it('saves an updated sub-property value in the payload', async () => {
        const user = userEvent.setup();
        await renderAndGoToStep3(user);

        const delayInput = screen.getByLabelText(/Transcript Delay/i) as HTMLInputElement;
        await user.clear(delayInput);
        await user.type(delayInput, '20');

        await submitFromStep3(user);

        await waitFor(() => {
          expect(updateConversation).toHaveBeenCalledWith(
            'conv-edit-123',
            expect.objectContaining({
              features: expect.arrayContaining([{ name: 'liveTranscript', config: { transcriptDelay: 20 } }]),
            }),
          );
        });
      });

      it('shows a default:true feature as unchecked when it was disabled in the saved event', async () => {
        // eventAssistantExtraTest has collectiveVoice with default: true.
        // If the user previously disabled it, the saved features array won't contain it.
        // The form must not re-enable it just because the type definition defaults to true.
        const eventWithFeatureDisabled: any = {
          ...mockInitialEvent,
          platforms: ['zoom'],
          conversationType: 'eventAssistantExtraTest',
          type: {
            name: 'eventAssistantExtraTest',
            label: 'Event Assistant With Additional Features',
            properties: [],
            platforms: [],
          },
          features: [], // collectiveVoice was explicitly disabled, so it's absent from the array
        };

        const user = userEvent.setup();
        await renderAndGoToStep3(user, eventWithFeatureDisabled);

        const collectiveVoiceCheckbox = screen.getByRole('checkbox', { name: /collective voice/i });
        expect(collectiveVoiceCheckbox).not.toBeChecked();
      });

      it('includes a newly enabled feature in the payload alongside pre-existing ones', async () => {
        const user = userEvent.setup();
        // Start with only liveTranscript; enable autoSummary during edit
        await renderAndGoToStep3(user);

        await user.click(screen.getByRole('checkbox', { name: /auto summary/i }));

        await submitFromStep3(user);

        await waitFor(() => {
          expect(updateConversation).toHaveBeenCalledWith(
            'conv-edit-123',
            expect.objectContaining({
              features: expect.arrayContaining([
                { name: 'liveTranscript', config: { transcriptDelay: 10 } },
                { name: 'autoSummary', config: {} },
              ]),
            }),
          );
        });
      });
    });

    it('redirects to the view page after a successful save in edit mode', async () => {
      const user = userEvent.setup();
      await act(async () => {
        render(<EventCreationForm mode="edit" initialEvent={mockInitialEvent} />);
      });

      await waitFor(() => screen.getByLabelText(/Event Name/i));
      await user.click(screen.getByRole('button', { name: /next/i }));
      await waitFor(() => screen.getByText('Nextspace'));
      await user.click(screen.getByRole('button', { name: /next/i }));
      await waitFor(() => screen.getByText('Customize your conversation settings'));
      await user.click(screen.getByRole('button', { name: /next/i }));
      await waitFor(() => screen.getByText('About the Speakers'));
      await user.click(screen.getByRole('button', { name: /next/i }));
      await waitFor(() => screen.getByText('Reading & Resources'));

      await user.click(screen.getByRole('button', { name: /save changes/i }));

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/admin/backChannel/view/conv-edit-123');
      });
    });

    describe('Cancel button', () => {
      const renderEditForm = async (event: any = mockInitialEvent) => {
        await act(async () => {
          render(<EventCreationForm mode="edit" initialEvent={event} />);
        });
        await waitFor(() => screen.getByLabelText(/Event Name/i));
      };

      it('shows a Cancel button in edit mode', async () => {
        await renderEditForm();
        expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
      });

      it('does not show a Cancel button in create mode', async () => {
        await act(async () => {
          render(<EventCreationForm />);
        });
        await waitFor(() => screen.getByLabelText(/Event Name/i));
        expect(screen.queryByRole('button', { name: /cancel/i })).not.toBeInTheDocument();
      });

      it('navigates to the view page immediately when cancelled with no changes', async () => {
        const user = userEvent.setup();
        await renderEditForm();

        await user.click(screen.getByRole('button', { name: /cancel/i }));

        await waitFor(() => {
          expect(mockPush).toHaveBeenCalledWith('/admin/backChannel/view/conv-edit-123');
        });
      });

      it('navigates immediately when a change is reverted back to the original value', async () => {
        const user = userEvent.setup();
        await renderEditForm();

        const nameInput = screen.getByLabelText(/Event Name/i);
        await user.clear(nameInput);
        await user.type(nameInput, 'Temporary Edit');
        await user.clear(nameInput);
        await user.type(nameInput, 'My Existing Event');

        await user.click(screen.getByRole('button', { name: /cancel/i }));

        await waitFor(() => {
          expect(mockPush).toHaveBeenCalledWith('/admin/backChannel/view/conv-edit-123');
        });
      });

      it('navigates immediately when the API returned a non-UTC ISO date and nothing was edited', async () => {
        /* The API may return dates with a timezone offset rather than UTC "Z".
           Without normalizing both sides to the same format, an untouched form
           compares unequal and shows the unsaved-changes warning on Cancel. This
           test guards that the normalization stays in place. */
        const eventWithOffsetDate = {
          ...mockInitialEvent,
          scheduledTime: '2030-01-15T15:00:00+00:00',
          scheduledEndTime: '2030-01-15T16:00:00+00:00',
        };
        const user = userEvent.setup();
        await act(async () => {
          render(<EventCreationForm mode="edit" initialEvent={eventWithOffsetDate} />);
        });
        await waitFor(() => screen.getByLabelText(/Event Name/i));

        await user.click(screen.getByRole('button', { name: /cancel/i }));

        await waitFor(() => {
          expect(mockPush).toHaveBeenCalledWith('/admin/backChannel/view/conv-edit-123');
        });
      });

      it('shows a confirmation dialog when cancelled after making a change', async () => {
        const user = userEvent.setup();
        await renderEditForm();

        const nameInput = screen.getByLabelText(/Event Name/i);
        await user.clear(nameInput);
        await user.type(nameInput, 'Changed Name');

        await user.click(screen.getByRole('button', { name: /cancel/i }));

        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByText(/discard changes/i)).toBeInTheDocument();
      });

      it('navigates away when the user confirms discarding changes', async () => {
        const user = userEvent.setup();
        await renderEditForm();

        const nameInput = screen.getByLabelText(/Event Name/i);
        await user.clear(nameInput);
        await user.type(nameInput, 'Changed Name');

        await user.click(screen.getByRole('button', { name: /cancel/i }));
        await screen.findByRole('dialog');
        await user.click(screen.getByRole('button', { name: /discard/i }));

        await waitFor(() => {
          expect(mockPush).toHaveBeenCalledWith('/admin/backChannel/view/conv-edit-123');
        });
      });

      it('keeps the user on the form when they dismiss the confirmation dialog', async () => {
        const user = userEvent.setup();
        await renderEditForm();

        const nameInput = screen.getByLabelText(/Event Name/i);
        await user.clear(nameInput);
        await user.type(nameInput, 'Changed Name');

        await user.click(screen.getByRole('button', { name: /cancel/i }));
        await screen.findByRole('dialog');
        await user.click(screen.getByRole('button', { name: /keep editing/i }));

        // The user stays on the form — no navigation occurred and the form is still interactive
        expect(mockPush).not.toHaveBeenCalled();
        expect(screen.getByLabelText(/Event Name/i)).toBeInTheDocument();
      });

    });

    it('allows proceeding from Step 1 when the pre-filled scheduled time is in the past', async () => {
      /* In edit mode the start-time picker must not enforce a future-only constraint.
         An existing event's scheduled time may be in the past, and blocking navigation
         would prevent the organizer from editing any other field. */
      const pastEvent = {
        ...mockInitialEvent,
        scheduledTime: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      };
      const user = userEvent.setup();
      await act(async () => {
        render(<EventCreationForm mode="edit" initialEvent={pastEvent} />);
      });
      await waitFor(() => screen.getByLabelText(/Event Name/i));

      await user.click(screen.getByRole('button', { name: /next/i }));

      await waitFor(() => {
        expect(screen.getByText('Nextspace')).toBeInTheDocument();
      });
    });

    describe('Step payload verification', () => {
      // Navigate to a specific step starting from the rendered edit form.
      const renderAndGoToStep = async (
        user: ReturnType<typeof userEvent.setup>,
        step: 1 | 2 | 3 | 4 | 5,
        event: any = mockInitialEvent,
      ) => {
        await act(async () => {
          render(<EventCreationForm mode="edit" initialEvent={event} />);
        });
        await waitFor(() => screen.getByLabelText(/Event Name/i));
        if (step >= 2) {
          await user.click(screen.getByRole('button', { name: /next/i }));
          await waitFor(() => screen.getByText('Nextspace'));
        }
        if (step >= 3) {
          await user.click(screen.getByRole('button', { name: /next/i }));
          await waitFor(() => screen.getByText('Customize your conversation settings'));
        }
        if (step >= 4) {
          await user.click(screen.getByRole('button', { name: /next/i }));
          await waitFor(() => screen.getByText('About the Speakers'));
        }
        if (step >= 5) {
          await user.click(screen.getByRole('button', { name: /next/i }));
          await waitFor(() => screen.getByText('Reading & Resources'));
        }
      };

      // Continue through remaining steps from the given step and submit the form.
      const submitFromStep = async (user: ReturnType<typeof userEvent.setup>, fromStep: 1 | 2 | 3 | 4 | 5) => {
        if (fromStep <= 1) {
          await user.click(screen.getByRole('button', { name: /next/i }));
          await waitFor(() => screen.getByText('Nextspace'));
        }
        if (fromStep <= 2) {
          await user.click(screen.getByRole('button', { name: /next/i }));
          await waitFor(() => screen.getByText('Customize your conversation settings'));
        }
        if (fromStep <= 3) {
          await user.click(screen.getByRole('button', { name: /next/i }));
          await waitFor(() => screen.getByText('About the Speakers'));
        }
        if (fromStep <= 4) {
          await user.click(screen.getByRole('button', { name: /next/i }));
          await waitFor(() => screen.getByText('Reading & Resources'));
        }
        await user.click(screen.getByRole('button', { name: /save changes/i }));
      };

      describe('Step 1 — event details', () => {
        it('includes the updated event name in the payload', async () => {
          const user = userEvent.setup();
          await renderAndGoToStep(user, 1);

          const nameInput = screen.getByLabelText(/Event Name/i);
          await user.clear(nameInput);
          await user.type(nameInput, 'Updated Event Name');

          await submitFromStep(user, 1);

          await waitFor(() => {
            expect(updateConversation).toHaveBeenCalledWith(
              'conv-edit-123',
              expect.objectContaining({ name: 'Updated Event Name' }),
            );
          });
        });

        it('includes the updated description in the payload', async () => {
          const user = userEvent.setup();
          await renderAndGoToStep(user, 1);

          const descriptionInput = screen.getByLabelText(/Description/i);
          await user.clear(descriptionInput);
          await user.type(descriptionInput, 'A brand new description');

          await submitFromStep(user, 1);

          await waitFor(() => {
            expect(updateConversation).toHaveBeenCalledWith(
              'conv-edit-123',
              expect.objectContaining({ description: 'A brand new description' }),
            );
          });
        });

        it('includes the updated Zoom URL in the payload', async () => {
          const user = userEvent.setup();
          await renderAndGoToStep(user, 1);

          const urlInput = screen.getByLabelText(/Zoom Meeting URL/i);
          await user.clear(urlInput);
          await user.type(urlInput, 'https://zoom.us/j/newmeeting');

          await submitFromStep(user, 1);

          await waitFor(() => {
            expect(updateConversation).toHaveBeenCalledWith(
              'conv-edit-123',
              expect.objectContaining({
                properties: expect.objectContaining({ zoomMeetingUrl: 'https://zoom.us/j/newmeeting' }),
              }),
            );
          });
        });

        it('includes updated scheduled times in the payload when changed', async () => {
          const user = userEvent.setup();
          // Use an event without pre-filled times so we control what gets typed
          const eventWithoutTimes: any = {
            ...mockInitialEvent,
            scheduledTime: undefined,
            scheduledEndTime: undefined,
          };
          await renderAndGoToStep(user, 1, eventWithoutTimes);

          const startTimeInput = screen.getAllByLabelText(/Meeting Day\/Time/i)[0];
          await user.type(startTimeInput, futureStartTime);

          const endTimeInput = screen.getAllByLabelText(/Meeting End Time/i)[0];
          await user.type(endTimeInput, futureEndTime);

          await submitFromStep(user, 1);

          await waitFor(() => {
            expect(updateConversation).toHaveBeenCalledWith(
              'conv-edit-123',
              expect.objectContaining({
                scheduledTime: expect.any(String),
                scheduledEndTime: expect.any(String),
              }),
            );
          });
        });

        it('includes the updated topic ID in the payload', async () => {
          const user = userEvent.setup();
          // mockInitialEvent has topic: 'topic-1' — switch to topic-2
          await renderAndGoToStep(user, 1);

          const topicInput = screen.getByLabelText(/Select a series/i);
          fireEvent.click(topicInput);
          fireEvent.keyDown(topicInput, { key: 'ArrowDown' });
          fireEvent.click(await screen.findByRole('option', { name: /Public Topic 2/i }));

          await submitFromStep(user, 1);

          await waitFor(() => {
            expect(updateConversation).toHaveBeenCalledWith(
              'conv-edit-123',
              expect.objectContaining({ topicId: 'topic-2' }),
            );
          });
        });
      });

      describe('Step 2 — conversation setup', () => {
        it('includes the updated platforms list in the payload', async () => {
          const user = userEvent.setup();
          // mockInitialEvent has platforms: ['zoom'] — also enable Nextspace
          await renderAndGoToStep(user, 2);

          await user.click(screen.getByRole('checkbox', { name: /nextspace/i }));

          await submitFromStep(user, 2);

          await waitFor(() => {
            expect(updateConversation).toHaveBeenCalledWith(
              'conv-edit-123',
              expect.objectContaining({
                platforms: expect.arrayContaining(['zoom', 'nextspace']),
              }),
            );
          });
        });
      });

      describe('Step 4 — speakers and moderators', () => {
        it('reflects an edited speaker name and bio in the payload', async () => {
          const user = userEvent.setup();
          const eventWithSpeaker: any = {
            ...mockInitialEvent,
            presenters: [{ name: 'Original Speaker', bio: 'Original Bio' }],
          };
          await renderAndGoToStep(user, 4, eventWithSpeaker);

          const nameInputs = screen.getAllByLabelText(/^Name$/i);
          await user.clear(nameInputs[0]);
          await user.type(nameInputs[0], 'Updated Speaker');

          const bioInputs = screen.getAllByLabelText(/Bio/i);
          await user.clear(bioInputs[0]);
          await user.type(bioInputs[0], 'Updated Bio');

          await submitFromStep(user, 4);

          await waitFor(() => {
            expect(updateConversation).toHaveBeenCalledWith(
              'conv-edit-123',
              expect.objectContaining({
                presenters: expect.arrayContaining([
                  expect.objectContaining({ name: 'Updated Speaker', bio: 'Updated Bio' }),
                ]),
              }),
            );
          });
        });

        it('includes a newly added speaker in the payload', async () => {
          const user = userEvent.setup();
          // mockInitialEvent has no presenters — form starts with one empty row
          await renderAndGoToStep(user, 4);

          await user.click(screen.getByRole('button', { name: /\+ Add Another Speaker/i }));
          await waitFor(() => screen.getByText('Speaker 2'));

          const nameInputs = screen.getAllByLabelText(/^Name$/i);
          await user.type(nameInputs[0], 'First Speaker');
          await user.type(nameInputs[1], 'Second Speaker');

          await submitFromStep(user, 4);

          await waitFor(() => {
            expect(updateConversation).toHaveBeenCalledWith(
              'conv-edit-123',
              expect.objectContaining({
                presenters: expect.arrayContaining([
                  expect.objectContaining({ name: 'First Speaker' }),
                  expect.objectContaining({ name: 'Second Speaker' }),
                ]),
              }),
            );
          });
        });

        it('excludes a removed speaker from the payload', async () => {
          const user = userEvent.setup();
          const eventWithTwoSpeakers: any = {
            ...mockInitialEvent,
            presenters: [
              { name: 'Speaker One', bio: '' },
              { name: 'Speaker Two', bio: '' },
            ],
          };
          await renderAndGoToStep(user, 4, eventWithTwoSpeakers);
          await waitFor(() => screen.getByText('Speaker 2'));

          // With two pre-filled speakers, each has its own Remove button. Click the last
          // one (Speaker Two's) so Speaker One is what remains in the payload.
          const removeButtons = screen.getAllByRole('button', { name: /remove/i });
          await user.click(removeButtons[removeButtons.length - 1]);
          await waitFor(() => expect(screen.queryByText('Speaker 2')).not.toBeInTheDocument());

          await submitFromStep(user, 4);

          await waitFor(() => {
            const call = (updateConversation as jest.Mock).mock.calls[0];
            const presenters = call[1].presenters as { name: string }[];
            expect(presenters).toHaveLength(1);
            expect(presenters[0].name).toBe('Speaker One');
          });
        });

        it('includes a newly added moderator in the payload', async () => {
          const user = userEvent.setup();
          await renderAndGoToStep(user, 4);

          await user.click(screen.getByRole('button', { name: /\+ Add Moderators/i }));
          await waitFor(() => screen.getByText('Moderator 1'));

          const nameInputs = screen.getAllByLabelText(/^Name$/i);
          await user.type(nameInputs[nameInputs.length - 1], 'New Moderator');

          await submitFromStep(user, 4);

          await waitFor(() => {
            expect(updateConversation).toHaveBeenCalledWith(
              'conv-edit-123',
              expect.objectContaining({
                moderators: expect.arrayContaining([expect.objectContaining({ name: 'New Moderator' })]),
              }),
            );
          });
        });

        it('reflects an edited moderator name and bio in the payload', async () => {
          const user = userEvent.setup();
          const eventWithModerator: any = {
            ...mockInitialEvent,
            moderators: [{ name: 'Original Moderator', bio: 'Original Bio' }],
          };
          await renderAndGoToStep(user, 4, eventWithModerator);
          await waitFor(() => screen.getByText('Moderator 1'));

          const nameInputs = screen.getAllByLabelText(/^Name$/i);
          const bioInputs = screen.getAllByLabelText(/Bio/i);
          // Moderator fields appear after speaker fields — use the last Name/Bio inputs
          await user.clear(nameInputs[nameInputs.length - 1]);
          await user.type(nameInputs[nameInputs.length - 1], 'Updated Moderator');
          await user.clear(bioInputs[bioInputs.length - 1]);
          await user.type(bioInputs[bioInputs.length - 1], 'Updated Bio');

          await submitFromStep(user, 4);

          await waitFor(() => {
            expect(updateConversation).toHaveBeenCalledWith(
              'conv-edit-123',
              expect.objectContaining({
                moderators: expect.arrayContaining([
                  expect.objectContaining({ name: 'Updated Moderator', bio: 'Updated Bio' }),
                ]),
              }),
            );
          });
        });

        it('includes alternateName for speakers and moderators in the payload', async () => {
          const user = userEvent.setup();
          const eventWithPeople: any = {
            ...mockInitialEvent,
            presenters: [{ name: 'Dr. Smith', bio: '' }],
            moderators: [{ name: 'Ms. Jones', bio: '' }],
          };
          await renderAndGoToStep(user, 4, eventWithPeople);
          await waitFor(() => screen.getByText('Moderator 1'));

          const alternateNameInputs = screen.getAllByLabelText(/Alternate Name/i);
          // First alternate name input belongs to the speaker, second to the moderator
          await user.type(alternateNameInputs[0], 'John Smith');
          await user.type(alternateNameInputs[1], 'Alice Jones');

          await submitFromStep(user, 4);

          await waitFor(() => {
            expect(updateConversation).toHaveBeenCalledWith(
              'conv-edit-123',
              expect.objectContaining({
                presenters: expect.arrayContaining([expect.objectContaining({ alternateName: 'John Smith' })]),
                moderators: expect.arrayContaining([expect.objectContaining({ alternateName: 'Alice Jones' })]),
              }),
            );
          });
        });

        it('excludes a removed moderator from the payload', async () => {
          const user = userEvent.setup();
          const eventWithModerator: any = {
            ...mockInitialEvent,
            moderators: [{ name: 'Existing Moderator', bio: '' }],
          };
          await renderAndGoToStep(user, 4, eventWithModerator);
          await waitFor(() => screen.getByText('Moderator 1'));

          // showModerators is true because the event has a pre-filled moderator.
          // The Remove button for the moderator section removes the whole section.
          const removeButtons = screen.getAllByRole('button', { name: /remove/i });
          await user.click(removeButtons[removeButtons.length - 1]);

          await submitFromStep(user, 4);

          await waitFor(() => {
            const call = (updateConversation as jest.Mock).mock.calls[0];
            expect(call[1].moderators ?? []).toHaveLength(0);
          });
        });
      });

      describe('Step 5 — resources', () => {
        it('includes a newly added resource in the payload', async () => {
          const user = userEvent.setup();
          await renderAndGoToStep(user, 5);

          await user.type(screen.getByLabelText(/^Title/i), 'A New Resource');

          await user.click(screen.getByRole('button', { name: /save changes/i }));

          await waitFor(() => {
            expect(updateConversation).toHaveBeenCalledWith(
              'conv-edit-123',
              expect.objectContaining({
                resources: expect.arrayContaining([expect.objectContaining({ title: 'A New Resource' })]),
              }),
            );
          });
        });

        it('excludes a resource whose title has been cleared from the payload', async () => {
          const user = userEvent.setup();
          const eventWithResource: any = {
            ...mockInitialEvent,
            resources: [{ title: 'Existing Resource', url: '' }],
          };
          await renderAndGoToStep(user, 5, eventWithResource);

          const titleInput = screen.getByLabelText(/^Title/i);
          await user.clear(titleInput);

          await user.click(screen.getByRole('button', { name: /save changes/i }));

          await waitFor(() => {
            const call = (updateConversation as jest.Mock).mock.calls[0];
            expect(call[1].resources ?? []).toHaveLength(0);
          });
        });
      });
    });
  });

  describe('Alternate Name field', () => {
    const navigateToStep4 = async (user: ReturnType<typeof userEvent.setup>) => {
      await fillEventDetails('Test Event', 'https://huitstage.zoom.us/j/1234567890');
      await user.click(screen.getByRole('button', { name: /next/i }));

      await waitFor(() => screen.getByText('Nextspace'));
      await user.click(screen.getByRole('checkbox', { name: /zoom/i }));
      await user.click(screen.getByRole('radio', { name: /back channel/i }));
      await user.click(screen.getByRole('button', { name: /next/i }));

      await waitFor(() => screen.getByLabelText(/Bot Name/i));
      await user.click(screen.getByRole('button', { name: /next/i }));

      await waitFor(() => screen.getByText('About the Speakers'));
      // Step 4 — stay here for speaker/moderator interaction before optionally proceeding
    };

    beforeEach(() => {
      (Request as jest.Mock).mockImplementation(
        makeRequestMock({
          id: 'new-conv-altname',
          name: 'Test Event',
          channels: [],
          agents: [],
          adapters: [],
          conversationType: 'eventAssistant',
        }),
      );
    });

    it('renders Alternate Name input for speakers', async () => {
      const user = userEvent.setup();
      await act(async () => {
        render(<EventCreationForm />);
      });

      await navigateToStep4(user);

      expect(screen.getByLabelText(/Alternate Name/i)).toBeInTheDocument();
    });

    it('renders Alternate Name input for moderators', async () => {
      const user = userEvent.setup();
      await act(async () => {
        render(<EventCreationForm />);
      });

      await navigateToStep4(user);

      await user.click(screen.getByRole('button', { name: /\+ Add Moderators/i }));

      await waitFor(() => {
        expect(screen.getByText('Moderator 1')).toBeInTheDocument();
      });

      const alternateNameInputs = screen.getAllByLabelText(/Alternate Name/i);
      expect(alternateNameInputs.length).toBeGreaterThanOrEqual(2);
    });

    it('includes alternateName in the request payload', async () => {
      const user = userEvent.setup();
      await act(async () => {
        render(<EventCreationForm />);
      });

      await navigateToStep4(user);

      const nameInputs = screen.getAllByLabelText(/^Name$/i);
      await user.type(nameInputs[0], 'Jonathan Smith');

      const alternateNameInput = screen.getByLabelText(/Alternate Name/i);
      await user.type(alternateNameInput, 'Jon');

      await user.click(screen.getByRole('button', { name: /next/i }));
      await waitFor(() => screen.getByText('Reading & Resources'));
      await user.click(screen.getByRole('button', { name: /create conversation/i }));

      await waitFor(() => {
        expect(Request).toHaveBeenCalledWith(
          'conversations/from-type',
          expect.objectContaining({
            presenters: [
              expect.objectContaining({
                name: 'Jonathan Smith',
                alternateName: 'Jon',
              }),
            ],
          }),
        );
      });
    });
  });
});
