import Head from 'next/head';
import dynamic from 'next/dynamic';
import { Box, Divider, Typography } from '@mui/material';
import {
  conceptGraphFixture,
  emptyConceptGraphFixture,
  minimalConceptGraphFixture,
} from '../../content/conceptGraphFixture';

const ConceptGraphView = dynamic(
  () => import('../../components/artifacts/ConceptGraphView').then((m) => m.ConceptGraphView),
  {
    ssr: false,
    loading: () => (
      <Typography variant="body2" color="text.secondary">
        Loading graph…
      </Typography>
    ),
  },
);

/**
 * The concept graph renderer against fixture data, so it can be looked at without a running
 * backend, a passcode, or an event that has actually finished.
 *
 * Everything drawn here is local and invented — the page makes no requests. It renders the
 * same fixtures the graph's tests assert against, so what a reviewer sees and what CI checks
 * cannot drift apart.
 *
 * Static route, so it takes precedence over `/artifacts/[conversationId]`.
 */
export default function ArtifactPreviewPage() {
  return (
    <>
      <Head>
        <title>Concept graph preview · NextSpace</title>
      </Head>

      <Box sx={{ maxWidth: 1180, mx: 'auto', px: { xs: 2, sm: 3 }, py: { xs: 2, sm: 4 } }}>
        <Typography variant="h6" component="h1" sx={{ fontWeight: 600 }}>
          Concept graph preview
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Fixture data, rendered locally. Nothing here comes from an event, and the page makes no requests — it is here to
          look at the renderer.
        </Typography>

        <Section
          title="A full graph"
          note="Twelve concepts, fifteen contributions, two origin prompts. The diamond labelled co-governs joins three concepts at once — the case a plain edge cannot express. Hover or tap a node to read it; scroll to zoom, drag to pan."
        >
          <ConceptGraphView payload={conceptGraphFixture} />
        </Section>

        <Section
          title="The smallest graph that draws all three node kinds"
          note="One concept pair, one contribution, one origin prompt attached by a dashed link."
        >
          <ConceptGraphView payload={minimalConceptGraphFixture} height={320} />
        </Section>

        <Section
          title="An empty graph"
          note="Valid, and worth looking at: an artifact can be created when an event starts and fill in as it runs."
        >
          <ConceptGraphView payload={emptyConceptGraphFixture} />
        </Section>
      </Box>
    </>
  );
}

function Section({ title, note, children }: { title: string; note: string; children: React.ReactNode }) {
  return (
    <Box sx={{ mb: 5 }}>
      <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
        {title}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5, maxWidth: '68ch' }}>
        {note}
      </Typography>
      <Divider sx={{ mb: 2 }} />
      {children}
    </Box>
  );
}
