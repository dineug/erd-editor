import type { KonvaEventObject } from 'konva/lib/Node';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import { movePointer, releasePointer } from '@/__test-utils__';
import { captureGraphPan } from '@/components/visualization/graphPan';
import {
  createVisualizationState,
  type VisualizationState,
} from '@/components/visualization/visualizationView';
import { CURSOR_GRABBING } from '@/utils/stageCursor';

/**
 * A konva event as the pan reads one: the native press and a target that can
 * hold the pointer, hung in a stage container or in none, as a node torn down
 * between the press and its handler is.
 */
function pressOn(evt: Event, container: HTMLElement | null) {
  window.dispatchEvent(evt);

  return {
    evt,
    pointerId: 1,
    target: {
      getStage: () => (container ? { container: () => container } : null),
      setPointerCapture: () => {},
      hasPointerCapture: () => false,
      releaseCapture: () => {},
    },
  } as unknown as KonvaEventObject<Event>;
}

const mousedown = (button: number) =>
  new MouseEvent('mousedown', {
    bubbles: true,
    cancelable: true,
    button,
    clientX: 0,
    clientY: 0,
  });

/** A lift of one button, for a spec to dispatch on an element as a mouse does. */
const mouseup = (button: number) =>
  new MouseEvent('mouseup', { bubbles: true, cancelable: true, button });

const state = (): VisualizationState => createVisualizationState(900, 700);

afterEach(() => {
  releasePointer();
});

describe('captureGraphPan', () => {
  it('pans by the pointer and lets the drag flag go on the lift', () => {
    const view = state();
    const { x, y } = view;
    const press = mousedown(0);

    captureGraphPan(pressOn(press, document.createElement('div')), view);
    movePointer(20, 10);

    expect(view.drag).toBe(true);
    expect([view.x, view.y]).toEqual([x + 20, y + 10]);
    expect(press.defaultPrevented).toBe(false);

    releasePointer();
    expect(view.drag).toBe(false);
  });

  it('takes a middle press whole and holds the grabbing hand until the lift', () => {
    const view = state();
    const container = document.createElement('div');
    const press = mousedown(1);

    captureGraphPan(pressOn(press, container), view);

    expect(press.defaultPrevented).toBe(true);
    expect(container.style.cursor).toBe(CURSOR_GRABBING);

    const lift = mouseup(1);
    document.body.dispatchEvent(lift);
    expect(lift.defaultPrevented).toBe(true);
    expect(container.style.cursor).toBe('');
  });

  it('leaves the lift of a main press to the browser', () => {
    captureGraphPan(
      pressOn(mousedown(0), document.createElement('div')),
      state()
    );

    const lift = mouseup(0);
    document.body.dispatchEvent(lift);

    expect(lift.defaultPrevented).toBe(false);
  });

  it('still pans from a middle press on a node no stage holds any more', () => {
    const view = state();
    const { x } = view;

    captureGraphPan(pressOn(mousedown(1), null), view);
    movePointer(30, 0);

    expect(view.x).toBe(x + 30);
  });

  it('leaves the second finger of a pinch to the pinch', () => {
    const view = state();
    const evt = new Event('touchstart', { bubbles: true });
    Object.defineProperty(evt, 'touches', {
      value: [
        { clientX: 0, clientY: 0 },
        { clientX: 80, clientY: 0 },
      ],
    });

    captureGraphPan(pressOn(evt, document.createElement('div')), view);

    expect(view.drag).toBe(false);
  });
});
