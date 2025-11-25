import { render, screen, waitFor } from "@testing-library/react";
import { act } from "react";

import { Event } from "../../components";

// Mock next/router
jest.mock("next/router", () => ({
  useRouter: jest.fn(),
}));

describe("Event Component", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders EventAdminForm", async () => {
    await act(async () => {
      render(<Event />);
    });

    await waitFor(() => {
      expect(
        screen.getByText("Conversation Configuration")
      ).toBeInTheDocument();
    });
  });
});
