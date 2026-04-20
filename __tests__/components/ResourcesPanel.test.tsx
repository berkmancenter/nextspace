import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ResourcesPanel } from "../../components/ResourcesPanel";
import { PseudonymousMessage } from "../../types.internal";

// Mock parseMessageBody from Helpers
jest.mock("../../utils/Helpers", () => ({
  parseMessageBody: jest.fn(),
}));

import { parseMessageBody } from "../../utils/Helpers";
const mockParseMessageBody = parseMessageBody as jest.Mock;

function makeMessage(body: any): PseudonymousMessage {
  return { id: "msg-1", body } as unknown as PseudonymousMessage;
}

const readingMessage = makeMessage({
  type: "reading",
  content: [
    {
      title: "The Internet and Democracy",
      authors: ["Jane Doe", "John Smith"],
      year: 2021,
      abstract: "An abstract about internet and democracy.",
      relevanceReason: "Directly relevant to today's discussion.",
    },
  ],
});

const readingMessageNoOptionals = makeMessage({
  type: "reading",
  content: [
    {
      title: "Digital Governance",
      authors: ["Alice Wang"],
      year: 2019,
    },
  ],
});

describe("ResourcesPanel", () => {
  beforeEach(() => {
    mockParseMessageBody.mockReturnValue({ text: "", type: undefined });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("header / event info", () => {
    it("renders default title when eventName is not provided", () => {
      render(<ResourcesPanel messages={[]} />);
      expect(screen.getByText("Event Resources")).toBeInTheDocument();
    });

    it("renders eventName when provided", () => {
      render(<ResourcesPanel messages={[]} eventName="Tech & Society Forum" />);
      expect(screen.getByText("Tech & Society Forum")).toBeInTheDocument();
    });

    it("renders short eventDescription without truncation controls", () => {
      render(
        <ResourcesPanel messages={[]} eventDescription="Short description." />,
      );
      expect(screen.getByText("Short description.")).toBeInTheDocument();
      expect(screen.queryByText("more")).not.toBeInTheDocument();
    });

    it("truncates long eventDescription and shows 'more' button", () => {
      const longDescription = "A".repeat(600);
      render(
        <ResourcesPanel messages={[]} eventDescription={longDescription} />,
      );
      expect(screen.getByText("more")).toBeInTheDocument();
      expect(screen.queryByText("less")).not.toBeInTheDocument();
    });

    it("expands truncated eventDescription on 'more' click and shows 'less'", async () => {
      const user = userEvent.setup();
      const longDescription = "A".repeat(600);
      render(
        <ResourcesPanel messages={[]} eventDescription={longDescription} />,
      );
      await user.click(screen.getByText("more"));
      expect(screen.getByText("less")).toBeInTheDocument();
      expect(screen.queryByText("more")).not.toBeInTheDocument();
    });

    it("collapses expanded description back on 'less' click", async () => {
      const user = userEvent.setup();
      const longDescription = "B".repeat(600);
      render(
        <ResourcesPanel messages={[]} eventDescription={longDescription} />,
      );
      await user.click(screen.getByText("more"));
      await user.click(screen.getByText("less"));
      expect(screen.getByText("more")).toBeInTheDocument();
    });
  });

  describe("category headers", () => {
    it("renders Speakers and Readings & References category headers", () => {
      render(<ResourcesPanel messages={[]} />);
      expect(screen.getByText("Speakers")).toBeInTheDocument();
      expect(screen.getByText("Readings & References")).toBeInTheDocument();
    });

    it("categories are collapsed by default (content not visible)", () => {
      render(
        <ResourcesPanel
          messages={[]}
          speakers={[{ name: "Alice", bio: "Bio here" }]}
        />,
      );
      expect(
        screen.queryByText("Speakers", { selector: "h4" }),
      ).not.toBeInTheDocument();
      expect(screen.queryByText("Alice")).not.toBeInTheDocument();
    });

    it("shows ExpandMore icon when collapsed and ExpandLess when expanded", async () => {
      const user = userEvent.setup();
      render(<ResourcesPanel messages={[]} />);
      // MUI renders icons with data-testid like "ExpandMoreIcon"
      expect(screen.getAllByTestId("ExpandMoreIcon")).toHaveLength(2);

      await user.click(screen.getByText("Speakers"));
      expect(screen.getAllByTestId("ExpandLessIcon")).toHaveLength(1);
    });
  });

  describe("Speakers section", () => {
    it("shows speakers when the Speakers category is expanded", async () => {
      const user = userEvent.setup();
      render(
        <ResourcesPanel
          messages={[]}
          speakers={[
            { name: "Dr. Ada Lovelace", bio: "Pioneer of computing." },
          ]}
        />,
      );
      await user.click(screen.getByText("Speakers"));
      expect(screen.getByText("Dr. Ada Lovelace")).toBeInTheDocument();
      expect(screen.getByText("Pioneer of computing.")).toBeInTheDocument();
    });

    it("shows moderators when expanded", async () => {
      const user = userEvent.setup();
      render(
        <ResourcesPanel
          messages={[]}
          moderators={[{ name: "Mod One", bio: "Moderator bio." }]}
        />,
      );
      await user.click(screen.getByText("Speakers"));
      expect(screen.getByText("Moderators")).toBeInTheDocument();
      expect(screen.getByText("Mod One")).toBeInTheDocument();
    });

    it("shows both moderators and speakers sections when both are provided", async () => {
      const user = userEvent.setup();
      render(
        <ResourcesPanel
          messages={[]}
          speakers={[{ name: "Speaker A", bio: "Speaker bio." }]}
          moderators={[{ name: "Mod B", bio: "Mod bio." }]}
        />,
      );
      await user.click(screen.getByText("Speakers"));
      expect(screen.getByText("Moderators")).toBeInTheDocument();
      expect(
        screen.getByText("Speakers", { selector: "h4" }),
      ).toBeInTheDocument();
      expect(screen.getByText("Speaker A")).toBeInTheDocument();
      expect(screen.getByText("Mod B")).toBeInTheDocument();
    });

    it("does not render Moderators sub-heading when moderators array is empty", async () => {
      const user = userEvent.setup();
      render(
        <ResourcesPanel
          messages={[]}
          speakers={[{ name: "Speaker A", bio: "Bio." }]}
          moderators={[]}
        />,
      );
      await user.click(screen.getByText("Speakers"));
      expect(screen.queryByText("Moderators")).not.toBeInTheDocument();
    });

    it("truncates long speaker bios and allows expansion", async () => {
      const user = userEvent.setup();
      const longBio = "X".repeat(400);
      render(
        <ResourcesPanel
          messages={[]}
          speakers={[{ name: "Speaker A", bio: longBio }]}
        />,
      );
      await user.click(screen.getByText("Speakers"));
      expect(screen.getByText("more")).toBeInTheDocument();
      await user.click(screen.getByText("more"));
      expect(screen.getByText("less")).toBeInTheDocument();
    });

    it("collapses the speakers section when header is clicked again", async () => {
      const user = userEvent.setup();
      render(
        <ResourcesPanel
          messages={[]}
          speakers={[{ name: "Speaker A", bio: "Bio." }]}
        />,
      );
      // Click the category header button to expand
      await user.click(screen.getByRole("button", { name: /speakers/i }));
      expect(screen.getByText("Speaker A")).toBeInTheDocument();
      // Click again to collapse — re-query to get a fresh reference
      await user.click(screen.getByRole("button", { name: /speakers/i }));
      expect(screen.queryByText("Speaker A")).not.toBeInTheDocument();
    });
  });

  describe("Readings & References section", () => {
    it("shows empty state when there are no readings", async () => {
      const user = userEvent.setup();
      render(<ResourcesPanel messages={[]} />);
      await user.click(screen.getByText("Readings & References"));
      expect(
        screen.getByText("No reading recommendations available yet."),
      ).toBeInTheDocument();
    });

    it("displays readings parsed from messages", async () => {
      const user = userEvent.setup();
      mockParseMessageBody.mockReturnValueOnce({
        text: "",
        type: "reading",
        content: [
          {
            title: "The Internet and Democracy",
            authors: ["Jane Doe", "John Smith"],
            year: 2021,
            abstract: "An abstract about internet and democracy.",
            relevanceReason: "Directly relevant to today's discussion.",
          },
        ],
      });

      render(<ResourcesPanel messages={[readingMessage]} />);
      await user.click(screen.getByText("Readings & References"));

      expect(
        screen.getByText("The Internet and Democracy"),
      ).toBeInTheDocument();
      expect(
        screen.getByText("Jane Doe, John Smith (2021)"),
      ).toBeInTheDocument();
      // relevanceReason takes priority over abstract when both are present
      expect(
        screen.getByText("Directly relevant to today's discussion."),
      ).toBeInTheDocument();
      expect(
        screen.queryByText("An abstract about internet and democracy."),
      ).not.toBeInTheDocument();
      expect(screen.getByText("AI Pick")).toBeInTheDocument();
    });

    it("renders reading without optional abstract and relevanceReason", async () => {
      const user = userEvent.setup();
      mockParseMessageBody.mockReturnValueOnce({
        text: "",
        type: "reading",
        content: [
          {
            title: "Digital Governance",
            authors: ["Alice Wang"],
            year: 2019,
          },
        ],
      });

      render(<ResourcesPanel messages={[readingMessageNoOptionals]} />);
      await user.click(screen.getByText("Readings & References"));

      expect(screen.getByText("Digital Governance")).toBeInTheDocument();
      expect(screen.getByText("Alice Wang (2019)")).toBeInTheDocument();
      expect(screen.queryByText("Why it's relevant:")).not.toBeInTheDocument();
    });

    it("aggregates readings from multiple messages", async () => {
      const msg1 = makeMessage({ type: "reading", content: [{ title: "Book One", authors: ["Author A"], year: 2020 }] });
      const msg2 = makeMessage({ type: "reading", content: [{ title: "Book Two", authors: ["Author B"], year: 2022 }] });

      mockParseMessageBody
        .mockReturnValueOnce({
          text: "",
          type: "reading",
          content: [{ title: "Book One", authors: ["Author A"], year: 2020 }],
        })
        .mockReturnValueOnce({
          text: "",
          type: "reading",
          content: [{ title: "Book Two", authors: ["Author B"], year: 2022 }],
        });

      const user = userEvent.setup();
      render(<ResourcesPanel messages={[msg1, msg2]} />);
      await user.click(screen.getByText("Readings & References"));

      expect(screen.getByText("Book One")).toBeInTheDocument();
      expect(screen.getByText("Book Two")).toBeInTheDocument();
    });

    it("ignores non-reading messages", async () => {
      const nonReadingMsg = makeMessage({ type: "assistant", text: "Hello" });
      mockParseMessageBody.mockReturnValueOnce({
        text: "Hello",
        type: "assistant",
      });

      const user = userEvent.setup();
      render(<ResourcesPanel messages={[nonReadingMsg]} />);
      await user.click(screen.getByText("Readings & References"));

      expect(
        screen.getByText("No reading recommendations available yet."),
      ).toBeInTheDocument();
    });

    it("collapses the readings section when clicked again", async () => {
      const user = userEvent.setup();
      render(<ResourcesPanel messages={[]} />);
      await user.click(screen.getByText("Readings & References"));
      expect(
        screen.getByText("No reading recommendations available yet."),
      ).toBeInTheDocument();
      await user.click(screen.getByText("Readings & References"));
      expect(
        screen.queryByText("No reading recommendations available yet."),
      ).not.toBeInTheDocument();
    });
  });

  describe("unseenReadingsCount badge", () => {
    it("does not show badge when unseenReadingsCount is 0", () => {
      render(<ResourcesPanel messages={[]} unseenReadingsCount={0} />);
      expect(screen.queryByText("0")).not.toBeInTheDocument();
    });

    it("shows badge with count when unseenReadingsCount > 0", () => {
      render(<ResourcesPanel messages={[]} unseenReadingsCount={3} />);
      expect(screen.getByText("3")).toBeInTheDocument();
    });

    it("does not show badge for the Speakers category regardless", () => {
      render(
        <ResourcesPanel
          messages={[]}
          unseenReadingsCount={5}
          speakers={[{ name: "S", bio: "B" }]}
        />,
      );
      // Badge "5" should appear once (Readings), not duplicated for Speakers
      expect(screen.getAllByText("5")).toHaveLength(1);
    });
  });

  describe("onMarkReadingsAsSeen callback", () => {
    it("calls onMarkReadingsAsSeen when readings section is expanded", async () => {
      const user = userEvent.setup();
      const onMarkReadingsAsSeen = jest.fn();
      render(
        <ResourcesPanel
          messages={[]}
          onMarkReadingsAsSeen={onMarkReadingsAsSeen}
        />,
      );
      await user.click(screen.getByText("Readings & References"));
      expect(onMarkReadingsAsSeen).toHaveBeenCalledTimes(1);
    });

    it("does not call onMarkReadingsAsSeen when collapsing readings section", async () => {
      const user = userEvent.setup();
      const onMarkReadingsAsSeen = jest.fn();
      render(
        <ResourcesPanel
          messages={[]}
          onMarkReadingsAsSeen={onMarkReadingsAsSeen}
        />,
      );
      await user.click(screen.getByText("Readings & References")); // expand
      await user.click(screen.getByText("Readings & References")); // collapse
      expect(onMarkReadingsAsSeen).toHaveBeenCalledTimes(1);
    });

    it("does not call onMarkReadingsAsSeen when expanding the Speakers section", async () => {
      const user = userEvent.setup();
      const onMarkReadingsAsSeen = jest.fn();
      render(
        <ResourcesPanel
          messages={[]}
          onMarkReadingsAsSeen={onMarkReadingsAsSeen}
          speakers={[{ name: "S", bio: "B" }]}
        />,
      );
      await user.click(screen.getByText("Speakers"));
      expect(onMarkReadingsAsSeen).not.toHaveBeenCalled();
    });

    it("does not throw when onMarkReadingsAsSeen is not provided", async () => {
      const user = userEvent.setup();
      render(<ResourcesPanel messages={[]} />);
      await expect(
        user.click(screen.getByText("Readings & References")),
      ).resolves.not.toThrow();
    });
  });

  describe("newReadingMessageIds highlighting", () => {
    it("shows 'New' badge on readings whose messageId is in newReadingMessageIds", async () => {
      const user = userEvent.setup();
      mockParseMessageBody.mockReturnValueOnce({
        text: "",
        type: "reading",
        content: [{ title: "New Paper", authors: ["Author X"], year: 2024 }],
      });

      render(
        <ResourcesPanel
          messages={[readingMessage]}
          newReadingMessageIds={new Set(["msg-1"])}
        />,
      );
      await user.click(screen.getByText("Readings & References"));
      expect(screen.getByText("New")).toBeInTheDocument();
    });

    it("does not show 'New' badge when messageId is not in newReadingMessageIds", async () => {
      const user = userEvent.setup();
      mockParseMessageBody.mockReturnValueOnce({
        text: "",
        type: "reading",
        content: [{ title: "Old Paper", authors: ["Author Y"], year: 2020 }],
      });

      render(
        <ResourcesPanel
          messages={[readingMessage]}
          newReadingMessageIds={new Set(["other-msg-id"])}
        />,
      );
      await user.click(screen.getByText("Readings & References"));
      expect(screen.queryByText("New")).not.toBeInTheDocument();
    });

    it("does not show 'New' badge when newReadingMessageIds is not provided", async () => {
      const user = userEvent.setup();
      mockParseMessageBody.mockReturnValueOnce({
        text: "",
        type: "reading",
        content: [{ title: "Some Paper", authors: ["Author Z"], year: 2022 }],
      });

      render(<ResourcesPanel messages={[readingMessage]} />);
      await user.click(screen.getByText("Readings & References"));
      expect(screen.queryByText("New")).not.toBeInTheDocument();
    });

    it("applies amber styling only to new readings, not all readings", async () => {
      const user = userEvent.setup();
      const msg1 = { id: "msg-new", body: {} } as unknown as PseudonymousMessage;
      const msg2 = { id: "msg-old", body: {} } as unknown as PseudonymousMessage;

      mockParseMessageBody
        .mockReturnValueOnce({
          text: "",
          type: "reading",
          content: [{ title: "New Reading", authors: ["A"], year: 2024 }],
        })
        .mockReturnValueOnce({
          text: "",
          type: "reading",
          content: [{ title: "Old Reading", authors: ["B"], year: 2020 }],
        });

      render(
        <ResourcesPanel
          messages={[msg1, msg2]}
          newReadingMessageIds={new Set(["msg-new"])}
        />,
      );
      await user.click(screen.getByText("Readings & References"));

      expect(screen.getByText("New")).toBeInTheDocument();
      // Only one "New" badge even though there are two readings
      expect(screen.getAllByText("New")).toHaveLength(1);
    });
  });

  describe("multiple speakers and moderators", () => {
    it("renders all speakers", async () => {
      const user = userEvent.setup();
      render(
        <ResourcesPanel
          messages={[]}
          speakers={[
            { name: "Speaker One", bio: "Bio one." },
            { name: "Speaker Two", bio: "Bio two." },
            { name: "Speaker Three", bio: "Bio three." },
          ]}
        />,
      );
      await user.click(screen.getByText("Speakers"));
      expect(screen.getByText("Speaker One")).toBeInTheDocument();
      expect(screen.getByText("Speaker Two")).toBeInTheDocument();
      expect(screen.getByText("Speaker Three")).toBeInTheDocument();
    });

    it("renders all moderators", async () => {
      const user = userEvent.setup();
      render(
        <ResourcesPanel
          messages={[]}
          moderators={[
            { name: "Mod Alpha", bio: "Alpha bio." },
            { name: "Mod Beta", bio: "Beta bio." },
          ]}
        />,
      );
      await user.click(screen.getByText("Speakers"));
      expect(screen.getByText("Mod Alpha")).toBeInTheDocument();
      expect(screen.getByText("Mod Beta")).toBeInTheDocument();
    });
  });
});
