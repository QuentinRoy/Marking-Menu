import {
  autocompletion,
  closeBrackets,
  closeBracketsKeymap,
  completionKeymap,
} from '@codemirror/autocomplete';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { json, jsonLanguage, jsonParseLinter } from '@codemirror/lang-json';
import {
  bracketMatching,
  HighlightStyle,
  indentOnInput,
  indentUnit,
  syntaxHighlighting,
} from '@codemirror/language';
import { linter } from '@codemirror/lint';
import { EditorState } from '@codemirror/state';
import { EditorView, hoverTooltip, keymap } from '@codemirror/view';
import { tags } from '@lezer/highlight';
import { cn } from 'cn';
import {
  handleRefresh,
  jsonCompletion,
  jsonPointerForPosition,
  jsonSchemaHover,
  jsonSchemaLinter,
  stateExtensions,
} from 'codemirror-json-schema';
import type { JSONSchema7 } from 'json-schema';
import { useEffect, useRef } from 'react';
import { annotationAt, menuSchema } from './menu-schema.js';

// Two mismatches, neither of them real. The schema is `as const` so
// `menu-schema.test-d.ts` can read its literal types, while this signature
// wants it mutable, and nothing here writes to it; and it is 2020-12 while
// `codemirror-json-schema` types its parameter as draft-07. The validator
// underneath resolves `#/$defs/...` as the plain JSON pointer it is, so the
// squiggles agree with the status line, which validates the same document
// against a real 2020-12 draft.
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

/**
 What the tooltip says about whatever is under the pointer, read from the
 schema rather than from the sub-schema the hover resolved: see
 {@link annotationAt} for why the two differ.

 @param data - What the hover resolved for the position.
 @param data.pointer - The JSON pointer to the position in the document.
 @returns The tooltip's prose and its type line.
 */
function hoverTexts({ pointer }: { pointer: string }): {
  message: string;
  typeInfo: string;
} {
  const annotation = annotationAt(pointer);
  const heading =
    annotation?.title === undefined ? '' : `**${annotation.title}**`;
  const body = annotation?.description ?? '';
  return {
    message: [heading, body].filter(Boolean).join('\n\n'),
    typeInfo: annotation?.type ?? '',
  };
}

/**
 The schema hover, silenced where the schema has nothing to say.

 `jsonSchemaHover` always produces a tooltip, so a position the schema does
 not describe, a property it does not allow among them, rendered as an empty
 box: two section rules with nothing between them, stacked under whatever
 diagnostic was already there.

 @param view - The editor.
 @param pos - The position hovered.
 @param side - Which side of `pos` the pointer is on.
 @returns The tooltip, or `null` where there is nothing to show.
 */
function schemaHover(
  view: EditorView,
  pos: number,
  side: -1 | 1,
): ReturnType<ReturnType<typeof jsonSchemaHover>> | null {
  const pointer = jsonPointerForPosition(view.state, pos, side, 'json4');
  if (annotationAt(pointer) === null) {
    return null;
  }

  return hoverSource(view, pos, side);
}

const hoverSource = jsonSchemaHover({ getHoverTexts: hoverTexts });

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
  // What `codemirror-json-schema`'s own `jsonSchema()` bundles, spelled out
  // so the hover can be given its text (see `hoverTexts`). Squiggles,
  // completion and hover are all driven by the same schema the status line
  // validates against.
  json(),
  linter(jsonParseLinter()),
  linter(jsonSchemaLinter(), { needsRefresh: handleRefresh }),
  jsonLanguage.data.of({ autocomplete: jsonCompletion() }),
  hoverTooltip(schemaHover),
  stateExtensions(editorSchema),
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
        'min-h-30 flex-1 overflow-auto rounded-md border bg-background',
        invalid ? 'border-mark shadow-invalid' : 'border-input',
      )}
    />
  );
}
