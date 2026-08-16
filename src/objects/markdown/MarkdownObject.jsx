import { useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
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
  IconChevronUp,
  IconX,
} from "@tabler/icons-react";
import { ObjectHeader } from "../../components/ObjectHeader.jsx";
import { PaperPortal } from "../../components/PaperPortal.jsx";
import { useLocalDraft } from "../../components/localEditSession.js";
import { MarkdownContextMenu } from "./MarkdownContextMenu.jsx";
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
  const activeEditorRef = useRef(null);
  const selectionRef = useRef({ start: 0, end: 0 });
  const contextMenuOpenRef = useRef(false);
  const [contextMenu, setContextMenu] = useState(null);
  const [previewMenu, setPreviewMenu] = useState(null);
  const [findOpen, setFindOpen] = useState(false);
  const [findQuery, setFindQuery] = useState("");
  const [replaceQuery, setReplaceQuery] = useState("");
  const [findCaseSensitive, setFindCaseSensitive] = useState(false);
  const [activeFindIndex, setActiveFindIndex] = useState(-1);
  const findInputRef = useRef(null);
  const replaceInputRef = useRef(null);
  const surfaceRef = useRef(null);
  const previewRef = useRef(null);
  const canonicalContent = object.content || "";
  const contentSession = useLocalDraft(canonicalContent, (next) => onUpdateObject({ content: next }));
  const content = contentSession.draft;
  const deferredContent = useDeferredValue(content);
  const editorPlaceholder = useMemo(() => markdownPlaceholderFor(object.id), [object.id]);
  const words = useMemo(() => deferredContent.trim().split(/\s+/).filter(Boolean).length, [deferredContent]);
  const lines = useMemo(() => deferredContent ? deferredContent.split(/\r?\n/).length : 0, [deferredContent]);

  const commitContent = () => contentSession.commitDraft(contentSession.draftRef.current);
  const handleEditorBlur = (event) => {
    if (event.relatedTarget && surfaceRef.current?.contains(event.relatedTarget)) return;
    commitContent();
  };
  const handleBack = () => {
    commitContent();
    onBack?.();
  };

  const currentContent = () => contentSession.draftRef.current;
  const updateContent = (next) => contentSession.updateDraft(next);

  const buildFindMatches = (source, needle, caseSensitive) => {
    if (!needle) return [];
    const list = [];
    if (caseSensitive) {
      let index = source.indexOf(needle);
      while (index !== -1) {
        list.push({ start: index, end: index + needle.length });
        index = source.indexOf(needle, index + 1);
      }
    } else {
      const lower = source.toLocaleLowerCase();
      const lowerNeedle = needle.toLocaleLowerCase();
      let index = lower.indexOf(lowerNeedle);
      while (index !== -1) {
        list.push({ start: index, end: index + needle.length });
        index = lower.indexOf(lowerNeedle, index + 1);
      }
    }
    return list;
  };

  const findMatches = useMemo(
    () => buildFindMatches(content, findQuery, findCaseSensitive),
    [content, findCaseSensitive, findQuery],
  );

  const revealFindMatch = (match) => {
    if (!match) return;
    const editor = editorForSelection();
    if (!editor) return;
    activeEditorRef.current = editor;
    selectionRef.current = { start: match.start, end: match.end };
    window.requestAnimationFrame(() => {
      editor.focus();
      editor.setSelectionRange(match.start, match.end);
    });
  };

  const goFindMatch = (nextIndex) => {
    const clamped = findMatches.length ? ((nextIndex % findMatches.length) + findMatches.length) % findMatches.length : -1;
    setActiveFindIndex(clamped);
    revealFindMatch(clamped >= 0 ? findMatches[clamped] : null);
  };

  const openFind = () => {
    setFindOpen(true);
    const selection = selectedText();
    if (selection && !selection.includes("\n")) setFindQuery(selection);
    window.requestAnimationFrame(() => {
      findInputRef.current?.focus();
      findInputRef.current?.select();
    });
  };

  const closeFind = () => {
    setFindOpen(false);
    setActiveFindIndex(-1);
    const editor = editorForSelection();
    if (editor) {
      window.requestAnimationFrame(() => {
        editor.focus();
        const { start, end } = selectionRef.current;
        editor.setSelectionRange(start, end);
      });
    }
  };

  const replaceCurrentMatch = () => {
    const match = findMatches[activeFindIndex];
    if (!match) return;
    const current = currentContent();
    const next = `${current.slice(0, match.start)}${replaceQuery}${current.slice(match.end)}`;
    updateContent(next);
    const cursor = match.start + replaceQuery.length;
    const fresh = buildFindMatches(next, findQuery, findCaseSensitive);
    const relative = fresh.findIndex((candidate) => candidate.start >= cursor);
    setActiveFindIndex(relative);
    if (relative >= 0) revealFindMatch(fresh[relative]);
  };

  const replaceAllMatches = () => {
    if (!findQuery) return;
    const escaped = findQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const flags = findCaseSensitive ? "g" : "gi";
    const next = currentContent().replace(new RegExp(escaped, flags), () => replaceQuery);
    updateContent(next);
    setActiveFindIndex(-1);
  };

  const handleFindKeyDown = (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      closeFind();
    } else if (event.key === "Enter") {
      event.preventDefault();
      const delta = event.shiftKey ? -1 : 1;
      goFindMatch(activeFindIndex + delta);
    }
  };

  const editorForSelection = () => activeEditorRef.current || editorRef.current;

  const rememberSelection = (editor = editorForSelection()) => {
    if (!editor || typeof editor.selectionStart !== "number") return selectionRef.current;
    selectionRef.current = { start: editor.selectionStart, end: editor.selectionEnd };
    return selectionRef.current;
  };

  const selectionForEdit = () => {
    const editor = editorForSelection();
    if (editor && document.activeElement === editor && !contextMenuOpenRef.current) rememberSelection(editor);
    return { editor, ...selectionRef.current };
  };

  const restoreEditorSelection = (editor, start, end = start) => {
    if (!editor) return;
    activeEditorRef.current = editor;
    selectionRef.current = { start, end };
    window.requestAnimationFrame(() => {
      editor.focus();
      editor.setSelectionRange(start, end);
    });
  };

  const replaceSelection = (before, after = before, placeholder = "text") => {
    const { editor, start, end } = selectionForEdit();
    if (!editor) return;
    const current = currentContent();
    const selected = current.slice(start, end) || placeholder;
    const next = `${current.slice(0, start)}${before}${selected}${after}${current.slice(end)}`;
    updateContent(next);
    restoreEditorSelection(editor, start + before.length, start + before.length + selected.length);
  };

  const insertAtSelection = (value) => {
    const { editor, start, end } = selectionForEdit();
    if (!editor) return;
    const current = currentContent();
    const next = `${current.slice(0, start)}${value}${current.slice(end)}`;
    updateContent(next);
    restoreEditorSelection(editor, start + value.length, start + value.length);
  };

  const insertBlock = (prefix, placeholder = "") => {
    const { editor, start } = selectionForEdit();
    if (!editor) return;
    const current = currentContent();
    const lineStart = current.lastIndexOf("\n", Math.max(0, start - 1)) + 1;
    const next = `${current.slice(0, lineStart)}${prefix}${current.slice(lineStart)}`;
    updateContent(next || `${prefix}${placeholder}`);
    restoreEditorSelection(editor, lineStart + prefix.length, lineStart + prefix.length);
  };

  const clearSelection = () => {
    const { editor, start, end } = selectionForEdit();
    if (!editor || start === end) return;
    const current = currentContent();
    updateContent(`${current.slice(0, start)}${current.slice(end)}`);
    restoreEditorSelection(editor, start, start);
  };

  const selectedText = () => {
    const { start, end } = selectionRef.current;
    return currentContent().slice(start, end);
  };

  const copySelection = async () => {
    const text = selectedText();
    if (!text) return;
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return;
      }
    } catch {
      // Fall through to the browser's synchronous copy command.
    }
    const editor = editorForSelection();
    const { start, end } = selectionRef.current;
    if (!editor) return;
    restoreEditorSelection(editor, start, end);
    window.requestAnimationFrame(() => document.execCommand?.("copy"));
  };

  const pasteText = async () => {
    if (typeof navigator === "undefined" || !navigator.clipboard?.readText) return;
    try {
      const text = await navigator.clipboard.readText();
      if (text) insertAtSelection(text);
    } catch {
      // The browser may deny asynchronous clipboard reads; native paste remains available in Write mode.
    }
  };

  const handleMarkdownContextAction = async (action, value) => {
    if (action === "clear") clearSelection();
    else if (action === "copy") await copySelection();
    else if (action === "paste") await pasteText();
    else if (action === "bold") replaceSelection("**");
    else if (action === "italic") replaceSelection("_");
    else if (action === "underline") replaceSelection("<u>", "</u>");
    else if (action === "strike") replaceSelection("~~");
    else if (action === "inline-code") replaceSelection("`");
    else if (action === "text-color") replaceSelection(`<span style="color: ${value}">`, "</span>", "colored text");
    else if (action === "highlight-color") replaceSelection(`<mark style="background-color: ${value}">`, "</mark>", "highlighted text");
    else if (action === "link") replaceSelection("[", "]()", "link");
    else if (action === "bullet") replaceSelection("- ", "", "List item");
    else if (action === "numbered") replaceSelection("1. ", "", "List item");
    else if (action === "quote") replaceSelection("> ", "", "Quote");
    else if (action === "table") insertAtSelection("| Column | Column |\n| --- | --- |\n| Value | Value |\n");
    else if (action === "image") insertAtSelection("![Alt text](https://)");
    else if (action === "separator") insertBlock("---\n");
    else if (action === "code-block") insertBlock("```\n", "code\n```");
  };

  const closeMarkdownContextMenu = () => {
    contextMenuOpenRef.current = false;
    setContextMenu(null);
    const editor = editorForSelection();
    const { start, end } = selectionRef.current;
    window.requestAnimationFrame(() => restoreEditorSelection(editor, start, end));
  };

  const openPreviewContextMenu = (event) => {
    event.preventDefault();
    event.stopPropagation();
    const selection = window.getSelection?.();
    const hasSelection = Boolean(selection && !selection.isCollapsed && selection.toString().trim());
    const rect = event.currentTarget.getBoundingClientRect();
    setPreviewMenu({
      readOnly: true,
      x: event.clientX,
      y: event.clientY,
      anchorRect: { left: event.clientX, top: event.clientY, bottom: event.clientY },
      sourceElement: event.currentTarget,
      hasSelection,
      focusMenu: false,
      rect,
    });
  };

  const closePreviewContextMenu = () => setPreviewMenu(null);

  const handlePreviewContextAction = (action) => {
    if (action === "copy") {
      window.requestAnimationFrame(() => document.execCommand?.("copy"));
    } else if (action === "select-all") {
      const element = previewRef.current;
      if (!element) return;
      const range = document.createRange();
      range.selectNodeContents(element);
      const selection = window.getSelection?.();
      selection?.removeAllRanges();
      selection?.addRange(range);
    }
  };

  const openMarkdownContextMenu = (event, editor = event.currentTarget, fromKeyboard = false) => {
    event.preventDefault();
    event.stopPropagation();
    activeEditorRef.current = editor;
    const { start, end } = rememberSelection(editor);
    const rect = editor.getBoundingClientRect();
    contextMenuOpenRef.current = true;
    setContextMenu({
      x: fromKeyboard ? rect.left + Math.min(180, rect.width / 2) : event.clientX,
      y: fromKeyboard ? rect.top + 34 : event.clientY,
      anchorRect: fromKeyboard
        ? { left: rect.left + Math.min(180, rect.width / 2), top: rect.top + 30, bottom: rect.top + 48 }
        : { left: event.clientX, top: event.clientY, bottom: event.clientY },
      sourceElement: editor,
      hasSelection: start !== end,
      focusMenu: fromKeyboard,
    });
  };

  const handleKeyDown = (event) => {
    const command = event.ctrlKey || event.metaKey;
    if (command && event.key.toLowerCase() === "f") {
      event.preventDefault();
      openFind();
      return;
    }
    if (command && (event.key === "]" || event.code === "BracketRight")) {
      openMarkdownContextMenu(event, event.currentTarget, true);
      return;
    }
    if (event.key === "Enter" && !event.shiftKey && !event.altKey && !command && !event.isComposing) {
      const current = currentContent();
      const continuation = markdownLineContinuation(current, event.currentTarget.selectionStart, event.currentTarget.selectionEnd);
      if (continuation) {
        event.preventDefault();
        const next = `${current.slice(0, continuation.start)}${continuation.text}${current.slice(continuation.end)}`;
        updateContent(next);
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
      ref={(element) => {
        if (element) editorRef.current = element;
      }}
      className="markdown-editor"
      value={content}
      onChange={(event) => updateContent(event.target.value)}
      onFocus={(event) => {
        activeEditorRef.current = event.currentTarget;
        rememberSelection(event.currentTarget);
      }}
      onSelect={(event) => rememberSelection(event.currentTarget)}
      onMouseUp={(event) => rememberSelection(event.currentTarget)}
      onKeyDown={handleKeyDown}
      onBlur={handleEditorBlur}
      onPaste={handlePaste}
      onContextMenu={(event) => openMarkdownContextMenu(event, event.currentTarget)}
      placeholder={editorPlaceholder}
      spellCheck="true"
      aria-label={`${object.title} Markdown editor${suffix}`}
    />
  );

  const preview = (suffix = "") => (
    <div
      ref={previewRef}
      className="markdown-preview"
      aria-label={`${object.title} preview${suffix}`}
      onContextMenu={openPreviewContextMenu}
    >
      {deferredContent ? renderMarkdownBlocks(deferredContent) : (
        <p className="markdown-preview-empty">Nothing to preview yet.</p>
      )}
    </div>
  );

  return (
    <article ref={surfaceRef} className="object-surface markdown-object" data-object-type="markdown">
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

        {findOpen && mode !== "preview" ? (
          <div className="markdown-find-bar" role="search" aria-label="Find and replace">
            <div className="markdown-find-fields">
              <input
                ref={findInputRef}
                className="markdown-find-input"
                value={findQuery}
                placeholder="Find"
                spellCheck="false"
                onChange={(event) => {
                  setFindQuery(event.target.value);
                  setActiveFindIndex(-1);
                }}
                onKeyDown={handleFindKeyDown}
                aria-label="Find"
              />
              <input
                ref={replaceInputRef}
                className="markdown-find-input"
                value={replaceQuery}
                placeholder="Replace with"
                spellCheck="false"
                onChange={(event) => setReplaceQuery(event.target.value)}
                onKeyDown={handleFindKeyDown}
                aria-label="Replace with"
              />
            </div>
            <button
              type="button"
              className={findCaseSensitive ? "is-active" : ""}
              aria-pressed={findCaseSensitive}
              data-tooltip="Match case"
              onClick={() => setFindCaseSensitive((value) => !value)}
            >
              <span className="markdown-find-case">Aa</span>
            </button>
            <button type="button" aria-label="Previous match" disabled={!findMatches.length} onClick={() => goFindMatch(activeFindIndex - 1)}>
              <IconChevronUp size={14} stroke={1.7} />
            </button>
            <button type="button" aria-label="Next match" disabled={!findMatches.length} onClick={() => goFindMatch(activeFindIndex + 1)}>
              <IconChevronDown size={14} stroke={1.7} />
            </button>
            <span className="markdown-find-count">
              {findMatches.length
                ? (activeFindIndex >= 0
                  ? `${Math.min(activeFindIndex, findMatches.length - 1) + 1} of ${findMatches.length}`
                  : `${findMatches.length} match${findMatches.length === 1 ? "" : "es"}`)
                : "No matches"}
            </span>
            <span className="markdown-toolbar-separator" />
            <button type="button" disabled={!findMatches.length || activeFindIndex < 0} onClick={replaceCurrentMatch}>Replace</button>
            <button type="button" disabled={!findMatches.length} onClick={replaceAllMatches}>Replace all</button>
            <button type="button" aria-label="Close find" data-tooltip="Close · Esc" onClick={closeFind}>
              <IconX size={14} stroke={1.7} />
            </button>
          </div>
        ) : null}

        {mode === "write" ? editor() : null}
        {mode === "preview" ? preview() : null}
        {mode === "split" ? <div className="markdown-split">{editor(" split view")}{preview(" split view")}</div> : null}
      </main>

      <footer className="object-statusbar">
        <span className="status-spacer" />
        <span className="status-item">{words} words · {lines} lines</span>
      </footer>
      <MarkdownContextMenu
        menu={contextMenu}
        onClose={closeMarkdownContextMenu}
        onAction={handleMarkdownContextAction}
        textColors={TEXT_COLORS}
        highlightColors={HIGHLIGHT_COLORS}
      />
      <MarkdownContextMenu
        menu={previewMenu}
        onClose={closePreviewContextMenu}
        onAction={handlePreviewContextAction}
        textColors={TEXT_COLORS}
        highlightColors={HIGHLIGHT_COLORS}
      />
    </article>
  );
}
