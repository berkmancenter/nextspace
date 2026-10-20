import '@fontsource-variable/fraunces/wght.css';
import '@fontsource-variable/fraunces/wght-italic.css';
import '@fontsource-variable/hanken-grotesk/wght.css';
import '@fontsource-variable/jetbrains-mono/wght.css';
import { skyCss } from './tokens';

/**
 * Injects the `.concept-sky` scoped CSS variables. Render once inside (or next to) the sky
 * container, and give the container `className="concept-sky"`. Importing this module also
 * loads the sky fonts, so they are only pulled in where the sky renders.
 */
export default function SkyStyle() {
  return <style data-concept-sky-tokens dangerouslySetInnerHTML={{ __html: skyCss() }} />;
}
