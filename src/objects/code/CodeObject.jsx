import { useEffect, useMemo, useRef, useState } from "react";
import {
  IconArrowBigRightLine,
  IconBrackets,
  IconLanguage,
  IconSquareCheck,
  IconTerminal2,
  IconTrash,
} from "@tabler/icons-react";
import { ObjectHeader } from "../../components/ObjectHeader.jsx";
import { useLocalDraft } from "../../components/localEditSession.js";
import { codeLanguageForExtension } from "../../model.js";
import { resolveTauriInvoke } from "../../platform/tauri/runtime.ts";

const LANGUAGE_LABELS = {
  javascript: "JavaScript", jsx: "JSX", typescript: "TypeScript", tsx: "TSX",
  python: "Python", c: "C", cpp: "C++", java: "Java", rust: "Rust",
  go: "Go", ruby: "Ruby", bash: "Bash", json: "JSON", sql: "SQL",
  html: "HTML", css: "CSS", plaintext: "Plain text",
};

const KEYWORDS = {
  javascript: ["async", "await", "break", "case", "catch", "class", "const", "continue", "debugger", "default", "delete", "do", "else", "export", "extends", "finally", "for", "from", "function", "get", "if", "import", "in", "instanceof", "let", "new", "of", "return", "set", "static", "super", "switch", "this", "throw", "try", "typeof", "var", "void", "while", "with", "yield", "true", "false", "null", "undefined"],
  jsx: ["async", "await", "break", "case", "catch", "class", "const", "continue", "default", "delete", "do", "else", "export", "extends", "finally", "for", "from", "function", "if", "import", "in", "instanceof", "let", "new", "return", "static", "super", "switch", "this", "throw", "try", "typeof", "var", "void", "while", "yield", "true", "false", "null", "undefined"],
  typescript: ["abstract", "any", "as", "asserts", "async", "await", "break", "case", "catch", "class", "const", "continue", "declare", "default", "delete", "do", "else", "enum", "export", "extends", "finally", "for", "from", "function", "get", "if", "implements", "import", "in", "infer", "instanceof", "interface", "is", "keyof", "let", "namespace", "never", "new", "of", "private", "protected", "public", "readonly", "return", "satisfies", "set", "static", "super", "switch", "this", "throw", "try", "type", "typeof", "unknown", "var", "void", "while", "with", "yield", "true", "false", "null", "undefined"],
  tsx: ["abstract", "any", "as", "async", "await", "break", "case", "catch", "class", "const", "continue", "declare", "default", "delete", "do", "else", "enum", "export", "extends", "finally", "for", "from", "function", "if", "implements", "import", "in", "infer", "instanceof", "interface", "keyof", "let", "namespace", "never", "new", "return", "static", "super", "switch", "this", "throw", "try", "type", "typeof", "unknown", "var", "void", "while", "yield", "true", "false", "null", "undefined"],
  python: ["and", "as", "assert", "async", "await", "break", "class", "continue", "def", "del", "elif", "else", "except", "False", "finally", "for", "from", "global", "if", "import", "in", "is", "lambda", "None", "nonlocal", "not", "or", "pass", "raise", "return", "True", "try", "while", "with", "yield"],
  c: ["auto", "break", "case", "char", "const", "continue", "default", "do", "double", "else", "enum", "extern", "float", "for", "goto", "if", "inline", "int", "long", "register", "restrict", "return", "short", "signed", "sizeof", "static", "struct", "switch", "typedef", "union", "unsigned", "void", "volatile", "while", "true", "false", "NULL"],
  cpp: ["alignas", "alignof", "and", "asm", "auto", "bool", "break", "case", "catch", "char", "char8_t", "char16_t", "char32_t", "class", "const", "consteval", "constexpr", "constinit", "continue", "decltype", "default", "delete", "do", "double", "dynamic_cast", "else", "enum", "explicit", "export", "extern", "false", "float", "for", "friend", "goto", "if", "inline", "int", "long", "mutable", "namespace", "new", "noexcept", "not", "nullptr", "operator", "private", "protected", "public", "register", "reinterpret_cast", "requires", "return", "short", "signed", "sizeof", "static", "static_cast", "struct", "switch", "template", "this", "thread_local", "throw", "true", "try", "typedef", "typeid", "typename", "union", "unsigned", "using", "virtual", "void", "volatile", "wchar_t", "while"],
  java: ["abstract", "assert", "boolean", "break", "byte", "case", "catch", "char", "class", "const", "continue", "default", "do", "double", "else", "enum", "extends", "final", "finally", "float", "for", "goto", "if", "implements", "import", "instanceof", "int", "interface", "long", "native", "new", "package", "private", "protected", "public", "return", "short", "static", "strictfp", "super", "switch", "synchronized", "this", "throw", "throws", "transient", "try", "var", "void", "volatile", "while", "true", "false", "null"],
  rust: ["as", "async", "await", "break", "const", "continue", "crate", "dyn", "else", "enum", "extern", "false", "fn", "for", "if", "impl", "in", "let", "loop", "match", "mod", "move", "mut", "pub", "ref", "return", "self", "Self", "static", "struct", "super", "trait", "true", "type", "unsafe", "use", "where", "while"],
  go: ["break", "case", "chan", "const", "continue", "default", "defer", "else", "fallthrough", "for", "func", "go", "goto", "if", "import", "interface", "map", "package", "range", "return", "select", "struct", "switch", "type", "var", "true", "false", "nil"],
  ruby: ["BEGIN", "END", "alias", "and", "begin", "break", "case", "class", "def", "defined?", "do", "else", "elsif", "end", "ensure", "false", "for", "if", "in", "module", "next", "nil", "not", "or", "redo", "rescue", "retry", "return", "self", "super", "then", "true", "undef", "unless", "until", "when", "while", "yield"],
  bash: ["if", "then", "else", "elif", "fi", "for", "while", "until", "do", "done", "case", "esac", "function", "in", "select", "return", "local", "export", "source", "shift", "true", "false"],
  sql: ["select", "from", "where", "insert", "into", "values", "update", "set", "delete", "create", "table", "database", "alter", "drop", "index", "view", "join", "inner", "left", "right", "outer", "on", "as", "and", "or", "not", "null", "is", "in", "between", "like", "order", "by", "group", "having", "limit", "offset", "union", "all", "distinct", "primary", "key", "foreign", "references", "default", "unique", "constraint", "check"],
  html: ["html", "head", "body", "div", "span", "a", "img", "script", "style", "link", "meta", "title", "p", "h1", "h2", "h3", "h4", "h5", "h6", "ul", "ol", "li", "table", "thead", "tbody", "tr", "td", "th", "form", "input", "button", "select", "option", "textarea", "iframe", "br", "hr", "nav", "header", "footer", "main", "section", "article", "aside", "blockquote", "pre", "code", "strong", "em"],
  css: ["color", "background", "background-color", "border", "margin", "padding", "display", "position", "top", "right", "bottom", "left", "width", "height", "font", "font-size", "font-family", "font-weight", "line-height", "text-align", "text-decoration", "float", "clear", "overflow", "z-index", "opacity", "transition", "transform", "flex", "grid", "align-items", "justify-content", "cursor", "box-shadow"],
  json: ["true", "false", "null"],
};

const DEFAULT_KEYWORDS = ["if", "else", "for", "while", "return", "function", "class", "const", "let", "var", "true", "false", "null", "undefined", "import", "export", "from", "new", "this", "try", "catch", "throw", "switch", "case", "break", "continue"];

const ESCAPE_RE = /[&<>"']/g;
const ESCAPE_MAP = { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" };

function escapeHtml(text) {
  return text.replace(ESCAPE_RE, (char) => ESCAPE_MAP[char]);
}

/**
 * A compact, dependency-free highlighter. It tokenizes the raw source with a
 * combined regex and emits escaped HTML. It is not a full grammar, but it gives
 * clear, consistent coloring for strings, comments, keywords, numbers, tags and
 * identifiers across the supported language families without shipping a
 * highlighter dependency or making network requests.
 */
function highlight(code, language) {
  const source = String(code || "");
  if (!source) return "";
  const keywords = new Set(KEYWORDS[language] || DEFAULT_KEYWORDS);
  const isTagLang = language === "html" || language === "jsx" || language === "tsx" || language === "css";
  const pattern = new RegExp(
    [
      "(\\/\\*[\\s\\S]*?\\*\\/|\\/\\/[^\\n]*|#[^\\n]*|--[^\\n]*|\\/\\/[^\\n]*?)", // comment
      "(`(?:[^`\\\\]|\\\\.)*`|\"(?:[^\"\\\\]|\\\\.)*\"|'(?:[^'\\\\]|\\\\.)*'|\"\"\"[\\s\\S]*?\"\"\"|'''[\\s\\S]*?''')", // string
      "([A-Za-z_$][A-Za-z0-9_$]*)\\s*(?=\\()", // function call
      "([A-Za-z_$][A-Za-z0-9_$]*)", // identifier
      "(\\b(?:0[xX][0-9a-fA-F]+|\\d+(?:\\.\\d+)?(?:[eE][+-]?\\d+)?)\\b)", // number
      "(<\\/?[A-Za-z][A-Za-z0-9-]*|\\/?>)", // tag punctuation
    ].join("|"),
    "g",
  );
  const parts = [];
  let lastIndex = 0;
  let match;
  while ((match = pattern.exec(source))) {
    if (match.index > lastIndex) parts.push(escapeHtml(source.slice(lastIndex, match.index)));
    const [full, comment, string, fnName, identifier, number, tag] = match;
    if (comment) {
      parts.push(`<span class="code-tok-comment">${escapeHtml(comment)}</span>`);
    } else if (string) {
      parts.push(`<span class="code-tok-string">${escapeHtml(string)}</span>`);
    } else if (fnName && !keywords.has(fnName)) {
      parts.push(`<span class="code-tok-function">${escapeHtml(fnName)}</span>`);
    } else if (identifier) {
      if (keywords.has(identifier)) {
        parts.push(`<span class="code-tok-keyword">${escapeHtml(identifier)}</span>`);
      } else if (number && /^\d/.test(identifier)) {
        parts.push(`<span class="code-tok-number">${escapeHtml(identifier)}</span>`);
      } else {
        parts.push(escapeHtml(identifier));
      }
    } else if (number) {
      parts.push(`<span class="code-tok-number">${escapeHtml(number)}</span>`);
    } else if (tag && isTagLang) {
      parts.push(`<span class="code-tok-tag">${escapeHtml(tag)}</span>`);
    } else {
      parts.push(escapeHtml(full));
    }
    lastIndex = pattern.lastIndex;
  }
  if (lastIndex < source.length) parts.push(escapeHtml(source.slice(lastIndex)));
  return parts.join("");
}

function normalizeSourceForRun(content, language) {
  if (language !== "python" || !/^\s*\{/.test(content)) return { language, source: content };
  // A notebook embeds its source as JSON; run its code cells as one script.
  try {
    const notebook = JSON.parse(content);
    const cells = Array.isArray(notebook.cells) ? notebook.cells : [];
    const source = cells
      .filter((cell) => cell && cell.cell_type === "code")
      .map((cell) => (Array.isArray(cell.source) ? cell.source.join("") : String(cell.source || "")))
      .join("\n");
    return { language: "python", source: source || content };
  } catch {
    return { language: "python", source: content };
  }
}

function runJavaScriptInWorker(source, onMessage, onDone, timeoutMs) {
  const workerCode = `
    self.console = {
      log: (...args) => postMessage({ type: "out", text: args.map(String).join(" ") }),
      info: (...args) => postMessage({ type: "out", text: args.map(String).join(" ") }),
      warn: (...args) => postMessage({ type: "warn", text: args.map(String).join(" ") }),
      error: (...args) => postMessage({ type: "err", text: args.map(String).join(" ") }),
    };
    self.onmessage = async (event) => {
      const timer = setTimeout(() => { postMessage({ type: "timeout" }); self.close(); }, event.data.timeoutMs);
      try {
        const fn = new Function("console", event.data.source);
        const result = await fn(self.console);
        if (result !== undefined) postMessage({ type: "out", text: String(result) });
        postMessage({ type: "done" });
      } catch (error) {
        postMessage({ type: "err", text: String(error && error.stack || error) });
        postMessage({ type: "done" });
      } finally {
        clearTimeout(timer);
      }
    };
  `;
  const blob = new Blob([workerCode], { type: "application/javascript" });
  const url = URL.createObjectURL(blob);
  const worker = new Worker(url);
  worker.onmessage = (event) => {
    if (event.data.type === "done") { onDone(); return; }
    onMessage(event.data);
  };
  worker.onerror = (event) => {
    onMessage({ type: "err", text: String(event.message || "Unknown worker error") });
    onDone();
  };
  worker.postMessage({ source, timeoutMs });
  return () => {
    worker.terminate();
    URL.revokeObjectURL(url);
  };
}

function languageRunsInBrowser(language) {
  return language === "javascript" || language === "jsx" || language === "typescript" || language === "tsx";
}

export function CodeObject({ object, path, saveState, onUpdateObject, onBack, canGoBack, workspaceActions, onReparentObject }) {
  const canonicalContent = object.content || "";
  const contentSession = useLocalDraft(canonicalContent, (next) => onUpdateObject({ content: next }));
  const content = contentSession.draft;
  const language = object.language || codeLanguageForExtension(object.extension) || "plaintext";
  const textareaRef = useRef(null);
  const preRef = useRef(null);
  const [running, setRunning] = useState(false);
  const [lines, setLines] = useState([]);
  const terminateRef = useRef(null);

  const highlighted = useMemo(() => highlight(content, language), [content, language]);
  const languageLabel = LANGUAGE_LABELS[language] || language;

  useEffect(() => () => { terminateRef.current?.(); }, []);
  useEffect(() => {
    if (running) setLines((current) => current.length ? current : [{ kind: "meta", text: `Running ${languageLabel}…` }]);
  }, [running, languageLabel]);

  const commitContent = () => contentSession.commitDraft(contentSession.draftRef.current);
  const handleBack = () => { commitContent(); onBack?.(); };

  const syncScroll = () => {
    const textarea = textareaRef.current;
    const pre = preRef.current;
    if (!textarea || !pre) return;
    pre.scrollTop = textarea.scrollTop;
    pre.scrollLeft = textarea.scrollLeft;
  };

  const handleKeyDown = (event) => {
    if (event.key === "Tab") {
      event.preventDefault();
      const textarea = event.currentTarget;
      const { selectionStart, selectionEnd } = textarea;
      const next = `${content.slice(0, selectionStart)}  ${content.slice(selectionEnd)}`;
      contentSession.updateDraft(next);
      window.requestAnimationFrame(() => {
        textarea.selectionStart = textarea.selectionEnd = selectionStart + 2;
      });
    } else if (event.key === "[" && !event.ctrlKey && !event.metaKey && !event.altKey) {
      // Reserved: [ returns to parent (same as other object surfaces).
    }
  };

  const appendLine = (item) => setLines((current) => [...current, item]);

  const handleRun = async () => {
    if (running) { terminateRef.current?.(); setRunning(false); setLines((current) => [...current, { kind: "meta", text: "Stopped." }]); return; }
    setLines([]);
    setRunning(true);
    const source = contentSession.draftRef.current;
    const { language: runLanguage, source: runSource } = normalizeSourceForRun(source, language);
    if (languageRunsInBrowser(runLanguage)) {
      let output = [];
      terminateRef.current = runJavaScriptInWorker(
        runSource,
        (message) => {
          const kind = message.type === "err" || message.type === "timeout" ? "err" : "meta";
          const text = message.type === "timeout" ? "Execution timed out." : message.text;
          output.push({ kind, text });
          setLines(output);
        },
        () => {
          setRunning(false);
          if (!output.length) setLines([{ kind: "meta", text: "Finished with no output." }]);
          else setLines(output);
        },
        8000,
      );
      return;
    }
    const invoke = resolveTauriInvoke();
    if (!invoke) {
      setRunning(false);
      setLines([{ kind: "err", text: `Running ${languageLabel} requires the native app (interpreter runs on this device).` }]);
      return;
    }
    try {
      const result = await invoke("workspace_run_code", { language: runLanguage, source: runSource, timeoutMs: 12000 });
      const output = [];
      if (result?.timedOut) output.push({ kind: "err", text: `Execution timed out after ${Math.round((result.timeoutMs || 12000) / 1000)}s.` });
      if (result?.stdout) output.push({ kind: "out", text: String(result.stdout) });
      if (result?.stderr) output.push({ kind: "err", text: String(result.stderr) });
      if (result?.error) output.push({ kind: "err", text: String(result.error) });
      if (!output.length) output.push({ kind: "meta", text: `Process exited with code ${result?.exitCode ?? 0}.` });
      setLines(output);
    } catch (error) {
      setLines([{ kind: "err", text: String(error || "Unable to run code.") }]);
    } finally {
      setRunning(false);
    }
  };

  const handleLanguageChange = (nextLanguage) => onUpdateObject({ language: nextLanguage });

  return (
    <article className="object-surface code-object" data-object-type="code">
      <ObjectHeader
        object={object}
        path={path}
        saveState={saveState}
        onChange={onUpdateObject}
        onBack={handleBack}
        canGoBack={canGoBack}
        workspaceActions={workspaceActions}
        onReparentObject={onReparentObject}
      />

      <main className="code-workspace">
        <div className="code-toolbar cell-format-toolbar" aria-label="Code commands">
          <div className="cell-format-group" role="group" aria-label="Language">
            <IconLanguage size={14} stroke={1.6} />
            <select
              className="code-language-select"
              aria-label="Language"
              value={language}
              onChange={(event) => handleLanguageChange(event.target.value)}
            >
              {Object.entries(LANGUAGE_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>
          <span className="markdown-toolbar-separator" />
          <button
            type="button"
            className={running ? "is-active" : ""}
            disabled={language === "plaintext"}
            data-tooltip={running ? "Stop" : `Run ${languageLabel}`}
            onClick={handleRun}
          >
            {running ? <IconSquareCheck size={14} stroke={1.7} /> : <IconArrowBigRightLine size={14} stroke={1.7} />}
            {running ? "Stop" : "Run"}
          </button>
          <button type="button" data-tooltip="Clear output" onClick={() => setLines([])}>
            <IconTrash size={14} stroke={1.7} />
          </button>
        </div>

        <div className="code-editor-shell">
          <div className="code-editor-surface">
            <pre ref={preRef} className="code-pre" aria-hidden="true">
              <code className={`language-${language}`} dangerouslySetInnerHTML={{ __html: highlighted || "\n" }} />
            </pre>
            <textarea
              ref={textareaRef}
              className="code-input"
              value={content}
              spellCheck="false"
              autoCapitalize="off"
              autoCorrect="off"
              onChange={(event) => contentSession.updateDraft(event.target.value)}
              onScroll={syncScroll}
              onKeyDown={handleKeyDown}
              onBlur={commitContent}
              placeholder={`// ${languageLabel}`}
              aria-label={`${object.title} code editor`}
            />
          </div>
          <div className={`code-output${lines.length ? "" : " is-empty"}`}>
<div className="code-output-header">
            <IconTerminal2 size={13} stroke={1.6} /> Output
          </div>
            {lines.length ? (
              <pre className="code-output-body">
                {lines.map((line, index) => (
                  <div key={index} className={`code-out-line ${line.kind}`}>{line.text}</div>
                ))}
              </pre>
            ) : (
              <div className="code-output-empty">Run the code to see its output here.</div>
            )}
          </div>
        </div>
      </main>

      <footer className="object-statusbar">
        <span className="status-spacer" />
        <span className="status-item"><IconLanguage size={14} stroke={1.55} /> {languageLabel}</span>
        <span className="status-divider">·</span>
        <span className="status-item keyboard-hint"><IconBrackets size={14} stroke={1.6} /> <kbd>[</kbd> out</span>
      </footer>
    </article>
  );
}
