import { Box, Typography } from '@mui/material';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { DocumentPayload } from '../../types.internal';

/**
 * Renders a DocumentArtifact: one body of text, drawn as markdown the same way message
 * bodies are, so a document written in the conversation reads the way it was typed.
 * @param payload - The version payload, `{ body }`.
 */
export const DocumentArtifactView = ({ payload }: { payload: DocumentPayload }) => {
  if (!payload?.body?.trim()) {
    return (
      <Box sx={{ border: '1px solid #E2E8F0', borderRadius: 1, p: 4, textAlign: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          This document is empty so far.
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      className="markdown-content"
      sx={{
        border: '1px solid #E2E8F0',
        borderRadius: 1,
        p: { xs: 2, sm: 3 },
        bgcolor: '#FFFFFF',
        lineHeight: 1.65,
        overflowWrap: 'anywhere',
      }}
    >
      <Markdown remarkPlugins={[remarkGfm]}>{payload.body}</Markdown>
    </Box>
  );
};
