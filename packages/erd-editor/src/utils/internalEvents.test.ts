import { describe, expect, it, vi } from 'vite-plus/test';

import {
  focusEvent,
  forceFocusEvent,
  forwardMoveStartEvent,
  InternalEventType,
} from '@/utils/internalEvents';

describe('InternalEventType', () => {
  it('exposes the namespaced internal event names', () => {
    expect(InternalEventType).toEqual({
      focus: '@dineug/erd-editor/internal-focus',
      forceFocus: '@dineug/erd-editor/internal-force-focus',
      forwardMoveStart: '@dineug/erd-editor/internal-forward-move-start',
    });
  });
});

describe('focusEvent', () => {
  it('creates a CustomEvent that does not bubble by default', () => {
    const event = focusEvent();

    expect(event).toBeInstanceOf(CustomEvent);
    expect(event.type).toBe(InternalEventType.focus);
    expect(event.detail ?? undefined).toBeUndefined();
    expect(event.bubbles).toBe(false);
    expect(event.composed).toBe(false);
  });

  it('exposes the type through `type` and `toString`', () => {
    expect(focusEvent.type).toBe(InternalEventType.focus);
    expect(focusEvent.toString()).toBe(InternalEventType.focus);
    expect(`${focusEvent}`).toBe(InternalEventType.focus);
  });

  it('accepts option overrides', () => {
    const event = focusEvent(undefined, { bubbles: true, composed: true });

    expect(event.bubbles).toBe(true);
    expect(event.composed).toBe(true);
  });
});

describe('forceFocusEvent', () => {
  it('creates a non bubbling force focus event', () => {
    const event = forceFocusEvent();

    expect(event.type).toBe(InternalEventType.forceFocus);
    expect(forceFocusEvent.toString()).toBe(InternalEventType.forceFocus);
    expect(event.bubbles).toBe(false);
  });
});

describe('forwardMoveStartEvent', () => {
  it('carries the origin event and bubbles across shadow boundaries', () => {
    const originEvent = new MouseEvent('mousedown');
    const event = forwardMoveStartEvent({ originEvent });

    expect(event.type).toBe(InternalEventType.forwardMoveStart);
    expect(event.detail.originEvent).toBe(originEvent);
    expect(event.bubbles).toBe(true);
    expect(event.composed).toBe(true);
  });

  it('lets an explicit option override the default', () => {
    const event = forwardMoveStartEvent(
      { originEvent: new MouseEvent('mousedown') },
      { bubbles: false }
    );

    expect(event.bubbles).toBe(false);
    expect(event.composed).toBe(true);
  });

  it('bubbles up to an ancestor listener while focusEvent does not', () => {
    const parent = document.createElement('div');
    const child = document.createElement('div');
    parent.append(child);
    document.body.append(parent);

    const onForward = vi.fn();
    const onFocus = vi.fn();
    parent.addEventListener(forwardMoveStartEvent.type, onForward);
    parent.addEventListener(focusEvent.type, onFocus);

    const originEvent = new MouseEvent('mousedown');
    child.dispatchEvent(forwardMoveStartEvent({ originEvent }));
    child.dispatchEvent(focusEvent());

    expect(onForward).toHaveBeenCalledOnce();
    expect((onForward.mock.calls[0][0] as CustomEvent).detail.originEvent).toBe(
      originEvent
    );
    expect(onFocus).not.toHaveBeenCalled();

    parent.remove();
  });
});
