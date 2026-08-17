import {
  ObjectHeader,
  PaperPortal,
  React,
  codeLanguageForExtension,
  getCodeRuntimeProfile,
  resolveTauriInvoke,
  useEffect,
  useLocalDraft,
  useMemo,
  useRef,
  useState,
} from "tactile:host";
import {
  IconBrackets,
  IconChevronDown,
  IconLanguage,
  IconPlayerPlay,
  IconSquareCheck,
  IconTerminal2,
  IconTrash,
} from "@tabler/icons-react";
import { CodeEditor } from "./CodeEditor.jsx";
import { prepareBrowserSource } from "./execution.js";
import "./CodeObject.css";

const LANGUAGE_LABELS = {
  javascript: "JavaScript",
  jsx: "JSX",
  typescript: "TypeScript",
  tsx: "TSX",
  python: "Python",
  c: "C",
  cpp: "C++",
  java: "Java",
  rust: "Rust",
  go: "Go",
  ruby: "Ruby",
  bash: "Bash",
  json: "JSON",
  sql: "SQL",
  html: "HTML",
  css: "CSS",
  plaintext: "Plain text",
};

const KEYWORDS = {
  javascript: [
    "async",
    "await",
    "break",
    "case",
    "catch",
    "class",
    "const",
    "continue",
    "debugger",
    "default",
    "delete",
    "do",
    "else",
    "export",
    "extends",
    "finally",
    "for",
    "from",
    "function",
    "get",
    "if",
    "import",
    "in",
    "instanceof",
    "let",
    "new",
    "of",
    "return",
    "set",
    "static",
    "super",
    "switch",
    "this",
    "throw",
    "try",
    "typeof",
    "var",
    "void",
    "while",
    "with",
    "yield",
    "true",
    "false",
    "null",
    "undefined",
  ],
  jsx: [
    "async",
    "await",
    "break",
    "case",
    "catch",
    "class",
    "const",
    "continue",
    "default",
    "delete",
    "do",
    "else",
    "export",
    "extends",
    "finally",
    "for",
    "from",
    "function",
    "if",
    "import",
    "in",
    "instanceof",
    "let",
    "new",
    "return",
    "static",
    "super",
    "switch",
    "this",
    "throw",
    "try",
    "typeof",
    "var",
    "void",
    "while",
    "yield",
    "true",
    "false",
    "null",
    "undefined",
  ],
  typescript: [
    "abstract",
    "any",
    "as",
    "asserts",
    "async",
    "await",
    "break",
    "case",
    "catch",
    "class",
    "const",
    "continue",
    "declare",
    "default",
    "delete",
    "do",
    "else",
    "enum",
    "export",
    "extends",
    "finally",
    "for",
    "from",
    "function",
    "get",
    "if",
    "implements",
    "import",
    "in",
    "infer",
    "instanceof",
    "interface",
    "is",
    "keyof",
    "let",
    "namespace",
    "never",
    "new",
    "of",
    "private",
    "protected",
    "public",
    "readonly",
    "return",
    "satisfies",
    "set",
    "static",
    "super",
    "switch",
    "this",
    "throw",
    "try",
    "type",
    "typeof",
    "unknown",
    "var",
    "void",
    "while",
    "with",
    "yield",
    "true",
    "false",
    "null",
    "undefined",
  ],
  tsx: [
    "abstract",
    "any",
    "as",
    "async",
    "await",
    "break",
    "case",
    "catch",
    "class",
    "const",
    "continue",
    "declare",
    "default",
    "delete",
    "do",
    "else",
    "enum",
    "export",
    "extends",
    "finally",
    "for",
    "from",
    "function",
    "if",
    "implements",
    "import",
    "in",
    "infer",
    "instanceof",
    "interface",
    "keyof",
    "let",
    "namespace",
    "never",
    "new",
    "return",
    "static",
    "super",
    "switch",
    "this",
    "throw",
    "try",
    "type",
    "typeof",
    "unknown",
    "var",
    "void",
    "while",
    "yield",
    "true",
    "false",
    "null",
    "undefined",
  ],
  python: [
    "and",
    "as",
    "assert",
    "async",
    "await",
    "break",
    "class",
    "continue",
    "def",
    "del",
    "elif",
    "else",
    "except",
    "False",
    "finally",
    "for",
    "from",
    "global",
    "if",
    "import",
    "in",
    "is",
    "lambda",
    "None",
    "nonlocal",
    "not",
    "or",
    "pass",
    "raise",
    "return",
    "True",
    "try",
    "while",
    "with",
    "yield",
  ],
  c: [
    "auto",
    "break",
    "case",
    "char",
    "const",
    "continue",
    "default",
    "do",
    "double",
    "else",
    "enum",
    "extern",
    "float",
    "for",
    "goto",
    "if",
    "inline",
    "int",
    "long",
    "register",
    "restrict",
    "return",
    "short",
    "signed",
    "sizeof",
    "static",
    "struct",
    "switch",
    "typedef",
    "union",
    "unsigned",
    "void",
    "volatile",
    "while",
    "true",
    "false",
    "NULL",
  ],
  cpp: [
    "alignas",
    "alignof",
    "and",
    "asm",
    "auto",
    "bool",
    "break",
    "case",
    "catch",
    "char",
    "char8_t",
    "char16_t",
    "char32_t",
    "class",
    "const",
    "consteval",
    "constexpr",
    "constinit",
    "continue",
    "decltype",
    "default",
    "delete",
    "do",
    "double",
    "dynamic_cast",
    "else",
    "enum",
    "explicit",
    "export",
    "extern",
    "false",
    "float",
    "for",
    "friend",
    "goto",
    "if",
    "inline",
    "int",
    "long",
    "mutable",
    "namespace",
    "new",
    "noexcept",
    "not",
    "nullptr",
    "operator",
    "private",
    "protected",
    "public",
    "register",
    "reinterpret_cast",
    "requires",
    "return",
    "short",
    "signed",
    "sizeof",
    "static",
    "static_cast",
    "struct",
    "switch",
    "template",
    "this",
    "thread_local",
    "throw",
    "true",
    "try",
    "typedef",
    "typeid",
    "typename",
    "union",
    "unsigned",
    "using",
    "virtual",
    "void",
    "volatile",
    "wchar_t",
    "while",
  ],
  java: [
    "abstract",
    "assert",
    "boolean",
    "break",
    "byte",
    "case",
    "catch",
    "char",
    "class",
    "const",
    "continue",
    "default",
    "do",
    "double",
    "else",
    "enum",
    "extends",
    "final",
    "finally",
    "float",
    "for",
    "goto",
    "if",
    "implements",
    "import",
    "instanceof",
    "int",
    "interface",
    "long",
    "native",
    "new",
    "package",
    "private",
    "protected",
    "public",
    "return",
    "short",
    "static",
    "strictfp",
    "super",
    "switch",
    "synchronized",
    "this",
    "throw",
    "throws",
    "transient",
    "try",
    "var",
    "void",
    "volatile",
    "while",
    "true",
    "false",
    "null",
  ],
  rust: [
    "as",
    "async",
    "await",
    "break",
    "const",
    "continue",
    "crate",
    "dyn",
    "else",
    "enum",
    "extern",
    "false",
    "fn",
    "for",
    "if",
    "impl",
    "in",
    "let",
    "loop",
    "match",
    "mod",
    "move",
    "mut",
    "pub",
    "ref",
    "return",
    "self",
    "Self",
    "static",
    "struct",
    "super",
    "trait",
    "true",
    "type",
    "unsafe",
    "use",
    "where",
    "while",
  ],
  go: [
    "break",
    "case",
    "chan",
    "const",
    "continue",
    "default",
    "defer",
    "else",
    "fallthrough",
    "for",
    "func",
    "go",
    "goto",
    "if",
    "import",
    "interface",
    "map",
    "package",
    "range",
    "return",
    "select",
    "struct",
    "switch",
    "type",
    "var",
    "true",
    "false",
    "nil",
  ],
  ruby: [
    "BEGIN",
    "END",
    "alias",
    "and",
    "begin",
    "break",
    "case",
    "class",
    "def",
    "defined?",
    "do",
    "else",
    "elsif",
    "end",
    "ensure",
    "false",
    "for",
    "if",
    "in",
    "module",
    "next",
    "nil",
    "not",
    "or",
    "redo",
    "rescue",
    "retry",
    "return",
    "self",
    "super",
    "then",
    "true",
    "undef",
    "unless",
    "until",
    "when",
    "while",
    "yield",
  ],
  bash: [
    "if",
    "then",
    "else",
    "elif",
    "fi",
    "for",
    "while",
    "until",
    "do",
    "done",
    "case",
    "esac",
    "function",
    "in",
    "select",
    "return",
    "local",
    "export",
    "source",
    "shift",
    "true",
    "false",
  ],
  sql: [
    "select",
    "from",
    "where",
    "insert",
    "into",
    "values",
    "update",
    "set",
    "delete",
    "create",
    "table",
    "database",
    "alter",
    "drop",
    "index",
    "view",
    "join",
    "inner",
    "left",
    "right",
    "outer",
    "on",
    "as",
    "and",
    "or",
    "not",
    "null",
    "is",
    "in",
    "between",
    "like",
    "order",
    "by",
    "group",
    "having",
    "limit",
    "offset",
    "union",
    "all",
    "distinct",
    "primary",
    "key",
    "foreign",
    "references",
    "default",
    "unique",
    "constraint",
    "check",
  ],
  html: [
    "html",
    "head",
    "body",
    "div",
    "span",
    "a",
    "img",
    "script",
    "style",
    "link",
    "meta",
    "title",
    "p",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "ul",
    "ol",
    "li",
    "table",
    "thead",
    "tbody",
    "tr",
    "td",
    "th",
    "form",
    "input",
    "button",
    "select",
    "option",
    "textarea",
    "iframe",
    "br",
    "hr",
    "nav",
    "header",
    "footer",
    "main",
    "section",
    "article",
    "aside",
    "blockquote",
    "pre",
    "code",
    "strong",
    "em",
  ],
  css: [
    "color",
    "background",
    "background-color",
    "border",
    "margin",
    "padding",
    "display",
    "position",
    "top",
    "right",
    "bottom",
    "left",
    "width",
    "height",
    "font",
    "font-size",
    "font-family",
    "font-weight",
    "line-height",
    "text-align",
    "text-decoration",
    "float",
    "clear",
    "overflow",
    "z-index",
    "opacity",
    "transition",
    "transform",
    "flex",
    "grid",
    "align-items",
    "justify-content",
    "cursor",
    "box-shadow",
  ],
  json: ["true", "false", "null"],
};

const DEFAULT_KEYWORDS = [
  "if",
  "else",
  "for",
  "while",
  "return",
  "function",
  "class",
  "const",
  "let",
  "var",
  "true",
  "false",
  "null",
  "undefined",
  "import",
  "export",
  "from",
  "new",
  "this",
  "try",
  "catch",
  "throw",
  "switch",
  "case",
  "break",
  "continue",
];

const ESCAPE_RE = /[&<>"']/g;
const ESCAPE_MAP = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

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
      try {
        const fn = new Function("console", event.data.source);
        const result = await fn(self.console);
        if (result !== undefined) postMessage({ type: "out", text: String(result) });
        postMessage({ type: "done" });
      } catch (error) {
        postMessage({ type: "err", text: String(error && error.stack || error) });
        postMessage({ type: "done" });
      }
    };
  `;
  const blob = new Blob([workerCode], { type: "application/javascript" });
  const url = URL.createObjectURL(blob);
  const worker = new Worker(url);
  let settled = false;
  const dispose = () => {
    if (settled) return false;
    settled = true;
    window.clearTimeout(timer);
    worker.terminate();
    URL.revokeObjectURL(url);
    return true;
  };
  const finish = () => {
    if (dispose()) onDone();
  };
  const timer = window.setTimeout(() => {
    onMessage({ type: "timeout" });
    finish();
  }, timeoutMs);
  worker.onmessage = (event) => {
    if (settled) return;
    if (event.data.type === "done") {
      finish();
      return;
    }
    onMessage(event.data);
  };
  worker.onerror = (event) => {
    if (settled) return;
    onMessage({ type: "err", text: String(event.message || "Unknown worker error") });
    finish();
  };
  worker.postMessage({ source });
  return dispose;
}

function languageRunsInBrowser(language) {
  return language === "javascript" || language === "jsx" || language === "typescript" || language === "tsx";
}

function languageRunsNatively(language) {
  return ["python", "c", "cpp", "java", "rust", "go", "ruby", "bash"].includes(language);
}

function languageCanRun(language) {
  return languageRunsInBrowser(language) || languageRunsNatively(language);
}

function LanguageMenu({ value, options, onChange, disabled = false }) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const selected = options.find((option) => option.value === value) || options[0];

  useEffect(() => {
    if (!open) return undefined;
    const closeOutside = (event) => {
      if (!triggerRef.current?.contains(event.target) && !menuRef.current?.contains(event.target)) setOpen(false);
    };
    window.addEventListener("pointerdown", closeOutside);
    window.requestAnimationFrame(() => menuRef.current?.querySelector('[data-selected="true"]')?.focus());
    return () => window.removeEventListener("pointerdown", closeOutside);
  }, [open]);

  useEffect(() => {
    if (!open || !position) return undefined;
    const updatePosition = () => {
      const menu = menuRef.current;
      const trigger = triggerRef.current;
      if (!menu || !trigger) return;
      const rect = trigger.getBoundingClientRect();
      const width = menu.offsetWidth || 180;
      const height = menu.offsetHeight || 200;
      const gutter = 8;
      const gap = 6;
      const left = Math.max(gutter, Math.min(rect.left, window.innerWidth - width - gutter));
      const below = rect.bottom + gap;
      const above = rect.top - gap - height;
      const top =
        below + height <= window.innerHeight - gutter
          ? below
          : above >= gutter
            ? above
            : Math.max(gutter, Math.min(below, window.innerHeight - height - gutter));
      setPosition((current) => (current && current.left === left && current.top === top ? current : { left, top }));
    };
    updatePosition();
    const frame = window.requestAnimationFrame(updatePosition);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, position]);

  const openMenu = () => {
    const rect = triggerRef.current?.getBoundingClientRect();
    setPosition({ left: rect ? Math.max(8, rect.left) : 0, top: rect ? rect.bottom + 6 : 0 });
    setOpen(true);
  };

  const selectOption = (option) => {
    onChange(option.value);
    setOpen(false);
    triggerRef.current?.focus();
  };

  const handleMenuKeyDown = (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      triggerRef.current?.focus();
      return;
    }
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    event.stopPropagation();
    const buttons = [...(menuRef.current?.querySelectorAll("button") || [])];
    const activeIndex = buttons.indexOf(document.activeElement);
    const nextIndex =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? buttons.length - 1
          : (activeIndex + (event.key === "ArrowDown" ? 1 : -1) + buttons.length) % buttons.length;
    buttons[nextIndex]?.focus();
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="code-language-trigger"
        aria-label="Language"
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openMenu())}
      >
        <IconLanguage size={14} stroke={1.6} />
        <span>{selected.label}</span>
        <IconChevronDown size={13} stroke={1.7} />
      </button>
      {open && position ? (
        <PaperPortal className="tactile-code-menu-layer" themeSource={triggerRef.current}>
          <div
            ref={menuRef}
            className="code-language-menu"
            role="listbox"
            aria-label="Language"
            style={{ left: position.left, top: position.top }}
            onKeyDown={handleMenuKeyDown}
          >
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={option.value === value}
                data-selected={option.value === value}
                className={option.value === value ? "is-selected" : ""}
                onClick={() => selectOption(option)}
              >
                <span>{option.label}</span>
                {option.detail ? <small>{option.detail}</small> : null}
                {option.value === value ? <IconSquareCheck size={13} stroke={1.8} /> : null}
              </button>
            ))}
          </div>
        </PaperPortal>
      ) : null}
    </>
  );
}

export function CodeObject({
  object,
  path,
  saveState,
  onUpdateObject,
  onBack,
  canGoBack,
  workspaceActions,
  onReparentObject,
}) {
  const canonicalContent = object.content || "";
  const contentSession = useLocalDraft(canonicalContent, (next) => onUpdateObject({ content: next }));
  const content = contentSession.draft;
  const language = object.language || codeLanguageForExtension(object.extension) || "plaintext";
  const [running, setRunning] = useState(false);
  const [lines, setLines] = useState([]);
  const terminateRef = useRef(null);

  const languageLabel = LANGUAGE_LABELS[language] || language;
  const languageOptions = useMemo(
    () => Object.entries(LANGUAGE_LABELS).map(([key, label]) => ({ value: key, label })),
    [],
  );
  const [outputHeight, setOutputHeight] = useState(176);
  const shellRef = useRef(null);
  const resizingRef = useRef(null);

  useEffect(
    () => () => {
      terminateRef.current?.();
    },
    [],
  );
  useEffect(() => {
    if (running)
      setLines((current) => (current.length ? current : [{ kind: "meta", text: `Running ${languageLabel}…` }]));
  }, [running, languageLabel]);

  const commitContent = () => contentSession.commitDraft(contentSession.draftRef.current);
  const handleBack = () => {
    commitContent();
    onBack?.();
  };

  const appendLine = (item) => setLines((current) => [...current, item]);

  const handleRun = async () => {
    if (running) {
      terminateRef.current?.();
      setRunning(false);
      setLines((current) => [...current, { kind: "meta", text: "Stopped." }]);
      return;
    }
    setLines([]);
    setRunning(true);
    const source = contentSession.draftRef.current;
    const normalized = normalizeSourceForRun(source, language);
    const runLanguage = normalized.language;
    let runSource = normalized.source;
    if (languageRunsInBrowser(runLanguage)) {
      try {
        runSource = prepareBrowserSource(runSource, runLanguage);
      } catch (error) {
        setRunning(false);
        setLines([{ kind: "err", text: `Transform failed: ${String(error?.message || error)}` }]);
        return;
      }
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
      setLines([
        {
          kind: "err",
          text: `${languageLabel} cannot run in the browser preview. Open Tactile Desktop to use the compiler or interpreter installed on this device.`,
        },
      ]);
      return;
    }
    try {
      const result = await invoke("workspace_run_code", {
        language: runLanguage,
        source: runSource,
        timeoutMs: 12000,
        executablePaths: getCodeRuntimeProfile().paths,
      });
      const output = [];
      if (result?.timedOut)
        output.push({
          kind: "err",
          text: `Execution timed out after ${Math.round((result.timeoutMs || 12000) / 1000)}s.`,
        });
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

  const beginResize = (event) => {
    const shell = shellRef.current;
    if (!shell || event.button !== 0) return;
    event.preventDefault();
    const startY = event.clientY;
    const startHeight = outputHeight;
    const shellHeight = shell.getBoundingClientRect().height;
    const onMove = (moveEvent) => {
      const next = startHeight + (startY - moveEvent.clientY);
      setOutputHeight(Math.max(72, Math.min(next, shellHeight - 160)));
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      document.body.classList.remove("code-resizing");
    };
    document.body.classList.add("code-resizing");
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

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
            <LanguageMenu value={language} options={languageOptions} onChange={handleLanguageChange} />
          </div>
          <div className="code-toolbar-actions">
            <button
              type="button"
              className={`code-run-button${running ? " is-running" : ""}`}
              disabled={!languageCanRun(language)}
              data-tooltip={
                running ? "Stop" : languageCanRun(language) ? `Run ${languageLabel}` : `${languageLabel} is editor only`
              }
              onClick={handleRun}
            >
              {running ? <IconSquareCheck size={14} stroke={1.9} /> : <IconPlayerPlay size={14} stroke={1.9} />}
              {running ? "Stop" : "Run"}
            </button>
            <button
              className="code-clear-button"
              type="button"
              data-tooltip="Clear output"
              onClick={() => setLines([])}
            >
              <IconTrash size={14} stroke={1.7} />
            </button>
          </div>
        </div>

        <div ref={shellRef} className="code-editor-shell">
          <div className="code-editor-surface">
            <CodeEditor
              value={content}
              language={language}
              ariaLabel={`${object.title} code editor`}
              onChange={contentSession.updateDraft}
              onBlur={commitContent}
            />
          </div>
          <div
            className="code-output-resizer"
            role="separator"
            aria-orientation="horizontal"
            aria-label="Resize output"
            onPointerDown={beginResize}
          />
          <div className={`code-output${lines.length ? "" : " is-empty"}`} style={{ height: outputHeight }}>
            <div className="code-output-header">
              <IconTerminal2 size={13} stroke={1.6} /> Output
            </div>
            {lines.length ? (
              <pre className="code-output-body">
                {lines.map((line, index) => (
                  <div key={index} className={`code-out-line ${line.kind}`}>
                    {line.text}
                  </div>
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
        <span className="status-item">
          <IconLanguage size={14} stroke={1.55} /> {languageLabel}
        </span>
        <span className="status-divider">·</span>
        <span className="status-item keyboard-hint">
          <IconBrackets size={14} stroke={1.6} /> <kbd>[</kbd> out
        </span>
      </footer>
    </article>
  );
}
