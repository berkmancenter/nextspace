import { Box } from '@mui/material';
import { SkyScene } from './scene';
import {
  PromptPillMark,
  QuoteLineMark,
  StarMark,
  StatementDiamondMark,
  SummaryDiamondMark,
  SummaryLineMark,
} from './SkyMarks';
import { cgVar, sessionVar } from './tokens';

const itemSx = { display: 'inline-flex', alignItems: 'center', gap: 1 };

/**
 * What each mark means. The session key and the origin-prompt entry appear only when the
 * graph has sessions or prompts to point at: a legend entry for something the sky never draws
 * would be a question with no answer.
 */
export function SkyLegend({ scene }: { scene: SkyScene }) {
  const sessions = Array.from({ length: scene.sessionCount }, (_, i) => i);
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, fontSize: 13, color: cgVar('textSecondary') }}>
      <Box
        component="ul"
        aria-label="Legend"
        sx={{ m: 0, p: 0, listStyle: 'none', display: 'flex', flexWrap: 'wrap', gap: '10px 28px' }}
      >
        <Box component="li" sx={itemSx}>
          <StarMark size={22} />
          Concept star, brighter with more connections
        </Box>
        <Box component="li" sx={itemSx}>
          <StatementDiamondMark size={20} />
          Quote
        </Box>
        <Box component="li" sx={itemSx}>
          <SummaryDiamondMark size={20} />
          Summary only
        </Box>
        <Box component="li" sx={itemSx}>
          <QuoteLineMark width={32} />
          Quote joining two concepts
        </Box>
        <Box component="li" sx={itemSx}>
          <SummaryLineMark width={32} />
          Summary joining two concepts
        </Box>
        {scene.prompts.size > 0 && (
          <Box component="li" sx={itemSx}>
            <PromptPillMark color={cgVar('sessionFallback')} />
            Origin prompt
          </Box>
        )}
      </Box>
      {sessions.length > 0 && (
        <Box
          component="ul"
          aria-label="Session colours"
          sx={{ m: 0, p: 0, listStyle: 'none', display: 'flex', flexWrap: 'wrap', gap: '8px 18px', alignItems: 'center' }}
        >
          <Box component="li" sx={{ color: cgVar('textSecondary') }}>
            Ring colour is the session
          </Box>
          {sessions.map((i) => (
            <Box component="li" key={i} sx={itemSx}>
              <Box
                component="span"
                aria-hidden="true"
                sx={{
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  border: `2.5px solid ${sessionVar(i)}`,
                  boxSizing: 'border-box',
                }}
              />
              {scene.sessionLabels[i]}
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}
