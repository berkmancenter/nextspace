/**
 * Rules the SVG and its controls cannot express inline: `:focus-visible` states and the fade
 * transitions. Scoped to `.concept-sky` like the tokens. The keyboard focus ring is dashed so
 * it never reads as the solid selection ring.
 */
const css = `
.concept-sky .cg-node { outline: none; cursor: pointer; transition: opacity var(--cg-fade) ease; }
.concept-sky .cg-fade { transition: opacity var(--cg-fade) ease, stroke-width var(--cg-fade) ease; }
.concept-sky .cg-focus-ring { opacity: 0; }
.concept-sky .cg-node:focus-visible .cg-focus-ring { opacity: 1; }
.concept-sky button:focus-visible,
.concept-sky select:focus-visible { outline: 2px solid var(--cg-focus-ring); outline-offset: 3px; }
@media (prefers-reduced-motion: reduce) {
  .concept-sky *, .concept-sky *::before, .concept-sky *::after { transition: none !important; }
}
`;

export default function SkyViewStyle() {
  return <style data-concept-sky-view dangerouslySetInnerHTML={{ __html: css }} />;
}
