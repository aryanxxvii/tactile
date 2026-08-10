import { useEffect, useMemo, useRef, useState } from "react";
import {
  IconBlockquote,
  IconBold,
  IconBrackets,
  IconChevronDown,
  IconCheckbox,
  IconCode,
  IconColumns2,
  IconEye,
  IconFileText,
  IconH1,
  IconHighlight,
  IconItalic,
  IconLink,
  IconList,
  IconListNumbers,
  IconMinus,
  IconPhoto,
  IconPencil,
  IconPalette,
  IconStrikethrough,
  IconTable,
  IconUnderline,
} from "@tabler/icons-react";
import { AppDock } from "../../components/AppDock.jsx";
import { ObjectHeader } from "../../components/ObjectHeader.jsx";
import { renderMarkdownBlocks } from "./markdownRender.jsx";

const TEXT_COLORS = [
  { name: "Carbon", value: "#2f2c27" },
  { name: "Rust", value: "#a94530" },
  { name: "Moss", value: "#506b55" },
  { name: "Slate", value: "#3d586f" },
  { name: "Plum", value: "#725267" },
];

const HIGHLIGHT_COLORS = [
  { name: "Straw", value: "#f4e7a1" },
  { name: "Rose", value: "#f0c7bd" },
  { name: "Sage", value: "#cfe0cc" },
  { name: "Sky", value: "#cbdde9" },
  { name: "Clay", value: "#e8d0bd" },
];

function MarkdownColorControl({ label, colors, icon: Icon, onSelect }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const close = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [open]);

  return (
    <div className="markdown-color-control" ref={rootRef}>
      <button
        className={open ? "is-active" : ""}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        title={label}
        onClick={() => setOpen((current) => !current)}
      >
        <Icon size={15} stroke={1.7} />
        <IconChevronDown className="markdown-color-chevron" size={9} stroke={1.8} />
      </button>
      {open ? (
        <div className="markdown-color-menu" role="menu" aria-label={label}>
          <div className="markdown-color-menu-title">{label}</div>
          <div className="markdown-color-grid">
            {colors.map((color) => (
              <button
                type="button"
                role="menuitem"
                key={color.value}
                aria-label={`${label}: ${color.name}`}
                title={color.name}
                onClick={() => {
                  onSelect(color.value);
                  setOpen(false);
                }}
              >
                <span style={{ backgroundColor: color.value }} />
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function MarkdownObject({ object, path, saveState, onUpdateObject, onBack, canGoBack, workspaceActions, onOpenSettings, onUndo, onRedo, canUndo, canRedo }) {
  const [mode, setMode] = useState("write");
  const editorRef = useRef(null);
  const content = object.content || "";
  const words = useMemo(() => content.trim().split(/\s+/).filter(Boolean).length, [content]);
  const lines = useMemo(() => content ? content.split(/\r?\n/).length : 0, [content]);

  const replaceSelection = (before, after = before, placeholder = "text") => {
    const editor = editorRef.current;
    if (!editor) return;
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    const selected = content.slice(start, end) || placeholder;
    const next = `${content.slice(0, start)}${before}${selected}${after}${content.slice(end)}`;
    onUpdateObject({ content: next });
    window.requestAnimationFrame(() => {
      editor.focus();
      editor.setSelectionRange(start + before.length, start + before.length + selected.length);
    });
  };

  const insertAtSelection = (value) => {
    const editor = editorRef.current;
    if (!editor) return;
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    const next = `${content.slice(0, start)}${value}${content.slice(end)}`;
    onUpdateObject({ content: next });
    window.requestAnimationFrame(() => {
      editor.focus();
      editor.setSelectionRange(start + value.length, start + value.length);
    });
  };

  const insertBlock = (prefix, placeholder = "") => {
    const editor = editorRef.current;
    if (!editor) return;
    const start = editor.selectionStart;
    const lineStart = content.lastIndexOf("\n", Math.max(0, start - 1)) + 1;
    const next = `${content.slice(0, lineStart)}${prefix}${content.slice(lineStart)}`;
    onUpdateObject({ content: next || `${prefix}${placeholder}` });
    window.requestAnimationFrame(() => {
      editor.focus();
      editor.setSelectionRange(lineStart + prefix.length, lineStart + prefix.length);
    });
  };

  const handleKeyDown = (event) => {
    const command = event.ctrlKey || event.metaKey;
    if (command && event.key.toLowerCase() === "b") {
      event.preventDefault();
      replaceSelection("**");
    } else if (command && event.key.toLowerCase() === "i") {
      event.preventDefault();
      replaceSelection("_");
    } else if (command && event.key.toLowerCase() === "u") {
      event.preventDefault();
      replaceSelection("<u>", "</u>");
    } else if (command && event.key.toLowerCase() === "k") {
      event.preventDefault();
      replaceSelection("[", "]()", "link");
    } else if (command && event.shiftKey && event.key === "7") {
      event.preventDefault();
      insertBlock("1. ", "List item");
    } else if (command && event.shiftKey && event.key === "8") {
      event.preventDefault();
      insertBlock("- ", "List item");
    } else if (command && event.shiftKey && event.key.toLowerCase() === "x") {
      event.preventDefault();
      replaceSelection("~~");
    } else if (event.key === "Tab") {
      event.preventDefault();
      replaceSelection("  ", "", "");
    }
  };

  const handlePaste = async (event) => {
    const imageItem = Array.from(event.clipboardData?.items || []).find((item) => item.type.startsWith("image/"));
    if (!imageItem) return;
    event.preventDefault();
    const file = imageItem.getAsFile();
    if (!file) return;
    const dataUrl = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => resolve("");
      reader.readAsDataURL(file);
    });
    if (dataUrl) insertAtSelection(`![Pasted image](${dataUrl})`);
  };

  const editor = (suffix = "") => (
    <textarea
      ref={editorRef}
      className="markdown-editor"
      value={content}
      onChange={(event) => onUpdateObject({ content: event.target.value })}
      onKeyDown={handleKeyDown}
      onPaste={handlePaste}
      placeholder="# Start writing…\n\nThis text is saved as its own Markdown file."
      spellCheck="true"
      aria-label={`${object.title} Markdown editor${suffix}`}
    />
  );

  const preview = (suffix = "") => (
    <div className="markdown-preview" aria-label={`${object.title} preview${suffix}`}>
      {content ? renderMarkdownBlocks(content) : (
        <p className="markdown-preview-empty">Nothing to preview yet.</p>
      )}
    </div>
  );

  return (
    <article className="object-surface markdown-object" data-object-type="markdown">
      <ObjectHeader
        object={object}
        path={path}
        saveState={saveState}
        onChange={onUpdateObject}
        onBack={onBack}
        canGoBack={canGoBack}
        workspaceActions={workspaceActions}
      />

      <main className={mode === "split" ? "markdown-workspace is-split" : "markdown-workspace"}>
        <div className="markdown-toolbar" aria-label="Text commands">
          <div className="markdown-mode-switch">
            <button className={mode === "write" ? "is-active" : ""} type="button" onClick={() => setMode("write")}>
              <IconPencil size={14} stroke={1.6} /> Write
            </button>
            <button className={mode === "preview" ? "is-active" : ""} type="button" onClick={() => setMode("preview")}>
              <IconEye size={14} stroke={1.6} /> Preview
            </button>
            <button className={mode === "split" ? "is-active" : ""} type="button" onClick={() => setMode("split")}>
              <IconColumns2 size={14} stroke={1.6} /> Split
            </button>
          </div>
          <span className="markdown-toolbar-separator" />
          <button type="button" title="Heading" onClick={() => replaceSelection("# ", "", "Heading")}><IconH1 size={15} stroke={1.7} /></button>
          <button type="button" title="Subheading" onClick={() => insertBlock("## ", "Subheading")}><IconH1 size={15} stroke={1.7} /></button>
          <button type="button" title="Bold (Ctrl+B)" onClick={() => replaceSelection("**")}><IconBold size={15} stroke={1.7} /></button>
          <button type="button" title="Italic (Ctrl+I)" onClick={() => replaceSelection("_")}><IconItalic size={15} stroke={1.7} /></button>
          <button type="button" title="Underline (Ctrl+U)" onClick={() => replaceSelection("<u>", "</u>")}><IconUnderline size={15} stroke={1.7} /></button>
          <button type="button" title="Strikethrough (Ctrl+Shift+X)" onClick={() => replaceSelection("~~")}><IconStrikethrough size={15} stroke={1.7} /></button>
          <MarkdownColorControl
            label="Text color"
            colors={TEXT_COLORS}
            icon={IconPalette}
            onSelect={(color) => replaceSelection(`<span style="color: ${color}">`, "</span>", "colored text")}
          />
          <MarkdownColorControl
            label="Highlight color"
            colors={HIGHLIGHT_COLORS}
            icon={IconHighlight}
            onSelect={(color) => replaceSelection(`<mark style="background-color: ${color}">`, "</mark>", "highlighted text")}
          />
          <button type="button" title="Link (Ctrl+K)" onClick={() => replaceSelection("[", "]()", "link")}><IconLink size={15} stroke={1.7} /></button>
          <button type="button" title="Bulleted list" onClick={() => replaceSelection("- ", "", "List item")}><IconList size={15} stroke={1.7} /></button>
          <button type="button" title="Numbered list" onClick={() => replaceSelection("1. ", "", "List item")}><IconListNumbers size={15} stroke={1.7} /></button>
          <button type="button" title="Task list" onClick={() => insertBlock("- [ ] ", "Task")}><IconCheckbox size={15} stroke={1.7} /></button>
          <button type="button" title="Quote" onClick={() => replaceSelection("> ", "", "Quote")}><IconBlockquote size={15} stroke={1.7} /></button>
          <button type="button" title="Inline code" onClick={() => replaceSelection("`")}><IconCode size={15} stroke={1.7} /></button>
          <button type="button" title="Code block" onClick={() => insertBlock("```\n", "code\n```")}><IconCode size={15} stroke={1.7} /></button>
          <button type="button" title="Insert table" onClick={() => insertAtSelection("| Column | Column |\n| --- | --- |\n| Value | Value |\n")}><IconTable size={15} stroke={1.7} /></button>
          <button type="button" title="Insert image" onClick={() => insertAtSelection("![Alt text](https://)" )}><IconPhoto size={15} stroke={1.7} /></button>
          <button type="button" title="Divider" onClick={() => insertBlock("---\n")}><IconMinus size={15} stroke={1.7} /></button>
          <span className="markdown-file-kind"><IconFileText size={14} stroke={1.55} /> Markdown · separate local file</span>
        </div>

        {mode === "write" ? editor() : null}
        {mode === "preview" ? preview() : null}
        {mode === "split" ? <div className="markdown-split">{editor(" split view")}{preview(" split view")}</div> : null}
      </main>

      <footer className="object-statusbar">
        <AppDock onOpenSettings={onOpenSettings} onUndo={onUndo} onRedo={onRedo} canUndo={canUndo} canRedo={canRedo} />
        <span className="status-spacer" />
        <span className="status-item">{words} words · {lines} lines · .md</span>
        <span className="status-divider">·</span>
        <span className="status-item keyboard-hint"><IconBrackets size={14} stroke={1.6} /> <kbd>[</kbd> out</span>
      </footer>
    </article>
  );
}
