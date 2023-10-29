import { ValuesType } from '@/internal-types';

export const InternalEventType = {
  focus: 'erd-editor-internal-focus',
} as const;
export type InternalEventType = ValuesType<typeof InternalEventType>;

export type InternalEventMap = {
  [InternalEventType.focus]: void;
};

function createInternalEvent<P = void>(type: string) {
  function actionCreator(payload: P): CustomEvent<P> {
    return new CustomEvent(type, { detail: payload });
  }

  actionCreator.toString = () => `${type}`;
  actionCreator.type = type;
  return actionCreator;
}

export const focusEvent = createInternalEvent<
  InternalEventMap[typeof InternalEventType.focus]
>(InternalEventType.focus);
