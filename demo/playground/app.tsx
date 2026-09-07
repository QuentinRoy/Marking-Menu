import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { MarkingMenuInput } from '../../src/types.js';
import { readMenuConfig, writeMenuConfig } from '../menu-config.js';
import { Button } from './components/ui/button.js';
import { Checkbox } from './components/ui/checkbox.js';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from './components/ui/tabs.js';
import { JsonEditor } from './json-editor.js';
import {
  IDLE_RESULT,
  LiveSurface,
  type GestureResult,
} from './live-surface.js';
import {
  buildMenuModel,
  nodeAt,
  stepsAlong,
  type MenuModel,
  type MenuStep,
} from './menu-model.js';
import { validateMenuSource } from './menu-schema.js';
import { DEFAULT_MENU, formatMenu } from './menu-source.js';
import { PreviewSurface } from './preview-surface.js';

const REPOSITORY_URL = 'https://github.com/QuentinRoy/Marking-Menu';

// How long "Link copied" stays on the button before it goes back to naming
// what it does.
const COPIED_FEEDBACK_MS = 1600;

type Applied = { menu: MarkingMenuInput; model: MenuModel };

/**
 The menu the page opens on: the one the address names, or the demo's own.

 @returns The menu and its model.
 */
function initialMenu(): Applied {
  const shared = readMenuConfig(location.search);
  const fromAddress = shared === null ? null : buildMenuModel(shared);
  if (shared !== null && fromAddress?.ok === true) {
    return { menu: shared, model: fromAddress.model };
  }

  const fallback = buildMenuModel(DEFAULT_MENU);
  if (!fallback.ok) {
    throw new Error(`The default menu does not build: ${fallback.message}`);
  }

  return { menu: DEFAULT_MENU, model: fallback.model };
}

export function App() {
  const [applied, setApplied] = useState<Applied>(initialMenu);
  const [source, setSource] = useState(() => formatMenu(applied.menu));
  const [status, setStatus] = useState('');
  const [mode, setMode] = useState('live');
  const [focusPath, setFocusPath] = useState<readonly number[]>([]);
  // Off to begin with: the mark as the menu drew it is what a reader wants
  // to see first; the breakdown is for when they ask how it was read.
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [result, setResult] = useState<GestureResult>(IDLE_RESULT);
  const [copied, setCopied] = useState(false);

  /**
   Take the editor's text as the new truth: show it, and, if it describes a
   menu the library can build, make that the menu everything else is about.
   Text that does not is kept on screen with the reason under it, so an edit
   in progress is never thrown away.
   */
  const applySource = useCallback((next: string) => {
    setSource(next);
    const parsed = validateMenuSource(next);
    if (!parsed.ok) {
      setStatus(parsed.message);
      return;
    }

    const built = buildMenuModel(parsed.menu);
    if (!built.ok) {
      setStatus(built.message);
      return;
    }

    setStatus('');
    setApplied({ menu: parsed.menu, model: built.model });
    // A different menu is a different tree: the level the preview was
    // looking at is not necessarily there any more.
    setFocusPath([]);
    setResult(IDLE_RESULT);
  }, []);

  useEffect(() => {
    history.replaceState(
      null,
      '',
      writeMenuConfig(location.search, applied.menu),
    );
  }, [applied]);

  // The back button, onto an address carrying a different menu: the editor
  // takes that menu, even mid-edit. The address is the shared thing.
  useEffect(() => {
    const onPopState = () => {
      const shared = readMenuConfig(location.search);
      if (shared !== null) {
        applySource(formatMenu(shared));
      }
    };

    globalThis.addEventListener('popstate', onPopState);
    return () => {
      globalThis.removeEventListener('popstate', onPopState);
    };
  }, [applySource]);

  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (copiedTimerRef.current !== null) {
        clearTimeout(copiedTimerRef.current);
      }
    },
    [],
  );

  const onCopy = () => {
    const url = `${location.origin}${location.pathname}${writeMenuConfig(location.search, applied.menu)}`;
    void navigator.clipboard?.writeText(url).catch(() => {
      // A refused clipboard is not worth interrupting the page over; the
      // address bar already holds the same link.
    });
    setCopied(true);
    if (copiedTimerRef.current !== null) {
      clearTimeout(copiedTimerRef.current);
    }

    copiedTimerRef.current = setTimeout(() => {
      setCopied(false);
    }, COPIED_FEEDBACK_MS);
  };

  const showPreviewAt = (path: readonly number[]) => {
    setFocusPath(path);
    setMode('preview');
  };

  const isLive = mode === 'live';
  const focusedCount = nodeAt(applied.model, focusPath).items.length;

  return (
    <div className="wide:h-dvh wide:flex-row wide:overflow-hidden flex min-h-dvh flex-col items-stretch">
      <aside className="border-rule bg-paper wide:min-h-0 wide:max-w-105 wide:min-w-72 wide:shrink wide:grow wide:basis-80 wide:overflow-y-auto wide:border-r wide:border-b-0 flex flex-col gap-4.5 border-b px-5.5 pt-5.5 pb-4.5">
        <div className="flex flex-col gap-1.5">
          <span className="text-quieter text-eyebrow tracking-eyebrow font-mono uppercase">
            marking-menu
          </span>
          <h1 className="text-title tracking-title m-0 font-semibold">
            Playground
          </h1>
          <p className="text-quiet text-lede m-0 leading-6 text-pretty">
            Edit the menu, then use it: hold to open it and draw to an item, or
            draw the mark straight away. The readout tells you what the
            recognizer made of each gesture.
          </p>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-2">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-xs font-semibold tracking-wide">Items</span>
            <Button
              variant="ghost"
              size="xs"
              className="text-quiet"
              onClick={() => {
                applySource(formatMenu(DEFAULT_MENU));
              }}
            >
              Reset
            </Button>
          </div>
          <JsonEditor
            value={source}
            invalid={status !== ''}
            onChange={applySource}
            // Printing the menu back only once the field is left: doing it
            // mid-edit would move the caret out from under the typist.
            onBlur={() => {
              if (status === '') {
                applySource(formatMenu(applied.menu));
              }
            }}
          />
          <div
            role="status"
            className="text-mark text-meta min-h-4.5 font-mono leading-normal"
          >
            {status}
          </div>
        </div>

        <div className="flex gap-2">
          <Button className="flex-1" onClick={onCopy}>
            {copied ? 'Link copied' : 'Copy link'}
          </Button>
          <Button variant="outline" className="text-quiet" asChild>
            {/* The demo page reads the same parameter, so this carries the
                menu across rather than dropping the reader on the default. */}
            <a href={`../${writeMenuConfig('', applied.menu)}`}>Demo</a>
          </Button>
          <Button variant="outline" className="text-quiet" asChild>
            <a href={REPOSITORY_URL}>GitHub</a>
          </Button>
        </div>
      </aside>

      <Tabs
        value={mode}
        onValueChange={(next) => {
          setMode(next);
          setResult(IDLE_RESULT);
        }}
        className="wide:min-w-80 wide:shrink wide:grow-4 wide:basis-80 flex min-h-0 flex-col gap-0"
      >
        <div className="border-rule-soft flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b px-5 py-3">
          <TabsList>
            {/* shadcn's dark treatment for the selected tab is a 30%
                overlay, which all but disappears against this list; the
                raised look of the light theme is restored here rather than
                in the vendored component. */}
            {(['live', 'preview'] as const).map((value) => (
              <TabsTrigger
                key={value}
                value={value}
                className="dark:data-[state=active]:border-border dark:data-[state=active]:bg-accent capitalize"
              >
                {value}
              </TabsTrigger>
            ))}
          </TabsList>
          {isLive && (
            <div className="text-quieter text-meta flex items-center gap-4 font-mono">
              <label className="flex cursor-pointer items-center gap-1.5 select-none">
                <Checkbox
                  checked={showBreakdown}
                  onCheckedChange={(next) => {
                    setShowBreakdown(next === true);
                  }}
                  className="size-3.5 [&_svg]:size-3"
                />
                Breakdown
              </label>
              {showBreakdown && <Legend />}
            </div>
          )}
        </div>

        <TabsContent value="live" className="flex min-h-0 flex-1 flex-col">
          <LiveSurface
            menu={applied.menu}
            model={applied.model}
            showBreakdown={showBreakdown}
            onResult={setResult}
          />
          <Footer metrics={result.metrics}>
            {result.steps === null ? (
              <span className="text-chip font-mono font-medium text-pretty">
                {result.message}
              </span>
            ) : (
              <Path steps={result.steps} onSelect={showPreviewAt} />
            )}
          </Footer>
        </TabsContent>

        <TabsContent value="preview" className="flex min-h-0 flex-1 flex-col">
          <PreviewSurface
            model={applied.model}
            focusPath={focusPath}
            onFocus={setFocusPath}
          />
          <Footer metrics={`${focusedCount} item(s) at this level`}>
            <Path
              steps={[
                { label: 'Top level', path: [], isLeaf: false },
                ...stepsAlong(applied.model, focusPath),
              ]}
              current={focusPath.length}
              onSelect={setFocusPath}
            />
          </Footer>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Footer({
  metrics,
  children,
}: {
  metrics: string;
  children: ReactNode;
}) {
  return (
    <div className="border-rule-soft bg-paper flex min-h-13 flex-wrap items-center justify-between gap-5 border-t px-5 py-3.5">
      <div className="flex flex-wrap items-center gap-0.5">{children}</div>
      <span className="text-quieter text-meta font-mono whitespace-nowrap">
        {metrics}
      </span>
    </div>
  );
}

/**
 A path through the menu, one clickable step at a time. The recognized path
 doubles as a way into the preview: you look at a level by having drawn your
 way into it.
 */
function Path({
  steps,
  current,
  onSelect,
}: {
  steps: readonly MenuStep[];
  /**
  The index of the step already being shown, which is not a link.
  */
  current?: number;
  onSelect: (path: readonly number[]) => void;
}) {
  return steps.map((step, index) => {
    const isCurrent = index === current;
    const isLink = !isCurrent && !step.isLeaf;
    return (
      <span key={step.path.join('-')} className="flex items-center gap-0.5">
        {index > 0 && <span className="text-edge-soft text-chip px-1">›</span>}
        <button
          type="button"
          disabled={!isLink}
          title={step.isLeaf ? 'A leaf item, nothing to preview' : undefined}
          className={
            isLink
              ? 'text-quiet decoration-edge-soft hover:text-ink text-chip cursor-pointer rounded-sm px-1.5 py-0.5 font-mono underline underline-offset-2'
              : 'text-ink text-chip rounded-sm px-1.5 py-0.5 font-mono font-medium'
          }
          onClick={() => {
            onSelect(step.path);
          }}
        >
          {step.label}
        </button>
      </span>
    );
  });
}

/**
 What each colour on the surface means, which is only worth saying while the
 breakdown is drawn: without it the only thing on screen is the mark itself.
 The swatches are the colours the overlay draws with (see `live-surface.tsx`).
 */
function Legend() {
  const entries = [
    ['stroke', 'bg-stroke-trace rounded-xs'],
    ['pieces', 'bg-mark rounded-xs'],
    ['corners', 'bg-ink rounded-full'],
  ] as const;
  return entries.map(([label, dot]) => (
    <span key={label} className="flex items-center gap-1.5 whitespace-nowrap">
      <span className={`size-2 shrink-0 ${dot}`} />
      {label}
    </span>
  ));
}
