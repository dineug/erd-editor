import { ValuesType } from '@/internal-types';

export const InternalEventType = {
  focus: 'erd-editor-internal-focus',
  forwardMoveStart: 'erd-editor-internal-forward-move-start',
} as const;
export type InternalEventType = ValuesType<typeof InternalEventType>;

export type InternalEventMap = {
  [InternalEventType.focus]: void;
  [InternalEventType.forwardMoveStart]: {
    originEvent: MouseEvent | TouchEvent;
  };
};

type EventOptions = {
  bubbles?: boolean;
  composed?: boolean;
};

function createInternalEvent<P = void>(
  type: string,
  defaultOptions?: EventOptions
) {
  function actionCreator(payload: P, options?: EventOptions): CustomEvent<P> {
    return new CustomEvent(type, {
      detail: payload,
      ...defaultOptions,
      ...options,
    });
  }

  actionCreator.toString = () => `${type}`;
  actionCreator.type = type;
  return actionCreator;
}

export const focusEvent = createInternalEvent<
  InternalEventMap[typeof InternalEventType.focus]
>(InternalEventType.focus);

export const forwardMoveStartEvent = createInternalEvent<
  InternalEventMap[typeof InternalEventType.forwardMoveStart]
>(InternalEventType.forwardMoveStart, { bubbles: true, composed: true });
