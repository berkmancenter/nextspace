import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { axe } from "jest-axe";
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
      category: "assistant",
      slashCommand: "mindmap",
      userControlled: true,
      default: true,
      enabled: true,
      agents: [],
      description: "Generate a visual mind map.",
    },
    {
      name: "jargonFilter",
      label: "Jargon Filter",
      category: "assistant",
      userControlled: true,
      default: true,
      enabled: true,
      agents: [],
      description: "Explains jargon automatically.",
    },
    {
      name: "collectiveVoice",
      label: "Collective Voice",
      category: "group-chat",
      userControlled: false,
      default: true,
      enabled: true,
      agents: [],
      description: "Surfaces what participants are thinking.",
    },
    {
      name: "librarian",
      label: "Reading Recommendations",
      category: "resources",
      userControlled: false,
      default: true,
      enabled: true,
      agents: [],
      description: "Periodically recommends relevant reading.",
    },
  ],
};

// userControlled: true + enabled: false → "Not available" pill
const GUIDE_RESPONSE_WITH_DISABLED = {
  ...GUIDE_RESPONSE,
  features: [
    ...GUIDE_RESPONSE.features.slice(0, 1),
    {
      name: "jargonFilter",
      label: "Jargon Filter",
      category: "assistant",
      userControlled: true,
      default: true,
      enabled: false,
      agents: [],
      description: "Explains jargon automatically.",
    },
    ...GUIDE_RESPONSE.features.slice(2),
  ],
};

// slashCommand + enabled: false → "Not available" pill per row
const GUIDE_RESPONSE_WITH_DISABLED_SLASH = {
  ...GUIDE_RESPONSE,
  features: [
    {
      name: "mindmap",
      label: "Mind Map",
      category: "assistant",
      slashCommand: "mindmap",
      userControlled: true,
      default: true,
      enabled: false,
      agents: [],
      description: "Generate a visual mind map.",
    },
    ...GUIDE_RESPONSE.features.slice(1),
  ],
};

// userControlled: false + enabled: false → "Not available" pill
const GUIDE_RESPONSE_WITH_UNAVAILABLE = {
  ...GUIDE_RESPONSE,
  features: [
    ...GUIDE_RESPONSE.features.slice(0, 2),
    {
      name: "collectiveVoice",
      label: "Collective Voice",
      category: "group-chat",
      userControlled: false,
      default: true,
      enabled: false,
      agents: [],
      description: "Surfaces what participants are thinking.",
    },
    ...GUIDE_RESPONSE.features.slice(3),
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
      expect(screen.getByText("Conversation not found.")).toBeInTheDocument(),
    );
  });

  it("fetches from the correct endpoint", async () => {
    resolveWith(GUIDE_RESPONSE);
    render(<GuidePage />);
    await waitFor(() =>
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3000/v1/conversations/test-conv-id/features",
      ),
    );
  });

  it("uses conversationBotName as the assistant tab section heading", async () => {
    resolveWith(GUIDE_RESPONSE);
    render(<GuidePage />);
    await waitFor(() =>
      expect(
        screen.getByRole("region", { name: "TestBot" }),
      ).toBeInTheDocument(),
    );
  });

  it("renders slash commands under the commands tier", async () => {
    resolveWith(GUIDE_RESPONSE);
    render(<GuidePage />);
    await waitFor(() =>
      expect(screen.getByText("/mindmap")).toBeInTheDocument(),
    );
  });

  it("shows 'Active' pill for an enabled slash command", async () => {
    resolveWith(GUIDE_RESPONSE);
    render(<GuidePage />);
    await waitFor(() => {
      expect(screen.getByText("/mindmap")).toBeInTheDocument();
      // Multiple Active pills may exist (one per enabled slash command row)
      expect(screen.getAllByText("Active").length).toBeGreaterThan(0);
    });
  });

  it("shows 'Not available' pill for a disabled slash command", async () => {
    resolveWith(GUIDE_RESPONSE_WITH_DISABLED_SLASH);
    render(<GuidePage />);
    await waitFor(() => {
      expect(screen.getByText("/mindmap")).toBeInTheDocument();
      expect(screen.getByText("Not available")).toBeInTheDocument();
    });
  });

  it("marks a disabled slash command row with aria-disabled", async () => {
    resolveWith(GUIDE_RESPONSE_WITH_DISABLED_SLASH);
    render(<GuidePage />);
    await waitFor(() => {
      const row = screen.getByText("/mindmap").closest("[aria-disabled]");
      expect(row).toHaveAttribute("aria-disabled", "true");
    });
  });

  it("shows caveat when a slash command is disabled", async () => {
    resolveWith(GUIDE_RESPONSE_WITH_DISABLED_SLASH);
    render(<GuidePage />);
    await waitFor(() =>
      expect(
        screen.getByText(/feature availability varies by event/i),
      ).toBeInTheDocument(),
    );
  });

  it("renders user-controlled passive features with settings instructional text", async () => {
    resolveWith(GUIDE_RESPONSE);
    render(<GuidePage />);
    await waitFor(() => {
      expect(screen.getByText("Jargon Filter")).toBeInTheDocument();
      expect(
        screen.getByText(/you can change these settings/i),
      ).toBeInTheDocument();
    });
  });

  it("renders always-active features in the guide", async () => {
    resolveWith(GUIDE_RESPONSE);
    render(<GuidePage />);
    await waitFor(() => {
      expect(screen.getByText("Collective Voice")).toBeInTheDocument();
    });
  });

  it("renders the Resources tab section for librarian features", async () => {
    resolveWith(GUIDE_RESPONSE);
    render(<GuidePage />);
    await waitFor(() => {
      expect(
        screen.getByRole("region", { name: "Resources" }),
      ).toBeInTheDocument();
      expect(screen.getByText("Reading Recommendations")).toBeInTheDocument();
    });
  });

  it("falls back to 'Berkie' when conversationBotName is absent", async () => {
    resolveWith({ ...GUIDE_RESPONSE, conversationBotName: undefined });
    render(<GuidePage />);
    await waitFor(() =>
      expect(
        screen.getByRole("region", { name: "Berkie" }),
      ).toBeInTheDocument(),
    );
  });

  it("still renders a disabled feature (enabled:false) in the guide", async () => {
    resolveWith(GUIDE_RESPONSE_WITH_DISABLED);
    render(<GuidePage />);
    await waitFor(() =>
      expect(screen.getByText("Jargon Filter")).toBeInTheDocument(),
    );
  });

  it("shows 'Configurable' pill for an enabled user-controlled feature", async () => {
    resolveWith(GUIDE_RESPONSE);
    render(<GuidePage />);
    await waitFor(() => {
      expect(screen.getByText("Jargon Filter")).toBeInTheDocument();
      expect(screen.getByText("Configurable")).toBeInTheDocument();
    });
  });

  it("shows 'Not available' pill for a disabled user-controlled feature", async () => {
    resolveWith(GUIDE_RESPONSE_WITH_DISABLED);
    render(<GuidePage />);
    await waitFor(() => {
      expect(screen.getByText("Jargon Filter")).toBeInTheDocument();
      expect(screen.getByText("Not available")).toBeInTheDocument();
    });
  });

  it("shows 'Not available' pill for a disabled automatic feature", async () => {
    resolveWith(GUIDE_RESPONSE_WITH_UNAVAILABLE);
    render(<GuidePage />);
    await waitFor(() => {
      expect(screen.getByText("Collective Voice")).toBeInTheDocument();
      expect(screen.getAllByText("Not available").length).toBeGreaterThan(0);
    });
  });

  it("marks any disabled feature with aria-disabled", async () => {
    resolveWith(GUIDE_RESPONSE_WITH_DISABLED);
    render(<GuidePage />);
    await waitFor(() => {
      const row = screen.getByText("Jargon Filter").closest("[aria-disabled]");
      expect(row).toHaveAttribute("aria-disabled", "true");
    });
  });

  it("shows a caveat when a section has disabled features", async () => {
    resolveWith(GUIDE_RESPONSE_WITH_DISABLED);
    render(<GuidePage />);
    await waitFor(() =>
      expect(
        screen.getByText(/feature availability varies by event/i),
      ).toBeInTheDocument(),
    );
  });

  it("has no accessibility violations in the loaded state", async () => {
    resolveWith(GUIDE_RESPONSE);
    const { container } = render(<GuidePage />);
    await waitFor(() =>
      expect(
        screen.getByRole("region", { name: "TestBot" }),
      ).toBeInTheDocument(),
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it("has no accessibility violations when features are disabled", async () => {
    resolveWith(GUIDE_RESPONSE_WITH_UNAVAILABLE);
    const { container } = render(<GuidePage />);
    await waitFor(() =>
      expect(screen.getByText("Not available")).toBeInTheDocument(),
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
