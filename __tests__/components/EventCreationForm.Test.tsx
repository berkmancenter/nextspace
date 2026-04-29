import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EventCreationForm } from "../../components/EventCreationForm";
import { RetrieveData, Request } from "../../utils";
import { Api } from "../../utils/Helpers";
import "@testing-library/jest-dom";

// Mock next/router
const mockPush = jest.fn();
jest.mock("next/router", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

// Mock utils
jest.mock("../../utils", () => ({
  RetrieveData: jest.fn(),
  Request: jest.fn(),
}));

jest.mock("../../utils/SessionManager", () => ({
  __esModule: true,
  default: {
    get: () => ({
      getSessionInfo: () => ({ userId: "current-user-id" }),
    }),
  },
}));

const mockPublicTopics = [
  {
    id: "topic-1",
    name: "Public Topic 1",
    private: false,
    archived: false,
    isDeleted: false,
    owner: "other-user-id",
  },
  {
    id: "topic-2",
    name: "Public Topic 2",
    private: false,
    archived: false,
    isDeleted: false,
    owner: "other-user-id",
  },
  {
    id: "topic-archived",
    name: "Archived Topic",
    private: false,
    archived: true,
    isDeleted: false,
    owner: "other-user-id",
  },
  {
    id: "topic-deleted",
    name: "Deleted Topic",
    private: false,
    archived: false,
    isDeleted: true,
    owner: "other-user-id",
  },
];

const mockUserTopics = [
  {
    id: "topic-3",
    name: "My Private Topic",
    private: true,
    archived: false,
    isDeleted: false,
    owner: "current-user-id",
  },
];

const makeRequestMock =
  (conversationResult: any = null) =>
  (endpoint: string, payload?: any) => {
    if (endpoint === "topics" && !payload)
      return Promise.resolve(mockPublicTopics);
    if (endpoint === "topics/userTopics")
      return Promise.resolve(mockUserTopics);
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
  fireEvent.keyDown(topicInput, { key: "ArrowDown" });
  const topicOption = await screen.findByRole("option", {
    name: /Public Topic 1/i,
  });
  fireEvent.click(topicOption);

  // Fill in Zoom URL
  const urlInput = screen.getByLabelText(/Zoom Meeting URL/i);
  await user.type(urlInput, zoomUrl);

  // Set day/time - directly type into the datetime input
  const dateInput = screen.getAllByLabelText(/Meeting Day\/Time/i)[0];
  await user.type(dateInput, "11/15/2025 10:00 AM");

  // Assert the input value
  expect(dateInput).toHaveTextContent("11/15/2025 10:00 AMMeeting Day/Time");
};

const mockConfig = {
  supportedModels: [
    {
      name: "gpt-4o-mini",
      label: "OpenAI GPT-4o Mini",
      description: "Fast, lightweight model ideal for everyday conversations",
      llmPlatform: "openai",
      llmModel: "gpt-4o-mini",
    },
    {
      name: "claude-3-5-haiku",
      label: "AWS Bedrock Claude 3.5 Haiku",
      description: "Efficient and cost-effective model for quick responses",
      llmPlatform: "bedrock",
      llmModel: "anthropic.claude-3-5-haiku-20241022-v1:0",
    },
    {
      name: "claude-3-5-sonnet",
      label: "AWS Bedrock Claude 3.5 Sonnet",
      description: "Balanced model for complex reasoning and analysis",
      llmPlatform: "bedrock",
      llmModel: "anthropic.claude-3-5-sonnet-20240620-v1:0",
    },
  ],
  availablePlatforms: [
    {
      name: "nextspace",
      label: "Nextspace",
    },
    {
      name: "zoom",
      label: "Zoom",
    },
  ],
  conversationTypes: [
    {
      name: "backChannel",
      label: "Back Channel",
      description: "An agent to analyze participant comments",
      properties: [
        {
          name: "zoomMeetingUrl",
          type: "string",
          label: "Zoom Meeting URL",
          required: true,
        },
        {
          name: "botName",
          type: "string",
          label: "Bot Name",
          default: "Back Channel",
          required: false,
        },
        {
          name: "llmModel",
          type: "enum",
          label: "AI Model",
          description: "Select the AI model to use for this conversation",
          required: true,
          validationKeys: ["llmPlatform", "llmModel"],
          options: [
            {
              name: "gpt-4o-mini",
              label: "OpenAI GPT-4o Mini",
              description:
                "Fast, lightweight model ideal for everyday conversations",
              llmPlatform: "openai",
              llmModel: "gpt-4o-mini",
            },
            {
              name: "claude-3-5-haiku",
              label: "AWS Bedrock Claude 3.5 Haiku",
              description:
                "Efficient and cost-effective model for quick responses",
              llmPlatform: "bedrock",
              llmModel: "anthropic.claude-3-5-haiku-20241022-v1:0",
            },
            {
              name: "claude-3-5-sonnet",
              label: "AWS Bedrock Claude 3.5 Sonnet",
              description: "Balanced model for complex reasoning and analysis",
              llmPlatform: "bedrock",
              llmModel: "anthropic.claude-3-5-sonnet-20240620-v1:0",
            },
          ],
        },
      ],
      features: [
        {
          name: "liveTranscript",
          label: "Live Transcript",
          description: "Display a live transcript during the event",
          default: false,
          properties: [
            {
              name: "transcriptDelay",
              type: "number",
              label: "Transcript Delay (seconds)",
              default: 5,
              required: false,
            },
          ],
        },
        {
          name: "autoSummary",
          label: "Auto Summary",
          description: "Generate a summary at the end of the event",
          default: false,
          properties: [],
        },
      ],
    },
    {
      name: "eventAssistant",
      label: "Event Assistant",
      description: "An assistant to answer questions about an event",
      properties: [
        {
          name: "zoomMeetingUrl",
          type: "string",
          label: "Zoom Meeting URL",
          required: true,
        },
        {
          name: "botName",
          type: "string",
          label: "Bot Name",
          default: "Berkie",
          required: false,
        },
        {
          name: "llmModel",
          type: "enum",
          label: "AI Model",
          description: "Select the AI model to use for this conversation",
          required: true,
          validationKeys: ["llmPlatform", "llmModel"],
          options: [
            {
              name: "gpt-4o-mini",
              label: "OpenAI GPT-4o Mini",
              description:
                "Fast, lightweight model ideal for everyday conversations",
              llmPlatform: "openai",
              llmModel: "gpt-4o-mini",
            },
            {
              name: "claude-3-5-haiku",
              label: "AWS Bedrock Claude 3.5 Haiku",
              description:
                "Efficient and cost-effective model for quick responses",
              llmPlatform: "bedrock",
              llmModel: "anthropic.claude-3-5-haiku-20241022-v1:0",
            },
            {
              name: "claude-3-5-sonnet",
              label: "AWS Bedrock Claude 3.5 Sonnet",
              description: "Balanced model for complex reasoning and analysis",
              llmPlatform: "bedrock",
              llmModel: "anthropic.claude-3-5-sonnet-20240620-v1:0",
            },
          ],
        },
      ],
    },
  ],
};

describe("EventCreationForm Component", () => {
  beforeEach(() => {
    Api.get().ClearConfigCache();
    jest.clearAllMocks();
    mockPush.mockReset();
    (RetrieveData as jest.Mock).mockResolvedValue(mockConfig);
    (Request as jest.Mock).mockImplementation(makeRequestMock());
  });

  it("renders the form with initial state on step 1", async () => {
    await act(async () => {
      render(<EventCreationForm />);
    });

    // Check that all step labels are present in the stepper
    expect(screen.getAllByText("Event Details").length).toBeGreaterThan(0);
    expect(screen.getByText("Conversation Setup")).toBeInTheDocument();
    expect(screen.getByText("Configuration")).toBeInTheDocument();
    expect(screen.getByText("Moderators & Speakers")).toBeInTheDocument();

    // Should show Step 1 content
    expect(screen.getByLabelText(/Event Name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Zoom Meeting URL/i)).toBeInTheDocument();
  });

  it("validates Step 1 before allowing navigation to Step 2", async () => {
    const user = userEvent.setup();
    await act(async () => {
      render(<EventCreationForm />);
    });

    // Try to go to next step without filling required fields
    const nextButton = screen.getByRole("button", { name: /next/i });
    await user.click(nextButton);

    // Should show error and remain on Step 1
    await waitFor(() => {
      expect(screen.getByText("Event Name is required")).toBeInTheDocument();
    });
    expect(screen.getByLabelText(/Event Name/i)).toBeInTheDocument();
  });

  it("navigates to Step 2 after valid Step 1 data", async () => {
    const user = userEvent.setup();
    await act(async () => {
      render(<EventCreationForm />);
    });

    // Fill Step 1
    await fillEventDetails(
      "Test Event",
      "https://huitstage.zoom.us/j/1234567890",
    );

    const nextButton = screen.getByRole("button", { name: /next/i });
    await user.click(nextButton);

    // Should now be on Step 2
    await waitFor(() => {
      expect(
        screen.getByText("Where do you want your audience to interact?"),
      ).toBeInTheDocument();
    });
  });

  it("shows platform selection checkboxes on Step 2", async () => {
    const user = userEvent.setup();
    await act(async () => {
      render(<EventCreationForm />);
    });

    // Fill Step 1 and navigate
    await fillEventDetails(
      "Test Event",
      "https://huitstage.zoom.us/j/1234567890",
    );
    const nextButton = screen.getByRole("button", { name: /next/i });
    await user.click(nextButton);

    await waitFor(() => {
      expect(screen.getByText("Nextspace")).toBeInTheDocument();
      expect(screen.getByText("Zoom")).toBeInTheDocument();
    });
  });

  it("updates selected platforms when checkboxes are clicked", async () => {
    const user = userEvent.setup();
    await act(async () => {
      render(<EventCreationForm />);
    });

    // Navigate to Step 2
    await fillEventDetails(
      "Test Event",
      "https://huitstage.zoom.us/j/1234567890",
    );
    await user.click(screen.getByRole("button", { name: /next/i }));

    await waitFor(() => {
      expect(screen.getByText("Nextspace")).toBeInTheDocument();
    });

    const nextspaceCheckbox = screen.getByRole("checkbox", {
      name: /nextspace/i,
    });
    const zoomCheckbox = screen.getByRole("checkbox", { name: /zoom/i });

    await user.click(nextspaceCheckbox);
    expect(nextspaceCheckbox).toBeChecked();

    await user.click(zoomCheckbox);
    expect(zoomCheckbox).toBeChecked();

    await user.click(nextspaceCheckbox);
    expect(nextspaceCheckbox).not.toBeChecked();
  });

  it("validates Step 2 requires platform and agent selection", async () => {
    const user = userEvent.setup();
    await act(async () => {
      render(<EventCreationForm />);
    });

    // Navigate to Step 2
    await fillEventDetails(
      "Test Event",
      "https://huitstage.zoom.us/j/1234567890",
    );
    await user.click(screen.getByRole("button", { name: /next/i }));

    await waitFor(() => {
      expect(screen.getByText("Nextspace")).toBeInTheDocument();
    });

    // Try to proceed without selections
    await user.click(screen.getByRole("button", { name: /next/i }));

    await waitFor(() => {
      expect(
        screen.getByText("At least one platform must be selected"),
      ).toBeInTheDocument();
    });
  });

  it("navigates to Step 3 after valid Step 2 data", async () => {
    const user = userEvent.setup();
    await act(async () => {
      render(<EventCreationForm />);
    });

    // Fill Step 1 and navigate
    await fillEventDetails(
      "Test Event",
      "https://huitstage.zoom.us/j/1234567890",
    );
    await user.click(screen.getByRole("button", { name: /next/i }));

    await waitFor(() => {
      expect(screen.getByText("Nextspace")).toBeInTheDocument();
    });

    // Fill Step 2
    await user.click(screen.getByRole("checkbox", { name: /zoom/i }));
    await user.click(screen.getByRole("radio", { name: /back channel/i }));

    // Navigate to Step 3
    await user.click(screen.getByRole("button", { name: /next/i }));

    await waitFor(() => {
      expect(screen.getByLabelText(/Bot Name/i)).toBeInTheDocument();
    });
  });

  it("displays agent descriptions on Step 2", async () => {
    const user = userEvent.setup();
    await act(async () => {
      render(<EventCreationForm />);
    });

    // Navigate to Step 2
    await fillEventDetails(
      "Test Event",
      "https://huitstage.zoom.us/j/1234567890",
    );
    await user.click(screen.getByRole("button", { name: /next/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/An agent to analyze participant comments/i),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/An assistant to answer questions about an event/i),
      ).toBeInTheDocument();
    });
  });

  it("displays model selection options with descriptions on Step 3", async () => {
    const user = userEvent.setup();
    await act(async () => {
      render(<EventCreationForm />);
    });

    // Navigate to Step 3
    await fillEventDetails(
      "Test Event",
      "https://huitstage.zoom.us/j/1234567890",
    );
    await user.click(screen.getByRole("button", { name: /next/i }));

    await waitFor(() => {
      expect(screen.getByText("Nextspace")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("checkbox", { name: /zoom/i }));
    await user.click(screen.getByRole("radio", { name: /back channel/i }));
    await user.click(screen.getByRole("button", { name: /next/i }));

    await waitFor(() => {
      expect(screen.getByText(/OpenAI GPT-4o Mini/i)).toBeInTheDocument();
      expect(
        screen.getByText(/AWS Bedrock Claude 3.5 Haiku/i),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/AWS Bedrock Claude 3.5 Sonnet/i),
      ).toBeInTheDocument();
      expect(
        screen.getByText(
          /Fast, lightweight model ideal for everyday conversations/i,
        ),
      ).toBeInTheDocument();
    });
  });

  it("navigates to Step 4 (Moderators & Speakers)", async () => {
    const user = userEvent.setup();
    await act(async () => {
      render(<EventCreationForm />);
    });

    // Navigate through all steps
    await fillEventDetails(
      "Test Event",
      "https://huitstage.zoom.us/j/1234567890",
    );
    await user.click(screen.getByRole("button", { name: /next/i }));

    await waitFor(() => {
      expect(screen.getByText("Nextspace")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("checkbox", { name: /zoom/i }));
    await user.click(screen.getByRole("radio", { name: /back channel/i }));
    await user.click(screen.getByRole("button", { name: /next/i }));

    await waitFor(() => {
      expect(screen.getByLabelText(/Bot Name/i)).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /next/i }));

    await waitFor(() => {
      expect(screen.getByText("About the Speakers")).toBeInTheDocument();
      expect(screen.getByText("About the Moderators")).toBeInTheDocument();
    });
  });

  it("allows adding and removing speakers on Step 4", async () => {
    const user = userEvent.setup();
    await act(async () => {
      render(<EventCreationForm />);
    });

    // Navigate to Step 4
    await fillEventDetails(
      "Test Event",
      "https://huitstage.zoom.us/j/1234567890",
    );
    await user.click(screen.getByRole("button", { name: /next/i }));
    await waitFor(() => screen.getByText("Nextspace"));
    await user.click(screen.getByRole("checkbox", { name: /zoom/i }));
    await user.click(screen.getByRole("radio", { name: /back channel/i }));
    await user.click(screen.getByRole("button", { name: /next/i }));
    await waitFor(() => screen.getByLabelText(/Bot Name/i));
    await user.click(screen.getByRole("button", { name: /next/i }));

    await waitFor(() => {
      expect(screen.getByText("About the Speakers")).toBeInTheDocument();
    });

    // Should have one speaker initially
    expect(screen.getByText("Speaker 1")).toBeInTheDocument();

    // Add another speaker
    const addSpeakerButton = screen.getByRole("button", {
      name: /\+ Add Another Speaker/i,
    });
    await user.click(addSpeakerButton);

    expect(screen.getByText("Speaker 2")).toBeInTheDocument();

    // Remove the second speaker
    const removeButtons = screen.getAllByRole("button", { name: /remove/i });
    await user.click(removeButtons[0]);

    expect(screen.queryByText("Speaker 2")).not.toBeInTheDocument();
  });

  it("allows adding moderators on Step 4", async () => {
    const user = userEvent.setup();
    await act(async () => {
      render(<EventCreationForm />);
    });

    // Navigate to Step 4
    await fillEventDetails(
      "Test Event",
      "https://huitstage.zoom.us/j/1234567890",
    );
    await user.click(screen.getByRole("button", { name: /next/i }));
    await waitFor(() => screen.getByText("Nextspace"));
    await user.click(screen.getByRole("checkbox", { name: /zoom/i }));
    await user.click(screen.getByRole("radio", { name: /back channel/i }));
    await user.click(screen.getByRole("button", { name: /next/i }));
    await waitFor(() => screen.getByLabelText(/Bot Name/i));
    await user.click(screen.getByRole("button", { name: /next/i }));

    await waitFor(() => {
      expect(screen.getByText("About the Moderators")).toBeInTheDocument();
    });

    // Initially moderators should not be shown
    expect(screen.queryByText("Moderator 1")).not.toBeInTheDocument();

    // Click to add moderators
    const addModeratorsButton = screen.getByRole("button", {
      name: /\+ Add Moderators/i,
    });
    await user.click(addModeratorsButton);

    expect(screen.getByText("Moderator 1")).toBeInTheDocument();
  });

  it("navigates back through steps", async () => {
    const user = userEvent.setup();
    await act(async () => {
      render(<EventCreationForm />);
    });

    // Navigate to Step 2
    await fillEventDetails(
      "Test Event",
      "https://huitstage.zoom.us/j/1234567890",
    );
    await user.click(screen.getByRole("button", { name: /next/i }));

    await waitFor(() => {
      expect(screen.getByText("Nextspace")).toBeInTheDocument();
    });

    // Go back to Step 1
    const backButton = screen.getByRole("button", { name: /back/i });
    await user.click(backButton);

    await waitFor(() => {
      expect(screen.getByLabelText(/Event Name/i)).toBeInTheDocument();
    });

    // Back button should be disabled on Step 1
    expect(screen.getByRole("button", { name: /back/i })).toBeDisabled();
  });

  it("allows custom bot name configuration on Step 3", async () => {
    const user = userEvent.setup();
    await act(async () => {
      render(<EventCreationForm />);
    });

    // Navigate to Step 3
    await fillEventDetails(
      "Test Event",
      "https://huitstage.zoom.us/j/1234567890",
    );
    await user.click(screen.getByRole("button", { name: /next/i }));
    await waitFor(() => screen.getByText("Nextspace"));
    await user.click(screen.getByRole("checkbox", { name: /zoom/i }));
    await user.click(screen.getByRole("radio", { name: /back channel/i }));
    await user.click(screen.getByRole("button", { name: /next/i }));

    await waitFor(() => {
      expect(screen.getByLabelText(/Bot Name/i)).toBeInTheDocument();
    });

    const botNameInput = screen.getByLabelText(/Bot Name/i) as HTMLInputElement;
    expect(botNameInput).toHaveValue("Back Channel");

    // Use fireEvent to directly change the value
    fireEvent.change(botNameInput, { target: { value: "Custom Bot Name" } });
    expect(botNameInput).toHaveValue("Custom Bot Name");
  });

  it("submits correct payload for Back Channel agent with default model", async () => {
    const user = userEvent.setup();
    const mockConversationData = {
      id: "new-conv-123",
      name: "Test Event",
      channels: [],
      agents: [],
      adapters: [],
      conversationType: "eventAssistant",
    };
    (Request as jest.Mock).mockImplementation(
      makeRequestMock(mockConversationData),
    );

    await act(async () => {
      render(<EventCreationForm />);
    });

    // Complete all steps
    await fillEventDetails(
      "Test Event",
      "https://huitstage.zoom.us/j/1234567890",
    );
    await user.click(screen.getByRole("button", { name: /next/i }));

    await waitFor(() => screen.getByText("Nextspace"));
    await user.click(screen.getByRole("checkbox", { name: /zoom/i }));
    await user.click(screen.getByRole("radio", { name: /back channel/i }));
    await user.click(screen.getByRole("button", { name: /next/i }));

    await waitFor(() => screen.getByLabelText(/Bot Name/i));
    await user.click(screen.getByRole("button", { name: /next/i }));

    await waitFor(() => screen.getByText("About the Speakers"));

    // Submit form
    const submitButton = screen.getByRole("button", {
      name: /create conversation/i,
    });
    await user.click(submitButton);

    await waitFor(() => {
      expect(Request).toHaveBeenCalledWith(
        "conversations/from-type",
        expect.objectContaining({
          name: "Test Event",
          type: "backChannel",
          platforms: ["zoom"],
          topicId: "topic-1",
          properties: expect.objectContaining({
            zoomMeetingUrl: "https://huitstage.zoom.us/j/1234567890",
            botName: "Back Channel",
            llmModel: {
              llmPlatform: "openai",
              llmModel: "gpt-4o-mini",
            },
          }),
        }),
      );
    });
  });

  it("submits correct payload for Event Assistant with custom model", async () => {
    const user = userEvent.setup();
    const mockConversationData = {
      id: "new-conv-456",
      name: "Test Event Assistant",
      channels: [],
      agents: [],
      adapters: [],
      conversationType: "eventAssistant",
    };
    (Request as jest.Mock).mockImplementation(
      makeRequestMock(mockConversationData),
    );

    await act(async () => {
      render(<EventCreationForm />);
    });

    // Complete all steps
    await fillEventDetails(
      "Test Event Assistant",
      "https://huitstage.zoom.us/j/9876543210",
    );
    await user.click(screen.getByRole("button", { name: /next/i }));

    await waitFor(() => screen.getByText("Nextspace"));
    await user.click(screen.getByRole("checkbox", { name: /zoom/i }));
    await user.click(screen.getByRole("radio", { name: /event assistant/i }));
    await user.click(screen.getByRole("button", { name: /next/i }));

    await waitFor(() => {
      expect(screen.getByText(/OpenAI GPT-4o Mini/i)).toBeInTheDocument();
    });

    const sonnetRadio = screen.getByRole("radio", {
      name: /aws bedrock claude 3\.5 sonnet/i,
    });
    await user.click(sonnetRadio);
    await user.click(screen.getByRole("button", { name: /next/i }));

    await waitFor(() => screen.getByText("About the Speakers"));

    const submitButton = screen.getByRole("button", {
      name: /create conversation/i,
    });
    await user.click(submitButton);

    await waitFor(() => {
      expect(Request).toHaveBeenCalledWith(
        "conversations/from-type",
        expect.objectContaining({
          name: "Test Event Assistant",
          topicId: "topic-1",
          properties: expect.objectContaining({
            llmModel: {
              llmPlatform: "bedrock",
              llmModel: "anthropic.claude-3-5-sonnet-20240620-v1:0",
            },
          }),
          scheduledTime: expect.any(String),
        }),
      );
    });
  });

  it("submits payload with custom bot name", async () => {
    const user = userEvent.setup();
    const mockConversationData = {
      id: "new-conv-789",
      name: "Custom Bot Event",
      channels: [],
      agents: [],
      adapters: [],
      conversationType: "eventAssistant",
    };
    (Request as jest.Mock).mockImplementation(
      makeRequestMock(mockConversationData),
    );

    await act(async () => {
      render(<EventCreationForm />);
    });

    // Complete all steps with custom bot name
    await fillEventDetails(
      "Custom Bot Event",
      "https://huitstage.zoom.us/j/5555555555",
    );
    await user.click(screen.getByRole("button", { name: /next/i }));

    await waitFor(() => screen.getByText("Nextspace"));
    await user.click(screen.getByRole("checkbox", { name: /zoom/i }));
    await user.click(screen.getByRole("radio", { name: /back channel/i }));
    await user.click(screen.getByRole("button", { name: /next/i }));

    const botNameInput = (await screen.findByLabelText(
      /Bot Name/i,
    )) as HTMLInputElement;
    // Use fireEvent to directly change the value
    fireEvent.change(botNameInput, { target: { value: "MyCustomBot" } });
    await user.click(screen.getByRole("button", { name: /next/i }));

    await waitFor(() => screen.getByText("About the Speakers"));

    const submitButton = screen.getByRole("button", {
      name: /create conversation/i,
    });
    await user.click(submitButton);

    await waitFor(() => {
      expect(Request).toHaveBeenCalledWith(
        "conversations/from-type",
        expect.objectContaining({
          properties: expect.objectContaining({
            zoomMeetingUrl: "https://huitstage.zoom.us/j/5555555555",
            botName: "MyCustomBot",
          }),
        }),
      );
    });
  });

  it("submits payload with speakers and moderators", async () => {
    const user = userEvent.setup();
    const mockConversationData = {
      id: "new-conv-speakers",
      name: "Event with Speakers",
      channels: [],
      agents: [],
      adapters: [],
      conversationType: "eventAssistant",
    };
    (Request as jest.Mock).mockImplementation(
      makeRequestMock(mockConversationData),
    );

    await act(async () => {
      render(<EventCreationForm />);
    });

    // Complete all steps
    await fillEventDetails(
      "Event with Speakers",
      "https://huitstage.zoom.us/j/1111111111",
    );
    await user.click(screen.getByRole("button", { name: /next/i }));

    await waitFor(() => screen.getByText("Nextspace"));
    await user.click(screen.getByRole("checkbox", { name: /zoom/i }));
    await user.click(screen.getByRole("radio", { name: /back channel/i }));
    await user.click(screen.getByRole("button", { name: /next/i }));

    await waitFor(() => screen.getByLabelText(/Bot Name/i));
    await user.click(screen.getByRole("button", { name: /next/i }));

    await waitFor(() => screen.getByText("About the Speakers"));

    // Add speaker info
    const speakerNameInputs = screen.getAllByLabelText(/Name/i);
    await user.type(speakerNameInputs[0], "John Doe");
    const speakerBioInputs = screen.getAllByLabelText(/Bio/i);
    await user.type(speakerBioInputs[0], "Expert speaker");

    // Add moderator
    const addModeratorsButton = screen.getByRole("button", {
      name: /\+ Add Moderators/i,
    });
    await user.click(addModeratorsButton);

    await waitFor(() => {
      expect(screen.getByText("Moderator 1")).toBeInTheDocument();
    });

    const moderatorNameInput = screen.getAllByLabelText(/Name/i)[1];
    await user.type(moderatorNameInput, "Jane Smith");
    const moderatorBioInput = screen.getAllByLabelText(/Bio/i)[1];
    await user.type(moderatorBioInput, "Experienced moderator");

    const submitButton = screen.getByRole("button", {
      name: /create conversation/i,
    });
    await user.click(submitButton);

    await waitFor(() => {
      expect(Request).toHaveBeenCalledWith(
        "conversations/from-type",
        expect.objectContaining({
          presenters: [{ name: "John Doe", bio: "Expert speaker" }],
          moderators: [{ name: "Jane Smith", bio: "Experienced moderator" }],
        }),
      );
    });
  });

  it("displays error message when event name is left empty", async () => {
    const user = userEvent.setup();
    await act(async () => {
      render(<EventCreationForm />);
    });

    // Fill in event name we will then clear and zoom URL
    await fillEventDetails(
      "Scheduled Event To Clear",
      "https://huitstage.zoom.us/j/1111111111",
    );

    const nameInput = screen.getByLabelText(/Event Name/i);
    await user.clear(nameInput);

    await user.click(screen.getByRole("button", { name: /next/i }));

    await waitFor(() => {
      expect(screen.getByText("Event Name is required")).toBeInTheDocument();
    });
  });

  it("displays error message when zoom URL is left empty", async () => {
    const user = userEvent.setup();

    await act(async () => {
      render(<EventCreationForm />);
    });

    // Fill in event and zoom URL we will then clear
    await fillEventDetails(
      "Scheduled Event",
      "https://huitstage.zoom.us/j/1111111111",
    );

    const urlInput = screen.getByLabelText(/Zoom Meeting URL/i);
    await user.clear(urlInput);

    await user.click(screen.getByRole("button", { name: /next/i }));

    await waitFor(() => {
      expect(
        screen.getByText("Zoom Meeting URL is required"),
      ).toBeInTheDocument();
    });
  });

  it("displays error when no platform is selected", async () => {
    const user = userEvent.setup();

    await act(async () => {
      render(<EventCreationForm />);
    });

    await fillEventDetails(
      "Test Event",
      "https://huitstage.zoom.us/j/1234567890",
    );

    // Navigate to Step 3 without selecting platform
    await user.click(screen.getByRole("button", { name: /next/i }));
    await user.click(screen.getByRole("button", { name: /next/i }));

    await waitFor(() => {
      expect(
        screen.getByText("At least one platform must be selected"),
      ).toBeInTheDocument();
    });
  });

  it("clears platform error when platform is selected", async () => {
    const user = userEvent.setup();

    await act(async () => {
      render(<EventCreationForm />);
    });

    await fillEventDetails(
      "Test Event",
      "https://huitstage.zoom.us/j/1234567890",
    );

    // Navigate to Step 3 without selecting platform
    await user.click(screen.getByRole("button", { name: /next/i }));
    await user.click(screen.getByRole("button", { name: /next/i }));

    await waitFor(() => {
      expect(
        screen.getByText("At least one platform must be selected"),
      ).toBeInTheDocument();
    });

    const zoomCheckbox = screen.getByRole("checkbox", { name: /zoom/i });
    await user.click(zoomCheckbox);

    await user.click(screen.getByRole("button", { name: /next/i }));

    await waitFor(() => {
      expect(
        screen.queryByText("At least one platform must be selected"),
      ).not.toBeInTheDocument();
    });
  });

  it("does not submit when platform is unselected after being selected", async () => {
    const user = userEvent.setup();

    await act(async () => {
      render(<EventCreationForm />);
    });

    await fillEventDetails(
      "Test Event",
      "https://huitstage.zoom.us/j/1234567890",
    );

    await user.click(screen.getByRole("button", { name: /next/i }));

    const backChannelRadio = screen.getByRole("radio", {
      name: /back channel/i,
    });
    await user.click(backChannelRadio);

    const zoomCheckbox = screen.getByRole("checkbox", { name: /zoom/i });

    await user.click(zoomCheckbox);
    await user.click(zoomCheckbox); // Unselect

    await user.click(screen.getByRole("button", { name: /next/i }));

    await waitFor(() => {
      expect(
        screen.getByText("At least one platform must be selected"),
      ).toBeInTheDocument();
    });

    expect(Request).not.toHaveBeenCalledWith(
      "conversations/from-type",
      expect.anything(),
    );
  });

  it("displays error message when form submission fails", async () => {
    const user = userEvent.setup();
    (Request as jest.Mock).mockImplementation(
      (endpoint: string, payload?: any) => {
        if (endpoint === "topics" && !payload)
          return Promise.resolve(mockPublicTopics);
        if (endpoint === "topics/userTopics")
          return Promise.resolve(mockUserTopics);
        return Promise.reject(new Error("Network error"));
      },
    );

    await act(async () => {
      render(<EventCreationForm />);
    });

    // Complete all steps
    await fillEventDetails(
      "Test Event",
      "https://huitstage.zoom.us/j/1234567890",
    );
    await user.click(screen.getByRole("button", { name: /next/i }));

    await waitFor(() => screen.getByText("Nextspace"));
    await user.click(screen.getByRole("checkbox", { name: /zoom/i }));
    await user.click(screen.getByRole("radio", { name: /back channel/i }));
    await user.click(screen.getByRole("button", { name: /next/i }));

    await waitFor(() => screen.getByLabelText(/Bot Name/i));
    await user.click(screen.getByRole("button", { name: /next/i }));

    await waitFor(() => screen.getByText("About the Speakers"));

    const submitButton = screen.getByRole("button", {
      name: /create conversation/i,
    });
    await user.click(submitButton);

    await waitFor(() => {
      expect(
        screen.getByText(/Failed to send data.*Network error/),
      ).toBeInTheDocument();
    });
  });

  it("displays error when config fetch fails", async () => {
    (RetrieveData as jest.Mock).mockResolvedValue({
      error: true,
      message: { message: "Failed to load configuration" },
    });

    await act(async () => {
      render(<EventCreationForm />);
    });

    await waitFor(() => {
      expect(
        screen.getByText("Failed to load configuration."),
      ).toBeInTheDocument();
    });
  });

  it("displays event status after successful conversation creation", async () => {
    const user = userEvent.setup();
    const mockConversationData = {
      id: "new-conv-redirect",
      name: "Test Event",
      channels: [],
      agents: [],
      adapters: [],
      conversationType: "eventAssistant",
    };
    (Request as jest.Mock).mockImplementation(
      makeRequestMock(mockConversationData),
    );

    await act(async () => {
      render(<EventCreationForm />);
    });

    // Complete all steps
    await fillEventDetails(
      "Test Event",
      "https://huitstage.zoom.us/j/1234567890",
    );
    await user.click(screen.getByRole("button", { name: /next/i }));

    await waitFor(() => screen.getByText("Nextspace"));
    await user.click(screen.getByRole("checkbox", { name: /zoom/i }));
    await user.click(screen.getByRole("radio", { name: /back channel/i }));
    await user.click(screen.getByRole("button", { name: /next/i }));

    await waitFor(() => screen.getByLabelText(/Bot Name/i));
    await user.click(screen.getByRole("button", { name: /next/i }));

    await waitFor(() => screen.getByText("About the Speakers"));

    const submitButton = screen.getByRole("button", {
      name: /create conversation/i,
    });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText("Event Status")).toBeInTheDocument();
    });

    expect(mockPush).not.toHaveBeenCalled();
  });

  it("fetches configuration from backend on mount", async () => {
    await act(async () => {
      render(<EventCreationForm />);
    });

    await waitFor(() => {
      expect(RetrieveData).toHaveBeenCalledWith("/config");
    });
  });

  it("only fetches config once when supportedModels and availablePlatforms are null", async () => {
    await act(async () => {
      render(<EventCreationForm />);
    });

    await waitFor(() => {
      expect(RetrieveData).toHaveBeenCalledWith("/config");
    });

    // RetrieveData should only be called once during initial mount
    expect(RetrieveData).toHaveBeenCalledTimes(1);
  });

  it("sets default model selection after config is fetched", async () => {
    const user = userEvent.setup();
    await act(async () => {
      render(<EventCreationForm />);
    });

    // Navigate to Step 3 where model selection is shown
    await fillEventDetails(
      "Test Event",
      "https://huitstage.zoom.us/j/1234567890",
    );
    await user.click(screen.getByRole("button", { name: /next/i }));

    await waitFor(() => screen.getByText("Nextspace"));
    await user.click(screen.getByRole("checkbox", { name: /zoom/i }));
    await user.click(screen.getByRole("radio", { name: /back channel/i }));
    await user.click(screen.getByRole("button", { name: /next/i }));

    await waitFor(() => {
      const gptRadio = screen.getByRole("radio", {
        name: /openai gpt-4o mini/i,
      });
      // First model (gpt-4o-mini) should be selected by default
      expect(gptRadio).toBeChecked();
    });
  });

  // Helper to navigate to Step 3 with Back Channel selected
  const navigateToStep3WithBackChannel = async (
    user: ReturnType<typeof userEvent.setup>,
  ) => {
    await fillEventDetails(
      "Test Event",
      "https://huitstage.zoom.us/j/1234567890",
    );
    await user.click(screen.getByRole("button", { name: /next/i }));
    await waitFor(() => screen.getByText("Nextspace"));
    await user.click(screen.getByRole("checkbox", { name: /zoom/i }));
    await user.click(screen.getByRole("radio", { name: /back channel/i }));
    await user.click(screen.getByRole("button", { name: /next/i }));
    await waitFor(() => screen.getByLabelText(/Bot Name/i));
  };

  describe("Features", () => {
    it("displays the Features section on Step 3 when the conversation type has features", async () => {
      const user = userEvent.setup();
      await act(async () => {
        render(<EventCreationForm />);
      });

      await navigateToStep3WithBackChannel(user);

      expect(screen.getByText("Features")).toBeInTheDocument();
      expect(screen.getByText("Live Transcript")).toBeInTheDocument();
      expect(
        screen.getByText("Display a live transcript during the event"),
      ).toBeInTheDocument();
      expect(screen.getByText("Auto Summary")).toBeInTheDocument();
    });

    it("feature checkboxes are unchecked by default when feature.default is false", async () => {
      const user = userEvent.setup();
      await act(async () => {
        render(<EventCreationForm />);
      });

      await navigateToStep3WithBackChannel(user);

      const liveTranscriptCheckbox = screen.getByRole("checkbox", {
        name: /live transcript/i,
      });
      expect(liveTranscriptCheckbox).not.toBeChecked();

      const autoSummaryCheckbox = screen.getByRole("checkbox", {
        name: /auto summary/i,
      });
      expect(autoSummaryCheckbox).not.toBeChecked();
    });

    it("toggling a feature checkbox shows its sub-properties", async () => {
      const user = userEvent.setup();
      await act(async () => {
        render(<EventCreationForm />);
      });

      await navigateToStep3WithBackChannel(user);

      // Sub-property should not be visible before enabling the feature
      expect(
        screen.queryByLabelText(/Transcript Delay/i),
      ).not.toBeInTheDocument();

      const liveTranscriptCheckbox = screen.getByRole("checkbox", {
        name: /live transcript/i,
      });
      await user.click(liveTranscriptCheckbox);

      expect(liveTranscriptCheckbox).toBeChecked();
      expect(screen.getByLabelText(/Transcript Delay/i)).toBeInTheDocument();
    });

    it("unchecking a feature hides its sub-properties", async () => {
      const user = userEvent.setup();
      await act(async () => {
        render(<EventCreationForm />);
      });

      await navigateToStep3WithBackChannel(user);

      const liveTranscriptCheckbox = screen.getByRole("checkbox", {
        name: /live transcript/i,
      });
      await user.click(liveTranscriptCheckbox);
      expect(screen.getByLabelText(/Transcript Delay/i)).toBeInTheDocument();

      await user.click(liveTranscriptCheckbox);
      expect(liveTranscriptCheckbox).not.toBeChecked();
      expect(
        screen.queryByLabelText(/Transcript Delay/i),
      ).not.toBeInTheDocument();
    });

    it("does not include features in submission payload when none are enabled", async () => {
      const user = userEvent.setup();
      (Request as jest.Mock).mockImplementation(
        makeRequestMock({
          id: "conv-no-features",
          name: "Test Event",
          channels: [],
          agents: [],
          adapters: [],
          conversationType: "backChannel",
        }),
      );

      await act(async () => {
        render(<EventCreationForm />);
      });

      await navigateToStep3WithBackChannel(user);
      await user.click(screen.getByRole("button", { name: /next/i }));
      await waitFor(() => screen.getByText("About the Speakers"));
      await user.click(
        screen.getByRole("button", { name: /create conversation/i }),
      );

      await waitFor(() => {
        const conversationCall = (Request as jest.Mock).mock.calls.find(
          (call) => call[0] === "conversations/from-type",
        );
        expect(conversationCall![1]).not.toHaveProperty("features");
      });
    });

    it("includes enabled features with their properties in the submission payload", async () => {
      const user = userEvent.setup();
      (Request as jest.Mock).mockImplementation(
        makeRequestMock({
          id: "conv-with-features",
          name: "Test Event",
          channels: [],
          agents: [],
          adapters: [],
          conversationType: "backChannel",
        }),
      );

      await act(async () => {
        render(<EventCreationForm />);
      });

      await navigateToStep3WithBackChannel(user);

      // Enable the liveTranscript feature
      await user.click(
        screen.getByRole("checkbox", { name: /live transcript/i }),
      );

      // Also enable autoSummary
      await user.click(
        screen.getByRole("checkbox", { name: /auto summary/i }),
      );

      await user.click(screen.getByRole("button", { name: /next/i }));
      await waitFor(() => screen.getByText("About the Speakers"));
      await user.click(
        screen.getByRole("button", { name: /create conversation/i }),
      );

      await waitFor(() => {
        expect(Request).toHaveBeenCalledWith(
          "conversations/from-type",
          expect.objectContaining({
            features: expect.arrayContaining([
              { name: "liveTranscript", config: { transcriptDelay: 5 } },
              { name: "autoSummary", config: {} },
            ]),
          }),
        );
      });
    });

    it("does not show Features section when conversationType has no features", async () => {
      const user = userEvent.setup();
      await act(async () => {
        render(<EventCreationForm />);
      });

      await fillEventDetails(
        "Test Event",
        "https://huitstage.zoom.us/j/1234567890",
      );
      await user.click(screen.getByRole("button", { name: /next/i }));
      await waitFor(() => screen.getByText("Nextspace"));
      await user.click(screen.getByRole("checkbox", { name: /zoom/i }));
      // Event Assistant has no features in the mock config
      await user.click(
        screen.getByRole("radio", { name: /event assistant/i }),
      );
      await user.click(screen.getByRole("button", { name: /next/i }));
      await waitFor(() => screen.getByLabelText(/Bot Name/i));

      expect(screen.queryByText("Features")).not.toBeInTheDocument();
    });
  });

  describe("Event Series", () => {
    it("renders the Event Series field on Step 1", async () => {
      await act(async () => {
        render(<EventCreationForm />);
      });

      expect(screen.getByText(/Event Series/i)).toBeInTheDocument();
      expect(
        screen.getByRole("radio", { name: /choose existing series/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("radio", { name: /create new series/i }),
      ).toBeInTheDocument();
    });

    it("defaults to 'Choose existing series' mode", async () => {
      await act(async () => {
        render(<EventCreationForm />);
      });

      expect(
        screen.getByRole("radio", { name: /choose existing series/i }),
      ).toBeChecked();
      expect(
        screen.getByRole("radio", { name: /create new series/i }),
      ).not.toBeChecked();
    });

    it("fetches and displays public topics in the autocomplete", async () => {
      const user = userEvent.setup();
      await act(async () => {
        render(<EventCreationForm />);
      });

      await waitFor(() => {
        expect(Request).toHaveBeenCalledWith("topics");
        expect(Request).toHaveBeenCalledWith("topics/userTopics");
      });

      const topicInput = screen.getByLabelText(/Select a series/i);
      fireEvent.click(topicInput);
      fireEvent.keyDown(topicInput, { key: "ArrowDown" });

      await waitFor(() => {
        expect(screen.getByText("Public Topic 1")).toBeInTheDocument();
        expect(screen.getByText("Public Topic 2")).toBeInTheDocument();
      });
    });

    it("excludes archived and deleted topics from the list", async () => {
      const user = userEvent.setup();
      await act(async () => {
        render(<EventCreationForm />);
      });

      const topicInput = screen.getByLabelText(/Select a series/i);
      fireEvent.click(topicInput);
      fireEvent.keyDown(topicInput, { key: "ArrowDown" });

      // Wait for the listbox to open, then assert excluded topics are absent
      await screen.findByRole("listbox");
      expect(screen.queryByText("Archived Topic")).not.toBeInTheDocument();
      expect(screen.queryByText("Deleted Topic")).not.toBeInTheDocument();
    });

    it("shows private topics owned by the current user", async () => {
      const user = userEvent.setup();
      await act(async () => {
        render(<EventCreationForm />);
      });

      const topicInput = screen.getByLabelText(/Select a series/i);
      fireEvent.click(topicInput);
      fireEvent.keyDown(topicInput, { key: "ArrowDown" });

      await waitFor(() => {
        expect(screen.getByText("My Private Topic")).toBeInTheDocument();
      });
    });

    it("shows error when Next is clicked with no topic selected", async () => {
      const user = userEvent.setup();
      await act(async () => {
        render(<EventCreationForm />);
      });

      const nameInput = screen.getByLabelText(/Event Name/i);
      await user.type(nameInput, "Test Event");

      const urlInput = screen.getByLabelText(/Zoom Meeting URL/i);
      await user.type(urlInput, "https://huitstage.zoom.us/j/1234567890");

      await user.click(screen.getByRole("button", { name: /next/i }));

      await waitFor(() => {
        expect(
          screen.getByText("An Event Series is required"),
        ).toBeInTheDocument();
      });
    });

    it("shows error on blur when autocomplete is left empty", async () => {
      const user = userEvent.setup();
      await act(async () => {
        render(<EventCreationForm />);
      });

      const topicInput = screen.getByLabelText(/Select a series/i);
      fireEvent.focus(topicInput);
      fireEvent.blur(topicInput);

      await waitFor(() => {
        expect(
          screen.getByText("Please select an Event Series."),
        ).toBeInTheDocument();
      });
    });

    it("switches to new series creation form", async () => {
      const user = userEvent.setup();
      await act(async () => {
        render(<EventCreationForm />);
      });

      await user.click(
        screen.getByRole("radio", { name: /create new series/i }),
      );

      expect(screen.getByLabelText(/Series Name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Series Description/i)).toBeInTheDocument();
      expect(
        screen.getByRole("checkbox", { name: /public/i }),
      ).toBeInTheDocument();
    });

    it("new series Public checkbox is unchecked by default", async () => {
      const user = userEvent.setup();
      await act(async () => {
        render(<EventCreationForm />);
      });

      await user.click(
        screen.getByRole("radio", { name: /create new series/i }),
      );

      expect(screen.getByRole("checkbox", { name: /public/i })).not.toBeChecked();
    });

    it("shows error when Next is clicked with empty series name", async () => {
      const user = userEvent.setup();
      await act(async () => {
        render(<EventCreationForm />);
      });

      await user.click(
        screen.getByRole("radio", { name: /create new series/i }),
      );

      const nameInput = screen.getByLabelText(/Event Name/i);
      await user.type(nameInput, "Test Event");

      const urlInput = screen.getByLabelText(/Zoom Meeting URL/i);
      await user.type(urlInput, "https://huitstage.zoom.us/j/1234567890");

      await user.click(screen.getByRole("button", { name: /next/i }));

      await waitFor(() => {
        expect(
          screen.getByText("Series name is required"),
        ).toBeInTheDocument();
      });
    });

    it("shows series name error on blur when left empty", async () => {
      const user = userEvent.setup();
      await act(async () => {
        render(<EventCreationForm />);
      });

      await user.click(
        screen.getByRole("radio", { name: /create new series/i }),
      );

      const seriesNameInput = screen.getByLabelText(/Series Name/i);
      await user.click(seriesNameInput);
      await user.tab();

      await waitFor(() => {
        expect(
          screen.getByText("Series name is required."),
        ).toBeInTheDocument();
      });
    });

    it("creates a new topic then submits the conversation with the new topic ID", async () => {
      const user = userEvent.setup();
      const newTopicId = "new-topic-id-123";
      const mockConversationData = {
        id: "new-conv-123",
        name: "Test Event",
        channels: [],
        agents: [],
        adapters: [],
        conversationType: "backChannel",
      };
      (Request as jest.Mock).mockImplementation(
        (endpoint: string, payload?: any) => {
          if (endpoint === "topics" && !payload)
            return Promise.resolve(mockPublicTopics);
          if (endpoint === "topics/userTopics")
            return Promise.resolve(mockUserTopics);
          if (endpoint === "topics" && payload)
            return Promise.resolve({ id: newTopicId });
          return Promise.resolve(mockConversationData);
        },
      );

      await act(async () => {
        render(<EventCreationForm />);
      });

      // Switch to new series mode
      await user.click(
        screen.getByRole("radio", { name: /create new series/i }),
      );

      // Fill in series name
      await user.type(screen.getByLabelText(/Series Name/i), "My New Series");
      await user.type(
        screen.getByLabelText(/Series Description/i),
        "A great series",
      );

      // Fill the rest of Step 1
      await user.type(screen.getByLabelText(/Event Name/i), "Test Event");
      await user.type(
        screen.getByLabelText(/Zoom Meeting URL/i),
        "https://huitstage.zoom.us/j/1234567890",
      );

      await user.click(screen.getByRole("button", { name: /next/i }));

      await waitFor(() => screen.getByText("Nextspace"));
      await user.click(screen.getByRole("checkbox", { name: /zoom/i }));
      await user.click(screen.getByRole("radio", { name: /back channel/i }));
      await user.click(screen.getByRole("button", { name: /next/i }));

      await waitFor(() => screen.getByLabelText(/Bot Name/i));
      await user.click(screen.getByRole("button", { name: /next/i }));

      await waitFor(() => screen.getByText("About the Speakers"));
      await user.click(
        screen.getByRole("button", { name: /create conversation/i }),
      );

      await waitFor(() => {
        expect(Request).toHaveBeenCalledWith(
          "topics",
          expect.objectContaining({
            name: "My New Series",
            description: "A great series",
            private: true,
          }),
        );
        expect(Request).toHaveBeenCalledWith(
          "conversations/from-type",
          expect.objectContaining({ topicId: newTopicId }),
        );
      });
    });

    it("submits with selected existing topic ID", async () => {
      const user = userEvent.setup();
      const mockConversationData = {
        id: "new-conv-123",
        name: "Test Event",
        channels: [],
        agents: [],
        adapters: [],
        conversationType: "backChannel",
      };
      (Request as jest.Mock).mockImplementation(
        makeRequestMock(mockConversationData),
      );

      await act(async () => {
        render(<EventCreationForm />);
      });

      await fillEventDetails(
        "Test Event",
        "https://huitstage.zoom.us/j/1234567890",
      );
      await user.click(screen.getByRole("button", { name: /next/i }));

      await waitFor(() => screen.getByText("Nextspace"));
      await user.click(screen.getByRole("checkbox", { name: /zoom/i }));
      await user.click(screen.getByRole("radio", { name: /back channel/i }));
      await user.click(screen.getByRole("button", { name: /next/i }));

      await waitFor(() => screen.getByLabelText(/Bot Name/i));
      await user.click(screen.getByRole("button", { name: /next/i }));

      await waitFor(() => screen.getByText("About the Speakers"));
      await user.click(
        screen.getByRole("button", { name: /create conversation/i }),
      );

      await waitFor(() => {
        expect(Request).toHaveBeenCalledWith(
          "conversations/from-type",
          expect.objectContaining({ topicId: "topic-1" }),
        );
        // Should NOT have called topics POST to create a new topic
        expect(Request).not.toHaveBeenCalledWith(
          "topics",
          expect.anything(),
        );
      });
    });
  });
});
