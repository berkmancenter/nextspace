import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { HelpIconButton } from "../../components/HelpIconButton";

// Control the desktop/mobile breakpoint in tests
jest.mock("@mui/material", () => ({
  ...jest.requireActual("@mui/material"),
  useMediaQuery: jest.fn(),
}));

// Stub next/router — HelpIconButton subscribes to route change events
jest.mock("next/router", () => ({
  useRouter: () => ({
    events: { on: jest.fn(), off: jest.fn() },
  }),
}));

const { useMediaQuery } = jest.requireMock("@mui/material") as {
  useMediaQuery: jest.Mock;
};

function renderButton() {
  return render(<HelpIconButton />);
}

describe("HelpIconButton trigger", () => {
  beforeEach(() => {
    useMediaQuery.mockReturnValue(true); // default to desktop
  });

  it("renders the trigger button", () => {
    renderButton();
    expect(
      screen.getByRole("button", { name: /help/i })
    ).toBeInTheDocument();
  });

  it("has aria-haspopup='dialog' on the trigger", () => {
    renderButton();
    const btn = screen.getByRole("button", { name: /help/i });
    expect(btn).toHaveAttribute("aria-haspopup", "dialog");
  });

  it("has aria-expanded=false when closed", () => {
    renderButton();
    const btn = screen.getByRole("button", { name: /help/i });
    expect(btn).toHaveAttribute("aria-expanded", "false");
  });

  it("has aria-expanded=true after opening", async () => {
    const user = userEvent.setup();
    renderButton();
    const btn = screen.getByRole("button", { name: /help/i });
    await user.click(btn);
    expect(btn).toHaveAttribute("aria-expanded", "true");
  });
});

describe("HelpPanel — desktop (Popover)", () => {
  beforeEach(() => {
    useMediaQuery.mockReturnValue(true); // isDesktop = true
  });

  async function openPanel() {
    const user = userEvent.setup();
    const { container } = renderButton();
    await user.click(screen.getByRole("button", { name: /help/i }));
    return container;
  }

  it("shows a 'Help' heading when open", async () => {
    await openPanel();
    expect(screen.getByRole("heading", { name: /help/i })).toBeInTheDocument();
  });

  it("has role='dialog' on the panel", async () => {
    await openPanel();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("aria-labelledby points to the visible Help heading", async () => {
    await openPanel();
    const dialog = screen.getByRole("dialog");
    const labelId = dialog.getAttribute("aria-labelledby");
    expect(labelId).toBeTruthy();
    const heading = document.getElementById(labelId!);
    expect(heading).toBeInTheDocument();
    expect(heading).toHaveTextContent(/help/i);
  });

  it("has no axe accessibility violations", async () => {
    const container = await openPanel();
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

describe("HelpPanel — mobile (Dialog)", () => {
  beforeEach(() => {
    useMediaQuery.mockReturnValue(false); // isDesktop = false
  });

  async function openPanel() {
    const user = userEvent.setup();
    const { container } = renderButton();
    await user.click(screen.getByRole("button", { name: /help/i }));
    return container;
  }

  it("shows a 'Help' heading when open", async () => {
    await openPanel();
    expect(screen.getByRole("heading", { name: /help/i })).toBeInTheDocument();
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
