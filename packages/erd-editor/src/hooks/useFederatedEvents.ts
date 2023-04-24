import { useContext } from '@dineug/r-html';
import { AllFederatedEventMap, DisplayObject } from 'pixi.js';

type EventName = keyof AllFederatedEventMap;

const events: EventName[] = [
  'click',
  'globalmousemove',
  'globalpointermove',
  'globaltouchmove',
  'mousedown',
  'mouseenter',
  'mouseleave',
  'mousemove',
  'mouseout',
  'mouseover',
  'mouseup',
  'mouseupoutside',
  'pointercancel',
  'pointerdown',
  'pointerenter',
  'pointerleave',
  'pointermove',
  'pointerout',
  'pointerover',
  'pointertap',
  'pointerup',
  'pointerupoutside',
  'rightclick',
  'rightdown',
  'rightup',
  'rightupoutside',
  'tap',
  'touchcancel',
  'touchend',
  'touchendoutside',
  'touchmove',
  'touchstart',
  'wheel',
];

export function useFederatedEvents(
  display: DisplayObject,
  ctx: Parameters<typeof useContext>[0]
) {
  events.forEach(name =>
    display.addEventListener(name, event =>
      ctx.dispatchEvent(new CustomEvent(name, { detail: event }))
    )
  );
}
