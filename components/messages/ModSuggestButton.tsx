import { FC } from 'react';
import { Tooltip } from '@mui/material';
import { NorthEastOutlined, CheckCircle } from '@mui/icons-material';

interface ModSuggestButtonProps {
  onSubmit: () => void;
  submitted?: boolean;
  botName?: string;
}

export const ModSuggestButton: FC<ModSuggestButtonProps> = ({ onSubmit, submitted = false, botName = 'The assistant' }) => {
  if (submitted) {
    return (
      <Tooltip title="This question was submitted to the moderator." placement="bottom-start" arrow>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            padding: '2px 8px',
            borderRadius: '999px',
            background: '#E1EFE2',
            border: '1px solid #C2D2B5',
            color: '#1B5E20',
            fontSize: '12px',
            fontWeight: 500,
            letterSpacing: '0.03em',
          }}
        >
          <CheckCircle sx={{ fontSize: '12px' }} />
          Submitted
        </div>
      </Tooltip>
    );
  }

  return (
    <Tooltip
      title={`${botName} thinks this question is worth submitting to the moderator. Click to submit it.`}
      placement="bottom-start"
      arrow
    >
      <button
        onClick={onSubmit}
        aria-label="Submit this question to the moderator"
        className="focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4845D2]"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          padding: '2px 8px',
          borderRadius: '999px',
          background: '#EEEDFB',
          border: '1px solid #C8C6F2',
          color: '#2E2BA8',
          fontSize: '12px',
          fontWeight: 500,
          letterSpacing: '0.03em',
          cursor: 'pointer',
          fontFamily: 'inherit',
          transition: 'background 120ms ease, border-color 120ms ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = '#DDD6FE';
          e.currentTarget.style.borderColor = '#A5B4FC';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = '#EEEDFB';
          e.currentTarget.style.borderColor = '#C8C6F2';
        }}
      >
        <NorthEastOutlined sx={{ fontSize: '12px' }} />
        Moderator
      </button>
    </Tooltip>
  );
};
