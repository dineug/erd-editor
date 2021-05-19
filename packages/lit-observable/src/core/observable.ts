import {
  PropName,
  Observer,
  Unsubscribe,
  SubjectObserver,
  Trigger,
  NextTrigger,
  Subject,
} from '@@types/observable';
import { isObject, isArray } from './helper';

const rawToProxy = new WeakMap();
const rawToObservers = new WeakMap<object, Array<Observer>>();
const proxyToRaw = new WeakMap();
const proxyToSubject = new WeakMap<object, Subject<PropName>>();
const observerToTriggers = new WeakMap<Observer, Array<Trigger>>();
const queue: Observer[] = [];
const nextQueue: NextTrigger[] = [];

let currentObserver: Observer | null = null;
let batch = false;
let nextBatch = false;

export function observer(f: Observer): Unsubscribe {
  currentObserver = f;
  f();
  currentObserver = null;

  return () => unobserve(f);
}

function unobserve(observer: Observer) {
  const triggers = observerToTriggers.get(observer);

  triggers?.forEach(({ raw }) => {
    const observers = rawToObservers.get(raw);

    observers &&
      observers.includes(observer) &&
      observers.splice(observers.indexOf(observer), 1);
  });

  triggers && observerToTriggers.delete(observer);
}

function addObserver(raw: any) {
  if (!currentObserver) return;

  const observers = rawToObservers.get(raw);

  if (!observers) {
    rawToObservers.set(raw, [currentObserver]);
  } else if (!observers.includes(currentObserver)) {
    observers.push(currentObserver);
  }
}

function addTrigger(raw: any, p: PropName) {
  if (!currentObserver) return;

  const triggers = observerToTriggers.get(currentObserver);

  if (triggers) {
    const trigger = triggers.find(trigger => trigger.raw === raw);

    if (!trigger) {
      triggers.push({ raw, keys: [p] });
    } else if (!trigger.keys.includes(p)) {
      trigger.keys.push(p);
    }
  } else {
    observerToTriggers.set(currentObserver, [{ raw, keys: [p] }]);
  }
}

function isTrigger(raw: any, p: PropName, observer: Observer) {
  const triggers = observerToTriggers.get(observer);

  return triggers
    ? triggers.some(trigger => trigger.raw === raw && trigger.keys.includes(p))
    : false;
}

const effect = (raw: any, p: PropName) =>
  rawToObservers.get(raw)?.forEach(observer => {
    if (!isTrigger(raw, p, observer)) return;

    queue.includes(observer) || queue.push(observer);

    if (!batch) {
      queueMicrotask(execute);
      batch = true;
    }
  });

function execute() {
  while (queue.length) {
    const target = queue.shift() as Observer;

    unobserve(target);
    observer(target);
  }
  batch = false;
}

export function observable<T>(raw: T): T {
  const proxy = new Proxy(raw as any, {
    get(target, p, receiver) {
      const value = Reflect.get(target, p, receiver);

      addObserver(raw);
      addTrigger(raw, p);

      if (isObject(value) && !proxyToRaw.has(value)) {
        if (rawToProxy.has(value)) return rawToProxy.get(value);

        return observable(value);
      }

      return value;
    },
    set(target, p, value, receiver) {
      const oldValue = Reflect.get(target, p, receiver);
      const res = Reflect.set(target, p, value, receiver);

      if (!isArray(target) && oldValue !== value) {
        effect(target, p);
        nextEffect(target, p);
      } else if (p === 'length') {
        effect(target, p);
        nextEffect(target, p);
      }

      return res;
    },
  });

  rawToProxy.set(raw as any, proxy);
  proxyToRaw.set(proxy, raw);

  return proxy;
}

function nextEffect(raw: any, p: PropName) {
  const proxy = rawToProxy.get(raw);
  if (!proxy) return;

  const subject = proxyToSubject.get(proxy);
  if (!subject) return;

  const trigger = nextQueue.find(trigger => trigger.proxy === proxy);

  if (!trigger) {
    nextQueue.push({ proxy, keys: [p] });
  } else if (!trigger.keys.includes(p)) {
    trigger.keys.push(p);
  }

  if (!nextBatch) {
    queueMicrotask(nextExecute);
    nextBatch = true;
  }
}

function nextExecute() {
  while (nextQueue.length) {
    const trigger = nextQueue.shift() as NextTrigger;
    const subject = proxyToSubject.get(trigger.proxy);

    trigger.keys.forEach(key => subject?.next(key));
  }
  nextBatch = false;
}

export function createSubject<T>(): Subject<T> {
  const observers: Array<SubjectObserver<T>> = [];

  const next = (value: T) => observers.forEach(observer => observer(value));

  const subscribe = (observer: SubjectObserver<T>) => {
    observers.push(observer);

    return () => {
      observers.includes(observer) &&
        observers.splice(observers.indexOf(observer), 1);
    };
  };

  return {
    next,
    subscribe,
  };
}

export function watch(
  proxy: any,
  observer: SubjectObserver<PropName>
): Unsubscribe {
  let subject = proxyToSubject.get(proxy);

  if (!subject) {
    subject = createSubject<PropName>();
    proxyToSubject.set(proxy, subject);
  }

  return subject.subscribe(observer);
}
