import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PreferencesPanel } from '../../components/PreferencesPanel';

jest.mock('../../utils/SessionManager', () => ({
  __esModule: true,
  default: {
    get: () => ({
      getSessionInfo: () => ({ userId: 'user-123', username: 'TestUser' }),
    }),
  },
}));

jest.mock('../../utils', () => ({
  Api: { get: () => ({ getAccessToken: () => 'token' }) },
  RetrieveData: jest.fn(),
  SendData: jest.fn(),
}));

import { RetrieveData, SendData } from '../../utils';
const mockRetrieveData = RetrieveData as jest.Mock;
const mockSendData = SendData as jest.Mock;

const getSwitches = () => screen.getAllByRole('switch');

describe('PreferencesPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSendData.mockResolvedValue({});
  });

  describe('rendering', () => {
    it('renders the header with title and subtitle', () => {
      mockRetrieveData.mockResolvedValue({});
      render(<PreferencesPanel botName="Berkie" />);
      expect(screen.getByText('Your Preferences')).toBeInTheDocument();
      expect(screen.getByText('Settings in this browser only')).toBeInTheDocument();
    });

    it('renders botName in section heading and description', () => {
      mockRetrieveData.mockResolvedValue({});
      render(<PreferencesPanel botName="Aria" />);
      expect(screen.getByText('Aria Behavior')).toBeInTheDocument();
      expect(screen.getByText('How Aria helps you during the event')).toBeInTheDocument();
    });

    it('renders Jargon Filter and Visual Responses toggles', () => {
      mockRetrieveData.mockResolvedValue({});
      render(<PreferencesPanel botName="Berkie" />);
      expect(screen.getByText('Jargon Filter')).toBeInTheDocument();
      expect(screen.getByText('Visual Responses')).toBeInTheDocument();
    });

    it('renders toggles disabled while loading', () => {
      mockRetrieveData.mockResolvedValue(new Promise(() => {})); // never resolves
      render(<PreferencesPanel botName="Berkie" />);
      getSwitches().forEach((s) => expect(s).toBeDisabled());
    });
  });

  describe('loading preferences', () => {
    it('enables toggles after preferences load', async () => {
      mockRetrieveData.mockResolvedValue({});
      render(<PreferencesPanel botName="Berkie" />);
      await waitFor(() => getSwitches().forEach((s) => expect(s).not.toBeDisabled()));
    });

    it('reflects saved preferences from the API', async () => {
      mockRetrieveData.mockResolvedValue({ jargonClarification: true, visualResponse: false });
      render(<PreferencesPanel botName="Berkie" />);
      await waitFor(() => {
        const [jargon, visual] = getSwitches();
        expect(jargon).toBeChecked();
        expect(visual).not.toBeChecked();
      });
    });

    it('strips unknown fields like _id from the API response', async () => {
      mockRetrieveData.mockResolvedValue({ jargonClarification: true, visualResponse: false, _id: 'db-id-123' });
      const user = userEvent.setup();
      render(<PreferencesPanel botName="Berkie" />);
      await waitFor(() => getSwitches().forEach((s) => expect(s).not.toBeDisabled()));

      await user.click(getSwitches()[0]);

      expect(mockSendData).toHaveBeenCalledWith(
        'users/user/user-123/preferences',
        { jargonClarification: false, visualResponse: false },
        undefined,
        undefined,
        'PUT',
      );
    });

    it('defaults both toggles to off when API returns empty object', async () => {
      mockRetrieveData.mockResolvedValue({});
      render(<PreferencesPanel botName="Berkie" />);
      await waitFor(() => getSwitches().forEach((s) => expect(s).not.toBeChecked()));
    });
  });

  describe('toggling preferences', () => {
    it('calls SendData with updated preferences when a toggle is clicked', async () => {
      const user = userEvent.setup();
      mockRetrieveData.mockResolvedValue({ jargonClarification: false, visualResponse: false });
      render(<PreferencesPanel botName="Berkie" />);
      await waitFor(() => getSwitches().forEach((s) => expect(s).not.toBeDisabled()));

      await user.click(getSwitches()[0]);

      expect(mockSendData).toHaveBeenCalledWith(
        'users/user/user-123/preferences',
        { jargonClarification: true, visualResponse: false },
        undefined,
        undefined,
        'PUT',
      );
    });

    it('optimistically updates the toggle before API responds', async () => {
      const user = userEvent.setup();
      mockRetrieveData.mockResolvedValue({ jargonClarification: false, visualResponse: false });
      mockSendData.mockImplementation(() => new Promise((resolve) => setTimeout(() => resolve({}), 500)));
      render(<PreferencesPanel botName="Berkie" />);
      await waitFor(() => getSwitches().forEach((s) => expect(s).not.toBeDisabled()));

      await user.click(getSwitches()[0]);
      expect(getSwitches()[0]).toBeChecked();
    });

    it('toggles both preferences independently', async () => {
      const user = userEvent.setup();
      mockRetrieveData.mockResolvedValue({ jargonClarification: false, visualResponse: false });
      render(<PreferencesPanel botName="Berkie" />);
      await waitFor(() => getSwitches().forEach((s) => expect(s).not.toBeDisabled()));

      await user.click(getSwitches()[1]);
      expect(getSwitches()[0]).not.toBeChecked();
      expect(getSwitches()[1]).toBeChecked();
    });
  });
});
