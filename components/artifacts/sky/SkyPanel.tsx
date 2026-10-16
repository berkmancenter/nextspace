import { ReactNode } from 'react';
import { Box } from '@mui/material';
import { contributionShape, isDashedContribution, promptLedTo, SkyFilterState } from '../../../utils/conceptSky';
import { SkyScene, conceptLabel, nodeKind, relationPhrase, sessionName, sessionOfNode } from './scene';
import { QuoteLineMark, StatementDiamondMark, SummaryDiamondMark, SummaryLineMark } from './SkyMarks';
import { chipSx, eyebrowSx, linkButtonSx, mutedEyebrowSx, noteSx, serifRelationSx } from './styles';
import { cgVar, skyShape } from './tokens';

export type SkyView = 'sky' | 'orbit' | 'list';

interface SkyPanelProps {
  scene: SkyScene;
  selectedId: string | null;
  filter: SkyFilterState;
  view: SkyView;
  /** Select a thing from the panel's chips and links (never toggles it off). */
  onSelect: (id: string) => void;
  onClear: () => void;
  /** Enter Orbit around the selected concept, or leave it. */
  onToggleOrbit: () => void;
  /** Take the rest of the height of a column that is exactly one window tall, and scroll inside it. */
  fill?: boolean;
}

const SUMMARY_ONLY_NOTE = 'Summary only. There is no direct quote for this contribution.';

const ellipsis = (text: string, max = 70) => (text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text);

const Chips = ({ children }: { children: ReactNode }) => (
  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>{children}</Box>
);

const Section = ({ children }: { children: ReactNode }) => (
  <Box
    component="section"
    sx={{
      display: 'flex',
      flexDirection: 'column',
      gap: 1.25,
      pt: 2,
      borderTop: `1px solid ${cgVar('divider')}`,
    }}
  >
    {children}
  </Box>
);

/** The mark that stands for a contribution: a line when it joins two concepts, else a diamond; dashed if summary only. */
function ContributionMark({ conceptCount, dashed }: { conceptCount: number; dashed: boolean }) {
  if (contributionShape(conceptCount) === 'line')
    return dashed ? <SummaryLineMark width={28} /> : <QuoteLineMark width={28} />;
  return dashed ? <SummaryDiamondMark size={22} /> : <StatementDiamondMark size={22} />;
}

/**
 * The reading panel: beside the sky on wide screens, below it on narrow ones, and an
 * `aria-live` region so a screen reader hears what a selection opened.
 *
 * Shows the selected concept, contribution or origin prompt, or an explainer with counts when
 * nothing is selected. Wording is shown exactly as the payload carries it. Who said it is never
 * shown: see {@link SkyScene} for why only the session is safe.
 */
export function SkyPanel({ scene, selectedId, filter, view, onSelect, onClear, onToggleOrbit, fill }: SkyPanelProps) {
  const kind = nodeKind(scene, selectedId);
  const chip = (id: string) => (
    <Box component="button" type="button" key={id} sx={chipSx} onClick={() => onSelect(id)}>
      {conceptLabel(scene, id)}
    </Box>
  );
  const promptChip = (promptId: string) => {
    const prompt = scene.prompts.get(promptId);
    if (!prompt) return null;
    return (
      <Box component="button" type="button" sx={chipSx} onClick={() => onSelect(promptId)}>
        {ellipsis(prompt.text)}
      </Box>
    );
  };
  const closeButton = (label: string) => (
    <Box
      component="button"
      type="button"
      aria-label={label}
      onClick={onClear}
      sx={{
        width: skyShape.targetMin,
        height: skyShape.targetMin,
        flex: 'none',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: `1px solid ${cgVar('borderStrong')}`,
        borderRadius: `${skyShape.radiusPill}px`,
        bgcolor: 'transparent',
        color: cgVar('textPrimary'),
        cursor: 'pointer',
      }}
    >
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
        <path d="M2 2l10 10M12 2L2 12" />
      </svg>
    </Box>
  );

  let body: ReactNode;

  if (kind === 'concept') {
    const concept = scene.concepts.get(selectedId!)!;
    const touching = (scene.model.contributionsOf.get(concept.id) ?? []).filter(
      (k) => filter.contributions.get(k)?.inFilter !== false,
    );
    body = (
      <>
        <Box sx={eyebrowSx}>Concept · joins {scene.model.degree.get(concept.id) ?? 0}</Box>
        <Box component="h2" sx={titleSx}>
          {concept.label}
        </Box>
        {concept.gloss && (
          <Box component="p" sx={{ m: 0, fontSize: 14, lineHeight: 1.55, color: cgVar('textBody') }}>
            {concept.gloss}
          </Box>
        )}
        {concept.foldedFrom && concept.foldedFrom.length > 0 && (
          <Box component="p" sx={{ m: 0, mt: -1, fontSize: 13, fontStyle: 'italic', color: cgVar('textSecondary') }}>
            Also encompasses {concept.foldedFrom.join(', ')}
          </Box>
        )}
        {concept.origin && scene.prompts.has(concept.origin) && (
          <Section>
            <Box sx={mutedEyebrowSx}>Origin prompt</Box>
            <Chips>{promptChip(concept.origin)}</Chips>
          </Section>
        )}
        {touching.map((kid) => {
          const k = scene.contributions.get(kid)!;
          const others = (scene.model.contributionConcepts.get(kid) ?? []).filter((c) => c !== concept.id);
          const dashed = isDashedContribution(k);
          return (
            <Section key={kid}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                <ContributionMark conceptCount={(scene.model.contributionConcepts.get(kid) ?? []).length} dashed={dashed} />
                <Box component="button" type="button" sx={linkButtonSx} onClick={() => onSelect(kid)}>
                  {relationPhrase(k.kind)}
                </Box>
              </Box>
              {others.length > 0 && <Chips>{others.map(chip)}</Chips>}
              {dashed ? (
                <Box component="p" sx={noteSx}>
                  {SUMMARY_ONLY_NOTE}
                </Box>
              ) : (
                <Box component="p" sx={{ m: 0, fontSize: 14, lineHeight: 1.55, color: cgVar('textBody') }}>
                  {k.statement}
                </Box>
              )}
            </Section>
          );
        })}
        <Box sx={{ display: 'flex', gap: 1, mt: 'auto', pt: 1 }}>
          <Box component="button" type="button" sx={primaryButtonSx} onClick={onToggleOrbit}>
            {view === 'orbit' ? 'Back to the sky' : 'Center the sky here'}
          </Box>
          {closeButton('Close concept')}
        </Box>
      </>
    );
  } else if (kind === 'contribution') {
    const k = scene.contributions.get(selectedId!)!;
    const ids = scene.model.contributionConcepts.get(k.id) ?? [];
    const dashed = isDashedContribution(k);
    body = (
      <>
        <Box sx={eyebrowSx}>
          {dashed ? 'Summary-only contribution' : 'Contribution with a quote'} · joins {ids.length}
        </Box>
        {dashed ? (
          <>
            <Box component="p" sx={{ ...serifRelationSx, m: 0, fontSize: 19 }}>
              {relationPhrase(k.kind)}
            </Box>
            <Box component="p" sx={noteSx}>
              {SUMMARY_ONLY_NOTE}
            </Box>
          </>
        ) : (
          <>
            <Box component="p" sx={{ ...serifRelationSx, m: 0, fontSize: 19 }}>
              {relationPhrase(k.kind)}
            </Box>
            <Box
              component="p"
              sx={{
                m: 0,
                fontFamily: 'var(--cg-font-serif)',
                fontWeight: 350,
                fontSize: 21,
                lineHeight: 1.4,
                color: cgVar('textPrimary'),
              }}
            >
              {k.statement}
            </Box>
          </>
        )}
        {k.origin && scene.prompts.has(k.origin) && (
          <Section>
            <Box sx={mutedEyebrowSx}>Origin prompt</Box>
            <Chips>{promptChip(k.origin)}</Chips>
          </Section>
        )}
        <Section>
          <Box sx={mutedEyebrowSx}>Concepts this contribution connects</Box>
          <Chips>{ids.map(chip)}</Chips>
        </Section>
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 'auto', pt: 1 }}>
          {closeButton('Close contribution')}
        </Box>
      </>
    );
  } else if (kind === 'prompt') {
    const prompt = scene.prompts.get(selectedId!)!;
    const session = sessionOfNode(scene, prompt);
    const led = promptLedTo(scene.model.payload, prompt.id);
    const concepts = (scene.model.payload.concepts ?? []).filter((c) => c.origin === prompt.id);
    const contributions = (scene.model.payload.contributions ?? []).filter((k) => k.origin === prompt.id);
    body = (
      <>
        <Box sx={eyebrowSx}>
          Origin prompt{session !== undefined ? ` · ${sessionName(session)}` : ''} · led to {led.concepts}
        </Box>
        <Box component="h2" sx={{ ...titleSx, fontSize: 26, lineHeight: 1.25 }}>
          {prompt.text}
        </Box>
        {concepts.length > 0 && (
          <Section>
            <Box sx={mutedEyebrowSx}>Concepts that came out of it</Box>
            <Chips>{concepts.map((c) => chip(c.id))}</Chips>
          </Section>
        )}
        {contributions.length > 0 && (
          <Section>
            <Box sx={mutedEyebrowSx}>Contributions that came out of it</Box>
            <Box component="ul" sx={{ m: 0, p: 0, listStyle: 'none', display: 'flex', flexDirection: 'column' }}>
              {contributions.map((k) => (
                <Box component="li" key={k.id} sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                  <ContributionMark
                    conceptCount={(scene.model.contributionConcepts.get(k.id) ?? []).length}
                    dashed={isDashedContribution(k)}
                  />
                  <Box component="button" type="button" sx={linkButtonSx} onClick={() => onSelect(k.id)}>
                    {relationPhrase(k.kind)}
                  </Box>
                </Box>
              ))}
            </Box>
          </Section>
        )}
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 'auto', pt: 1 }}>{closeButton('Close prompt')}</Box>
      </>
    );
  } else {
    const inView = (m: Map<string, { inFilter: boolean }>) => [...m.values()].filter((e) => e.inFilter).length;
    const stat = (n: number, label: string) => (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          gap: '2px',
          p: 1.5,
          borderRadius: '12px',
          bgcolor: cgVar('surfaceTile'),
        }}
      >
        <Box sx={{ fontFamily: 'var(--cg-font-serif)', fontSize: 30, lineHeight: 1 }}>{n}</Box>
        <Box sx={{ fontSize: 11, color: cgVar('textSecondary'), overflowWrap: 'normal' }}>{label}</Box>
      </Box>
    );
    body = (
      <>
        <Box sx={eyebrowSx}>Reading the sky</Box>
        <Box component="h2" sx={{ ...titleSx, fontSize: 28, lineHeight: 1.15 }}>
          Concepts are stars. The people in the room draw the lines between them.
        </Box>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 1.25 }}>
          {stat(inView(filter.concepts), 'concepts')}
          {stat(inView(filter.contributions), 'contributions')}
          {stat(inView(filter.prompts), 'prompts')}
        </Box>
        <Box component="p" sx={{ m: 0, fontSize: 14, lineHeight: 1.6, color: cgVar('textBody') }}>
          A diamond is one contribution joining several concepts; a contribution joining exactly two is drawn as the line
          between them. Solid means a direct quote survived. Dashed means summary only. The small pills are the prompts the
          conversation started from. Select a star, diamond or pill to read it.
        </Box>
        <Box component="p" sx={{ ...noteSx, mt: 'auto' }}>
          Who said what is never shown, only which session something came from.
        </Box>
      </>
    );
  }

  return (
    <Box
      component="aside"
      aria-label="Reading panel"
      aria-live="polite"
      // Focusable so a keyboard reader can scroll it: a hub concept can touch dozens of contributions.
      tabIndex={0}
      sx={{
        // `fill`: the panel is the rest of a column that is exactly one window tall, so it takes what is
        // left and scrolls inside it. Otherwise it sits beside or below the sky at its own height.
        flex: fill ? '1 1 0' : '1 1 320px',
        minHeight: 0,
        minWidth: 0,
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        gap: 2.25,
        p: 3,
        borderRadius: `${skyShape.radiusLg}px`,
        bgcolor: cgVar('surfacePanel'),
        border: `1px solid ${cgVar('border')}`,
        overflowY: 'auto',
        // Capped so a hub's long panel scrolls beside the sky instead of stretching the whole row.
        alignSelf: fill ? 'stretch' : 'flex-start',
        maxHeight: fill ? 'none' : 'min(85vh, 780px)',
        // Statements run to a few hundred characters and labels are long: wrap, never clip.
        overflowWrap: 'anywhere',
      }}
    >
      {body}
    </Box>
  );
}

const titleSx = {
  m: 0,
  fontFamily: 'var(--cg-font-serif)',
  fontWeight: 400,
  fontSize: 32,
  lineHeight: 1.05,
  color: cgVar('textPrimary'),
};

const primaryButtonSx = {
  flex: 1,
  minHeight: skyShape.targetMin,
  border: 0,
  borderRadius: `${skyShape.radiusPill}px`,
  bgcolor: cgVar('star'),
  color: cgVar('surfaceSky'),
  font: '600 14px var(--cg-font-sans)',
  cursor: 'pointer',
};
