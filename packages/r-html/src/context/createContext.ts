export type Context<T> = {
  key: string | symbol;
  value: T;
};

export function createContext<T>(value: T, key?: string | symbol): Context<T> {
  return Object.freeze({ key: key ?? Symbol(), value });
}

export const ContextInternalEventType = {
  subscribe: '@@r-html/context-subscribe',
  unsubscribe: '@@r-html/context-unsubscribe',
} as const;
export type ContextInternalEventType =
  (typeof ContextInternalEventType)[keyof typeof ContextInternalEventType];

export type ContextInternalEventMap = {
  [ContextInternalEventType.subscribe]: ContextEventDetail;
  [ContextInternalEventType.unsubscribe]: ContextEventDetail;
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

export type ContextEventDetail<T = any> = {
  context: Context<T>;
  observer: (value: T) => void;
};

export const contextSubscribeEvent = createInternalEvent<
  ContextInternalEventMap[typeof ContextInternalEventType.subscribe]
>(ContextInternalEventType.subscribe, { bubbles: true, composed: true });

export const contextUnsubscribeEvent = createInternalEvent<
  ContextInternalEventMap[typeof ContextInternalEventType.unsubscribe]
>(ContextInternalEventType.unsubscribe, { bubbles: true, composed: true });

export function fragmentContextBridge(fragment: DocumentFragment, root: Node) {
  const handleSubscribe = (event: Event) => {
    const e = event as CustomEvent<ContextEventDetail>;
    root.dispatchEvent(contextSubscribeEvent(e.detail));
  };

  const handleUnsubscribe = (event: Event) => {
    const e = event as CustomEvent<ContextEventDetail>;
    root.dispatchEvent(contextUnsubscribeEvent(e.detail));
  };

  fragment.addEventListener(contextSubscribeEvent.type, handleSubscribe);
  fragment.addEventListener(contextUnsubscribeEvent.type, handleUnsubscribe);
  return () => {
    fragment.removeEventListener(contextSubscribeEvent.type, handleSubscribe);
    fragment.removeEventListener(
      contextUnsubscribeEvent.type,
      handleUnsubscribe
    );
  };
}
