import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  IconBlockquote,
  IconBold,
  IconChevronDown,
  IconCheckbox,
  IconCode,
  IconColumns2,
  IconEye,
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
import { ObjectHeader } from "../../components/ObjectHeader.jsx";
import { PaperPortal } from "../../components/PaperPortal.jsx";
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

const MARKDOWN_PLACEHOLDERS = [
  "# Differential Diagnosis",
  "# Not Lupus",
  "# Whiteboard Moment",
  "# Vicodin Time",
  "# Middle Out",
  "# Hotdog, Not Hotdog",
  "# Pivot",
  "# Bazinga",
  "# Tiny Idea",
  "# Brain Dump",
  "# Make a note",
  "# Jot It Down",
  "# Start Here",
];

function markdownPlaceholderFor(objectId) {
  const hash = Array.from(String(objectId || ""), (character) => character.charCodeAt(0)).reduce(
    (total, code) => total + code,
    0,
  );
  return MARKDOWN_PLACEHOLDERS[hash % MARKDOWN_PLACEHOLDERS.length];
}

function markdownLineContinuation(value, start, end) {
  if (start !== end) return null;

  const lineStart = value.lastIndexOf("\n", Math.max(0, start - 1)) + 1;
  const lineBeforeCaret = value.slice(lineStart, start);

  const finish = (prefix, body) => {
    if (!body.trim()) {
      return { start: lineStart, end: start, text: "\n", caret: lineStart + 1 };
    }
    return { start, end, text: `\n${prefix}`, caret: start + prefix.length + 1 };
  };

  const task = /^(\s*)([-*+])[ \t]+\[([ xX]?)\][ \t]*(.*)$/.exec(lineBeforeCaret);
  if (task) return finish(`${task[1]}${task[2]} [ ] `, task[4]);

  const bullet = /^(\s*)([-*+])[ \t]+(.*)$/.exec(lineBeforeCaret);
  if (bullet) return finish(`${bullet[1]}${bullet[2]} `, bullet[3]);

  const numbered = /^(\s*)(\d+)([.)])[ \t]+(.*)$/.exec(lineBeforeCaret);
  if (numbered) {
    const nextNumber = Number.parseInt(numbered[2], 10) + 1;
    return finish(`${numbered[1]}${nextNumber}${numbered[3]} `, numbered[4]);
  }

  const quote = /^(\s*)>[ \t]+(.*)$/.exec(lineBeforeCaret);
  if (quote) return finish(`${quote[1]}> `, quote[2]);

  return null;
}

function MarkdownColorControl({ label, colors, icon: Icon, onSelect }) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState(null);
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const close = (event) => {
      if (!rootRef.current?.contains(event.target) && !menuRef.current?.contains(event.target)) setOpen(false);
    };
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [open]);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return undefined;
    const updatePosition = () => {
      const anchorBox = triggerRef.current?.getBoundingClientRect();
      if (!anchorBox) return;
      const menuBox = menuRef.current?.getBoundingClientRect();
      const width = menuBox?.width || 154;
      const height = menuBox?.height || 108;
      const gap = 6;
      const gutter = 8;
      const canFitBelow = anchorBox.bottom + gap + height <= window.innerHeight - gutter;
      const canFitAbove = anchorBox.top - gap - height >= gutter;
      const placement = !canFitBelow && canFitAbove ? "above" : "below";
      const top = placement === "above" ? anchorBox.top - gap - height : anchorBox.bottom + gap;
      const left = Math.min(
        Math.max(gutter, anchorBox.left),
        Math.max(gutter, window.innerWidth - width - gutter),
      );
      setPosition({
        left,
        top: Math.max(gutter, Math.min(window.innerHeight - gutter - height, top)),
        placement,
      });
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
  }, [open]);

  return (
    <div className="markdown-color-control cell-color-group" ref={rootRef}>
      <button
        ref={triggerRef}
        className={open ? "cell-format-button is-active" : "cell-format-button"}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        data-tooltip={label}
        onClick={() => setOpen((current) => !current)}
      >
        <Icon size={15} stroke={1.7} />
        <IconChevronDown className="markdown-color-chevron" size={9} stroke={1.8} />
      </button>
      {open && position ? (
        <PaperPortal className="tactile-format-layer" themeSource={rootRef.current}>
          <div
            ref={menuRef}
            className={`markdown-color-menu is-${position.placement}`}
            role="menu"
            aria-label={label}
            style={{ left: position.left, top: position.top }}
          >
            <div className="markdown-color-menu-title">{label}</div>
            <div className="markdown-color-grid">
              {colors.map((color) => (
                <button
                  type="button"
                  role="menuitem"
                  key={color.value}
                  aria-label={`${label}: ${color.name}`}
                  data-tooltip={color.name}
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
        </PaperPortal>
      ) : null}
    </div>
  );
}

export function MarkdownObject({ object, path, saveState, onUpdateObject, onBack, canGoBack, workspaceActions, onReparentObject }) {
  const [mode, setMode] = useState("write");
  const editorRef = useRef(null);
  const content = object.content || "";
  const editorPlaceholder = useMemo(() => markdownPlaceholderFor(object.id), [object.id]);
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
    if (event.key === "Enter" && !event.shiftKey && !event.altKey && !command && !event.isComposing) {
      const continuation = markdownLineContinuation(content, event.currentTarget.selectionStart, event.currentTarget.selectionEnd);
      if (continuation) {
        event.preventDefault();
        const next = `${content.slice(0, continuation.start)}${continuation.text}${content.slice(continuation.end)}`;
        onUpdateObject({ content: next });
        window.requestAnimationFrame(() => {
          editorRef.current?.focus();
          editorRef.current?.setSelectionRange(continuation.caret, continuation.caret);
        });
        return;
      }
    }
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
      placeholder={editorPlaceholder}
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
        onReparentObject={onReparentObject}
      />

      <main className={mode === "split" ? "markdown-workspace is-split" : "markdown-workspace"}>
        <div className="markdown-toolbar cell-format-toolbar" aria-label="Text commands">
          <div className="markdown-mode-switch cell-format-group" role="group" aria-label="Text view">
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
          <div className="markdown-style-group cell-format-group" role="group" aria-label="Text style">
          <button type="button" data-tooltip="Bold · Ctrl+B" onClick={() => replaceSelection("**")}><IconBold size={15} stroke={1.7} /></button>
          <button type="button" data-tooltip="Italic · Ctrl+I" onClick={() => replaceSelection("_")}><IconItalic size={15} stroke={1.7} /></button>
          <button type="button" data-tooltip="Underline · Ctrl+U" onClick={() => replaceSelection("<u>", "</u>")}><IconUnderline size={15} stroke={1.7} /></button>
          <button type="button" data-tooltip="Strikethrough · Ctrl+Shift+X" onClick={() => replaceSelection("~~")}><IconStrikethrough size={15} stroke={1.7} /></button>
          </div>
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
          <span className="markdown-toolbar-separator" />
          <div className="markdown-block-group cell-format-group" role="group" aria-label="Markdown blocks">
          <button type="button" data-tooltip="Link · Ctrl+K" onClick={() => replaceSelection("[", "]()", "link")}><IconLink size={15} stroke={1.7} /></button>
          <button type="button" data-tooltip="Bulleted list" onClick={() => replaceSelection("- ", "", "List item")}><IconList size={15} stroke={1.7} /></button>
          <button type="button" data-tooltip="Numbered list" onClick={() => replaceSelection("1. ", "", "List item")}><IconListNumbers size={15} stroke={1.7} /></button>
          <button type="button" data-tooltip="Task list" onClick={() => insertBlock("- [ ] ", "Task")}><IconCheckbox size={15} stroke={1.7} /></button>
          <button type="button" data-tooltip="Quote" onClick={() => replaceSelection("> ", "", "Quote")}><IconBlockquote size={15} stroke={1.7} /></button>
          </div>
          <div className="markdown-insert-group cell-format-group" role="group" aria-label="Markdown inserts">
          <button type="button" data-tooltip="Inline code" onClick={() => replaceSelection("`")}><IconCode size={15} stroke={1.7} /></button>
          <button type="button" data-tooltip="Code block" onClick={() => insertBlock("```\n", "code\n```")}><IconCode size={15} stroke={1.7} /></button>
          <button type="button" data-tooltip="Insert table" onClick={() => insertAtSelection("| Column | Column |\n| --- | --- |\n| Value | Value |\n")}><IconTable size={15} stroke={1.7} /></button>
          <button type="button" data-tooltip="Insert image" onClick={() => insertAtSelection("![Alt text](https://)" )}><IconPhoto size={15} stroke={1.7} /></button>
          <button type="button" data-tooltip="Divider" onClick={() => insertBlock("---\n")}><IconMinus size={15} stroke={1.7} /></button>
          </div>
        </div>

        {mode === "write" ? editor() : null}
        {mode === "preview" ? preview() : null}
        {mode === "split" ? <div className="markdown-split">{editor(" split view")}{preview(" split view")}</div> : null}
      </main>

      <footer className="object-statusbar">
        <span className="status-spacer" />
        <span className="status-item">{words} words · {lines} lines</span>
      </footer>
    </article>
  );
}
