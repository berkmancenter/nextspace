import * as fs from "fs";
import * as path from "path";

describe("_document.tsx Matomo Tag Manager", () => {
  let documentSource: string;

  beforeAll(() => {
    // Read the actual _document.tsx file
    const documentPath = path.join(__dirname, "../../pages/_document.tsx");
    documentSource = fs.readFileSync(documentPath, "utf-8");
  });

  it("includes Matomo Tag Manager script in the file", () => {
    expect(documentSource).toContain("_mtm");
    expect(documentSource).toContain("Matomo Tag Manager");
  });

  it("includes correct Matomo initialization code", () => {
    // Verify the script contains the initialization code
    expect(documentSource).toContain("window._mtm = window._mtm || []");
    expect(documentSource).toContain("mtm.startTime");
    expect(documentSource).toContain("event");
    expect(documentSource).toContain("mtm.Start");
  });

  it("includes correct Matomo container URL", () => {
    // Verify the script contains the correct container URL
    expect(documentSource).toContain(
      "https://stats.berkman.harvard.edu/js/container_YvNDfYrC.js"
    );
  });

  it("loads Matomo script asynchronously", () => {
    // Verify the script sets async=true
    expect(documentSource).toContain("g.async=true");
  });

  it("uses insertBefore to load script before other scripts", () => {
    // Verify the script uses insertBefore to load before other scripts
    expect(documentSource).toContain("s.parentNode.insertBefore(g,s)");
  });

  it("uses dangerouslySetInnerHTML for the script content", () => {
    // Verify proper React integration
    expect(documentSource).toContain("dangerouslySetInnerHTML");
  });

  it("includes the script in the Head component", () => {
    // Verify the script is within the Head component structure
    const headStart = documentSource.indexOf("<Head>");
    const headEnd = documentSource.indexOf("</Head>");
    const matomoScriptPos = documentSource.indexOf("Matomo Tag Manager");

    expect(headStart).toBeGreaterThan(-1);
    expect(headEnd).toBeGreaterThan(-1);
    expect(matomoScriptPos).toBeGreaterThan(headStart);
    expect(matomoScriptPos).toBeLessThan(headEnd);
  });

  it("includes comment markers for the Matomo script", () => {
    // Verify the script has proper comment markers
    expect(documentSource).toContain("{/* Matomo Tag Manager");
    expect(documentSource).toContain("Matomo Tag Manager");
  });

  it("script appears after DocumentHeadTags and favicon", () => {
    // Verify proper ordering in the Head
    const documentHeadTagsPos = documentSource.indexOf("DocumentHeadTags");
    const faviconPos = documentSource.indexOf('rel="icon"');
    const matomoScriptPos = documentSource.indexOf("Matomo Tag Manager");

    expect(documentHeadTagsPos).toBeGreaterThan(-1);
    expect(faviconPos).toBeGreaterThan(-1);
    expect(matomoScriptPos).toBeGreaterThan(documentHeadTagsPos);
    expect(matomoScriptPos).toBeGreaterThan(faviconPos);
  });
});
