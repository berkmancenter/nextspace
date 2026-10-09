import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PreferencesPanel } from '../../components/PreferencesPanel';
import { UserPreferences } from '../../hooks/useUserPreferences';

const getSwitches = () => screen.getAllByRole('switch');

function renderPanel(overrides: Partial<{ preferences: UserPreferences; loading: boolean; onToggle: jest.Mock }> = {}) {
  const onToggle = overrides.onToggle ?? jest.fn();
  const preferences = overrides.preferences ?? { jargonClarification: false, visualResponse: false };
  const loading = overrides.loading ?? false;

  render(<PreferencesPanel botName="Berkie" preferences={preferences} loading={loading} onToggle={onToggle} />);

  return { onToggle };
}

describe('PreferencesPanel', () => {
  describe('rendering', () => {
    it('renders the header with title and subtitle', () => {
      renderPanel();
      expect(screen.getByText('Your Preferences')).toBeInTheDocument();
      expect(screen.getByText('Settings in this browser only')).toBeInTheDocument();
    });

    it('renders botName in section heading and description', () => {
      render(
        <PreferencesPanel
          botName="Aria"
          preferences={{ jargonClarification: false, visualResponse: false }}
          loading={false}
          onToggle={jest.fn()}
        />,
      );
      expect(screen.getByText('Aria Behavior')).toBeInTheDocument();
      expect(screen.getByText('How Aria helps you during the event')).toBeInTheDocument();
    });

    it('renders Jargon Filter and Visual Responses toggles', () => {
      renderPanel();
      expect(screen.getByText('Jargon Filter')).toBeInTheDocument();
      expect(screen.getByText('Visual Responses')).toBeInTheDocument();
    });

    it('renders toggles disabled while loading', () => {
      renderPanel({ loading: true });
      getSwitches().forEach((s) => expect(s).toBeDisabled());
    });

    it('renders toggles enabled once not loading', () => {
      renderPanel({ loading: false });
      getSwitches().forEach((s) => expect(s).not.toBeDisabled());
    });
  });

  describe('reflecting preferences', () => {
    it('reflects the preferences passed in', () => {
      renderPanel({ preferences: { jargonClarification: true, visualResponse: false } });
      const [jargon, visual] = getSwitches();
      expect(jargon).toBeChecked();
      expect(visual).not.toBeChecked();
    });
  });

  describe('toggling preferences', () => {
    it('calls onToggle with the jargonClarification key when that switch is clicked', async () => {
      const user = userEvent.setup();
      const { onToggle } = renderPanel();

      await user.click(getSwitches()[0]);

      expect(onToggle).toHaveBeenCalledWith('jargonClarification');
    });

    it('calls onToggle with the visualResponse key when that switch is clicked', async () => {
      const user = userEvent.setup();
      const { onToggle } = renderPanel();

      await user.click(getSwitches()[1]);

      expect(onToggle).toHaveBeenCalledWith('visualResponse');
    });
  });
});
