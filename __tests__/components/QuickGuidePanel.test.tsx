import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { QuickGuideIconButton } from "../../components/QuickGuideIconButton";
import { QuickGuidePanelContent } from "../../components/QuickGuidePanel";
import { ConversationTypeProvider, ConversationType } from "../../context/ConversationTypeContext";
import { components } from "../../types";

type FeatureConfig = components["schemas"]["FeatureConfig"];

// Control the desktop/mobile breakpoint in tests
jest.mock("@mui/material", () => ({
  ...jest.requireActual("@mui/material"),
  useMediaQuery: jest.fn(),
}));

// Stub next/router — QuickGuideIconButton subscribes to route change events
jest.mock("next/router", () => ({
  useRouter: () => ({
    events: { on: jest.fn(), off: jest.fn() },
  }),
}));

const { useMediaQuery } = jest.requireMock("@mui/material") as {
  useMediaQuery: jest.Mock;
};

function renderButton() {
  return render(<QuickGuideIconButton />);
}

describe("QuickGuideIconButton trigger", () => {
  beforeEach(() => {
    useMediaQuery.mockReturnValue(true); // default to desktop
  });

  it("renders the trigger button", () => {
    renderButton();
    expect(
      screen.getByRole("button", { name: /quick guide/i })
    ).toBeInTheDocument();
  });

  it("has aria-haspopup='dialog' on the trigger", () => {
    renderButton();
    const btn = screen.getByRole("button", { name: /quick guide/i });
    expect(btn).toHaveAttribute("aria-haspopup", "dialog");
  });

  it("has aria-expanded=false when closed", () => {
    renderButton();
    const btn = screen.getByRole("button", { name: /quick guide/i });
    expect(btn).toHaveAttribute("aria-expanded", "false");
  });

  it("has aria-expanded=true after opening", async () => {
    const user = userEvent.setup();
    renderButton();
    const btn = screen.getByRole("button", { name: /quick guide/i });
    await user.click(btn);
    expect(btn).toHaveAttribute("aria-expanded", "true");
  });
});

describe("QuickGuidePanel — desktop (Popover)", () => {
  beforeEach(() => {
    useMediaQuery.mockReturnValue(true); // isDesktop = true
  });

  async function openPanel() {
    const user = userEvent.setup();
    const { container } = renderButton();
    await user.click(screen.getByRole("button", { name: /quick guide/i }));
    return container;
  }

  it("shows a 'Quick Guide' heading when open", async () => {
    await openPanel();
    expect(screen.getByRole("heading", { name: /quick guide/i })).toBeInTheDocument();
  });

  it("has role='dialog' on the panel", async () => {
    await openPanel();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("aria-labelledby points to the visible Quick Guide heading", async () => {
    await openPanel();
    const dialog = screen.getByRole("dialog");
    const labelId = dialog.getAttribute("aria-labelledby");
    expect(labelId).toBeTruthy();
    const heading = document.getElementById(labelId!);
    expect(heading).toBeInTheDocument();
    expect(heading).toHaveTextContent(/quick guide/i);
  });

  it("has no axe accessibility violations", async () => {
    const container = await openPanel();
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

describe("QuickGuidePanel — mobile (Dialog)", () => {
  beforeEach(() => {
    useMediaQuery.mockReturnValue(false); // isDesktop = false
  });

  async function openPanel() {
    const user = userEvent.setup();
    const { container } = renderButton();
    await user.click(screen.getByRole("button", { name: /quick guide/i }));
    return container;
  }

  it("shows a 'Quick Guide' heading when open", async () => {
    await openPanel();
    expect(screen.getByRole("heading", { name: /quick guide/i })).toBeInTheDocument();
  });

  it("has a close button", async () => {
    await openPanel();
    expect(screen.getByRole("button", { name: /close/i })).toBeInTheDocument();
  });

  it("has no axe accessibility violations", async () => {
    const container = await openPanel();
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

// ---------------------------------------------------------------------------
// Shared helpers — renders QuickGuidePanelContent with the given conversation
// type and optional bot name pre-loaded into context.
// ---------------------------------------------------------------------------

// Minimal feature sets used across tests. Descriptions are chosen to satisfy
// the text-content assertions in the features-section describe block below.
const eventAssistantFeatures: FeatureConfig[] = [
  {
    name: "mindmap",
    label: "Mind Map",
    tab: "assistant",
    audience: "participant",
    slashCommand: "mindmap",
    default: true,
    agents: [],
    description: "Create a visual mind map of the key topics discussed in the event",
  },
  {
    name: "visual",
    label: "Visual Response",
    tab: "assistant",
    audience: "participant",
    slashCommand: "visual",
    default: true,
    agents: [],
    participantDescription: 'Request a visual response. Requires the "Visuals" preference to be enabled in your settings.',
  },
  {
    name: "jargonFilter",
    label: "Jargon Filter",
    tab: "assistant",
    audience: "participant",
    default: true,
    agents: [],
    description: "Automatically explains jargon and technical terms used by speakers.",
  },
];

const eventAssistantPlusFeatures: FeatureConfig[] = [
  ...eventAssistantFeatures,
  {
    name: "mod",
    label: "Submit to Moderator",
    tab: "group-chat",
    audience: "participant",
    slashCommand: "mod",
    default: true,
    agents: [],
    description: "Submit a question to the moderator",
  },
];

/* Feature set that includes a moderator-only entry, used to verify audience filtering. */
const featuresWithModeratorEntry: FeatureConfig[] = [
  ...eventAssistantPlusFeatures,
  {
    name: "modDashboard",
    label: "Moderator Dashboard",
    tab: "group-chat",
    audience: "moderator",
    default: true,
    agents: [],
    description: "A private dashboard visible only to moderators.",
  },
];

/** Builds a minimal ConversationType object for use in tests. */
function makeConversationType(name: string, features: FeatureConfig[] = []): ConversationType {
  return { name, description: "", platforms: [], properties: [], features };
}

function renderContent(
  conversationType: ConversationType | null,
  { botName }: { botName?: string } = {}
) {
  return render(
    <ConversationTypeProvider
      initialValue={conversationType}
      initialBotName={botName}
    >
      <QuickGuidePanelContent headingId="test-heading" />
    </ConversationTypeProvider>
  );
}

describe("QuickGuidePanelContent — What's New section", () => {
  const realDateNow = Date.now;

  afterEach(() => {
    Date.now = realDateNow;
  });

  it("shows the What's New section when entries fall within the window", () => {
    // Pin now to the release date of the Quick Guide entry (2026-04-10)
    Date.now = jest.fn(() => new Date("2026-04-10").getTime());
    renderContent(null);
    expect(screen.getByRole("region", { name: /what's new/i })).toBeInTheDocument();
  });

  it("hides the What's New section when no entries fall within the window", () => {
    // Pin now far beyond the 14-day window of all current entries
    Date.now = jest.fn(() => new Date("2026-06-01").getTime());
    renderContent(null);
    expect(screen.queryByRole("region", { name: /what's new/i })).not.toBeInTheDocument();
  });
});

describe("QuickGuidePanelContent — features section", () => {
  it("hides the features section when conversation type is not yet known", () => {
    renderContent(null);
    expect(screen.queryByRole("region", { name: /features/i })).not.toBeInTheDocument();
    expect(screen.queryByText("/mod")).not.toBeInTheDocument();
    expect(screen.queryByText("/mindmap")).not.toBeInTheDocument();
    expect(screen.queryByText("/visual")).not.toBeInTheDocument();
    expect(screen.queryByText("Jargon Filter")).not.toBeInTheDocument();
  });

  it("hides /mod for event types that don't include it", () => {
    // /mod is restricted to Plus variants only
    renderContent(makeConversationType("eventAssistant", eventAssistantFeatures));
    expect(screen.queryByText("/mod")).not.toBeInTheDocument();
  });

  it("shows slash commands available for the current event type", () => {
    renderContent(makeConversationType("eventAssistant", eventAssistantFeatures));
    expect(screen.getByText("/mindmap")).toBeInTheDocument();
    expect(screen.getByText("/visual")).toBeInTheDocument();
  });

  it("shows all slash commands when the event type includes them all", () => {
    renderContent(makeConversationType("eventAssistantPlus", eventAssistantPlusFeatures));
    expect(screen.getByText("/mod")).toBeInTheDocument();
    expect(screen.getByText("/mindmap")).toBeInTheDocument();
    expect(screen.getByText("/visual")).toBeInTheDocument();
  });

  it("shows the preference note beneath the /visual command", () => {
    renderContent(makeConversationType("eventAssistant", eventAssistantFeatures));
    expect(
      screen.getByText(/Requires the "Visuals" preference/i)
    ).toBeInTheDocument();
  });

  it("shows assistant features for the current event type", () => {
    renderContent(makeConversationType("eventAssistant", eventAssistantFeatures));
    expect(screen.getByText("Jargon Filter")).toBeInTheDocument();
  });

  it("hides assistant features when conversation type is not yet known", () => {
    renderContent(null);
    expect(screen.queryByText("Jargon Filter")).not.toBeInTheDocument();
  });

  it("uses the bot name from context as the assistant subsection label", () => {
    renderContent(makeConversationType("eventAssistant", eventAssistantFeatures), { botName: "Sparkle" });
    // Bot name appears in the tab section label and in each assistant-tab badge
    expect(screen.getAllByText("Sparkle").length).toBeGreaterThan(0);
  });

  it("falls back to 'Berkie' when no bot name is set in context", () => {
    renderContent(makeConversationType("eventAssistant", eventAssistantFeatures));
    // Bot name appears in the tab section label and in each assistant-tab badge
    expect(screen.getAllByText("Berkie").length).toBeGreaterThan(0);
  });

  it("shows a 'Group Chat' tab indicator for /mod", () => {
    renderContent(makeConversationType("eventAssistantPlus", eventAssistantPlusFeatures));
    expect(screen.getByLabelText(/available in group chat/i)).toBeInTheDocument();
  });

  it("shows a bot tab indicator for /mindmap using the bot name", () => {
    renderContent(makeConversationType("eventAssistant", eventAssistantFeatures), { botName: "Sparkle" });
    // All assistant-tab features share the same label, so check at least one exists
    expect(screen.getAllByLabelText(/available in sparkle/i).length).toBeGreaterThan(0);
  });

  it("shows a bot tab indicator for /visual", () => {
    renderContent(makeConversationType("eventAssistant", eventAssistantFeatures));
    const indicators = screen.getAllByLabelText(/available in berkie/i);
    // /mindmap, /visual, and Jargon Filter all live in the bot tab
    expect(indicators.length).toBeGreaterThanOrEqual(2);
  });

  it("shows a bot tab indicator for assistant features", () => {
    renderContent(makeConversationType("eventAssistant", eventAssistantFeatures), { botName: "Sparkle" });
    const indicators = screen.getAllByLabelText(/available in sparkle/i);
    expect(indicators.length).toBeGreaterThanOrEqual(1);
  });

  it("hides features with audience 'moderator' from the panel", () => {
    renderContent(makeConversationType("eventAssistantPlus", featuresWithModeratorEntry));
    // The moderator-only entry must not appear anywhere in the panel
    expect(screen.queryByText("Moderator Dashboard")).not.toBeInTheDocument();
    expect(screen.queryByText("A private dashboard visible only to moderators.")).not.toBeInTheDocument();
  });

  it("renders separate tab sections for assistant and chat features", () => {
    renderContent(makeConversationType("eventAssistantPlus", eventAssistantPlusFeatures));
    // The assistant tab section label (overline) and its feature badges all show the bot name;
    // at least one instance must exist
    expect(screen.getAllByText("Berkie").length).toBeGreaterThan(0);
    // The chat tab section renders its own section label
    expect(screen.getAllByText("Group Chat").length).toBeGreaterThan(0);
    // Both tabs appear, so the panel must contain features from each
    expect(screen.getByText("/mod")).toBeInTheDocument();
    expect(screen.getByText("/mindmap")).toBeInTheDocument();
  });
});
