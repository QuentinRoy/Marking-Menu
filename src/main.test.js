import { map } from 'rxjs/operators';
import { marbles } from 'rxjs-marbles/jest';
import main, { exportNotification } from './main';
import navigation from './navigation';
import createModel from './model';
import { createMenuLayout, createStrokeCanvas, connectLayout } from './layout';
import { watchDrags } from './move';

jest.mock('./navigation');
jest.mock('./layout');
jest.mock('./model');
jest.mock('./move');

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
        timeStamp: 'timeStamp'
      })
    ).toEqual({
      type: 'type',
      mode: 'mode',
      position: ['pos'],
      active: 'active',
      selection: 'selection',
      timeStamp: 'timeStamp'
    });
  });
  it('translate center to menuCenter', () => {
    expect(
      exportNotification({
        center: ['mock-center']
      })
    ).toEqual({
      menuCenter: ['mock-center']
    });
  });
  it('copies rather than exposes center', () => {
    const center = ['mock-center'];
    expect(exportNotification({ center }).menuCenter).not.toBe(center);
  });
  it('copies rather than exposes position', () => {
    const position = ['mock-position'];
    expect(exportNotification({ position }).position).not.toBe(position);
  });
});

describe('main', () => {
  let callMain;
  let mockNavNotifs;
  let mockNavObs$;
  let connectedObs$;

  const Notif = (id, type, props) => ({
    active: id,
    type,
    notifMockProp: 'notif-mock-prop-val',
    originalEvent: { preventDefault: jest.fn() },
    ...props
  });

  beforeEach(
    marbles(m => {
      createModel.mockImplementation(() => 'mock-model');
      watchDrags.mockImplementation(() => 'mock-drags');
      mockNavNotifs = {
        a: Notif('a', 'mock-type-1'),
        b: Notif('b', 'select', { selection: 'mock-selection-b' }),
        c: Notif('c', 'mock-type-2', { originalEvent: null }),
        d: Notif('d', 'select', { selection: 'mock-selection-d' }),
        e: Notif('e', 'mock-type-4', { selection: 'mock-selection-e' })
      };
      mockNavObs$ = m.hot('--a--b-c--de-|');
      connectedObs$ = mockNavObs$.pipe(map(n => ({ ...n, connected: true })));
      navigation.mockImplementation(() => mockNavObs$);
      connectLayout.mockImplementation(() => connectedObs$);
      callMain = (opts = {}) =>
        main('mock-items', 'mock-parentDOM', {
          minSelectionDist: 'mock-minSelectionDist',
          minMenuSelectionDist: 'mock-minMenuSelectionDist',
          subMenuOpeningDelay: 'mock-subMenuOpeningDelay',
          movementsThreshold: 'mock-movementsThreshold',
          noviceDwellingTime: 'mock-noviceDwellingTime',
          strokeColor: 'mock-strokeColor',
          strokeWidth: 'mock-strokeWidth',
          strokeStartPointRadius: 'mock-strokeStartPointRadius',
          notifySteps: true,
          log: 'mock-log',
          ...opts
        });
    })
  );

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('properly creates the model', () => {
    callMain();
    expect(createModel.mock.calls).toEqual([['mock-items']]);
  });
  it('properly creates the drags observable', () => {
    callMain();
    expect(watchDrags.mock.calls).toEqual([['mock-parentDOM']]);
  });
  it('properly creates the navigation observable', () => {
    callMain();
    expect(navigation.mock.calls).toEqual([
      [
        'mock-drags',
        'mock-model',
        {
          minSelectionDist: 'mock-minSelectionDist',
          minMenuSelectionDist: 'mock-minMenuSelectionDist',
          subMenuOpeningDelay: 'mock-subMenuOpeningDelay',
          movementsThreshold: 'mock-movementsThreshold',
          noviceDwellingTime: 'mock-noviceDwellingTime'
        }
      ]
    ]);
  });

  it("properly prevents default from navigation's notifications", () => {
    callMain().subscribe(n => {
      // c does not have original event to make sure it does not fail
      // without it.
      if (n.active !== 'c') {
        const mockNotif = mockNavNotifs[n.active];
        expect(mockNotif.originalEvent.preventDefault).toHaveBeenCalled();
      }
    });
  });

  // prettier-ignore
  it('properly connects the layout', marbles(m => {
    mockNavObs$ = m.hot(  '--a--b-c|', mockNavNotifs);
    connectedObs$ = m.hot('--d-e--f-g|');
    const connectedSub =  '^---------!';
    callMain().subscribe();
    expect(connectLayout).toHaveBeenCalledTimes(1);
    expect(connectLayout.mock.calls[0][0]).toBe('mock-parentDOM');
    m.expect(connectLayout.mock.calls[0][1]).toBeObservable(mockNavObs$);
    m.expect(connectedObs$).toHaveSubscriptions(connectedSub);
    expect(connectLayout.mock.calls[0][4]).toBe('mock-log');
  }));

  it('properly binds MenuLayout and StrokeCanvas when it connects the layout', () => {
    callMain();
    // Make sure it properly binds connectLayout and stroke canvas.
    connectLayout.mock.calls[0][2](
      'mock-parent-2',
      'mock-menuModel-2',
      'mock-center-2',
      'mock-current-2'
    );
    expect(createMenuLayout.mock.calls).toEqual([
      [
        'mock-parent-2',
        'mock-menuModel-2',
        'mock-center-2',
        'mock-current-2',
        {}
      ]
    ]);
    connectLayout.mock.calls[0][3]('mock-parent-3');
    expect(createStrokeCanvas.mock.calls).toEqual([
      [
        'mock-parent-3',
        {
          lineColor: 'mock-strokeColor',
          lineWidth: 'mock-strokeWidth',
          pointRadius: 'mock-strokeStartPointRadius'
        }
      ]
    ]);
  });

  // prettier-ignore
  it('can notify every steps', marbles(m => {
    const expectedValues = {
      A: { type: 'mock-type-1', active: 'a' },
      B: { type: 'select', active: 'b', selection: 'mock-selection-b' },
      C: { type: 'mock-type-2', active: 'c' }
    };
    connectedObs$ = m.hot(  '--a-b--c-|', mockNavNotifs);
    const expected$ = m.hot('--A-B--C-|', expectedValues);
    m.expect(callMain()).toBeObservable(expected$);
  }));

  // prettier-ignore
  it('can notify selections only', marbles(m => {
    const selections = {
      B: 'mock-selection-b',
      D: 'mock-selection-d'
    };
    connectedObs$ = m.hot(  '--a-b--c-de-|', mockNavNotifs);
    const expected$ = m.hot('----B----D--|', selections);
    m.expect(callMain({ notifySteps: false })).toBeObservable(expected$);
  }));
});
