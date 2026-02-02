import React, { act } from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { RetrieveData, SendData } from "../../../utils";
import { EventStatus } from "../../../components";
import { components } from "../../../types";
import userEvent from "@testing-library/user-event";
import { Conversation } from "../../../types.internal";
import { platform } from "os";

// Mock the SendData utility
jest.mock("../../../utils", () => ({
  RetrieveData: jest.fn(),
  SendData: jest.fn(),
}));

// Mock window.location
const mockLocation = {
  protocol: "http:",
  host: "localhost:8080",
};
Object.defineProperty(window, "location", {
  value: mockLocation,
  writable: true,
});

describe("EventStatus", () => {
  const mockConversationData: Conversation = {
    id: "conv-123",
    name: "Test Event",
    active: false,
    locked: false,
    slug: "test-event",
    topic: {
      name: "Test Topic",
      conversations: [],
      votingAllowed: false,
      owner: { username: "user1", password: "foo", pseudonyms: [] },
      conversationCreationAllowed: false,
      private: false,
      archivable: false,
      followers: [],
    },
    owner: { username: "user1", password: "foo", pseudonyms: [] },
    createdAt: "2025-10-17T00:00:00Z",
    channels: [{ name: "transcript", passcode: "trans-pass", direct: false }],
    agents: [
      {
        agentType: "eventAssistant",
        name: "Event Assistant",
        description: "Assists",
        pseudonyms: [],
        llmPlatform: "openai",
        llmModel: "gpt-4",
        conversation: "conv-123",
      },
    ],
    followed: undefined,
    messageCount: 10,
    adapters: [],
    messages: [],
    followers: [],
    enableDMs: [],
    experiments: [],
    eventUrls: {
      moderator: [
        {
          label: "Event Assistant Display",
          url: "http://localhost:8080/assistant/?conversationId=conv-123",
        },
      ],
      participant: [
        {
          label: "Fake Participant Link",
          url: "http://localhost:8080/fake/?conversationId=conv-123",
        },
      ],
    },
    type: {
      name: "eventAssistant",
      label: "Event Assistant",
      description: "An assistant to answer questions about an event",
      platforms: [],
      properties: [],
    },
  };

  const conversationTypes: components["schemas"]["ConversationType"][] = [
    {
      name: "backChannel",
      label: "Back Channel",
      description: "An agent to analyze participant comments",
      platforms: [],
      properties: [],
    },
    {
      name: "eventAssistant",
      label: "Event Assistant",
      description: "An assistant to answer questions about an event",
      platforms: [],
      properties: [],
    },
  ];
  const mockConfig = {
    conversationTypes,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (SendData as jest.Mock).mockResolvedValue({ success: true });
    (RetrieveData as jest.Mock).mockResolvedValue(mockConfig);
  });

  it("renders the component with correct initial status and URLs", () => {
    render(<EventStatus conversationData={mockConversationData} />);

    expect(screen.getByText("Event Status")).toBeInTheDocument();
    expect(
      screen.getByText(/Event 'Test Event' includes the Event Assistant/)
    ).toBeInTheDocument();
    expect(
      screen.getByText("The event is currently not started.")
    ).toBeInTheDocument();

    const moderatorLink = screen.getByRole("link", {
      name: /http:\/\/localhost:8080\/assistant\/\?conversationId=conv-123/i,
    });
    expect(moderatorLink).toBeInTheDocument();
    expect(moderatorLink).toHaveAttribute(
      "href",
      "http://localhost:8080/assistant/?conversationId=conv-123"
    );
    const participantLink = screen.getByRole("link", {
      name: /http:\/\/localhost:8080\/fake\/\?conversationId=conv-123/i,
    });
    expect(participantLink).toBeInTheDocument();
    expect(participantLink).toHaveAttribute(
      "href",
      "http://localhost:8080/fake/?conversationId=conv-123"
    );
  });

  it("renders type labels correctly with platforms", () => {
    const conversationWithPlatforms = {
      ...mockConversationData,
      platforms: ["production", "staging"],
      platformTypes: [
        { name: "production", label: "Production" },
        { name: "staging", label: "Staging" },
      ],
    };
    render(<EventStatus conversationData={conversationWithPlatforms} />);

    expect(
      screen.getByText(
        /Event 'Test Event' includes the Event Assistant in Production and Staging/
      )
    ).toBeInTheDocument();
  });

  it("shows 'Start Event' button when conditions are met", () => {
    render(<EventStatus conversationData={mockConversationData} />);
    expect(
      screen.getByRole("button", { name: "Start Event" })
    ).toBeInTheDocument();
  });

  it("does not show 'Start Event' button if event is already active", () => {
    render(
      <EventStatus
        conversationData={{ ...mockConversationData, active: true }}
      />
    );
    expect(
      screen.queryByRole("button", { name: "Start Event" })
    ).not.toBeInTheDocument();
  });

  it("calls SendData and updates status on 'Start Event' button click", async () => {
    const user = userEvent.setup();
    render(<EventStatus conversationData={mockConversationData} />);

    const startButton = screen.getByRole("button", { name: "Start Event" });

    await user.click(startButton);

    await waitFor(() => {
      expect(
        screen.getByText("The event is currently active.")
      ).toBeInTheDocument();
      expect(screen.getByText("The event has started!")).toBeInTheDocument();
      expect(startButton).not.toBeInTheDocument();
      expect(SendData).toHaveBeenCalledWith("conversations/conv-123/start", {});
    });
  });

  it("handles API error when starting an event", async () => {
    const consoleErrorSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});
    (SendData as jest.Mock).mockRejectedValue(new Error("API Error"));

    render(<EventStatus conversationData={mockConversationData} />);

    const startButton = screen.getByRole("button", { name: "Start Event" });
    await act(async () => {
      fireEvent.click(startButton);
    });

    await waitFor(() => {
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Error sending data:",
        expect.any(Error)
      );
      expect(
        screen.getByText("The event is currently not started.")
      ).toBeInTheDocument();
      expect(
        screen.queryByText("The event has started!")
      ).not.toBeInTheDocument();
    });

    consoleErrorSpy.mockRestore();
  });

  it("displays active status if conversationData.active is true initially", () => {
    render(
      <EventStatus
        conversationData={{ ...mockConversationData, active: true }}
      />
    );
    expect(
      screen.getByText("The event is currently active.")
    ).toBeInTheDocument();
  });
});
