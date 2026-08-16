import { React, pluginAssetUrl, useEffect, useRef, useState } from "tactile:host";
import { IconChevronLeft, IconChevronRight, IconZoomIn, IconZoomOut } from "@tabler/icons-react";

let pdfjsPromise;

function loadPdfjs() {
  pdfjsPromise ||= import("pdfjs-dist").then((module) => {
    const library = module.default || module;
    if (!library.GlobalWorkerOptions.workerSrc) {
      library.GlobalWorkerOptions.workerSrc = pluginAssetUrl("pdf.worker.min.mjs");
    }
    return library;
  });
  return pdfjsPromise;
}

function dataUrlBytes(dataUrl) {
  const match = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(String(dataUrl || ""));
  if (!match) return null;
  if (match[2]) {
    if (typeof atob !== "function") return null;
    const binary = atob(match[3]);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return bytes;
  }
  return new TextEncoder().encode(decodeURIComponent(match[3]));
}

const ZOOM_STEPS = [0.5, 0.67, 0.75, 0.85, 1, 1.2, 1.4, 1.6, 2];

export function PdfViewer({ asset, title = asset?.fileName || "PDF", onChooseFile }) {
  const containerRef = useRef(null);
  const entriesRef = useRef(new Map());
  const renderStateRef = useRef({ visible: new Set(), rendered: new Set(), task: null });
  const pagesRef = useRef([]);

  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [document, setDocument] = useState(null);
  const [numPages, setNumPages] = useState(0);
  const [fitWidth, setFitWidth] = useState(0);
  const [zoomIndex, setZoomIndex] = useState(ZOOM_STEPS.indexOf(1));
  const [currentPage, setCurrentPage] = useState(1);

  const zoomMultiplier = ZOOM_STEPS[Math.min(ZOOM_STEPS.length - 1, Math.max(0, zoomIndex))];

  useEffect(() => {
    let cancelled = false;
    let loadingTask;
    (async () => {
      const bytes = dataUrlBytes(asset?.dataUrl);
      if (!bytes) {
        if (!cancelled) setStatus("empty");
        return;
      }
      try {
        const pdfjs = await loadPdfjs();
        const blob = new Blob([bytes], { type: "application/pdf" });
        const data = await blob.arrayBuffer();
        loadingTask = pdfjs.getDocument({ data });
        const loaded = await loadingTask.promise;
        if (cancelled) {
          loaded?.destroy?.();
          return;
        }
        const pages = [];
        for (let pageNumber = 1; pageNumber <= loaded.numPages; pageNumber += 1) {
          pages.push(await loaded.getPage(pageNumber));
        }
        pagesRef.current = pages;
        setDocument(loaded);
        setNumPages(loaded.numPages);
        setStatus("ready");
        setCurrentPage(1);
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError?.message || "Unable to read this PDF.");
          setStatus("error");
        }
      }
    })();
    return () => {
      cancelled = true;
      try { loadingTask?.destroy?.(); } catch { /* already settled */ }
    };
  }, [asset?.dataUrl]);

  const currentDocument = document;
  useEffect(() => () => {
    currentDocument?.destroy?.();
  }, [currentDocument]);

  useEffect(() => {
    const node = containerRef.current;
    if (status !== "ready" || !node) return undefined;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect?.width || 0;
      setFitWidth(Math.max(1, width - 10));
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [status]);

  const scaleMultiplierRef = useRef(zoomMultiplier);
  scaleMultiplierRef.current = zoomMultiplier;
  const fitWidthRef = useRef(fitWidth);
  fitWidthRef.current = fitWidth;
  const stateRef = renderStateRef;

  const pageRenderScale = (page) => {
    const baseWidth = page.getViewport({ scale: 1 }).width;
    const fit = fitWidthRef.current ? fitWidthRef.current / baseWidth : 1;
    return Math.max(0.05, fit * scaleMultiplierRef.current);
  };

  const renderPageIfPossible = (pageNumber) => {
    const entry = entriesRef.current.get(pageNumber);
    const page = pagesRef.current[pageNumber - 1];
    const state = stateRef.current;
    if (!entry?.canvas || !page) return;
    const scale = pageRenderScale(page);
    const viewport = page.getViewport({ scale });
    const renderScale = window.devicePixelRatio;
    const canvasWidth = Math.max(1, Math.floor(viewport.width * renderScale));
    const canvasHeight = Math.max(1, Math.floor(viewport.height * renderScale));
    const renderKey = `${pageNumber}:${canvasWidth}x${canvasHeight}`;
    if (canvasWidth !== entry.canvas.width || canvasHeight !== entry.canvas.height) {
      entry.canvas.width = canvasWidth;
      entry.canvas.height = canvasHeight;
      state.rendered.delete(renderKey);
    }
    entry.canvas.style.width = `${viewport.width}px`;
    entry.canvas.style.height = `${viewport.height}px`;
    if (!state.visible.has(pageNumber)) return;
    if (state.rendered.has(renderKey)) return;
    const context = entry.canvas.getContext("2d");
    state.task?.cancel?.();
    const task = page.render({
      canvasContext: context,
      viewport,
      transform: renderScale === 1 ? null : [renderScale, 0, 0, renderScale, 0, 0],
    });
    state.task = task;
    task.promise.then(
      () => {
        state.rendered.add(renderKey);
        if (state.task === task) state.task = null;
      },
      () => {
        if (state.task === task) state.task = null;
      },
    );
  };

  const resyncEntries = () => {
    Object.keys(entriesRef.current).forEach((pageNumber) => renderPageIfPossible(Number(pageNumber)));
  };

  useEffect(() => {
    if (status !== "ready") return undefined;
    renderStateRef.current.rendered.clear();
    const frame = requestAnimationFrame(resyncEntries);
    return () => cancelAnimationFrame(frame);
  }, [status, fitWidth, zoomIndex]);

  useEffect(() => {
    if (status !== "ready") return undefined;
    const container = containerRef.current;
    if (!container) return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        const state = renderStateRef.current;
        let changed = false;
        entries.forEach((entry) => {
          const pageNumber = Number(entry.target.dataset.pageNumber);
          if (entry.isIntersecting) {
            if (!state.visible.has(pageNumber)) { state.visible.add(pageNumber); changed = true; }
          } else if (state.visible.delete(pageNumber)) {
            changed = true;
          }
        });
        if (changed) resyncEntries();
      },
      { root: container, rootMargin: "90px 0px" },
    );
    entriesRef.current.forEach((entry) => {
      if (entry?.node) observer.observe(entry.node);
    });
    return () => observer.disconnect();
  }, [status, numPages]);

  const onScroll = () => {
    const container = containerRef.current;
    if (!container || !numPages) return;
    const center = container.scrollTop + container.clientHeight / 2;
    let active = 1;
    entriesRef.current.forEach((entry, pageNumber) => {
      if (!entry?.node) return;
      const rect = entry.node.getBoundingClientRect();
      if (rect.top <= center && rect.bottom > center) active = pageNumber;
    });
    setCurrentPage(active);
  };

  const goToPage = (delta) => {
    const target = Math.min(numPages, Math.max(1, currentPage + delta));
    setCurrentPage(target);
    entriesRef.current.get(target)?.node?.scrollIntoView({ block: "start" });
  };

  const goToPageDirect = (value) => {
    const pageNumber = Math.min(numPages, Math.max(1, Math.round(Number(value)) || 1));
    setCurrentPage(pageNumber);
    entriesRef.current.get(pageNumber)?.node?.scrollIntoView({ block: "start" });
  };

  const registerEntry = (pageNumber) => (node) => {
    if (!node) {
      entriesRef.current.delete(pageNumber);
      return;
    }
    const existing = entriesRef.current.get(pageNumber);
    entriesRef.current.set(pageNumber, { ...(existing || {}), node });
  };
  const registerCanvas = (pageNumber) => (canvas) => {
    const entry = entriesRef.current.get(pageNumber);
    entriesRef.current.set(pageNumber, { ...(entry || {}), canvas });
    if (canvas && status === "ready") requestAnimationFrame(() => renderPageIfPossible(pageNumber));
  };

  const totalPages = numPages;
  const currentZoomPercent = Math.round(zoomMultiplier * 100);

  if (status === "empty") {
    return (
      <div className="file-empty-state">
        <h2>Local content unavailable</h2>
        <p>The PDF data is missing from this copy. Choose the file again to reconnect it.</p>
        {onChooseFile ? <button type="button" onClick={onChooseFile}>Choose local file</button> : null}
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="file-empty-state">
        <h2>PDF could not be read</h2>
        <p>{error}</p>
        {onChooseFile ? <button type="button" onClick={onChooseFile}>Choose local file</button> : null}
      </div>
    );
  }

  if (status !== "ready") {
    return (
      <div className="pdf-loading" aria-label={`Preparing ${title}`}>
        <span className="pdf-loading-spinner" aria-hidden="true" />
        <span>Preparing PDF</span>
      </div>
    );
  }

  return (
    <div className="pdf-reader" aria-label={title}>
      <div className="pdf-toolbar">
        <button type="button" onClick={() => goToPage(-1)} disabled={currentPage <= 1} aria-label="Previous page">
          <IconChevronLeft size={13} stroke={1.7} />
        </button>
        <button type="button" onClick={() => goToPage(1)} disabled={currentPage >= totalPages} aria-label="Next page">
          <IconChevronRight size={13} stroke={1.7} />
        </button>
        <span className="pdf-page-indicator">
          Page&nbsp;<input className="pdf-page-input" type="text" inputMode="numeric" value={currentPage} onChange={(event) => goToPageDirect(event.target.value)} aria-label="Current page number" />&nbsp;of&nbsp;{totalPages}
        </span>
        <span className="file-toolbar-spacer" />
        <button type="button" onClick={() => setZoomIndex((index) => Math.max(0, index - 1))} disabled={zoomIndex <= 0} aria-label="Zoom out">
          <IconZoomOut size={13} stroke={1.7} />
        </button>
        <span className="pdf-zoom-label">{currentZoomPercent}%</span>
        <button type="button" onClick={() => setZoomIndex((index) => Math.min(ZOOM_STEPS.length - 1, index + 1))} disabled={zoomIndex >= ZOOM_STEPS.length - 1} aria-label="Zoom in">
          <IconZoomIn size={13} stroke={1.7} />
        </button>
      </div>
      <div className="pdf-scroll" ref={containerRef} onScroll={onScroll}>
        {Array.from({ length: totalPages }, (_, index) => index + 1).map((pageNumber) => (
          <div key={pageNumber} className="pdf-page" data-page-number={pageNumber} ref={registerEntry(pageNumber)}>
            <canvas ref={registerCanvas(pageNumber)} aria-label={`Page ${pageNumber}`} />
          </div>
        ))}
      </div>
    </div>
  );
}