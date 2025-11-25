import { render, screen, waitFor } from "@testing-library/react";
import { act } from "react";
import userEvent, { UserEvent } from "@testing-library/user-event";
import { ExperimentCreationForm } from "../../components/ExperimentCreationForm";
import { RetrieveData, SendData } from "../../utils";
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
  SendData: jest.fn(),
}));

describe("ExperimentCreationForm Component", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPush.mockClear();
  });

  async function selectFromDropdown(
    user: UserEvent,
    label = "Agent",
    optionMatcher = /Back Channel Insights/i
  ) {
    const select = screen.getByLabelText(label);
    await user.click(select);

    // Wait for the menu option to appear in the portal, then click it
    const option = await screen.findByText(optionMatcher);
    await user.click(option);

    // Wait for the select to update its visible text
    await waitFor(() => expect(select).toHaveTextContent(optionMatcher));

    return select;
  }

  it("renders experiment configuration when experiment prop is true", async () => {
    (RetrieveData as jest.Mock).mockResolvedValue([
      {
        id: "conv-123",
        name: "Test Event",
        active: true,
        agents: [
          {
            _id: "agent-123",
            agentType: "backChannelMetrics",
            llmPlatform: "openai",
            llmModel: "gpt-4-turbo",
          },
        ],
        messageCount: 10,
      },
    ]);

    await act(async () => {
      render(<ExperimentCreationForm />);
    });

    await waitFor(() => {
      expect(screen.getByText("Experiment Configuration")).toBeInTheDocument();
      expect(screen.getByLabelText("Base Conversation")).toBeInTheDocument();
    });
  });

  it("fetches conversations on mount when in experiment mode", async () => {
    const mockConversations = [
      {
        id: "conv-123",
        name: "Test Event",
        agents: [{ _id: "agent-123", agentType: "backChannelMetrics" }],
        messageCount: 10,
      },
    ];

    (RetrieveData as jest.Mock).mockResolvedValue(mockConversations);

    await act(async () => {
      render(<ExperimentCreationForm token="test-token" />);
    });

    await waitFor(() => {
      expect(RetrieveData).toHaveBeenCalledWith(
        "conversations/active",
        "test-token"
      );
    });
  });

  it("fetches conversation data when base conversation is selected", async () => {
    const user = userEvent.setup();
    const mockConversations = [
      {
        id: "conv-123",
        name: "Base Event",
        agents: [
          {
            _id: "agent-123",
            agentType: "backChannelMetrics",
            llmPlatform: "openai",
            llmModel: "gpt-4-turbo",
          },
        ],
        messageCount: 10,
      },
    ];

    const mockConversationDetail = {
      ...mockConversations[0],
      channels: [{ name: "moderator" }],
    };

    (RetrieveData as jest.Mock)
      .mockResolvedValueOnce(mockConversations)
      .mockResolvedValueOnce(mockConversationDetail);

    await act(async () => {
      render(<ExperimentCreationForm token="test-token" />);
    });

    await waitFor(() => {
      expect(screen.getByLabelText("Base Conversation")).toBeInTheDocument();
    });

    const conversationSelect = screen.getByLabelText("Base Conversation");
    await user.click(conversationSelect);

    const option = screen.getByText(/Base Event/);
    await user.click(option);

    await waitFor(() => {
      expect(RetrieveData).toHaveBeenCalledWith(
        "/conversations/conv-123",
        "test-token"
      );
    });
  });

  it("shows agent selection after base conversation is selected", async () => {
    const user = userEvent.setup();
    const mockConversations = [
      {
        id: "conv-123",
        name: "Base Event",
        agents: [
          {
            _id: "agent-123",
            agentType: "backChannelMetrics",
            llmPlatform: "openai",
            llmModel: "gpt-4-turbo",
          },
        ],
        messageCount: 10,
      },
    ];

    (RetrieveData as jest.Mock)
      .mockResolvedValueOnce(mockConversations)
      .mockResolvedValueOnce({ ...mockConversations[0] });

    await act(async () => {
      render(<ExperimentCreationForm token="test-token" />);
    });

    await selectFromDropdown(user, "Base Conversation", /Base Event/i);

    await waitFor(() => {
      expect(screen.getByLabelText("Agents")).toBeInTheDocument();
    });
  });

  it("displays agent configuration for selected base conversation", async () => {
    const user = userEvent.setup();
    const mockConversations = [
      {
        id: "conv-123",
        name: "Base Event",
        agents: [
          {
            _id: "agent-123",
            agentType: "backChannelMetrics",
            llmPlatform: "openai",
            llmModel: "gpt-4-turbo",
            properties: {
              agentConfig: {
                reportingThreshold: 1,
                categories: ["Boredom", "Confusion"],
              },
            },
          },
        ],
        messageCount: 10,
      },
    ];

    (RetrieveData as jest.Mock)
      .mockResolvedValueOnce(mockConversations)
      .mockResolvedValueOnce({ ...mockConversations[0] });

    await act(async () => {
      render(<ExperimentCreationForm token="test-token" />);
    });

    await selectFromDropdown(user, "Base Conversation", /Base Event/i);

    // Select an agent (note label is "Agents" in experiment mode)
    await selectFromDropdown(user, "Agents", /Back Channel Insights/i);

    await waitFor(() => {
      expect(screen.getByLabelText(/Experiment Name/i)).toBeInTheDocument();
      expect(screen.getByText("Agent Configuration")).toBeInTheDocument();
    });
  });

  // TODO Fix this failure - doesn't seem to be setting experiment name properly
  it.skip("submits experiment data correctly", async () => {
    const user = userEvent.setup();
    const mockConversations = [
      {
        id: "conv-123",
        name: "Base Event",
        agents: [
          {
            _id: "agent-123",
            agentType: "backChannelMetrics",
            llmPlatform: "openai",
            llmModel: "gpt-4-turbo",
          },
        ],
        messageCount: 10,
      },
    ];

    const mockExperimentData = {
      id: "exp-123",
      name: "New Experiment",
      baseConversation: "conv-123",
    };

    (RetrieveData as jest.Mock)
      .mockResolvedValueOnce(mockConversations)
      .mockResolvedValueOnce({ ...mockConversations[0] });

    (SendData as jest.Mock).mockResolvedValue(mockExperimentData);

    await act(async () => {
      render(<ExperimentCreationForm token="test-token" />);
    });

    // Select conversation to trigger experiment form rendering
    await selectFromDropdown(user, "Base Conversation", /Base Event/i);

    // Select an agent
    await selectFromDropdown(user, "Agents", /Back Channel Insights/i);

    const nameInput = await screen.findByLabelText(/Experiment Name/i);
    await user.type(nameInput, "New Experiment");

    // Wait for the button to actually render
    // Have to use hidden here because of MUI portal loading
    const submitButton = await screen.findByRole("button", {
      name: /create experiment/i,
      hidden: true,
    });
    await user.click(submitButton);

    await waitFor(() => {
      expect(SendData).toHaveBeenCalledWith(
        "experiments",
        expect.objectContaining({
          name: "New Experiment",
          baseConversation: "conv-123",
          agentModifications: expect.any(Array),
        })
      );
    });
  });

  it("displays error when base conversation has no agents", async () => {
    const user = userEvent.setup();
    const mockConversations = [
      {
        id: "conv-123",
        name: "Empty Event",
        agents: [],
        messageCount: 10,
      },
    ];

    (RetrieveData as jest.Mock)
      .mockResolvedValueOnce(mockConversations)
      .mockResolvedValueOnce({ ...mockConversations[0] });

    await act(async () => {
      render(<ExperimentCreationForm token="test-token" />);
    });

    const conversationSelect = await screen.findByLabelText(
      "Base Conversation"
    );
    await user.click(conversationSelect);

    const option = screen.getByText(/Empty Event/);
    await user.click(option);

    await waitFor(() => {
      expect(
        screen.getByText("Conversation has no agents, select another.")
      ).toBeInTheDocument();
    });
  });
});
