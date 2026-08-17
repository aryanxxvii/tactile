import { useEffect, useRef, useState } from "react";

import { mermaidThemeSignature, renderMermaid } from "./mermaidRenderer.js";

export function MarkdownMermaidBlock({ source, theme }) {
  const rootRef = useRef(null);
  const [nearViewport, setNearViewport] = useState(false);
  const [renderState, setRenderState] = useState({ status: "idle" });
  const themeSignature = mermaidThemeSignature(theme);

  useEffect(() => {
    const element = rootRef.current;
    setNearViewport(false);
    setRenderState({ status: "idle" });
    if (!element || typeof IntersectionObserver === "undefined") {
      setNearViewport(true);
      return undefined;
    }
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      setNearViewport(true);
      observer.disconnect();
    }, { rootMargin: "240px 0px" });
    observer.observe(element);
    return () => observer.disconnect();
  }, [source, themeSignature]);

  useEffect(() => {
    if (!nearViewport) return undefined;
    let active = true;
    let objectUrl = "";
    setRenderState({ status: "rendering" });
    renderMermaid(source, theme)
      .then(({ svg, cacheHit }) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
        setRenderState({ status: "ready", objectUrl, cacheHit });
      })
      .catch((error) => {
        if (active) setRenderState({ status: "error", message: error?.message || "This diagram could not be rendered." });
      });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [nearViewport, source, theme, themeSignature]);

  return (
    <figure
      ref={rootRef}
      className={`markdown-mermaid is-${renderState.status}`}
      data-markdown-capability="mermaid"
      data-render-state={renderState.status}
      data-cache-hit={renderState.cacheHit ? "true" : undefined}
    >
      {renderState.status === "ready" ? (
        <img src={renderState.objectUrl} alt="Mermaid diagram" />
      ) : renderState.status === "error" ? (
        <div className="markdown-mermaid-error" role="note" aria-label="Invalid Mermaid diagram">
          <strong>Diagram could not be rendered</strong>
          <span>{renderState.message}</span>
          <pre><code>{source}</code></pre>
        </div>
      ) : (
        <div className="markdown-mermaid-placeholder" aria-live="polite">
          {renderState.status === "rendering" ? "Rendering diagram..." : "Mermaid diagram"}
        </div>
      )}
    </figure>
  );
}