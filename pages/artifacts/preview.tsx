import Head from 'next/head';
import dynamic from 'next/dynamic';
import { Box, Divider, Typography } from '@mui/material';
import { useAnalytics } from '../../hooks/useAnalytics';
import {
  conceptGraphFixture,
  denseConceptGraphFixture,
  emptyConceptGraphFixture,
  longSeriesConceptGraphFixture,
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
  // Fixture data: a page view only, there is no conversation behind it.
  useAnalytics({ pageType: 'artifacts_preview' });
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
          note="Ten concepts, twenty contributions, two origin prompts. Concepts are stars, brighter with more connections. A contribution joining three concepts is a diamond with a spoke to each, and one joining exactly two is the line between them. Solid means a direct quote survived; dashed means summary only, so the diamond labelled referenced and the lines labelled tempers or meets are dashed, while the line labelled deepens is solid. The two small pills are origin prompts, dotted to what they led to. Hover or focus a star to light its constellation; select anything to read it beside the sky. Orbit centres the selected concept, and List is the complete keyboard and screen-reader equivalent."
        >
          <ConceptGraphView payload={conceptGraphFixture} />
        </Section>

        <Section
          title="A series graph"
          note="One topic's sessions folded into a single graph. Each star's ring is cut into one arc per session it appears in, coloured by session; Trust is in three, the assistant in two. The Show menu fades everything outside one session without moving anything. Trust also stands in for a series long enough to outgrow its size cap: select it to see 'Also encompasses Reliability'."
        >
          <ConceptGraphView payload={seriesConceptGraphFixture} />
        </Section>

        <Section
          title="A series past eight sessions"
          note="Nine sessions, one more than there are session colours, so the ninth reuses the first colour. Rings are always solid; dashed is reserved for summary only."
        >
          <ConceptGraphView payload={longSeriesConceptGraphFixture} />
        </Section>

        <Section
          title="A dense graph with no provenance"
          note="Forty-seven concepts and eighty-five contributions, about two thirds of them lines and the rest diamonds joining three to five concepts, with long labels, a few summary-only contributions and some folded concepts. Like a real generated graph it has no session or prompt data, so there are no rings, no filter and no prompt pills. Synthetic text throughout."
        >
          <ConceptGraphView payload={denseConceptGraphFixture} />
        </Section>

        <Section
          title="The smallest graph that draws all three node kinds"
          note="One concept, its one leaf statement, and the origin prompt attached to the concept by a dotted link."
        >
          <ConceptGraphView payload={minimalConceptGraphFixture} />
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
