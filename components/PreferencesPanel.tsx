import { Switch } from '@mui/material';
import { UserPreferences } from '../hooks/useUserPreferences';

interface PreferencesPanelProps {
  botName: string;
  preferences: UserPreferences;
  loading: boolean;
  onToggle: (key: keyof UserPreferences) => void;
}

export function PreferencesPanel({ botName, preferences, loading, onToggle }: PreferencesPanelProps) {
  const switchSx = {
    '& .MuiSwitch-switchBase.Mui-checked': { color: '#ffffff' },
    '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { backgroundColor: '#4A0979', opacity: 1 },
  };

  const ToggleRow = ({
    prefKey,
    label,
    description,
    divider = false,
  }: {
    prefKey: keyof UserPreferences;
    label: string;
    description: string;
    divider?: boolean;
  }) => (
    <>
      {divider && <div style={{ borderTop: '1px solid #F3F4F6', margin: '0 24px' }} />}
      <div className="flex items-center justify-between py-4 px-6">
        <div>
          <div className="font-semibold text-gray-900">{label}</div>
          <div className="text-sm text-gray-500 mt-0.5">{description}</div>
        </div>
        <Switch checked={preferences[prefKey]} onChange={() => onToggle(prefKey)} disabled={loading} sx={switchSx} />
      </div>
    </>
  );

  return (
    <div className="flex-1 overflow-y-auto bg-gray-100">
      <div className="bg-white px-6 py-4 border-t border-b border-gray-200">
        <div className="max-w-3xl mx-auto flex items-baseline gap-4 sm:gap-8">
          <h1 className="text-xl font-bold text-gray-900">Your Preferences</h1>
          <span className="text-sm text-gray-500">Settings in this browser only</span>
        </div>
      </div>
      <div className="max-w-3xl mx-auto py-8 px-6">
        <div className="flex flex-col sm:flex-row gap-4 sm:gap-8">
          <div className="sm:w-48 sm:flex-shrink-0 sm:pt-1">
            <h2 className="font-semibold text-gray-900">{botName} Behavior</h2>
            <p className="text-sm text-gray-500 mt-1 italic">How {botName} helps you during the event</p>
          </div>
          <div className="flex-1 bg-white rounded-xl overflow-hidden" style={{ border: '1px solid #E5E7EB' }}>
            <ToggleRow
              prefKey="jargonClarification"
              label="Jargon Filter"
              description="Plain-English cards for dense terms"
            />
            <ToggleRow
              prefKey="visualResponse"
              label="Visual Responses"
              description="Answer my questions with images when appropriate"
              divider
            />
          </div>
        </div>
      </div>
    </div>
  );
}
