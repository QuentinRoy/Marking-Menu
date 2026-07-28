import { claimTouchAction } from './touch-action.js';

describe('claimTouchAction', () => {
  it('forces touch-action none as important while a claim is held', () => {
    const element = document.createElement('div');

    claimTouchAction(element);

    expect(element.style.getPropertyValue('touch-action')).toBe('none');
    expect(element.style.getPropertyPriority('touch-action')).toBe('important');
  });

  it('removes the property entirely when there was no inline value', () => {
    const element = document.createElement('div');

    claimTouchAction(element)();

    expect(element.style.getPropertyValue('touch-action')).toBe('');
    expect(element.style.getPropertyPriority('touch-action')).toBe('');
    expect(element.getAttribute('style')).not.toContain('touch-action');
  });

  it('restores the exact prior value and priority on the last release', () => {
    const element = document.createElement('div');
    element.style.setProperty('touch-action', 'pan-x', 'important');

    claimTouchAction(element)();

    expect(element.style.getPropertyValue('touch-action')).toBe('pan-x');
    expect(element.style.getPropertyPriority('touch-action')).toBe('important');
  });

  it('restores a prior value that had no priority', () => {
    const element = document.createElement('div');
    element.style.setProperty('touch-action', 'pan-y');

    claimTouchAction(element)();

    expect(element.style.getPropertyValue('touch-action')).toBe('pan-y');
    expect(element.style.getPropertyPriority('touch-action')).toBe('');
  });

  it('does not re-record the original value when a second claim is taken', () => {
    const element = document.createElement('div');
    element.style.setProperty('touch-action', 'pan-x');
    const first = claimTouchAction(element);
    const second = claimTouchAction(element);

    first();
    expect(element.style.getPropertyValue('touch-action')).toBe('none');
    expect(element.style.getPropertyPriority('touch-action')).toBe('important');

    second();
    expect(element.style.getPropertyValue('touch-action')).toBe('pan-x');
    expect(element.style.getPropertyPriority('touch-action')).toBe('');
  });

  it('ignores a claim released twice', () => {
    const element = document.createElement('div');
    element.style.setProperty('touch-action', 'pan-x');
    const first = claimTouchAction(element);
    const second = claimTouchAction(element);

    first();
    first();

    expect(element.style.getPropertyValue('touch-action')).toBe('none');
    expect(element.style.getPropertyPriority('touch-action')).toBe('important');

    second();
    expect(element.style.getPropertyValue('touch-action')).toBe('pan-x');
  });

  it('leaves an externally changed value alone on release', () => {
    const element = document.createElement('div');
    element.style.setProperty('touch-action', 'pan-x', 'important');
    const release = claimTouchAction(element);

    element.style.setProperty('touch-action', 'manipulation');
    release();

    expect(element.style.getPropertyValue('touch-action')).toBe('manipulation');
    expect(element.style.getPropertyPriority('touch-action')).toBe('');
  });

  it('starts a fresh claim after the previous one was fully released', () => {
    const element = document.createElement('div');
    element.style.setProperty('touch-action', 'pan-x');
    claimTouchAction(element)();

    const release = claimTouchAction(element);
    expect(element.style.getPropertyValue('touch-action')).toBe('none');
    release();
    expect(element.style.getPropertyValue('touch-action')).toBe('pan-x');
  });

  it('tracks claims on distinct elements independently', () => {
    const first = document.createElement('div');
    const second = document.createElement('div');
    first.style.setProperty('touch-action', 'pan-x');

    const releaseFirst = claimTouchAction(first);
    claimTouchAction(second);

    releaseFirst();

    expect(first.style.getPropertyValue('touch-action')).toBe('pan-x');
    expect(second.style.getPropertyValue('touch-action')).toBe('none');
  });
});
