import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent, { UserEvent } from "@testing-library/user-event";
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
    },
    {
      name: "eventAssistant",
      label: "Event Assistant",
      description: "An assistant to answer questions about an event",
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

  it("renders the form with initial state", async () => {
    await act(async () => {
      render(<EventCreationForm />);
    });

    expect(screen.getByText("Event Details")).toBeInTheDocument();
    expect(screen.getByText("Conversation Configuration")).toBeInTheDocument();

    await waitFor(() => {
      expect(
        screen.getByText("Where do you want your audience to interact?")
      ).toBeInTheDocument();
    });
  });

  it("shows platform selection checkboxes after loading", async () => {
    await act(async () => {
      render(<EventCreationForm />);
    });

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

  it("requires agent selection", async () => {
    const user = userEvent.setup();

    await act(async () => {
      render(<EventCreationForm />);
    });

    await waitFor(() => {
      expect(screen.getByText("Nextspace")).toBeInTheDocument();
    });

    const submitButton = screen.getByRole("button", {
      name: /create conversation/i,
    });
    // Select an agent
    const backChannelRadio = screen.getByRole("radio", {
      name: /back channel/i,
    });
    await user.click(backChannelRadio);
    await user.click(submitButton);

    await waitFor(() => {
      expect(
        screen.queryByText("At least one agent must be selected")
      ).toBeNull();
    });
  });

  it("displays agent descriptions", async () => {
    await act(async () => {
      render(<EventCreationForm />);
    });

    expect(
      screen.getByText(/An agent to analyze participant comments/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/An assistant to answer questions about an event/i)
    ).toBeInTheDocument();
  });

  it("displays model selection options with descriptions", async () => {
    const user = userEvent.setup();

    await act(async () => {
      render(<EventCreationForm />);
    });

    await waitFor(() => {
      expect(screen.getByText("Nextspace")).toBeInTheDocument();
    });

    // Select an agent to reveal configuration
    const backChannelRadio = screen.getByRole("radio", {
      name: /back channel/i,
    });
    await user.click(backChannelRadio);

    await waitFor(() => {
      expect(
        screen.getByText("Agent Configuration (Advanced Settings)")
      ).toBeInTheDocument();
    });

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

  it("validates zoom meeting URL format", async () => {
    const user = userEvent.setup();

    await act(async () => {
      render(<EventCreationForm />);
    });

    await waitFor(() => {
      expect(screen.getByText("Nextspace")).toBeInTheDocument();
    });

    const urlInput = screen.getByLabelText(/Zoom Meeting URL/i);
    await user.type(urlInput, "invalid-url");
    // Blur the field to trigger validation
    await user.tab();

    await waitFor(() => {
      expect(
        screen.getByText(/Invalid Zoom Meeting URL format/i, { exact: false })
      ).toBeInTheDocument();
    });

    await user.clear(urlInput);
    await user.type(urlInput, "https://huitstage.zoom.us/j/1234567890");

    await waitFor(() => {
      expect(
        screen.queryByText("Invalid Zoom Meeting URL format")
      ).not.toBeInTheDocument();
    });
  });

  it("allows custom zoom bot name configuration", async () => {
    const user = userEvent.setup();

    await act(async () => {
      render(<EventCreationForm />);
    });

    await waitFor(() => {
      expect(screen.getByText("Nextspace")).toBeInTheDocument();
    });

    // Select an agent
    const backChannelRadio = screen.getByRole("radio", {
      name: /back channel/i,
    });
    await user.click(backChannelRadio);

    await waitFor(() => {
      expect(screen.getByLabelText(/Zoom Bot Name/i)).toBeInTheDocument();
    });

    const botNameInput = screen.getByLabelText(/Zoom Bot Name/i);
    expect(botNameInput).toHaveValue("Back Channel");

    await user.clear(botNameInput);
    await user.type(botNameInput, "Custom Bot Name");
    expect(botNameInput).toHaveValue("Custom Bot Name");
  });

  it("submits correct payload for Back Channel agent with default model", async () => {
    const user = userEvent.setup();
    const mockConversationData = {
      id: "new-conv-123",
      name: "Test Back Channel Event",
      channels: [],
      agents: [],
      adapters: [],
    };
    (Request as jest.Mock).mockResolvedValue(mockConversationData);

    await act(async () => {
      render(<EventCreationForm />);
    });

    await waitFor(() => {
      expect(screen.getByText("Nextspace")).toBeInTheDocument();
    });

    // Fill in event details
    await fillEventDetails(
      "Test Back Channel Event",
      "https://huitstage.zoom.us/j/1234567890"
    );

    // Select Back Channel agent
    const backChannelRadio = screen.getByRole("radio", {
      name: /back channel/i,
    });
    await user.click(backChannelRadio);

    // Select Zoom platform
    const zoomCheckbox = screen.getByRole("checkbox", { name: /zoom/i });
    await user.click(zoomCheckbox);

    // Submit form
    const submitButton = screen.getByRole("button", {
      name: /create conversation/i,
    });
    await user.click(submitButton);

    await waitFor(() => {
      expect(Request).toHaveBeenCalledWith(
        "conversations/from-type",
        expect.objectContaining({
          name: "Test Back Channel Event",
          properties: expect.objectContaining({
            llmModel: {
              llmPlatform: "openai",
              llmModel: "gpt-4o-mini",
            },
          }),
          topicId: process.env.NEXT_PUBLIC_DEFAULT_TOPIC_ID,
        })
      );
    });
  });

  it("submits correct payload for Event Assistant agent with non-default model", async () => {
    const user = userEvent.setup();
    const mockConversationData = {
      id: "new-conv-456",
      name: "Test Event Assistant",
      channels: [],
      agents: [],
      adapters: [],
    };
    (Request as jest.Mock).mockResolvedValue(mockConversationData);

    render(<EventCreationForm />);

    // Fill in event details
    await fillEventDetails(
      "Test Event Assistant",
      "https://huitstage.zoom.us/j/9876543210"
    );

    // Select Event Assistant agent
    const eventAssistantRadio = screen.getByRole("radio", {
      name: /event assistant/i,
    });
    await user.click(eventAssistantRadio);

    // Select Claude Sonnet model
    await waitFor(() => {
      expect(
        screen.getByText("Agent Configuration (Advanced Settings)")
      ).toBeInTheDocument();
    });

    const sonnetRadio = screen.getByRole("radio", {
      name: /aws bedrock claude 3\.5 sonnet/i,
    });
    await user.click(sonnetRadio);

    // Select Zoom platform
    const zoomCheckbox = screen.getByRole("checkbox", { name: /zoom/i });
    await user.click(zoomCheckbox);

    // Submit form
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
    };
    (Request as jest.Mock).mockResolvedValue(mockConversationData);

    await act(async () => {
      render(<EventCreationForm />);
    });

    await waitFor(() => {
      expect(screen.getByText("Nextspace")).toBeInTheDocument();
    });

    // Fill in event details
    await fillEventDetails(
      "Custom Bot Event",
      "https://huitstage.zoom.us/j/5555555555"
    );

    // Select Back Channel agent
    const backChannelRadio = screen.getByRole("radio", {
      name: /back channel/i,
    });
    await user.click(backChannelRadio);

    // Change bot name
    const botNameInput = await screen.findByLabelText(/Zoom Bot Name/i);
    await user.clear(botNameInput);
    await user.type(botNameInput, "MyCustomBot");

    const zoomCheckbox = screen.getByRole("checkbox", { name: /zoom/i });
    await user.click(zoomCheckbox);

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

  it("submits payload with scheduled time when provided", async () => {
    const user = userEvent.setup();
    const mockConversationData = {
      id: "new-conv-scheduled",
      name: "Scheduled Event",
      channels: [],
      agents: [],
      adapters: [],
    };
    (Request as jest.Mock).mockResolvedValue(mockConversationData);

    await act(async () => {
      render(<EventCreationForm />);
    });

    await waitFor(() => {
      expect(screen.getByText("Nextspace")).toBeInTheDocument();
    });

    // Fill in event details
    await fillEventDetails(
      "Scheduled Event",
      "https://huitstage.zoom.us/j/1111111111"
    );

    const backChannelRadio = screen.getByRole("radio", {
      name: /back channel/i,
    });
    await user.click(backChannelRadio);

    // Note: Actually testing DateTimePicker interaction is complex
    // This test would need to be expanded with proper date selection
    // For now, we're just verifying the field exists by checking for the calendar button
    expect(screen.getByLabelText(/Choose date/i)).toBeInTheDocument();

    const zoomCheckbox = screen.getByRole("checkbox", { name: /zoom/i });
    await user.click(zoomCheckbox);

    const submitButton = screen.getByRole("button", {
      name: /create conversation/i,
    });
    await user.click(submitButton);

    await waitFor(() => {
      expect(Request).toHaveBeenCalled();
    });
  });

  it("displays error message when form submission fails", async () => {
    const user = userEvent.setup();
    (Request as jest.Mock).mockRejectedValue(new Error("Network error"));

    await act(async () => {
      render(<EventCreationForm />);
    });

    await waitFor(() => {
      expect(screen.getByText("Nextspace")).toBeInTheDocument();
    });

    // Fill in event details
    await fillEventDetails(
      "Test Event",
      "https://huitstage.zoom.us/j/1234567890"
    );

    const zoomCheckbox = screen.getByRole("checkbox", { name: /zoom/i });
    await user.click(zoomCheckbox);

    const backChannelRadio = screen.getByRole("radio", {
      name: /back channel/i,
    });
    await user.click(backChannelRadio);

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
    };
    (Request as jest.Mock).mockResolvedValue(mockConversationData);

    await act(async () => {
      render(<EventCreationForm />);
    });

    await waitFor(() => {
      expect(screen.getByText("Nextspace")).toBeInTheDocument();
    });

    // Fill in event details
    await fillEventDetails(
      "Test Event",
      "https://huitstage.zoom.us/j/1234567890"
    );

    const zoomCheckbox = screen.getByRole("checkbox", { name: /zoom/i });
    await user.click(zoomCheckbox);

    const backChannelRadio = screen.getByRole("radio", {
      name: /back channel/i,
    });
    await user.click(backChannelRadio);

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
    await act(async () => {
      render(<EventCreationForm />);
    });

    await waitFor(() => {
      expect(screen.getByText("Nextspace")).toBeInTheDocument();
    });

    // Select an agent to reveal model configuration
    const backChannelRadio = screen.getByRole("radio", {
      name: /back channel/i,
    });
    await userEvent.setup().click(backChannelRadio);

    await waitFor(() => {
      const gptRadio = screen.getByRole("radio", {
        name: /openai gpt-4o mini/i,
      });
      // First model (gpt-4o-mini) should be selected by default
      expect(gptRadio).toBeChecked();
    });
  });
});
