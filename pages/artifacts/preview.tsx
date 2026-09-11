import Head from 'next/head';
import dynamic from 'next/dynamic';
import { Box, Divider, Typography } from '@mui/material';
import {
  conceptGraphFixture,
  emptyConceptGraphFixture,
  minimalConceptGraphFixture,
  seriesConceptGraphFixture,
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
          note="Ten concepts, eighteen contributions, two origin prompts. Most contributions are leaves — one person's statement about living with the assistant, linked to the concept it speaks to — drawn by that statement rather than a short kind, so a long one only resolves once you zoom in far enough for it to stop colliding with its neighbours. A few contributions are plain relationships between concepts that no single statement carries. The diamond labelled co-shapes joins three concepts at once — the case a plain edge cannot express. Origin prompts are hidden until you switch them on with the button above the canvas; shown, each is drawn in full, never elided. Hover or tap a node to read it; scroll to zoom, drag to pan."
        >
          <ConceptGraphView payload={conceptGraphFixture} />
        </Section>

        <Section
          title="A series graph"
          note="One topic's sessions folded into a single graph. Concepts are coloured by the session that raised them, numbered by first appearance — a session is not a person, and it is the one piece of provenance safe to show a reader. Trust, raised in the first session and returned to in the second and third, is one node rather than three."
        >
          <ConceptGraphView payload={seriesConceptGraphFixture} height={420} />
        </Section>

        <Section
          title="The smallest graph that draws all three node kinds"
          note="One concept, its one leaf statement, and the origin prompt attached to the concept by a dashed link — switch on 'Show origin prompts' above the canvas to see it."
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
