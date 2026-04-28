import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import GuidePage from "../../pages/guide/[conversationId]";

jest.mock("next/router", () => ({
  useRouter: () => ({
    query: { conversationId: "test-conv-id" },
    isReady: true,
  }),
}));

jest.mock("../../content/whatsNew", () => ({
  getRecentEntries: jest.fn(() => []),
}));

const mockFetch = jest.fn();
global.fetch = mockFetch;

const GUIDE_RESPONSE = {
  conversationType: "eventAssistantPlus",
  conversationBotName: "TestBot",
  features: [
    {
      name: "mindmap",
      label: "Mind Map",
      tab: "assistant",
      audience: "participant",
      slashCommand: "mindmap",
      userControlled: true,
      default: true,
      agents: [],
      participantDescription: "Generate a visual mind map.",
    },
    {
      name: "jargonFilter",
      label: "Jargon Filter",
      tab: "assistant",
      audience: "participant",
      userControlled: true,
      default: true,
      agents: [],
      participantDescription: "Explains jargon automatically.",
    },
    {
      name: "collectiveVoice",
      label: "Collective Voice",
      tab: "group-chat",
      audience: "participant",
      userControlled: false,
      default: true,
      agents: [],
      participantDescription: "Surfaces what participants are thinking.",
    },
    {
      name: "librarian",
      label: "Reading Recommendations",
      tab: "resources",
      audience: "participant",
      userControlled: false,
      default: true,
      agents: [],
      participantDescription: "Periodically recommends relevant reading.",
    },
  ],
};

function resolveWith(data: object) {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => data,
  } as unknown as Response);
}

function rejectWith(status: number) {
  mockFetch.mockResolvedValueOnce({ ok: false, status } as unknown as Response);
}

describe("GuidePage", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    process.env.NEXT_PUBLIC_API_URL = "http://localhost:3000/v1";
  });

  it("shows a loading spinner before the fetch resolves", () => {
    mockFetch.mockReturnValueOnce(new Promise(() => {}));
    render(<GuidePage />);
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  });

  it("shows an error message on 404", async () => {
    rejectWith(404);
    render(<GuidePage />);
    await waitFor(() =>
      expect(screen.getByText("Conversation not found.")).toBeInTheDocument()
    );
  });

  it("fetches from the correct endpoint", async () => {
    resolveWith(GUIDE_RESPONSE);
    render(<GuidePage />);
    await waitFor(() =>
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3000/v1/conversations/test-conv-id/guide?audience=participant"
      )
    );
  });

  it("uses conversationBotName as the assistant tab section heading", async () => {
    resolveWith(GUIDE_RESPONSE);
    render(<GuidePage />);
    await waitFor(() =>
      expect(screen.getByRole("region", { name: "TestBot" })).toBeInTheDocument()
    );
  });

  it("renders slash commands under the commands tier", async () => {
    resolveWith(GUIDE_RESPONSE);
    render(<GuidePage />);
    await waitFor(() => expect(screen.getByText("/mindmap")).toBeInTheDocument());
  });

  it("renders user-controlled passive features under the settings tier", async () => {
    resolveWith(GUIDE_RESPONSE);
    render(<GuidePage />);
    await waitFor(() => {
      expect(screen.getByText("Jargon Filter")).toBeInTheDocument();
      expect(screen.getByText(/your settings/i)).toBeInTheDocument();
    });
  });

  it("renders always-active features under the automatic tier", async () => {
    resolveWith(GUIDE_RESPONSE);
    render(<GuidePage />);
    await waitFor(() => {
      expect(screen.getByText("Collective Voice")).toBeInTheDocument();
      expect(screen.getAllByText(/always active/i).length).toBeGreaterThan(0);
    });
  });

  it("renders the Resources tab section for librarian features", async () => {
    resolveWith(GUIDE_RESPONSE);
    render(<GuidePage />);
    await waitFor(() => {
      expect(screen.getByRole("region", { name: "Resources" })).toBeInTheDocument();
      expect(screen.getByText("Reading Recommendations")).toBeInTheDocument();
    });
  });

  it("falls back to 'Berkie' when conversationBotName is absent", async () => {
    resolveWith({ ...GUIDE_RESPONSE, conversationBotName: undefined });
    render(<GuidePage />);
    await waitFor(() =>
      expect(screen.getByRole("region", { name: "Berkie" })).toBeInTheDocument()
    );
  });
});
