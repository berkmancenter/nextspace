import { useCallback, useEffect, useRef, memo } from "react";

interface MarkmapViewProps {
  markdown: string;
  onClick?: () => void;
  fullscreen?: boolean;
}

const ZOOM_STEP = 1.5;

const MarkmapViewComponent = ({ markdown, onClick, fullscreen = false }: MarkmapViewProps) => {
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

        // Check if SVG has valid dimensions before creating Markmap
        const rect = svg.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;

        try {
          // Create with merged options
          const mm = Markmap.create(svg, markmapOptions, root);
          mmRef.current = mm;

          // Call fit manually after creation
          requestAnimationFrame(() => {
            if (mounted && mm) {
              mm.fit();
            }
          });
        } catch (error) {
          // Silently handle SVG dimension errors during page rerenders
          console.debug("Markmap creation skipped due to invalid SVG state");
        }
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
    <div
      className="w-full"
      onClick={onClick}
      style={{ cursor: onClick ? "pointer" : "default" }}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
    >
      {/* Hidden text for screen readers */}
      <div
        style={{
          position: "absolute",
          width: "1px",
          height: "1px",
          padding: "0",
          margin: "-1px",
          overflow: "hidden",
          clip: "rect(0, 0, 0, 0)",
          whiteSpace: "nowrap",
          border: "0",
        }}
      >
        {markdown}
      </div>

      <div className="flex justify-end gap-1 mb-1">
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleZoomOut();
          }}
          className="px-2 py-0.5 text-sm rounded bg-gray-200 hover:bg-gray-300 text-gray-700"
          aria-label="Zoom out mind map"
        >
          −
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleFit();
          }}
          className="px-2 py-0.5 text-sm rounded bg-gray-200 hover:bg-gray-300 text-gray-700"
          aria-label="Fit mind map to container"
        >
          fit
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleZoomIn();
          }}
          className="px-2 py-0.5 text-sm rounded bg-gray-200 hover:bg-gray-300 text-gray-700"
          aria-label="Zoom in mind map"
        >
          +
        </button>
      </div>
      <div
        className="bg-white rounded p-2"
        role="img"
        aria-label="Interactive mind map visualization. Use zoom controls to navigate."
      >
        <svg
          ref={svgRef}
          style={{
            width: "100%",
            height: fullscreen ? "calc(90vh - 120px)" : "400px",
          }}
        />
      </div>
    </div>
  );
};

export const MarkmapView = memo(MarkmapViewComponent);
