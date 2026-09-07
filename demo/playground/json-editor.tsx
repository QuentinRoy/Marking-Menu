import {
  autocompletion,
  closeBrackets,
  closeBracketsKeymap,
  completionKeymap,
} from '@codemirror/autocomplete';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import {
  bracketMatching,
  HighlightStyle,
  indentOnInput,
  indentUnit,
  syntaxHighlighting,
} from '@codemirror/language';
import { EditorState } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
import { tags } from '@lezer/highlight';
import { cn } from 'cn';
import { jsonSchema } from 'codemirror-json-schema';
import type { JSONSchema7 } from 'json-schema';
import { useEffect, useRef } from 'react';
import { menuSchema } from './menu-schema.js';

// The schema is `as const` so `menu-schema.test-d.ts` can read its literal
// types; the editor's own signature wants it mutable, and nothing here
// writes to it.
const editorSchema = menuSchema as unknown as JSONSchema7;

/*
 JSON has few kinds of token, so one highlight style covers the language.
 The colors are custom properties rather than literals, which is what lets
 the same style serve light and dark: `styles.css` redefines them under
 `prefers-color-scheme`, and CodeMirror never has to be reconfigured.
 */
const highlightStyle = HighlightStyle.define([
  { tag: tags.propertyName, color: 'var(--color-code-property)' },
  { tag: tags.string, color: 'var(--color-code-string)' },
  {
    tag: [tags.number, tags.bool, tags.null],
    color: 'var(--color-code-literal)',
  },
  {
    tag: [tags.punctuation, tags.brace, tags.bracket, tags.separator],
    color: 'var(--color-code-punctuation)',
  },
]);

const extensions = [
  history(),
  indentOnInput(),
  indentUnit.of('  '),
  bracketMatching(),
  closeBrackets(),
  autocompletion(),
  syntaxHighlighting(highlightStyle, { fallback: true }),
  keymap.of([
    ...closeBracketsKeymap,
    ...defaultKeymap,
    ...historyKeymap,
    ...completionKeymap,
  ]),
  EditorView.lineWrapping,
  EditorView.contentAttributes.of({ 'aria-label': 'Menu items, as JSON' }),
  // Squiggles, completion and hover, all driven by the same schema the
  // status line validates against.
  jsonSchema(editorSchema),
];

/**
 The menu editor: a JSON document holding the very value the page passes to
 the library.
 */
export function JsonEditor({
  value,
  invalid,
  onChange,
  onBlur,
}: {
  value: string;
  /**
  Whether the current text does not describe a menu, which the border shows.
  */
  invalid: boolean;
  onChange: (value: string) => void;
  onBlur: () => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView>(null);
  // The two callbacks are read at event time rather than closed over, so a
  // new one on every render does not mean tearing the editor down.
  const handlersRef = useRef({ onChange, onBlur });
  useEffect(() => {
    handlersRef.current = { onChange, onBlur };
  });

  useEffect(() => {
    const host = hostRef.current;
    if (host === null) {
      return;
    }

    const view = new EditorView({
      parent: host,
      state: EditorState.create({
        doc: value,
        extensions: [
          ...extensions,
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              handlersRef.current.onChange(update.state.doc.toString());
            }
          }),
          EditorView.domEventHandlers({
            blur() {
              handlersRef.current.onBlur();
            },
          }),
        ],
      }),
    });
    viewRef.current = view;
    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // Mount-only: `value` seeds the document, and the effect below is what
    // keeps it in step afterwards.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A text the page decided on rather than the editor: the menu came from the
  // address, or was reset or reformatted. Comparing first keeps a plain
  // keystroke from dispatching a full replacement over the caret.
  useEffect(() => {
    const view = viewRef.current;
    if (view !== null && view.state.doc.toString() !== value) {
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: value },
      });
    }
  }, [value]);

  return (
    <div
      ref={hostRef}
      className={cn(
        'bg-background min-h-[120px] flex-1 overflow-auto rounded-[5px] border',
        invalid
          ? 'border-mark shadow-[0_0_0_3px_color-mix(in_oklch,var(--color-mark)_12%,transparent)]'
          : 'border-input',
      )}
    />
  );
}
