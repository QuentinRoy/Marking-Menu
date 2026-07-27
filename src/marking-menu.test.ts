import { map } from 'rxjs/operators';
import { marbles } from 'rxjs-marbles/jest';
import type { TestObservableLike } from 'rxjs-marbles/types';
import { type Mock } from 'vitest';
import type { Observable } from 'rxjs';
import {
  createMarkingMenu as main,
  exportNotification,
  type MarkingMenuConfig,
} from './marking-menu.js';
import { navigation } from './navigation/navigation.js';
import { createModel } from './model.js';
import { createMenu as createMenuLayout } from './layout/menu.js';
import { createStrokeCanvas } from './layout/stroke.js';
import { createGestureFeedback } from './layout/gesture-feedback.js';
import { connectLayout } from './layout/connect.js';
import { watchDrags } from './move/linear-drag.js';

vi.mock('./navigation/navigation');
vi.mock('./layout/menu');
vi.mock('./layout/stroke');
vi.mock('./layout/gesture-feedback');
vi.mock('./layout/connect');
vi.mock('./model');
vi.mock('./move/linear-drag');

// The collaborators are auto-mocked and driven with placeholder tokens (string
// parents/models, raw event labels) compared only structurally at runtime, so
// each mock is aliased with a loose signature.
const mockNavigation = vi.mocked(navigation) as unknown as Mock<
  (...args: unknown[]) => Observable<unknown>
>;
const mockCreateModel = vi.mocked(createModel) as unknown as Mock<
  (...args: unknown[]) => unknown
>;
const mockWatchDrags = vi.mocked(watchDrags) as unknown as Mock<
  (...args: unknown[]) => unknown
>;
const mockConnectLayout = vi.mocked(connectLayout) as unknown as Mock<
  (...args: unknown[]) => Observable<unknown>
>;
const mockCreateMenuLayout = vi.mocked(createMenuLayout) as unknown as Mock<
  (...args: unknown[]) => unknown
>;
const mockCreateStrokeCanvas = vi.mocked(createStrokeCanvas) as unknown as Mock<
  (...args: unknown[]) => unknown
>;
const mockCreateGestureFeedback = vi.mocked(
  createGestureFeedback,
) as unknown as Mock<(...args: unknown[]) => unknown>;

describe('exportNotification', () => {
  it('filters everything but the proper properties', () => {
    expect(
      exportNotification({
        bar: 'bar',
        type: 'type',
        mode: 'mode',
        position: ['pos'],
        active: 'active',
        foo: 'foo',
        selection: 'selection',
        timeStamp: 'timeStamp',
      } as unknown as Parameters<typeof exportNotification>[0]),
    ).toEqual({
      type: 'type',
      mode: 'mode',
      position: ['pos'],
      active: 'active',
      selection: 'selection',
      timeStamp: 'timeStamp',
    });
  });
  it('translate center to menuCenter', () => {
    expect(
      exportNotification({
        center: ['mock-center'],
      } as unknown as Parameters<typeof exportNotification>[0]),
    ).toEqual({
      menuCenter: ['mock-center'],
    });
  });
  it('copies rather than exposes center', () => {
    const center = ['mock-center'];
    expect(
      exportNotification({
        center,
      } as unknown as Parameters<typeof exportNotification>[0]).menuCenter,
    ).not.toBe(center);
  });
  it('copies rather than exposes position', () => {
    const position = ['mock-position'];
    expect(
      exportNotification({
        position,
      } as unknown as Parameters<typeof exportNotification>[0]).position,
    ).not.toBe(position);
  });
});

describe('main', () => {
  let callMain: (options?: Record<string, unknown>) => Observable<unknown>;
  let mockNavNotifs: Record<string, unknown>;
  let mockNavObs$: TestObservableLike<unknown>;
  let connectedObs$: Observable<unknown>;

  const createNotif = (
    id: string,
    type: string,
    props?: Record<string, unknown>,
  ) => ({
    active: id,
    type,
    notifMockProp: 'notif-mock-prop-val',
    originalEvent: { preventDefault: vi.fn() },
    ...props,
  });

  beforeEach(
    marbles((m) => {
      mockCreateModel.mockImplementation(() => 'mock-model');
      mockWatchDrags.mockImplementation(() => 'mock-drags');
      mockNavNotifs = {
        a: createNotif('a', 'mock-type-1'),
        b: createNotif('b', 'select', { selection: 'mock-selection-b' }),
        c: createNotif('c', 'mock-type-2', { originalEvent: null }),
        d: createNotif('d', 'select', { selection: 'mock-selection-d' }),
        e: createNotif('e', 'mock-type-4', { selection: 'mock-selection-e' }),
      };
      mockNavObs$ = m.hot('--a--b-c--de-|');
      connectedObs$ = mockNavObs$.pipe(
        map((n) => ({ ...(n as Record<string, unknown>), connected: true })),
      );
      mockNavigation.mockImplementation(() => mockNavObs$);
      mockConnectLayout.mockImplementation(() => connectedObs$);
      callMain = (options = {}) =>
        main({
          items: 'mock-items',
          parent: 'mock-parent',
          minSelectionDist: 'mock-minSelectionDist',
          minMenuSelectionDist: 'mock-minMenuSelectionDist',
          submenuOpeningDelay: 'mock-submenuOpeningDelay',
          movementsThreshold: 'mock-movementsThreshold',
          noviceDwellingTime: 'mock-noviceDwellingTime',
          strokeColor: 'mock-strokeColor',
          strokeWidth: 'mock-strokeWidth',
          strokeStartPointRadius: 'mock-strokeStartPointRadius',
          lowerStrokeColor: 'mock-lowerStrokeColor',
          lowerStrokeWidth: 'mock-lowerStrokeWidth',
          lowerStrokeStartPointRadius: 'mock-lowerStrokeStartPointRadius',
          gestureFeedbackDuration: 'mock-gestureFeedbackDuration',
          gestureFeedbackStrokeWidth: 'mock-gestureFeedbackStrokeWidth',
          gestureFeedbackStrokeColor: 'mock-gestureFeedbackStrokeColor',
          gestureFeedbackCanceledStrokeColor:
            'mock-gestureFeedbackCanceledStrokeColor',
          notifySteps: true,
          log: 'mock-log',
          ...options,
        } as unknown as MarkingMenuConfig & { notifySteps: true });
    }),
  );

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('properly creates the model', () => {
    callMain();
    expect(mockCreateModel.mock.calls).toEqual([[{ items: 'mock-items' }]]);
  });
  it('properly creates the drags observable', () => {
    callMain();
    expect(mockWatchDrags.mock.calls).toEqual([['mock-parent']]);
  });
  it('properly creates the navigation observable', () => {
    callMain();
    expect(mockNavigation.mock.calls).toEqual([
      [
        'mock-drags',
        'mock-model',
        {
          minSelectionDist: 'mock-minSelectionDist',
          minMenuSelectionDist: 'mock-minMenuSelectionDist',
          submenuOpeningDelay: 'mock-submenuOpeningDelay',
          movementsThreshold: 'mock-movementsThreshold',
          noviceDwellingTime: 'mock-noviceDwellingTime',
        },
      ],
    ]);
  });

  it("properly prevents default from navigation's notifications", () => {
    callMain().subscribe((n) => {
      const notif = n as { active: string };
      // C does not have original event to make sure it does not fail
      // without it.
      if (notif.active === 'c') {
        return;
      }

      const mockNotif = mockNavNotifs[notif.active] as {
        originalEvent: { preventDefault: Mock };
      };
      expect(mockNotif.originalEvent.preventDefault).toHaveBeenCalled();
    });
  });

  // prettier-ignore
  it('properly connects the layout', marbles(m => {
    mockNavObs$ = m.hot(  '--a--b-c|', mockNavNotifs);
    connectedObs$ = m.hot('--d-e--f-g|');
    const connectedSub =  '^---------!';
    callMain().subscribe();
    expect(mockConnectLayout).toHaveBeenCalledTimes(1);
    const options = mockConnectLayout.mock.calls[0]?.[0] as {
      parent: unknown;
      navigation$: Observable<unknown>;
      createMenuLayout: unknown;
      createUpperStrokeCanvas: unknown;
      createLowerStrokeCanvas: unknown;
      createGestureFeedback: unknown;
      log: unknown;
    };
    expect(options.parent).toBe('mock-parent');
    m.expect(options.navigation$).toBeObservable(mockNavObs$);
    m.expect(connectedObs$).toHaveSubscriptions(connectedSub);
    expect(options.createMenuLayout).toBeInstanceOf(Function);
    expect(options.createUpperStrokeCanvas).toBeInstanceOf(Function);
    expect(options.createLowerStrokeCanvas).toBeInstanceOf(Function);
    expect(options.createGestureFeedback).toBeInstanceOf(Function);
    expect(options.log).toBe('mock-log');
  }));

  it('properly binds MenuLayout when it connects the layout', () => {
    callMain();
    // Make sure it properly binds connectLayout and stroke canvas.
    const options = mockConnectLayout.mock.calls[0]?.[0] as {
      createMenuLayout: (...args: unknown[]) => unknown;
    };
    options.createMenuLayout(
      'mock-parent-2',
      'mock-menuModel-2',
      'mock-center-2',
      'mock-current-2',
    );
    expect(mockCreateMenuLayout.mock.calls).toEqual([
      [
        {
          parent: 'mock-parent-2',
          model: 'mock-menuModel-2',
          center: 'mock-center-2',
          current: 'mock-current-2',
        },
      ],
    ]);
  });

  it('properly binds UpperStrokeCanvas when it connects the layout', () => {
    callMain();
    const options = mockConnectLayout.mock.calls[0]?.[0] as {
      createUpperStrokeCanvas: (...args: unknown[]) => unknown;
    };
    options.createUpperStrokeCanvas('mock-parent-3');
    expect(mockCreateStrokeCanvas.mock.calls).toEqual([
      [
        {
          parent: 'mock-parent-3',
          lineColor: 'mock-strokeColor',
          lineWidth: 'mock-strokeWidth',
          pointRadius: 'mock-strokeStartPointRadius',
        },
      ],
    ]);
  });

  it('properly binds LowerStrokeCanvas when it connects the layout', () => {
    callMain();
    const options = mockConnectLayout.mock.calls[0]?.[0] as {
      createLowerStrokeCanvas: (...args: unknown[]) => unknown;
    };
    options.createLowerStrokeCanvas('mock-parent-4');
    expect(mockCreateStrokeCanvas.mock.calls).toEqual([
      [
        {
          parent: 'mock-parent-4',
          lineColor: 'mock-lowerStrokeColor',
          lineWidth: 'mock-lowerStrokeWidth',
          pointRadius: 'mock-lowerStrokeStartPointRadius',
        },
      ],
    ]);
  });

  it('properly binds GestureFeedback when it connects the layout', () => {
    callMain();
    const options = mockConnectLayout.mock.calls[0]?.[0] as {
      createGestureFeedback: (...args: unknown[]) => unknown;
    };
    options.createGestureFeedback({
      parent: 'mock-parent-5',
    });
    expect(mockCreateGestureFeedback.mock.calls).toEqual([
      [
        {
          parent: 'mock-parent-5',
          duration: 'mock-gestureFeedbackDuration',
          strokeOptions: {
            lineColor: 'mock-gestureFeedbackStrokeColor',
            lineWidth: 'mock-gestureFeedbackStrokeWidth',
          },
          canceledStrokeOptions: {
            lineColor: 'mock-gestureFeedbackCanceledStrokeColor',
          },
        },
      ],
    ]);
  });

  // prettier-ignore
  it('can notify every steps', marbles((m) => {
      /* eslint-disable @typescript-eslint/naming-convention -- Observable testing use capital letters for marble values */
      const expectedValues = {
        A: {
          type: 'mock-type-1',
          active: 'a',
          menuCenter: undefined,
          mode: undefined,
          position: undefined,
          selection: undefined,
          timeStamp: undefined,
        },
        B: {
          type: 'select',
          active: 'b',
          selection: 'mock-selection-b',
          menuCenter: undefined,
          mode: undefined,
          position: undefined,
          timeStamp: undefined,
        },
        C: {
          type: 'mock-type-2',
          active: 'c',
          menuCenter: undefined,
          mode: undefined,
          position: undefined,
          selection: undefined,
          timeStamp: undefined,
        },
      };
      /* eslint-enable @typescript-eslint/naming-convention */
      connectedObs$ = m.hot('--a-b--c-|', mockNavNotifs);
      const expected$ = m.hot('--A-B--C-|', expectedValues);
      m.expect(callMain()).toBeObservable(expected$);
    })
  );

  // prettier-ignore
  it('can notify selections only', marbles(m => {
    /* eslint-disable @typescript-eslint/naming-convention -- Observable testing use capital letters for marble values */
    const selections = {
      B: 'mock-selection-b',
      D: 'mock-selection-d'
    };
    /* eslint-enable @typescript-eslint/naming-convention */
    connectedObs$ = m.hot(  '--a-b--c-de-|', mockNavNotifs);
    const expected$ = m.hot('----B----D--|', selections);
    m.expect(callMain({ notifySteps: false })).toBeObservable(expected$);
  }));
});
