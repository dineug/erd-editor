import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vite-plus/test';

import { movePointer, releasePointer } from '@/__test-utils__';
import { listenMiddleButtonPan } from '@/components/erd/canvas/middleButtonPan';
import { type DragMove, middlePanPress$ } from '@/utils/globalEventObservable';
import { forwardMoveStartEvent } from '@/utils/internalEvents';
import { CURSOR_GRABBING } from '@/utils/stageCursor';

type Fixture = {
  shell: HTMLDivElement;
  container: HTMLDivElement;
  canvas: HTMLCanvasElement;
  onPress: ReturnType<typeof vi.fn>;
  moves: Array<Pick<DragMove, 'movementX' | 'movementY'>>;
  teardown: () => void;
};

let fixture: Fixture;

/** A root, the stage container inside it and the canvas konva draws in, as the scene nests them. */
function setup(): Fixture {
  const shell = document.createElement('div');
  const container = document.createElement('div');
  const canvas = document.createElement('canvas');
  container.append(canvas);
  shell.append(container);
  document.body.append(shell);

  const onPress = vi.fn();
  const moves: Fixture['moves'] = [];
  const teardown = listenMiddleButtonPan(
    container,
    ({ movementX, movementY }) => moves.push({ movementX, movementY }),
    onPress
  );

  return { shell, container, canvas, onPress, moves, teardown };
}

const fireMouse = (type: string, target: EventTarget, init: MouseEventInit) => {
  const event = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    composed: true,
    ...init,
  });
  target.dispatchEvent(event);
  return event;
};

const press = (target: EventTarget, init: MouseEventInit) =>
  fireMouse('mousedown', target, init);

const lift = (target: EventTarget, init: MouseEventInit) =>
  fireMouse('mouseup', target, init);

beforeEach(() => {
  // Anchors the move stream far from every press below, so a press the stream
  // never heard shows as a first step measured from here.
  window.dispatchEvent(new MouseEvent('mousedown', { clientX: 0, clientY: 0 }));
  releasePointer();
  fixture = setup();
});

afterEach(() => {
  releasePointer();
  fixture.teardown();
  fixture.shell.remove();
});

describe('listenMiddleButtonPan', () => {
  it('takes a middle press before the canvas, the root or the window hears it', () => {
    const heard: string[] = [];
    const listen = (name: string) => () => heard.push(name);
    const onCanvas = listen('canvas');
    const onShell = listen('shell');
    const onWindow = listen('window');
    fixture.canvas.addEventListener('mousedown', onCanvas);
    fixture.shell.addEventListener('mousedown', onShell);
    window.addEventListener('mousedown', onWindow);

    try {
      const event = press(fixture.canvas, { button: 1 });

      expect(event.defaultPrevented).toBe(true);
      expect(heard).toEqual([]);
      expect(fixture.onPress).toHaveBeenCalledOnce();
    } finally {
      window.removeEventListener('mousedown', onWindow);
    }
  });

  it('pans by the pointer from where the press went down, with no jump on the first step', () => {
    press(fixture.canvas, { button: 1, clientX: 300, clientY: 200 });
    movePointer(310, 205);
    movePointer(330, 225);

    expect(fixture.moves).toEqual([
      { movementX: 10, movementY: 5 },
      { movementX: 20, movementY: 20 },
    ]);
  });

  it('holds the grabbing hand for the length of the pan, then gives the cursor back', () => {
    fixture.container.style.cursor = 'pointer';

    press(fixture.canvas, { button: 1, clientX: 10, clientY: 10 });
    expect(fixture.container.style.cursor).toBe(CURSOR_GRABBING);

    releasePointer();
    expect(fixture.container.style.cursor).toBe('pointer');

    movePointer(40, 40);
    expect(fixture.moves).toEqual([]);
  });

  it('ends the pan on a middle lift over the scene, before the canvas, the root or the window hears it', () => {
    const heard: string[] = [];
    const listen = (name: string) => () => heard.push(name);
    const onCanvas = listen('canvas');
    const onShell = listen('shell');
    const onWindow = listen('window');
    fixture.container.style.cursor = 'pointer';
    press(fixture.canvas, { button: 1, clientX: 10, clientY: 10 });
    fixture.canvas.addEventListener('mouseup', onCanvas);
    fixture.shell.addEventListener('mouseup', onShell);
    window.addEventListener('mouseup', onWindow);

    try {
      const event = lift(fixture.canvas, { button: 1 });

      expect(event.defaultPrevented).toBe(true);
      expect(heard).toEqual([]);
      expect(fixture.container.style.cursor).toBe('pointer');
    } finally {
      window.removeEventListener('mouseup', onWindow);
    }

    movePointer(40, 40);
    expect(fixture.moves).toEqual([]);
  });

  it('leaves a lift of another button to the scene, whose lift on the window ends the pan', () => {
    press(fixture.canvas, { button: 1, clientX: 10, clientY: 10 });
    const onCanvas = vi.fn();
    fixture.canvas.addEventListener('mouseup', onCanvas);

    const event = lift(fixture.canvas, { button: 0 });
    movePointer(40, 40);

    expect(event.defaultPrevented).toBe(false);
    expect(onCanvas).toHaveBeenCalledOnce();
    expect(fixture.moves).toEqual([]);
  });

  // Chromium on Linux pastes the selection on a middle lift left unprevented,
  // into a cell editor the prevented press left focused, wherever it lands.
  it('prevents a middle lift off the scene too, which ends the pan on the window', () => {
    press(fixture.canvas, { button: 1, clientX: 10, clientY: 10 });

    const event = lift(document.body, { button: 1 });
    movePointer(40, 40);

    expect(event.defaultPrevented).toBe(true);
    expect(fixture.moves).toEqual([]);
    expect(lift(document.body, { button: 1 }).defaultPrevented).toBe(false);
  });

  it('lets a middle lift through once a lift elsewhere has ended the pan', () => {
    press(fixture.canvas, { button: 1, clientX: 10, clientY: 10 });
    releasePointer();
    const onCanvas = vi.fn();
    fixture.canvas.addEventListener('mouseup', onCanvas);

    const event = lift(fixture.canvas, { button: 1 });

    expect(event.defaultPrevented).toBe(false);
    expect(onCanvas).toHaveBeenCalledOnce();
  });

  it.each([
    ['main', 0],
    ['right', 2],
  ])('leaves a %s press to the scene', (_name, button) => {
    const onCanvas = vi.fn();
    fixture.canvas.addEventListener('mousedown', onCanvas);

    const event = press(fixture.canvas, { button, clientX: 50, clientY: 50 });
    movePointer(60, 60);

    expect(event.defaultPrevented).toBe(false);
    expect(onCanvas).toHaveBeenCalledOnce();
    expect(fixture.onPress).not.toHaveBeenCalled();
    expect(fixture.moves).toEqual([]);
  });

  it('pans with no press callback given', () => {
    fixture.teardown();
    const moves: number[] = [];
    fixture.teardown = listenMiddleButtonPan(
      fixture.container,
      ({ movementX }) => moves.push(movementX)
    );

    press(fixture.canvas, { button: 1, clientX: 100, clientY: 100 });
    movePointer(125, 100);

    expect(moves).toEqual([25]);
  });

  it('stops listening once torn down', () => {
    fixture.teardown();

    const event = press(fixture.canvas, {
      button: 1,
      clientX: 100,
      clientY: 0,
    });
    movePointer(120, 0);

    expect(event.defaultPrevented).toBe(false);
    expect(fixture.onPress).not.toHaveBeenCalled();
    expect(fixture.moves).toEqual([]);
  });
});

describe('middlePanPress$', () => {
  it('hands a node above the stage container the middle press the pan kept from it', () => {
    const heard: MouseEvent[] = [];
    const onShell = vi.fn();
    fixture.shell.addEventListener('mousedown', onShell);
    const subscription = middlePanPress$(fixture.shell).subscribe(event =>
      heard.push(event)
    );

    try {
      const event = press(fixture.canvas, { button: 1 });

      expect(onShell).not.toHaveBeenCalled();
      expect(heard).toEqual([event]);
    } finally {
      subscription.unsubscribe();
    }
  });

  it('passes over a forward that carries a press of another button', () => {
    const heard: MouseEvent[] = [];
    const subscription = middlePanPress$(fixture.shell).subscribe(event =>
      heard.push(event)
    );

    try {
      fixture.container.dispatchEvent(
        forwardMoveStartEvent({
          originEvent: new MouseEvent('mousedown', { button: 0 }),
        })
      );

      expect(heard).toEqual([]);
    } finally {
      subscription.unsubscribe();
    }
  });
});
