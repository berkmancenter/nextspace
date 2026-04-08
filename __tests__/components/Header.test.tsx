import React from "react";
import { render, screen } from "@testing-library/react";
import { Header } from "../../components/Header";
import { useRouter } from "next/router";

jest.mock("next/router", () => ({ useRouter: jest.fn() }));
jest.mock("next/link", () => ({ __esModule: true, default: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
jest.mock("@mui/icons-material/Event", () => ({ __esModule: true, default: () => <svg /> }));
jest.mock("@mui/icons-material/AddCircleOutline", () => ({ __esModule: true, default: () => <svg /> }));
jest.mock("@mui/icons-material/Login", () => ({ __esModule: true, default: () => <svg /> }));
jest.mock("@mui/icons-material/Logout", () => ({ __esModule: true, default: () => <svg /> }));
jest.mock("@mui/icons-material/FeedbackOutlined", () => ({ __esModule: true, default: () => <svg /> }));
jest.mock("@mui/icons-material", () => ({ Close: () => <svg />, Menu: () => <svg /> }));
jest.mock("../../components/QuickGuideIconButton", () => ({
  QuickGuideIconButton: () => <div data-testid="quick-guide-button" />,
}));
jest.mock("../../components/Logo", () => ({
  __esModule: true,
  Logo: () => <div />,
  default: () => <div />,
}));
jest.mock("../../utils", () => ({ Api: {} }));

const mockUseRouter = useRouter as jest.Mock;

const baseRouter = {
  pathname: "/",
  asPath: "/",
  isReady: true,
  events: { on: jest.fn(), off: jest.fn() },
};

describe("Header — QuickGuideIconButton visibility", () => {
  beforeEach(() => jest.clearAllMocks());

  it("renders QuickGuideIconButton on an event page (URL contains conversationId)", () => {
    mockUseRouter.mockReturnValue({
      ...baseRouter,
      pathname: "/assistant",
      asPath: "/assistant?conversationId=abc123",
    });
    render(<Header />);
    // Both mobile and desktop branches render in jsdom (no CSS applied), so two instances appear
    expect(screen.getAllByTestId("quick-guide-button").length).toBeGreaterThan(0);
  });

  it("does not render QuickGuideIconButton on the home page", () => {
    mockUseRouter.mockReturnValue(baseRouter);
    render(<Header />);
    expect(screen.queryByTestId("quick-guide-button")).not.toBeInTheDocument();
  });

  it("does not render QuickGuideIconButton on the login page", () => {
    mockUseRouter.mockReturnValue({
      ...baseRouter,
      pathname: "/login",
      asPath: "/login",
    });
    render(<Header />);
    expect(screen.queryByTestId("quick-guide-button")).not.toBeInTheDocument();
  });

  it("renders QuickGuideIconButton on the moderator event page", () => {
    mockUseRouter.mockReturnValue({
      ...baseRouter,
      pathname: "/moderator",
      asPath: "/moderator?conversationId=xyz789",
    });
    render(<Header />);
    expect(screen.getAllByTestId("quick-guide-button").length).toBeGreaterThan(0);
  });
});
