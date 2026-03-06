import { useCallback, useEffect, useRef, memo } from "react";

interface MarkmapViewProps {
  markdown: string;
}

const ZOOM_STEP = 1.5;

const MarkmapViewComponent = ({ markdown }: MarkmapViewProps) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const mmRef = useRef<any>(null);

  useEffect(() => {
    if (!svgRef.current) return;

    const svg = svgRef.current;
    let rafId: number | null = null;
    let mounted = true;

    // Destroy existing instance
    if (mmRef.current?.destroy) {
      mmRef.current.destroy();
    }
    mmRef.current = null;

    svg.innerHTML = "";

    const render = async () => {
      const { Transformer } = await import("markmap-lib");
      const { Markmap, deriveOptions } = await import("markmap-view");

      const transformer = new Transformer();
      const { root, frontmatter } = transformer.transform(markdown);

      const customJsonOptions = {
        ...frontmatter?.markmap,
        lineWidth: 3,
      };
      // Derive options from frontmatter
      const baseOptions = deriveOptions(customJsonOptions);

      // Merge in custom options
      const markmapOptions = {
        ...baseOptions,
        spacingHorizontal: 100,
        spacingVertical: 20,
        paddingX: 12,
        initialExpandLevel: -1,
        colorFreezeLevel: 2,
      };

      // Defer initialization to next frame to ensure SVG has computed dimensions
      rafId = requestAnimationFrame(() => {
        if (!mounted || !svg.isConnected) return;

        // Create with merged options
        const mm = Markmap.create(svg, markmapOptions, root);
        mmRef.current = mm;

        // Call fit manually after creation
        requestAnimationFrame(() => {
          if (mounted && mm) {
            mm.fit();
          }
        });
      });
    };

    render();

    return () => {
      mounted = false;
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
      if (mmRef.current?.destroy) {
        mmRef.current.destroy();
      }
      mmRef.current = null;
    };
  }, [markdown]);

  const handleZoomIn = useCallback(() => {
    mmRef.current?.rescale(ZOOM_STEP);
  }, []);

  const handleZoomOut = useCallback(() => {
    mmRef.current?.rescale(1 / ZOOM_STEP);
  }, []);

  const handleFit = useCallback(() => {
    mmRef.current?.fit();
  }, []);

  return (
    <div className="w-full">
      <div className="flex justify-end gap-1 mb-1">
        <button
          onClick={handleZoomOut}
          className="px-2 py-0.5 text-sm rounded bg-gray-200 hover:bg-gray-300 text-gray-700"
          aria-label="Zoom out"
        >
          −
        </button>
        <button
          onClick={handleFit}
          className="px-2 py-0.5 text-sm rounded bg-gray-200 hover:bg-gray-300 text-gray-700"
          aria-label="Fit to container"
        >
          fit
        </button>
        <button
          onClick={handleZoomIn}
          className="px-2 py-0.5 text-sm rounded bg-gray-200 hover:bg-gray-300 text-gray-700"
          aria-label="Zoom in"
        >
          +
        </button>
      </div>
      <div className="bg-white rounded p-2">
        <svg
          ref={svgRef}
          style={{
            width: "100%",
            height: "400px",
          }}
        />
      </div>
    </div>
  );
};

export const MarkmapView = memo(MarkmapViewComponent);
