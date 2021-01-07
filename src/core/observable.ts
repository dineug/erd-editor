import { Subject, Subscription } from "rxjs";
import { isObject, isArray } from "./helper";
import { Logger } from "./Logger";

type PropName = string | number | symbol;
type Observer = () => void;

interface Trigger {
  raw: any;
  keys: PropName[];
}

interface NextTrigger {
  proxy: any;
  keys: PropName[];
}

const rawToProxy = new WeakMap();
const rawToObservers = new WeakMap<object, Array<Observer>>();
const proxyToRaw = new WeakMap();
const proxyToObservable$ = new WeakMap<object, Subject<PropName>>();
const observerToTriggers = new WeakMap<Observer, Array<Trigger>>();
const queue: Observer[] = [];
const nextQueue: NextTrigger[] = [];

let currentObserver: Observer | null = null;
let batch = false;
let nextBatch = false;
let proxyCount = 0;

function removeObserver(observer: Observer) {
  const triggers = observerToTriggers.get(observer);

  triggers?.forEach(({ raw }) => {
    const observers = rawToObservers.get(raw);

    if (observers && observers.includes(observer)) {
      observers.splice(observers.indexOf(observer), 1);
    }
  });

  if (triggers) {
    observerToTriggers.delete(observer);
  }
}

function addObserver(raw: any) {
  if (currentObserver !== null) {
    const observers = rawToObservers.get(raw);

    if (!observers) {
      rawToObservers.set(raw, [currentObserver]);
    } else if (!observers.includes(currentObserver)) {
      observers.push(currentObserver);
    }
  }
}

function addTrigger(raw: any, p: PropName) {
  if (currentObserver !== null) {
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
}

const isTrigger = (raw: any, p: PropName, observer: Observer) =>
  observerToTriggers
    .get(observer)
    ?.some(trigger => trigger.raw === raw && trigger.keys.includes(p));

const effect = (raw: any, p: PropName) =>
  rawToObservers.get(raw)?.forEach(observer => {
    if (isTrigger(raw, p, observer)) {
      queue.includes(observer) || queue.push(observer);

      if (!batch) {
        requestAnimationFrame(execute);
        batch = true;
      }
    }
  });

function execute() {
  while (queue.length) {
    const observer = queue.shift();

    observer && observer();
  }
  batch = false;
}

function nextEffect(raw: any, p: PropName) {
  const proxy = rawToProxy.get(raw);

  if (proxy) {
    const observable$ = proxyToObservable$.get(proxy);

    if (observable$) {
      const trigger = nextQueue.find(trigger => trigger.proxy === proxy);

      if (!trigger) {
        nextQueue.push({ proxy, keys: [p] });
      } else if (!trigger.keys.includes(p)) {
        trigger.keys.push(p);
      }

      if (!nextBatch) {
        requestAnimationFrame(nextExecute);
        nextBatch = true;
      }
    }
  }
}

function nextExecute() {
  while (nextQueue.length) {
    const trigger = nextQueue.shift();

    if (trigger) {
      const observable$ = proxyToObservable$.get(trigger.proxy);

      trigger.keys.forEach(key => observable$?.next(key));
    }
  }
  nextBatch = false;
}

export function observable<T>(raw: T): T {
  const proxy = new Proxy(raw as any, {
    get(target, p) {
      addObserver(raw);
      addTrigger(raw, p);

      if (isObject(target[p]) && !proxyToRaw.has(target[p])) {
        if (rawToProxy.has(target[p])) return rawToProxy.get(target[p]);

        return observable(target[p]);
      }

      return target[p];
    },
    set(target, p, value) {
      target[p] = value;

      if (!isArray(target)) {
        effect(target, p);
        nextEffect(target, p);
      } else if (p === "length") {
        effect(target, p);
        nextEffect(target, p);
      }

      return true;
    },
  });

  rawToProxy.set(raw as any, proxy);
  proxyToRaw.set(proxy, raw);

  Logger.debug(`createObservable proxyCount: ${++proxyCount}`, raw);

  return proxy;
}

export function observer(f: Observer) {
  currentObserver = f;
  f();
  currentObserver = null;

  return () => removeObserver(f);
}

export function watch(
  proxy: any,
  observer: (propName: PropName) => void
): Subscription {
  let observable$ = proxyToObservable$.get(proxy);

  if (!observable$) {
    observable$ = new Subject();
    proxyToObservable$.set(proxy, observable$);
  }

  return observable$.subscribe(observer);
}
