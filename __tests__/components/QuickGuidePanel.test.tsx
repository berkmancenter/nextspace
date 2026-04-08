import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { QuickGuideIconButton } from "../../components/QuickGuideIconButton";
import { QuickGuidePanelContent } from "../../components/QuickGuidePanel";
import { ConversationTypeProvider } from "../../context/ConversationTypeContext";

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

describe("QuickGuidePanelContent — command filtering by conversation type", () => {
  function renderContent(conversationType: string | null) {
    return render(
      <ConversationTypeProvider initialValue={conversationType}>
        <QuickGuidePanelContent headingId="test-heading" />
      </ConversationTypeProvider>
    );
  }

  it("hides the commands section and its heading when conversation type is not yet known", () => {
    renderContent(null);
    expect(screen.queryByText("Slash Commands & Features")).not.toBeInTheDocument();
    expect(screen.queryByText("/mod")).not.toBeInTheDocument();
    expect(screen.queryByText("/mindmap")).not.toBeInTheDocument();
    expect(screen.queryByText("/visual")).not.toBeInTheDocument();
  });

  it("hides commands not available for the current conversation type", () => {
    // eventAssistant does not include /mod (restricted to Plus variants)
    renderContent("eventAssistant");
    expect(screen.queryByText("/mod")).not.toBeInTheDocument();
  });

  it("shows commands available for the current conversation type", () => {
    renderContent("eventAssistant");
    expect(screen.getByText("/mindmap")).toBeInTheDocument();
    expect(screen.getByText("/visual")).toBeInTheDocument();
  });

  it("shows all restricted commands when the type includes them", () => {
    renderContent("eventAssistantPlus");
    expect(screen.getByText("/mod")).toBeInTheDocument();
    expect(screen.getByText("/mindmap")).toBeInTheDocument();
    expect(screen.getByText("/visual")).toBeInTheDocument();
  });
});
