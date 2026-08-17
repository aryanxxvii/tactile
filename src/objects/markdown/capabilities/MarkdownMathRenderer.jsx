import katex from "katex";
import "katex/dist/katex.min.css";

const CACHE_LIMIT = 256;
const renderedExpressions = new Map();

function cachedMath(expression, display) {
  const key = `${display ? "display" : "inline"}\u0000${expression}`;
  const cached = renderedExpressions.get(key);
  if (cached) {
    renderedExpressions.delete(key);
    renderedExpressions.set(key, cached);
    return cached;
  }
  const html = katex.renderToString(expression, {
    displayMode: display,
    output: "htmlAndMathml",
    strict: "warn",
    throwOnError: true,
    trust: false,
  });
  renderedExpressions.set(key, html);
  if (renderedExpressions.size > CACHE_LIMIT) renderedExpressions.delete(renderedExpressions.keys().next().value);
  return html;
}

export default function MarkdownMathRenderer({ expression, display, source }) {
  try {
    const html = cachedMath(expression, display);
    return <span className="markdown-math-rendered" dangerouslySetInnerHTML={{ __html: html }} />;
  } catch {
    return <span className="markdown-math-error" role="note" aria-label="Invalid math expression">{source}</span>;
  }
}