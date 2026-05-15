import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ResourcesPanel } from '../../components/ResourcesPanel';
import { components } from '../../types';

type Resource = components['schemas']['Resource'];

function makeResource(overrides: Partial<Resource> = {}): Resource {
  return {
    id: 'res-1',
    source: 'ai',
    category: 'suggested',
    title: 'The Internet and Democracy',
    authors: ['Jane Doe', 'John Smith'],
    year: '2021',
    relevanceReason: "Directly relevant to today's discussion.",
    participantVisible: true,
    ...overrides,
  };
}

describe('ResourcesPanel', () => {
  describe('header / event info', () => {
    it('renders default title when eventName is not provided', () => {
      render(<ResourcesPanel resources={[]} />);
      expect(screen.getByText('Event Resources')).toBeInTheDocument();
    });

    it('renders eventName when provided', () => {
      render(<ResourcesPanel resources={[]} eventName="Tech & Society Forum" />);
      expect(screen.getByText('Tech & Society Forum')).toBeInTheDocument();
    });

    it('renders short eventDescription without truncation controls', () => {
      render(<ResourcesPanel resources={[]} eventDescription="Short description." />);
      expect(screen.getByText('Short description.')).toBeInTheDocument();
      expect(screen.queryByText('more')).not.toBeInTheDocument();
    });

    it("truncates long eventDescription and shows 'more' button", () => {
      const longDescription = 'A'.repeat(600);
      render(<ResourcesPanel resources={[]} eventDescription={longDescription} />);
      expect(screen.getByText('more')).toBeInTheDocument();
      expect(screen.queryByText('less')).not.toBeInTheDocument();
    });

    it("expands truncated eventDescription on 'more' click and shows 'less'", async () => {
      const user = userEvent.setup();
      const longDescription = 'A'.repeat(600);
      render(<ResourcesPanel resources={[]} eventDescription={longDescription} />);
      await user.click(screen.getByText('more'));
      expect(screen.getByText('less')).toBeInTheDocument();
      expect(screen.queryByText('more')).not.toBeInTheDocument();
    });

    it("collapses expanded description back on 'less' click", async () => {
      const user = userEvent.setup();
      const longDescription = 'B'.repeat(600);
      render(<ResourcesPanel resources={[]} eventDescription={longDescription} />);
      await user.click(screen.getByText('more'));
      await user.click(screen.getByText('less'));
      expect(screen.getByText('more')).toBeInTheDocument();
    });
  });

  describe('category headers', () => {
    it('renders Speakers and Readings & References category headers', () => {
      render(<ResourcesPanel resources={[]} />);
      expect(screen.getByText('Speakers')).toBeInTheDocument();
      expect(screen.getByText('Readings & References')).toBeInTheDocument();
    });

    it('categories are collapsed by default (content not visible)', () => {
      render(<ResourcesPanel resources={[]} speakers={[{ name: 'Alice', bio: 'Bio here' }]} />);
      expect(screen.queryByText('Speakers', { selector: 'h4' })).not.toBeInTheDocument();
      expect(screen.queryByText('Alice')).not.toBeInTheDocument();
    });

    it('shows ExpandMore icon when collapsed and ExpandLess when expanded', async () => {
      const user = userEvent.setup();
      render(<ResourcesPanel resources={[]} />);
      expect(screen.getAllByTestId('ExpandMoreIcon')).toHaveLength(2);

      await user.click(screen.getByText('Speakers'));
      expect(screen.getAllByTestId('ExpandLessIcon')).toHaveLength(1);
    });
  });

  describe('Speakers section', () => {
    it('shows speakers when the Speakers category is expanded', async () => {
      const user = userEvent.setup();
      render(<ResourcesPanel resources={[]} speakers={[{ name: 'Dr. Ada Lovelace', bio: 'Pioneer of computing.' }]} />);
      await user.click(screen.getByText('Speakers'));
      expect(screen.getByText('Dr. Ada Lovelace')).toBeInTheDocument();
      expect(screen.getByText('Pioneer of computing.')).toBeInTheDocument();
    });

    it('shows moderators when expanded', async () => {
      const user = userEvent.setup();
      render(<ResourcesPanel resources={[]} moderators={[{ name: 'Mod One', bio: 'Moderator bio.' }]} />);
      await user.click(screen.getByText('Speakers'));
      expect(screen.getByText('Moderators')).toBeInTheDocument();
      expect(screen.getByText('Mod One')).toBeInTheDocument();
    });

    it('shows both moderators and speakers sections when both are provided', async () => {
      const user = userEvent.setup();
      render(
        <ResourcesPanel
          resources={[]}
          speakers={[{ name: 'Speaker A', bio: 'Speaker bio.' }]}
          moderators={[{ name: 'Mod B', bio: 'Mod bio.' }]}
        />,
      );
      await user.click(screen.getByText('Speakers'));
      expect(screen.getByText('Moderators')).toBeInTheDocument();
      expect(screen.getByText('Speakers', { selector: 'h4' })).toBeInTheDocument();
      expect(screen.getByText('Speaker A')).toBeInTheDocument();
      expect(screen.getByText('Mod B')).toBeInTheDocument();
    });

    it('does not render Moderators sub-heading when moderators array is empty', async () => {
      const user = userEvent.setup();
      render(<ResourcesPanel resources={[]} speakers={[{ name: 'Speaker A', bio: 'Bio.' }]} moderators={[]} />);
      await user.click(screen.getByText('Speakers'));
      expect(screen.queryByText('Moderators')).not.toBeInTheDocument();
    });

    it('truncates long speaker bios and allows expansion', async () => {
      const user = userEvent.setup();
      const longBio = 'X'.repeat(400);
      render(<ResourcesPanel resources={[]} speakers={[{ name: 'Speaker A', bio: longBio }]} />);
      await user.click(screen.getByText('Speakers'));
      expect(screen.getByText('more')).toBeInTheDocument();
      await user.click(screen.getByText('more'));
      expect(screen.getByText('less')).toBeInTheDocument();
    });

    it('collapses the speakers section when header is clicked again', async () => {
      const user = userEvent.setup();
      render(<ResourcesPanel resources={[]} speakers={[{ name: 'Speaker A', bio: 'Bio.' }]} />);
      await user.click(screen.getByRole('button', { name: /speakers/i }));
      expect(screen.getByText('Speaker A')).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: /speakers/i }));
      expect(screen.queryByText('Speaker A')).not.toBeInTheDocument();
    });
  });

  describe('Readings & References section', () => {
    it('shows empty state when there are no resources', async () => {
      const user = userEvent.setup();
      render(<ResourcesPanel resources={[]} />);
      await user.click(screen.getByText('Readings & References'));
      expect(screen.getByText('No reading recommendations available yet.')).toBeInTheDocument();
    });

    it('displays resources', async () => {
      const user = userEvent.setup();
      const resource = makeResource({ source: 'ai' });

      render(<ResourcesPanel resources={[resource]} />);
      await user.click(screen.getByText('Readings & References'));

      expect(screen.getByText('The Internet and Democracy')).toBeInTheDocument();
      expect(screen.getByText('Jane Doe, John Smith (2021)')).toBeInTheDocument();
      expect(screen.getByText("Directly relevant to today's discussion.")).toBeInTheDocument();
      expect(screen.getByText('AI Pick')).toBeInTheDocument();
    });

    it('shows Speaker Pick label for speaker-sourced resources', async () => {
      const user = userEvent.setup();
      const resource = makeResource({ source: 'speaker' });

      render(<ResourcesPanel resources={[resource]} />);
      await user.click(screen.getByText('Readings & References'));

      expect(screen.getByText('Speaker Pick')).toBeInTheDocument();
    });

    it('renders resource without optional fields', async () => {
      const user = userEvent.setup();
      const resource = makeResource({ relevanceReason: undefined, description: undefined, summary: undefined, authors: [] });

      render(<ResourcesPanel resources={[resource]} />);
      await user.click(screen.getByText('Readings & References'));

      expect(screen.getByText('The Internet and Democracy')).toBeInTheDocument();
    });

    it('displays multiple resources', async () => {
      const user = userEvent.setup();
      const res1 = makeResource({ id: 'res-1', title: 'Book One', authors: ['Author A'] });
      const res2 = makeResource({ id: 'res-2', title: 'Book Two', authors: ['Author B'] });

      render(<ResourcesPanel resources={[res1, res2]} />);
      await user.click(screen.getByText('Readings & References'));

      expect(screen.getByText('Book One')).toBeInTheDocument();
      expect(screen.getByText('Book Two')).toBeInTheDocument();
    });

    it('prefers relevanceReason over description and summary', async () => {
      const user = userEvent.setup();
      const resource = makeResource({
        relevanceReason: 'Relevance note',
        description: 'Description text',
        summary: 'Summary text',
      });

      render(<ResourcesPanel resources={[resource]} />);
      await user.click(screen.getByText('Readings & References'));

      expect(screen.getByText('Relevance note')).toBeInTheDocument();
      expect(screen.queryByText('Description text')).not.toBeInTheDocument();
    });

    it('collapses the readings section when clicked again', async () => {
      const user = userEvent.setup();
      render(<ResourcesPanel resources={[]} />);
      await user.click(screen.getByText('Readings & References'));
      expect(screen.getByText('No reading recommendations available yet.')).toBeInTheDocument();
      await user.click(screen.getByText('Readings & References'));
      expect(screen.queryByText('No reading recommendations available yet.')).not.toBeInTheDocument();
    });
  });

  describe('unseenReadingsCount badge', () => {
    it('does not show badge when unseenReadingsCount is 0', () => {
      render(<ResourcesPanel resources={[]} unseenReadingsCount={0} />);
      expect(screen.queryByText('0')).not.toBeInTheDocument();
    });

    it('shows badge with count when unseenReadingsCount > 0', () => {
      render(<ResourcesPanel resources={[]} unseenReadingsCount={3} />);
      expect(screen.getByText('3')).toBeInTheDocument();
    });

    it('does not show badge for the Speakers category regardless', () => {
      render(<ResourcesPanel resources={[]} unseenReadingsCount={5} speakers={[{ name: 'S', bio: 'B' }]} />);
      expect(screen.getAllByText('5')).toHaveLength(1);
    });
  });

  describe('onMarkReadingsAsSeen callback', () => {
    it('does not call onMarkReadingsAsSeen when readings section is expanded', async () => {
      const user = userEvent.setup();
      const onMarkReadingsAsSeen = jest.fn();
      render(<ResourcesPanel resources={[]} onMarkReadingsAsSeen={onMarkReadingsAsSeen} />);
      await user.click(screen.getByText('Readings & References'));
      expect(onMarkReadingsAsSeen).not.toHaveBeenCalled();
    });

    it('calls onMarkReadingsAsSeen when collapsing readings section', async () => {
      const user = userEvent.setup();
      const onMarkReadingsAsSeen = jest.fn();
      render(<ResourcesPanel resources={[]} onMarkReadingsAsSeen={onMarkReadingsAsSeen} />);
      await user.click(screen.getByText('Readings & References')); // expand
      await user.click(screen.getByText('Readings & References')); // collapse
      expect(onMarkReadingsAsSeen).toHaveBeenCalledTimes(1);
    });

    it('does not call onMarkReadingsAsSeen when expanding the Speakers section', async () => {
      const user = userEvent.setup();
      const onMarkReadingsAsSeen = jest.fn();
      render(
        <ResourcesPanel resources={[]} onMarkReadingsAsSeen={onMarkReadingsAsSeen} speakers={[{ name: 'S', bio: 'B' }]} />,
      );
      await user.click(screen.getByText('Speakers'));
      expect(onMarkReadingsAsSeen).not.toHaveBeenCalled();
    });

    it('does not throw when onMarkReadingsAsSeen is not provided', async () => {
      const user = userEvent.setup();
      render(<ResourcesPanel resources={[]} />);
      await expect(user.click(screen.getByText('Readings & References'))).resolves.not.toThrow();
    });
  });

  describe('newResourceIds highlighting', () => {
    it("shows 'New' badge on resources whose id is in newResourceIds", async () => {
      const user = userEvent.setup();
      const resource = makeResource({ id: 'res-1' });

      render(<ResourcesPanel resources={[resource]} newResourceIds={new Set(['res-1'])} />);
      await user.click(screen.getByText('Readings & References'));
      expect(screen.getByText('New')).toBeInTheDocument();
    });

    it("does not show 'New' badge when resource id is not in newResourceIds", async () => {
      const user = userEvent.setup();
      const resource = makeResource({ id: 'res-1' });

      render(<ResourcesPanel resources={[resource]} newResourceIds={new Set(['other-res-id'])} />);
      await user.click(screen.getByText('Readings & References'));
      expect(screen.queryByText('New')).not.toBeInTheDocument();
    });

    it("does not show 'New' badge when newResourceIds is not provided", async () => {
      const user = userEvent.setup();
      const resource = makeResource({ id: 'res-1' });

      render(<ResourcesPanel resources={[resource]} />);
      await user.click(screen.getByText('Readings & References'));
      expect(screen.queryByText('New')).not.toBeInTheDocument();
    });

    it('applies amber styling only to new resources, not all resources', async () => {
      const user = userEvent.setup();
      const res1 = makeResource({ id: 'res-new', title: 'New Reading' });
      const res2 = makeResource({ id: 'res-old', title: 'Old Reading' });

      render(<ResourcesPanel resources={[res1, res2]} newResourceIds={new Set(['res-new'])} />);
      await user.click(screen.getByText('Readings & References'));

      expect(screen.getByText('New')).toBeInTheDocument();
      expect(screen.getAllByText('New')).toHaveLength(1);
    });
  });

  describe('multiple speakers and moderators', () => {
    it('renders all speakers', async () => {
      const user = userEvent.setup();
      render(
        <ResourcesPanel
          resources={[]}
          speakers={[
            { name: 'Speaker One', bio: 'Bio one.' },
            { name: 'Speaker Two', bio: 'Bio two.' },
            { name: 'Speaker Three', bio: 'Bio three.' },
          ]}
        />,
      );
      await user.click(screen.getByText('Speakers'));
      expect(screen.getByText('Speaker One')).toBeInTheDocument();
      expect(screen.getByText('Speaker Two')).toBeInTheDocument();
      expect(screen.getByText('Speaker Three')).toBeInTheDocument();
    });

    it('renders all moderators', async () => {
      const user = userEvent.setup();
      render(
        <ResourcesPanel
          resources={[]}
          moderators={[
            { name: 'Mod Alpha', bio: 'Alpha bio.' },
            { name: 'Mod Beta', bio: 'Beta bio.' },
          ]}
        />,
      );
      await user.click(screen.getByText('Speakers'));
      expect(screen.getByText('Mod Alpha')).toBeInTheDocument();
      expect(screen.getByText('Mod Beta')).toBeInTheDocument();
    });
  });
});
