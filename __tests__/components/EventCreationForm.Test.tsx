import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
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

const fillEventDetails = async (name: string, zoomUrl: string) => {
  const user = userEvent.setup();
  // Fill in event name
  const nameInput = screen.getByLabelText(/Event Name/i);
  await user.type(nameInput, name);

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
          label: "Zoom Bot Name",
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
          label: "Zoom Bot Name",
          default: "Event Assistant",
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
  });

  it("renders the form with initial state on step 1", async () => {
    await act(async () => {
      render(<EventCreationForm />);
    });

    // Check that all step labels are present in the stepper
    expect(screen.getAllByText("Event Details").length).toBeGreaterThan(0);
    expect(screen.getByText("Conversation Configuration")).toBeInTheDocument();
    expect(screen.getByText("Agent Configuration")).toBeInTheDocument();
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
      "https://huitstage.zoom.us/j/1234567890"
    );

    const nextButton = screen.getByRole("button", { name: /next/i });
    await user.click(nextButton);

    // Should now be on Step 2
    await waitFor(() => {
      expect(
        screen.getByText("Where do you want your audience to interact?")
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
      "https://huitstage.zoom.us/j/1234567890"
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
      "https://huitstage.zoom.us/j/1234567890"
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
      "https://huitstage.zoom.us/j/1234567890"
    );
    await user.click(screen.getByRole("button", { name: /next/i }));

    await waitFor(() => {
      expect(screen.getByText("Nextspace")).toBeInTheDocument();
    });

    // Try to proceed without selections
    await user.click(screen.getByRole("button", { name: /next/i }));

    await waitFor(() => {
      expect(
        screen.getByText("At least one platform must be selected")
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
      "https://huitstage.zoom.us/j/1234567890"
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
      expect(screen.getByLabelText(/Zoom Bot Name/i)).toBeInTheDocument();
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
      "https://huitstage.zoom.us/j/1234567890"
    );
    await user.click(screen.getByRole("button", { name: /next/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/An agent to analyze participant comments/i)
      ).toBeInTheDocument();
      expect(
        screen.getByText(/An assistant to answer questions about an event/i)
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
      "https://huitstage.zoom.us/j/1234567890"
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
        screen.getByText(/AWS Bedrock Claude 3.5 Haiku/i)
      ).toBeInTheDocument();
      expect(
        screen.getByText(/AWS Bedrock Claude 3.5 Sonnet/i)
      ).toBeInTheDocument();
      expect(
        screen.getByText(
          /Fast, lightweight model ideal for everyday conversations/i
        )
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
      "https://huitstage.zoom.us/j/1234567890"
    );
    await user.click(screen.getByRole("button", { name: /next/i }));

    await waitFor(() => {
      expect(screen.getByText("Nextspace")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("checkbox", { name: /zoom/i }));
    await user.click(screen.getByRole("radio", { name: /back channel/i }));
    await user.click(screen.getByRole("button", { name: /next/i }));

    await waitFor(() => {
      expect(screen.getByLabelText(/Zoom Bot Name/i)).toBeInTheDocument();
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
      "https://huitstage.zoom.us/j/1234567890"
    );
    await user.click(screen.getByRole("button", { name: /next/i }));
    await waitFor(() => screen.getByText("Nextspace"));
    await user.click(screen.getByRole("checkbox", { name: /zoom/i }));
    await user.click(screen.getByRole("radio", { name: /back channel/i }));
    await user.click(screen.getByRole("button", { name: /next/i }));
    await waitFor(() => screen.getByLabelText(/Zoom Bot Name/i));
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
      "https://huitstage.zoom.us/j/1234567890"
    );
    await user.click(screen.getByRole("button", { name: /next/i }));
    await waitFor(() => screen.getByText("Nextspace"));
    await user.click(screen.getByRole("checkbox", { name: /zoom/i }));
    await user.click(screen.getByRole("radio", { name: /back channel/i }));
    await user.click(screen.getByRole("button", { name: /next/i }));
    await waitFor(() => screen.getByLabelText(/Zoom Bot Name/i));
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
      "https://huitstage.zoom.us/j/1234567890"
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

  it("allows custom zoom bot name configuration on Step 3", async () => {
    const user = userEvent.setup();
    await act(async () => {
      render(<EventCreationForm />);
    });

    // Navigate to Step 3
    await fillEventDetails(
      "Test Event",
      "https://huitstage.zoom.us/j/1234567890"
    );
    await user.click(screen.getByRole("button", { name: /next/i }));
    await waitFor(() => screen.getByText("Nextspace"));
    await user.click(screen.getByRole("checkbox", { name: /zoom/i }));
    await user.click(screen.getByRole("radio", { name: /back channel/i }));
    await user.click(screen.getByRole("button", { name: /next/i }));

    await waitFor(() => {
      expect(screen.getByLabelText(/Zoom Bot Name/i)).toBeInTheDocument();
    });

    const botNameInput = screen.getByLabelText(/Zoom Bot Name/i) as HTMLInputElement;
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
    (Request as jest.Mock).mockResolvedValue(mockConversationData);

    await act(async () => {
      render(<EventCreationForm />);
    });

    // Complete all steps
    await fillEventDetails(
      "Test Event",
      "https://huitstage.zoom.us/j/1234567890"
    );
    await user.click(screen.getByRole("button", { name: /next/i }));

    await waitFor(() => screen.getByText("Nextspace"));
    await user.click(screen.getByRole("checkbox", { name: /zoom/i }));
    await user.click(screen.getByRole("radio", { name: /back channel/i }));
    await user.click(screen.getByRole("button", { name: /next/i }));

    await waitFor(() => screen.getByLabelText(/Zoom Bot Name/i));
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
          properties: expect.objectContaining({
            zoomMeetingUrl: "https://huitstage.zoom.us/j/1234567890",
            botName: "Back Channel",
            llmModel: {
              llmPlatform: "openai",
              llmModel: "gpt-4o-mini",
            },
          }),
        })
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
    (Request as jest.Mock).mockResolvedValue(mockConversationData);

    await act(async () => {
      render(<EventCreationForm />);
    });

    // Complete all steps
    await fillEventDetails(
      "Test Event Assistant",
      "https://huitstage.zoom.us/j/9876543210"
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
          properties: expect.objectContaining({
            llmModel: {
              llmPlatform: "bedrock",
              llmModel: "anthropic.claude-3-5-sonnet-20240620-v1:0",
            },
          }),
          topicId: process.env.NEXT_PUBLIC_DEFAULT_TOPIC_ID,
          scheduledTime: expect.any(String),
        })
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
    (Request as jest.Mock).mockResolvedValue(mockConversationData);

    await act(async () => {
      render(<EventCreationForm />);
    });

    // Complete all steps with custom bot name
    await fillEventDetails(
      "Custom Bot Event",
      "https://huitstage.zoom.us/j/5555555555"
    );
    await user.click(screen.getByRole("button", { name: /next/i }));

    await waitFor(() => screen.getByText("Nextspace"));
    await user.click(screen.getByRole("checkbox", { name: /zoom/i }));
    await user.click(screen.getByRole("radio", { name: /back channel/i }));
    await user.click(screen.getByRole("button", { name: /next/i }));

    const botNameInput = (await screen.findByLabelText(/Zoom Bot Name/i)) as HTMLInputElement;
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
        })
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
    (Request as jest.Mock).mockResolvedValue(mockConversationData);

    await act(async () => {
      render(<EventCreationForm />);
    });

    // Complete all steps
    await fillEventDetails(
      "Event with Speakers",
      "https://huitstage.zoom.us/j/1111111111"
    );
    await user.click(screen.getByRole("button", { name: /next/i }));

    await waitFor(() => screen.getByText("Nextspace"));
    await user.click(screen.getByRole("checkbox", { name: /zoom/i }));
    await user.click(screen.getByRole("radio", { name: /back channel/i }));
    await user.click(screen.getByRole("button", { name: /next/i }));

    await waitFor(() => screen.getByLabelText(/Zoom Bot Name/i));
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
        })
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
      "https://huitstage.zoom.us/j/1111111111"
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
      "https://huitstage.zoom.us/j/1111111111"
    );

    const urlInput = screen.getByLabelText(/Zoom Meeting URL/i);
    await user.clear(urlInput);

    await user.click(screen.getByRole("button", { name: /next/i }));

    await waitFor(() => {
      expect(
        screen.getByText("Zoom Meeting URL is required")
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
      "https://huitstage.zoom.us/j/1234567890"
    );

    // Navigate to Step 3 without selecting platform
    await user.click(screen.getByRole("button", { name: /next/i }));
    await user.click(screen.getByRole("button", { name: /next/i }));

    await waitFor(() => {
      expect(
        screen.getByText("At least one platform must be selected")
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
      "https://huitstage.zoom.us/j/1234567890"
    );

    // Navigate to Step 3 without selecting platform
    await user.click(screen.getByRole("button", { name: /next/i }));
    await user.click(screen.getByRole("button", { name: /next/i }));

    await waitFor(() => {
      expect(
        screen.getByText("At least one platform must be selected")
      ).toBeInTheDocument();
    });

    const zoomCheckbox = screen.getByRole("checkbox", { name: /zoom/i });
    await user.click(zoomCheckbox);

    await user.click(screen.getByRole("button", { name: /next/i }));

    await waitFor(() => {
      expect(
        screen.queryByText("At least one platform must be selected")
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
      "https://huitstage.zoom.us/j/1234567890"
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
        screen.getByText("At least one platform must be selected")
      ).toBeInTheDocument();
    });

    expect(Request).not.toHaveBeenCalled();
  });

  it("displays error message when form submission fails", async () => {
    const user = userEvent.setup();
    (Request as jest.Mock).mockRejectedValue(new Error("Network error"));

    await act(async () => {
      render(<EventCreationForm />);
    });

    // Complete all steps
    await fillEventDetails(
      "Test Event",
      "https://huitstage.zoom.us/j/1234567890"
    );
    await user.click(screen.getByRole("button", { name: /next/i }));

    await waitFor(() => screen.getByText("Nextspace"));
    await user.click(screen.getByRole("checkbox", { name: /zoom/i }));
    await user.click(screen.getByRole("radio", { name: /back channel/i }));
    await user.click(screen.getByRole("button", { name: /next/i }));

    await waitFor(() => screen.getByLabelText(/Zoom Bot Name/i));
    await user.click(screen.getByRole("button", { name: /next/i }));

    await waitFor(() => screen.getByText("About the Speakers"));

    const submitButton = screen.getByRole("button", {
      name: /create conversation/i,
    });
    await user.click(submitButton);

    await waitFor(() => {
      expect(
        screen.getByText(/Failed to send data.*Network error/)
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
        screen.getByText("Failed to load configuration.")
      ).toBeInTheDocument();
    });
  });

  it("redirects to event view page after successful conversation creation", async () => {
    const user = userEvent.setup();
    const mockConversationData = {
      id: "new-conv-redirect",
      name: "Test Event",
      channels: [],
      agents: [],
      adapters: [],
      conversationType: "eventAssistant",
    };
    (Request as jest.Mock).mockResolvedValue(mockConversationData);

    await act(async () => {
      render(<EventCreationForm />);
    });

    // Complete all steps
    await fillEventDetails(
      "Test Event",
      "https://huitstage.zoom.us/j/1234567890"
    );
    await user.click(screen.getByRole("button", { name: /next/i }));

    await waitFor(() => screen.getByText("Nextspace"));
    await user.click(screen.getByRole("checkbox", { name: /zoom/i }));
    await user.click(screen.getByRole("radio", { name: /back channel/i }));
    await user.click(screen.getByRole("button", { name: /next/i }));

    await waitFor(() => screen.getByLabelText(/Zoom Bot Name/i));
    await user.click(screen.getByRole("button", { name: /next/i }));

    await waitFor(() => screen.getByText("About the Speakers"));

    const submitButton = screen.getByRole("button", {
      name: /create conversation/i,
    });
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith(
        "/admin/event/view/new-conv-redirect"
      );
    });
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
      "https://huitstage.zoom.us/j/1234567890"
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
});
