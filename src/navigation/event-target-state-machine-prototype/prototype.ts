#!/usr/bin/env node

/**
 PROTOTYPE TUI: drive the navigation machine by hand and inspect every state.
 */
import { emitKeypressEvents } from 'node:readline';
import { NavigationController } from './controller.ts';
import {
  type MachineEnvironment,
  type NavigationEventProtocol,
  type NavigationInput,
  type NavigationOptions,
  type Point,
} from './machine.ts';

type DemoLeaf = {
  readonly angle: number;
  readonly isLeaf: true;
  readonly isRoot: false;
  readonly key: string;
  readonly kind: 'leaf';
  readonly label: string;
};

type DemoMenu = {
  readonly angle: number;
  readonly isLeaf: false;
  readonly isRoot: boolean;
  readonly items: readonly DemoNode[];
  readonly key: string;
  readonly kind: 'menu';
  readonly label: string;
};

type DemoNode = DemoLeaf | DemoMenu;

const leaf = (key: string, label: string, angle: number): DemoLeaf => ({
  angle,
  isLeaf: true,
  isRoot: false,
  key,
  kind: 'leaf',
  label,
});

const copy = leaf('tools.copy', 'Copy', 0);
const paste = leaf('tools.paste', 'Paste', 180);
const tools: DemoMenu = {
  angle: 90,
  isLeaf: false,
  isRoot: false,
  items: [copy, paste],
  key: 'tools',
  kind: 'menu',
  label: 'Tools…',
};
const root: DemoMenu = {
  angle: 0,
  isLeaf: false,
  isRoot: true,
  items: [
    leaf('open', 'Open', 0),
    tools,
    leaf('close', 'Close', 180),
    leaf('save', 'Save', -90),
  ],
  key: 'root',
  kind: 'menu',
  label: 'Root',
};

const deltaAngle = (first: number, second: number): number =>
  ((second - first + 540) % 360) - 180;

const nearest = (
  items: readonly DemoNode[],
  angle: number,
): DemoNode | null => {
  let result: DemoNode | null = null;
  let delta = Infinity;
  for (const item of items) {
    const candidateDelta = Math.abs(deltaAngle(item.angle, angle));
    if (candidateDelta < delta) {
      result = item;
      delta = candidateDelta;
    }
  }

  return result;
};

const polar = (
  position: Point,
  center: Point,
): { readonly angle: number; readonly radius: number } => {
  const x = position[0] - center[0];
  const y = position[1] - center[1];
  return {
    angle: Math.atan2(y, x) * (180 / Math.PI),
    radius: Math.hypot(x, y),
  };
};

const strokeDirection = (stroke: readonly Point[]): number | null => {
  const first = stroke[0];
  const last = stroke.at(-1);
  if (!first || !last || first === last) {
    return null;
  }

  return polar(last, first).angle;
};

const environment: MachineEnvironment<DemoNode, DemoLeaf, DemoMenu> = {
  hitTest(menu, center, position, minSelectionDist) {
    const { angle, radius } = polar(position, center);
    return {
      active: radius < minSelectionDist ? null : nearest(menu.items, angle),
      radius,
    };
  },
  isLeaf(node): node is DemoLeaf {
    return node.kind === 'leaf';
  },
  isMenu(node): node is DemoMenu {
    return node.kind === 'menu';
  },
  recognizeLeaf(stroke) {
    const direction = strokeDirection(stroke);
    if (direction === null) {
      return null;
    }

    const selected = nearest(root.items, direction);
    if (!selected) {
      return null;
    }

    if (selected.kind === 'leaf') {
      return selected;
    }

    return (
      selected.items.find((item): item is DemoLeaf => item.kind === 'leaf') ??
      null
    );
  },
  recognizeMenu(stroke) {
    const direction = strokeDirection(stroke);
    if (direction === null) {
      return null;
    }

    const selected = nearest(root.items, direction);
    return selected?.kind === 'menu' ? selected : null;
  },
  root,
};

const options: NavigationOptions = {
  minMenuSelectionDist: 80,
  minSelectionDist: 40,
  movementsThreshold: 10,
  noviceDwellingTime: 333,
  submenuOpeningDelay: 100,
};

const outputTypes = [
  'start',
  'draw',
  'open',
  'change',
  'move',
  'select',
  'cancel',
] as const satisfies ReadonlyArray<
  keyof NavigationEventProtocol<DemoNode, DemoLeaf, DemoMenu>
>;

const controller = new NavigationController(environment, options, {
  autoTimers: false,
});
const history: Array<{ readonly detail: unknown; readonly type: string }> = [];

for (const type of outputTypes) {
  controller.addEventListener(type, (event) => {
    history.push({
      detail: event.detail,
      type: event.type,
    });
    if (history.length > 8) {
      history.shift();
    }
  });
}

const bold = '\u{1B}[1m';
const dim = '\u{1B}[2m';
const reset = '\u{1B}[0m';
let now = 0;
let position: Point = [0, 0];
let lastAction = 'ready';
let staleTimer = controller.pendingTimers[0];

const nodeName = (node: DemoNode | null): string | null => node?.label ?? null;

const stateView = () => {
  const { phase } = controller.state;
  if (phase.status === 'idle') {
    return {
      nextTimerToken: controller.state.nextTimerToken,
      pendingTimers: controller.pendingTimers,
      status: phase.status,
    };
  }

  const gesture = {
    lastSignificantPosition: phase.gesture.lastSignificantPosition,
    origin: phase.gesture.origin,
    position: phase.gesture.position,
    stroke: phase.gesture.stroke,
  };
  if (phase.status !== 'novice') {
    return {
      gesture,
      modeTimer: phase.modeTimer,
      nextTimerToken: controller.state.nextTimerToken,
      pendingTimers: controller.pendingTimers,
      status: phase.status,
    };
  }

  return {
    active: nodeName(phase.active),
    gesture,
    menu: phase.menu.label,
    menuCenter: phase.menuCenter,
    menuPath: phase.menuPath.map(({ label }) => label),
    nextTimerToken: controller.state.nextTimerToken,
    pendingTimers: controller.pendingTimers,
    radius: phase.radius,
    status: phase.status,
    submenuTimer: phase.submenuTimer,
  };
};

const detailView = (detail: unknown): unknown => {
  if (!detail || typeof detail !== 'object') {
    return detail;
  }

  const candidate = detail as Record<string, unknown>;
  return Object.fromEntries(
    Object.entries(candidate).map(([key, value]) => {
      if (
        (key === 'active' || key === 'menu' || key === 'selection') &&
        value &&
        typeof value === 'object' &&
        'label' in value
      ) {
        return [key, (value as { readonly label: string }).label];
      }

      return [key, value];
    }),
  );
};

const render = () => {
  console.clear();
  console.log(`${bold}EventTarget + state machine prototype${reset}`);
  console.log(
    `${dim}Last action: ${lastAction} · synthetic time: ${now}ms${reset}\n`,
  );
  console.log(`${bold}Current state${reset}`);
  console.log(JSON.stringify(stateView(), null, 2));
  console.log(`\n${bold}Recent public events${reset}`);
  console.log(
    history.length === 0
      ? `${dim}(none)${reset}`
      : JSON.stringify(
          history.map(({ detail, type }) => ({
            detail: detailView(detail),
            type,
          })),
          null,
          2,
        ),
  );
  console.log(`\n${bold}Actions${reset}`);
  console.log(
    `${bold}[s]${reset} ${dim}start at origin${reset}  ` +
      `${bold}[r]${reset} ${dim}move right${reset}  ` +
      `${bold}[v]${reset} ${dim}move down${reset}  ` +
      `${bold}[m]${reset} ${dim}tiny move${reset}`,
  );
  console.log(
    `${bold}[l]${reset} ${dim}long move${reset}       ` +
      `${bold}[d]${reset} ${dim}fire dwell${reset} ` +
      `${bold}[x]${reset} ${dim}fire stale dwell${reset} ` +
      `${bold}[u]${reset} ${dim}release${reset}     ` +
      `${bold}[c]${reset} ${dim}cancel${reset}  ` +
      `${bold}[q]${reset} ${dim}quit${reset}`,
  );
};

const sample = (): { readonly position: Point; readonly timeStamp: number } => {
  now += 50;
  return { position, timeStamp: now };
};

const sendPointer = (
  type: Extract<
    NavigationInput['type'],
    'pointer.cancel' | 'pointer.down' | 'pointer.move' | 'pointer.up'
  >,
) => {
  controller.send({ type, detail: sample() });
};

const act = (key: string) => {
  switch (key) {
    case 's': {
      position = [0, 0];
      lastAction = 'pointer.down at [0, 0]';
      sendPointer('pointer.down');
      break;
    }

    case 'r': {
      position = [100, 0];
      lastAction = 'pointer.move right to [100, 0]';
      staleTimer = controller.pendingTimers.at(-1);
      sendPointer('pointer.move');
      break;
    }

    case 'v': {
      position = [0, 100];
      lastAction = 'pointer.move down to [0, 100]';
      staleTimer = controller.pendingTimers.at(-1);
      sendPointer('pointer.move');
      break;
    }

    case 'm': {
      position = [position[0] + 2, position[1]];
      lastAction = `tiny pointer.move to [${position.join(', ')}]`;
      sendPointer('pointer.move');
      break;
    }

    case 'l': {
      position = [position[0] + 20, position[1]];
      lastAction = `long pointer.move to [${position.join(', ')}]`;
      staleTimer = controller.pendingTimers.at(-1);
      sendPointer('pointer.move');
      break;
    }

    case 'd': {
      const pending = controller.pendingTimers.at(-1);
      lastAction = pending
        ? `elapsed ${pending.kind}#${pending.token}`
        : 'no timer to elapse';
      if (pending) {
        now += 500;
        controller.elapse(pending, now);
      }

      break;
    }

    case 'x': {
      lastAction = staleTimer
        ? `elapsed stale ${staleTimer.kind}#${staleTimer.token}`
        : 'no stale timer captured';
      if (staleTimer) {
        now += 500;
        controller.elapse(staleTimer, now);
      }

      break;
    }

    case 'u': {
      lastAction = 'pointer.up';
      sendPointer('pointer.up');
      break;
    }

    case 'c': {
      lastAction = 'pointer.cancel';
      sendPointer('pointer.cancel');
      break;
    }

    default: {
      lastAction = `unknown key "${key}"`;
    }
  }

  render();
};

const shutDown = () => {
  controller.dispose();
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(false);
  }

  process.stdin.pause();
  console.clear();
};

if (!process.stdin.isTTY) {
  throw new Error('This prototype needs an interactive terminal.');
}

emitKeypressEvents(process.stdin);
process.stdin.setRawMode(true);
process.stdin.resume();
process.stdin.on(
  'keypress',
  (input, key: { ctrl?: boolean; name?: string }) => {
    if (key.name === 'q' || (key.ctrl && key.name === 'c')) {
      shutDown();
      return;
    }

    act(input);
  },
);

render();
