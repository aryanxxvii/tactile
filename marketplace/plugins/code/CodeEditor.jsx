import { autocompletion, closeBrackets, closeBracketsKeymap, completionKeymap } from "@codemirror/autocomplete";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { css } from "@codemirror/lang-css";
import { cpp } from "@codemirror/lang-cpp";
import { html } from "@codemirror/lang-html";
import { java } from "@codemirror/lang-java";
import { javascript } from "@codemirror/lang-javascript";
import { json } from "@codemirror/lang-json";
import { python } from "@codemirror/lang-python";
import { rust } from "@codemirror/lang-rust";
import { sql } from "@codemirror/lang-sql";
import {
  bracketMatching,
  defaultHighlightStyle,
  foldGutter,
  foldKeymap,
  indentOnInput,
  StreamLanguage,
  syntaxHighlighting,
} from "@codemirror/language";
import { go } from "@codemirror/legacy-modes/mode/go";
import { ruby } from "@codemirror/legacy-modes/mode/ruby";
import { shell } from "@codemirror/legacy-modes/mode/shell";
import { highlightSelectionMatches, searchKeymap } from "@codemirror/search";
import { Compartment, EditorState } from "@codemirror/state";
import {
  drawSelection,
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
} from "@codemirror/view";
import { React, useEffect, useRef } from "tactile:host";

function languageExtension(language) {
  switch (language) {
    case "javascript": return javascript();
    case "jsx": return javascript({ jsx: true });
    case "typescript": return javascript({ typescript: true });
    case "tsx": return javascript({ jsx: true, typescript: true });
    case "python": return python();
    case "c": case "cpp": return cpp();
    case "java": return java();
    case "rust": return rust();
    case "go": return StreamLanguage.define(go);
    case "ruby": return StreamLanguage.define(ruby);
    case "bash": return StreamLanguage.define(shell);
    case "html": return html();
    case "css": return css();
    case "json": return json();
    case "sql": return sql();
    default: return [];
  }
}

const tactileTheme = EditorView.theme({
  "&": {
    height: "100%",
    color: "var(--ink)",
    backgroundColor: "var(--paper)",
    fontSize: "12.5px",
  },
  ".cm-scroller": {
    fontFamily: "var(--font-mono)",
    lineHeight: "1.6",
    overflow: "auto",
  },
  ".cm-content": { padding: "16px 0 28px" },
  ".cm-line": { padding: "0 18px 0 8px" },
  ".cm-gutters": {
    color: "var(--muted)",
    backgroundColor: "var(--paper)",
    borderRight: "1px solid var(--line)",
  },
  ".cm-activeLine, .cm-activeLineGutter": { backgroundColor: "var(--tray)" },
  ".cm-cursor": { borderLeftColor: "var(--ink)" },
  "&.cm-focused": { outline: "none" },
  "&.cm-focused .cm-selectionBackground, ::selection": { backgroundColor: "var(--selection-background)" },
});

export function CodeEditor({ value, language, ariaLabel, onChange, onBlur }) {
  const hostRef = useRef(null);
  const viewRef = useRef(null);
  const languageCompartmentRef = useRef(new Compartment());
  const callbacksRef = useRef({ onChange, onBlur });
  const syncingRef = useRef(false);
  callbacksRef.current = { onChange, onBlur };

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;
    const languageCompartment = languageCompartmentRef.current;
    const state = EditorState.create({
      doc: value,
      extensions: [
        lineNumbers(),
        highlightActiveLineGutter(),
        history(),
        foldGutter(),
        drawSelection(),
        indentOnInput(),
        bracketMatching(),
        closeBrackets(),
        autocompletion(),
        highlightActiveLine(),
        highlightSelectionMatches(),
        syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
        keymap.of([
          indentWithTab,
          ...closeBracketsKeymap,
          ...defaultKeymap,
          ...searchKeymap,
          ...historyKeymap,
          ...foldKeymap,
          ...completionKeymap,
        ]),
        languageCompartment.of(languageExtension(language)),
        EditorView.contentAttributes.of({ "aria-label": ariaLabel }),
        EditorView.updateListener.of((update) => {
          if (update.docChanged && !syncingRef.current) callbacksRef.current.onChange?.(update.state.doc.toString());
        }),
        EditorView.domEventHandlers({ blur: () => { callbacksRef.current.onBlur?.(); } }),
        tactileTheme,
      ],
    });
    const view = new EditorView({ state, parent: host });
    viewRef.current = view;
    return () => {
      viewRef.current = null;
      view.destroy();
    };
  }, []);

  useEffect(() => {
    const view = viewRef.current;
    if (!view || view.state.doc.toString() === value) return;
    syncingRef.current = true;
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: value } });
    syncingRef.current = false;
  }, [value]);

  useEffect(() => {
    const view = viewRef.current;
    if (view) view.dispatch({ effects: languageCompartmentRef.current.reconfigure(languageExtension(language)) });
  }, [language]);

  return <div ref={hostRef} className="code-codemirror" />;
}